

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import StoryCanvas from './components/StoryCanvas';
import EditorView from './components/EditorView';
import ImageEditorView from './components/ImageEditorView';
import AudioEditorView from './components/AudioEditorView';
import CharacterEditorView from './components/CharacterEditorView';
import ConfirmModal from './components/ConfirmModal';
import StoryElementsPanel from './components/StoryElementsPanel';
import FileExplorerPanel from './components/FileExplorerPanel';
import Toast from './components/Toast';
import { useRenpyAnalysis, performRenpyAnalysis } from './hooks/useRenpyAnalysis';
import { useHistory } from './hooks/useHistory';
import type { Block, Position, BlockGroup, Link, Character, Variable, ProjectImage, ImageMetadata, RenpyAudio, AudioMetadata, EditorTab, RenpyScreen, FileSystemTreeNode, ToastMessage } from './types';
import JSZip from 'jszip';
import { produce } from 'https://aistudiocdn.com/immer@^10.1.1';

// Add all necessary FS API types to the global scope to fix compilation issues
// and make them available throughout the app, including in the types.ts file.
declare global {
  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: any): Promise<void>;
    close(): Promise<void>;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
    createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  }

  interface AIStudio {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }

  interface Window {
    aistudio?: AIStudio;
    // Add the standard File System Access API method to the window type
    showDirectoryPicker?(): Promise<FileSystemDirectoryHandle>;
  }
}

const SAVE_KEY_BLOCKS = 'renpy-visual-editor-blocks';
const SAVE_KEY_GROUPS = 'renpy-visual-editor-groups';
const IDE_SETTINGS_FILE = 'game/project.ide.json';

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
  );
}

type Theme = 'system' | 'light' | 'dark';
type SaveStatus = 'saving' | 'saved' | 'error';
type AppState = { blocks: Block[], groups: BlockGroup[] };
export type ClipboardState = { type: 'copy' | 'cut'; paths: Set<string> } | null;


const WelcomeScreen: React.FC<{
  onOpenFolder: () => void;
  onStartInBrowser: () => void;
  onUpload: () => void;
  isFileSystemApiSupported: boolean;
}> = ({ onOpenFolder, onStartInBrowser, onUpload, isFileSystemApiSupported }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-2xl w-full text-center border border-gray-200 dark:border-gray-700 transform transition-all animate-fade-in-up">
        <style>{`
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up {
            animation: fade-in-up 0.5s ease-out forwards;
          }
        `}</style>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Welcome!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Visually create and connect your Ren'Py story blocks. Get started by opening your project folder.
        </p>
        <div className="space-y-4">
          <button
            onClick={onOpenFolder}
            disabled={!isFileSystemApiSupported}
            title={isFileSystemApiSupported ? "Open a local Ren'Py project folder" : "Your browser does not support the File System Access API."}
            className="w-full text-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg transition duration-200 flex items-center justify-center space-x-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
            <span>Open Project Folder</span>
          </button>
          <div className="flex items-center space-x-4">
            <button
              onClick={onUpload}
              className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 16h12v2H4v-2zm4-12v8H4l6-6 6 6h-4V4H8z"/></svg>
              <span>Upload .zip Project</span>
            </button>
            <button
              onClick={onStartInBrowser}
              className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center space-x-2"
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
               <span>Continue in Browser</span>
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
          Using <strong>Open Project Folder</strong> is recommended for the best experience, allowing you to save directly to your files.
        </p>
      </div>
    </div>
  );
};


// Wrap the file system API check in a try-catch block to prevent runtime errors
// in environments where accessing the APIs might be restricted.
const isFileSystemApiSupported = (() => {
  try {
    // Check for the standard browser API or the AI Studio specific one.
    return !!(window.showDirectoryPicker || (window.aistudio && window.aistudio.showDirectoryPicker));
  } catch (e) {
    console.warn("Could not access file system APIs, features disabled.", e);
    return false;
  }
})();

const loadInitialState = (): AppState => {
  try {
    const savedBlocks = localStorage.getItem(SAVE_KEY_BLOCKS);
    const savedGroups = localStorage.getItem(SAVE_KEY_GROUPS);
    return {
      blocks: savedBlocks ? JSON.parse(savedBlocks) : [],
      groups: savedGroups ? JSON.parse(savedGroups) : [],
    };
  } catch (e) {
    console.error("Failed to load state from local storage", e);
    return { blocks: [], groups: [] };
  }
};

const fileToDataUrl = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper function to build a file tree from a list of paths
function buildFileTreeFromPaths(paths: string[]): FileSystemTreeNode {
    const root: FileSystemTreeNode = { name: 'Project', path: '', children: [] };
    const uniquePaths = Array.from(new Set(paths));

    uniquePaths.forEach(path => {
        let currentNode = root;
        const parts = path.split('/');
        parts.forEach((part, index) => {
            if (!currentNode.children) {
                currentNode.children = [];
            }
            let childNode = currentNode.children.find(child => child.name === part);
            if (!childNode) {
                const isDir = index < parts.length - 1;
                childNode = {
                    name: part,
                    path: parts.slice(0, index + 1).join('/'),
                    ...(isDir && { children: [] }),
                };
                currentNode.children.push(childNode);
            }
            currentNode = childNode;
        });
    });
    
    // Sort children at each level (directories first, then alphabetically)
    const sortChildren = (node: FileSystemTreeNode) => {
        if (node.children) {
            node.children.sort((a, b) => {
                if (a.children && !b.children) return -1;
                if (!a.children && b.children) return 1;
                return a.name.localeCompare(b.name);
            });
            node.children.forEach(sortChildren);
        }
    };
    sortChildren(root);

    return root;
}

// Helper function to build a file tree from a FileSystemDirectoryHandle
async function buildTreeFromHandle(dirHandle: FileSystemDirectoryHandle): Promise<FileSystemTreeNode> {
    const root: FileSystemTreeNode = { name: dirHandle.name, path: '', children: [] };
    
    async function traverse(handle: FileSystemDirectoryHandle, node: FileSystemTreeNode) {
        const children: FileSystemTreeNode[] = [];
        for await (const entry of handle.values()) {
            const newPath = node.path ? `${node.path}/${entry.name}` : entry.name;
            if (entry.kind === 'directory') {
                const dirNode: FileSystemTreeNode = { name: entry.name, path: newPath, children: [] };
                await traverse(entry, dirNode);
                children.push(dirNode);
            } else {
                children.push({ name: entry.name, path: newPath });
            }
        }
        // Sort children
        children.sort((a, b) => {
            if (a.children && !b.children) return -1;
            if (!a.children && b.children) return 1;
            return a.name.localeCompare(b.name);
        });
        node.children = children;
    }

    await traverse(dirHandle, root);
    return root;
}

// Helper to add a node to the file tree immutably, creating parent directories if needed.
const addNodeToFileTree = (tree: FileSystemTreeNode, path: string, type: 'file' | 'folder' = 'file'): FileSystemTreeNode => {
    // Check if path already exists to prevent duplicates
    const checkIfExists = (node: FileSystemTreeNode, path: string): boolean => {
        if (node.path === path) return true;
        if (node.children) {
            return node.children.some(child => checkIfExists(child, path));
        }
        return false;
    };
    if (checkIfExists(tree, path)) return tree;

    return produce(tree, draft => {
        let currentNode = draft;
        const parts = path.split('/');

        parts.forEach((part, index) => {
            if (!currentNode.children) {
                currentNode.children = [];
            }
            let childNode = currentNode.children.find(child => child.name === part);
            if (!childNode) {
                const isLastPart = index === parts.length - 1;
                // A node is a directory if it's not the last part of the path,
                // OR if it IS the last part and the type is 'folder'.
                const isDir = !isLastPart || (isLastPart && type === 'folder');
                
                childNode = {
                    name: part,
                    path: parts.slice(0, index + 1).join('/'),
                    ...(isDir && { children: [] }),
                };
                currentNode.children.push(childNode);
                // Keep it sorted
                currentNode.children.sort((a, b) => {
                    if (a.children && !b.children) return -1;
                    if (!a.children && b.children) return 1;
                    return a.name.localeCompare(b.name);
                });
            }
            currentNode = childNode;
        });
    });
};

// Helper to remove a node from the file tree immutably.
const removeNodeFromFileTree = (tree: FileSystemTreeNode | null, path: string): FileSystemTreeNode | null => {
    if (!tree) return null;

    return produce(tree, draft => {
        const parts = path.split('/');
        let currentNode = draft;

        // Traverse to the parent directory.
        for (let i = 0; i < parts.length - 1; i++) {
            if (!currentNode.children) return; // Path does not exist.
            const nextNode = currentNode.children.find(child => child.name === parts[i]);
            if (!nextNode) return; // Path does not exist.
            currentNode = nextNode;
        }

        // Find and remove the target node.
        if (currentNode.children) {
            const nodeNameToRemove = parts[parts.length - 1];
            const index = currentNode.children.findIndex(child => child.name === nodeNameToRemove);
            if (index > -1) {
                currentNode.children.splice(index, 1);
            }
        }
    });
};


