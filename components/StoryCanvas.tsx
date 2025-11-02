import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import CodeBlock from './CodeBlock';
import GroupContainer from './GroupContainer';
import type { Block, Position, RenpyAnalysisResult, LabelLocation, BlockGroup, Link } from '../types';

interface StoryCanvasProps {
  blocks: Block[];
  groups: BlockGroup[];
  analysisResult: RenpyAnalysisResult;
  updateBlock: (id: string, newBlockData: Partial<Block>) => void;
  updateGroup: (id: string, newGroupData: Partial<BlockGroup>) => void;
  updateBlockPositions: (updates: { id: string, position: Position }[]) => void;
  updateGroupPositions: (updates: { id: string, position: Position }[]) => void;
  onInteractionEnd: () => void;
  deleteBlock: (id: string) => void;
  onOpenEditor: (id: string, line?: number) => void;
  selectedBlockIds: string[];
  setSelectedBlockIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  selectedGroupIds: string[];
  setSelectedGroupIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  findUsagesHighlightIds: Set<string> | null;
  clearFindUsages: () => void;
  dirtyBlockIds: Set<string>;
  canvasFilters: { story: boolean; screens: boolean; config: boolean };
  setCanvasFilters: React.Dispatch<React.SetStateAction<{ story: boolean; screens: boolean; config: boolean }>>;
  centerOnBlockRequest: { blockId: string, key: number } | null;
}

const getBlockById = (blocks: Block[], id: string) => blocks.find(b => b.id === id);
const getGroupById = (groups: BlockGroup[], id: string) => groups.find(g => g.id === id);

const getAttachmentPoint = (block: Block, side: 'left' | 'right' | 'top' | 'bottom'): Position => {
    switch(side) {
        case 'left': return { x: block.position.x, y: block.position.y + block.height / 2 };
        case 'right': return { x: block.position.x + block.width, y: block.position.y + block.height / 2 };
        case 'top': return { x: block.position.x + block.width / 2, y: block.position.y };
        case 'bottom': return { x: block.position.x + block.width / 2, y: block.position.y + block.height };
    }
}

const getOptimalPath = (sourceBlock: Block, targetBlock: Block): [Position, Position] => {
    const sourcePoints = {
        right: getAttachmentPoint(sourceBlock, 'right'),
        left: getAttachmentPoint(sourceBlock, 'left'),
        bottom: getAttachmentPoint(sourceBlock, 'bottom'),
        top: getAttachmentPoint(sourceBlock, 'top'),
    };
    const targetPoints = {
        left: getAttachmentPoint(targetBlock, 'left'),
        right: getAttachmentPoint(targetBlock, 'right'),
        top: getAttachmentPoint(targetBlock, 'top'),
        bottom: getAttachmentPoint(targetBlock, 'bottom'),
    };

    let bestPath: [Position, Position] = [sourcePoints.right, targetPoints.left];
    let minDistance = Infinity;

    for (const sKey of Object.keys(sourcePoints) as Array<keyof typeof sourcePoints>) {
        for (const tKey of Object.keys(targetPoints) as Array<keyof typeof targetPoints>) {
            const dist = Math.hypot(sourcePoints[sKey].x - targetPoints[tKey].x, sourcePoints[sKey].y - targetPoints[tKey].y);
            if (dist < minDistance) {
                minDistance = dist;
                bestPath = [sourcePoints[sKey], targetPoints[tKey]];
            }
        }
    }
    return bestPath;
};

