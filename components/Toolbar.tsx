/**
 * @file Toolbar.tsx
 * @description Main application toolbar (~250 lines).
 * Key features: file operations (save), undo/redo, canvas controls (tidy, sticky note),
 * run/stop Ren'Py game, diagnostics error count badge, drafting-mode toggle, settings access.
 * Integration: sits at the top of `App.tsx`; receives save status, dirty-state sets, canvas type,
 * and all action callbacks directly from `App.tsx` state.
 */
import React, { useMemo } from 'react';
import logo from '../renide-512x512.png';
type SaveStatus = 'saving' | 'saved' | 'error';

interface ToolbarProps {
  activeCanvasType: 'story' | 'route' | 'choice' | null;
  projectRootPath: string | null;
  dirtyBlockIds: Set<string>;
  dirtyEditors: Set<string>;
  hasUnsavedSettings: boolean;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  addBlock: () => void;
  handleTidyUp: () => void;
  handleSave: () => void;
  onOpenSettings: () => void;
  onOpenStaticTab: (type: 'canvas' | 'route-canvas' | 'choice-canvas' | 'stats' | 'diagnostics') => void;
  diagnosticsErrorCount: number;
  /** null = disabled (no canvas active that supports notes) */
  onAddStickyNote: (() => void) | null;
  isGameRunning: boolean;
  onRunGame: () => void;
  onStopGame: () => void;
  isRenpyPathValid: boolean;
  draftingMode: boolean;
  onToggleDraftingMode: (enabled: boolean) => void;
  /** Hide undo/redo buttons when a composer tab owns its own undo stack */
  hideUndoRedo?: boolean;
}

const ToolbarButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: 'default' | 'primary';
}> = ({ children, variant = 'default', ...props }) => {
  const childrenArray = React.Children.toArray(children);
  const hasText = childrenArray.some(child => typeof child === 'string' || (React.isValidElement(child) && child.type === 'span'));
  const layoutClass = hasText ? 'px-3 py-2 space-x-2' : 'p-2';
  const variantClass = variant === 'primary'
    ? 'btn-primary'
    : 'bg-tertiary hover:bg-tertiary-hover text-primary disabled:opacity-50 disabled:cursor-not-allowed';
  return (
    <button
      {...props}
      className={`flex items-center justify-center rounded-md text-sm font-medium transition-colors ${variantClass} ${layoutClass} ${props.className || ''}`}
    >
      {children}
    </button>
  );
};