const App: React.FC = () => {
  const { 
    state: historyState, 
    setState: setHistory, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<AppState>(loadInitialState());

  const [liveBlocks, setLiveBlocks] = useState<Block[]>(historyState.blocks);
  const [liveGroups, setLiveGroups] = useState<BlockGroup[]>(historyState.groups);
  
  useEffect(() => {
    setLiveBlocks(historyState.blocks);
    setLiveGroups(historyState.groups);
  }, [historyState]);

  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>('system');
  const [isClearConfirmVisible, setIsClearConfirmVisible] = useState(false);
  const [analysisTrigger, setAnalysisTrigger] = useState(0);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimeoutRef = useRef<number | null>(null);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(384);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256);
  const [findUsagesHighlightIds, setFindUsagesHighlightIds] = useState<Set<string> | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [imageScanDirectories, setImageScanDirectories] = useState<Map<string, FileSystemDirectoryHandle>>(new Map());
  const [audioScanDirectories, setAudioScanDirectories] = useState<Map<string, FileSystemDirectoryHandle>>(new Map());
  const [dirtyBlockIds, setDirtyBlockIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadConfirm, setUploadConfirm] = useState<{ visible: boolean, file: File | null }>({ visible: false, file: null });
  const [openFolderConfirmVisible, setOpenFolderConfirmVisible] = useState(false);
  const [projectImages, setProjectImages] = useState<Map<string, ProjectImage>>(new Map());
  const [imageMetadata, setImageMetadata] = useState<Map<string, ImageMetadata>>(new Map());
  const [projectAudios, setProjectAudios] = useState<Map<string, RenpyAudio>>(new Map());
  const [audioMetadata, setAudioMetadata] = useState<Map<string, AudioMetadata>>(new Map());
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([{ id: 'canvas', type: 'canvas' }]);
  const [activeTabId, setActiveTabId] = useState<string>('canvas');
  const [dirtyEditors, setDirtyEditors] = useState<Set<string>>(new Set());
  const [saveTrigger, setSaveTrigger] = useState(0);
  const [canvasFilters, setCanvasFilters] = useState({ story: true, screens: true, config: false });
  const [isWelcomeScreenVisible, setIsWelcomeScreenVisible] = useState(false);
  const [fileTree, setFileTree] = useState<FileSystemTreeNode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean, blockIds?: string[], filePaths?: string[], message?: string, warning?: string }>({ visible: false });
  const [clipboard, setClipboard] = useState<ClipboardState>(null);
  const [centerOnBlockRequest, setCenterOnBlockRequest] = useState<{ blockId: string, key: number } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(currentToasts => currentToasts.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = uuidv4();
    setToasts(currentToasts => [...currentToasts, { id, message, type }]);
  }, []);

  useEffect(() => {
    // If there's nothing in storage and no folder is open, show welcome.
    if (!directoryHandle && historyState.blocks.length === 0 && historyState.groups.length === 0) {
      setIsWelcomeScreenVisible(true);
    }
  }, []); // Empty dependency array means this runs only once on mount.

  const analysisResult = useRenpyAnalysis(liveBlocks, analysisTrigger);

  const activeTab = useMemo(() => openTabs.find(t => t.id === activeTabId) ?? openTabs[0], [openTabs, activeTabId]);
  const activeEditorBlock = useMemo(() => {
    if (activeTab?.type === 'editor') {
      return liveBlocks.find(b => b.id === activeTab.blockId);
    }
    return undefined;
  }, [activeTab, liveBlocks]);

  const commitChange = useCallback((newState: AppState, dirtyIds: string[] = []) => {
    setLiveBlocks(newState.blocks);
    setLiveGroups(newState.groups);
    setHistory(newState);
    if (dirtyIds.length > 0) {
      setDirtyBlockIds(prev => new Set([...prev, ...dirtyIds]));
    }
  }, [setHistory]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (!directoryHandle) { // Only auto-save to localStorage if not using File System API
      setSaveStatus('saving');
      saveTimeoutRef.current = window.setTimeout(() => {
        try {
          const blocksToSave = historyState.blocks.map(({ fileHandle, ...rest }) => rest);
          localStorage.setItem(SAVE_KEY_BLOCKS, JSON.stringify(blocksToSave));
          localStorage.setItem(SAVE_KEY_GROUPS, JSON.stringify(historyState.groups));
          setSaveStatus('saved');
        } catch (e) { console.error("Failed to save state to local storage", e); }
      }, 1000);
    }
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [historyState, directoryHandle]);


  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    const root = window.document.documentElement;
    if (effectiveTheme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [effectiveTheme]);
  
  const requestDelete = useCallback((blockIds: string[], filePaths: string[]) => {
    const allBlockIds = new Set(blockIds);
    const allFilePaths = new Set<string>(filePaths || []);

    filePaths?.forEach(path => {
        const block = liveBlocks.find(b => b.filePath === path);
        if (block) allBlockIds.add(block.id);
    });

    blockIds.forEach(id => {
        const block = liveBlocks.find(b => b.id === id);
        if (block?.filePath) allFilePaths.add(block.filePath);
    });
    
    const filesInvolved = Array.from(allFilePaths).map(p => p.split('/').pop() || p).join(', ');
    const numBlocks = allBlockIds.size;
    
    setDeleteConfirm({
        visible: true,
        blockIds: Array.from(allBlockIds),
        filePaths: Array.from(allFilePaths),
        message: `Delete ${numBlocks > 0 ? numBlocks + ' block(s)' : ''} and ${allFilePaths.size > 0 ? allFilePaths.size + ' file(s)/folder(s)' : ''}: ${filesInvolved}?`,
        warning: directoryHandle ? "This will permanently delete items from your project folder." : "This action cannot be undone."
    });
  }, [liveBlocks, directoryHandle]);

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.visible) return;
    const { blockIds, filePaths } = deleteConfirm;

    const blockIdsToDelete = new Set(blockIds || []);
    const filePathsToDelete = new Set<string>(filePaths || []);

    // If filePaths are given, find corresponding block IDs
    filePathsToDelete.forEach(path => {
        const block = liveBlocks.find(b => b.filePath === path);
        if (block) blockIdsToDelete.add(block.id);
    });
    // If blockIds are given, find corresponding file paths
    blockIdsToDelete.forEach(id => {
        const block = liveBlocks.find(b => b.id === id);
        if (block?.filePath) filePathsToDelete.add(block.filePath);
    });

    // 1. Delete files from disk if applicable
    if (directoryHandle && filePathsToDelete.size > 0) {
        for (const path of filePathsToDelete) {
            try {
                const pathParts = path.split('/');
                const fileName = pathParts.pop()!;
                if (!fileName) continue;
                let currentDir = directoryHandle;
                 // Traverse to parent directory
                for (let i = 0; i < pathParts.length; i++) {
                    currentDir = await currentDir.getDirectoryHandle(pathParts[i]);
                }
                await currentDir.removeEntry(fileName, { recursive: true });
            } catch (err) {
                console.error(`Failed to delete file ${path} from disk:`, err);
            }
        }
    }
    
    const finalBlockIds = Array.from(blockIdsToDelete);
    const newBlocks = liveBlocks.filter(b => !finalBlockIds.includes(b.id));
    const newGroups = liveGroups
      .map(group => ({ ...group, blockIds: group.blockIds.filter(id => !finalBlockIds.includes(id))}))
      .filter(group => group.blockIds.length > 0);
    
    commitChange({ blocks: newBlocks, groups: newGroups });

    // Update file tree by removing deleted paths
    if (fileTree && filePathsToDelete.size > 0) {
        let currentTree = fileTree;
        for (const path of filePathsToDelete) {
            currentTree = removeNodeFromFileTree(currentTree, path);
        }
        setFileTree(currentTree);
    }
    
    setDirtyBlockIds(prev => {
        const newDirty = new Set(prev);
        finalBlockIds.forEach(id => newDirty.delete(id));
        return newDirty;
    });
    setSelectedBlockIds([]);
    setSelectedGroupIds([]);
    setOpenTabs(tabs => tabs.filter(t => t.blockId ? !finalBlockIds.includes(t.blockId) : true));
    
    setDeleteConfirm({ visible: false });
  };
  
  const handleOpenEditorTab = useCallback((blockId: string, line?: number) => {
    const existingTab = openTabs.find(t => t.blockId === blockId);
    if (existingTab) {
        setActiveTabId(existingTab.id);
        if (line) {
            setOpenTabs(tabs => tabs.map(t => 
                t.id === existingTab.id ? { ...t, scrollRequest: { line, key: Date.now() } } : t
            ));
        }
    } else {
        const newTab: EditorTab = { id: blockId, type: 'editor', blockId };
        if (line) {
            newTab.scrollRequest = { line, key: Date.now() };
        }
        setOpenTabs(tabs => [...tabs, newTab]);
        setActiveTabId(newTab.id);
    }
  }, [openTabs]);
  
  const handleOpenImageTab = useCallback((filePath: string) => {
    const existingTab = openTabs.find(t => t.filePath === filePath);
    if (existingTab) {
        setActiveTabId(existingTab.id);
    } else {
        const newTab: EditorTab = { id: filePath, type: 'image', filePath };
        setOpenTabs(tabs => [...tabs, newTab]);
        setActiveTabId(newTab.id);
    }
  }, [openTabs]);

  const handleOpenAudioTab = useCallback((filePath: string) => {
    const existingTab = openTabs.find(t => t.filePath === filePath);
    if (existingTab) {
        setActiveTabId(existingTab.id);
    } else {
        const newTab: EditorTab = { id: filePath, type: 'audio', filePath };
        setOpenTabs(tabs => [...tabs, newTab]);
        setActiveTabId(newTab.id);
    }
  }, [openTabs]);

  const handleOpenCharacterEditor = useCallback((tag: string) => {
    const tabId = `char_editor_${tag}`;
    const existingTab = openTabs.find(t => t.id === tabId);
    if (existingTab) {
        setActiveTabId(tabId);
    } else {
        const newTab: EditorTab = { id: tabId, type: 'character', characterTag: tag };
        setOpenTabs(tabs => [...tabs, newTab]);
        setActiveTabId(newTab.id);
    }
  }, [openTabs]);

  const handleCloseTab = (tabIdToClose: string) => {
      const tabToClose = openTabs.find(t => t.id === tabIdToClose);
      if (!tabToClose) return;

      if (tabToClose.type === 'editor' && tabToClose.blockId && dirtyEditors.has(tabToClose.blockId)) {
        if (!window.confirm("This tab has unsaved changes. Are you sure you want to close it? Changes will be lost.")) {
            return;
        }
      }

      const tabIndex = openTabs.findIndex(t => t.id === tabIdToClose);
      if (tabIndex === -1) return;

      if (activeTabId === tabIdToClose) {
          const nextTab = openTabs[tabIndex - 1] || openTabs.find(t => t.id !== tabIdToClose);
          setActiveTabId(nextTab ? nextTab.id : 'canvas');
      }

      setOpenTabs(tabs => tabs.filter(t => t.id !== tabIdToClose));
      if (tabToClose.type === 'editor' && tabToClose.blockId) {
        setDirtyEditors(prev => {
            const newDirty = new Set(prev);
            newDirty.delete(tabToClose.blockId!);
            return newDirty;
        });
      }
  };
  
  const handleSaveActiveEditor = useCallback(() => {
    if (activeTab?.type === 'editor') {
      setSaveTrigger(t => t + 1);
    }
  }, [activeTab]);

  const handleSaveBlockContent = useCallback((blockId: string, content: string) => {
    if (liveBlocks.find(b => b.id === blockId)?.content === content) return;

    const newBlocks = liveBlocks.map(block => block.id === blockId ? { ...block, content } : block );
    commitChange({ blocks: newBlocks, groups: liveGroups }, [blockId]);
    setDirtyEditors(prev => {
      const newDirty = new Set(prev);
      newDirty.delete(blockId);
      return newDirty;
    });
  }, [liveBlocks, liveGroups, commitChange]);

  const handleEditorDirtyChange = useCallback((blockId: string, isDirty: boolean) => {
    setDirtyEditors(prev => {
        const newDirty = new Set(prev);
        if (isDirty) newDirty.add(blockId);
        else newDirty.delete(blockId);
        return newDirty;
    });
  }, []);

  const addBlock = useCallback(() => {
    let filename = 'game/new_story.rpy';
    let counter = 1;
    const allPaths = new Set(liveBlocks.map(b => b.filePath));
    while (allPaths.has(filename)) {
        filename = `game/new_story_${counter++}.rpy`;
    }

    const newBlock: Block = {
      id: uuidv4(),
      content: 'label new_label:\n    "New block content..."',
      position: { x: 20, y: 20 },
      width: 300,
      height: 120,
      filePath: filename,
    };
    commitChange({ blocks: [...liveBlocks, newBlock], groups: liveGroups }, [newBlock.id]);
    if (fileTree) {
        setFileTree(addNodeToFileTree(fileTree, filename));
    }
    setSelectedBlockIds([newBlock.id]);
    setSelectedGroupIds([]);
    handleOpenEditorTab(newBlock.id);
  }, [liveBlocks, liveGroups, commitChange, handleOpenEditorTab, fileTree]);

    const buildCharacterDefinitionString = (char: Character): string => {
        const args: string[] = [];
        args.push(`'${char.name}'`); // `name` is positional

        // Helper to add arg if value is not undefined/null/empty
        const addArg = (key: string, value: any, isString = true) => {
            if (value === undefined || value === null || value === '') return;
            if (isString) args.push(`${key}="${value}"`);
            else args.push(`${key}=${value}`);
        };
        const addBooleanArg = (key: string, value: any) => {
            if (value === undefined || value === null) return;
            args.push(`${key}=${value ? 'True' : 'False'}`);
        };

        if (char.color) args.push(`color='${char.color}'`);
        addArg('image', char.image);
        addArg('who_style', char.who_style);
        addArg('who_prefix', char.who_prefix);
        addArg('who_suffix', char.who_suffix);
        addArg('what_color', char.what_color, false); // color can be a hex string
        addArg('what_style', char.what_style);
        addArg('what_prefix', char.what_prefix);
        addArg('what_suffix', char.what_suffix);
        addBooleanArg('slow', char.slow);
        addArg('slow_speed', char.slow_speed, false);
        addBooleanArg('slow_abortable', char.slow_abortable);
        addBooleanArg('all_at_once', char.all_at_once);
        addArg('window_style', char.window_style);
        addArg('ctc', char.ctc);
        addArg('ctc_position', char.ctc_position);
        addBooleanArg('interact', char.interact);
        addBooleanArg('afm', char.afm);
        if (char.what_properties) args.push(`what_properties=${char.what_properties}`);
        if (char.window_properties) args.push(`window_properties=${char.window_properties}`);

        let defString = `define ${char.tag} = Character(${args.join(', ')})`;
        if (char.profile) {
            defString = `# profile: ${char.profile}\n${defString}`;
        }
        return defString;
    };
    
    const handleSaveCharacter = useCallback((newCharData: Character, oldTag?: string) => {
        const isNew = !oldTag;
        let newBlocks = [...liveBlocks];
        const dirtyIds = new Set<string>();
        const newDefString = buildCharacterDefinitionString(newCharData);

        if (isNew) {
            const filePath = 'game/characters.rpy';
            let charactersBlock = newBlocks.find(b => b.filePath === filePath);
            if (charactersBlock) {
                dirtyIds.add(charactersBlock.id);
                newBlocks = newBlocks.map(b =>
                    b.id === charactersBlock!.id
                        ? { ...b, content: b.content.trim() + '\n\n' + newDefString }
                        : b
                );
            } else {
                const newBlock: Block = {
                    id: uuidv4(),
                    title: "Characters",
                    content: newDefString,
                    position: { x: 20, y: 20 },
                    width: 350,
                    height: 100,
                    filePath: filePath,
                };
                dirtyIds.add(newBlock.id);
                newBlocks.push(newBlock);
                if (fileTree) {
                    setFileTree(addNodeToFileTree(fileTree, filePath));
                }
            }
        } else { // Existing character
            const oldChar = analysisResult.characters.get(oldTag!);
            if (!oldChar) return;

            const definitionBlock = newBlocks.find(b => b.id === oldChar.definedInBlockId);
            if (definitionBlock) {
                dirtyIds.add(definitionBlock.id);
                const oldDefRegex = new RegExp(`(?:^\\s*#\\s*profile:.*$\\r?\\n)?^\\s*define\\s+${oldTag}\\s*=\\s*Character\\s*\\([\\s\\S]*?\\)$`, "m");
                const newContent = definitionBlock.content.replace(oldDefRegex, newDefString);
                newBlocks = newBlocks.map(b => b.id === definitionBlock.id ? { ...b, content: newContent } : b);
            }

            // Handle tag rename
            if (oldTag !== newCharData.tag) {
                const dialogueLineRegex = new RegExp(`^(\\s*)(${oldTag})(\\s+((?:".*?")|(?:'.*?')))$`, "gm");
                newBlocks = newBlocks.map(b => {
                    if (b.content.match(dialogueLineRegex)) {
                        dirtyIds.add(b.id);
                        return { ...b, content: b.content.replace(dialogueLineRegex, `$1${newCharData.tag}$3`) };
                    }
                    return b;
                });
            }
        }
        commitChange({ blocks: newBlocks, groups: liveGroups }, Array.from(dirtyIds));
        
        // Close the 'new' tab and open one for the real character
        if (isNew) {
             const newTabId = `char_editor_${'new_character'}`;
             setOpenTabs(tabs => tabs.filter(t => t.id !== newTabId));
             handleOpenCharacterEditor(newCharData.tag);
        }
    }, [liveBlocks, liveGroups, commitChange, fileTree, analysisResult.characters, handleOpenCharacterEditor]);


  const handleFindCharacterUsages = useCallback((tag: string) => {
    const blockIds = new Set<string>();
    for (const [blockId, lines] of analysisResult.dialogueLines.entries()) {
      if (lines.some(line => line.tag === tag)) blockIds.add(blockId);
    }
    setFindUsagesHighlightIds(blockIds);
    setActiveTabId('canvas');
  }, [analysisResult.dialogueLines]);
  
  const handleAddVariable = useCallback((variable: Omit<Variable, 'definedInBlockId' | 'line'>) => {
    const definitionString = `${variable.type} ${variable.name} = ${variable.initialValue}`;
    
    const filePath = 'game/variables.rpy';
    let variablesBlock = liveBlocks.find(b => b.filePath === filePath);
    let newBlocks = [...liveBlocks];
    let dirtyId: string;

    if (variablesBlock) {
        dirtyId = variablesBlock.id;
        newBlocks = newBlocks.map(b => 
            b.id === variablesBlock!.id 
            ? { ...b, content: b.content.trim() + '\n' + definitionString } 
            : b
        );
    } else {
        const newBlock: Block = {
            id: uuidv4(),
            title: "Variables",
            content: definitionString,
            position: { x: 40, y: 180 },
            width: 350,
            height: 100,
            filePath: filePath,
        };
        dirtyId = newBlock.id;
        newBlocks.push(newBlock);
        if (fileTree) {
            setFileTree(addNodeToFileTree(fileTree, filePath));
        }
    }
    commitChange({ blocks: newBlocks, groups: liveGroups }, [dirtyId]);
  }, [liveBlocks, liveGroups, commitChange, fileTree]);

  const handleFindVariableUsages = useCallback((variableName: string) => {
    const blockIds = new Set<string>();
    const definition = analysisResult.variables.get(variableName);
    if (definition) blockIds.add(definition.definedInBlockId);
    const usages = analysisResult.variableUsages.get(variableName) || [];
    usages.forEach(usage => blockIds.add(usage.blockId));
    setFindUsagesHighlightIds(blockIds);
    setActiveTabId('canvas');
  }, [analysisResult.variables, analysisResult.variableUsages]);

  const handleAddScreen = useCallback((screenName: string) => {
    const screenContent = `screen ${screenName}():\n    # Add screen language statements here.\n    frame:\n        xalign 0.5\n        yalign 0.5\n        vbox:\n            spacing 10\n            text "Screen: ${screenName}"\n            textbutton "Return" action Return()`;
    
    const filePath = `game/screens/${screenName}.rpy`;
    const newBlock: Block = {
        id: uuidv4(),
        title: `Screen: ${screenName}`,
        content: screenContent,
        position: { x: 40, y: 40 },
        width: 350,
        height: 200,
        filePath: filePath,
    };
    
    commitChange({ blocks: [...liveBlocks, newBlock], groups: liveGroups }, [newBlock.id]);
    if (fileTree) {
        setFileTree(addNodeToFileTree(fileTree, filePath));
    }
    setSelectedBlockIds([newBlock.id]);
    setSelectedGroupIds([]);
    handleOpenEditorTab(newBlock.id);
  }, [liveBlocks, liveGroups, commitChange, handleOpenEditorTab, fileTree]);

  const handleFindScreenDefinition = useCallback((screenName: string) => {
      const screen = analysisResult.screens.get(screenName);
      if (screen) {
          handleOpenEditorTab(screen.definedInBlockId, screen.line);
      }
  }, [analysisResult.screens, handleOpenEditorTab]);

    const updateBlock = useCallback((id: string, newBlockData: Partial<Block>) => {
    const newBlocks = liveBlocks.map(block =>
        block.id === id ? { ...block, ...newBlockData } : block
    );
    setLiveBlocks(newBlocks);
    setDirtyBlockIds(prev => new Set(prev).add(id));
  }, [liveBlocks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActiveEditor();
      } else {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('role') === 'textbox')) {
          return;
        }

        if (isCtrlOrCmd && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } 
        else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); } 
        else if ((selectedBlockIds.length > 0 || selectedGroupIds.length > 0) && (e.key === 'Delete' || e.key === 'Backspace')) {
          e.preventDefault();
          if (selectedBlockIds.length > 0) requestDelete(selectedBlockIds, []);
          if (selectedGroupIds.length > 0) {
              const newGroups = liveGroups.filter(g => !selectedGroupIds.includes(g.id));
              commitChange({ blocks: liveBlocks, groups: newGroups });
              setSelectedGroupIds([]);
          }
        } else if (selectedBlockIds.length === 1 && e.key === 'f') { e.preventDefault(); handleOpenEditorTab(selectedBlockIds[0]); } 
        else if (e.key === 'n') { e.preventDefault(); addBlock(); } 
        else if (e.key === 'g' && !e.shiftKey) {
            e.preventDefault();
            if (selectedGroupIds.length > 0) {
              const blockIdsFromUngrouped = liveGroups.filter(g => selectedGroupIds.includes(g.id)).flatMap(g => g.blockIds);
              const newGroups = liveGroups.filter(g => !selectedGroupIds.includes(g.id));
              commitChange({ blocks: liveBlocks, groups: newGroups });
              setSelectedGroupIds([]);
              setSelectedBlockIds(Array.from(new Set(blockIdsFromUngrouped)));
            } else if (selectedBlockIds.length >= 2) {
              const selected = liveBlocks.filter(b => selectedBlockIds.includes(b.id));
              const PADDING = 40;
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              selected.forEach(b => {
                  minX = Math.min(minX, b.position.x); minY = Math.min(minY, b.position.y);
                  maxX = Math.max(maxX, b.position.x + b.width); maxY = Math.max(maxY, b.position.y + b.height);
              });
              const newGroup: BlockGroup = {
                  id: uuidv4(), title: "New Group", position: { x: minX - PADDING, y: minY - PADDING },
                  width: (maxX - minX) + PADDING * 2, height: (maxY - minY) + PADDING * 2, blockIds: selectedBlockIds
              };
              commitChange({ blocks: liveBlocks, groups: [...liveGroups, newGroup] });
              setSelectedBlockIds([]);
              setSelectedGroupIds([newGroup.id]);
            }
        } else if (e.key === 'G' && e.shiftKey) {
            if (selectedGroupIds.length === 0) return;
            e.preventDefault();
            const blockIdsFromUngrouped = liveGroups.filter(g => selectedGroupIds.includes(g.id)).flatMap(g => g.blockIds);
            const newGroups = liveGroups.filter(g => !selectedGroupIds.includes(g.id));
            commitChange({ blocks: liveBlocks, groups: newGroups });
            setSelectedGroupIds([]);
            setSelectedBlockIds(Array.from(new Set(blockIdsFromUngrouped)));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockIds, selectedGroupIds, requestDelete, handleOpenEditorTab, addBlock, liveBlocks, liveGroups, commitChange, undo, redo, handleSaveActiveEditor]);

  const toggleTheme = () => {
    const themes: Theme[] = ['system', 'light', 'dark'];
    setTheme(themes[(themes.indexOf(theme) + 1) % themes.length]);
  };
  
  const tidyUpLayout = (blocksToLayout: Block[], links: Link[]): Block[] => {
      if (blocksToLayout.length === 0) return [];
      const blockMap = new Map(blocksToLayout.map(b => [b.id, b]));
      const adj = new Map<string, string[]>();
      const inDegree = new Map<string, number>();
      blocksToLayout.forEach(b => { adj.set(b.id, []); inDegree.set(b.id, 0); });
      links.forEach(link => {
          if (adj.has(link.sourceId) && inDegree.has(link.targetId)) {
              adj.get(link.sourceId)!.push(link.targetId);
              inDegree.set(link.targetId, (inDegree.get(link.targetId) || 0) + 1);
          }
      });
      const queue: string[] = [];
      inDegree.forEach((degree, id) => { if (degree === 0) queue.push(id); });
      if (queue.length === 0 && blocksToLayout.length > 0) {
          const nonZero = Array.from(inDegree.entries()).sort(([,a],[,b]) => a - b);
          if (nonZero.length > 0) queue.push(nonZero[0][0]);
      }
      const layers: string[][] = [];
      const visited = new Set<string>();
      while(queue.length > 0){
          const layerSize = queue.length;
          const currentLayer: string[] = [];
          for(let i=0; i<layerSize; i++){
              const u = queue.shift()!;
              if(visited.has(u)) continue;
              visited.add(u);
              currentLayer.push(u);
              for(const v of adj.get(u) || []){
                  inDegree.set(v, inDegree.get(v)! - 1);
                  if(inDegree.get(v)! === 0) queue.push(v);
              }
          }
          if (currentLayer.length > 0) layers.push(currentLayer);
      }
      if (blocksToLayout.length > visited.size) layers.push(blocksToLayout.filter(b => !visited.has(b.id)).map(b => b.id));

      const PADDING_X = 150, PADDING_Y = 50;
      let currentX = 0;
      const newBlocks = [...blocksToLayout];
      for (const layer of layers) {
          let maxLayerWidth = 0, currentLayerHeight = 0;
          layer.forEach(id => {
              const block = blockMap.get(id);
              if (block) { maxLayerWidth = Math.max(maxLayerWidth, block.width); currentLayerHeight += block.height; }
          });
          currentLayerHeight += Math.max(0, layer.length - 1) * PADDING_Y;
          let currentY = -currentLayerHeight / 2;
          for (const id of layer) {
              const block = blockMap.get(id);
              const blockIndex = newBlocks.findIndex(b => b.id === id);
              if (block && blockIndex !== -1) {
                  const xPos = currentX + (maxLayerWidth - block.width) / 2;
                  newBlocks[blockIndex] = { ...block, position: { x: xPos, y: currentY } };
                  currentY += block.height + PADDING_Y;
              }
          }
          currentX += maxLayerWidth + PADDING_X;
      }
      return newBlocks;
  };
  
  const handleTidyUp = () => {
    const newBlocks = tidyUpLayout(liveBlocks, analysisResult.links);
    commitChange({ blocks: newBlocks, groups: liveGroups });
  };
  
  const scanDirectoryForImages = async (dirHandle: FileSystemDirectoryHandle, baseName: string, isProjectScan: boolean) => {
    const newImages = new Map<string, ProjectImage>();
     const scan = async (handle: FileSystemDirectoryHandle, currentPath: string) => {
        for await (const entry of handle.values()) {
            const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
            if (entry.kind === 'file' && /\.(png|jpe?g|webp)$/i.test(entry.name)) {
                const fileHandle = entry as FileSystemFileHandle;
                const file = await fileHandle.getFile();
                const dataUrl = await fileToDataUrl(file);
                // The unique key for an image is its base directory name + its relative path
                const imageKey = `${baseName}/${newPath}`;
                const projectImage: ProjectImage = {
                    filePath: imageKey,
                    fileName: entry.name,
                    dataUrl,
                    fileHandle,
                    isInProject: isProjectScan,
                    projectFilePath: isProjectScan ? imageKey : undefined,
                };
                newImages.set(imageKey, projectImage);
            } else if (entry.kind === 'directory') {
                await scan(entry, newPath);
            }
        }
    };
    await scan(dirHandle, '');
    return newImages;
  }

  const scanDirectoryForAudios = async (dirHandle: FileSystemDirectoryHandle, baseName: string, isProjectScan: boolean) => {
    const newAudios = new Map<string, RenpyAudio>();
     const scan = async (handle: FileSystemDirectoryHandle, currentPath: string) => {
        for await (const entry of handle.values()) {
            const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
            if (entry.kind === 'file' && /\.(mp3|ogg|wav|opus)$/i.test(entry.name)) {
                const fileHandle = entry as FileSystemFileHandle;
                const file = await fileHandle.getFile();
                const dataUrl = await fileToDataUrl(file);
                const audioKey = `${baseName}/${newPath}`;
                const renpyAudio: RenpyAudio = {
                    filePath: audioKey,
                    fileName: entry.name,
                    dataUrl,
                    fileHandle,
                    isInProject: isProjectScan,
                    projectFilePath: isProjectScan ? audioKey : undefined,
                };
                newAudios.set(audioKey, renpyAudio);
            } else if (entry.kind === 'directory') {
                await scan(entry, newPath);
            }
        }
    };
    await scan(dirHandle, '');
    return newAudios;
  }

  const loadProjectImages = async (rootHandle: FileSystemDirectoryHandle) => {
    try {
        const gameDir = await rootHandle.getDirectoryHandle('game');
        const imagesDir = await gameDir.getDirectoryHandle('images');
        const projectImagesMap = await scanDirectoryForImages(imagesDir, 'game/images', true);
        setProjectImages(projectImagesMap);
    } catch (e) {
        console.warn("Could not find or access 'game/images' directory.", e);
        setProjectImages(new Map());
    }
  };

  const loadProjectAudios = async (rootHandle: FileSystemDirectoryHandle) => {
    try {
        const gameDir = await rootHandle.getDirectoryHandle('game');
        const audioDir = await gameDir.getDirectoryHandle('audio');
        const projectAudiosMap = await scanDirectoryForAudios(audioDir, 'game/audio', true);
        setProjectAudios(projectAudiosMap);
    } catch (e) {
        console.warn("Could not find or access 'game/audio' directory.", e);
        setProjectAudios(new Map());
    }
  };

  const loadIdeSettings = async (rootHandle: FileSystemDirectoryHandle) => {
    try {
        const gameDir = await rootHandle.getDirectoryHandle('game');
        const settingsFileHandle = await gameDir.getFileHandle(IDE_SETTINGS_FILE);
        const file = await settingsFileHandle.getFile();
        const content = await file.text();
        const settings = JSON.parse(content);
        
        const newImageMetadata = new Map<string, ImageMetadata>();
        if (settings.imageMetadata) {
            for (const [filePath, meta] of Object.entries(settings.imageMetadata)) {
                newImageMetadata.set(filePath, meta as ImageMetadata);
            }
        }
        setImageMetadata(newImageMetadata);

        const newAudioMetadata = new Map<string, AudioMetadata>();
        if (settings.audioMetadata) {
            for (const [filePath, meta] of Object.entries(settings.audioMetadata)) {
                newAudioMetadata.set(filePath, meta as AudioMetadata);
            }
        }
        setAudioMetadata(newAudioMetadata);

    } catch (e) {
        console.log("No project settings file found. A new one will be created if needed.");
        setImageMetadata(new Map());
        setAudioMetadata(new Map());
    }
  };

  const requestOpenFolder = () => {
    // Check for unsaved changes in file-system mode, or any blocks in browser-only mode.
    const hasUnsavedWork = (directoryHandle && dirtyBlockIds.size > 0) || (!directoryHandle && liveBlocks.length > 0);

    if (hasUnsavedWork) {
        setOpenFolderConfirmVisible(true);
    } else {
        handleOpenFolder(); // Proceed directly if no work would be lost.
    }
  };

  const handleOpenFolder = async () => {
    if (!isFileSystemApiSupported) {
        addToast("Your browser does not support the File System Access API. Please use a modern browser like Chrome or Edge.", 'warning');
        return;
    }
    try {
        let rootHandle: FileSystemDirectoryHandle;
        // Prioritize the AI Studio API if it exists to avoid cross-origin errors.
        if (window.aistudio?.showDirectoryPicker) {
            rootHandle = await window.aistudio.showDirectoryPicker();
        } else if (window.showDirectoryPicker) {
            rootHandle = await window.showDirectoryPicker();
        } else {
            addToast("File System Access API could not be initialized.", 'error');
            return;
        }
        setDirectoryHandle(rootHandle);

        const tree = await buildTreeFromHandle(rootHandle);
        setFileTree(tree);
        
        await loadProjectImages(rootHandle);
        await loadProjectAudios(rootHandle);
        await loadIdeSettings(rootHandle);

        const newBlocks: Block[] = [];
        const findRpyFilesRecursively = async (dirHandle: FileSystemDirectoryHandle, currentPath: string) => {
            for await (const entry of dirHandle.values()) {
                const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                if (entry.kind === 'file' && entry.name.endsWith('.rpy')) {
                    const fileHandle = entry as FileSystemFileHandle;
                    const file = await fileHandle.getFile();
                    const content = await file.text();
                    newBlocks.push({
                        id: uuidv4(), content, position: { x: 0, y: 0 }, width: 300, height: 200, filePath: newPath, fileHandle,
                    });
                } else if (entry.kind === 'directory') {
                    // Assets are handled by dedicated loaders
                    if (entry.name.toLowerCase() !== 'images' && entry.name.toLowerCase() !== 'audio') {
                        await findRpyFilesRecursively(entry as FileSystemDirectoryHandle, newPath);
                    }
                }
            }
        };
        
        await findRpyFilesRecursively(rootHandle, '');
        
        const preliminaryAnalysis = performRenpyAnalysis(newBlocks);
        const laidOutBlocks = tidyUpLayout(newBlocks, preliminaryAnalysis.links);

        commitChange({ blocks: laidOutBlocks, groups: [] });
        setSelectedBlockIds([]);
        setSelectedGroupIds([]);
        setDirtyBlockIds(new Set());
        setIsWelcomeScreenVisible(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') console.log('User cancelled directory picker.');
      else console.error("Error opening directory:", err);
    }
  };
  
  const handleSave = async () => {
    if (!directoryHandle || dirtyBlockIds.size === 0) return;
    setSaveStatus('saving');
    
    const updatedBlocks = [...liveBlocks];
    const successfullySavedIds = new Set<string>();

    for (const blockId of dirtyBlockIds) {
        const blockIndex = updatedBlocks.findIndex(b => b.id === blockId);
        if (blockIndex === -1) continue;
        const block = updatedBlocks[blockIndex];

        try {
            if (block.fileHandle) {
                const writable = await block.fileHandle.createWritable();
                await writable.write(block.content);
                await writable.close();
                successfullySavedIds.add(blockId);
            } else {
                let filename = block.filePath || `${(block.title || analysisResult.firstLabels[block.id] || `RenPy_Block_${block.id.slice(0, 8)}`).replace(/[^a-z0-9_-]/gi, '_')}.rpy`;
                if (!block.filePath) {
                    filename = `game/${filename}`;
                }
                const pathParts = filename.split('/');
                let currentDir = directoryHandle;
                // Create subdirectories if they don't exist
                for (let i = 0; i < pathParts.length - 1; i++) {
                    currentDir = await currentDir.getDirectoryHandle(pathParts[i], { create: true });
                }
                const newFileHandle = await currentDir.getFileHandle(pathParts[pathParts.length - 1], { create: true });
                
                const writable = await newFileHandle.createWritable();
                await writable.write(block.content);
                await writable.close();
                
                updatedBlocks[blockIndex] = { ...block, fileHandle: newFileHandle, filePath: filename };
                successfullySavedIds.add(blockId);
            }
        } catch (err) {
            console.error(`Failed to save block ${block.title || block.id}`, err);
            addToast(`Could not save file for block: ${block.title || block.id}. You may need to grant permission again.`, 'error');
        }
    }
    commitChange({ blocks: updatedBlocks, groups: liveGroups });
    setDirtyBlockIds(prev => {
        const newDirty = new Set(prev);
        successfullySavedIds.forEach(id => newDirty.delete(id));
        return newDirty;
    });
    setSaveStatus('saved');
  };

  const handleDownloadFiles = async () => {
    if (liveBlocks.length === 0) { addToast("There are no blocks to download.", 'warning'); return; }
    try {
      const zip = new JSZip();
      const usedFilenames = new Map<string, number>();
      for (const block of liveBlocks) {
        const title = block.title || analysisResult.firstLabels[block.id] || `RenPy_Block_${block.id.slice(0, 8)}`;
        let baseFilename = title.replace(/[^a-z0-9_-]/gi, '_').replace(/_{2,}/g, '_');
        let finalFilename = `${baseFilename}.rpy`;
        const lowerBase = baseFilename.toLowerCase();
        const count = usedFilenames.get(lowerBase) || 0;
        if (count > 0) finalFilename = `${baseFilename} (${count}).rpy`;
        usedFilenames.set(lowerBase, count + 1);
        zip.file(finalFilename, block.content);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = 'renpy_project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) { console.error("Error creating zip file:", error); addToast("Could not create the zip file.", 'error'); }
  };
  
  const handleUploadFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
        addToast('Please upload a .zip file containing your Ren\'Py project.', 'warning');
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
    }
    setUploadConfirm({ visible: true, file: file });
  };

  const processUploadedFile = async (file: File) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const newBlocks: Block[] = [];
      const newImages = new Map<string, ProjectImage>();
      const newAudios = new Map<string, RenpyAudio>();
      const filePaths: string[] = [];
      
      for (const relativePath in zip.files) {
        const zipEntry = zip.files[relativePath];
        if (zipEntry.dir) continue;
        filePaths.push(relativePath);

        if (relativePath.endsWith('.rpy')) {
            const content = await zipEntry.async('string');
            newBlocks.push({ id: uuidv4(), content, position: { x: 0, y: 0 }, width: 300, height: 200, filePath: relativePath });
        } else if (/\.(png|jpe?g|webp)$/i.test(relativePath) && (relativePath.toLowerCase().startsWith('game/images/') || relativePath.toLowerCase().startsWith('images/'))) {
            const blob = await zipEntry.async('blob');
            const dataUrl = await fileToDataUrl(blob);
            const fileName = relativePath.split('/').pop() || '';
            const filePath = relativePath.toLowerCase().startsWith('game/') ? relativePath : `game/${relativePath}`;
            newImages.set(filePath, { filePath, fileName, dataUrl, fileHandle: null, isInProject: true, projectFilePath: filePath });
        } else if (/\.(mp3|ogg|wav|opus)$/i.test(relativePath) && (relativePath.toLowerCase().startsWith('game/audio/') || relativePath.toLowerCase().startsWith('audio/'))) {
            const blob = await zipEntry.async('blob');
            const dataUrl = await fileToDataUrl(blob);
            const fileName = relativePath.split('/').pop() || '';
            const filePath = relativePath.toLowerCase().startsWith('game/') ? relativePath : `game/${relativePath}`;
            newAudios.set(filePath, { filePath, fileName, dataUrl, fileHandle: null, isInProject: true, projectFilePath: filePath });
        }
      }
      
      const tree = buildFileTreeFromPaths(filePaths);
      setFileTree(tree);

      setDirectoryHandle(null);
      setDirtyBlockIds(new Set());
      setProjectImages(newImages);
      setImageMetadata(new Map());
      setProjectAudios(newAudios);
      setAudioMetadata(new Map());
      
      const preliminaryAnalysis = performRenpyAnalysis(newBlocks);
      const laidOutBlocks = tidyUpLayout(newBlocks, preliminaryAnalysis.links);

      commitChange({ blocks: laidOutBlocks, groups: [] });
      setSelectedBlockIds([]);
      setSelectedGroupIds([]);
      setIsWelcomeScreenVisible(false);
    } catch (error) {
      console.error("Error processing zip file:", error);
      addToast("Could not process the zip file. It might be corrupted or in an invalid format.", 'error');
    } finally {
      if(fileInputRef.current) fileInputRef.current.value = "";
      setUploadConfirm({ visible: false, file: null });
    }
  };


  const updateBlockPositions = useCallback((updates: { id: string, position: Position }[]) => {
    const updatesMap = new Map(updates.map(u => [u.id, u.position]));
    setLiveBlocks(prevBlocks => prevBlocks.map(block => updatesMap.has(block.id) ? { ...block, position: updatesMap.get(block.id)! } : block));
  }, []);

  const updateGroup = useCallback((id: string, newGroupData: Partial<BlockGroup>) => {
    const newGroups = liveGroups.map(group => group.id === id ? { ...group, ...newGroupData } : group);
    commitChange({ blocks: liveBlocks, groups: newGroups });
  }, [liveBlocks, liveGroups, commitChange]);

  const updateGroupPositions = useCallback((updates: { id: string, position: Position }[]) => {
    const updatesMap = new Map(updates.map(u => [u.id, u.position]));
    setLiveGroups(prev => prev.map(group => updatesMap.has(group.id) ? { ...group, position: updatesMap.get(group.id)! } : group));
  }, []);

  const onInteractionEnd = useCallback(() => {
    setHistory({ blocks: liveBlocks, groups: liveGroups });
    const draggedBlockIds = liveBlocks.filter(b => b.position !== historyState.blocks.find(hb => hb.id === b.id)?.position).map(b => b.id);
    if(draggedBlockIds.length > 0) {
      setDirtyBlockIds(prev => new Set([...prev, ...draggedBlockIds]));
    }
  }, [liveBlocks, liveGroups, setHistory, historyState.blocks]);

  const handleRefreshAnalysis = () => setAnalysisTrigger(c => c + 1);

    const handleFileDoubleClick = (filePath: string) => {
        if (filePath.endsWith('.rpy')) {
            const block = liveBlocks.find(b => b.filePath === filePath);
            if (block) {
                handleOpenEditorTab(block.id);
            }
        } else if (/\.(png|jpe?g|webp)$/i.test(filePath)) {
            handleOpenImageTab(filePath);
        } else if (/\.(mp3|ogg|wav|opus)$/i.test(filePath)) {
            handleOpenAudioTab(filePath);
        }
    };
    
    const handleCenterOnBlock = useCallback((filePath: string) => {
        const block = liveBlocks.find(b => b.filePath === filePath);
        if (block) {
            setActiveTabId('canvas');
            setCenterOnBlockRequest({ blockId: block.id, key: Date.now() });
        }
    }, [liveBlocks]);

  const handleSaveIdeSettings = useCallback(async () => {
    if (!directoryHandle) return;
    try {
        const gameDir = await directoryHandle.getDirectoryHandle('game', { create: true });
        const fileHandle = await gameDir.getFileHandle(IDE_SETTINGS_FILE, { create: true });
        const writable = await fileHandle.createWritable();
        const settings = {
            imageScanDirectories: Array.from(imageScanDirectories.keys()),
            imageMetadata: Object.fromEntries(imageMetadata),
            audioScanDirectories: Array.from(audioScanDirectories.keys()),
            audioMetadata: Object.fromEntries(audioMetadata),
        };
        await writable.write(JSON.stringify(settings, null, 2));
        await writable.close();
    } catch (e) {
        console.error("Failed to save IDE settings:", e);
    }
  }, [directoryHandle, imageMetadata, imageScanDirectories, audioMetadata, audioScanDirectories]);

  const handleUpdateImageMetadata = useCallback(async (projectFilePath: string, newMetadata: ImageMetadata) => {
    const oldMetadata = imageMetadata.get(projectFilePath);
    const imageToMove = projectImages.get(projectFilePath);

    const oldSubfolder = oldMetadata?.projectSubfolder?.trim() || '';
    const newSubfolder = newMetadata.projectSubfolder?.trim() || '';

    // If no directory handle, or image not in project, or no change in subfolder, just update metadata state
    if (!directoryHandle || !imageToMove || !imageToMove.isInProject || oldSubfolder === newSubfolder) {
        setImageMetadata(prev => {
            const newMap = new Map(prev);
            newMap.set(projectFilePath, newMetadata);
            return newMap;
        });
        return;
    }

    // --- File move logic ---
    try {
        const oldPath = imageToMove.projectFilePath!;
        const fileName = imageToMove.fileName;
        
        const newPath = `game/images${newSubfolder ? `/${newSubfolder}` : ''}/${fileName}`.replace(/\/+/g, '/').replace(/^\//, '');

        if (oldPath === newPath) {
             setImageMetadata(prev => {
                const newMap = new Map(prev);
                newMap.set(projectFilePath, newMetadata);
                return newMap;
            });
            return;
        }

        if (!imageToMove.fileHandle) {
            console.error("Cannot move image without a file handle.", imageToMove);
            addToast("Cannot move image: file handle is missing.", 'error');
            return;
        }
        const fileContent = await imageToMove.fileHandle.getFile();

        let targetDir = await directoryHandle.getDirectoryHandle('game', { create: true });
        targetDir = await targetDir.getDirectoryHandle('images', { create: true });
        
        if (newSubfolder) {
            const subfolderParts = newSubfolder.split('/');
            for (const part of subfolderParts) {
                if (part) targetDir = await targetDir.getDirectoryHandle(part, { create: true });
            }
        }

        const newFileHandle = await targetDir.getFileHandle(fileName, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(fileContent);
        await writable.close();

        let oldDirParent = directoryHandle;
        const oldDirParts = oldPath.split('/').slice(0, -1);
        for (const part of oldDirParts) {
            oldDirParent = await oldDirParent.getDirectoryHandle(part);
        }
        await oldDirParent.removeEntry(fileName);

        const newProjectImages: Map<string, ProjectImage> = new Map(projectImages);
        newProjectImages.delete(oldPath);
        const updatedImage: ProjectImage = {
            ...imageToMove,
            filePath: newPath,
            projectFilePath: newPath,
            fileHandle: newFileHandle,
        };
        newProjectImages.set(newPath, updatedImage);

        const sourceImage = Array.from(newProjectImages.values()).find(img => img.projectFilePath === oldPath && img.filePath !== oldPath);
        if (sourceImage) {
            const updatedSourceImage: ProjectImage = { ...sourceImage, projectFilePath: newPath };
            newProjectImages.set(sourceImage.filePath, updatedSourceImage);
        }
        setProjectImages(newProjectImages);

        const newMetadataMap = new Map(imageMetadata);
        newMetadataMap.delete(oldPath);
        newMetadataMap.set(newPath, newMetadata);
        setImageMetadata(newMetadataMap);
        
        setFileTree(currentTree => {
            if (!currentTree) return null;
            let treeAfterRemoval = removeNodeFromFileTree(currentTree, oldPath);
            return addNodeToFileTree(treeAfterRemoval!, newPath);
        });

        setOpenTabs(tabs => tabs.map(tab => {
            if (tab.type === 'image' && tab.filePath === oldPath) {
                return { ...tab, id: newPath, filePath: newPath };
            }
            return tab;
        }));
        
        if (activeTabId === oldPath) {
            setActiveTabId(newPath);
        }

    } catch (err) {
        console.error("Failed to move image file:", err);
        addToast(`Could not move the image file. Error: ${(err as Error).message}`, 'error');
    }
  }, [directoryHandle, projectImages, imageMetadata, fileTree, activeTabId, addToast]);
  
  // Trigger save whenever metadata changes
  useEffect(() => {
    if (directoryHandle) {
        handleSaveIdeSettings();
    }
  }, [imageMetadata, audioMetadata, imageScanDirectories, audioScanDirectories, directoryHandle, handleSaveIdeSettings]);

  const handleAddImageScanDirectory = useCallback(async () => {
      if (!isFileSystemApiSupported) return;
      try {
        const dirHandle = await window.showDirectoryPicker!();
        setImageScanDirectories(prev => new Map(prev).set(dirHandle.name, dirHandle));
        const newImages = await scanDirectoryForImages(dirHandle, dirHandle.name, false);
        setProjectImages(prev => new Map([...prev, ...newImages]));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') console.log('User cancelled directory picker.');
        else console.error("Error picking directory to scan:", err);
      }
  }, []);
  
  const handleCopyImagesToProject = useCallback(async (sourceFilePaths: string[], metadataOverride?: ImageMetadata) => {
    if (!directoryHandle) return;
    try {
        const gameDir = await directoryHandle.getDirectoryHandle('game', { create: true });
        const imagesDir = await gameDir.getDirectoryHandle('images', { create: true });
        
        const newImageMap: Map<string, ProjectImage> = new Map(projectImages);
        const newMetadataMap = new Map(imageMetadata);

        for (const sourcePath of sourceFilePaths) {
            const sourceImage = newImageMap.get(sourcePath);
            if (!sourceImage || sourceImage.isInProject) continue;

            const existingMeta = newMetadataMap.get(sourceImage.projectFilePath || '') as ImageMetadata;
            const meta = metadataOverride ||
              (existingMeta?.renpyName ? existingMeta : undefined) ||
              {
                renpyName: sourceImage.fileName.split('.').slice(0,-1).join('.'),
                tags: [],
                projectSubfolder: existingMeta?.projectSubfolder
              };
            const subfolder = meta.projectSubfolder || '';

            let targetDir = imagesDir;
            if (subfolder) {
                const subfolderParts = subfolder.split('/');
                for (const part of subfolderParts) {
                    if (part) targetDir = await targetDir.getDirectoryHandle(part, { create: true });
                }
            }
            
            const targetFileName = sourceImage.fileName;
            const targetProjectFilePath = `game/images${subfolder ? `/${subfolder}` : ''}/${targetFileName}`;

            if (!sourceImage.fileHandle) {
                console.warn(`Skipping image copy for ${sourceImage.filePath} because file handle is missing.`);
                continue;
            }

            const file = await sourceImage.fileHandle.getFile();
            const newFileHandle = await targetDir.getFileHandle(targetFileName, { create: true });
            const writable = await newFileHandle.createWritable();
            await writable.write(file);
            await writable.close();

            const updatedSourceImage: ProjectImage = { ...sourceImage, isInProject: true, projectFilePath: targetProjectFilePath };
            newImageMap.set(sourcePath, updatedSourceImage);
            
            if (!newImageMap.has(targetProjectFilePath)) {
              const projectAssetImage: ProjectImage = {
                filePath: targetProjectFilePath,
                projectFilePath: targetProjectFilePath,
                fileName: targetFileName,
                dataUrl: sourceImage.dataUrl,
                fileHandle: newFileHandle,
                isInProject: true,
              };
              newImageMap.set(targetProjectFilePath, projectAssetImage);
            }
            
            newMetadataMap.set(targetProjectFilePath, meta);
        }
        setProjectImages(newImageMap);
        setImageMetadata(newMetadataMap);

        if (fileTree) {
            let currentTree = fileTree;
            for (const sourcePath of sourceFilePaths) {
                const sourceImage = newImageMap.get(sourcePath);
                if (sourceImage?.projectFilePath) {
                    currentTree = addNodeToFileTree(currentTree, sourceImage.projectFilePath);
                }
            }
            setFileTree(currentTree);
        }

    } catch (e) {
        console.error("Error copying images:", e);
        addToast("Could not copy images. Ensure you have granted permission to the project folder.", 'error');
    }
  }, [directoryHandle, projectImages, imageMetadata, fileTree, addToast]);

  const handleAddAudioScanDirectory = useCallback(async () => {
      if (!isFileSystemApiSupported) return;
      try {
        const dirHandle = await window.showDirectoryPicker!();
        setAudioScanDirectories(prev => new Map(prev).set(dirHandle.name, dirHandle));
        const newAudios = await scanDirectoryForAudios(dirHandle, dirHandle.name, false);
        setProjectAudios(prev => new Map([...prev, ...newAudios]));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') console.log('User cancelled directory picker.');
        else console.error("Error picking directory to scan for audio:", err);
      }
  }, []);

  const handleCopyAudiosToProject = useCallback(async (sourceFilePaths: string[], metadataOverride?: AudioMetadata) => {
    if (!directoryHandle) return;
    try {
        const gameDir = await directoryHandle.getDirectoryHandle('game', { create: true });
        const audiosDir = await gameDir.getDirectoryHandle('audio', { create: true });
        
        const newAudioMap: Map<string, RenpyAudio> = new Map(projectAudios);
        const newMetadataMap = new Map(audioMetadata);

        for (const sourcePath of sourceFilePaths) {
            const sourceAudio = newAudioMap.get(sourcePath);
            if (!sourceAudio || sourceAudio.isInProject) continue;

            const existingMeta = newMetadataMap.get(sourceAudio.projectFilePath || '');
            const meta = metadataOverride || (existingMeta?.renpyName ? existingMeta : undefined) || {
                renpyName: sourceAudio.fileName.split('.').slice(0,-1).join('.'),
                tags: [],
                projectSubfolder: existingMeta?.projectSubfolder
            };
            const subfolder = meta.projectSubfolder || '';

            let targetDir = audiosDir;
            if (subfolder) {
                const subfolderParts = subfolder.split('/');
                for (const part of subfolderParts) {
                    if (part) targetDir = await targetDir.getDirectoryHandle(part, { create: true });
                }
            }
            
            const targetFileName = sourceAudio.fileName;
            const targetProjectFilePath = `game/audio${subfolder ? `/${subfolder}` : ''}/${targetFileName}`;

            if (!sourceAudio.fileHandle) {
                console.warn(`Skipping audio copy for ${sourceAudio.filePath} because file handle is missing.`);
                continue;
            }

            const file = await sourceAudio.fileHandle.getFile();
            const newFileHandle = await targetDir.getFileHandle(targetFileName, { create: true });
            const writable = await newFileHandle.createWritable();
            await writable.write(file);
            await writable.close();

            const updatedSourceAudio: RenpyAudio = { ...sourceAudio, isInProject: true, projectFilePath: targetProjectFilePath };
            newAudioMap.set(sourcePath, updatedSourceAudio);
            
            if (!newAudioMap.has(targetProjectFilePath)) {
              const projectAssetAudio: RenpyAudio = {
                filePath: targetProjectFilePath,
                projectFilePath: targetProjectFilePath,
                fileName: targetFileName,
                dataUrl: sourceAudio.dataUrl,
                fileHandle: newFileHandle,
                isInProject: true,
              };
              newAudioMap.set(targetProjectFilePath, projectAssetAudio);
            }
            
            newMetadataMap.set(targetProjectFilePath, meta);
        }
        setProjectAudios(newAudioMap);
        setAudioMetadata(newMetadataMap);

        if (fileTree) {
            let currentTree = fileTree;
            for (const sourcePath of sourceFilePaths) {
                const sourceAudio = newAudioMap.get(sourcePath);
                if (sourceAudio?.projectFilePath) {
                    currentTree = addNodeToFileTree(currentTree, sourceAudio.projectFilePath);
                }
            }
            setFileTree(currentTree);
        }

    } catch (e) {
        console.error("Error copying audio:", e);
        addToast("Could not copy audio files. Ensure you have granted permission to the project folder.", 'error');
    }
  }, [directoryHandle, projectAudios, audioMetadata, fileTree, addToast]);
  
  const handleUpdateAudioMetadata = useCallback(async (projectFilePath: string, newMetadata: AudioMetadata) => {
    const oldMetadata = audioMetadata.get(projectFilePath);
    const audioToMove = projectAudios.get(projectFilePath);

    const oldSubfolder = oldMetadata?.projectSubfolder?.trim() || '';
    const newSubfolder = newMetadata.projectSubfolder?.trim() || '';

    if (!directoryHandle || !audioToMove || !audioToMove.isInProject || oldSubfolder === newSubfolder) {
        setAudioMetadata(prev => new Map(prev).set(projectFilePath, newMetadata));
        return;
    }

    try {
        const oldPath = audioToMove.projectFilePath!;
        const fileName = audioToMove.fileName;
        const newPath = `game/audio${newSubfolder ? `/${newSubfolder}` : ''}/${fileName}`.replace(/\/+/g, '/').replace(/^\//, '');

        if (oldPath === newPath) {
             setAudioMetadata(prev => new Map(prev).set(projectFilePath, newMetadata));
             return;
        }

        if (!audioToMove.fileHandle) throw new Error("File handle missing for audio file to move.");
        
        const fileContent = await audioToMove.fileHandle.getFile();

        let targetDir = await directoryHandle.getDirectoryHandle('game', { create: true });
        targetDir = await targetDir.getDirectoryHandle('audio', { create: true });
        if (newSubfolder) {
            for (const part of newSubfolder.split('/')) {
                if (part) targetDir = await targetDir.getDirectoryHandle(part, { create: true });
            }
        }

        const newFileHandle = await targetDir.getFileHandle(fileName, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(fileContent);
        await writable.close();

        let oldDirParent = directoryHandle;
        for (const part of oldPath.split('/').slice(0, -1)) {
            oldDirParent = await oldDirParent.getDirectoryHandle(part);
        }
        await oldDirParent.removeEntry(fileName);

        const newProjectAudios: Map<string, RenpyAudio> = new Map(projectAudios);
        newProjectAudios.delete(oldPath);
        const updatedAudio: RenpyAudio = { ...audioToMove, filePath: newPath, projectFilePath: newPath, fileHandle: newFileHandle };
        newProjectAudios.set(newPath, updatedAudio);

        const sourceAudio = Array.from(newProjectAudios.values()).find(aud => aud.projectFilePath === oldPath && aud.filePath !== oldPath);
        if (sourceAudio) {
            newProjectAudios.set(sourceAudio.filePath, { ...sourceAudio, projectFilePath: newPath });
        }
        setProjectAudios(newProjectAudios);

        const newMetadataMap = new Map(audioMetadata);
        newMetadataMap.delete(oldPath);
        newMetadataMap.set(newPath, newMetadata);
        setAudioMetadata(newMetadataMap);
        
        setFileTree(currentTree => {
            if (!currentTree) return null;
            let treeAfterRemoval = removeNodeFromFileTree(currentTree, oldPath);
            return addNodeToFileTree(treeAfterRemoval!, newPath);
        });

        setOpenTabs(tabs => tabs.map(tab => tab.type === 'audio' && tab.filePath === oldPath ? { ...tab, id: newPath, filePath: newPath } : tab));
        if (activeTabId === oldPath) setActiveTabId(newPath);

    } catch (err) {
        console.error("Failed to move audio file:", err);
        addToast(`Could not move the audio file. Error: ${(err as Error).message}`, 'error');
    }
  }, [directoryHandle, projectAudios, audioMetadata, fileTree, activeTabId, addToast]);

  // --- Start File Operations Handlers ---

  const getHandleFromPath = useCallback(async (path: string): Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null> => {
    if (!directoryHandle) return null;
    const parts = path.split('/').filter(p => p);
    let currentHandle: FileSystemDirectoryHandle = directoryHandle;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (currentHandle.kind !== 'directory') return null;
        try {
            if (i === parts.length - 1) {
                 try {
                    return await currentHandle.getFileHandle(part);
                } catch {
                    return await currentHandle.getDirectoryHandle(part);
                }
            } else {
                currentHandle = await currentHandle.getDirectoryHandle(part);
            }
        } catch (e) { return null; }
    }
    return currentHandle;
  }, [directoryHandle]);
  
  const updateAllStatePaths = useCallback((updates: Map<string, { newPath: string; type: 'file' | 'folder' }>) => {
    let currentBlocks = liveBlocks;
    let currentProjectImages = projectImages;
    let currentImageMetadata = imageMetadata;
    let currentProjectAudios = projectAudios;
    let currentAudioMetadata = audioMetadata;
    let currentOpenTabs = openTabs;
    let currentActiveTabId = activeTabId;
    let currentClipboard = clipboard;
    
    for(const [oldPath, { newPath }] of updates.entries()) {
        currentBlocks = currentBlocks.map(b => b.filePath === oldPath ? { ...b, filePath: newPath } : b);
        
        const newProjectImages = new Map<string, ProjectImage>();
        for (const [key, img] of currentProjectImages.entries()) {
            if (key.startsWith(oldPath)) {
                const updatedKey = key.replace(oldPath, newPath);
                const updatedImg: ProjectImage = {...img, filePath: updatedKey, projectFilePath: img.projectFilePath?.replace(oldPath, newPath)};
                newProjectImages.set(updatedKey, updatedImg);
            } else if (img.projectFilePath?.startsWith(oldPath)) {
                const updatedImg: ProjectImage = {...img, projectFilePath: img.projectFilePath.replace(oldPath, newPath) };
                newProjectImages.set(key, updatedImg);
            } else {
                newProjectImages.set(key, img);
            }
        }
        currentProjectImages = newProjectImages;

        const newImageMetadata = new Map<string, ImageMetadata>();
        currentImageMetadata.forEach((meta, key) => {
           if (key.startsWith(oldPath)) newImageMetadata.set(key.replace(oldPath, newPath), meta);
           else newImageMetadata.set(key, meta);
        });
        currentImageMetadata = newImageMetadata;

        const newProjectAudios = new Map<string, RenpyAudio>();
        for (const [key, aud] of currentProjectAudios.entries()) {
            if (key.startsWith(oldPath)) {
                const updatedKey = key.replace(oldPath, newPath);
                const updatedAud: RenpyAudio = {...aud, filePath: updatedKey, projectFilePath: aud.projectFilePath?.replace(oldPath, newPath)};
                newProjectAudios.set(updatedKey, updatedAud);
            } else if (aud.projectFilePath?.startsWith(oldPath)) {
                const updatedAud: RenpyAudio = {...aud, projectFilePath: aud.projectFilePath.replace(oldPath, newPath) };
                newProjectAudios.set(key, updatedAud);
            } else {
                newProjectAudios.set(key, aud);
            }
        }
        currentProjectAudios = newProjectAudios;

        const newAudioMetadata = new Map<string, AudioMetadata>();
        currentAudioMetadata.forEach((meta, key) => {
           if (key.startsWith(oldPath)) newAudioMetadata.set(key.replace(oldPath, newPath), meta);
           else newAudioMetadata.set(key, meta);
        });
        currentAudioMetadata = newAudioMetadata;

        currentOpenTabs = currentOpenTabs.map(tab => {
            if (tab.filePath?.startsWith(oldPath)) {
                const newFilePath = tab.filePath.replace(oldPath, newPath);
                return { ...tab, id: newFilePath, filePath: newFilePath };
            }
            return tab;
        });
        
        if (currentActiveTabId.startsWith(oldPath)) {
            currentActiveTabId = currentActiveTabId.replace(oldPath, newPath);
        }
        
        if (currentClipboard?.paths.has(oldPath)) {
            const newPaths = new Set(currentClipboard.paths);
            newPaths.delete(oldPath);
            newPaths.add(newPath);
            currentClipboard = { ...currentClipboard, paths: newPaths };
        }
    }
    
    setLiveBlocks(currentBlocks);
    setProjectImages(currentProjectImages);
    setImageMetadata(currentImageMetadata);
    setProjectAudios(currentProjectAudios);
    setAudioMetadata(currentAudioMetadata);
    setOpenTabs(currentOpenTabs);
    setActiveTabId(currentActiveTabId);
    setClipboard(currentClipboard);
    commitChange({ blocks: currentBlocks, groups: liveGroups });
    
  }, [liveBlocks, liveGroups, projectImages, imageMetadata, projectAudios, audioMetadata, openTabs, activeTabId, clipboard, commitChange]);

  const handleCreateNode = useCallback(async (parentPath: string, name: string, type: 'file' | 'folder') => {
    if (!directoryHandle || !name) return;
    const newPath = parentPath ? `${parentPath}/${name}` : name;

    try {
        let parentDirHandle: FileSystemDirectoryHandle = directoryHandle;
        if (parentPath) {
            const handle = await getHandleFromPath(parentPath);
            if (handle?.kind !== 'directory') throw new Error("Parent path is not a directory");
            parentDirHandle = handle;
        }

        if (type === 'folder') {
            await parentDirHandle.getDirectoryHandle(name, { create: true });
        } else {
            const newFileHandle = await parentDirHandle.getFileHandle(name, { create: true });
            if (name.endsWith('.rpy')) {
                const newBlock: Block = {
                    id: uuidv4(),
                    content: `label ${name.replace('.rpy', '')}_label:\n    # New content for ${name}\n    return`,
                    position: { x: 50, y: 50 },
                    width: 300,
                    height: 120,
                    filePath: newPath,
                    fileHandle: newFileHandle
                };
                commitChange({ blocks: [...liveBlocks, newBlock], groups: liveGroups }, [newBlock.id]);
                handleOpenEditorTab(newBlock.id);
            }
        }
        setFileTree(tree => addNodeToFileTree(tree!, newPath, type));
    } catch (e) {
        console.error("Failed to create node:", e);
        addToast(`Could not create ${type}: ${(e as Error).message}`, 'error');
    }
  }, [directoryHandle, liveBlocks, liveGroups, commitChange, getHandleFromPath, handleOpenEditorTab, addToast]);

  const handleRenameNode = useCallback(async (oldPath: string, newName: string) => {
      if (!directoryHandle) return;
      const parts = oldPath.split('/');
      const oldName = parts.pop();
      if (oldName === newName) return;
      
      const parentPath = parts.join('/');
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;

      try {
          const oldHandle = await getHandleFromPath(oldPath);
          if (!oldHandle) throw new Error("Source not found");

          const copyRecursive = async (source: FileSystemDirectoryHandle | FileSystemFileHandle, targetDir: FileSystemDirectoryHandle, newName: string) => {
              if (source.kind === 'file') {
                  const file = await source.getFile();
                  const newFileHandle = await targetDir.getFileHandle(newName, { create: true });
                  const writable = await newFileHandle.createWritable();
                  await writable.write(file);
                  await writable.close();
              } else {
                  const newDirHandle = await targetDir.getDirectoryHandle(newName, { create: true });
                  for await (const entry of source.values()) {
                      await copyRecursive(entry, newDirHandle, entry.name);
                  }
              }
          };

          let parentHandle = directoryHandle;
          if (parentPath) {
              const handle = await getHandleFromPath(parentPath);
              if (handle?.kind !== 'directory') throw new Error("Parent not found");
              parentHandle = handle;
          }
          
          await copyRecursive(oldHandle, parentHandle, newName);
          await parentHandle.removeEntry(oldName, { recursive: true });

          // Update state
          const type = oldHandle.kind === 'directory' ? 'folder' : 'file';
          const pathUpdates = new Map<string, { newPath: string; type: 'file' | 'folder' }>();
          pathUpdates.set(oldPath, { newPath, type });
          updateAllStatePaths(pathUpdates);
          
          setFileTree(tree => {
              const treeAfterRemove = removeNodeFromFileTree(tree!, oldPath);
              return addNodeToFileTree(treeAfterRemove!, newPath, type);
          });
          
      } catch (e) {
          console.error("Failed to rename node:", e);
          addToast(`Could not rename: ${(e as Error).message}`, 'error');
      }
  }, [directoryHandle, getHandleFromPath, updateAllStatePaths, addToast]);
  
    const handleDeleteNode = useCallback((paths: string[]) => {
      requestDelete([], paths);
  }, [requestDelete]);

  const handleCut = useCallback((paths: string[]) => setClipboard({ type: 'cut', paths: new Set(paths) }), []);
  const handleCopy = useCallback((paths: string[]) => setClipboard({ type: 'copy', paths: new Set(paths) }), []);

  const handleMoveNode = useCallback(async (sourcePaths: string[], targetFolderPath: string) => {
      if (!directoryHandle) return;

      const copyRecursive = async (sourceHandle: FileSystemDirectoryHandle | FileSystemFileHandle, targetDirHandle: FileSystemDirectoryHandle, newName?: string) => {
          const name = newName || sourceHandle.name;
          if (sourceHandle.kind === 'file') {
              const file = await sourceHandle.getFile();
              const newFileHandle = await targetDirHandle.getFileHandle(name, { create: true });
              const writable = await newFileHandle.createWritable();
              await writable.write(file);
              await writable.close();
          } else { // Directory
              const newDirHandle = await targetDirHandle.getDirectoryHandle(name, { create: true });
              for await (const entry of sourceHandle.values()) {
                  await copyRecursive(entry, newDirHandle);
              }
          }
      };

      try {
          const targetDirHandle = targetFolderPath ? await getHandleFromPath(targetFolderPath) : directoryHandle;
          if (!targetDirHandle || targetDirHandle.kind !== 'directory') throw new Error("Invalid target folder");

          const pathUpdates = new Map<string, { newPath: string; type: 'file' | 'folder' }>();

          for (const sourcePath of sourcePaths) {
              if (targetFolderPath.startsWith(sourcePath)) {
                  console.warn(`Cannot move a folder into itself or a descendant: ${sourcePath} -> ${targetFolderPath}`);
                  continue; // Skip this move
              }
              const sourceHandle = await getHandleFromPath(sourcePath);
              if (!sourceHandle) continue;

              const newPath = `${targetFolderPath}/${sourceHandle.name}`.replace(/\/+/g, '/').replace(/^\//, '');
              const type = sourceHandle.kind === 'directory' ? 'folder' : 'file';
              pathUpdates.set(sourcePath, { newPath, type });

              await copyRecursive(sourceHandle, targetDirHandle);

              const parentPath = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
              const parentHandle = parentPath ? await getHandleFromPath(parentPath) : directoryHandle;
              if (parentHandle && parentHandle.kind === 'directory') {
                  await parentHandle.removeEntry(sourceHandle.name, { recursive: true });
              }
          }
          
          updateAllStatePaths(pathUpdates);
          setFileTree(tree => {
              let currentTree = tree;
              for (const [oldPath, { newPath, type }] of pathUpdates.entries()) {
                  currentTree = removeNodeFromFileTree(currentTree!, oldPath);
                  currentTree = addNodeToFileTree(currentTree!, newPath, type);
              }
              return currentTree;
          });

      } catch (e) {
          console.error("Failed to move nodes:", e);
          addToast(`Could not move: ${(e as Error).message}`, 'error');
      }
  }, [directoryHandle, getHandleFromPath, updateAllStatePaths, addToast]);
  
    const handlePaste = useCallback(async (targetFolderPath: string) => {
        if (!clipboard || !directoryHandle) return;

        const { type, paths } = clipboard;
        if (type === 'cut') {
            await handleMoveNode(Array.from(paths), targetFolderPath);
            setClipboard(null);
            return;
        }

        // --- Handle Copy ---
        const copyRecursive = async (sourceHandle: FileSystemDirectoryHandle | FileSystemFileHandle, targetDirHandle: FileSystemDirectoryHandle, newName?: string) => {
            let name = newName || sourceHandle.name;
            if (sourceHandle.kind === 'file') {
                const file = await sourceHandle.getFile();
                const newFileHandle = await targetDirHandle.getFileHandle(name, { create: true });
                const writable = await newFileHandle.createWritable();
                await writable.write(file);
                await writable.close();
            } else { // Directory
                const newDirHandle = await targetDirHandle.getDirectoryHandle(name, { create: true });
                for await (const entry of sourceHandle.values()) {
                    await copyRecursive(entry, newDirHandle);
                }
            }
        };

        try {
            const targetDirHandle = targetFolderPath ? await getHandleFromPath(targetFolderPath) : directoryHandle;
            if (!targetDirHandle || targetDirHandle.kind !== 'directory') throw new Error("Invalid target folder");
            
            let newTree = fileTree;

            for (const sourcePath of paths) {
                const sourceHandle = await getHandleFromPath(sourcePath);
                if (!sourceHandle) continue;
                
                // Handle name conflicts
                let newName = sourceHandle.name;
                let counter = 1;
                let handleExists = true;
                while(handleExists) {
                    try {
                        if (sourceHandle.kind === 'file') await targetDirHandle.getFileHandle(newName);
                        else await targetDirHandle.getDirectoryHandle(newName);
                        
                        const parts = sourceHandle.name.split('.');
                        const ext = parts.length > 1 ? `.${parts.pop()}` : '';
                        const base = parts.join('.');
                        newName = `${base}_copy${counter++}${ext}`;
                    } catch {
                        handleExists = false;
                    }
                }
                
                await copyRecursive(sourceHandle, targetDirHandle, newName);
                
                const newPath = `${targetFolderPath}/${newName}`;
                const type = sourceHandle.kind === 'directory' ? 'folder' : 'file';
                newTree = addNodeToFileTree(newTree!, newPath, type);
                
                if (newName.endsWith('.rpy')) {
                    const content = await (await (sourceHandle as FileSystemFileHandle).getFile()).text();
                     const newBlock: Block = {
                        id: uuidv4(),
                        content,
                        position: { x: 50, y: 50 },
                        width: 300,
                        height: 120,
                        filePath: newPath,
                        fileHandle: await getHandleFromPath(newPath) as FileSystemFileHandle,
                    };
                    commitChange({ blocks: [...liveBlocks, newBlock], groups: liveGroups }, [newBlock.id]);
                }
            }
            setFileTree(newTree);

        } catch (e) {
            console.error("Failed to paste nodes:", e);
            addToast(`Could not paste: ${(e as Error).message}`, 'error');
        }

    }, [clipboard, directoryHandle, getHandleFromPath, handleMoveNode, fileTree, liveBlocks, liveGroups, commitChange, addToast]);
  
  // --- End File Operations Handlers ---

  const handleRightResizeStart = useCallback((startEvent: React.PointerEvent) => {
    startEvent.preventDefault();
    document.body.style.cursor = 'ew-resize';
    const startX = startEvent.clientX;
    const startWidth = rightSidebarWidth;
    const MIN_SIDEBAR_WIDTH = 320;
    const MAX_SIDEBAR_WIDTH = 800;

    const handleMouseMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const newWidth = startWidth - dx; // Dragging left increases width
        const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(newWidth, MAX_SIDEBAR_WIDTH));
        setRightSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
        document.body.style.cursor = '';
        window.removeEventListener('pointermove', handleMouseMove);
        window.removeEventListener('pointerup', handleMouseUp);
    };

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
  }, [rightSidebarWidth]);

  const handleLeftResizeStart = useCallback((startEvent: React.PointerEvent) => {
    startEvent.preventDefault();
    document.body.style.cursor = 'ew-resize';
    const startX = startEvent.clientX;
    const startWidth = leftSidebarWidth;
    const MIN_SIDEBAR_WIDTH = 200;
    const MAX_SIDEBAR_WIDTH = 600;

    const handleMouseMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const newWidth = startWidth + dx; // Dragging right increases width
        const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(newWidth, MAX_SIDEBAR_WIDTH));
        setLeftSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
        document.body.style.cursor = '';
        window.removeEventListener('pointermove', handleMouseMove);
        window.removeEventListener('pointerup', handleMouseUp);
    };

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
  }, [leftSidebarWidth]);
  
  const ThemeIcon = () => {
    if (theme === 'light') return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
    if (theme === 'dark') return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
    return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
  };
  
  const SaveStatusIndicator = () => {
    if (directoryHandle) {
      if (dirtyBlockIds.size > 0) {
        return <div className="flex items-center text-blue-600 dark:text-blue-400"><span>{dirtyBlockIds.size} unsaved changes</span></div>;
      }
      return <div className="flex items-center text-green-600 dark:text-green-400"><span>Project saved</span></div>;
    }
    if (saveStatus === 'saving') return <div className="flex items-center text-gray-500 dark:text-gray-400"><svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Saving...</span></div>;
    if (saveStatus === 'saved') return <div className="flex items-center text-green-600 dark:text-green-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg><span>Saved to browser</span></div>;
    return <div className="flex items-center text-red-600 dark:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg><span>Save error</span></div>;
  };

  return (
    <div className={`h-screen w-screen flex flex-col font-sans ${effectiveTheme}`}>
      {isWelcomeScreenVisible && 
        <WelcomeScreen 
          onOpenFolder={requestOpenFolder} 
          onStartInBrowser={() => setIsWelcomeScreenVisible(false)}
          onUpload={() => fileInputRef.current?.click()}
          isFileSystemApiSupported={isFileSystemApiSupported}
        />
      }

      {isClearConfirmVisible && (
        <ConfirmModal title="Clear Canvas" onConfirm={() => { commitChange({ blocks: [], groups: [] }); setIsClearConfirmVisible(false); }} onClose={() => setIsClearConfirmVisible(false)}>
          Are you sure you want to delete all blocks and groups from the canvas? This action cannot be undone.
        </ConfirmModal>
      )}
      
      {uploadConfirm.visible && (
        <ConfirmModal title="Confirm Project Upload" onConfirm={() => processUploadedFile(uploadConfirm.file!)} onClose={() => { if(fileInputRef.current) fileInputRef.current.value = ""; setUploadConfirm({ visible: false, file: null }); }} confirmText="Upload" confirmClassName="bg-indigo-600 hover:bg-indigo-700">
           This will replace your current browser-only project. If you have any unsaved work, please download it first. Are you sure you want to continue?
        </ConfirmModal>
      )}

      {openFolderConfirmVisible && (
          <ConfirmModal
              title="Open Project Folder"
              onConfirm={() => {
                  setOpenFolderConfirmVisible(false);
                  handleOpenFolder();
              }}
              onClose={() => setOpenFolderConfirmVisible(false)}
              confirmText="Open Anyway"
              confirmClassName="bg-indigo-600 hover:bg-indigo-700"
          >
              Opening a new project will replace your current session. Any unsaved changes will be lost.
          </ConfirmModal>
      )}

      {deleteConfirm.visible && (
        <ConfirmModal 
            title="Confirm Deletion" 
            onConfirm={handleConfirmDelete} 
            onClose={() => setDeleteConfirm({ visible: false })}
        >
            <p>{deleteConfirm.message}</p>
            {deleteConfirm.warning && <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">{deleteConfirm.warning}</p>}
        </ConfirmModal>
      )}

      <input type="file" ref={fileInputRef} onChange={handleUploadFileSelect} accept=".zip" style={{ display: 'none' }} />
      
      <div aria-live="assertive" className="fixed bottom-4 right-4 z-[60] w-full max-w-sm flex flex-col space-y-2 items-end">
        {toasts.map(toast => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>

      <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between px-4 z-30 shadow-sm">
        <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Ren'Py Visual Editor</h1>
             {directoryHandle && <span className="text-sm font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">{directoryHandle.name}</span>}
        </div>
        <div className="flex-grow flex items-center justify-center">
            <div className="flex items-center space-x-4 text-gray-500 dark:text-gray-400">
                <button onClick={undo} disabled={!canUndo} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50" title="Undo (Ctrl+Z)"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg></button>
                <button onClick={redo} disabled={!canRedo} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50" title="Redo (Ctrl+Y)"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 15l3-3m0 0l-3-3m3 3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-600"></div>
                <button onClick={addBlock} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="New Block (N)"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 4a1 1 0 100 2h6a1 1 0 100-2H7zm6 4a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zM7 9a1 1 0 100 2h3a1 1 0 100-2H7z" clipRule="evenodd" /></svg></button>
                <button onClick={handleTidyUp} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Tidy Up Layout"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></button>
                <button onClick={handleRefreshAnalysis} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Refresh Analysis"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg></button>
            </div>
        </div>
        <div className="flex items-center space-x-4">
          <SaveStatusIndicator />
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-600"></div>
            <button onClick={requestOpenFolder} disabled={!isFileSystemApiSupported} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50" title={isFileSystemApiSupported ? "Open Project Folder" : "File System API not supported"}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
            </button>
            {directoryHandle ? (
                <button onClick={handleSave} disabled={dirtyBlockIds.size === 0} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50" title="Save All Changes to Files"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg></button>
            ) : (
                <button onClick={handleDownloadFiles} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Download Project as .zip"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
            )}
            <button onClick={() => setIsClearConfirmVisible(true)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Clear Canvas"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            <button onClick={toggleTheme} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title={`Switch to ${theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'} mode`}><ThemeIcon /></button>
        </div>
      </header>
      <main className="flex-grow flex overflow-hidden">
        {isLeftSidebarOpen && (
          <aside className="flex-shrink-0" style={{ width: leftSidebarWidth }}>
            <FileExplorerPanel 
                tree={fileTree} 
                onFileOpen={handleFileDoubleClick}
                onCreateNode={handleCreateNode}
                onRenameNode={handleRenameNode}
                onDeleteNode={handleDeleteNode}
                onMoveNode={handleMoveNode}
                clipboard={clipboard}
                onCut={handleCut}
                onCopy={handleCopy}
                onPaste={handlePaste}
                onCenterOnBlock={handleCenterOnBlock}
            />
          </aside>
        )}
         <div onPointerDown={handleLeftResizeStart} className="w-1.5 cursor-ew-resize flex-shrink-0 bg-gray-200 dark:bg-gray-700 hover:bg-indigo-500 transition-colors duration-200"></div>

        <div className="flex-grow relative flex flex-col">
            <div className="flex-shrink-0 h-10 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center overflow-x-auto">
                {openTabs.map(tab => (
                    <div 
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        className={`h-full flex items-center px-4 cursor-pointer text-sm border-r border-gray-200 dark:border-gray-700 whitespace-nowrap ${activeTabId === tab.id ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                    >
                        {tab.type === 'editor' && dirtyEditors.has(tab.blockId!) && <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" title="Unsaved changes"></div>}
                        <span>
                            {tab.type === 'canvas' && 'Canvas'}
                            {tab.type === 'editor' && (liveBlocks.find(b => b.id === tab.blockId)?.title || liveBlocks.find(b => b.id === tab.blockId)?.filePath?.split('/').pop() || 'Editor')}
                            {tab.type === 'image' && (tab.filePath?.split('/').pop() || 'Image')}
                            {tab.type === 'audio' && (tab.filePath?.split('/').pop() || 'Audio')}
                            {tab.type === 'character' && (tab.characterTag === 'new_character' ? 'New Character' : analysisResult.characters.get(tab.characterTag!)?.name || 'Character')}
                        </span>
                        {tab.type !== 'canvas' && (
                            <button onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }} className="ml-3 p-0.5 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        )}
                    </div>
                ))}
            </div>
            <div className="flex-grow relative">
                {activeTab.type === 'canvas' && (
                    <StoryCanvas
                        blocks={liveBlocks}
                        groups={liveGroups}
                        analysisResult={analysisResult}
                        updateBlock={updateBlock}
                        updateGroup={updateGroup}
                        updateBlockPositions={updateBlockPositions}
                        updateGroupPositions={updateGroupPositions}
                        onInteractionEnd={onInteractionEnd}
                        deleteBlock={(id: string) => requestDelete([id], [])}
                        onOpenEditor={handleOpenEditorTab}
                        selectedBlockIds={selectedBlockIds}
                        setSelectedBlockIds={setSelectedBlockIds}
                        selectedGroupIds={selectedGroupIds}
                        setSelectedGroupIds={setSelectedGroupIds}
                        findUsagesHighlightIds={findUsagesHighlightIds}
                        clearFindUsages={() => setFindUsagesHighlightIds(null)}
                        dirtyBlockIds={dirtyBlockIds}
                        canvasFilters={canvasFilters}
                        setCanvasFilters={setCanvasFilters}
                        centerOnBlockRequest={centerOnBlockRequest}
                    />
                )}
                {activeTab.type === 'editor' && activeEditorBlock && (
                    <EditorView 
                        block={activeEditorBlock}
                        analysisResult={analysisResult}
                        initialScrollRequest={activeTab.scrollRequest}
                        onSwitchFocusBlock={handleOpenEditorTab}
                        onSave={handleSaveBlockContent}
                        onDirtyChange={handleEditorDirtyChange}
                        saveTrigger={saveTrigger}
                        editorTheme={effectiveTheme}
                    />
                )}
                 {activeTab.type === 'image' && activeTab.filePath && (() => {
                    const image = projectImages.get(activeTab.filePath!);
                    if (image) {
                        return <ImageEditorView 
                            image={image} 
                            metadata={imageMetadata.get(image.projectFilePath || '')}
                            onUpdateMetadata={handleUpdateImageMetadata}
                            onCopyToProject={(sourcePath, metadata) => handleCopyImagesToProject([sourcePath], metadata)}
                        />;
                    }
                    return <div>Image not found.</div>;
                 })()}
                 {activeTab.type === 'audio' && activeTab.filePath && (() => {
                    const audio = projectAudios.get(activeTab.filePath!);
                    if (audio) {
                        return <AudioEditorView 
                            audio={audio} 
                            metadata={audioMetadata.get(audio.projectFilePath || '')}
                            onUpdateMetadata={handleUpdateAudioMetadata}
                            onCopyToProject={(sourcePath, metadata) => handleCopyAudiosToProject([sourcePath], metadata)}
                        />;
                    }
                    return <div>Audio not found.</div>;
                 })()}
                 {activeTab.type === 'character' && activeTab.characterTag && (
                    <CharacterEditorView
                      character={activeTab.characterTag === 'new_character' ? undefined : analysisResult.characters.get(activeTab.characterTag)}
                      onSave={handleSaveCharacter}
                      existingTags={Array.from(analysisResult.characters.keys())}
                      projectImages={Array.from(projectImages.values())}
                      imageMetadata={imageMetadata}
                    />
                 )}
            </div>
        </div>

        <div onPointerDown={handleRightResizeStart} className="w-1.5 cursor-ew-resize flex-shrink-0 bg-gray-200 dark:bg-gray-700 hover:bg-indigo-500 transition-colors duration-200"></div>

        {isRightSidebarOpen && (
          <aside className="flex-shrink-0" style={{ width: rightSidebarWidth }}>
            <StoryElementsPanel
                analysisResult={analysisResult}
                onOpenCharacterEditor={handleOpenCharacterEditor}
                onFindCharacterUsages={handleFindCharacterUsages}
                onAddVariable={handleAddVariable}
                onFindVariableUsages={handleFindVariableUsages}
                onAddScreen={handleAddScreen}
                onFindScreenDefinition={handleFindScreenDefinition}
                projectImages={projectImages}
                imageMetadata={imageMetadata}
                onAddImageScanDirectory={handleAddImageScanDirectory}
                imageScanDirectories={imageScanDirectories}
                onCopyImagesToProject={(paths) => handleCopyImagesToProject(paths)}
                onUpdateImageMetadata={handleUpdateImageMetadata}
                onOpenImageEditor={handleOpenImageTab}
                projectAudios={projectAudios}
                audioMetadata={audioMetadata}
                onAddAudioScanDirectory={handleAddAudioScanDirectory}
                audioScanDirectories={audioScanDirectories}
                onCopyAudiosToProject={(paths) => handleCopyAudiosToProject(paths)}
                onUpdateAudioMetadata={handleUpdateAudioMetadata}
                onOpenAudioEditor={handleOpenAudioTab}
                isFileSystemApiSupported={isFileSystemApiSupported}
             />
          </aside>
        )}
      </main>
    </div>
  );
};

export default App;