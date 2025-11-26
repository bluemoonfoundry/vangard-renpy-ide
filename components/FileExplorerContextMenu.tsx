

import React, { useEffect, useRef } from 'react';
import type { FileSystemTreeNode } from '../types';
// FIX: Corrected import path for ClipboardState
import type { ClipboardState } from '../types';


interface ContextMenuProps {
  x: number;
  y: number;
  node: FileSystemTreeNode;
  clipboard: ClipboardState;
  selectionSize: number;
  onClose: () => void;
  onNewFile: (parentPath: string) => void;
  onNewFolder: (parentPath: string) => void;
  onRename: (path: string) => void;
  onDelete: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: (targetPath: string) => void;
  onCenterOnBlock: (path: string) => void;
}

const FileExplorerContextMenu: React.FC<ContextMenuProps> = ({ 
    x, y, node, clipboard, selectionSize, onClose, onNewFile, onNewFolder, 
    onRename, onDelete, onCut, onCopy, onPaste, onCenterOnBlock
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

  const isDirectory = !!node.children;
  const isRpyFile = node.name.endsWith('.rpy');
  const targetPathForNewItems = isDirectory ? node.path : (node.path.substring(0, node.path.lastIndexOf('/')) || '');
  
  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white dark:bg-gray-800 rounded-md shadow-2xl border border-gray-200 dark:border-gray-700 w-52"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-1 space-y-1">
        {isRpyFile && selectionSize === 1 && (
            <>
                <button
                    onClick={() => handleAction(() => onCenterOnBlock(node.path))}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded"
                >
                    Center on Canvas
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700 -mx-1 my-1"></div>
            </>
        )}
        <button
          onClick={() => handleAction(() => onNewFile(targetPathForNewItems))}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded"
        >
          New File...
        </button>
        <button
          onClick={() => handleAction(() => onNewFolder(targetPathForNewItems))}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded"
        >
          New Folder...
        </button>
        <div className="border-t border-gray-200 dark:border-gray-700 -mx-1 my-1"></div>
        <button
          onClick={() => handleAction(() => onRename(node.path))}
          disabled={!node.path || selectionSize > 1}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Rename
        </button>
         <button
          onClick={() => handleAction(onDelete)}
          disabled={!node.path}
          className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {`Delete ${selectionSize > 1 ? `${selectionSize} Items` : ''}`}
        </button>
        <div className="border-t border-gray-200 dark:border-gray-700 -mx-1 my-1"></div>
        <button
          onClick={() => handleAction(onCut)}
          disabled={!node.path}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {`Cut ${selectionSize > 1 ? `${selectionSize} Items` : ''}`}
        </button>
         <button
          onClick={() => handleAction(onCopy)}
          disabled={!node.path}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {`Copy ${selectionSize > 1 ? `${selectionSize} Items` : ''}`}
        </button>
        <button
          onClick={() => handleAction(() => onPaste(targetPathForNewItems))}
          disabled={!clipboard}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Paste
        </button>
      </div>
    </div>
  );
};

export default FileExplorerContextMenu;
