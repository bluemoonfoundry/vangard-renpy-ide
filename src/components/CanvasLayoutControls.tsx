/**
 * @file CanvasLayoutControls.tsx
 * @description Toolbar widget for switching canvas layout, grouping mode, and view level (~150 lines).
 * Key features: layout mode (auto/manual/force/grid), grouping mode, file/label view level toggle;
 * `allowedLayoutModes` filter; `embedded` prop for borderless rendering inside `CanvasToolbox`.
 * Integration: used in `StoryCanvas` and `ChoiceCanvas` toolboxes; state managed by the parent
 * canvas via `ProjectSettings` persisted in `App.tsx`.
 */
import React from 'react';
import type { StoryCanvasGroupingMode, StoryCanvasLayoutMode } from '@/types';

interface CanvasLayoutControlsProps {
  canvasLabel: string;
  layoutMode: StoryCanvasLayoutMode;
  groupingMode: StoryCanvasGroupingMode;
  onChangeLayoutMode: (mode: StoryCanvasLayoutMode) => void;
  onChangeGroupingMode: (mode: StoryCanvasGroupingMode) => void;
  className?: string;
  viewLevel?: 'label' | 'file';
  onChangeViewLevel?: (level: 'label' | 'file') => void;
  /** Restrict which layout modes are shown. Defaults to all four. */
  allowedLayoutModes?: StoryCanvasLayoutMode[];
  /** Whether to show the grouping mode row. Defaults to true. */
  showGrouping?: boolean;
  /**
   * When true, renders without an outer container (no border/bg/shadow).
   * Use when embedding inside CanvasToolbox which provides the container.
   */
  embedded?: boolean;
}

const baseButtonClass = 'h-9 w-9 rounded-md border transition-colors flex items-center justify-center';

const iconClass = 'h-4 w-4';

const LayoutIconButton: React.FC<{
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, title, onClick, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    onClick={onClick}
    className={`${baseButtonClass} ${
      active
        ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`}
  >
    {children}
  </button>
);

const ALL_LAYOUT_MODES: StoryCanvasLayoutMode[] = ['flow-td', 'flow-lr', 'connected-components', 'clustered-flow'];

