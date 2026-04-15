/**
 * @file CanvasToolbox.tsx
 * @description Collapsible floating panel grouping canvas configuration controls (~60 lines).
 * Key features: chevron-toggle header with configurable label, scrollable child area, children
 * use `embedded={true}` to suppress their own container styling.
 * Integration: used in `StoryCanvas`, `RouteCanvas`, and `ChoiceCanvas` to host
 * `CanvasLayoutControls`, `ViewRoutesPanel`, and `MenuInspectorPanel`.
 */
import React, { useState } from 'react';

interface CanvasToolboxProps {
  children: React.ReactNode;
  /** Label shown in the header row. Defaults to "Canvas Controls". */
  label?: string;
  /** Additional className for the outer positioning wrapper. */
  className?: string;
}

/**
 * A collapsible floating panel that groups canvas configuration controls
 * into a single visible rectangle at the top-left of the canvas.
 *
 * The header row shows the panel label and a chevron toggle. Children are
 * rendered inside a scrollable body separated by thin dividers. Each child
 * should use embedded={true} to suppress its own outer container styling.
 */
const CanvasToolbox: React.FC<CanvasToolboxProps> = ({
  children,
  label = 'Canvas Controls',
  className = '',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`absolute top-4 left-4 z-20 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden ${className}`}
      onPointerDown={e => e.stopPropagation()}
      onContextMenu={e => e.stopPropagation()}
    >
      {/* Header / toggle */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsCollapsed(v => !v)}
        aria-expanded={!isCollapsed}
        title={isCollapsed ? 'Expand canvas controls' : 'Collapse canvas controls'}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Scrollable body */}
      {!isCollapsed && (
        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60">
          {children}
        </div>
      )}
    </div>
  );
};

export default CanvasToolbox;
