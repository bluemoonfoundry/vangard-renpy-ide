
import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { Theme } from '../types';
import logo from '../vangard-renide-512x512.png';

type SaveStatus = 'saving' | 'saved' | 'error';

interface ToolbarProps {
  directoryHandle: FileSystemDirectoryHandle | null;
  projectRootPath: string | null;
  dirtyBlockIds: Set<string>;
  dirtyEditors: Set<string>;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  addBlock: () => void;
  handleTidyUp: () => void;
  onAnalyzeRoutes: () => void;
  onRequestNewProject: () => void;
  requestOpenFolder: () => void;
  handleSave: () => void;
  onOpenSettings: () => void;
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: (open: boolean) => void;
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: (open: boolean) => void;
  onOpenStaticTab: (type: 'canvas' | 'route-canvas') => void;
  onAddStickyNote: () => void;
  isGameRunning: boolean;
  onRunGame: () => void;
  onStopGame: () => void;
  onToggleSearch: () => void;
}

const ToolbarButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; }> = ({ children, ...props }) => {
  const childrenArray = React.Children.toArray(children);
  const hasText = childrenArray.some(child => typeof child === 'string' || (React.isValidElement(child) && child.type === 'span'));
  
  const layoutClass = hasText ? 'px-3 py-1.5 space-x-2' : 'p-2';

  return (
    <button
      {...props}
      className={`flex items-center justify-center rounded-md text-sm font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${layoutClass}`}
    >
      {children}
    </button>
  );
};

const Toolbar: React.FC<ToolbarProps> = ({
  directoryHandle,
  projectRootPath,
  dirtyBlockIds,
  dirtyEditors,
  saveStatus,
  canUndo,
  canRedo,
  undo,
  redo,
  addBlock,
  handleTidyUp,
  onAnalyzeRoutes,
  onRequestNewProject,
  requestOpenFolder,
  handleSave,
  onOpenSettings,
  isLeftSidebarOpen,
  setIsLeftSidebarOpen,
  isRightSidebarOpen,
  setIsRightSidebarOpen,
  onOpenStaticTab,
  onAddStickyNote,
  isGameRunning,
  onRunGame,
  onStopGame,
  onToggleSearch,
}) => {

  const totalUnsavedCount = useMemo(() => {
    return new Set([...dirtyBlockIds, ...dirtyEditors]).size;
  }, [dirtyBlockIds, dirtyEditors]);

  const SaveStatusIndicator: React.FC = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Saving...</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            <span>Saved</span>
          </div>
        );
      case 'error':
        return (
           <div className="flex items-center space-x-2 text-sm text-red-600 dark:text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
            <span>Save Error</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <header className="flex-shrink-0 h-16 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 z-30">
      <div className="flex items-center space-x-4">
        <img src={logo} alt="Ren'Py Visual Novel Accelerator Logo" className="h-12 w-auto" />
      </div>

      <div className="flex items-center space-x-2">
        <ToolbarButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        </ToolbarButton>
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
        <ToolbarButton onClick={addBlock} title="Add New Block (N)">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            <span>Add Block</span>
        </ToolbarButton>
        <ToolbarButton onClick={onAddStickyNote} title="Add Sticky Note">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" /></svg>
            <span>Add Note</span>
        </ToolbarButton>
        <ToolbarButton onClick={handleTidyUp} title="Tidy Up Layout">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            <span>Tidy Up</span>
        </ToolbarButton>
         <ToolbarButton onClick={onAnalyzeRoutes} title="Analyze Label Routes">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 4a1 1 0 00-1.447-.894l-5 2.5a1 1 0 000 1.789l5 2.5A1 1 0 0015 9V4zM5 4a1 1 0 00-1.447-.894l-5 2.5a1 1 0 000 1.789l5 2.5A1 1 0 005 9V4z" opacity=".5"/><path d="M15 11a1 1 0 00-1.447-.894l-5 2.5a1 1 0 000 1.789l5 2.5A1 1 0 0015 16v-5z" /></svg>
            <span>Analyze Routes</span>
        </ToolbarButton>
      </div>

      <div className="flex items-center space-x-2">
        {isGameRunning ? (
            <button onClick={onStopGame} title="Stop Game" className="flex items-center justify-center rounded-md text-sm font-medium px-3 py-1.5 space-x-2 bg-red-600 hover:bg-red-700 text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <span>Stop</span>
            </button>
        ) : (
            <button onClick={onRunGame} disabled={!projectRootPath} title="Run Project (F5)" className="flex items-center justify-center rounded-md text-sm font-medium px-3 py-1.5 space-x-2 bg-green-600 hover:bg-green-700 text-white disabled:bg-green-400 dark:disabled:bg-green-800 disabled:cursor-not-allowed transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                <span>Run</span>
            </button>
        )}
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

        <ToolbarButton
            onClick={handleSave}
            disabled={totalUnsavedCount === 0}
            title={
                totalUnsavedCount === 0
                ? 'No changes to save'
                : `Save All (${totalUnsavedCount} unsaved)`
            }
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v4.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5-.5H7a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5h2V2H2z"/>
                <path d="M4.5 12a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5-.5h-3z"/>
            </svg>
        </ToolbarButton>

        <SaveStatusIndicator />

        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
        <ToolbarButton onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} title="Toggle Left Sidebar">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm4 2a1 1 0 011-1h6a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={onToggleSearch} title="Search (Ctrl+Shift+F)">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
        </ToolbarButton>
         <ToolbarButton onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} title="Toggle Right Sidebar">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" style={{ transform: 'scaleX(-1)' }}><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm4 2a1 1 0 011-1h6a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={onOpenSettings} title="Open Settings">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734-2.106-2.106a1.532 1.532 0 01-.947-2.287c1.561-.379-1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
        </ToolbarButton>
      </div>
    </header>
  );
};

export default Toolbar;
