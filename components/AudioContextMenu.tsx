
import React, { useEffect, useRef } from 'react';

interface AudioContextMenuProps {
  x: number;
  y: number;
  filePath: string;
  onSelect: (type: 'play' | 'queue') => void;
  onClose: () => void;
}

const AudioContextMenu: React.FC<AudioContextMenuProps> = ({ x, y, filePath, onSelect, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white dark:bg-gray-800 rounded-md shadow-2xl border border-gray-200 dark:border-gray-700"
      style={{ top: y, left: x }}
    >
      <div className="p-2">
        <p className="text-sm font-semibold px-2 py-1 text-gray-800 dark:text-gray-200">Insert Audio:</p>
        <p className="text-xs font-mono px-2 pb-2 text-gray-500 dark:text-gray-400 truncate max-w-xs">{filePath}</p>
        <div className="border-t border-gray-200 dark:border-gray-700 -mx-2 my-1"></div>
        <button
          onClick={() => onSelect('play')}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded"
        >
          Copy `play audio`
        </button>
        <button
          onClick={() => onSelect('queue')}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 rounded"
        >
          Copy `queue audio`
        </button>
      </div>
    </div>
  );
};

export default AudioContextMenu;
