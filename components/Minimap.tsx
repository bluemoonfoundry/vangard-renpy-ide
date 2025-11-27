import React, { useRef, useMemo, useCallback } from 'react';
import type { NoteColor } from '../types';

export interface MinimapItem {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  type: 'block' | 'group' | 'note' | 'label' | 'screen' | 'config';
  color?: NoteColor;
}

interface MinimapProps {
  items: MinimapItem[];
  transform: { x: number; y: number; scale: number };
  canvasDimensions: { width: number; height: number };
  onTransformChange: React.Dispatch<React.SetStateAction<{ x: number; y: number; scale: number }>>;
}

const MINIMAP_WIDTH = 240;
const MINIMAP_HEIGHT = 180;
const PADDING = 20;

const ITEM_COLORS: Record<MinimapItem['type'], string> = {
  block: 'rgba(107, 114, 128, 0.7)', // gray-500
  group: 'rgba(99, 102, 241, 0.4)', // indigo-500
  note: 'rgba(234, 179, 8, 0.6)', // yellow-500
  label: 'rgba(147, 197, 253, 0.8)', // blue-300
  screen: 'rgba(45, 212, 191, 0.7)', // teal-400
  config: 'rgba(248, 113, 113, 0.7)' // red-400
};

const Minimap: React.FC<MinimapProps> = ({ items, transform, canvasDimensions, onTransformChange }) => {
  const minimapRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ isDragging: boolean; startX: number; startY: number; initialPanX: number; initialPanY: number; }>({ isDragging: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });

  const { bounds, minimapScale } = useMemo(() => {
    if (items.length === 0) {
      return { bounds: { minX: 0, minY: 0, width: 0, height: 0 }, minimapScale: 1 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(item => {
      minX = Math.min(minX, item.position.x);
      minY = Math.min(minY, item.position.y);
      maxX = Math.max(maxX, item.position.x + item.width);
      maxY = Math.max(maxY, item.position.y + item.height);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    if (contentWidth <= 0 || contentHeight <= 0) {
       return { bounds: { minX, minY, width: contentWidth, height: contentHeight }, minimapScale: 1 };
    }

    const scale = Math.min(
      (MINIMAP_WIDTH - PADDING * 2) / contentWidth,
      (MINIMAP_HEIGHT - PADDING * 2) / contentHeight
    );

    return {
      bounds: { minX, minY, width: contentWidth, height: contentHeight },
      minimapScale: scale,
    };
  }, [items]);

  const viewportStyle = useMemo<React.CSSProperties>(() => {
    if (!canvasDimensions.width || !canvasDimensions.height) return {};
    const viewWidth = canvasDimensions.width / transform.scale;
    const viewHeight = canvasDimensions.height / transform.scale;
    const viewX = -transform.x / transform.scale;
    const viewY = -transform.y / transform.scale;

    const minimapContentWidth = bounds.width * minimapScale;
    const minimapContentHeight = bounds.height * minimapScale;
    const offsetX = (MINIMAP_WIDTH - minimapContentWidth) / 2;
    const offsetY = (MINIMAP_HEIGHT - minimapContentHeight) / 2;

    return {
      width: viewWidth * minimapScale,
      height: viewHeight * minimapScale,
      left: (viewX - bounds.minX) * minimapScale + offsetX,
      top: (viewY - bounds.minY) * minimapScale + offsetY,
      position: 'absolute',
      border: '1.5px solid rgba(79, 70, 229, 0.8)',
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      cursor: 'grab',
      willChange: 'transform, width, height, left, top',
    };
  }, [transform, canvasDimensions, bounds, minimapScale]);

  const handlePan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!minimapRef.current || !canvasDimensions.width || !canvasDimensions.height) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const minimapContentWidth = bounds.width * minimapScale;
    const minimapContentHeight = bounds.height * minimapScale;
    const offsetX = (MINIMAP_WIDTH - minimapContentWidth) / 2;
    const offsetY = (MINIMAP_HEIGHT - minimapContentHeight) / 2;

    const worldX = (x - offsetX) / minimapScale + bounds.minX;
    const worldY = (y - offsetY) / minimapScale + bounds.minY;

    onTransformChange(t => ({
      ...t,
      x: (canvasDimensions.width / 2) - (worldX * t.scale),
      y: (canvasDimensions.height / 2) - (worldY * t.scale),
    }));
  }, [onTransformChange, bounds, minimapScale, canvasDimensions]);
  
  const handleViewportPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      dragState.current = {
          isDragging: true,
          startX: e.clientX,
          startY: e.clientY,
          initialPanX: transform.x,
          initialPanY: transform.y,
      };
      target.style.cursor = 'grabbing';
      
      const handlePointerMove = (moveEvent: PointerEvent) => {
          if (!dragState.current.isDragging) return;
          const dx = moveEvent.clientX - dragState.current.startX;
          const dy = moveEvent.clientY - dragState.current.startY;
          
          const panX = -dx / minimapScale * transform.scale;
          const panY = -dy / minimapScale * transform.scale;
          
          onTransformChange(t => ({
              ...t,
              x: dragState.current.initialPanX + panX,
              y: dragState.current.initialPanY + panY,
          }));
      };
      
      const handlePointerUp = () => {
          dragState.current.isDragging = false;
          target.style.cursor = 'grab';
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
          target.releasePointerCapture(e.pointerId);
      };
      
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
  }, [minimapScale, transform.scale, transform.x, transform.y, onTransformChange]);


  return (
    <div
      ref={minimapRef}
      onPointerDown={handlePan}
      className="absolute bottom-4 right-4 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-lg"
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
    >
      <div className="relative w-full h-full overflow-hidden">
        {items.map(item => {
          const minimapContentWidth = bounds.width * minimapScale;
          const minimapContentHeight = bounds.height * minimapScale;
          const offsetX = (MINIMAP_WIDTH - minimapContentWidth) / 2;
          const offsetY = (MINIMAP_HEIGHT - minimapContentHeight) / 2;

          let color = ITEM_COLORS[item.type];
          if (item.type === 'note' && item.color) {
            const noteColorMap: Record<NoteColor, string> = {
                yellow: 'rgba(234, 179, 8, 0.6)',
                blue: 'rgba(59, 130, 246, 0.6)',
                green: 'rgba(34, 197, 94, 0.6)',
                pink: 'rgba(236, 72, 153, 0.6)',
                purple: 'rgba(168, 85, 247, 0.6)',
                red: 'rgba(239, 68, 68, 0.6)',
            };
            color = noteColorMap[item.color] || color;
          }

          return (
            <div
              key={item.id}
              className="absolute rounded-sm"
              style={{
                left: (item.position.x - bounds.minX) * minimapScale + offsetX,
                top: (item.position.y - bounds.minY) * minimapScale + offsetY,
                width: Math.max(2, item.width * minimapScale),
                height: Math.max(2, item.height * minimapScale),
                backgroundColor: color,
              }}
            />
          );
        })}
        <div onPointerDown={handleViewportPointerDown} style={viewportStyle} />
      </div>
    </div>
  );
};

export default Minimap;
