import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import LabelBlock from './LabelBlock';
import ViewRoutesPanel from './ViewRoutesPanel';
import Minimap from './Minimap';
import type { MinimapItem } from './Minimap';
import type { LabelNode, RouteLink, Position, IdentifiedRoute } from '../types';

interface RouteCanvasProps {
  labelNodes: LabelNode[];
  routeLinks: RouteLink[];
  identifiedRoutes: IdentifiedRoute[];
  updateLabelNodePositions: (updates: { id: string, position: Position }[]) => void;
  onOpenEditor: (blockId: string, line: number) => void;
  transform: { x: number, y: number, scale: number };
  onTransformChange: React.Dispatch<React.SetStateAction<{ x: number, y: number, scale: number }>>;
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
    const sourcePoints = {
        right: getAttachmentPoint(sourceNode, 'right'),
        left: getAttachmentPoint(sourceNode, 'left'),
        bottom: getAttachmentPoint(sourceNode, 'bottom'),
        top: getAttachmentPoint(sourceNode, 'top'),
    };
    const targetPoints = {
        left: getAttachmentPoint(targetNode, 'left'),
        right: getAttachmentPoint(targetNode, 'right'),
        top: getAttachmentPoint(targetNode, 'top'),
        bottom: getAttachmentPoint(targetNode, 'bottom'),
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
  sourcePos: Position; 
  targetPos: Position;
  type: RouteLink['type'];
  color: string;
  isDimmed: boolean;
}> = ({ sourcePos, targetPos, type, color, isDimmed }) => {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    
    const controlX = sourcePos.x + dx / 2 + (dy / 5);
    const controlY = sourcePos.y + dy / 2 - (dx / 5);

    const pathData = `M${sourcePos.x},${sourcePos.y} Q${controlX},${controlY} ${targetPos.x},${targetPos.y}`;

    return (
        <g className={`pointer-events-none transition-opacity duration-300 ${isDimmed ? 'opacity-20' : 'opacity-100'}`}>
          <path
              d={pathData}
              stroke={color}
              strokeWidth="2.5"
              fill="none"
              strokeDasharray={type === 'implicit' ? "5, 5" : "none"}
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

type InteractionState = 
  | { type: 'idle' }
  | { type: 'panning'; }
  | { type: 'rubber-band'; start: Position; }
  | { type: 'dragging-nodes'; dragStartPositions: Map<string, Position>; };

const RouteCanvas: React.FC<RouteCanvasProps> = ({ labelNodes, routeLinks, identifiedRoutes, updateLabelNodePositions, onOpenEditor, transform, onTransformChange }) => {
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
  
  const handleWheel = (e: React.WheelEvent) => {
    if (!canvasRef.current || (e.target as HTMLElement).closest('.view-routes-panel')) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    onTransformChange(t => {
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
  
  const svgBounds = useMemo(() => {
    if (labelNodes.length === 0) return { top: 0, left: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    labelNodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.width);
      maxY = Math.max(maxY, node.position.y + node.height);
    });
    const PADDING = 200;
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
      onWheel={handleWheel}
    >
      <ViewRoutesPanel routes={identifiedRoutes} checkedRoutes={checkedRoutes} onToggleRoute={handleToggleRoute} />
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <svg 
          className="absolute pointer-events-none"
          style={{ left: svgBounds.left, top: svgBounds.top, width: svgBounds.width, height: svgBounds.height }}
        >
          <defs>
            <marker id="arrowhead-4f46e5" viewBox="-14 0 14 10" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
              <polygon points="-14 0, 0 3.5, -14 7" fill="#4f46e5" />
            </marker>
             <marker id="arrowhead-94a3b8" viewBox="-14 0 14 10" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
              <polygon points="-14 0, 0 3.5, -14 7" fill="#94a3b8" />
            </marker>
            {identifiedRoutes.map(route => (
                <marker key={route.id} id={`arrowhead-${route.color.replace('#', '')}`} viewBox="-14 0 14 10" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                    <polygon points="-14 0, 0 3.5, -14 7" fill={route.color} />
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