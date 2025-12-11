
import React, { useEffect, useRef } from 'react';

interface TabContextMenuProps {
  x: number;
  y: number;
  tabId: string;
  onClose: () => void;
  onCloseTab: (tabId: string) => void;
  onCloseOthers: (tabId: string) => void;
  onCloseLeft: (tabId: string) => void;
  onCloseRight: (tabId: string) => void;
  onCloseAll: () => void;
}

const TabContextMenu: React.FC<TabContextMenuProps> = ({ 
  x, y, tabId, onClose, 
  onCloseTab, onCloseOthers, onCloseLeft, onCloseRight, onCloseAll 
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

  const isCanvasTab = tabId === 'canvas';

  return (
    <div
      ref={menuRef}
      className="absolute z-[60] bg-white dark:bg-gray-800 rounded-md shadow-2xl border border-gray-200 dark:border-gray-700 w-48"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-1 space-y-1">
        <button
          onClick={() => handleAction(() => onCloseTab(tabId))}
          disabled={isCanvasTab}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Close
        </button>
        <button
          onClick={() => handleAction(() => onCloseOthers(tabId))}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded"
        >
          Close Others
        </button>
        <button
          onClick={() => handleAction(() => onCloseLeft(tabId))}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded"
        >
          Close to the Left
        </button>
        <button
          onClick={() => handleAction(() => onCloseRight(tabId))}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded"
        >
          Close to the Right
        </button>
        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
        <button
          onClick={() => handleAction(onCloseAll)}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded"
        >
          Close All
        </button>
      </div>
    </div>
  );
};

export default TabContextMenu;
