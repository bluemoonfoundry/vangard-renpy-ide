import React from 'react';

interface SashProps {
  onDrag: (delta: number) => void;
}

const Sash: React.FC<SashProps> = ({ onDrag }) => {
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      onDrag(moveEvent.movementX);
    };

    const handlePointerUp = () => {
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className="flex-none w-1.5 h-full cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-indigo-500 transition-colors duration-200 z-30"
    />
  );
};

export default Sash;