const Toolbar: React.FC<ToolbarProps> = ({
  projectRootPath,
  activeCanvasType,
  dirtyBlockIds,
  dirtyEditors,
  hasUnsavedSettings,
  saveStatus,
  canUndo,
  canRedo,
  undo,
  redo,
  addBlock,
  handleTidyUp,
  handleSave,
  onOpenSettings,
  onOpenStaticTab,
  diagnosticsErrorCount,
  onAddStickyNote,
  isGameRunning,
  onRunGame,
  onStopGame,
  isRenpyPathValid,
  draftingMode,
  onToggleDraftingMode,
  hideUndoRedo = false,
}) => {

  const totalUnsavedCount = useMemo(() => {
    return new Set([...dirtyBlockIds, ...dirtyEditors]).size;
  }, [dirtyBlockIds, dirtyEditors]);

  const hasUnsavedChanges = totalUnsavedCount > 0 || hasUnsavedSettings;
  const unsavedItemsCount = totalUnsavedCount + (hasUnsavedSettings ? 1 : 0);

  // Redraw is only meaningful for story and route canvases
  const canRedraw = activeCanvasType === 'story' || activeCanvasType === 'route';
  const redrawLabel = activeCanvasType === 'route' ? 'Route' : 'Story';

  const SaveStatusIndicator: React.FC = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <div className="flex items-center space-x-2 text-sm text-secondary">
            <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Saving...</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center space-x-2 text-sm text-red-600 dark:text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
            <span>Save Error</span>
          </div>
        );
      default:
        return null;
    }
  };

  // Shared style for canvas switcher buttons
  const canvasBtn = (active: boolean) =>
    `flex items-center justify-center p-2 transition-colors border-r last:border-r-0 border-gray-200 dark:border-gray-600 ${
      active
        ? 'bg-indigo-600 text-white'
        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`;

  return (
    <header className="flex-shrink-0 h-16 bg-header border-b border-primary relative flex items-center px-6 z-30">

      {/* ── Far left: logo ── */}
      <img src={logo} alt="Ren'IDE Logo" className="h-12 w-auto shrink-0" />
      <div className="h-6 w-px bg-primary shrink-0 ml-3" />

      {/* ── Absolutely centered: editing tools + canvas switcher ── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
        {!hideUndoRedo && (<>
          <ToolbarButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
          </ToolbarButton>
          <ToolbarButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </ToolbarButton>
          <div className="h-6 w-px bg-primary shrink-0" />
        </>)}

        <ToolbarButton onClick={addBlock} title="New Scene (N)" variant="primary" data-tutorial="new-scene-button">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={onAddStickyNote ?? undefined}
          disabled={!onAddStickyNote}
          title={onAddStickyNote ? 'Leave a Note on active canvas' : 'Open a canvas to add notes'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" /></svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={canRedraw ? handleTidyUp : undefined}
          disabled={!canRedraw}
          title={canRedraw ? `Organize ${redrawLabel} Layout` : 'No active canvas to organize'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M7.5 12l3 3m-3-3l-3 3" /></svg>
        </ToolbarButton>
        <div className="h-6 w-px bg-primary shrink-0" />

        <ToolbarButton onClick={() => onOpenStaticTab('diagnostics')} title="Diagnostics" aria-label="Diagnostics">
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {diagnosticsErrorCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 px-1 py-px text-[9px] font-bold bg-red-500 text-white rounded-full min-w-[14px] text-center leading-tight">
                {diagnosticsErrorCount}
              </span>
            )}
          </div>
        </ToolbarButton>

        <ToolbarButton onClick={() => onOpenStaticTab('stats')} title="Script Statistics" aria-label="Script Statistics">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
        </ToolbarButton>

        <div className="h-6 w-px bg-primary shrink-0" />

        {/* Canvas switcher */}
        <div
          className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm"
          role="group"
          aria-label="Switch canvas"
          data-tutorial="canvas-tabs"
        >
          <button
            onClick={() => onOpenStaticTab('canvas')}
            className={canvasBtn(activeCanvasType === 'story')}
            title="Project Canvas — bird's-eye view of your script files"
            aria-pressed={activeCanvasType === 'story'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={() => onOpenStaticTab('route-canvas')}
            className={canvasBtn(activeCanvasType === 'route')}
            title="Flow Canvas — trace your story's narrative flow"
            aria-pressed={activeCanvasType === 'route'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-9 5.25-9-5.25v-2.25" />
            </svg>
          </button>
          <button
            onClick={() => onOpenStaticTab('choice-canvas')}
            className={canvasBtn(activeCanvasType === 'choice')}
            title="Choices Canvas — player decision tree"
            aria-pressed={activeCanvasType === 'choice'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18a2.25 2.25 0 002.25 2.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Right section: mode toggles + run + save ── */}
      <div className="ml-auto flex items-center space-x-3">
        {/* Drafting Mode Toggle */}
        <div className="flex items-center space-x-1.5 mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 shrink-0 ${draftingMode ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
          </svg>
          <button
            onClick={() => onToggleDraftingMode(!draftingMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${draftingMode ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
            title={draftingMode ? 'Drafting Mode: ON — click to disable' : 'Drafting Mode: OFF — click to enable'}
            aria-label={draftingMode ? 'Disable Drafting Mode' : 'Enable Drafting Mode'}
          >
            <span className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform ${draftingMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {isGameRunning ? (
          <button onClick={onStopGame} title="Stop Game" aria-label="Stop Game" className="flex items-center justify-center rounded-md text-sm font-medium p-2 bg-red-600 hover:bg-red-700 text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          </button>
        ) : (
          <button onClick={onRunGame} disabled={!projectRootPath || !isRenpyPathValid} title="Run Project (F5)" aria-label="Run Project" className="flex items-center justify-center rounded-md text-sm font-medium p-2 bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
          </button>
        )}
        <div className="h-6 w-px bg-primary" />

        <ToolbarButton
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
          variant={hasUnsavedChanges ? 'primary' : 'default'}
          title={
            !hasUnsavedChanges
              ? 'No changes to save'
              : `Save All (${unsavedItemsCount} unsaved change${unsavedItemsCount === 1 ? '' : 's'}) (Ctrl+S)`
          }
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v4.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5-.5H7a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5h2V2H2z"/>
            <path d="M4.5 12a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5-.5h-3z"/>
          </svg>
        </ToolbarButton>

        <SaveStatusIndicator />

        <ToolbarButton onClick={onOpenSettings} title="Settings" aria-label="Settings">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </ToolbarButton>
      </div>
    </header>
  );
};

export default Toolbar;
