
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { BlockType } from './CreateBlockModal';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCreateBlock: (type: BlockType) => void;
  onAddStickyNote: () => void;
}

const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({ x, y, onClose, onCreateBlock, onAddStickyNote }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    // Use mousedown to catch clicks before they trigger other canvas events if possible
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
      className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-md shadow-2xl border border-gray-200 dark:border-gray-700 w-48 overflow-hidden"
      style={{ top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="p-1 space-y-1">
        <p className="px-3 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Create New</p>
        <button
          onClick={() => handleAction(() => onCreateBlock('story'))}
          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors flex items-center"
        >
          <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span>
          Story Block
        </button>
        <button
          onClick={() => handleAction(() => onCreateBlock('screen'))}
          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-600 dark:hover:text-teal-400 rounded transition-colors flex items-center"
        >
          <span className="w-2 h-2 rounded-full bg-teal-500 mr-2"></span>
          Screen Block
        </button>
        <button
          onClick={() => handleAction(() => onCreateBlock('config'))}
          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors flex items-center"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
          Config Block
        </button>
        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
        <button
          onClick={() => handleAction(onAddStickyNote)}
          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 hover:text-yellow-600 dark:hover:text-yellow-400 rounded transition-colors flex items-center"
        >
          <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
          Sticky Note
        </button>
      </div>
    </div>,
    document.body
  );
};

export default CanvasContextMenu;
