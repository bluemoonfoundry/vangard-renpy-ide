/**
 * @file RouteCanvas.tsx
 * @description Label-by-label narrative flow visualization (521 lines).
 * Shows each label as a node and traces execution paths through the story.
 * Displays different routes in different colors for visual analysis of story paths.
 * Supports pan, zoom, drag labels, and navigation to editor.
 * Uses graph layout algorithm to arrange nodes without overlap.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import LabelBlock from './LabelBlock';
import ViewRoutesPanel from './ViewRoutesPanel';
import Minimap from './Minimap';
import type { MinimapItem } from './Minimap';
import type { LabelNode, RouteLink, Position, IdentifiedRoute, MouseGestureSettings } from '../types';

interface RouteCanvasProps {
  labelNodes: LabelNode[];
  routeLinks: RouteLink[];
  identifiedRoutes: IdentifiedRoute[];
  updateLabelNodePositions: (updates: { id: string, position: Position }[]) => void;
  onOpenEditor: (blockId: string, line: number) => void;
  transform: { x: number, y: number, scale: number };
  onTransformChange: React.Dispatch<React.SetStateAction<{ x: number, y: number, scale: number }>>;
  mouseGestures?: MouseGestureSettings;
}

interface Rect { x: number; y: number; width: number; height: number; }

const getAttachmentPoint = (node: LabelNode, side: 'left' | 'right' | 'top' | 'bottom'): Position => {
    switch(side) {
        case 'left': return { x: node.position.x, y: node.position.y + node.height / 2 };
        case 'right': return { x: node.position.x + node.width, y: node.position.y + node.height / 2 };
        case 'top': return { x: node.position.x + node.width / 2, y: node.position.y };
        case 'bottom': return { x: node.position.x + node.width / 2, y: node.position.y + node.height };
    }
}

const getOptimalPath = (sourceNode: LabelNode, targetNode: LabelNode): [Position, Position] => {
    // If predominantly vertical alignment, prefer top/bottom connections
    const isVertical = Math.abs(targetNode.position.y - sourceNode.position.y) > Math.abs(targetNode.position.x - sourceNode.position.x);

    let sourcePoints, targetPoints;

    if (isVertical) {
        sourcePoints = {
            bottom: getAttachmentPoint(sourceNode, 'bottom'),
            top: getAttachmentPoint(sourceNode, 'top'),
        };
        targetPoints = {
            top: getAttachmentPoint(targetNode, 'top'),
            bottom: getAttachmentPoint(targetNode, 'bottom'),
        };
    } else {
        sourcePoints = {
            right: getAttachmentPoint(sourceNode, 'right'),
            left: getAttachmentPoint(sourceNode, 'left'),
        };
        targetPoints = {
            left: getAttachmentPoint(targetNode, 'left'),
            right: getAttachmentPoint(targetNode, 'right'),
        };
    }

    let bestPath: [Position, Position] | null = null;
    let minDistance = Infinity;

    for (const sKey of Object.keys(sourcePoints)) {
        for (const tKey of Object.keys(targetPoints)) {
            // @ts-ignore
            const p1 = sourcePoints[sKey];
            // @ts-ignore
            const p2 = targetPoints[tKey];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            
            // Penalize "backward" links slightly to encourage flow
            let penalty = 0;
            if (!isVertical && p1.x > p2.x) penalty = 100;
            if (isVertical && p1.y > p2.y) penalty = 100;

            if (dist + penalty < minDistance) {
                minDistance = dist + penalty;
                bestPath = [p1, p2];
            }
        }
    }
    
    // Fallback if something went wrong
    if (!bestPath) {
        return [getAttachmentPoint(sourceNode, 'right'), getAttachmentPoint(targetNode, 'left')];
    }

    return bestPath;
};

const Arrow: React.FC<{ 
  sourcePos: Position; 
  targetPos: Position;
  type: RouteLink['type'];
  color: string;
  isDimmed: boolean;
}> = ({ sourcePos, targetPos, type, color, isDimmed }) => {
    const isVertical = Math.abs(targetPos.y - sourcePos.y) > Math.abs(targetPos.x - sourcePos.x);
    
    let pathData: string;
    
    if (isVertical) {
        const dy = targetPos.y - sourcePos.y;
        const midY = sourcePos.y + dy / 2;
        // Cubic Bezier for vertical flow (Top-Down)
        pathData = `M${sourcePos.x},${sourcePos.y} C${sourcePos.x},${midY} ${targetPos.x},${midY} ${targetPos.x},${targetPos.y}`;
    } else {
        const dx = targetPos.x - sourcePos.x;
        const midX = sourcePos.x + dx / 2;
        // Cubic Bezier for horizontal flow (Left-Right)
        pathData = `M${sourcePos.x},${sourcePos.y} C${midX},${sourcePos.y} ${midX},${targetPos.y} ${targetPos.x},${targetPos.y}`;
    }

    return (
        <g className={`pointer-events-none transition-opacity duration-300 ${isDimmed ? 'opacity-20' : 'opacity-100'}`}>
          <path
              d={pathData}
              stroke={color}
              strokeWidth="4"
              fill="none"
              strokeDasharray={type === 'implicit' ? "10, 6" : "none"}
              markerEnd={`url(#arrowhead-${color.replace('#', '')})`}
          />
        </g>
    );
};

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

// Container for grouping labels visually
const BlockContainer: React.FC<{ 
    id: string; 
    title: string; 
    rect: Rect; 
    isDimmed: boolean; 
}> = ({ id, title, rect, isDimmed }) => {
    // Add padding to the visual box
    const padding = 20;
    const x = rect.x - padding;
    const y = rect.y - padding - 30; // Extra top space for title
    const width = rect.width + padding * 2;
    const height = rect.height + padding * 2 + 30;

    return (
        <div 
            className={`absolute rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 transition-opacity duration-300 pointer-events-none ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
            style={{
                left: x,
                top: y,
                width: width,
                height: height,
                zIndex: 1, // Behind connections (in SVG) and nodes
            }}
        >
            <div className="absolute top-2 left-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate max-w-[90%]">
                {title}
            </div>
        </div>
    );
};

type InteractionState = 
  | { type: 'idle' }
  | { type: 'panning'; }
  | { type: 'rubber-band'; start: Position; }
  | { type: 'dragging-nodes'; dragStartPositions: Map<string, Position>; };

const RouteCanvas: React.FC<RouteCanvasProps> = ({ labelNodes, routeLinks, identifiedRoutes, updateLabelNodePositions, onOpenEditor, transform, onTransformChange, mouseGestures }) => {
  const [rubberBandRect, setRubberBandRect] = useState<Rect | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [checkedRoutes, setCheckedRoutes] = useState(new Set<number>());
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const interactionState = useRef<InteractionState>({ type: 'idle' });
  const pointerStartPos = useRef<Position>({ x: 0, y: 0 });
  const nodeMap = useMemo(() => new Map(labelNodes.map(n => [n.id, n])), [labelNodes]);
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

  const handleToggleRoute = (routeId: number) => {
    setCheckedRoutes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(routeId)) {
            newSet.delete(routeId);
        } else {
            newSet.add(routeId);
        }
        return newSet;
    });
  };

  const linkColors = useMemo(() => {
    if (checkedRoutes.size === 0) return null;

    const colorMap = new Map<string, string>();
    identifiedRoutes.forEach(route => {
        if (checkedRoutes.has(route.id)) {
            route.linkIds.forEach(linkId => {
                if (!colorMap.has(linkId)) { // First checked route containing the link wins
                    colorMap.set(linkId, route.color);
                }
            });
        }
    });
    return colorMap;
  }, [checkedRoutes, identifiedRoutes]);

  // Compute Group Bounding Boxes
  const blockGroups = useMemo(() => {
      const groups = new Map<string, { id: string, title: string, rect: Rect }>();
      
      labelNodes.forEach(node => {
          if (!groups.has(node.blockId)) {
              groups.set(node.blockId, {
                  id: node.blockId,
                  title: node.containerName || 'Block',
                  rect: { x: node.position.x, y: node.position.y, width: node.width, height: node.height }
              });
          } else {
              const group = groups.get(node.blockId)!;
              const minX = Math.min(group.rect.x, node.position.x);
              const minY = Math.min(group.rect.y, node.position.y);
              const maxX = Math.max(group.rect.x + group.rect.width, node.position.x + node.width);
              const maxY = Math.max(group.rect.y + group.rect.height, node.position.y + node.height);
              
              group.rect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          }
      });
      return Array.from(groups.values());
  }, [labelNodes]);

  const getPointInWorldSpace = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale,
    };
  }, [transform.x, transform.y, transform.scale]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const gestures = mouseGestures ?? { canvasPanGesture: 'shift-drag' as const, middleMouseAlwaysPans: false, zoomScrollDirection: 'normal' as const, zoomScrollSensitivity: 1.0 };
    const isMiddlePan = (gestures.canvasPanGesture === 'middle-drag' || gestures.middleMouseAlwaysPans) && e.button === 1;
    if (e.button !== 0 && !isMiddlePan) return;
    const targetEl = e.target as HTMLElement;

    // Prevent canvas interactions when interacting with the panel
    if (targetEl.closest('.view-routes-panel')) {
        return;
    }
    
    pointerStartPos.current = getPointInWorldSpace(e.clientX, e.clientY);
    
    const nodeWrapper = (e.target as HTMLElement).closest('.label-block-wrapper');
    const nodeId = nodeWrapper?.getAttribute('data-label-node-id');
    const canvasEl = e.currentTarget;

    if (nodeId && nodeMap.has(nodeId)) {
        const currentSelection = selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId];
        const dragStartPositions = new Map<string, Position>();
        currentSelection.forEach(id => {
            const node = nodeMap.get(id);
            if (node) dragStartPositions.set(id, node.position);
        });
        interactionState.current = { type: 'dragging-nodes', dragStartPositions };
        setIsDraggingSelection(true);

        if (e.shiftKey) {
            setSelectedNodeIds(prev => prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]);
        } else if (!selectedNodeIds.includes(nodeId)) {
            setSelectedNodeIds([nodeId]);
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

        switch(interactionState.current.type) {
            case 'dragging-nodes': {
                const updates = Array.from(interactionState.current.dragStartPositions.entries()).map(([id, startPos]) => ({
                    id,
                    position: { x: startPos.x + dx, y: startPos.y + dy }
                }));
                updateLabelNodePositions(updates);
                break;
            }
            case 'panning': {
                onTransformChange(t => ({...t, x: t.x + moveEvent.movementX, y: t.y + moveEvent.movementY }));
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
            if (distance > 5) {
                const finalRect: Rect = {
                    x: Math.min(startPos.x, pointerEndPos.x),
                    y: Math.min(startPos.y, pointerEndPos.y),
                    width: Math.abs(dx),
                    height: Math.abs(dy),
                };

                 const selectedInRect = labelNodes.filter(n => 
                    n.position.x < finalRect.x + finalRect.width &&
                    n.position.x + n.width > finalRect.x &&
                    n.position.y < finalRect.y + finalRect.height &&
                    n.position.y + n.height > finalRect.y
                ).map(n => n.id);
                
                if (upEvent.shiftKey) {
                    setSelectedNodeIds(prev => [...new Set([...prev, ...selectedInRect])]);
                } else {
                    setSelectedNodeIds(selectedInRect);
                }
            } else { // Click on canvas
                setSelectedNodeIds([]);
            }
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
  
  // Setup manual wheel listener for non-passive behavior
  useEffect(() => {
      const el = canvasRef.current;
      if (!el) return;

      const onWheel = (e: WheelEvent) => {
          if ((e.target as HTMLElement).closest('.view-routes-panel')) return;
          e.preventDefault(); // Stop browser native zoom/scroll
          const rect = el.getBoundingClientRect();
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

      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
  }, [onTransformChange, mouseGestures]);

  const backgroundStyle = {
    backgroundSize: `${32 * transform.scale}px ${32 * transform.scale}px`,
    backgroundPosition: `${transform.x}px ${transform.y}px`,
  };
  
  const svgBounds = useMemo(() => {
    if (labelNodes.length === 0) return { top: 0, left: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    labelNodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.width);
      maxY = Math.max(maxY, node.position.y + node.height);
    });
    // Extra padding for block containers
    const PADDING = 300;
    return {
      left: minX - PADDING, top: minY - PADDING,
      width: (maxX - minX) + PADDING * 2, height: (maxY - minY) + PADDING * 2,
    };
  }, [labelNodes]);

  const minimapItems = useMemo((): MinimapItem[] => {
    return labelNodes.map(n => ({ ...n, type: 'label' }));
  }, [labelNodes]);

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing bg-gray-100 dark:bg-gray-900 bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] dark:bg-[radial-gradient(#4b5563_1px,transparent_1px)]"
      style={backgroundStyle}
      onPointerDown={handlePointerDown}
    >
      <ViewRoutesPanel routes={identifiedRoutes} checkedRoutes={checkedRoutes} onToggleRoute={handleToggleRoute} />
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Layer 0: Block Group Containers */}
        {blockGroups.map(group => (
            <BlockContainer 
                key={group.id} 
                id={group.id} 
                title={group.title} 
                rect={group.rect} 
                isDimmed={linkColors !== null} // Dim background containers if a route is selected
            />
        ))}

        <svg 
          className="absolute pointer-events-none"
          style={{ left: svgBounds.left, top: svgBounds.top, width: svgBounds.width, height: svgBounds.height, zIndex: 5 }}
        >
          <defs>
            {/* Markers: viewBox="0 0 10 10", triangle shape M0,0 L10,5 L0,10 z, bigger size 12x12 */}
            <marker id="arrowhead-4f46e5" viewBox="0 0 10 10" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L10,5 L0,10 z" fill="#4f46e5" />
            </marker>
             <marker id="arrowhead-94a3b8" viewBox="0 0 10 10" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
            </marker>
            {identifiedRoutes.map(route => (
                <marker key={route.id} id={`arrowhead-${route.color.replace('#', '')}`} viewBox="0 0 10 10" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0 L10,5 L0,10 z" fill={route.color} />
                </marker>
            ))}
          </defs>
          <g transform={`translate(${-svgBounds.left}, ${-svgBounds.top})`}>
            {routeLinks.map((link) => {
              const sourceNode = nodeMap.get(link.sourceId);
              const targetNode = nodeMap.get(link.targetId);
              if (!sourceNode || !targetNode) return null;

              const [sourcePos, targetPos] = getOptimalPath(sourceNode, targetNode);
              
              let color = link.type === 'implicit' ? "#94a3b8" : "#4f46e5";
              let isDimmed = false;

              if (linkColors) {
                  if (linkColors.has(link.id)) {
                      color = linkColors.get(link.id)!;
                  } else {
                      isDimmed = true;
                      color = '#9ca3af'; // gray
                  }
              }

              return <Arrow key={link.id} sourcePos={sourcePos} targetPos={targetPos} type={link.type} color={color} isDimmed={isDimmed} />;
            })}
          </g>
        </svg>

        {rubberBandRect && <RubberBand rect={rubberBandRect} />}

        {labelNodes.map((node) => (
          <LabelBlock
            key={node.id}
            node={node}
            onOpenEditor={onOpenEditor}
            isSelected={selectedNodeIds.includes(node.id)}
            isDragging={isDraggingSelection && selectedNodeIds.includes(node.id)}
          />
        ))}
      </div>
      <Minimap
        items={minimapItems}
        transform={transform}
        canvasDimensions={canvasDimensions}
        onTransformChange={onTransformChange}
      />
    </div>
  );
};

export default RouteCanvas;