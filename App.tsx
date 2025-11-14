import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Toolbar from './components/Toolbar';
import StoryCanvas from './components/StoryCanvas';
import RouteCanvas from './components/RouteCanvas';
import EditorView from './components/EditorView';
import ImageEditorView from './components/ImageEditorView';
import AudioEditorView from './components/AudioEditorView';
import CharacterEditorView from './components/CharacterEditorView';
import ConfirmModal from './components/ConfirmModal';
import StoryElementsPanel from './components/StoryElementsPanel';
import FileExplorerPanel from './components/FileExplorerPanel';
import Toast from './components/Toast';
import LoadingOverlay from './components/LoadingOverlay';
import SettingsModal from './components/SettingsModal';
import { useRenpyAnalysis, performRenpyAnalysis, performRouteAnalysis } from './hooks/useRenpyAnalysis';
import { useHistory } from './hooks/useHistory';
import type { Block, Position, BlockGroup, Link, Character, Variable, ProjectImage, ImageMetadata, RenpyAudio, AudioMetadata, EditorTab, RenpyScreen, FileSystemTreeNode, ToastMessage, LabelNode, RouteLink, IdentifiedRoute, Theme, IdeSettings, ClipboardState } from './types';
import JSZip from 'jszip';
import { produce } from 'immer';
import logo from './vangard-renide-512x512.png';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// Add all necessary FS API types to the global scope to fix compilation issues
// and make them available throughout the app, including in the types.ts file.
declare global {
  // FIX: Add definition for FileSystemHandlePermissionDescriptor to resolve compilation errors.
  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }

  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
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
    // Add the Electron API exposed via preload.js
    electronAPI?: {
      openDirectory: () => Promise<string | null>;
      loadProject: (rootPath: string) => Promise<{
        rootPath: string;
        files: { path: string; content: string }[];
        images: { path: string; dataUrl: string; lastModified: number }[];
        audios: { path: string; dataUrl: string; lastModified: number }[];
        settings: Partial<IdeSettings & { imageMetadata?: any, audioMetadata?: any }> | null;
        tree: FileSystemTreeNode;
      }>;
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      removeEntry: (entryPath: string) => Promise<{ success: boolean; error?: string }>;
      moveFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
      onMenuCommand: (callback: (args: { command: string, [key: string]: any }) => void) => () => void;
    };
  }
}

const SAVE_KEY_BLOCKS = 'renpy-visual-editor-blocks';
const SAVE_KEY_GROUPS = 'renpy-visual-editor-groups';
const SAVE_KEY_IDE_SETTINGS = 'renpy-visual-editor-settings';
const IDE_SETTINGS_FILE = 'project.ide.json';

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
  );
}

type SaveStatus = 'saving' | 'saved' | 'error';
type AppState = { blocks: Block[], groups: BlockGroup[] };


const WelcomeScreen: React.FC<{
  onOpenFolder: () => void;
  onStartInBrowser: () => void;
  onUpload: () => void;
  isFileSystemApiSupported: boolean;
}> = ({ onOpenFolder, onStartInBrowser, onUpload, isFileSystemApiSupported }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full border border-gray-200 dark:border-gray-700 transform transition-all animate-fade-in-up flex overflow-hidden">
        <style>{`
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up {
            animation: fade-in-up 0.5s ease-out forwards;
          }
        `}</style>
        <img src={logo} alt="Logo" className="object-contain bg-gray-50 dark:bg-gray-900/50 p-8" style={{ aspectRatio: '1/1' }} />
        <div className="flex-grow p-12 text-center flex flex-col justify-center">
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
    </div>
  );
};

// Add a more robust check to see if the app is running in an Electron environment.
const isElectron = !!window.electronAPI;

