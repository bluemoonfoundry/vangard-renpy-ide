/**
 * @file CanvasNodeContextMenu.tsx
 * @description Right-click context menu for label nodes on narrative canvases.
 * Key features: open the node in the editor or warp to the label directly.
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface CanvasNodeContextMenuProps {
  x: number;
  y: number;
  label: string;
  onClose: () => void;
  onOpenEditor: () => void;
  onWarpToHere: () => void;
}

const CanvasNodeContextMenu: React.FC<CanvasNodeContextMenuProps> = ({
  x,
  y,
  label,
  onClose,
  onOpenEditor,
  onWarpToHere,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-md shadow-2xl border border-gray-200 dark:border-gray-700 w-56 overflow-hidden"
      style={{ top: y, left: x }}
      onContextMenu={e => e.preventDefault()}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="p-1 space-y-1">
        <p className="px-3 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate" title={label}>
          {label}
        </p>
        <button
          onClick={() => handleAction(onOpenEditor)}
          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors flex items-center"
        >
          Open in editor
        </button>
        <button
          onClick={() => handleAction(onWarpToHere)}
          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-400 rounded transition-colors flex items-center"
        >
          Warp to here
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default CanvasNodeContextMenu;