const Arrow: React.FC<{ 
  link: Link;
  sourcePos: Position; 
  targetPos: Position;
  isDimmed: boolean;
  onHighlight: (startNodeId: string) => void;
}> = ({ link, sourcePos, targetPos, isDimmed, onHighlight }) => {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    
    const controlX = sourcePos.x + dx / 2 + (dy / 5);
    const controlY = sourcePos.y + dy / 2 - (dx / 5);

    const pathData = `M${sourcePos.x},${sourcePos.y} Q${controlX},${controlY} ${targetPos.x},${targetPos.y}`;
    
    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation(); // Prevent canvas from handling this to start a rubber band
        onHighlight(link.targetId);
    };

    return (
        <g 
          className={`arrow-interaction-group transition-opacity duration-300 ${isDimmed ? 'opacity-20' : 'opacity-100'} pointer-events-auto`}
          onPointerDown={handlePointerDown}
        >
          <path
              d={pathData}
              stroke="transparent"
              strokeWidth="20"
              fill="none"
              className="cursor-pointer"
          />
          <path
              d={pathData}
              stroke="#4f46e5"
              strokeWidth="3"
              fill="none"
              markerEnd="url(#arrowhead)"
              className="pointer-events-none"
          />
        </g>
    );
};

interface Rect { x: number; y: number; width: number; height: number; }

const RubberBand: React.FC<{ rect: Rect }> = ({ rect }) => {
    if (!rect) return null;
    return (
        <div
            className="absolute border-2 border-indigo-500 bg-indigo-500 bg-opacity-20 pointer-events-none"
            style={{
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
            }}
        />
    );
};

type InteractionState = 
  | { type: 'idle' }
  | { type: 'panning'; }
  | { type: 'rubber-band'; start: Position; }
  | { type: 'dragging-blocks'; dragStartPositions: Map<string, Position>; }
  | { type: 'dragging-groups'; groupDragStartPositions: Map<string, Position>; blockDragStartPositions: Map<string, Position>; }
  | { type: 'resizing-block'; block: Block; }
  | { type: 'resizing-group'; group: BlockGroup; };

