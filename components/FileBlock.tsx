/**
 * @file FileBlock.tsx
 * @description Canvas node representing a `.rpy` file in the `StoryCanvas` file-level view (~60 lines).
 * Key features: shows file name and label count, drill-down button to open `RouteCanvas`,
 * selection/dimmed visual states, memoised for canvas performance.
 * Integration: rendered by `StoryCanvas` when `viewLevel === 'file'`; receives `LabelNode` data
 * from `useRenpyAnalysis`.
 */
import React from 'react';
import type { LabelNode } from '../types';

interface FileBlockProps {
  node: LabelNode; // id = blockId, label = cleaned containerName
  labelCount: number;
  onDrillDown: (blockId: string) => void;
  onOpenEditor: (blockId: string, line: number) => void;
  isSelected: boolean;
  isDimmed: boolean;
}

const FileBlock: React.FC<FileBlockProps> = React.memo(({
  node,
  labelCount,
  onDrillDown,
  onOpenEditor,
  isSelected,
  isDimmed,
}) => {
  const borderClass = isSelected
    ? 'border-indigo-500 dark:border-indigo-400'
    : 'border-gray-300 dark:border-gray-600';

  const bgClass = isSelected
    ? 'bg-indigo-50 dark:bg-indigo-900/30'
    : 'bg-white dark:bg-gray-800';

  return (
    <div
      className={`label-block-wrapper group absolute select-none rounded-xl border-2 shadow-md transition-opacity duration-300 ${borderClass} ${bgClass} ${isDimmed ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}
      data-label-node-id={node.id}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        height: node.height,
        zIndex: isSelected ? 10 : 5,
      }}
      onDoubleClick={() => onDrillDown(node.id)}
    >
      {/* Drill-down button — visible on group hover */}
      <button
        type="button"
        title="Drill into labels"
        aria-label="Drill into labels"
        className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center justify-center h-6 w-6 rounded-md bg-indigo-600 text-white opacity-90 hover:opacity-100 hover:bg-indigo-700 transition-colors z-10"
        onClick={e => { e.stopPropagation(); onDrillDown(node.id); }}
      >
        {/* Magnifying glass / zoom-in icon */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          <path d="M8 6a1 1 0 011 1v1h1a1 1 0 110 2H9v1a1 1 0 11-2 0v-1H6a1 1 0 110-2h1V7a1 1 0 011-1z" />
        </svg>
      </button>

      <div className="flex h-full flex-col items-center justify-center gap-2 px-3 py-2">
        {/* File document icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-7 shrink-0 text-indigo-400 dark:text-indigo-500"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>

        {/* Filename */}
        <div
          className="max-w-full text-center text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight break-words"
          title={node.label}
        >
          {node.label}
        </div>

        {/* Label count badge */}
        <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
          {labelCount} {labelCount === 1 ? 'label' : 'labels'}
        </span>

        {/* Open in editor button */}
        <button
          type="button"
          title="Open in editor"
          className="hidden group-hover:inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
          onClick={e => { e.stopPropagation(); onOpenEditor(node.id, 1); }}
        >
          Open ↗
        </button>
      </div>
    </div>
  );
});

FileBlock.displayName = 'FileBlock';

export default FileBlock;
