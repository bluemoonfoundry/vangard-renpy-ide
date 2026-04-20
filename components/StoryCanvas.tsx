/**
 * @file StoryCanvas.tsx
 * @description Main visual canvas for editing Ren'Py projects.
 * Displays story blocks as draggable cards with connections between them (jumps/calls).
 * Supports pan, zoom, multi-select, grouping, sticky notes, minimap, and context menus.
 * Handles keyboard shortcuts (N=new, G=group, Delete=remove, etc.) and canvas interactions.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect, forwardRef } from 'react';
import CodeBlock from './CodeBlock';
import GroupContainer from './GroupContainer';
import StickyNote from './StickyNote';
import Minimap from './Minimap';
import CanvasContextMenu from './CanvasContextMenu';
import CanvasLayoutControls from './CanvasLayoutControls';
import CanvasToolbox from './CanvasToolbox';
import CanvasNavControls from './CanvasNavControls';
import type { MinimapItem } from './Minimap';
import type { Block, Position, RenpyAnalysisResult, BlockGroup, StickyNote as StickyNoteType, MouseGestureSettings, StoryCanvasGroupingMode, StoryCanvasLayoutMode, DiagnosticsResult } from '../types';
import type { BlockType } from './CreateBlockModal';

interface StoryCanvasProps {
  blocks: Block[];
  groups: BlockGroup[];
  stickyNotes: StickyNoteType[];
  analysisResult: RenpyAnalysisResult;
  updateBlock: (id: string, newBlockData: Partial<Block>) => void;
  updateGroup: (id: string, newGroupData: Partial<BlockGroup>) => void;
  updateBlockPositions: (updates: { id: string, position: Position }[]) => void;
  updateGroupPositions: (updates: { id: string, position: Position }[]) => void;
  updateStickyNote: (id: string, data: Partial<StickyNoteType>) => void;
  deleteStickyNote: (id: string) => void;
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
  canvasFilters: { story: boolean; screens: boolean; config: boolean; notes: boolean; minimap: boolean };
  setCanvasFilters: React.Dispatch<React.SetStateAction<{ story: boolean; screens: boolean; config: boolean; notes: boolean; minimap: boolean }>>;
  centerOnBlockRequest: { blockId: string, key: number } | null;
  flashBlockRequest: { blockId: string, key: number } | null;
  hoverHighlightIds: Set<string> | null;
  transform: { x: number, y: number, scale: number };
  onTransformChange: React.Dispatch<React.SetStateAction<{ x: number, y: number, scale: number }>>;
  onCreateBlock?: (type: BlockType, position: Position) => void;
  onAddStickyNote?: (position: Position) => void;
  onOpenRouteCanvas?: () => void;
  mouseGestures?: MouseGestureSettings;
  layoutMode: StoryCanvasLayoutMode;
  groupingMode: StoryCanvasGroupingMode;
  onChangeLayoutMode: (mode: StoryCanvasLayoutMode) => void;
  onChangeGroupingMode: (mode: StoryCanvasGroupingMode) => void;
  diagnosticsResult?: DiagnosticsResult;
}

const getBlockById = (blocks: Block[], id: string) => blocks.find(b => b.id === id);
const getGroupById = (groups: BlockGroup[], id: string) => groups.find(g => g.id === id);
const getStickyNoteById = (notes: StickyNoteType[], id: string) => notes.find(n => n.id === id);

const getAttachmentPoint = (position: Position, width: number, height: number, side: 'left' | 'right' | 'top' | 'bottom'): Position => {
    switch(side) {
        case 'left': return { x: position.x, y: position.y + height / 2 };
        case 'right': return { x: position.x + width, y: position.y + height / 2 };
        case 'top': return { x: position.x + width / 2, y: position.y };
        case 'bottom': return { x: position.x + width / 2, y: position.y + height };
    }
}

const getOptimalPath = (
    sourcePos: Position, sourceW: number, sourceH: number, 
    targetPos: Position, targetW: number, targetH: number
): string => {
    const sourcePoints = {
        right: getAttachmentPoint(sourcePos, sourceW, sourceH, 'right'),
        left: getAttachmentPoint(sourcePos, sourceW, sourceH, 'left'),
        bottom: getAttachmentPoint(sourcePos, sourceW, sourceH, 'bottom'),
        top: getAttachmentPoint(sourcePos, sourceW, sourceH, 'top'),
    };
    const targetPoints = {
        left: getAttachmentPoint(targetPos, targetW, targetH, 'left'),
        right: getAttachmentPoint(targetPos, targetW, targetH, 'right'),
        top: getAttachmentPoint(targetPos, targetW, targetH, 'top'),
        bottom: getAttachmentPoint(targetPos, targetW, targetH, 'bottom'),
    };

    let bestPoints = [sourcePoints.right, targetPoints.left];
    let minDistance = Infinity;

    for (const sKey of Object.keys(sourcePoints) as Array<keyof typeof sourcePoints>) {
        for (const tKey of Object.keys(targetPoints) as Array<keyof typeof targetPoints>) {
            const dist = Math.hypot(sourcePoints[sKey].x - targetPoints[tKey].x, sourcePoints[sKey].y - targetPoints[tKey].y);
            if (dist < minDistance) {
                minDistance = dist;
                bestPoints = [sourcePoints[sKey], targetPoints[tKey]];
            }
        }
    }
    
    const [p1, p2] = bestPoints;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const controlX = p1.x + dx / 2 + (dy / 5);
    const controlY = p1.y + dy / 2 - (dx / 5);

    return `M${p1.x},${p1.y} Q${controlX},${controlY} ${p2.x},${p2.y}`;
};

const Arrow = forwardRef<SVGGElement, {
  pathData: string;
  isDimmed: boolean;
  onHighlight: (startNodeId: string) => void;
  targetId: string;
  linkType?: 'jump' | 'call';
  isNewArrow?: boolean;
}>(({ pathData, isDimmed, onHighlight, targetId, linkType, isNewArrow }, ref) => {
  const [isDrawing, setIsDrawing] = useState(isNewArrow ?? false);

  useEffect(() => {
    if (!isDrawing) return;
    const t = setTimeout(() => setIsDrawing(false), 300);
    return () => clearTimeout(t);
  }, [isDrawing]);
    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        onHighlight(targetId);
    };

    // For call arrows, parse the source attachment point from the M command
    const mMatch = linkType === 'call' ? pathData.match(/^M([-\d.]+),([-\d.]+)/) : null;
    const callCirclePos = mMatch ? { x: parseFloat(mMatch[1]), y: parseFloat(mMatch[2]) } : null;

    return (
        <g
          ref={ref}
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
              pathLength={isDrawing ? 1 : undefined}
              className={`pointer-events-none${isDrawing ? ' arrow-draw-in' : ''}`}
          />
          {callCirclePos && (
            <circle
              cx={callCirclePos.x}
              cy={callCirclePos.y}
              r={5}
              fill="none"
              stroke="#4f46e5"
              strokeWidth={2.5}
              className="pointer-events-none"
            />
          )}
        </g>
    );
});

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
  | { 
      type: 'dragging-blocks'; 
      dragInitialPositions: Map<string, Position>; // id -> original x,y
      draggedLinks: Array<{ 
          key: string; 
          sourceId: string; 
          targetId: string; 
          sourceDim: { w: number, h: number }; 
          targetDim: { w: number, h: number };
      }>;
    }
  | { 
      type: 'dragging-groups'; 
      dragInitialPositions: Map<string, Position>; // includes both groups and blocks
      draggedLinks: Array<{ 
          key: string; 
          sourceId: string; 
          targetId: string; 
          sourceDim: { w: number, h: number }; 
          targetDim: { w: number, h: number };
      }>;
    }
  | { type: 'dragging-notes'; dragInitialPositions: Map<string, Position>; }
  | { type: 'resizing-block'; block: Block; }
  | { type: 'resizing-group'; group: BlockGroup; }
  | { type: 'resizing-note'; note: StickyNoteType; };

const StoryCanvas: React.FC<StoryCanvasProps> = ({ 
    blocks, groups, stickyNotes, analysisResult, 
    updateBlock, updateGroup, updateBlockPositions, updateGroupPositions, updateStickyNote, deleteStickyNote,
    onInteractionEnd, deleteBlock, onOpenEditor, 
    selectedBlockIds, setSelectedBlockIds, selectedGroupIds, setSelectedGroupIds, 
    findUsagesHighlightIds, clearFindUsages, dirtyBlockIds, 
    canvasFilters, setCanvasFilters, centerOnBlockRequest, flashBlockRequest, hoverHighlightIds,
    transform, onTransformChange, onCreateBlock, onAddStickyNote, onOpenRouteCanvas, mouseGestures,
    layoutMode, groupingMode, onChangeLayoutMode, onChangeGroupingMode, diagnosticsResult,
}) => {
  const [rubberBandRect, setRubberBandRect] = useState<Rect | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number; worldPos: Position } | null>(null);
  const [characterTagFilter, setCharacterTagFilter] = useState<string>('');
  const [showLegend, setShowLegend] = useState(false);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');
  const [showLabelSearchResults, setShowLabelSearchResults] = useState(false);
  
  // Refs for Imperative DOM updates
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const noteRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const arrowRefs = useRef<Map<string, SVGGElement>>(new Map());
  const announceLiveRef = useRef<HTMLDivElement>(null);

  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [highlightedPath, setHighlightedPath] = useState<Set<string> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const interactionState = useRef<InteractionState>({ type: 'idle' });
  const pointerStartPos = useRef<Position>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const [flashingBlockId, setFlashingBlockId] = useState<string | null>(null);
  const lastHandledRequestKey = useRef<number | null>(null);
  const lastHandledFlashKey = useRef<number | null>(null);

  // --- Micro-animation state ---
  const [enteringBlockIds, setEnteringBlockIds] = useState<string[]>([]);
  const [exitingBlocks, setExitingBlocks] = useState<Map<string, Block>>(new Map());
  const exitingBlocksRef = useRef<Map<string, Block>>(new Map());
  const prevBlockIdsRef = useRef<Set<string>>(new Set());
  const [newArrowKeys, setNewArrowKeys] = useState<Set<string>>(new Set());
  const prevArrowKeysRef = useRef<Set<string>>(new Set());
  const hasInitializedArrowsRef = useRef(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(entries => {
        if (entries[0]) {
            const { width, height } = entries[0].contentRect;
            setCanvasDimensions({ width, height });
        }
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!centerOnBlockRequest || !canvasRef.current) return;
    if (centerOnBlockRequest.key === lastHandledRequestKey.current) return;

    const { blockId } = centerOnBlockRequest;
    // Check blocks first
    const block = getBlockById(blocks, blockId);
    let targetX = 0;
    let targetY = 0;
    let found = false;

    if (block) {
        targetX = block.position.x + block.width / 2;
        targetY = block.position.y + block.height / 2;
        found = true;
    } else {
        // Fallback to check notes
        const note = getStickyNoteById(stickyNotes, blockId);
        if (note) {
            targetX = note.position.x + note.width / 2;
            targetY = note.position.y + note.height / 2;
            found = true;
            // Also select the note
            setSelectedNoteIds([blockId]);
            setSelectedBlockIds([]);
            setSelectedGroupIds([]);
        }
    }

    const canvasEl = canvasRef.current;

    if (found && canvasEl) {
        const canvasRect = canvasEl.getBoundingClientRect();
        const scale = Math.max(transform.scale, 1.0);
        const newX = (canvasRect.width / 2) - (targetX * scale);
        const newY = (canvasRect.height / 2) - (targetY * scale);

        onTransformChange(t => ({ ...t, scale, x: newX, y: newY }));

        // Flash for visual feedback
        setFlashingBlockId(blockId);
        const timer = setTimeout(() => setFlashingBlockId(null), 1500);
        
        lastHandledRequestKey.current = centerOnBlockRequest.key;

        return () => clearTimeout(timer);
    }
  }, [centerOnBlockRequest, blocks, stickyNotes, transform.scale, onTransformChange, setSelectedNoteIds, setSelectedBlockIds, setSelectedGroupIds]);

  // Effect to handle flash requests without camera movement
  useEffect(() => {
    if (!flashBlockRequest) return;
    if (flashBlockRequest.key === lastHandledFlashKey.current) return;

    setFlashingBlockId(flashBlockRequest.blockId);
    const timer = setTimeout(() => setFlashingBlockId(null), 1500);
    lastHandledFlashKey.current = flashBlockRequest.key;

    return () => clearTimeout(timer);
  }, [flashBlockRequest]);

  // Track newly added blocks and animate them in
  useEffect(() => {
    const newIds: string[] = [];
    for (const block of blocks) {
      if (!prevBlockIdsRef.current.has(block.id)) {
        newIds.push(block.id);
      }
    }
    prevBlockIdsRef.current = new Set(blocks.map(b => b.id));
    if (newIds.length === 0) return;
    setEnteringBlockIds(prev => [...prev, ...newIds]);
    const timer = setTimeout(() => {
      setEnteringBlockIds(prev => prev.filter(id => !newIds.includes(id)));
    }, 220);
    return () => clearTimeout(timer);
  }, [blocks]);

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

  // Wrap deleteBlock to play exit animation before actual deletion
  const handleDeleteBlock = useCallback((id: string) => {
    if (exitingBlocksRef.current.has(id)) return; // already animating out
    const block = blocks.find(b => b.id === id);
    if (!block) return;
    exitingBlocksRef.current.set(id, block);
    setExitingBlocks(new Map(exitingBlocksRef.current));
    setTimeout(() => {
      deleteBlock(id);
      exitingBlocksRef.current.delete(id);
      setExitingBlocks(new Map(exitingBlocksRef.current));
    }, 160);
  }, [blocks, deleteBlock]);

  const handleHighlightPath = useCallback((startNodeId: string) => {
    const path = new Set<string>([startNodeId]);
    const queue = [startNodeId];
    const visited = new Set<string>([startNodeId]);

    while (queue.length > 0) {
      const u = queue.shift()!;
      path.add(u);
      const neighbors = adjacencyMap.get(u) || [];
      for (const v of neighbors) {
        if (!visited.has(v)) {
          visited.add(v);
          queue.push(v);
        }
      }
    }

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
    // Only handle left click for interactions (drag/pan), or middle button when configured
    const gestures = mouseGestures ?? { canvasPanGesture: 'shift-drag' as const, middleMouseAlwaysPans: false, zoomScrollDirection: 'normal' as const, zoomScrollSensitivity: 1.0 };
    const isMiddlePan = (gestures.canvasPanGesture === 'middle-drag' || gestures.middleMouseAlwaysPans) && e.button === 1;
    if (e.button !== 0 && !isMiddlePan) return;
    
    // Close context menu if open
    if (canvasContextMenu) setCanvasContextMenu(null);

    const targetEl = e.target as HTMLElement;
    
    if (targetEl.closest('.arrow-interaction-group') || targetEl.closest('.filter-panel') || targetEl.closest('.layout-panel')) {
      return;
    }

    pointerStartPos.current = getPointInWorldSpace(e.clientX, e.clientY);
    
    const blockWrapper = targetEl.closest('.code-block-wrapper');
    const groupWrapper = targetEl.closest('.group-container-wrapper');
    const noteWrapper = targetEl.closest('.sticky-note-wrapper');

    const blockId = blockWrapper?.getAttribute('data-block-id');
    const groupId = groupWrapper?.getAttribute('data-group-id');
    const noteId = noteWrapper?.getAttribute('data-note-id');

    const block = blockId ? getBlockById(blocks, blockId) : null;
    const group = groupId ? getGroupById(groups, groupId) : null;
    const note = noteId ? getStickyNoteById(stickyNotes, noteId) : null;
    
    const canvasEl = e.currentTarget;

    if (note && noteId) {
        if (targetEl.closest('.resize-handle')) {
            interactionState.current = { type: 'resizing-note', note };
        } else if (targetEl.closest('.drag-handle') || targetEl.closest('.sticky-note-wrapper')) {
             if (targetEl.closest('.drag-handle')) {
                const currentSelection = selectedNoteIds.includes(noteId) ? selectedNoteIds : [noteId];
                const dragInitialPositions = new Map<string, Position>();
                
                stickyNotes.forEach(n => {
                    if (currentSelection.includes(n.id)) {
                        dragInitialPositions.set(n.id, { ...n.position });
                    }
                });
                interactionState.current = { type: 'dragging-notes', dragInitialPositions };
                setIsDraggingSelection(true);
             }
        }

        if (!targetEl.closest('button')) { // Don't select if clicking delete/color buttons
             if (e.shiftKey) {
                setSelectedNoteIds(prev => prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]);
            } else if (!selectedNoteIds.includes(noteId)) {
                setSelectedNoteIds([noteId]);
                setSelectedBlockIds([]);
                setSelectedGroupIds([]);
            }
        }
    } else if (block && blockId) {
        if (targetEl.closest('.resize-handle')) {
            interactionState.current = { type: 'resizing-block', block };
        } else if (targetEl.closest('.drag-handle') && !targetEl.closest('button, input')) {
            const currentSelection = selectedBlockIds.includes(blockId) ? selectedBlockIds : [blockId];
            
            const dragInitialPositions = new Map<string, Position>();
            const movingBlockIds = new Set<string>();

            blocks.forEach(b => {
                if (currentSelection.includes(b.id)) {
                    dragInitialPositions.set(b.id, { ...b.position });
                    movingBlockIds.add(b.id);
                }
            });

            // Pre-calculate affected links to optimize drag loop
            const draggedLinks = analysisResult.links.filter(link => 
                movingBlockIds.has(link.sourceId) || movingBlockIds.has(link.targetId)
            ).map(link => {
                const s = getBlockById(blocks, link.sourceId);
                const t = getBlockById(blocks, link.targetId);
                return {
                    key: `${link.sourceId}-${link.targetId}`,
                    sourceId: link.sourceId,
                    targetId: link.targetId,
                    sourceDim: s ? { w: s.width, h: s.height } : { w: 0, h: 0 },
                    targetDim: t ? { w: t.width, h: t.height } : { w: 0, h: 0 }
                };
            });

            interactionState.current = { type: 'dragging-blocks', dragInitialPositions, draggedLinks };
            setIsDraggingSelection(true);
        }

        if (e.shiftKey) {
            setSelectedBlockIds(prev => prev.includes(blockId) ? prev.filter(id => id !== blockId) : [...prev, blockId]);
        } else if (!selectedBlockIds.includes(blockId)) {
            setSelectedBlockIds([blockId]);
            setSelectedGroupIds([]);
            setSelectedNoteIds([]);
        }
    } else if (group && groupId) {
        if (targetEl.closest('.resize-handle')) {
            interactionState.current = { type: 'resizing-group', group };
        } else if (targetEl.closest('.drag-handle')) {
            const currentSelection = selectedGroupIds.includes(groupId) ? selectedGroupIds : [groupId];
            const dragInitialPositions = new Map<string, Position>();
            const movingIds = new Set<string>();

            currentSelection.forEach(id => {
              const g = getGroupById(groups, id);
              if (g) {
                dragInitialPositions.set(id, { ...g.position });
                g.blockIds.forEach(bId => {
                    const b = getBlockById(blocks, bId);
                    if(b) {
                        dragInitialPositions.set(bId, { ...b.position });
                        movingIds.add(bId);
                    }
                });
              }
            });
            
            const draggedLinks = analysisResult.links.filter(link => 
                movingIds.has(link.sourceId) || movingIds.has(link.targetId)
            ).map(link => {
                const s = getBlockById(blocks, link.sourceId);
                const t = getBlockById(blocks, link.targetId);
                return {
                    key: `${link.sourceId}-${link.targetId}`,
                    sourceId: link.sourceId,
                    targetId: link.targetId,
                    sourceDim: s ? { w: s.width, h: s.height } : { w: 0, h: 0 },
                    targetDim: t ? { w: t.width, h: t.height } : { w: 0, h: 0 }
                };
            });

            interactionState.current = { type: 'dragging-groups', dragInitialPositions, draggedLinks };
            setIsDraggingSelection(true);
        }

        if (e.shiftKey) {
            setSelectedGroupIds(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
        } else if (!selectedGroupIds.includes(groupId)) {
            setSelectedGroupIds([groupId]);
            setSelectedBlockIds([]);
            setSelectedNoteIds([]);
        }
    } else {
        const isPan =
            (gestures.canvasPanGesture === 'shift-drag' && e.shiftKey && e.button === 0) ||
            (gestures.canvasPanGesture === 'drag' && !e.shiftKey && e.button === 0) ||
            (gestures.canvasPanGesture === 'middle-drag' && e.button === 1) ||
            (gestures.middleMouseAlwaysPans && e.button === 1);
        if (isPan) {
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

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        
        rafRef.current = requestAnimationFrame(() => {
            const state = interactionState.current;
            
            if (state.type === 'dragging-blocks' || state.type === 'dragging-groups') {
                const currentPositions = new Map<string, Position>();

                state.dragInitialPositions.forEach((startPos, id) => {
                    const newX = startPos.x + dx;
                    const newY = startPos.y + dy;
                    currentPositions.set(id, { x: newX, y: newY });

                    const blockEl = blockRefs.current.get(id);
                    if (blockEl) {
                        blockEl.style.left = `${newX}px`;
                        blockEl.style.top = `${newY}px`;
                    }
                    const groupEl = groupRefs.current.get(id);
                    if (groupEl) {
                        groupEl.style.left = `${newX}px`;
                        groupEl.style.top = `${newY}px`;
                    }
                });

                state.draggedLinks.forEach(link => {
                    const gEl = arrowRefs.current.get(link.key);
                    if (gEl) {
                        let sPos = currentPositions.get(link.sourceId);
                        if (!sPos) {
                            const b = getBlockById(blocks, link.sourceId);
                            if(b) sPos = b.position;
                        }

                        let tPos = currentPositions.get(link.targetId);
                        if (!tPos) {
                            const b = getBlockById(blocks, link.targetId);
                            if(b) tPos = b.position;
                        }

                        if (sPos && tPos) {
                            const newPath = getOptimalPath(
                                sPos, link.sourceDim.w, link.sourceDim.h,
                                tPos, link.targetDim.w, link.targetDim.h
                            );
                            const paths = gEl.querySelectorAll('path');
                            if (paths.length >= 2) {
                                paths[0].setAttribute('d', newPath);
                                paths[1].setAttribute('d', newPath);
                            }
                            // Update call circle position if present
                            const circle = gEl.querySelector('circle');
                            if (circle) {
                                const mMatch = newPath.match(/^M([-\d.]+),([-\d.]+)/);
                                if (mMatch) {
                                    circle.setAttribute('cx', mMatch[1]);
                                    circle.setAttribute('cy', mMatch[2]);
                                }
                            }
                        }
                    }
                });

            } else if (state.type === 'dragging-notes') {
                state.dragInitialPositions.forEach((startPos, id) => {
                    const newX = startPos.x + dx;
                    const newY = startPos.y + dy;
                    const noteEl = noteRefs.current.get(id);
                    if (noteEl) {
                        noteEl.style.left = `${newX}px`;
                        noteEl.style.top = `${newY}px`;
                    }
                });
            } else if (state.type === 'resizing-block') {
                const { block } = state;
                updateBlock(block.id, {
                    width: Math.max(block.width + dx * transform.scale, 250),
                    height: Math.max(block.height + dy * transform.scale, 150),
                });
            } else if (state.type === 'resizing-group') {
                const { group } = state;
                updateGroup(group.id, {
                    width: Math.max(group.width + dx * transform.scale, 250),
                    height: Math.max(group.height + dy * transform.scale, 150),
                });
            } else if (state.type === 'resizing-note') {
                const { note } = state;
                updateStickyNote(note.id, {
                    width: Math.max(note.width + dx * transform.scale, 150),
                    height: Math.max(note.height + dy * transform.scale, 150),
                });
            } else if (state.type === 'panning') {
                onTransformChange(t => ({...t, x: t.x + moveEvent.movementX, y: t.y + moveEvent.movementY }));
            } else if (state.type === 'rubber-band') {
                const start = state.start;
                const x = Math.min(start.x, currentPos.x);
                const y = Math.min(start.y, currentPos.y);
                const width = Math.abs(start.x - currentPos.x);
                const height = Math.abs(start.y - currentPos.y);
                setRubberBandRect({ x, y, width, height });
            }
        });
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

                const selectedNotesInRect = stickyNotes.filter(n => 
                    n.position.x < finalRect.x + finalRect.width &&
                    n.position.x + n.width > finalRect.x &&
                    n.position.y < finalRect.y + finalRect.height &&
                    n.position.y + n.height > finalRect.y
                ).map(n => n.id);

                if (upEvent.shiftKey) {
                    setSelectedBlockIds(prev => [...new Set([...prev, ...selectedInRect])]);
                    setSelectedGroupIds(prev => [...new Set([...prev, ...selectedGroupsInRect])]);
                    setSelectedNoteIds(prev => [...new Set([...prev, ...selectedNotesInRect])]);
                } else {
                    setSelectedBlockIds(selectedInRect);
                    setSelectedGroupIds(selectedGroupsInRect);
                    setSelectedNoteIds(selectedNotesInRect);
                }
            } else { // It was a click, not a drag.
                setSelectedBlockIds([]);
                setSelectedGroupIds([]);
                setSelectedNoteIds([]);
                if (highlightedPath) setHighlightedPath(null);
                if (canvasContextMenu) setCanvasContextMenu(null);
            }
        }
        
        // Commit changes to React State
        if ((state.type === 'dragging-blocks' || state.type === 'dragging-groups' || state.type === 'dragging-notes') && distance > 0) {
            const blockUpdates: { id: string, position: Position }[] = [];
            const groupUpdates: { id: string, position: Position }[] = [];
            
            if (state.type === 'dragging-notes') {
                state.dragInitialPositions.forEach((startPos, id) => {
                    const newPos = { x: startPos.x + dx, y: startPos.y + dy };
                    updateStickyNote(id, { position: newPos });
                });
            } else {
                state.dragInitialPositions.forEach((startPos, id) => {
                    const newPos = { x: startPos.x + dx, y: startPos.y + dy };
                    if (getGroupById(groups, id)) {
                        groupUpdates.push({ id, position: newPos });
                    } else {
                        blockUpdates.push({ id, position: newPos });
                    }
                });

                if (blockUpdates.length > 0) updateBlockPositions(blockUpdates);
                if (groupUpdates.length > 0) updateGroupPositions(groupUpdates);
            }
        }
        
        const wasInteractiveMove = state.type === 'dragging-blocks' ||
                                 state.type === 'dragging-groups' ||
                                 state.type === 'dragging-notes' ||
                                 state.type === 'resizing-block' ||
                                 state.type === 'resizing-group' ||
                                 state.type === 'resizing-note';

        // Clear the find-usages highlight on any canvas click that isn't a drag.
        // This covers both genuine empty-space clicks (rubber-band state) AND clicks on
        // dimmed blocks (idle state) — dimmed blocks are 30% opacity and look like empty
        // space to the user, but route through the block branch of handlePointerDown,
        // leaving interactionState as 'idle'.
        if (distance <= 5 && findUsagesHighlightIds) {
            clearFindUsages();
        }

        setIsDraggingSelection(false);
        if (wasInteractiveMove) onInteractionEnd();
        interactionState.current = { type: 'idle' };
        setRubberBandRect(null);
        if (canvasRef.current) canvasEl.releasePointerCapture(e.pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    if (!canvasRef.current || (e.target as HTMLElement).closest('.filter-panel') || (e.target as HTMLElement).closest('.layout-panel')) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const gestures = mouseGestures ?? { canvasPanGesture: 'shift-drag' as const, middleMouseAlwaysPans: false, zoomScrollDirection: 'normal' as const, zoomScrollSensitivity: 1.0 };
    const sensitivity = gestures.zoomScrollSensitivity ?? 1.0;
    const direction = gestures.zoomScrollDirection === 'inverted' ? -1 : 1;
    onTransformChange(t => {
      const zoom = 1 - e.deltaY * 0.002 * sensitivity * direction;
      const newScale = Math.max(0.2, Math.min(3, t.scale * zoom));
      const worldX = (pointer.x - t.x) / t.scale;
      const worldY = (pointer.y - t.y) / t.scale;
      const newX = pointer.x - worldX * newScale;
      const newY = pointer.y - worldY * newScale;
      return { x: newX, y: newY, scale: newScale };
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      if ((e.target as HTMLElement).closest('.code-block-wrapper') || (e.target as HTMLElement).closest('.group-container-wrapper') || (e.target as HTMLElement).closest('.sticky-note-wrapper')) {
          return;
      }
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const worldX = (e.clientX - rect.left - transform.x) / transform.scale;
      const worldY = (e.clientY - rect.top - transform.y) / transform.scale;
      
      setCanvasContextMenu({
          x: e.clientX,
          y: e.clientY,
          worldPos: { x: worldX, y: worldY }
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

  // Characters available for the filter dropdown (sorted by name)
  const availableCharacters = useMemo(() => {
    const chars: { tag: string; name: string }[] = [];
    analysisResult.characters.forEach((char, tag) => {
      chars.push({ tag, name: char.name || tag });
    });
    return chars.sort((a, b) => a.name.localeCompare(b.name));
  }, [analysisResult.characters]);

  // Block IDs that contain dialogue for the selected character (null = no filter)
  const characterFilterBlockIds = useMemo((): Set<string> | null => {
    if (!characterTagFilter) return null;
    const ids = new Set<string>();
    analysisResult.dialogueLines.forEach((lines, blockId) => {
      if (lines.some(l => l.tag === characterTagFilter)) ids.add(blockId);
    });
    return ids;
  }, [characterTagFilter, analysisResult.dialogueLines]);

  const fitToScreen = useCallback(() => {
    if (visibleBlocks.length === 0 || !canvasRef.current) return;
    const { width: cw, height: ch } = canvasRef.current.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    visibleBlocks.forEach(b => {
      minX = Math.min(minX, b.position.x);
      minY = Math.min(minY, b.position.y);
      maxX = Math.max(maxX, b.position.x + b.width);
      maxY = Math.max(maxY, b.position.y + b.height);
    });
    const PAD = 80;
    const scale = Math.min((cw - PAD * 2) / (maxX - minX), (ch - PAD * 2) / (maxY - minY), 2);
    const tx = (cw - (maxX - minX) * scale) / 2 - minX * scale;
    const ty = (ch - (maxY - minY) * scale) / 2 - minY * scale;
    onTransformChange({ x: tx, y: ty, scale });
  }, [visibleBlocks, onTransformChange]);

  const startBlock = useMemo(() => {
    const startNode = analysisResult.labelNodes.find(n => n.label === 'start');
    if (!startNode) return null;
    return blocks.find(b => b.id === startNode.blockId) ?? null;
  }, [analysisResult.labelNodes, blocks]);

  const centerOnStartBlock = useCallback(() => {
    if (!startBlock || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const cx = startBlock.position.x + startBlock.width / 2;
    const cy = startBlock.position.y + startBlock.height / 2;
    onTransformChange(t => {
      const scale = Math.max(t.scale, 1.0);
      return { ...t, scale, x: canvasRect.width / 2 - cx * scale, y: canvasRect.height / 2 - cy * scale };
    });
  }, [startBlock, onTransformChange]);

  const blockDiagnosticSeverity = useMemo(() => {
    const map = new Map<string, 'error' | 'warning'>();
    if (!diagnosticsResult) return map;
    for (const issue of diagnosticsResult.issues) {
      if (!issue.blockId) continue;
      const current = map.get(issue.blockId);
      // 'error' beats 'warning'
      if (issue.severity === 'error') {
        map.set(issue.blockId, 'error');
      } else if (issue.severity === 'warning' && current !== 'error') {
        map.set(issue.blockId, 'warning');
      }
    }
    return map;
  }, [diagnosticsResult]);

  const labelSearchResults = useMemo(() => {
    const query = labelSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return analysisResult.labelNodes
      .filter(n =>
        n.label.toLowerCase().includes(query) ||
        (n.containerName ?? '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [analysisResult.labelNodes, labelSearchQuery]);

  const centerOnLabelBlock = useCallback((blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const cx = block.position.x + block.width / 2;
    const cy = block.position.y + block.height / 2;
    onTransformChange(t => {
      const scale = Math.max(t.scale, 1.0);
      return { ...t, scale, x: canvasRect.width / 2 - cx * scale, y: canvasRect.height / 2 - cy * scale };
    });
    setShowLabelSearchResults(false);
    setLabelSearchQuery('');
  }, [blocks, onTransformChange]);

  const announce = useCallback((msg: string) => {
    if (!announceLiveRef.current) return;
    announceLiveRef.current.textContent = '';
    requestAnimationFrame(() => {
      if (announceLiveRef.current) announceLiveRef.current.textContent = msg;
    });
  }, []);

  const handleCanvasKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const focusedEl = document.activeElement as HTMLElement | null;
    const blockId = focusedEl?.closest('[data-block-id]')?.getAttribute('data-block-id') ?? null;
    const block = blockId ? blocks.find(b => b.id === blockId) : null;

    if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedBlockIds([]);
      setSelectedGroupIds([]);
      announce('Selection cleared');
      return;
    }

    if (!block) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      onOpenEditor(block.id);
      return;
    }

    const dirMap: Record<string, [number, number]> = {
      ArrowRight: [1, 0], ArrowLeft: [-1, 0],
      ArrowDown: [0, 1], ArrowUp: [0, -1],
    };
    if (!(e.key in dirMap)) return;
    e.preventDefault();

    const [dx, dy] = dirMap[e.key];
    const cx = block.position.x + block.width / 2;
    const cy = block.position.y + block.height / 2;

    let best: Block | null = null;
    let bestScore = Infinity;
    for (const b of visibleBlocks) {
      if (b.id === block.id) continue;
      const bx = b.position.x + b.width / 2;
      const by = b.position.y + b.height / 2;
      const dot = (bx - cx) * dx + (by - cy) * dy;
      if (dot <= 0) continue;
      const perp = Math.abs((bx - cx) * dy - (by - cy) * dx);
      const dist = Math.hypot(bx - cx, by - cy);
      if (dist + perp * 1.5 < bestScore) { bestScore = dist + perp * 1.5; best = b; }
    }

    if (best) {
      blockRefs.current.get(best.id)?.focus();
      setSelectedBlockIds([best.id]);
      const title = best.title ?? best.filePath?.split('/').pop()?.replace(/\.rpy$/, '') ?? 'Block';
      announce(`${title} focused`);
    }
  }, [blocks, visibleBlocks, onOpenEditor, setSelectedBlockIds, setSelectedGroupIds, announce]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'f' || e.key === 'F') fitToScreen();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitToScreen]);

  const visibleLinks = useMemo(() => {
      return analysisResult.links.filter(link =>
          visibleBlockIds.has(link.sourceId) && visibleBlockIds.has(link.targetId)
      );
  }, [analysisResult.links, visibleBlockIds]);

  // Track newly added arrows (skip initial load to avoid mass-animating on project open)
  useEffect(() => {
    const currentKeys = new Set(visibleLinks.map(l => `${l.sourceId}-${l.targetId}`));
    if (!hasInitializedArrowsRef.current) {
      prevArrowKeysRef.current = currentKeys;
      hasInitializedArrowsRef.current = true;
      return;
    }
    const addedKeys: string[] = [];
    currentKeys.forEach(k => {
      if (!prevArrowKeysRef.current.has(k)) addedKeys.push(k);
    });
    prevArrowKeysRef.current = currentKeys;
    if (addedKeys.length === 0) return;
    setNewArrowKeys(prev => new Set([...prev, ...addedKeys]));
    const timer = setTimeout(() => {
      setNewArrowKeys(prev => {
        const next = new Set(prev);
        addedKeys.forEach(k => next.delete(k));
        return next;
      });
    }, 320);
    return () => clearTimeout(timer);
  }, [visibleLinks]);

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

  const minimapItems = useMemo((): MinimapItem[] => {
    const blockItems: MinimapItem[] = visibleBlocks.map(b => {
        const isScreen = analysisResult.screenOnlyBlockIds.has(b.id);
        const isConfig = analysisResult.configBlockIds.has(b.id);
        let type: MinimapItem['type'] = 'block';
        if (isScreen) type = 'screen';
        if (isConfig) type = 'config';
        return { 
            id: b.id, 
            position: b.position, 
            width: b.width, 
            height: b.height, 
            type 
        };
    });
    const groupItems: MinimapItem[] = groups.map(g => ({ ...g, type: 'group', width: g.width, height: g.height }));
    const noteItems: MinimapItem[] = canvasFilters.notes ? stickyNotes.map(n => ({ ...n, type: 'note' })) : [];
    return [...blockItems, ...groupItems, ...noteItems];
  }, [visibleBlocks, groups, stickyNotes, canvasFilters.notes, analysisResult]);

  return (
    <div
      ref={canvasRef}
      role="application"
      aria-label="Story canvas"
      className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing bg-primary bg-[radial-gradient(var(--dot-color)_1px,transparent_1px)]"
      style={backgroundStyle}
      onPointerDown={handlePointerDown}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      onKeyDown={handleCanvasKeyDown}
      data-tutorial="story-canvas"
    >
      <div ref={announceLiveRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
        {blocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-secondary border border-primary rounded-xl shadow-xl p-8 max-w-sm text-center pointer-events-auto">
            <div className="text-4xl mb-3">📄</div>
            <h3 className="text-lg font-bold text-primary mb-1">✨ Your story begins here</h3>
            <p className="text-sm text-secondary mb-4">Press N or click 'New Scene' to create your opening.</p>
            <div className="text-xs text-secondary space-y-1 text-left bg-primary/5 rounded-lg p-3 mb-2">
              <div><kbd className="font-mono bg-primary/10 px-1 rounded">N</kbd> — New scene</div>
              <div><kbd className="font-mono bg-primary/10 px-1 rounded">Shift</kbd> + drag — Pan canvas</div>
              <div><kbd className="font-mono bg-primary/10 px-1 rounded">Scroll</kbd> — Zoom in / out</div>
              <div><kbd className="font-mono bg-primary/10 px-1 rounded">G</kbd> — Group selected blocks</div>
            </div>
          </div>
        </div>
      )}
      {/* ── Canvas Toolbox (top-left) ── */}
      <CanvasToolbox label="Story Canvas">
        <CanvasLayoutControls
          canvasLabel="Story Canvas"
          layoutMode={layoutMode}
          groupingMode={groupingMode}
          onChangeLayoutMode={onChangeLayoutMode}
          onChangeGroupingMode={onChangeGroupingMode}
          embedded
        />
        {/* View Filters */}
        <div className="filter-panel p-3 flex flex-col space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">View Filters</h4>
          <label className="flex items-center space-x-2 cursor-pointer text-sm text-secondary">
            <input type="checkbox" checked={canvasFilters.story} onChange={e => setCanvasFilters(f => ({ ...f, story: e.target.checked }))} className="h-4 w-4 rounded focus:ring-indigo-500" style={{ accentColor: 'rgb(79 70 229)' }} />
            <span>Story Blocks</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer text-sm text-secondary">
            <input type="checkbox" checked={canvasFilters.screens} onChange={e => setCanvasFilters(f => ({ ...f, screens: e.target.checked }))} className="h-4 w-4 rounded focus:ring-teal-500" style={{ accentColor: 'rgb(13 148 136)' }} />
            <span>Screen Blocks</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer text-sm text-secondary">
            <input type="checkbox" checked={canvasFilters.config} onChange={e => setCanvasFilters(f => ({ ...f, config: e.target.checked }))} className="h-4 w-4 rounded focus:ring-red-500" style={{ accentColor: 'rgb(239 68 68)' }} />
            <span>Config Blocks</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer text-sm text-secondary">
            <input type="checkbox" checked={canvasFilters.notes} onChange={e => setCanvasFilters(f => ({ ...f, notes: e.target.checked }))} className="h-4 w-4 rounded focus:ring-yellow-500" style={{ accentColor: 'rgb(234 179 8)' }} />
            <span>Notes</span>
          </label>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <label className="flex items-center space-x-2 cursor-pointer text-sm text-secondary">
            <input type="checkbox" checked={canvasFilters.minimap} onChange={e => setCanvasFilters(f => ({ ...f, minimap: e.target.checked }))} className="h-4 w-4 rounded" style={{ accentColor: 'rgb(107 114 128)' }} />
            <span>Minimap</span>
          </label>
          {availableCharacters.length > 0 && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-primary px-1">Character</span>
                <select
                  className="text-xs bg-secondary border border-primary rounded px-1.5 py-1 text-primary cursor-pointer"
                  value={characterTagFilter}
                  onChange={e => setCharacterTagFilter(e.target.value)}
                  onPointerDown={e => e.stopPropagation()}
                >
                  <option value="">All characters</option>
                  {availableCharacters.map(c => (
                    <option key={c.tag} value={c.tag}>{c.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
        {/* ── Go to Label ── */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Go to Label</h4>
          <input
            value={labelSearchQuery}
            onChange={e => {
              setLabelSearchQuery(e.target.value);
              setShowLabelSearchResults(true);
            }}
            onFocus={() => setShowLabelSearchResults(true)}
            placeholder="Search labels…"
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-sm"
          />
          {showLabelSearchResults && labelSearchQuery.trim() && (
            <div className="max-h-44 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
              {labelSearchResults.length > 0 ? labelSearchResults.map(node => (
                <button
                  key={node.id}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => centerOnLabelBlock(node.blockId)}
                >
                  <div className="font-mono text-gray-900 dark:text-gray-100">{node.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{node.containerName ?? 'Unknown file'}</div>
                </button>
              )) : (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No matching labels.</div>
              )}
            </div>
          )}
        </div>
      </CanvasToolbox>

      {/* ── Legend (top-right) ── */}
      <div
        className="absolute top-4 right-4 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
        onPointerDown={e => e.stopPropagation()}
        onContextMenu={e => e.stopPropagation()}
      >
        <button
          onClick={() => setShowLegend(v => !v)}
          className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <span>Legend</span>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-gray-400 ml-auto transition-transform ${showLegend ? '' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        {showLegend && (
          <div className="px-3 pb-3 pt-1 space-y-2 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
            <div className="font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide text-[10px] pt-1">Arrows</div>
            <div className="flex items-center gap-2">
              <svg width="28" height="10" className="shrink-0">
                <path d="M0,5 L20,5" stroke="#4f46e5" strokeWidth="2.5" fill="none" />
                <polygon points="18,2 26,5 18,8" fill="#4f46e5" />
              </svg>
              Jump
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="10" className="shrink-0">
                <circle cx="4" cy="5" r="3" fill="none" stroke="#4f46e5" strokeWidth="2" />
                <path d="M8,5 L20,5" stroke="#4f46e5" strokeWidth="2.5" fill="none" />
                <polygon points="18,2 26,5 18,8" fill="#4f46e5" />
              </svg>
              Call (returns)
            </div>
            <div className="font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide text-[10px] pt-1">Block Roles</div>
            <div className="flex items-center gap-2">
              <span className="w-10 h-4 shrink-0 rounded border-2 border-green-400 bg-green-50 dark:bg-green-900/20 inline-block" />
              Story start
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 h-4 shrink-0 rounded border-2 border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/20 inline-block" />
              Story end
            </div>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M15 4a1 1 0 00-1.447-.894l-5 2.5a1 1 0 000 1.789l5 2.5A1 1 0 0015 9V4zM5 4a1 1 0 00-1.447-.894l-5 2.5a1 1 0 000 1.789l5 2.5A1 1 0 005 9V4z" opacity=".5"/><path d="M15 11a1 1 0 00-1.447-.894l-5 2.5a1 1 0 000 1.789l5 2.5A1 1 0 0015 16v-5z" />
              </svg>
              Branching
            </div>
            <div className="font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide text-[10px] pt-1">Block Types</div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 shrink-0 rounded border-2 border-gray-300 bg-white dark:bg-gray-800 inline-block" />
              Story
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 shrink-0 rounded border-2 border-teal-400 bg-teal-50 dark:bg-teal-900/20 inline-block" />
              Screen
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 shrink-0 rounded border-2 border-red-400 bg-red-50 dark:bg-red-900/20 inline-block" />
              Config
            </div>
          </div>
        )}
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
            overflow: 'visible',
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
            {visibleLinks.map((link, _index) => {
              const sourceBlock = getBlockById(blocks, link.sourceId);
              const targetBlock = getBlockById(blocks, link.targetId);
              if (!sourceBlock || !targetBlock) return null;
              
              const pathData = getOptimalPath(
                  sourceBlock.position, sourceBlock.width, sourceBlock.height,
                  targetBlock.position, targetBlock.width, targetBlock.height
              );
              
              const isDimmed = highlightedPath !== null && (!highlightedPath.has(link.sourceId) || !highlightedPath.has(link.targetId));
              const linkKey = `${link.sourceId}-${link.targetId}`;

              return (
                <Arrow
                    key={linkKey}
                    ref={(el) => {
                        if (el) arrowRefs.current.set(linkKey, el);
                        else arrowRefs.current.delete(linkKey);
                    }}
                    pathData={pathData}
                    isDimmed={isDimmed}
                    onHighlight={handleHighlightPath}
                    targetId={link.targetId}
                    linkType={link.type}
                    isNewArrow={newArrowKeys.has(linkKey)}
                />
              );
            })}
          </g>
        </svg>

        {rubberBandRect && <RubberBand rect={rubberBandRect} />}

        {groups.map((group) => {
          const isDimmed = highlightedPath !== null && !group.blockIds.some(id => highlightedPath.has(id));
          return (
            <GroupContainer
              key={group.id}
              ref={(el) => {
                  if (el) groupRefs.current.set(group.id, el);
                  else groupRefs.current.delete(group.id);
              }}
              group={group}
              updateGroup={updateGroup}
              isSelected={selectedGroupIds.includes(group.id)}
              isDragging={isDraggingSelection && selectedGroupIds.includes(group.id)}
              isDimmed={isDimmed}
            />
          );
        })}

        {visibleBlocks.filter(b => !exitingBlocks.has(b.id)).map((block) => {
          const isDimmed = (highlightedPath !== null && !highlightedPath.has(block.id)) ||
                          (findUsagesHighlightIds !== null && !findUsagesHighlightIds.has(block.id)) ||
                          (characterFilterBlockIds !== null && !characterFilterBlockIds.has(block.id));
          const isUsageHighlighted = findUsagesHighlightIds?.has(block.id) ?? false;
          const isHoverHighlighted = hoverHighlightIds?.has(block.id) ?? false;
          const isScreenBlock = analysisResult.screenOnlyBlockIds.has(block.id);
          const isConfigBlock = analysisResult.configBlockIds.has(block.id);
          return (
            <CodeBlock
              key={block.id}
              ref={(el) => {
                  if (el) blockRefs.current.set(block.id, el);
                  else blockRefs.current.delete(block.id);
              }}
              block={block}
              analysisResult={analysisResult}
              updateBlock={updateBlock}
              deleteBlock={handleDeleteBlock}
              onOpenEditor={onOpenEditor}
              onOpenRouteCanvas={onOpenRouteCanvas}
              isSelected={selectedBlockIds.includes(block.id)}
              isDragging={isDraggingSelection && selectedBlockIds.includes(block.id)}
              isRoot={analysisResult.rootBlockIds.has(block.id)}
              isLeaf={analysisResult.leafBlockIds.has(block.id)}
              isBranching={analysisResult.branchingBlockIds.has(block.id)}
              isDimmed={isDimmed}
              isUsageHighlighted={isUsageHighlighted}
              isHoverHighlighted={isHoverHighlighted}
              isDirty={dirtyBlockIds.has(block.id)}
              isScreenBlock={isScreenBlock}
              isConfigBlock={isConfigBlock}
              isFlashing={flashingBlockId === block.id}
              isEntering={enteringBlockIds.includes(block.id)}
              diagnosticSeverity={blockDiagnosticSeverity.get(block.id) ?? null}
            />
          );
        })}
        {Array.from(exitingBlocks.values()).map((block) => (
          <CodeBlock
            key={`exiting-${block.id}`}
            block={block}
            analysisResult={analysisResult}
            updateBlock={() => {}}
            deleteBlock={() => {}}
            onOpenEditor={() => {}}
            isSelected={false}
            isDragging={false}
            isRoot={analysisResult.rootBlockIds.has(block.id)}
            isLeaf={analysisResult.leafBlockIds.has(block.id)}
            isBranching={analysisResult.branchingBlockIds.has(block.id)}
            isDimmed={false}
            isUsageHighlighted={false}
            isHoverHighlighted={false}
            isDirty={false}
            isScreenBlock={analysisResult.screenOnlyBlockIds.has(block.id)}
            isConfigBlock={analysisResult.configBlockIds.has(block.id)}
            isFlashing={false}
            isExiting={true}
            diagnosticSeverity={null}
          />
        ))}

        {canvasFilters.notes && stickyNotes.map((note) => (
            <StickyNote
                key={note.id}
                ref={(el) => {
                    if(el) noteRefs.current.set(note.id, el);
                    else noteRefs.current.delete(note.id);
                }}
                note={note}
                updateNote={updateStickyNote}
                deleteNote={deleteStickyNote}
                isSelected={selectedNoteIds.includes(note.id)}
                isDragging={isDraggingSelection && selectedNoteIds.includes(note.id)}
            />
        ))}
      </div>
      {/* ── Bottom-right cluster: Nav controls + Minimap ── */}
      <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-1.5" onPointerDown={e => e.stopPropagation()}>
        <CanvasNavControls
          onFit={fitToScreen}
          fitTitle="Fit all blocks to screen (F)"
          onGoToStart={centerOnStartBlock}
          hasStart={!!startBlock}
        />
        {canvasFilters.minimap && (
          <Minimap
            items={minimapItems}
            transform={transform}
            canvasDimensions={canvasDimensions}
            onTransformChange={onTransformChange}
          />
        )}
      </div>

      {canvasContextMenu && onCreateBlock && onAddStickyNote && (
        <CanvasContextMenu
            x={canvasContextMenu.x}
            y={canvasContextMenu.y}
            onClose={() => setCanvasContextMenu(null)}
            onCreateBlock={(type) => onCreateBlock(type, canvasContextMenu.worldPos)}
            onAddStickyNote={() => onAddStickyNote(canvasContextMenu.worldPos)}
        />
      )}
    </div>
  );
};

export default StoryCanvas;