const StoryCanvas: React.FC<StoryCanvasProps> = ({ blocks, groups, analysisResult, updateBlock, updateGroup, updateBlockPositions, updateGroupPositions, onInteractionEnd, deleteBlock, onOpenEditor, selectedBlockIds, setSelectedBlockIds, selectedGroupIds, setSelectedGroupIds, findUsagesHighlightIds, clearFindUsages, dirtyBlockIds, canvasFilters, setCanvasFilters, centerOnBlockRequest }) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [rubberBandRect, setRubberBandRect] = useState<Rect | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [highlightedPath, setHighlightedPath] = useState<Set<string> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const interactionState = useRef<InteractionState>({ type: 'idle' });
  const pointerStartPos = useRef<Position>({ x: 0, y: 0 });
  const [flashingBlockId, setFlashingBlockId] = useState<string | null>(null);
  const lastHandledRequestKey = useRef<number | null>(null);

  useEffect(() => {
    if (!centerOnBlockRequest || !canvasRef.current) return;
    if (centerOnBlockRequest.key === lastHandledRequestKey.current) return;

    const { blockId } = centerOnBlockRequest;
    const block = getBlockById(blocks, blockId);
    const canvasEl = canvasRef.current;

    if (block && canvasEl) {
        const canvasRect = canvasEl.getBoundingClientRect();
        const targetX = block.position.x + block.width / 2;
        const targetY = block.position.y + block.height / 2;

        const newX = (canvasRect.width / 2) - (targetX * transform.scale);
        const newY = (canvasRect.height / 2) - (targetY * transform.scale);
        
        setTransform(t => ({ ...t, x: newX, y: newY }));

        setFlashingBlockId(blockId);
        const timer = setTimeout(() => setFlashingBlockId(null), 1500);
        
        lastHandledRequestKey.current = centerOnBlockRequest.key;

        return () => clearTimeout(timer);
    }
  }, [centerOnBlockRequest, blocks, transform.scale]);

  const adjacencyMap = useMemo(() => {
    const adj = new Map<string, string[]>();
    blocks.forEach(b => adj.set(b.id, []));
    analysisResult.links.forEach(link => {
      if (adj.has(link.sourceId)) {
        adj.get(link.sourceId)!.push(link.targetId);
      }
    });
    return adj;
  }, [blocks, analysisResult.links]);

  const handleHighlightPath = useCallback((startNodeId: string) => {
    const path = new Set<string>([startNodeId]);
    const queue = [startNodeId];
    const visited = new Set<string>([startNodeId]);

    while (queue.length > 0) {
      const u = queue.shift()!;
      path.add(u); // Add the source of the path as well
      const neighbors = adjacencyMap.get(u) || [];
      for (const v of neighbors) {
        if (!visited.has(v)) {
          visited.add(v);
          queue.push(v);
        }
      }
    }

    // Trace back to find all sources of the start node for a complete path view
    let hasChanged = true;
    while(hasChanged) {
        hasChanged = false;
        for(const link of analysisResult.links) {
            if(path.has(link.targetId) && !path.has(link.sourceId)){
                path.add(link.sourceId);
                hasChanged = true;
            }
        }
    }

    setHighlightedPath(path);
  }, [adjacencyMap, analysisResult.links]);


  const getPointInWorldSpace = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale,
    };
  }, [transform.x, transform.y, transform.scale]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const targetEl = e.target as HTMLElement;
    
    if (targetEl.closest('.arrow-interaction-group') || targetEl.closest('.filter-panel')) {
      return;
    }

    pointerStartPos.current = getPointInWorldSpace(e.clientX, e.clientY);
    
    const blockWrapper = targetEl.closest('.code-block-wrapper');
    const groupWrapper = targetEl.closest('.group-container-wrapper');
    const blockId = blockWrapper?.getAttribute('data-block-id');
    const groupId = groupWrapper?.getAttribute('data-group-id');
    const block = blockId ? getBlockById(blocks, blockId) : null;
    const group = groupId ? getGroupById(groups, groupId) : null;
    
    const canvasEl = e.currentTarget;

    if (block && blockId) {
        if (targetEl.closest('.resize-handle')) {
            interactionState.current = { type: 'resizing-block', block };
        } else if (targetEl.closest('.drag-handle') && !targetEl.closest('button, input')) {
            const currentSelection = selectedBlockIds.includes(blockId) ? selectedBlockIds : [blockId];
            const dragStartPositions = new Map<string, Position>();
            blocks.forEach(b => {
                if (currentSelection.includes(b.id)) {
                    dragStartPositions.set(b.id, b.position);
                }
            });
            interactionState.current = { type: 'dragging-blocks', dragStartPositions };
            setIsDraggingSelection(true);
        }

        if (e.shiftKey) {
            setSelectedBlockIds(prev => prev.includes(blockId) ? prev.filter(id => id !== blockId) : [...prev, blockId]);
        } else if (!selectedBlockIds.includes(blockId)) {
            setSelectedBlockIds([blockId]);
            setSelectedGroupIds([]);
        }
    } else if (group && groupId) {
        if (targetEl.closest('.resize-handle')) {
            interactionState.current = { type: 'resizing-group', group };
        } else if (targetEl.closest('.drag-handle')) {
            const currentSelection = selectedGroupIds.includes(groupId) ? selectedGroupIds : [groupId];
            const groupDragStartPositions = new Map<string, Position>();
            const blockDragStartPositions = new Map<string, Position>();
            const blockIdsToMove = new Set<string>();

            currentSelection.forEach(id => {
              const g = getGroupById(groups, id);
              if (g) {
                groupDragStartPositions.set(id, g.position);
                g.blockIds.forEach(bId => blockIdsToMove.add(bId));
              }
            });
            
            blocks.forEach(b => {
              if (blockIdsToMove.has(b.id)) {
                blockDragStartPositions.set(b.id, b.position);
              }
            });

            interactionState.current = { type: 'dragging-groups', groupDragStartPositions, blockDragStartPositions };
            setIsDraggingSelection(true);
        }

        if (e.shiftKey) {
            setSelectedGroupIds(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
        } else if (!selectedGroupIds.includes(groupId)) {
            setSelectedGroupIds([groupId]);
            setSelectedBlockIds([]);
        }
    } else {
        if (e.shiftKey) {
            interactionState.current = { type: 'panning' };
        } else {
            interactionState.current = { type: 'rubber-band', start: pointerStartPos.current };
        }
        canvasEl.setPointerCapture(e.pointerId);
    }

    const handlePointerMove = (moveEvent: PointerEvent) => {
        const currentPos = getPointInWorldSpace(moveEvent.clientX, moveEvent.clientY);
        const dx = currentPos.x - pointerStartPos.current.x;
        const dy = currentPos.y - pointerStartPos.current.y;

        switch(interactionState.current.type) {
            case 'dragging-blocks': {
                const updates = Array.from(interactionState.current.dragStartPositions.entries()).map(([id, startPos]) => ({
                    id,
                    position: { x: startPos.x + dx, y: startPos.y + dy }
                }));
                updateBlockPositions(updates);
                break;
            }
            case 'dragging-groups': {
              const { groupDragStartPositions, blockDragStartPositions } = interactionState.current;
              const groupUpdates = Array.from(groupDragStartPositions.entries()).map(([id, startPos]) => ({
                id, position: { x: startPos.x + dx, y: startPos.y + dy }
              }));
              const blockUpdates = Array.from(blockDragStartPositions.entries()).map(([id, startPos]) => ({
                id, position: { x: startPos.x + dx, y: startPos.y + dy }
              }));
              updateGroupPositions(groupUpdates);
              updateBlockPositions(blockUpdates);
              break;
            }
            case 'resizing-block': {
                const { block } = interactionState.current;
                updateBlock(block.id, {
                    width: Math.max(block.width + dx * transform.scale, 250),
                    height: Math.max(block.height + dy * transform.scale, 150),
                });
                break;
            }
             case 'resizing-group': {
              const { group } = interactionState.current;
              updateGroup(group.id, {
                width: Math.max(group.width + dx * transform.scale, 250),
                height: Math.max(group.height + dy * transform.scale, 150),
              });
              break;
            }
            case 'panning': {
                setTransform(t => ({...t, x: t.x + moveEvent.movementX, y: t.y + moveEvent.movementY }));
                break;
            }
            case 'rubber-band': {
                const start = interactionState.current.start;
                const x = Math.min(start.x, currentPos.x);
                const y = Math.min(start.y, currentPos.y);
                const width = Math.abs(start.x - currentPos.x);
                const height = Math.abs(start.y - currentPos.y);
                setRubberBandRect({ x, y, width, height });
                break;
            }
        }
    };
    
    const handlePointerUp = (upEvent: PointerEvent) => {
        const state = interactionState.current;
        const pointerEndPos = getPointInWorldSpace(upEvent.clientX, upEvent.clientY);
        const startPos = pointerStartPos.current;

        const dx = pointerEndPos.x - startPos.x;
        const dy = pointerEndPos.y - startPos.y;
        const distance = Math.hypot(dx, dy);

        if (state.type === 'rubber-band') {
            if (distance > 5) { // A drag occurred.
                const finalRect: Rect = {
                    x: Math.min(startPos.x, pointerEndPos.x),
                    y: Math.min(startPos.y, pointerEndPos.y),
                    width: Math.abs(dx),
                    height: Math.abs(dy),
                };

                 const selectedInRect = blocks.filter(b => 
                    b.position.x < finalRect.x + finalRect.width &&
                    b.position.x + b.width > finalRect.x &&
                    b.position.y < finalRect.y + finalRect.height &&
                    b.position.y + b.height > finalRect.y
                ).map(b => b.id);
                
                const selectedGroupsInRect = groups.filter(g => 
                    g.position.x < finalRect.x + finalRect.width &&
                    g.position.x + g.width > finalRect.x &&
                    g.position.y < finalRect.y + finalRect.height &&
                    g.position.y + g.height > finalRect.y
                ).map(g => g.id);

                if (upEvent.shiftKey) {
                    setSelectedBlockIds(prev => [...new Set([...prev, ...selectedInRect])]);
                    setSelectedGroupIds(prev => [...new Set([...prev, ...selectedGroupsInRect])]);
                } else {
                    setSelectedBlockIds(selectedInRect);
                    setSelectedGroupIds(selectedGroupsInRect);
                }
            } else { // It was a click, not a drag.
                setSelectedBlockIds([]);
                setSelectedGroupIds([]);
                if (highlightedPath) setHighlightedPath(null);
                if (findUsagesHighlightIds) clearFindUsages();
            }
        }
        
        const wasInteractiveMove = state.type === 'dragging-blocks' || 
                                 state.type === 'dragging-groups' || 
                                 state.type === 'resizing-block' || 
                                 state.type === 'resizing-group';
        
        if (wasInteractiveMove && distance > 2) {
            onInteractionEnd();
        }

        setIsDraggingSelection(false);
        interactionState.current = { type: 'idle' };
        setRubberBandRect(null);
        if (canvasRef.current) canvasEl.releasePointerCapture(e.pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    if (!canvasRef.current || (e.target as HTMLElement).closest('.filter-panel')) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setTransform(t => {
      const zoom = 1 - e.deltaY * 0.002;
      const newScale = Math.max(0.2, Math.min(3, t.scale * zoom));
      const worldX = (pointer.x - t.x) / t.scale;
      const worldY = (pointer.y - t.y) / t.scale;
      const newX = pointer.x - worldX * newScale;
      const newY = pointer.y - worldY * newScale;
      return { x: newX, y: newY, scale: newScale };
    });
  };

  const backgroundStyle = {
    backgroundSize: `${32 * transform.scale}px ${32 * transform.scale}px`,
    backgroundPosition: `${transform.x}px ${transform.y}px`,
  };
  
  const visibleBlocks = useMemo(() => {
    return blocks.filter(block => {
        const isStory = analysisResult.storyBlockIds.has(block.id);
        const isScreen = analysisResult.screenOnlyBlockIds.has(block.id);
        const isConfig = analysisResult.configBlockIds.has(block.id);

        if (isStory && canvasFilters.story) return true;
        if (isScreen && canvasFilters.screens) return true;
        if (isConfig && canvasFilters.config) return true;
        return false;
    });
  }, [blocks, canvasFilters, analysisResult]);

  const visibleBlockIds = useMemo(() => new Set(visibleBlocks.map(b => b.id)), [visibleBlocks]);

  const visibleLinks = useMemo(() => {
      return analysisResult.links.filter(link => 
          visibleBlockIds.has(link.sourceId) && visibleBlockIds.has(link.targetId)
      );
  }, [analysisResult.links, visibleBlockIds]);

  const svgBounds = useMemo(() => {
    if (visibleBlocks.length === 0) {
      return { top: 0, left: 0, width: 0, height: 0 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    visibleBlocks.forEach(block => {
      minX = Math.min(minX, block.position.x);
      minY = Math.min(minY, block.position.y);
      maxX = Math.max(maxX, block.position.x + block.width);
      maxY = Math.max(maxY, block.position.y + block.height);
    });

    const PADDING = 200;

    return {
      left: minX - PADDING,
      top: minY - PADDING,
      width: (maxX - minX) + PADDING * 2,
      height: (maxY - minY) + PADDING * 2,
    };
  }, [visibleBlocks]);

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing bg-gray-100 dark:bg-gray-900 bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] dark:bg-[radial-gradient(#4b5563_1px,transparent_1px)]"
      style={backgroundStyle}
      onPointerDown={handlePointerDown}
      onWheel={handleWheel}
    >
        <div className="filter-panel absolute top-4 right-4 z-20 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col space-y-2">
            <h4 className="text-sm font-semibold text-center px-2">View Filters</h4>
            <label className="flex items-center space-x-2 cursor-pointer text-sm">
                <input type="checkbox" checked={canvasFilters.story} onChange={e => setCanvasFilters(f => ({ ...f, story: e.target.checked }))} className="h-4 w-4 rounded focus:ring-indigo-500" style={{ accentColor: 'rgb(79 70 229)' }} />
                <span>Story Blocks</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer text-sm">
                <input type="checkbox" checked={canvasFilters.screens} onChange={e => setCanvasFilters(f => ({ ...f, screens: e.target.checked }))} className="h-4 w-4 rounded focus:ring-teal-500" style={{ accentColor: 'rgb(13 148 136)' }} />
                <span>Screen Blocks</span>
            </label>
             <label className="flex items-center space-x-2 cursor-pointer text-sm">
                <input type="checkbox" checked={canvasFilters.config} onChange={e => setCanvasFilters(f => ({ ...f, config: e.target.checked }))} className="h-4 w-4 rounded focus:ring-red-500" style={{ accentColor: 'rgb(239 68 68)' }} />
                <span>Config Blocks</span>
            </label>
        </div>

      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <svg 
          className="absolute pointer-events-none"
          style={{
            left: svgBounds.left,
            top: svgBounds.top,
            width: svgBounds.width,
            height: svgBounds.height,
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              viewBox="-14 0 14 10"
              markerWidth="14"
              markerHeight="10"
              refX="0"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon points="-14 0, 0 5, -14 10" fill="#4f46e5" />
            </marker>
          </defs>
          <g transform={`translate(${-svgBounds.left}, ${-svgBounds.top})`}>
            {visibleLinks.map((link, index) => {
              const sourceBlock = getBlockById(blocks, link.sourceId);
              const targetBlock = getBlockById(blocks, link.targetId);
              if (!sourceBlock || !targetBlock) return null;
              const [sourcePos, targetPos] = getOptimalPath(sourceBlock, targetBlock);
              const isDimmed = highlightedPath !== null && (!highlightedPath.has(link.sourceId) || !highlightedPath.has(link.targetId));
              return <Arrow key={`${link.sourceId}-${link.targetId}-${index}`} link={link} sourcePos={sourcePos} targetPos={targetPos} isDimmed={isDimmed} onHighlight={handleHighlightPath} />;
            })}
          </g>
        </svg>

        {rubberBandRect && <RubberBand rect={rubberBandRect} />}

        {groups.map((group) => {
          const isDimmed = highlightedPath !== null && !group.blockIds.some(id => highlightedPath.has(id));
          return (
            <GroupContainer
              key={group.id}
              group={group}
              updateGroup={updateGroup}
              isSelected={selectedGroupIds.includes(group.id)}
              isDragging={isDraggingSelection && selectedGroupIds.includes(group.id)}
              isDimmed={isDimmed}
            />
          );
        })}

        {visibleBlocks.map((block) => {
          const isDimmed = (highlightedPath !== null && !highlightedPath.has(block.id)) || 
                          (findUsagesHighlightIds !== null && !findUsagesHighlightIds.has(block.id));
          const isUsageHighlighted = findUsagesHighlightIds?.has(block.id) ?? false;
          const isScreenBlock = analysisResult.screenOnlyBlockIds.has(block.id);
          const isConfigBlock = analysisResult.configBlockIds.has(block.id);
          return (
            <CodeBlock
              key={block.id}
              block={block}
              analysisResult={analysisResult}
              updateBlock={updateBlock}
              deleteBlock={deleteBlock}
              onOpenEditor={onOpenEditor}
              isSelected={selectedBlockIds.includes(block.id)}
              isDragging={isDraggingSelection && selectedBlockIds.includes(block.id)}
              isRoot={analysisResult.rootBlockIds.has(block.id)}
              isLeaf={analysisResult.leafBlockIds.has(block.id)}
              isBranching={analysisResult.branchingBlockIds.has(block.id)}
              isDimmed={isDimmed}
              isUsageHighlighted={isUsageHighlighted}
              isDirty={dirtyBlockIds.has(block.id)}
              isScreenBlock={isScreenBlock}
              isConfigBlock={isConfigBlock}
              isFlashing={flashingBlockId === block.id}
            />
          );
        })}
      </div>
    </div>
  );
};

export default StoryCanvas;