
import React from 'react';

type SaveStatus = 'saving' | 'saved' | 'error';
type Theme = 'system' | 'light' | 'dark';

interface ToolbarProps {
  directoryHandle: FileSystemDirectoryHandle | null;
  dirtyBlockIds: Set<string>;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  addBlock: () => void;
  handleTidyUp: () => void;
  requestOpenFolder: () => void;
  handleSave: () => void;
  handleDownloadFiles: () => void;
  onUploadClick: () => void;
  setIsClearConfirmVisible: (visible: boolean) => void;
  theme: Theme;
  toggleTheme: () => void;
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: (open: boolean) => void;
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: (open: boolean) => void;
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
  dirtyBlockIds,
  saveStatus,
  canUndo,
  canRedo,
  undo,
  redo,
  addBlock,
  handleTidyUp,
  requestOpenFolder,
  handleSave,
  handleDownloadFiles,
  onUploadClick,
  setIsClearConfirmVisible,
  theme,
  toggleTheme,
  isLeftSidebarOpen,
  setIsLeftSidebarOpen,
  isRightSidebarOpen,
  setIsRightSidebarOpen,
}) => {

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

  const ThemeIcon: React.FC = () => {
    if (theme === 'dark') return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>;
    if (theme === 'light') return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 14.464A1 1 0 106.465 13.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zm-.707-10.607a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z" clipRule="evenodd" /></svg>;
    return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>;
  };

  return (
    <header className="flex-shrink-0 h-16 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 z-30">
      <div className="flex items-center space-x-4">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200">Ren'Py Visual Novel Accelerator</h1>
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
        </ToolbarButton>
        <ToolbarButton onClick={handleTidyUp} title="Tidy Up Layout">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
        </ToolbarButton>
      </div>

      <div className="flex items-center space-x-2">
         <ToolbarButton onClick={requestOpenFolder} title="Open Project Folder">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
        </ToolbarButton>
       
        <ToolbarButton
            onClick={handleSave}
            disabled={!directoryHandle || dirtyBlockIds.size === 0}
            title={
                !directoryHandle
                ? 'Open a project folder to enable saving to files'
                : dirtyBlockIds.size === 0
                ? 'No changes to save'
                : `Save All (${dirtyBlockIds.size} unsaved)`
            }
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v4.5h2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5h2V2H2z"/>
                <path d="M4.5 12a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-3z"/>
            </svg>
        </ToolbarButton>

        <SaveStatusIndicator />

        {!directoryHandle && (
            <>
                <ToolbarButton onClick={handleDownloadFiles} title="Download Project as .zip">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </ToolbarButton>
                <ToolbarButton onClick={onUploadClick} title="Upload a .zip project">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 16h12v2H4v-2zm4-12v8H4l6-6 6 6h-4V4H8z"/></svg>
                </ToolbarButton>
                <ToolbarButton onClick={() => setIsClearConfirmVisible(true)} title="Clear entire canvas">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                </ToolbarButton>
            </>
        )}
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
        <ToolbarButton onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} title="Toggle Left Sidebar">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm4 2a1 1 0 011-1h6a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
        </ToolbarButton>
         <ToolbarButton onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} title="Toggle Right Sidebar">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" style={{ transform: 'scaleX(-1)' }}><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm4 2a1 1 0 011-1h6a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={toggleTheme} title={`Change theme (Current: ${theme})`}>
            <ThemeIcon />
        </ToolbarButton>
      </div>
    </header>
  );
};

export default Toolbar;
