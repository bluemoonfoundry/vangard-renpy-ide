/**
 * @file LabelBlock.tsx
 * @description Canvas node representing a single Ren'Py label in `RouteCanvas` (~120 lines).
 * Key features: entry/unreachable/dead-end status badges, structural role overlay highlights
 * (hub/branch/menu-heavy/call-heavy) with count badges, click-to-open editor, memoised.
 * Integration: rendered by `RouteCanvas` for each `LabelNode` from `useRenpyAnalysis`.
 */
import React from 'react';
import type { LabelNode } from '../types';

interface LabelBlockProps {
  node: LabelNode;
  onOpenEditor: (blockId: string, line: number) => void;
  isSelected: boolean;
  isDragging: boolean;
  isEntry?: boolean;
  isUnreachable?: boolean;
  isDeadEnd?: boolean;
  isDimmed?: boolean;
  /** Active overlay type — renders a colored badge at the bottom-left of the node */
  overlayHighlight?: 'hub' | 'branch' | 'menu-heavy' | 'call-heavy' | null;
  /** Numeric count shown inside the overlay badge (e.g. number of incoming links for hubs) */
  overlayCount?: number;
}

const OVERLAY_STYLES: Record<NonNullable<LabelBlockProps['overlayHighlight']>, {
  bg: string; border: string; title: string;
}> = {
  hub:         { bg: 'bg-sky-500',    border: 'border-sky-500 dark:border-sky-400',    title: 'Hub — many incoming paths' },
  branch:      { bg: 'bg-violet-500', border: 'border-violet-500 dark:border-violet-400', title: 'Branch — many outgoing paths' },
  'menu-heavy':{ bg: 'bg-rose-500',   border: 'border-rose-500 dark:border-rose-400',  title: 'Menu-heavy — multiple choice menus' },
  'call-heavy':{ bg: 'bg-teal-500',   border: 'border-teal-500 dark:border-teal-400',  title: 'Call-heavy — many incoming calls' },
};

const LabelBlock: React.FC<LabelBlockProps> = React.memo(({
  node,
  onOpenEditor,
  isSelected,
  isDragging,
  isEntry,
  isUnreachable,
  isDeadEnd,
  isDimmed,
  overlayHighlight,
  overlayCount,
}) => {

  const overlayStyle = overlayHighlight ? OVERLAY_STYLES[overlayHighlight] : null;

  const ariaLabel = [
    `Label: ${node.label}`,
    isEntry ? 'entry point' : null,
    isUnreachable ? 'unreachable' : null,
    isDeadEnd ? 'dead end' : null,
    overlayStyle ? overlayStyle.title : null,
    isSelected ? 'selected' : null,
  ].filter(Boolean).join(', ');

  const borderClass = isSelected
    ? 'border-indigo-500 dark:border-indigo-400'
    : overlayStyle
    ? overlayStyle.border
    : isEntry
    ? 'border-green-500 dark:border-green-400'
    : isUnreachable
    ? 'border-orange-400 dark:border-orange-400'
    : isDeadEnd
    ? 'border-amber-500 dark:border-amber-400 border-dashed'
    : 'border-gray-300 dark:border-gray-600';

  const shadowClass = isDragging ? 'shadow-lg shadow-indigo-500/50' : 'shadow-md';
  const bgClass = isSelected
    ? 'bg-indigo-100 dark:bg-indigo-900/50'
    : isEntry
    ? 'bg-green-50 dark:bg-green-900/20'
    : isUnreachable
    ? 'bg-orange-50 dark:bg-orange-900/20'
    : isDeadEnd
    ? 'bg-amber-50 dark:bg-amber-900/20'
    : 'bg-white dark:bg-gray-800';

  const roleTitle = isEntry
    ? '\nEntry point — story starts here'
    : isUnreachable
    ? '\nUnreachable — no label jumps here'
    : isDeadEnd
    ? '\nDead end — no outgoing jumps'
    : overlayStyle
    ? `\n${overlayStyle.title}${overlayCount !== undefined ? ` (${overlayCount})` : ''}`
    : '';

  return (
    <div
      data-label-node-id={node.id}
      tabIndex={isDimmed ? -1 : 0}
      role="button"
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      className={`group label-block-wrapper absolute rounded-md border-2 ${borderClass} ${shadowClass} ${bgClass} flex items-center px-3 space-x-2 cursor-grab transition-all duration-200 ${isDimmed ? 'opacity-20 pointer-events-none' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        height: node.height,
        zIndex: isSelected ? 10 : 5,
      }}
      onDoubleClick={() => onOpenEditor(node.blockId, node.startLine)}
      title={`Label: ${node.label}\nDouble-click to open in editor${roleTitle}`}
    >
        {isEntry && !isSelected && (
          <span className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 pointer-events-none" />
        )}
        {isUnreachable && !isSelected && (
          <span className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-orange-400 border-2 border-white dark:border-gray-900 pointer-events-none" />
        )}
        {isDeadEnd && !isSelected && (
          <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-white dark:border-gray-900 pointer-events-none" />
        )}
        {/* Overlay badge — bottom-left, shows count */}
        {overlayHighlight && overlayStyle && !isSelected && (
          <span
            className={`absolute -bottom-1.5 -left-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full ${overlayStyle.bg} border border-white dark:border-gray-900 pointer-events-none flex items-center justify-center`}
            title={overlayStyle.title}
          >
            {overlayCount !== undefined && (
              <span className="text-[9px] font-bold leading-none text-white tabular-nums">{overlayCount > 9 ? '9+' : overlayCount}</span>
            )}
          </span>
        )}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A1 1 0 012 10V5a1 1 0 011-1h5a1 1 0 01.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
        <span className="text-sm font-semibold font-mono text-gray-800 dark:text-gray-200 truncate flex-1">
            {node.label}
        </span>
        <button
          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"
          onClick={(e) => { e.stopPropagation(); onOpenEditor(node.blockId, node.startLine); }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Open in editor"
          aria-label="Open in editor"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
        </button>
    </div>
  );
});

export default LabelBlock;