const CanvasLayoutControls: React.FC<CanvasLayoutControlsProps> = ({
  canvasLabel,
  layoutMode,
  groupingMode,
  onChangeLayoutMode,
  onChangeGroupingMode,
  className = '',
  viewLevel,
  onChangeViewLevel,
  allowedLayoutModes = ALL_LAYOUT_MODES,
  showGrouping = true,
  embedded = false,
}) => {
  return (
    <div
      className={
        embedded
          ? `p-3 ${className}`
          : `layout-panel z-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-lg backdrop-blur p-2 ${className}`
      }
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {canvasLabel} Layout
      </div>
      <div className="flex flex-col gap-2">
        {onChangeViewLevel && viewLevel !== undefined && (
          <div>
            <div className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Level
            </div>
            <div className="flex gap-1">
              {(['label', 'file'] as const).map(level => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={viewLevel === level}
                  onClick={() => onChangeViewLevel(level)}
                  className={`h-9 flex-1 rounded-md border text-xs font-medium transition-colors ${
                    viewLevel === level
                      ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {level === 'label' ? 'Labels' : 'Files'}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Flow
          </div>
          <div className="flex gap-1">
            {allowedLayoutModes.includes('flow-td') && (
              <LayoutIconButton
                active={layoutMode === 'flow-td'}
                title="Flow top to bottom"
                onClick={() => onChangeLayoutMode('flow-td')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 4.5A1.5 1.5 0 016.5 3h1A1.5 1.5 0 019 4.5v3A1.5 1.5 0 017.5 9h-1A1.5 1.5 0 015 7.5v-3zM11 12.5a1.5 1.5 0 011.5-1.5h1a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-1a1.5 1.5 0 01-1.5-1.5v-3z" />
                  <path d="M9 8.5v4.793l1.146-1.147a1 1 0 011.414 1.414l-2.853 2.853a1 1 0 01-1.414 0L4.44 13.56a1 1 0 011.414-1.414L7 13.293V8.5a1 1 0 112 0z" />
                </svg>
              </LayoutIconButton>
            )}
            {allowedLayoutModes.includes('flow-lr') && (
              <LayoutIconButton
                active={layoutMode === 'flow-lr'}
                title="Flow left to right"
                onClick={() => onChangeLayoutMode('flow-lr')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 6.5A1.5 1.5 0 014.5 5h3A1.5 1.5 0 019 6.5v1A1.5 1.5 0 017.5 9h-3A1.5 1.5 0 013 7.5v-1zM11 12.5A1.5 1.5 0 0112.5 11h3a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5v-1z" />
                  <path d="M8.5 7h4.793l-1.147-1.146a1 1 0 111.414-1.414l2.853 2.853a1 1 0 010 1.414l-2.853 2.853a1 1 0 11-1.414-1.414L13.293 9H8.5a1 1 0 110-2z" />
                </svg>
              </LayoutIconButton>
            )}
            {allowedLayoutModes.includes('connected-components') && (
              <LayoutIconButton
                active={layoutMode === 'connected-components'}
                title="Separate connected components"
                onClick={() => onChangeLayoutMode('connected-components')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 5.5A1.5 1.5 0 014.5 4h3A1.5 1.5 0 019 5.5v2A1.5 1.5 0 017.5 9h-3A1.5 1.5 0 013 7.5v-2zM11 12.5a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5v2a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5v-2z" />
                  <path d="M7 10.5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" />
                </svg>
              </LayoutIconButton>
            )}
            {allowedLayoutModes.includes('clustered-flow') && (
              <LayoutIconButton
                active={layoutMode === 'clustered-flow'}
                title="Clustered flow"
                onClick={() => onChangeLayoutMode('clustered-flow')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 4.5A1.5 1.5 0 014.5 3h4A1.5 1.5 0 0110 4.5v4A1.5 1.5 0 018.5 10h-4A1.5 1.5 0 013 8.5v-4zM10 11.5A1.5 1.5 0 0111.5 10h4a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5h-4a1.5 1.5 0 01-1.5-1.5v-4z" />
                  <path d="M9 9l2 2M9 11l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </LayoutIconButton>
            )}
          </div>
        </div>
        {showGrouping && (
        <div>
          <div className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Group
          </div>
          <div className="flex gap-1">
            <LayoutIconButton
              active={groupingMode === 'none'}
              title="No grouping"
              onClick={() => onChangeGroupingMode('none')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 4.5A1.5 1.5 0 015.5 3h9A1.5 1.5 0 0116 4.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 014 13.5v-9z" />
                <path d="M5 15L15 5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </LayoutIconButton>
            <LayoutIconButton
              active={groupingMode === 'connected-component'}
              title="Group by connected component"
              onClick={() => onChangeGroupingMode('connected-component')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
                <circle cx="5" cy="6" r="2.2" />
                <circle cx="15" cy="6" r="2.2" />
                <circle cx="10" cy="14" r="2.2" />
                <path d="M7 7.5l2 4M13 7.5l-2 4M7.2 6h5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </LayoutIconButton>
            <LayoutIconButton
              active={groupingMode === 'filename-prefix'}
              title="Group by filename prefix"
              onClick={() => onChangeGroupingMode('filename-prefix')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 5.5A1.5 1.5 0 014.5 4h4l1.2 1.5h6.8A1.5 1.5 0 0118 7v7.5a1.5 1.5 0 01-1.5 1.5h-12A1.5 1.5 0 013 14.5v-9z" />
                <path d="M6 9.25A1.25 1.25 0 017.25 8h2.5A1.25 1.25 0 0111 9.25v1.5A1.25 1.25 0 019.75 12h-2.5A1.25 1.25 0 016 10.75v-1.5zM12 9.25A1.25 1.25 0 0113.25 8h.5A1.25 1.25 0 0115 9.25v1.5A1.25 1.25 0 0113.75 12h-.5A1.25 1.25 0 0112 10.75v-1.5z" fill="white" />
              </svg>
            </LayoutIconButton>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default CanvasLayoutControls;
