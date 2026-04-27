/**
 * @file Sash.tsx
 * @description Thin draggable divider for resizable split-pane layouts (~60 lines).
 * Key features: horizontal (left-right) and vertical (top-bottom) drag directions, pointer
 * capture for smooth out-of-bounds dragging.
 * Integration: used inside `EditorView` split-pane layout to resize primary and secondary panes;
 * calls `onDrag(delta)` so the parent manages pane size state.
 */
import React from 'react';

interface SashProps {
  onDrag: (delta: number) => void;
  direction?: 'horizontal' | 'vertical';
}

const Sash: React.FC<SashProps> = ({ onDrag, direction = 'horizontal' }) => {
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      onDrag(direction === 'vertical' ? moveEvent.movementY : moveEvent.movementX);
    };

    const handlePointerUp = () => {
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  if (direction === 'vertical') {
    return (
      <div
        onPointerDown={handlePointerDown}
        className="flex-none h-1.5 w-full cursor-row-resize bg-gray-200 dark:bg-gray-700 hover:bg-indigo-500 transition-colors duration-200 z-30"
      />
    );
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      className="flex-none w-1.5 h-full cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-indigo-500 transition-colors duration-200 z-30"
    />
  );
};

export default Sash;
