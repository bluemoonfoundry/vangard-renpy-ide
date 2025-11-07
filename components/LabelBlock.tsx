import React from 'react';
import type { LabelNode } from '../types';

interface LabelBlockProps {
  node: LabelNode;
  onOpenEditor: (blockId: string, line: number) => void;
  isSelected: boolean;
  isDragging: boolean;
}

const LabelBlock: React.FC<LabelBlockProps> = ({ 
  node, 
  onOpenEditor,
  isSelected,
  isDragging
}) => {
  
  const borderClass = isSelected 
    ? 'border-indigo-500 dark:border-indigo-400' 
    : 'border-gray-300 dark:border-gray-600';
  
  const shadowClass = isDragging ? 'shadow-lg shadow-indigo-500/50' : 'shadow-md';
  const bgClass = isSelected ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-white dark:bg-gray-800';

  return (
    <div
      data-label-node-id={node.id}
      className={`label-block-wrapper absolute rounded-md border-2 ${borderClass} ${shadowClass} ${bgClass} flex items-center px-3 space-x-2 cursor-grab transition-all duration-200`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        height: node.height,
        zIndex: isSelected ? 10 : 5,
      }}
      onDoubleClick={() => onOpenEditor(node.blockId, node.startLine)}
      title={`Label: ${node.label}\nDouble-click to open in editor`}
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A1 1 0 012 10V5a1 1 0 011-1h5a1 1 0 01.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
        <span className="text-sm font-semibold font-mono text-gray-800 dark:text-gray-200 truncate">
            {node.label}
        </span>
    </div>
  );
};

export default LabelBlock;