// Wrap the file system API check in a try-catch block to prevent runtime errors
// in environments where accessing the APIs might be restricted.
const isFileSystemApiSupported = isElectron || (() => {
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
    // In Electron, we always start fresh to prompt for a folder.
    // Don't load potentially stale data from a previous browser-only session.
    if (isElectron) return { blocks: [], groups: [] };

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

const loadIdeSettingsFromStorage = (): Partial<IdeSettings> => {
    try {
        const saved = localStorage.getItem(SAVE_KEY_IDE_SETTINGS);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error("Failed to load IDE settings from local storage", e);
        localStorage.removeItem(SAVE_KEY_IDE_SETTINGS);
    }
    return {};
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
  // Use useState's lazy initializer to load from storage only once on initial render.
  const [initialAppState] = useState(loadInitialState);

  const { 
    state: historyState, 
    setState: setHistory, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<AppState>(initialAppState);

  const [liveBlocks, setLiveBlocks] = useState<Block[]>(historyState.blocks);
  const [liveGroups, setLiveGroups] = useState<BlockGroup[]>(historyState.groups);
  
  // Ref to hold the latest "live" state for callbacks that need it without causing re-renders.
  const liveStateRef = useRef({ blocks: liveBlocks, groups: liveGroups });
  // Update the ref on every render so callbacks always have the latest data.
  liveStateRef.current = { blocks: liveBlocks, groups: liveGroups };
  
  useEffect(() => {
    setLiveBlocks(historyState.blocks);
    setLiveGroups(historyState.groups);
  }, [historyState]);

  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const initialSettings = useRef(loadIdeSettingsFromStorage());

  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>(initialSettings.current.theme || 'system');
  const [apiKey, setApiKey] = useState<string>(initialSettings.current.apiKey || '');
  const [enableAiFeatures, setEnableAiFeatures] = useState<boolean>(initialSettings.current.enableAiFeatures ?? true);
  const [selectedModel, setSelectedModel] = useState<string>(initialSettings.current.selectedModel || 'gemini-2.5-flash');
  const [isClearConfirmVisible, setIsClearConfirmVisible] = useState(false);
  const [analysisTrigger, setAnalysisTrigger] = useState(0);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimeoutRef = useRef<number | null>(null);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(initialSettings.current.isRightSidebarOpen ?? true);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(initialSettings.current.rightSidebarWidth || 384);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(initialSettings.current.isLeftSidebarOpen ?? true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(initialSettings.current.leftSidebarWidth || 256);
  const [findUsagesHighlightIds, setFindUsagesHighlightIds] = useState<Set<string> | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);
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
  const [openTabs, setOpenTabs] = useState<EditorTab[]>(initialSettings.current.openTabs || [{ id: 'canvas', type: 'canvas' }]);
  const [activeTabId, setActiveTabId] = useState<string>(initialSettings.current.activeTabId || 'canvas');
  const [dirtyEditors, setDirtyEditors] = useState<Set<string>>(new Set());
  const [canvasFilters, setCanvasFilters] = useState({ story: true, screens: true, config: false });
  // Initialize welcome screen visibility synchronously based on the initial state.
  const [isWelcomeScreenVisible, setIsWelcomeScreenVisible] = useState(
    () => initialAppState.blocks.length === 0 && initialAppState.groups.length === 0
  );
  const [fileTree, setFileTree] = useState<FileSystemTreeNode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean, blockIds?: string[], filePaths?: string[], message?: string, warning?: string }>({ visible: false });
  const [clipboard, setClipboard] = useState<ClipboardState>(null);
  const [centerOnBlockRequest, setCenterOnBlockRequest] = useState<{ blockId: string, key: number } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loadingState, setLoadingState] = useState<{ visible: boolean, progress: number, message: string }>({ visible: false, progress: 0, message: '' });
  const [saveRequestCounter, setSaveRequestCounter] = useState(0);
  const [labelNodes, setLabelNodes] = useState<LabelNode[] | null>(null);
  const [routeLinks, setRouteLinks] = useState<RouteLink[] | null>(null);
  const [identifiedRoutes, setIdentifiedRoutes] = useState<IdentifiedRoute[] | null>(null);
  const [resizingHandle, setResizingHandle] = useState<'left' | 'right' | null>(null);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [hoverHighlightIds, setHoverHighlightIds] = useState<Set<string> | null>(null);
  const settingsSaveTimeoutRef = useRef<number | null>(null);
  const [imagesLastScanned, setImagesLastScanned] = useState<number | null>(null);
  const [isRefreshingImages, setIsRefreshingImages] = useState(false);
  const [audiosLastScanned, setAudiosLastScanned] = useState<number | null>(null);
  const [isRefreshingAudios, setIsRefreshingAudios] = useState(false);
  const editorInstances = useRef(new Map<string, monaco.editor.IStandaloneCodeEditor>());
  const postSaveCallback = useRef<((blockId: string) => void) | null>(null);


  // Since the Gemini SDK doesn't support dynamically listing models, we'll use a curated list.
  const availableModels = useMemo(() => ['gemini-2.5-flash', 'gemini-2.5-pro'], []);

  useEffect(() => {
    setSettingsLoaded(true);
  }, []);

  const handleSaveIdeSettings = useCallback(async () => {
    if (!projectRootPath && !directoryHandle) return;

    try {
        const tabsToSave = openTabs.filter(t => t.type !== 'route-canvas');
        if (tabsToSave.length === 0) {
            tabsToSave.push({ id: 'canvas', type: 'canvas' });
        }
        const currentActiveTabId = tabsToSave.some(t => t.id === activeTabId) ? activeTabId : 'canvas';

        const settings = {
            theme, isLeftSidebarOpen, leftSidebarWidth, isRightSidebarOpen, rightSidebarWidth,
            openTabs: tabsToSave, activeTabId: currentActiveTabId,
            apiKey, enableAiFeatures, selectedModel,
            imageScanDirectories: Array.from(imageScanDirectories.keys()),
            imageMetadata: Object.fromEntries(imageMetadata),
            audioScanDirectories: Array.from(audioScanDirectories.keys()),
            audioMetadata: Object.fromEntries(audioMetadata),
        };
        const settingsJson = JSON.stringify(settings, null, 2);

        if (isElectron && projectRootPath) {
            const filePath = `${projectRootPath}/game/${IDE_SETTINGS_FILE}`;
            await window.electronAPI!.writeFile(filePath, settingsJson);
        } else if (directoryHandle) {
            const gameDir = await directoryHandle.getDirectoryHandle('game', { create: true });
            const fileHandle = await gameDir.getFileHandle(IDE_SETTINGS_FILE, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(settingsJson);
            await writable.close();
        }
    } catch (e) {
        console.error("Failed to save IDE settings:", e);
    }
  }, [
      isElectron, projectRootPath, directoryHandle, imageMetadata, imageScanDirectories, audioMetadata, audioScanDirectories,
      theme, isLeftSidebarOpen, leftSidebarWidth, isRightSidebarOpen, rightSidebarWidth, openTabs, activeTabId, apiKey, enableAiFeatures, selectedModel
  ]);
  
  // Debounced effect to save settings to localStorage or project file
  useEffect(() => {
    if (!settingsLoaded) return;

    if (settingsSaveTimeoutRef.current) {
        clearTimeout(settingsSaveTimeoutRef.current);
    }

    settingsSaveTimeoutRef.current = window.setTimeout(() => {
      if (directoryHandle || projectRootPath) {
        handleSaveIdeSettings();
      } else {
        const tabsToSave = openTabs.filter(t => t.type !== 'route-canvas');
        if (tabsToSave.length === 0) {
            tabsToSave.push({ id: 'canvas', type: 'canvas' });
        }
        const currentActiveTabId = tabsToSave.some(t => t.id === activeTabId) ? activeTabId : 'canvas';

        const settings: IdeSettings = {
            theme, isLeftSidebarOpen, leftSidebarWidth, isRightSidebarOpen, rightSidebarWidth,
            openTabs: tabsToSave, activeTabId: currentActiveTabId,
            apiKey, enableAiFeatures, selectedModel,
        };
        try {
            localStorage.setItem(SAVE_KEY_IDE_SETTINGS, JSON.stringify(settings));
        } catch (e) {
            console.error("Failed to save IDE settings:", e);
        }
      }
    }, 1000);

    return () => {
        if (settingsSaveTimeoutRef.current) {
            clearTimeout(settingsSaveTimeoutRef.current);
        }
    };
  }, [
      theme, isLeftSidebarOpen, leftSidebarWidth, isRightSidebarOpen, rightSidebarWidth,
      openTabs, activeTabId, apiKey, enableAiFeatures, selectedModel, imageMetadata, audioMetadata,
      imageScanDirectories, audioScanDirectories, settingsLoaded, directoryHandle, projectRootPath,
      handleSaveIdeSettings
  ]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (resizingHandle === 'left') {
            setLeftSidebarWidth(w => Math.max(200, Math.min(e.clientX, 600)));
        } else if (resizingHandle === 'right') {
            setRightSidebarWidth(w => Math.max(200, Math.min(window.innerWidth - e.clientX, 800)));
        }
    };
    const handleMouseUp = () => {
        setResizingHandle(null);
    };

    if (resizingHandle) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };
  }, [resizingHandle]);

  const dismissToast = useCallback((id: string) => {
    setToasts(currentToasts => currentToasts.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = uuidv4();
    setToasts(currentToasts => [...currentToasts, { id, message, type }]);
  }, []);

  // Centralized directory picker to handle sandboxed environments
  const pickDirectory = useCallback(async (): Promise<FileSystemDirectoryHandle | null> => {
    if (!isFileSystemApiSupported) {
        addToast("Your browser does not support the File System Access API.", 'warning');
        return null;
    }
    try {
        if (isElectron) {
            addToast("This feature is not supported in the desktop app yet.", 'info');
            return null;
        }
        if (window.aistudio?.showDirectoryPicker) {
            return await window.aistudio.showDirectoryPicker();
        } else if (window.showDirectoryPicker) {
            return await window.showDirectoryPicker();
        } else {
            addToast("File System Access API could not be initialized.", 'error');
            return null;
        }
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            console.log('User cancelled directory picker.');
        } else {
            console.error("Error picking directory:", err);
            addToast(`Error picking directory: ${(err as Error).message}`, 'error');
        }
        return null;
    }
  }, [addToast]);

  const analysisResult = useRenpyAnalysis(liveBlocks, analysisTrigger);

  const activeTab = useMemo(() => openTabs.find(t => t.id === activeTabId) ?? openTabs[0], [openTabs, activeTabId]);
  const activeEditorBlock = useMemo(() => {
    if (activeTab?.type === 'editor') {
      return liveBlocks.find(b => b.id === activeTab.blockId);
    }
    return undefined;
  }, [activeTab, liveBlocks]);

  const commitChange = useCallback((newState: Partial<AppState>, dirtyIds: string[] = []) => {
    const updatedState = { ...historyState, ...newState };
    setLiveBlocks(updatedState.blocks);
    setLiveGroups(updatedState.groups);
    setHistory(updatedState);
    if (dirtyIds.length > 0) {
      setDirtyBlockIds(prev => new Set([...prev, ...dirtyIds]));
    }
  }, [setHistory, historyState]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (!directoryHandle && !projectRootPath) { // Only auto-save to localStorage if not using File System API
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
  }, [historyState, directoryHandle, projectRootPath]);


  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const editorThemeForMonaco = useMemo(() => {
      const currentTheme = theme === 'system' ? systemTheme : theme;
      const darkThemes: Theme[] = ['dark', 'solarized-dark', 'colorful'];
      return darkThemes.includes(currentTheme) ? 'dark' : 'light';
  }, [theme, systemTheme]);

  useEffect(() => {
    const root = window.document.documentElement;
    const finalTheme = theme === 'system' ? systemTheme : theme;
    
    // Remove all possible theme classes before adding the correct one.
    root.classList.remove('dark', 'theme-solarized-light', 'theme-solarized-dark', 'theme-colorful', 'theme-colorful-light');

    // Add the correct class(es) for the final theme.
    switch (finalTheme) {
        case 'dark':
            root.classList.add('dark');
            break;
        case 'solarized-light':
            root.classList.add('theme-solarized-light');
            break;
        case 'solarized-dark':
            root.classList.add('dark', 'theme-solarized-dark');
            break;
        case 'colorful':
            root.classList.add('dark', 'theme-colorful');
            break;
        case 'colorful-light':
            root.classList.add('theme-colorful-light');
            break;
        case 'light':
            // No class needed for default light theme
            break;
    }
  }, [theme, systemTheme]);
  
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
        warning: (directoryHandle || projectRootPath) ? "This will permanently delete items from your project folder." : "This action cannot be undone."
    });
  }, [liveBlocks, directoryHandle, projectRootPath]);

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.visible) return;
    const { blockIds, filePaths } = deleteConfirm;

    const blockIdsToDelete = new Set(blockIds || []);
    const filePathsToDelete = new Set<string>(filePaths || []);

    filePathsToDelete.forEach(path => {
        const block = liveBlocks.find(b => b.filePath === path);
        if (block) blockIdsToDelete.add(block.id);
    });
    blockIdsToDelete.forEach(id => {
        const block = liveBlocks.find(b => b.id === id);
        if (block?.filePath) filePathsToDelete.add(block.filePath);
    });

    if (isElectron && projectRootPath && filePathsToDelete.size > 0) {
        for (const path of filePathsToDelete) {
            const fullPath = `${projectRootPath}/${path}`;
            try {
                const result = await window.electronAPI!.removeEntry(fullPath);
                if (!result.success) {
                    console.error(`Failed to delete ${path}:`, result.error);
                    addToast(`Could not delete ${path}`, 'error');
                }
            } catch (err) {
                 console.error(`Failed to delete file ${path} from disk:`, err);
                 addToast(`Error deleting ${path}`, 'error');
            }
        }
    } else if (directoryHandle && filePathsToDelete.size > 0) {
        for (const path of filePathsToDelete) {
            try {
                const pathParts = path.split('/');
                const fileName = pathParts.pop()!;
                if (!fileName) continue;
                let currentDir = directoryHandle;
                for (let i = 0; i < pathParts.length - 1; i++) {
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
        const block = liveBlocks.find(b => b.id === blockId);
        if (!block) return;
        const newTab: EditorTab = { id: blockId, type: 'editor', blockId, filePath: block.filePath };
        if (line) {
            newTab.scrollRequest = { line, key: Date.now() };
        }
        setOpenTabs(tabs => [...tabs, newTab]);
        setActiveTabId(newTab.id);
    }
  }, [openTabs, liveBlocks]);
  
  const handleOpenImageTab = useCallback((filePath: string) => {
    const editorTabId = 'image_editor';
    setOpenTabs(tabs => {
        const existingTab = tabs.find(t => t.id === editorTabId);
        if (existingTab) {
            return tabs.map(t => t.id === editorTabId ? { ...t, filePath } : t);
        }
        return [...tabs, { id: editorTabId, type: 'image', filePath }];
    });
    setActiveTabId(editorTabId);
  }, []);

  const handleOpenAudioTab = useCallback((filePath: string) => {
    const editorTabId = 'audio_editor';
     setOpenTabs(tabs => {
        const existingTab = tabs.find(t => t.id === editorTabId);
        if (existingTab) {
            return tabs.map(t => t.id === editorTabId ? { ...t, filePath } : t);
        }
        return [...tabs, { id: editorTabId, type: 'audio', filePath }];
    });
    setActiveTabId(editorTabId);
  }, []);

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
          setActiveTabId(nextTab ? nextTab.id : (openTabs.length > 1 ? openTabs[0].id : ''));
      }

      // Clear Route Canvas state if its tab is closed, to free up memory
      if (tabIdToClose === 'route-canvas') {
          setLabelNodes(null);
          setRouteLinks(null);
          setIdentifiedRoutes(null);
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

  const handleOpenStaticTab = useCallback((type: 'canvas' | 'route-canvas') => {
    const existingTab = openTabs.find(t => t.type === type);
    if (existingTab) {
        setActiveTabId(existingTab.id);
    } else {
        const newTab: EditorTab = { id: type, type: type };
        setOpenTabs(tabs => [...tabs, newTab]);
        setActiveTabId(newTab.id);
    }
  }, [openTabs]);
  
  const handleSaveBlockContent = useCallback((blockId: string, content: string) => {
    if (liveBlocks.find(b => b.id === blockId)?.content === content) {
        if (postSaveCallback.current) {
            setTimeout(() => {
                if (postSaveCallback.current) {
                    postSaveCallback.current(blockId);
                    postSaveCallback.current = null;
                }
            }, 0);
        }
        return;
    }

    const newBlocks = liveBlocks.map(block => block.id === blockId ? { ...block, content } : block );
    commitChange({ blocks: newBlocks }, [blockId]);
    setDirtyEditors(prev => {
      const newDirty = new Set(prev);
      newDirty.delete(blockId);
      return newDirty;
    });

    if (postSaveCallback.current) {
        setTimeout(() => {
            if (postSaveCallback.current) {
                postSaveCallback.current(blockId);
                postSaveCallback.current = null;
            }
        }, 0);
    }
  }, [liveBlocks, commitChange]);

  const handleSaveActiveEditor = useCallback(() => {
    if (activeTab?.type === 'editor' && activeTab.blockId) {
      const editorInstance = editorInstances.current.get(activeTab.blockId);
      if (editorInstance) {
        handleSaveBlockContent(activeTab.blockId, editorInstance.getValue());
      }
    }
  }, [activeTab, handleSaveBlockContent]);

  const handleEditorDirtyChange = useCallback((blockId: string, isDirty: boolean) => {
    setDirtyEditors(prev => {
        const newDirty = new Set(prev);
        if (isDirty) newDirty.add(blockId);
        else newDirty.delete(blockId);
        return newDirty;
    });
  }, []);

  const handleEditorMount = useCallback((blockId: string, editor: monaco.editor.IStandaloneCodeEditor) => {
    editorInstances.current.set(blockId, editor);
  }, []);

  const handleEditorUnmount = useCallback((blockId: string) => {
    editorInstances.current.delete(blockId);
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
    commitChange({ blocks: [...liveBlocks, newBlock] }, [newBlock.id]);
    if (fileTree) {
        setFileTree(addNodeToFileTree(fileTree, filename));
    }
    setSelectedBlockIds([newBlock.id]);
    setSelectedGroupIds([]);
    handleOpenEditorTab(newBlock.id);
  }, [liveBlocks, commitChange, handleOpenEditorTab, fileTree]);

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
                const oldDefRegex = new RegExp(`(?:^\\s*#\\s*profile:.*$\\r?\\n)?^\\s*define\\s+${oldTag}\\s*=\\s*Character\\s*\\(([\\s\\S]*?)\\)`, "m");
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
        commitChange({ blocks: newBlocks }, Array.from(dirtyIds));
        
        // Close the 'new' tab and open one for the real character
        if (isNew) {
             const newTabId = `char_editor_${'new_character'}`;
             setOpenTabs(tabs => tabs.filter(t => t.id !== newTabId));
             handleOpenCharacterEditor(newCharData.tag);
        }
    }, [liveBlocks, commitChange, fileTree, analysisResult.characters, handleOpenCharacterEditor]);


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
    commitChange({ blocks: newBlocks }, [dirtyId]);
  }, [liveBlocks, commitChange, fileTree]);

  const handleFindVariableUsages = useCallback((variableName: string) => {
    const blockIds = new Set<string>();
    const definition = analysisResult.variables.get(variableName);
    if (definition) blockIds.add(definition.definedInBlockId);
    const usages = analysisResult.variableUsages.get(variableName) || [];
    usages.forEach(usage => blockIds.add(usage.blockId));
    setFindUsagesHighlightIds(blockIds);
    setActiveTabId('canvas');
  }, [analysisResult.variables, analysisResult.variableUsages]);

  const handleHoverHighlightStart = useCallback((key: string, type: 'character' | 'variable') => {
    const blockIds = new Set<string>();
    if (type === 'character') {
      for (const [blockId, lines] of analysisResult.dialogueLines.entries()) {
        if (lines.some(line => line.tag === key)) blockIds.add(blockId);
      }
    } else { // variable
      const definition = analysisResult.variables.get(key);
      if (definition) blockIds.add(definition.definedInBlockId);
      const usages = analysisResult.variableUsages.get(key) || [];
      usages.forEach(usage => blockIds.add(usage.blockId));
    }
    setHoverHighlightIds(blockIds);
  }, [analysisResult]);

  const handleHoverHighlightEnd = useCallback(() => {
    setHoverHighlightIds(null);
  }, []);

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
    
    commitChange({ blocks: [...liveBlocks, newBlock] }, [newBlock.id]);
    if (fileTree) {
        setFileTree(addNodeToFileTree(fileTree, filePath));
    }
    setSelectedBlockIds([newBlock.id]);
    setSelectedGroupIds([]);
    handleOpenEditorTab(newBlock.id);
  }, [liveBlocks, commitChange, handleOpenEditorTab, fileTree]);

  const handleFindScreenDefinition = useCallback((screenName: string) => {
      const screen = analysisResult.screens.get(screenName);
      if (screen) {
          handleOpenEditorTab(screen.definedInBlockId, screen.line);
      }
  }, [analysisResult.screens, handleOpenEditorTab]);

  const updateBlock = useCallback((id: string, newBlockData: Partial<Block>) => {
    setLiveBlocks(prevBlocks =>
      prevBlocks.map(block =>
        block.id === id ? { ...block, ...newBlockData } : block
      )
    );
    setDirtyBlockIds(prev => new Set(prev).add(id));
  }, []);

  const handleSaveToDisk = useCallback(async (idsToSave?: string[]) => {
    if (!directoryHandle && !projectRootPath) return;

    const blockIdsToProcess = idsToSave ? new Set(idsToSave) : dirtyBlockIds;
    if (blockIdsToProcess.size === 0) return;

    setSaveStatus('saving');
    let allSavesSuccessful = true;
    const successfullySavedIds = new Set<string>();

    if (isElectron && projectRootPath) {
        for (const blockId of blockIdsToProcess) {
            const block = liveStateRef.current.blocks.find(b => b.id === blockId);
            if (!block || !block.filePath) continue;

            const fullPath = `${projectRootPath}/${block.filePath}`;
            try {
                const result = await window.electronAPI!.writeFile(fullPath, block.content);
                if (result.success) {
                    successfullySavedIds.add(blockId);
                } else {
                    allSavesSuccessful = false;
                    addToast(`Could not save file: ${block.filePath}. Error: ${result.error}`, 'error');
                }
            } catch (err) {
                allSavesSuccessful = false;
                console.error(`Failed to save block ${block.title || block.id}`, err);
                addToast(`Could not save file: ${block.filePath || block.title || 'Untitled'}`, 'error');
            }
        }
    } else if (directoryHandle) {
        try {
            const permissionStatus = await directoryHandle.requestPermission({ mode: 'readwrite' });
            if (permissionStatus !== 'granted') {
                addToast('Permission to save files was denied.', 'error');
                setSaveStatus('error');
                return;
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                 addToast('Save cancelled: permission not granted.', 'warning');
            } else {
                console.error("Permission request failed:", err);
                addToast('Could not get permission to save files.', 'error');
            }
            setSaveStatus('error');
            return;
        }

        const updatedBlocks = [...liveStateRef.current.blocks];
        for (const blockId of blockIdsToProcess) {
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
                allSavesSuccessful = false;
                console.error(`Failed to save block ${block.title || block.id}`, err);
                addToast(`Could not save file: ${block.filePath || block.title || 'Untitled'}`, 'error');
            }
        }
        // Only commit if file handles were updated.
        if (Array.from(blockIdsToProcess).some(id => !liveBlocks.find(b => b.id === id)?.fileHandle)) {
            commitChange({ blocks: updatedBlocks });
        }
    }
    
    setDirtyBlockIds(prev => {
        const newDirty = new Set(prev);
        successfullySavedIds.forEach(id => newDirty.delete(id));
        return newDirty;
    });
    
    setSaveStatus(allSavesSuccessful ? 'saved' : 'error');
  }, [directoryHandle, projectRootPath, dirtyBlockIds, liveBlocks, commitChange, analysisResult.firstLabels, addToast]);

  const handleGlobalSave = useCallback(() => {
    const dirtyEditorChanges = new Map<string, string>();
    dirtyEditors.forEach(blockId => {
        const editor = editorInstances.current.get(blockId);
        if (editor) {
            dirtyEditorChanges.set(blockId, editor.getValue());
        }
    });

    if (dirtyEditorChanges.size === 0 && dirtyBlockIds.size === 0) return;

    const newBlocks = produce(liveBlocks, draft => {
        dirtyEditorChanges.forEach((content, blockId) => {
            const blockIndex = draft.findIndex(b => b.id === blockId);
            if (blockIndex !== -1 && draft[blockIndex].content !== content) {
                draft[blockIndex].content = content;
            }
        });
    });

    const allDirtyIdsInState = new Set([...dirtyBlockIds, ...dirtyEditorChanges.keys()]);

    commitChange({ blocks: newBlocks }, Array.from(allDirtyIdsInState));
    setDirtyEditors(new Set());
    
    if (directoryHandle || projectRootPath) {
        setSaveRequestCounter(c => c + 1);
    }
  }, [dirtyEditors, liveBlocks, dirtyBlockIds, commitChange, directoryHandle, projectRootPath]);

  useEffect(() => {
    if (saveRequestCounter > 0) {
        handleSaveToDisk();
    }
  }, [saveRequestCounter, handleSaveToDisk]);

  const handleSaveActiveTabFile = useCallback(() => {
    if (activeTab?.type !== 'editor' || !activeTab.blockId || (!directoryHandle && !projectRootPath)) return;
    
    postSaveCallback.current = (savedBlockId: string) => {
        handleSaveToDisk([savedBlockId]);
    };

    handleSaveActiveEditor();
  }, [activeTab, directoryHandle, projectRootPath, handleSaveActiveEditor, handleSaveToDisk]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActiveTabFile();
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
              commitChange({ groups: newGroups });
              setSelectedGroupIds([]);
          }
        } else if (selectedBlockIds.length === 1 && e.key === 'f') { e.preventDefault(); handleOpenEditorTab(selectedBlockIds[0]); } 
        else if (e.key === 'n') { e.preventDefault(); addBlock(); } 
        else if (e.key === 'g' && !e.shiftKey) {
            e.preventDefault();
            if (selectedGroupIds.length > 0) {
              const blockIdsFromUngrouped = liveGroups.filter(g => selectedGroupIds.includes(g.id)).flatMap(g => g.blockIds);
              const newGroups = liveGroups.filter(g => !selectedGroupIds.includes(g.id));
              commitChange({ groups: newGroups });
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
              commitChange({ groups: [...liveGroups, newGroup] });
              setSelectedBlockIds([]);
              setSelectedGroupIds([newGroup.id]);
            }
        } else if (e.key === 'G' && e.shiftKey) {
            if (selectedGroupIds.length === 0) return;
            e.preventDefault();
            const blockIdsFromUngrouped = liveGroups.filter(g => selectedGroupIds.includes(g.id)).flatMap(g => g.blockIds);
            const newGroups = liveGroups.filter(g => !selectedGroupIds.includes(g.id));
            commitChange({ groups: newGroups });
            setSelectedGroupIds([]);
            setSelectedBlockIds(Array.from(new Set(blockIdsFromUngrouped)));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockIds, selectedGroupIds, requestDelete, handleOpenEditorTab, addBlock, liveBlocks, liveGroups, commitChange, undo, redo, handleSaveActiveTabFile]);

  const handleSettingsChange = (key: string, value: any) => {
    if (key === 'theme') {
      setTheme(value as Theme);
    }
    if (key === 'apiKey') {
      setApiKey(value as string);
    }
    if (key === 'enableAiFeatures') {
      setEnableAiFeatures(value as boolean);
    }
    if (key === 'selectedModel') {
      setSelectedModel(value as string);
    }
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
    commitChange({ blocks: newBlocks });
  };
  
  const scanDirectoryForImages = async (dirHandle: FileSystemDirectoryHandle, baseName: string, isProjectScan: boolean) => {
    const newImages = new Map<string, ProjectImage>();
     const scan = async (handle: FileSystemDirectoryHandle, currentPath: string) => {
        for await (const entry of handle.values()) {
            const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
            if (entry.kind === 'file' && /\.(png|jpe?g|webp)$/i.test(entry.name)) {
                const fileHandle = entry as FileSystemFileHandle;
                const file = await fileHandle.getFile();
                // The unique key for an image is its base directory name + its relative path
                const imageKey = `${baseName}/${newPath}`;
                const projectImage: ProjectImage = {
                    filePath: imageKey,
                    fileName: entry.name,
                    fileHandle,
                    isInProject: isProjectScan,
                    projectFilePath: isProjectScan ? imageKey : undefined,
                    lastModified: file.lastModified,
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
                    lastModified: file.lastModified,
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
        return await scanDirectoryForImages(imagesDir, 'game/images', true);
    } catch (e) {
        console.warn("Could not find or access 'game/images' directory.", e);
        return new Map();
    }
  };

  const loadProjectAudios = async (rootHandle: FileSystemDirectoryHandle) => {
    try {
        const gameDir = await rootHandle.getDirectoryHandle('game');
        const audioDir = await gameDir.getDirectoryHandle('audio');
        return await scanDirectoryForAudios(audioDir, 'game/audio', true);
    } catch (e) {
        console.warn("Could not find or access 'game/audio' directory.", e);
        return new Map();
    }
  };

  const loadIdeSettings = async (rootHandle: FileSystemDirectoryHandle): Promise<Partial<IdeSettings> & { imageMetadata?: Map<string, ImageMetadata>; audioMetadata?: Map<string, AudioMetadata> }> => {
      try {
          const gameDir = await rootHandle.getDirectoryHandle('game');
          const settingsFileHandle = await gameDir.getFileHandle(IDE_SETTINGS_FILE);
          const file = await settingsFileHandle.getFile();
          const content = await file.text();
          const settings = JSON.parse(content);
          
          if (settings.theme) setTheme(settings.theme);
          if (settings.apiKey) setApiKey(settings.apiKey);
          if (typeof settings.enableAiFeatures === 'boolean') setEnableAiFeatures(settings.enableAiFeatures);
          if (settings.selectedModel) setSelectedModel(settings.selectedModel);
          if (typeof settings.isLeftSidebarOpen === 'boolean') setIsLeftSidebarOpen(settings.isLeftSidebarOpen);
          if (typeof settings.leftSidebarWidth === 'number') setLeftSidebarWidth(settings.leftSidebarWidth);
          if (typeof settings.isRightSidebarOpen === 'boolean') setIsRightSidebarOpen(settings.isRightSidebarOpen);
          if (typeof settings.rightSidebarWidth === 'number') setRightSidebarWidth(settings.rightSidebarWidth);

          const imageMetadataMap = new Map<string, ImageMetadata>();
          if (settings.imageMetadata) {
              for (const [filePath, meta] of Object.entries(settings.imageMetadata)) {
                  imageMetadataMap.set(filePath, meta as ImageMetadata);
              }
          }
          const audioMetadataMap = new Map<string, AudioMetadata>();
          if (settings.audioMetadata) {
              for (const [filePath, meta] of Object.entries(settings.audioMetadata)) {
                  audioMetadataMap.set(filePath, meta as AudioMetadata);
              }
          }

          return {
              openTabs: settings.openTabs,
              activeTabId: settings.activeTabId,
              imageMetadata: imageMetadataMap,
              audioMetadata: audioMetadataMap,
          };
      } catch (e) {
          console.log("No project settings file found. A new one will be created if needed.");
          setTheme('system');
          setApiKey('');
          setEnableAiFeatures(true);
          setSelectedModel('gemini-2.5-flash');
          setIsLeftSidebarOpen(true);
          setLeftSidebarWidth(256);
          setIsRightSidebarOpen(true);
          setRightSidebarWidth(384);
          
          return {
              openTabs: [{ id: 'canvas', type: 'canvas' }],
              activeTabId: 'canvas',
              imageMetadata: new Map(),
              audioMetadata: new Map(),
          };
      }
  };

  const requestOpenFolder = () => {
    // Check for unsaved changes in file-system mode, or any blocks in browser-only mode.
    const hasUnsavedWork = ((directoryHandle || projectRootPath) && dirtyBlockIds.size > 0) || (!directoryHandle && !projectRootPath && liveBlocks.length > 0);

    if (hasUnsavedWork) {
        setOpenFolderConfirmVisible(true);
    } else {
        handleOpenFolder(); // Proceed directly if no work would be lost.
    }
  };

  const tidyUpLabelLayout = useCallback((nodes: LabelNode[], links: RouteLink[]): LabelNode[] => {
      if (nodes.length === 0) return [];
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const adj = new Map<string, string[]>();
      const inDegree = new Map<string, number>();
      
      nodes.forEach(n => { adj.set(n.id, []); inDegree.set(n.id, 0); });
      
      links.forEach(link => {
          if (adj.has(link.sourceId) && inDegree.has(link.targetId)) {
              adj.get(link.sourceId)!.push(link.targetId);
              inDegree.set(link.targetId, (inDegree.get(link.targetId) || 0) + 1);
          }
      });

      const queue: string[] = [];
      inDegree.forEach((degree, id) => { if (degree === 0) queue.push(id); });
      if (queue.length === 0 && nodes.length > 0) {
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
      if (nodes.length > visited.size) layers.push(nodes.filter(n => !visited.has(n.id)).map(n => n.id));

      const PADDING_X = 100, PADDING_Y = 50;
      let currentX = 0;
      const newNodes = [...nodes];
      for (const layer of layers) {
          let maxLayerWidth = 0, currentLayerHeight = 0;
          layer.forEach(id => {
              const node = nodeMap.get(id);
              if (node) { maxLayerWidth = Math.max(maxLayerWidth, node.width); currentLayerHeight += node.height; }
          });
          currentLayerHeight += Math.max(0, layer.length - 1) * PADDING_Y;
          let currentY = -currentLayerHeight / 2;
          for (const id of layer) {
              const node = nodeMap.get(id);
              const nodeIndex = newNodes.findIndex(b => b.id === id);
              if (node && nodeIndex !== -1) {
                  const xPos = currentX + (maxLayerWidth - node.width) / 2;
                  newNodes[nodeIndex] = { ...node, position: { x: xPos, y: currentY } };
                  currentY += node.height + PADDING_Y;
              }
          }
          currentX += maxLayerWidth + PADDING_X;
      }
      return newNodes;
  }, []);

  const handleOpenFolder = async () => {
    setLoadingState({ visible: true, progress: 0, message: 'Opening project folder...' });
    
    // This inner function processes loaded data, shared by both Electron and Web paths.
    const processProjectData = (newBlocks: Block[], projectSettings: Partial<IdeSettings>) => {
        const filePathToBlockMap = new Map<string, Block>();
        newBlocks.forEach(b => {
            if (b.filePath) filePathToBlockMap.set(b.filePath, b);
        });

        const validTabs: EditorTab[] = [];
        const loadedTabs: EditorTab[] = projectSettings.openTabs && Array.isArray(projectSettings.openTabs) && projectSettings.openTabs.length > 0
            ? projectSettings.openTabs
            : [{ id: 'canvas', type: 'canvas' }];
        const loadedActiveTabId = projectSettings.activeTabId || 'canvas';

        loadedTabs.forEach(tab => {
            if (tab.type === 'editor' && tab.filePath) {
                const correspondingBlock = filePathToBlockMap.get(tab.filePath);
                if (correspondingBlock) {
                    validTabs.push({ ...tab, id: correspondingBlock.id, blockId: correspondingBlock.id });
                }
            } else if (tab.type !== 'editor') {
                validTabs.push(tab);
            }
        });

        if (!validTabs.some(t => t.type === 'canvas')) {
            validTabs.unshift({ id: 'canvas', type: 'canvas' });
        }

        let finalActiveTabId = 'canvas';
        const oldActiveTab = loadedTabs.find(t => t.id === loadedActiveTabId);
        if (oldActiveTab) {
            const newVersionOfActiveTab = validTabs.find(t => (t.filePath && t.filePath === oldActiveTab.filePath && t.type === oldActiveTab.type) || t.id === oldActiveTab.id);
            if (newVersionOfActiveTab) {
                finalActiveTabId = newVersionOfActiveTab.id;
            } else if (validTabs.length > 0) {
                finalActiveTabId = validTabs[0].id;
            }
        }
        setOpenTabs(validTabs);
        setActiveTabId(finalActiveTabId);
        
        setLoadingState(s => ({ ...s, progress: 75, message: 'Analyzing story flow...' }));
        const preliminaryAnalysis = performRenpyAnalysis(newBlocks);

        setLoadingState(s => ({ ...s, progress: 90, message: 'Arranging canvas...' }));
        const laidOutBlocks = tidyUpLayout(newBlocks, preliminaryAnalysis.links);
        
        commitChange({ blocks: laidOutBlocks, groups: [] });
        setSelectedBlockIds([]);
        setSelectedGroupIds([]);
        setDirtyBlockIds(new Set());
        setIsWelcomeScreenVisible(false);
    };

    if (isElectron) {
        try {
            const rootPath = await window.electronAPI!.openDirectory();
            if (!rootPath) {
                setLoadingState({ visible: false, progress: 0, message: '' });
                return;
            }
            setProjectRootPath(rootPath);
            setDirectoryHandle(null);

            setLoadingState(s => ({ ...s, progress: 10, message: 'Reading project files...' }));
            const projectData = await window.electronAPI!.loadProject(rootPath);
            setFileTree(projectData.tree);

            const projectImagesMap = new Map<string, ProjectImage>();
            projectData.images.forEach(img => {
                const isProjectImage = img.path.startsWith('game/images/');
                projectImagesMap.set(img.path, {
                    filePath: img.path, fileName: img.path.split('/').pop() || '', dataUrl: img.dataUrl,
                    fileHandle: null, isInProject: isProjectImage, projectFilePath: isProjectImage ? img.path : undefined,
                    lastModified: img.lastModified
                });
            });
            setProjectImages(projectImagesMap);
            if (projectImagesMap.size > 0) setImagesLastScanned(Date.now());

            const projectAudiosMap = new Map<string, RenpyAudio>();
            projectData.audios.forEach(aud => {
                const isProjectAudio = aud.path.startsWith('game/audio/');
                 projectAudiosMap.set(aud.path, {
                    filePath: aud.path, fileName: aud.path.split('/').pop() || '', dataUrl: aud.dataUrl,
                    fileHandle: null, isInProject: isProjectAudio, projectFilePath: isProjectAudio ? aud.path : undefined,
                    lastModified: aud.lastModified
                });
            });
            setProjectAudios(projectAudiosMap);
            if (projectAudiosMap.size > 0) setAudiosLastScanned(Date.now());

            const projectSettings = projectData.settings || {};
            // Apply settings
            if (projectSettings.theme) setTheme(projectSettings.theme);
            if (projectSettings.apiKey) setApiKey(projectSettings.apiKey);
            if (typeof projectSettings.enableAiFeatures === 'boolean') setEnableAiFeatures(projectSettings.enableAiFeatures);
            if (projectSettings.selectedModel) setSelectedModel(projectSettings.selectedModel);
            if (typeof projectSettings.isLeftSidebarOpen === 'boolean') setIsLeftSidebarOpen(projectSettings.isLeftSidebarOpen);
            if (typeof projectSettings.leftSidebarWidth === 'number') setLeftSidebarWidth(projectSettings.leftSidebarWidth);
            if (typeof projectSettings.isRightSidebarOpen === 'boolean') setIsRightSidebarOpen(projectSettings.isRightSidebarOpen);
            if (typeof projectSettings.rightSidebarWidth === 'number') setRightSidebarWidth(projectSettings.rightSidebarWidth);

            const imageMetadataMap = new Map<string, ImageMetadata>();
            if (projectSettings.imageMetadata) {
                for (const [filePath, meta] of Object.entries(projectSettings.imageMetadata)) {
                    imageMetadataMap.set(filePath, meta as ImageMetadata);
                }
            }
            setImageMetadata(imageMetadataMap);

            const audioMetadataMap = new Map<string, AudioMetadata>();
            if (projectSettings.audioMetadata) {
                for (const [filePath, meta] of Object.entries(projectSettings.audioMetadata)) {
                    audioMetadataMap.set(filePath, meta as AudioMetadata);
                }
            }
            setAudioMetadata(audioMetadataMap);

            setLoadingState(s => ({ ...s, progress: 50, message: 'Processing script files...' }));
            const newBlocks: Block[] = projectData.files.map(file => ({
                id: uuidv4(), content: file.content, position: { x: 0, y: 0 },
                width: 300, height: 200, filePath: file.path, fileHandle: null,
            }));
            
            processProjectData(newBlocks, projectSettings);
        } catch (err) {
            console.error("Error opening directory in Electron:", err);
            addToast(`Error opening directory: ${(err as Error).message}`, 'error');
        } finally {
            setLoadingState({ visible: false, progress: 0, message: '' });
        }
    } else { // Browser Path
        try {
            const rootHandle = await pickDirectory();
            if (!rootHandle) {
                setLoadingState({ visible: false, progress: 0, message: '' });
                return;
            }
            setDirectoryHandle(rootHandle);
            setProjectRootPath(null);

            setLoadingState(s => ({ ...s, progress: 10, message: 'Building file tree...' }));
            const tree = await buildTreeFromHandle(rootHandle);
            setFileTree(tree);
            
            setLoadingState(s => ({ ...s, progress: 25, message: 'Loading project assets...' }));
            const projectImagesMap = await loadProjectImages(rootHandle);
            setProjectImages(projectImagesMap);
            if (projectImagesMap.size > 0) setImagesLastScanned(Date.now());
            const projectAudiosMap = await loadProjectAudios(rootHandle);
            setProjectAudios(projectAudiosMap);
            if (projectAudiosMap.size > 0) setAudiosLastScanned(Date.now());

            const projectSettings = await loadIdeSettings(rootHandle);
            setImageMetadata(projectSettings.imageMetadata || new Map());
            setAudioMetadata(projectSettings.audioMetadata || new Map());

            setLoadingState(s => ({ ...s, progress: 50, message: 'Reading script files...' }));
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
                        if (entry.name.toLowerCase() !== 'images' && entry.name.toLowerCase() !== 'audio') {
                            await findRpyFilesRecursively(entry as FileSystemDirectoryHandle, newPath);
                        }
                    }
                }
            };
            await findRpyFilesRecursively(rootHandle, '');

            processProjectData(newBlocks, projectSettings);
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') console.log('User cancelled directory picker.');
          else {
            console.error("Error opening directory:", err);
            addToast(`Error opening directory: ${(err as Error).message}`, 'error');
          }
        } finally {
            setLoadingState({ visible: false, progress: 0, message: '' });
        }
    }
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
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const processUploadedFile = async (file: File) => {
    setLoadingState({ visible: true, progress: 0, message: 'Processing .zip file...' });
    try {
      const zip = await JSZip.loadAsync(file);
      const newBlocks: Block[] = [];
      const newImages = new Map<string, ProjectImage>();
      const newAudios = new Map<string, RenpyAudio>();
      const filePaths: string[] = [];
      
      // FIX: Cast Object.values to any[] to resolve type inference issues with JSZipObject properties.
      const zipFiles: any[] = Object.values(zip.files);
      let processedCount = 0;
      
      for (const zipEntry of zipFiles) {
        processedCount++;
        setLoadingState(s => ({ 
            ...s, 
            progress: Math.round((processedCount / zipFiles.length) * 50), 
            message: `Scanning: ${zipEntry.name}` 
        }));

        if (zipEntry.dir) continue;
        const relativePath = zipEntry.name;
        filePaths.push(relativePath);

        if (relativePath.endsWith('.rpy')) {
            const content = await zipEntry.async('string');
            newBlocks.push({ id: uuidv4(), content, position: { x: 0, y: 0 }, width: 300, height: 200, filePath: relativePath });
        } else if (/\.(png|jpe?g|webp)$/i.test(relativePath) && (relativePath.toLowerCase().startsWith('game/images/') || relativePath.toLowerCase().startsWith('images/'))) {
            const blob = await zipEntry.async('blob');
            const dataUrl = await fileToDataUrl(blob);
            const fileName = relativePath.split('/').pop() || '';
            const filePath = relativePath.toLowerCase().startsWith('game/') ? relativePath : `game/${relativePath}`;
            newImages.set(filePath, { filePath, fileName, dataUrl, fileHandle: null, isInProject: true, projectFilePath: filePath, lastModified: zipEntry.date.getTime() });
        } else if (/\.(mp3|ogg|wav|opus)$/i.test(relativePath) && (relativePath.toLowerCase().startsWith('game/audio/') || relativePath.toLowerCase().startsWith('audio/'))) {
            const blob = await zipEntry.async('blob');
            const dataUrl = await fileToDataUrl(blob);
            const fileName = relativePath.split('/').pop() || '';
            const filePath = relativePath.toLowerCase().startsWith('game/') ? relativePath : `game/${relativePath}`;
            newAudios.set(filePath, { filePath, fileName, dataUrl, fileHandle: null, isInProject: true, projectFilePath: filePath, lastModified: zipEntry.date.getTime() });
        }
      }
      
      setLoadingState(s => ({ ...s, progress: 60, message: 'Building file tree...' }));
      const tree = buildFileTreeFromPaths(filePaths);
      setFileTree(tree);

      setDirectoryHandle(null);
      setProjectRootPath(null);
      setDirtyBlockIds(new Set());
      setProjectImages(newImages);
      if (newImages.size > 0) setImagesLastScanned(Date.now());
      setImageMetadata(new Map());
      setProjectAudios(newAudios);
      if (newAudios.size > 0) setAudiosLastScanned(Date.now());
      setAudioMetadata(new Map());
      
      setLoadingState(s => ({ ...s, progress: 75, message: 'Analyzing story flow...' }));
      const preliminaryAnalysis = performRenpyAnalysis(newBlocks);

      setLoadingState(s => ({ ...s, progress: 90, message: 'Arranging canvas...' }));
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
      setLoadingState({ visible: false, progress: 0, message: '' });
    }
  };


  const updateBlockPositions = useCallback((updates: { id: string, position: Position }[]) => {
    const updatesMap = new Map(updates.map(u => [u.id, u.position]));
    setLiveBlocks(prevBlocks => prevBlocks.map(block => updatesMap.has(block.id) ? { ...block, position: updatesMap.get(block.id)! } : block));
  }, []);

  const updateGroup = useCallback((id: string, newGroupData: Partial<BlockGroup>) => {
    setLiveGroups(prevGroups => prevGroups.map(group => (group.id === id ? { ...group, ...newGroupData } : group)));
  }, []);

  const updateGroupPositions = useCallback((updates: { id: string, position: Position }[]) => {
    const updatesMap = new Map(updates.map(u => [u.id, u.position]));
    setLiveGroups(prev => prev.map(group => updatesMap.has(group.id) ? { ...group, position: updatesMap.get(group.id)! } : group));
  }, []);

  const onInteractionEnd = useCallback(() => {
    const { blocks: currentLiveBlocks, groups: currentLiveGroups } = liveStateRef.current;
    const hasChanges =
      historyState.blocks.length !== currentLiveBlocks.length ||
      historyState.groups.length !== currentLiveGroups.length ||
      currentLiveBlocks.some(liveBlock => {
        const originalBlock = historyState.blocks.find(b => b.id === liveBlock.id);
        return (
          !originalBlock ||
          originalBlock.position.x !== liveBlock.position.x ||
          originalBlock.position.y !== liveBlock.position.y ||
          originalBlock.width !== liveBlock.width ||
          originalBlock.height !== liveBlock.height
        );
      }) ||
      currentLiveGroups.some(liveGroup => {
        const originalGroup = historyState.groups.find(g => g.id === liveGroup.id);
        return (
          !originalGroup ||
          originalGroup.position.x !== liveGroup.position.x ||
          originalGroup.position.y !== liveGroup.position.y ||
          originalGroup.width !== liveGroup.width ||
          originalGroup.height !== liveGroup.height
        );
      });

    if (hasChanges) {
      setHistory({ blocks: currentLiveBlocks, groups: currentLiveGroups });

      const draggedBlockIds = currentLiveBlocks
        .filter(b => {
          const originalBlock = historyState.blocks.find(hb => hb.id === b.id);
          return originalBlock && (b.position.x !== originalBlock.position.x || b.position.y !== originalBlock.position.y);
        })
        .map(b => b.id);

      if (draggedBlockIds.length > 0) {
        setDirtyBlockIds(prev => new Set([...prev, ...draggedBlockIds]));
      }
    }
  }, [historyState, setHistory]);

  const updateLabelNodePositions = (updates: { id: string; position: Position }[]) => {
    if (!labelNodes) return;
    const updatesMap = new Map(updates.map(u => [u.id, u.position]));
    // FIX: Incorrect state setter `setLiveNodes` has been corrected to `setLabelNodes`.
    setLabelNodes(prevNodes =>
      prevNodes!.map(node => (updatesMap.has(node.id) ? { ...node, position: updatesMap.get(node.id)! } : node))
    );
  };

  const handleAnalyzeRoutes = useCallback(async () => {
    setLoadingState({ visible: true, progress: 0, message: 'Analyzing routes...' });
    await new Promise(res => setTimeout(res, 50));

    const { labelNodes: generatedNodes, routeLinks: generatedLinks, identifiedRoutes: generatedRoutes } = 
        performRouteAnalysis(liveBlocks, analysisResult.labels, analysisResult.jumps);

    setLoadingState(s => ({ ...s, progress: 30, message: 'Arranging label nodes...' }));
    await new Promise(res => setTimeout(res, 50));
    
    const laidOutLabelNodes = tidyUpLabelLayout(generatedNodes, generatedLinks);

    setLoadingState(s => ({ ...s, progress: 80, message: 'Finalizing canvas...' }));
    await new Promise(res => setTimeout(res, 50));
    
    setLabelNodes(laidOutLabelNodes);
    setRouteLinks(generatedLinks);
    setIdentifiedRoutes(generatedRoutes);

    if (!openTabs.some(t => t.id === 'route-canvas')) {
      setOpenTabs(tabs => [...tabs, { id: 'route-canvas', type: 'route-canvas' }]);
    }
    setActiveTabId('route-canvas');
    
    setLoadingState({ visible: false, progress: 0, message: '' });
  }, [liveBlocks, analysisResult.labels, analysisResult.jumps, openTabs, tidyUpLabelLayout]);
  
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

  
  const handleUpdateImageMetadata = useCallback(async (projectFilePath: string, newMetadata: ImageMetadata) => {
    const oldMetadata = imageMetadata.get(projectFilePath);
    const imageToMove = projectImages.get(projectFilePath);

    const oldSubfolder = oldMetadata?.projectSubfolder?.trim() || '';
    const newSubfolder = newMetadata.projectSubfolder?.trim() || '';

    if (!(projectRootPath || directoryHandle) || !imageToMove || !imageToMove.isInProject || oldSubfolder === newSubfolder) {
        setImageMetadata(prev => new Map(prev).set(projectFilePath, newMetadata));
        return;
    }

    try {
        const oldPath = imageToMove.projectFilePath!;
        const fileName = imageToMove.fileName;
        const newPath = `game/images${newSubfolder ? `/${newSubfolder}` : ''}/${fileName}`.replace(/\/+/g, '/').replace(/^\//, '');

        if (oldPath === newPath) {
             setImageMetadata(prev => new Map(prev).set(projectFilePath, newMetadata));
             return;
        }

        if (isElectron && projectRootPath) {
            const oldFullPath = `${projectRootPath}/${oldPath}`;
            const newFullPath = `${projectRootPath}/${newPath}`;
            const result = await window.electronAPI!.moveFile(oldFullPath, newFullPath);
            if (!result.success) throw new Error(result.error);
        } else if (directoryHandle) {
            if (!imageToMove.fileHandle) throw new Error("Cannot move image without a file handle.");
            const fileContent = await imageToMove.fileHandle.getFile();

            let targetDir = await directoryHandle.getDirectoryHandle('game/images', { create: true });
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
            const oldDirParts = oldPath.split('/').slice(0, -1);
            for (const part of oldDirParts) { oldDirParent = await oldDirParent.getDirectoryHandle(part); }
            await oldDirParent.removeEntry(fileName);
            
            imageToMove.fileHandle = newFileHandle; // Update handle for browser mode
        }

        const newProjectImages = new Map(projectImages);
        newProjectImages.delete(oldPath);
        const updatedImage: ProjectImage = { ...imageToMove, filePath: newPath, projectFilePath: newPath };
        newProjectImages.set(newPath, updatedImage);
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

        setOpenTabs(tabs => tabs.map(tab => (tab.id === 'image_editor' && tab.filePath === oldPath) ? { ...tab, filePath: newPath } : tab));
        
    } catch (err) {
        console.error("Failed to move image file:", err);
        addToast(`Could not move the image file. Error: ${(err as Error).message}`, 'error');
    }
  }, [isElectron, projectRootPath, directoryHandle, projectImages, imageMetadata, fileTree, addToast]);
  
  const handleAddImageScanDirectory = useCallback(async () => {
      const dirHandle = await pickDirectory();
      if (!dirHandle) return;

      setImageScanDirectories(prev => new Map(prev).set(dirHandle.name, dirHandle));
      const newImages = await scanDirectoryForImages(dirHandle, dirHandle.name, false);
      setProjectImages(prev => new Map([...prev, ...newImages]));
  }, [pickDirectory]);
  
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

            // FIX: Remove incorrect 'as ImageMetadata' cast. .get() can return undefined,
            // and the subsequent code with optional chaining already handles this case correctly.
            // FIX: Explicitly cast existingMeta to the correct type to resolve TypeScript inference issues.
            const existingMeta = newMetadataMap.get(sourceImage.projectFilePath || '') as ImageMetadata | undefined;
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
                console.warn(`Skipping copy of ${sourceImage.fileName} - no file handle available.`);
                continue;
            }

            const file = await sourceImage.fileHandle.getFile();
            const newFileHandle = await targetDir.getFileHandle(targetFileName, { create: true });
            const writable = await newFileHandle.createWritable();
            await writable.write(file);
            await writable.close();

            const newImage: ProjectImage = {
                ...sourceImage,
                isInProject: true,
                projectFilePath: targetProjectFilePath,
            };
            newImageMap.set(sourcePath, newImage);
            
            const projectImageAlreadyExists = Array.from(newImageMap.values()).some(img => img.filePath === targetProjectFilePath);
            if(!projectImageAlreadyExists) {
                const projectImage: ProjectImage = {
                    filePath: targetProjectFilePath,
                    fileName: targetFileName,
                    fileHandle: newFileHandle,
                    isInProject: true,
                    projectFilePath: targetProjectFilePath,
                    lastModified: file.lastModified,
                };
                newImageMap.set(targetProjectFilePath, projectImage);
            }

            newMetadataMap.set(targetProjectFilePath, meta);
             if (fileTree) {
                setFileTree(addNodeToFileTree(fileTree, targetProjectFilePath));
            }
        }
        setProjectImages(newImageMap);
        setImageMetadata(newMetadataMap);
    } catch (err) {
        console.error("Failed to copy images to project:", err);
    }
  }, [directoryHandle, projectImages, imageMetadata, fileTree]);

  const handleRemoveImageScanDirectory = useCallback((dirName: string) => {
    setImageScanDirectories(prev => {
        const newMap = new Map(prev);
        newMap.delete(dirName);
        return newMap;
    });
    setProjectImages(prev => {
        const newMap = new Map();
        for (const [key, value] of prev.entries()) {
            if (!key.startsWith(`${dirName}/`)) {
                newMap.set(key, value);
            }
        }
        return newMap;
    });
  }, []);

  const handleRefreshImages = useCallback(async () => {
    if (!directoryHandle) return;
    setIsRefreshingImages(true);
    try {
        const allImages = new Map<string, ProjectImage>();
        const projectImagesMap = await loadProjectImages(directoryHandle);
        projectImagesMap.forEach((img, key) => allImages.set(key, img));

        for (const [name, handle] of imageScanDirectories.entries()) {
            const scannedImages = await scanDirectoryForImages(handle, name, false);
            scannedImages.forEach((img, key) => allImages.set(key, img));
        }
        setProjectImages(allImages);
        setImagesLastScanned(Date.now());
    } catch (e) {
        console.error("Failed to refresh images:", e);
        addToast("Failed to refresh images.", 'error');
    } finally {
        setIsRefreshingImages(false);
    }
  }, [directoryHandle, imageScanDirectories, addToast]);

  const handleUpdateAudioMetadata = useCallback(async (projectFilePath: string, newMetadata: AudioMetadata) => {
      const oldMetadata = audioMetadata.get(projectFilePath);
      const audioToMove = projectAudios.get(projectFilePath);
      const oldSubfolder = oldMetadata?.projectSubfolder?.trim() || '';
      const newSubfolder = newMetadata.projectSubfolder?.trim() || '';
  
      if (!(projectRootPath || directoryHandle) || !audioToMove || !audioToMove.isInProject || oldSubfolder === newSubfolder) {
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
  
          if (isElectron && projectRootPath) {
              const oldFullPath = `${projectRootPath}/${oldPath}`;
              const newFullPath = `${projectRootPath}/${newPath}`;
              const result = await window.electronAPI!.moveFile(oldFullPath, newFullPath);
              if (!result.success) throw new Error(result.error);
          } else if (directoryHandle) {
              if (!audioToMove.fileHandle) { throw new Error("File handle missing."); }
              const fileContent = await audioToMove.fileHandle.getFile();
      
              let targetDir = await directoryHandle.getDirectoryHandle('game/audio', { create: true });
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
              for (const part of oldPath.split('/').slice(0, -1)) { oldDirParent = await oldDirParent.getDirectoryHandle(part); }
              await oldDirParent.removeEntry(fileName);
              audioToMove.fileHandle = newFileHandle;
          }

          const newProjectAudios = new Map(projectAudios);
          newProjectAudios.delete(oldPath);
          const updatedAudio = { ...audioToMove, filePath: newPath, projectFilePath: newPath };
          if (!isElectron && updatedAudio.fileHandle) {
              const file = await updatedAudio.fileHandle.getFile();
              updatedAudio.dataUrl = await fileToDataUrl(file);
              updatedAudio.lastModified = file.lastModified;
          }
          newProjectAudios.set(newPath, updatedAudio);
  
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
          setOpenTabs(tabs => tabs.map(tab => tab.id === 'audio_editor' && tab.filePath === oldPath ? { ...tab, filePath: newPath } : tab));
  
      } catch (err) {
          console.error("Failed to move audio file:", err);
          addToast(`Could not move the audio file. Error: ${(err as Error).message}`, 'error');
      }
  }, [isElectron, projectRootPath, directoryHandle, projectAudios, audioMetadata, fileTree, addToast]);
  
  const handleAddAudioScanDirectory = useCallback(async () => {
      const dirHandle = await pickDirectory();
      if (!dirHandle) return;
      setAudioScanDirectories(prev => new Map(prev).set(dirHandle.name, dirHandle));
      const newAudios = await scanDirectoryForAudios(dirHandle, dirHandle.name, false);
      setProjectAudios(prev => new Map([...prev, ...newAudios]));
  }, [pickDirectory]);
  
  const handleCopyAudiosToProject = useCallback(async (sourceFilePaths: string[], metadataOverride?: AudioMetadata) => {
      if (!directoryHandle) return;
      try {
          let targetDir = await directoryHandle.getDirectoryHandle('game/audio', { create: true });
          const newAudioMap = new Map(projectAudios);
          const newMetadataMap = new Map(audioMetadata);
  
          for (const sourcePath of sourceFilePaths) {
              const sourceAudio = newAudioMap.get(sourcePath);
              if (!sourceAudio || sourceAudio.isInProject || !sourceAudio.fileHandle) continue;
  
              const meta = metadataOverride || { renpyName: sourceAudio.fileName.split('.').slice(0, -1).join('.'), tags: [], projectSubfolder: '' };
              const subfolder = meta.projectSubfolder || '';
  
              if (subfolder) {
                  let currentDir = targetDir;
                  for (const part of subfolder.split('/')) {
                      if (part) currentDir = await currentDir.getDirectoryHandle(part, { create: true });
                  }
              }
  
              const targetFileName = sourceAudio.fileName;
              const targetProjectFilePath = `game/audio${subfolder ? `/${subfolder}` : ''}/${targetFileName}`;
  
              const file = await sourceAudio.fileHandle.getFile();
              const newFileHandle = await targetDir.getFileHandle(targetFileName, { create: true });
              const writable = await newFileHandle.createWritable();
              await writable.write(file);
              await writable.close();
  
              newAudioMap.set(sourcePath, { ...sourceAudio, isInProject: true, projectFilePath: targetProjectFilePath });
  
              const projectAudioAlreadyExists = Array.from(newAudioMap.values()).some(aud => aud.filePath === targetProjectFilePath);
              if (!projectAudioAlreadyExists) {
                  const dataUrl = await fileToDataUrl(file);
                  newAudioMap.set(targetProjectFilePath, { filePath: targetProjectFilePath, fileName: targetFileName, fileHandle: newFileHandle, dataUrl, isInProject: true, projectFilePath: targetProjectFilePath, lastModified: file.lastModified });
              }
  
              newMetadataMap.set(targetProjectFilePath, meta);
              if (fileTree) setFileTree(addNodeToFileTree(fileTree, targetProjectFilePath));
          }
          setProjectAudios(newAudioMap);
          setAudioMetadata(newMetadataMap);
      } catch (err) {
          console.error("Failed to copy audios to project:", err);
      }
  }, [directoryHandle, projectAudios, audioMetadata, fileTree]);
  
  const handleRemoveAudioScanDirectory = useCallback((dirName: string) => {
      setAudioScanDirectories(prev => { const newMap = new Map(prev); newMap.delete(dirName); return newMap; });
      setProjectAudios(prev => {
          const newMap = new Map();
          for (const [key, value] of prev.entries()) { if (!key.startsWith(`${dirName}/`)) newMap.set(key, value); }
          return newMap;
      });
  }, []);

  const handleRefreshAudios = useCallback(async () => {
    if (!directoryHandle) return;
    setIsRefreshingAudios(true);
    try {
        const allAudios = new Map<string, RenpyAudio>();
        const projectAudiosMap = await loadProjectAudios(directoryHandle);
        projectAudiosMap.forEach((aud, key) => allAudios.set(key, aud));

        for (const [name, handle] of audioScanDirectories.entries()) {
            const scannedAudios = await scanDirectoryForAudios(handle, name, false);
            scannedAudios.forEach((aud, key) => allAudios.set(key, aud));
        }
        setProjectAudios(allAudios);
        setAudiosLastScanned(Date.now());
    } catch (e) {
        console.error("Failed to refresh audios:", e);
        addToast("Failed to refresh audios.", 'error');
    } finally {
        setIsRefreshingAudios(false);
    }
  }, [directoryHandle, audioScanDirectories, addToast]);
  
  const appStateAndHandlersRef = useRef({
    openTabs,
    setActiveTabId,
    handleAnalyzeRoutes,
    handleOpenStaticTab,
  });

  useEffect(() => {
    appStateAndHandlersRef.current = {
      openTabs,
      setActiveTabId,
      handleAnalyzeRoutes,
      handleOpenStaticTab,
    };
  });

  useEffect(() => {
    // This effect runs only once on mount to set up the Electron menu listener.
    // It uses a ref to access the latest state and handlers to avoid stale closures.
    if (window.electronAPI?.onMenuCommand) {
        const cleanup = window.electronAPI.onMenuCommand((args) => {
            if (args.command === 'open-static-tab' && args.type) {
                const {
                    openTabs: currentTabs,
                    setActiveTabId: currentSetAId,
                    handleAnalyzeRoutes: currentAnalyzeRoutes,
                    handleOpenStaticTab: currentOpenStaticTab
                } = appStateAndHandlersRef.current;
                
                const type = args.type as 'canvas' | 'route-canvas';
                
                if (type === 'route-canvas') {
                    const existingTab = currentTabs.find(t => t.type === 'route-canvas');
                    if (existingTab) {
                        currentSetAId(existingTab.id);
                    } else {
                        currentAnalyzeRoutes();
                    }
                } else {
                    currentOpenStaticTab(type);
                }
            }
        });

        // The cleanup function returned from preload.js is called on component unmount.
        return cleanup;
    }
  }, []); // Empty dependency array is crucial for running this effect only once.
  
  return (
    <div className={`h-screen w-screen bg-gray-100 dark:bg-gray-900 flex flex-col font-sans text-gray-900 dark:text-gray-100`}>
      {isWelcomeScreenVisible && (
        <WelcomeScreen 
            onOpenFolder={() => handleOpenFolder()}
            onStartInBrowser={() => {
              setIsWelcomeScreenVisible(false);
              addBlock();
            }}
            onUpload={() => fileInputRef.current?.click()}
            isFileSystemApiSupported={isFileSystemApiSupported}
        />
      )}
      {loadingState.visible && <LoadingOverlay progress={loadingState.progress} message={loadingState.message} />}
      <Toolbar
        directoryHandle={directoryHandle}
        projectRootPath={projectRootPath}
        dirtyBlockIds={dirtyBlockIds}
        dirtyEditors={dirtyEditors}
        saveStatus={saveStatus}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        addBlock={addBlock}
        handleTidyUp={handleTidyUp}
        onAnalyzeRoutes={handleAnalyzeRoutes}
        requestOpenFolder={requestOpenFolder}
        handleSave={handleGlobalSave}
        handleDownloadFiles={handleDownloadFiles}
        onUploadClick={handleUploadClick}
        setIsClearConfirmVisible={setIsClearConfirmVisible}
        onOpenSettings={() => setIsSettingsModalVisible(true)}
        isLeftSidebarOpen={isLeftSidebarOpen}
        setIsLeftSidebarOpen={setIsLeftSidebarOpen}
        isRightSidebarOpen={isRightSidebarOpen}
        setIsRightSidebarOpen={setIsRightSidebarOpen}
        onOpenStaticTab={handleOpenStaticTab}
      />
      <div className="flex-grow flex min-h-0 relative">
        <aside 
            className={`flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${isLeftSidebarOpen ? 'w-64' : 'w-0'}`}
            style={{ width: isLeftSidebarOpen ? leftSidebarWidth : 0 }}
        >
            {isLeftSidebarOpen && <FileExplorerPanel 
                tree={fileTree} 
                onFileOpen={handleFileDoubleClick}
                onCreateNode={() => {}}
                onRenameNode={() => {}}
                onDeleteNode={(paths) => requestDelete([], paths)}
                onMoveNode={() => {}}
                clipboard={clipboard}
                onCut={() => {}}
                onCopy={() => {}}
                onPaste={() => {}}
                onCenterOnBlock={handleCenterOnBlock}
            />}
        </aside>
        <div 
            onMouseDown={() => setResizingHandle('left')}
            className={`w-1.5 flex-shrink-0 cursor-col-resize hover:bg-indigo-400/50 transition-colors ${resizingHandle === 'left' ? 'bg-indigo-400' : ''}`}
            style={{ display: isLeftSidebarOpen ? 'block' : 'none' }}
        />

        <main className="flex-grow min-w-0 flex flex-col relative bg-gray-100 dark:bg-gray-900">
            {/* TABS */}
            <div className="h-10 flex-shrink-0 bg-gray-200 dark:bg-gray-700/50 flex items-end space-x-1 px-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                {openTabs.map(tab => {
                    const isActive = tab.id === activeTabId;
                    const block = liveBlocks.find(b => b.id === tab.blockId);
                    const isDirty = (tab.type === 'editor' && tab.blockId) ? dirtyEditors.has(tab.blockId) : false;
                    let title = 'Canvas';
                    if (tab.type === 'route-canvas') title = 'Route Canvas';
                    else if (tab.type === 'image') title = tab.filePath?.split('/').pop() || 'Image';
                    else if (tab.type === 'audio') title = tab.filePath?.split('/').pop() || 'Audio';
                    else if (tab.type === 'character') title = `Char: ${tab.characterTag}`;
                    else if (block) title = block.title || block.filePath?.split('/').pop() || analysisResult.firstLabels[block.id] || 'Untitled Block';
                    
                    return (
                        <div key={tab.id}
                             onClick={() => setActiveTabId(tab.id)}
                             className={`px-3 py-1.5 rounded-t-md flex items-center space-x-2 cursor-pointer ${isActive ? 'bg-white dark:bg-gray-800' : 'bg-gray-100/50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                            <span className={`text-sm ${isActive ? 'font-semibold' : ''}`}>{title}</span>
                             {isDirty && <div className="w-2 h-2 bg-blue-500 rounded-full" title="Unsaved changes"></div>}
                            <button onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }} className="p-0.5 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    );
                })}
            </div>
            
            {/* CONTENT */}
            <div className="flex-grow min-h-0 relative">
                 {openTabs.map(tab => (
                    <div key={tab.id} className={`absolute inset-0 ${activeTabId === tab.id ? 'z-10' : 'z-0'}`} style={{ visibility: activeTabId === tab.id ? 'visible' : 'hidden' }}>
                        {tab.type === 'canvas' && (
                          <StoryCanvas
                            blocks={liveBlocks}
                            groups={liveGroups}
                            analysisResult={analysisResult}
                            updateBlock={updateBlock}
                            updateGroup={updateGroup}
                            updateBlockPositions={updateBlockPositions}
                            updateGroupPositions={updateGroupPositions}
                            onInteractionEnd={onInteractionEnd}
                            deleteBlock={(id) => requestDelete([id], [])}
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
                            hoverHighlightIds={hoverHighlightIds}
                          />
                        )}
                        {tab.type === 'route-canvas' && labelNodes && routeLinks && (
                          <RouteCanvas
                            labelNodes={labelNodes}
                            routeLinks={routeLinks}
                            identifiedRoutes={identifiedRoutes ?? []}
                            updateLabelNodePositions={updateLabelNodePositions}
                            onOpenEditor={handleOpenEditorTab}
                          />
                        )}
                        {tab.type === 'editor' && tab.blockId && (() => {
                            const block = liveBlocks.find(b => b.id === tab.blockId);
                            return block ? (
                                <EditorView 
                                    block={block} 
                                    blocks={liveBlocks}
                                    analysisResult={analysisResult}
                                    onSwitchFocusBlock={handleOpenEditorTab}
                                    onSave={handleSaveBlockContent}
                                    onDirtyChange={handleEditorDirtyChange}
                                    editorTheme={editorThemeForMonaco}
                                    initialScrollRequest={tab.scrollRequest}
                                    apiKey={apiKey}
                                    enableAiFeatures={enableAiFeatures}
                                    availableModels={availableModels}
                                    selectedModel={selectedModel}
                                    addToast={addToast}
                                    onEditorMount={handleEditorMount}
                                    onEditorUnmount={handleEditorUnmount}
                                />
                            ) : null;
                        })()}
                        {tab.type === 'image' && tab.filePath && (() => {
                            const image = projectImages.get(tab.filePath);
                            return image ? (
                                <ImageEditorView 
                                    image={image}
                                    metadata={imageMetadata.get(image.projectFilePath || image.filePath)}
                                    onUpdateMetadata={handleUpdateImageMetadata}
                                    onCopyToProject={(sourcePath, meta) => handleCopyImagesToProject([sourcePath], meta)}
                                />
                            ) : null;
                        })()}
                        {tab.type === 'audio' && tab.filePath && (() => {
                            const audio = projectAudios.get(tab.filePath);
                            return audio ? (
                                <AudioEditorView
                                    audio={audio}
                                    metadata={audioMetadata.get(audio.projectFilePath || audio.filePath)}
                                    onUpdateMetadata={handleUpdateAudioMetadata}
                                    onCopyToProject={(sourcePath, meta) => handleCopyAudiosToProject([sourcePath], meta)}
                                />
                            ) : null;
                        })()}
                         {tab.type === 'character' && tab.characterTag && (
                            <CharacterEditorView
                                character={tab.characterTag === 'new_character' ? undefined : analysisResult.characters.get(tab.characterTag)}
                                onSave={handleSaveCharacter}
                                existingTags={Array.from(analysisResult.characters.keys())}
                                projectImages={Array.from(projectImages.values())}
                                imageMetadata={imageMetadata}
                            />
                        )}
                    </div>
                ))}
                 {openTabs.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-center text-gray-500 dark:text-gray-400">
                        <div>
                            <h3 className="text-lg font-semibold">All tabs are closed.</h3>
                            <p>Use the "View" menu in the toolbar to reopen the Story Canvas or other views.</p>
                        </div>
                    </div>
                 )}
            </div>
        </main>

        <div 
            onMouseDown={() => setResizingHandle('right')}
            className={`w-1.5 flex-shrink-0 cursor-col-resize hover:bg-indigo-400/50 transition-colors ${resizingHandle === 'right' ? 'bg-indigo-400' : ''}`}
            style={{ display: isRightSidebarOpen ? 'block' : 'none' }}
        />
        <aside 
            className={`flex-shrink-0 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${isRightSidebarOpen ? 'w-96' : 'w-0'}`}
            style={{ width: isRightSidebarOpen ? rightSidebarWidth : 0 }}
        >
          {isRightSidebarOpen && <StoryElementsPanel
            analysisResult={analysisResult}
            onOpenCharacterEditor={handleOpenCharacterEditor}
            onFindCharacterUsages={handleFindCharacterUsages}
            onAddVariable={handleAddVariable}
            onFindVariableUsages={handleFindVariableUsages}
            onAddScreen={handleAddScreen}
            onFindScreenDefinition={handleFindScreenDefinition}
            projectImages={projectImages}
            imageMetadata={imageMetadata}
            imageScanDirectories={imageScanDirectories}
            onAddImageScanDirectory={handleAddImageScanDirectory}
            onRemoveImageScanDirectory={handleRemoveImageScanDirectory}
            onCopyImagesToProject={handleCopyImagesToProject}
            onUpdateImageMetadata={handleUpdateImageMetadata}
            onOpenImageEditor={handleOpenImageTab}
            imagesLastScanned={imagesLastScanned}
            isRefreshingImages={isRefreshingImages}
            onRefreshImages={handleRefreshImages}
            projectAudios={projectAudios}
            audioMetadata={audioMetadata}
            audioScanDirectories={audioScanDirectories}
            onAddAudioScanDirectory={handleAddAudioScanDirectory}
            onRemoveAudioScanDirectory={handleRemoveAudioScanDirectory}
            onCopyAudiosToProject={handleCopyAudiosToProject}
            onUpdateAudioMetadata={handleUpdateAudioMetadata}
            onOpenAudioEditor={handleOpenAudioTab}
            audiosLastScanned={audiosLastScanned}
            isRefreshingAudios={isRefreshingAudios}
            onRefreshAudios={handleRefreshAudios}
            isFileSystemApiSupported={!!directoryHandle || !!projectRootPath}
            onHoverHighlightStart={handleHoverHighlightStart}
            onHoverHighlightEnd={handleHoverHighlightEnd}
          />}
        </aside>
      </div>

      {isClearConfirmVisible && (
        <ConfirmModal
          title="Clear Canvas"
          onConfirm={() => {
            commitChange({ blocks: [], groups: [] });
            setFileTree(null);
            setDirectoryHandle(null);
            setProjectRootPath(null);
            setIsClearConfirmVisible(false);
          }}
          onClose={() => setIsClearConfirmVisible(false)}
        >
          Are you sure you want to delete all blocks and groups from the canvas? This action cannot be undone.
        </ConfirmModal>
      )}
      {uploadConfirm.visible && (
        <ConfirmModal
            title="Upload Project"
            confirmText="Upload and Replace"
            confirmClassName="bg-indigo-600 hover:bg-indigo-700"
            onConfirm={() => processUploadedFile(uploadConfirm.file!)}
            onClose={() => {
                if(fileInputRef.current) fileInputRef.current.value = "";
                setUploadConfirm({ visible: false, file: null });
            }}
        >
            Uploading a new project will replace your current workspace. Any unsaved changes will be lost. Are you sure?
        </ConfirmModal>
      )}
      {openFolderConfirmVisible && (
          <ConfirmModal
              title="Open New Project"
              confirmText="Open and Replace"
              confirmClassName="bg-indigo-600 hover:bg-indigo-700"
              onConfirm={() => {
                  setOpenFolderConfirmVisible(false);
                  handleOpenFolder();
              }}
              onClose={() => setOpenFolderConfirmVisible(false)}
          >
              Opening a new project folder will replace your current workspace. Any unsaved changes will be lost. Are you sure?
          </ConfirmModal>
      )}
       {deleteConfirm.visible && (
        <ConfirmModal
            title="Confirm Deletion"
            confirmText="Delete"
            confirmClassName="bg-red-600 hover:bg-red-700"
            onConfirm={handleConfirmDelete}
            onClose={() => setDeleteConfirm({ visible: false })}
        >
            <p>{deleteConfirm.message}</p>
            {deleteConfirm.warning && <p className="mt-2 font-semibold text-yellow-600 dark:text-yellow-400">{deleteConfirm.warning}</p>}
        </ConfirmModal>
      )}

      {isSettingsModalVisible && (
          <SettingsModal
            isOpen={isSettingsModalVisible}
            onClose={() => setIsSettingsModalVisible(false)}
            settings={{ theme, apiKey, enableAiFeatures, selectedModel }}
            onSettingsChange={handleSettingsChange}
            availableModels={availableModels}
          />
      )}
      
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-2">
          {toasts.map(toast => (
              <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".zip"
        onChange={handleUploadFileSelect}
      />
    </div>
  );
};

export default App;