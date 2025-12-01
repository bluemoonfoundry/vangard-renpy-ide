
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useImmer } from 'use-immer';
import Toolbar from './components/Toolbar';
import StoryCanvas from './components/StoryCanvas';
import FileExplorerPanel from './components/FileExplorerPanel';
import SearchPanel from './components/SearchPanel';
import EditorView from './components/EditorView';
import StoryElementsPanel from './components/StoryElementsPanel';
import RouteCanvas from './components/RouteCanvas';
import SettingsModal from './components/SettingsModal';
import ConfirmModal from './components/ConfirmModal';
import CreateBlockModal, { BlockType } from './components/CreateBlockModal';
import ConfigureRenpyModal from './components/ConfigureRenpyModal';
import Toast from './components/Toast';
import LoadingOverlay from './components/LoadingOverlay';
import WelcomeScreen from './components/WelcomeScreen';
import ImageEditorView from './components/ImageEditorView';
import AudioEditorView from './components/AudioEditorView';
import CharacterEditorView from './components/CharacterEditorView';
import SceneComposer from './components/SceneComposer';
import TabContextMenu from './components/TabContextMenu';
import Sash from './components/Sash';
import StatusBar from './components/StatusBar';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import AboutModal from './components/AboutModal';
import { useRenpyAnalysis, performRenpyAnalysis, performRouteAnalysis } from './hooks/useRenpyAnalysis';
import { useHistory } from './hooks/useHistory';
import type { 
  Block, BlockGroup, Link, Position, FileSystemTreeNode, EditorTab, 
  ToastMessage, IdeSettings, Theme, ProjectImage, RenpyAudio, 
  ClipboardState, ImageMetadata, AudioMetadata, LabelNode, Character,
  AppSettings, ProjectSettings, StickyNote, SearchResult, SceneComposition, SceneSprite
} from './types';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// --- Utility: ArrayBuffer to Base64 (Browser Compatible) ---
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// --- Utility: Word Count ---
const countWordsInRenpyScript = (script: string): number => {
    if (!script) return 0;
    // Regex to find dialogue (e.g., e "...") and narration ("...")
    const DIALOGUE_NARRATION_REGEX = /(?:[a-zA-Z0-9_]+\s)?"((?:\\.|[^"\\])*)"/g;
    let totalWords = 0;
    let match;
    while ((match = DIALOGUE_NARRATION_REGEX.exec(script)) !== null) {
        const text = match[1];
        if (text) {
            const words = text.trim().split(/\s+/).filter(Boolean);
            totalWords += words.length;
        }
    }
    return totalWords;
};


// --- Generic Layout Algorithm ---
interface LayoutNode {
    id: string;
    width: number;
    height: number;
    position: Position;
}

interface LayoutEdge {
    sourceId: string;
    targetId: string;
}

const computeAutoLayout = <T extends LayoutNode>(nodes: T[], edges: LayoutEdge[]): T[] => {
    if (!nodes || nodes.length === 0) return [];

    const PADDING_X = 100;
    const PADDING_Y = 80;
    const COMPONENT_SPACING = 200;
    const DEFAULT_WIDTH = 300;
    const DEFAULT_HEIGHT = 150;

    // 1. Sanitize inputs
    const sanitizedNodes = nodes.map(n => ({
        ...n,
        width: (n.width && n.width > 50) ? n.width : DEFAULT_WIDTH,
        height: (n.height && n.height > 50) ? n.height : DEFAULT_HEIGHT,
    }));
    
    const nodeMap = new Map(sanitizedNodes.map(n => [n.id, n]));
    const allNodeIds = new Set(sanitizedNodes.map(n => n.id));

    // 2. Identify Connected Components
    const undirectedAdj = new Map<string, string[]>();
    allNodeIds.forEach(id => undirectedAdj.set(id, []));
    
    edges.forEach(edge => {
        if (allNodeIds.has(edge.sourceId) && allNodeIds.has(edge.targetId)) {
            undirectedAdj.get(edge.sourceId)?.push(edge.targetId);
            undirectedAdj.get(edge.targetId)?.push(edge.sourceId);
        }
    });

    const components: string[][] = [];
    const visited = new Set<string>();

    for (const nodeId of allNodeIds) {
        if (!visited.has(nodeId)) {
            const component: string[] = [];
            const queue = [nodeId];
            visited.add(nodeId);
            while (queue.length > 0) {
                const u = queue.shift()!;
                component.push(u);
                undirectedAdj.get(u)?.forEach(v => {
                    if (!visited.has(v)) {
                        visited.add(v);
                        queue.push(v);
                    }
                });
            }
            components.push(component);
        }
    }

    // Sort components by size (largest first)
    components.sort((a, b) => b.length - a.length);

    // 3. Layout each component
    const finalPositions = new Map<string, Position>();
    let currentOffsetX = 50;

    // Directed adjacency for layering
    const adj = new Map<string, string[]>();
    allNodeIds.forEach(id => adj.set(id, []));
    edges.forEach(edge => {
        if (allNodeIds.has(edge.sourceId) && allNodeIds.has(edge.targetId)) {
            adj.get(edge.sourceId)?.push(edge.targetId);
        }
    });

    components.forEach(componentIds => {
        const compNodes = new Set(componentIds);
        const compInDegree = new Map<string, number>();
        componentIds.forEach(id => compInDegree.set(id, 0));

        componentIds.forEach(u => {
            adj.get(u)?.forEach(v => {
                if (compNodes.has(v)) {
                    compInDegree.set(v, (compInDegree.get(v) || 0) + 1);
                }
            });
        });

        const queue: string[] = [];
        compInDegree.forEach((d, id) => { if (d === 0) queue.push(id); });
        
        // Cycle breaking
        if (queue.length === 0 && componentIds.length > 0) {
            let minDegree = Infinity;
            let candidate = componentIds[0];
            compInDegree.forEach((d, id) => {
                if (d < minDegree) {
                    minDegree = d;
                    candidate = id;
                }
            });
            queue.push(candidate);
        }

        const layers: string[][] = [];
        const visitedInLayering = new Set<string>();
        let iterationCount = 0;
        const MAX_ITERATIONS = componentIds.length * 2 + 100; 

        while(queue.length > 0) {
            iterationCount++;
            if (iterationCount > MAX_ITERATIONS) break;

            const layerSize = queue.length;
            const layer: string[] = [];
            
            for(let i=0; i<layerSize; i++) {
                const u = queue.shift()!;
                if (visitedInLayering.has(u)) continue;
                visitedInLayering.add(u);
                layer.push(u);

                adj.get(u)?.forEach(v => {
                    if (compNodes.has(v)) {
                        const currentDeg = compInDegree.get(v) || 0;
                        compInDegree.set(v, currentDeg - 1);
                        if ((compInDegree.get(v) || 0) <= 0 && !visitedInLayering.has(v)) {
                            if (!queue.includes(v)) queue.push(v);
                        }
                    }
                });
            }
            if (layer.length > 0) layers.push(layer);
        }

        const remaining = componentIds.filter(id => !visitedInLayering.has(id));
        if (remaining.length > 0) layers.push(remaining);

        // Position layers
        let layerX = 0;
        layers.forEach(layer => {
            let maxW = 0;
            let totalH = 0;
            layer.forEach(id => {
                const n = nodeMap.get(id);
                if (n) {
                    maxW = Math.max(maxW, n.width);
                    totalH += n.height;
                }
            });
            totalH += (layer.length - 1) * PADDING_Y;

            let currentY = -totalH / 2;
            layer.forEach(id => {
                const n = nodeMap.get(id);
                if (n) {
                    const x = layerX + (maxW - n.width) / 2;
                    finalPositions.set(id, {
                        x: currentOffsetX + x,
                        y: currentY + 100 // Offset to avoid top edge
                    });
                    currentY += n.height + PADDING_Y;
                }
            });

            layerX += maxW + PADDING_X;
        });

        const componentWidth = Math.max(layerX - PADDING_X, DEFAULT_WIDTH); 
        currentOffsetX += componentWidth + COMPONENT_SPACING;
    });

    // Normalize Y
    let minY = Infinity;
    finalPositions.forEach(p => { if (p.y < minY) minY = p.y; });
    
    if (minY !== Infinity) {
        const targetY = 100;
        const shift = targetY - minY;
        finalPositions.forEach(p => { p.y += shift; });
    } else {
         // Fallback for completely disconnected single nodes if algorithm somehow failed
         let x = 50;
         let y = 100;
         nodes.forEach(n => {
             if (!finalPositions.has(n.id)) {
                 finalPositions.set(n.id, { x, y });
                 x += n.width + 50;
             }
         });
    }

    return nodes.map(n => {
        const pos = finalPositions.get(n.id);
        return pos ? { ...n, position: pos } : n;
    });
};


// --- Main App Component ---

interface UnsavedChangesModalInfo {
    title: string;
    message: string;
    confirmText: string;
    dontSaveText: string;
    onConfirm: () => Promise<void> | void;
    onDontSave: () => void;
    onCancel: () => void;
}

const App: React.FC = () => {
  // --- State: Welcome Screen ---
  const [showWelcome, setShowWelcome] = useState(true);

  // --- State: Blocks & Groups (Undo/Redo) ---
  const { state: blocks, setState: setBlocks, undo, redo, canUndo, canRedo } = useHistory<Block[]>([]);
  const [groups, setGroups] = useImmer<BlockGroup[]>([]);
  const [stickyNotes, setStickyNotes] = useImmer<StickyNote[]>([]);
  
  // --- State: File System & Environment ---
  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);
  
  // Update window title based on project path
  useEffect(() => {
    if (projectRootPath) {
      document.title = `Ren'IDE (${projectRootPath})`;
    } else {
      document.title = "Ren'IDE";
    }
  }, [projectRootPath]);

  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [fileSystemTree, setFileSystemTree] = useState<FileSystemTreeNode | null>(null);
  
  // Use standard useState for Maps to avoid Immer proxy issues with native Maps
  const [images, setImages] = useState<Map<string, ProjectImage>>(new Map());
  const [audios, setAudios] = useState<Map<string, RenpyAudio>>(new Map());
  const [imageMetadata, setImageMetadata] = useState<Map<string, ImageMetadata>>(new Map());
  const [audioMetadata, setAudioMetadata] = useState<Map<string, AudioMetadata>>(new Map());
  
  // --- State: File Explorer Selection & Expansion ---
  const [explorerSelectedPaths, setExplorerSelectedPaths] = useState<Set<string>>(new Set());
  const [explorerLastClickedPath, setExplorerLastClickedPath] = useState<string | null>(null);
  const [explorerExpandedPaths, setExplorerExpandedPaths] = useState<Set<string>>(new Set());

  // --- State: Scanning ---
  const [imageScanDirectories, setImageScanDirectories] = useState<Map<string, FileSystemDirectoryHandle>>(new Map());
  const [audioScanDirectories, setAudioScanDirectories] = useState<Map<string, FileSystemDirectoryHandle>>(new Map());
  const [imagesLastScanned, setImagesLastScanned] = useState<number | null>(null);
  const [audiosLastScanned, setAudiosLastScanned] = useState<number | null>(null);
  const [isRefreshingImages, setIsRefreshingImages] = useState(false);
  const [isRefreshingAudios, setIsRefreshingAudios] = useState(false);

  // --- State: UI & Editor ---
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([{ id: 'canvas', type: 'canvas' }]);
  const [activeTabId, setActiveTabId] = useState<string>('canvas');
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  
  // Scene Composer State
  const [sceneCompositions, setSceneCompositions] = useImmer<Record<string, SceneComposition>>({});
  const [sceneNames, setSceneNames] = useImmer<Record<string, string>>({});
  
  const [dirtyBlockIds, setDirtyBlockIds] = useState<Set<string>>(new Set());
  const [dirtyEditors, setDirtyEditors] = useState<Set<string>>(new Set()); // Blocks modified in editor but not synced to block state yet
  const [hasUnsavedSettings, setHasUnsavedSettings] = useState(false); // Track project setting changes like sticky notes
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  const [statusBarMessage, setStatusBarMessage] = useState('');
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{ paths: string[]; onConfirm: () => void; } | null>(null);
  const [createBlockModalOpen, setCreateBlockModalOpen] = useState(false);
  const [unsavedChangesModalInfo, setUnsavedChangesModalInfo] = useState<UnsavedChangesModalInfo | null>(null);
  const [contextMenuInfo, setContextMenuInfo] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  
  // --- State: View Transforms ---
  const [storyCanvasTransform, setStoryCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [routeCanvasTransform, setRouteCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });

  // --- State: Game Execution ---
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [showConfigureRenpyModal, setShowConfigureRenpyModal] = useState(false);

  // --- State: Application and Project Settings ---
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [appSettingsLoaded, setAppSettingsLoaded] = useState(false);
  const [characterProfiles, setCharacterProfiles] = useImmer<Record<string, string>>({});
  const [appSettings, updateAppSettings] = useImmer<AppSettings>({
    theme: 'system',
    isLeftSidebarOpen: true,
    leftSidebarWidth: 250,
    isRightSidebarOpen: true,
    rightSidebarWidth: 300,
    renpyPath: '',
    recentProjects: [],
    editorFontFamily: "'Consolas', 'Courier New', monospace",
    editorFontSize: 14,
  });
  const [projectSettings, updateProjectSettings] = useImmer<Omit<ProjectSettings, 'openTabs' | 'activeTabId' | 'stickyNotes' | 'characterProfiles' | 'sceneCompositions' | 'sceneNames' | 'scannedImagePaths' | 'scannedAudioPaths'>>({
    enableAiFeatures: false,
    selectedModel: 'gemini-2.5-flash',
  });

  // --- State: Clipboard & Highlights ---
  const [clipboard, setClipboard] = useState<ClipboardState>(null);
  const [findUsagesHighlightIds, setFindUsagesHighlightIds] = useState<Set<string> | null>(null);
  const [centerOnBlockRequest, setCenterOnBlockRequest] = useState<{ blockId: string, key: number } | null>(null);
  const [flashBlockRequest, setFlashBlockRequest] = useState<{ blockId: string, key: number } | null>(null);
  const [canvasFilters, setCanvasFilters] = useState({ story: true, screens: true, config: false, notes: true });
  const [hoverHighlightIds, setHoverHighlightIds] = useState<Set<string> | null>(null);

  // --- State: Search ---
  const [activeLeftPanel, setActiveLeftPanel] = useState<'explorer' | 'search'>('explorer');
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchOptions, setSearchOptions] = useImmer({
    isCaseSensitive: false,
    isWholeWord: false,
    isRegex: false,
  });
  const [searchResults, setSearchResults] = useImmer<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [replaceAllConfirmInfo, setReplaceAllConfirmInfo] = useState<{ onConfirm: () => void; totalMatches: number; totalFiles: number; } | null>(null);

  // --- Analysis ---
  const analysisResult = useRenpyAnalysis(blocks, 0); // 0 is a trigger for force re-analysis if needed
  
  // --- Refs ---
  const editorInstances = useRef<Map<string, monaco.editor.IStandaloneCodeEditor>>(new Map());
  const initialLayoutNeeded = useRef(false);

  // --- Scene Composer Management ---
  const handleCreateScene = useCallback((initialName?: string) => {
      const id = `scene-${Date.now()}`;
      const name = initialName || `Scene ${Object.keys(sceneCompositions).length + 1}`;
      
      setSceneCompositions(draft => {
          draft[id] = { background: null, sprites: [] };
      });
      setSceneNames(draft => {
          draft[id] = name;
      });
      
      setOpenTabs(prev => [...prev, { id, type: 'scene-composer', sceneId: id }]);
      setActiveTabId(id);
      setHasUnsavedSettings(true);
  }, [sceneCompositions, setSceneCompositions, setSceneNames]);

  const handleOpenScene = useCallback((sceneId: string) => {
      setOpenTabs(prev => {
          if (!prev.find(t => t.id === sceneId)) {
              return [...prev, { id: sceneId, type: 'scene-composer', sceneId }];
          }
          return prev;
      });
      setActiveTabId(sceneId);
  }, []);

  const handleSceneUpdate = useCallback((sceneId: string, value: React.SetStateAction<SceneComposition>) => {
      setSceneCompositions(draft => {
          const prev = draft[sceneId] || { background: null, sprites: [] };
          const next = typeof value === 'function' ? (value as any)(prev) : value;
          
          if (JSON.stringify(prev) !== JSON.stringify(next)) {
              draft[sceneId] = next;
              setHasUnsavedSettings(true);
          }
      });
  }, [setSceneCompositions]);

  const handleRenameScene = useCallback((sceneId: string, newName: string) => {
      setSceneNames(draft => {
          if (draft[sceneId] !== newName) {
              draft[sceneId] = newName;
              setHasUnsavedSettings(true);
          }
      });
  }, [setSceneNames]);

  const handleDeleteScene = useCallback((sceneId: string) => {
      setSceneCompositions(draft => { delete draft[sceneId]; });
      setSceneNames(draft => { delete draft[sceneId]; });
      
      setOpenTabs(prev => prev.filter(t => t.id !== sceneId));
      if (activeTabId === sceneId) setActiveTabId('canvas');
      setHasUnsavedSettings(true);
  }, [setSceneCompositions, setSceneNames, activeTabId]);


  // --- Sync Explorer with Active Tab ---
  useEffect(() => {
    if (activeTabId === 'canvas' || activeTabId === 'route-canvas') return;

    const activeTab = openTabs.find(t => t.id === activeTabId);
    let filePathToSync: string | undefined;

    if (activeTab) {
        if (activeTab.type === 'editor' && activeTab.blockId) {
            const block = blocks.find(b => b.id === activeTab.blockId);
            filePathToSync = block?.filePath;
        } else if (activeTab.type === 'image' || activeTab.type === 'audio') {
            filePathToSync = activeTab.filePath;
        }
    }

    if (filePathToSync) {
        // 1. Select the file
        setExplorerSelectedPaths(new Set([filePathToSync]));
        setExplorerLastClickedPath(filePathToSync);

        // 2. Expand all parent folders
        const parts = filePathToSync.split('/');
        parts.pop(); // Remove filename
        
        setExplorerExpandedPaths(prev => {
            const newExpanded = new Set(prev);
            let currentPath = '';
            let changed = false;
            
            parts.forEach((part, index) => {
                currentPath += (index > 0 ? '/' : '') + part;
                if (!newExpanded.has(currentPath)) {
                    newExpanded.add(currentPath);
                    changed = true;
                }
            });
            
            return changed ? newExpanded : prev;
        });
    }
  }, [activeTabId, openTabs, blocks]);

  const handleToggleExpandExplorer = useCallback((path: string) => {
      setExplorerExpandedPaths(prev => {
          const newSet = new Set(prev);
          if (newSet.has(path)) newSet.delete(path);
          else newSet.add(path);
          return newSet;
      });
  }, []);


  // --- Initial Load of App Settings & Theme Management ---
  useEffect(() => {
    // Load app-level settings from Electron main process or fallback to localStorage
    if (window.electronAPI?.getAppSettings) {
      window.electronAPI.getAppSettings().then(savedSettings => {
        if (savedSettings) {
          updateAppSettings(draft => { 
              Object.assign(draft, savedSettings);
              if (!draft.editorFontFamily) draft.editorFontFamily = "'Consolas', 'Courier New', monospace";
              if (!draft.editorFontSize) draft.editorFontSize = 14;
          });
        }
      }).finally(() => {
        setAppSettingsLoaded(true);
      });
    } else { // Browser fallback
      const savedSettings = localStorage.getItem('renpy-ide-app-settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          updateAppSettings(draft => { 
              Object.assign(draft, parsed);
              if (!draft.editorFontFamily) draft.editorFontFamily = "'Consolas', 'Courier New', monospace";
              if (!draft.editorFontSize) draft.editorFontSize = 14;
          });
        } catch (e) { console.error("Failed to load app settings from localStorage", e); }
      }
      setAppSettingsLoaded(true);
    }
  }, [updateAppSettings]);

  useEffect(() => {
    if (!appSettingsLoaded) return;

    if (window.electronAPI?.saveAppSettings) {
      window.electronAPI.saveAppSettings(appSettings)
        .then(result => {
            if (!result || !result.success) {
                console.error('Failed to save app settings:', result?.error);
            }
        });
    } else {
      localStorage.setItem('renpy-ide-app-settings', JSON.stringify(appSettings));
    }
    
    const root = window.document.documentElement;
    const applyTheme = (theme: Theme) => {
      root.classList.remove(
          'dark', 
          'theme-solarized-light', 
          'theme-solarized-dark', 
          'theme-colorful', 
          'theme-colorful-light',
          'theme-neon-dark',
          'theme-ocean-dark',
          'theme-candy-light',
          'theme-forest-light'
      );
      
      if (theme === 'dark') root.classList.add('dark');
      if (theme === 'solarized-light') root.classList.add('theme-solarized-light');
      if (theme === 'solarized-dark') root.classList.add('dark', 'theme-solarized-dark');
      if (theme === 'colorful') root.classList.add('dark', 'theme-colorful');
      if (theme === 'colorful-light') root.classList.add('theme-colorful-light');
      
      // New Themes
      if (theme === 'neon-dark') root.classList.add('dark', 'theme-neon-dark');
      if (theme === 'ocean-dark') root.classList.add('dark', 'theme-ocean-dark');
      if (theme === 'candy-light') root.classList.add('theme-candy-light');
      if (theme === 'forest-light') root.classList.add('theme-forest-light');
    };

    if (appSettings.theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      applyTheme(systemTheme);
    } else {
      applyTheme(appSettings.theme);
    }
  }, [appSettings, appSettingsLoaded]);


  // --- Toast Helper ---
  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // --- Block Management ---
  const updateBlock = useCallback((id: string, data: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
    if (data.content !== undefined) {
      setDirtyBlockIds(prev => new Set(prev).add(id));
    }
  }, [setBlocks]);

  const updateGroup = useCallback((id: string, data: Partial<BlockGroup>) => {
    setGroups(draft => {
      const idx = draft.findIndex(g => g.id === id);
      if (idx !== -1) Object.assign(draft[idx], data);
    });
  }, [setGroups]);

  const updateBlockPositions = useCallback((updates: { id: string, position: Position }[]) => {
    setBlocks(prev => {
        const next = [...prev];
        updates.forEach(u => {
            const idx = next.findIndex(b => b.id === u.id);
            if (idx !== -1) next[idx] = { ...next[idx], position: u.position };
        });
        return next;
    });
  }, [setBlocks]);

   const updateGroupPositions = useCallback((updates: { id: string, position: Position }[]) => {
    setGroups(draft => {
      updates.forEach(u => {
        const g = draft.find(g => g.id === u.id);
        if (g) g.position = u.position;
      });
    });
  }, [setGroups]);


  const addBlock = useCallback((filePath: string, content: string, initialPosition?: Position) => {
    const id = `block-${Date.now()}`;
    const blockWidth = 320;
    const blockHeight = 200;

    let position: Position;

    if (initialPosition) {
        position = initialPosition;
    } else {
        const leftOffset = appSettings.isLeftSidebarOpen ? appSettings.leftSidebarWidth : 0;
        const rightOffset = appSettings.isRightSidebarOpen ? appSettings.rightSidebarWidth : 0;
        const topOffset = 64; // h-16 (header)

        const visibleWidth = window.innerWidth - leftOffset - rightOffset;
        const visibleHeight = window.innerHeight - topOffset;

        const screenCenterX = leftOffset + (visibleWidth / 2);
        const screenCenterY = topOffset + (visibleHeight / 2);

        const worldCenterX = (screenCenterX - storyCanvasTransform.x) / storyCanvasTransform.scale;
        const worldCenterY = (screenCenterY - storyCanvasTransform.y) / storyCanvasTransform.scale;

        position = {
            x: worldCenterX - (blockWidth / 2),
            y: worldCenterY - (blockHeight / 2)
        };
    }

    const newBlock: Block = {
      id,
      content,
      position,
      width: blockWidth,
      height: blockHeight,
      title: filePath.split('/').pop(),
      filePath
    };
    
    setBlocks(prev => [...prev, newBlock]);
    setDirtyBlockIds(prev => new Set(prev).add(id));
    
    setSelectedBlockIds([id]);
    setFlashBlockRequest({ blockId: id, key: Date.now() });

    if (fileSystemTree && filePath) {
        setFileSystemTree(prev => {
            if (!prev) return null;
            return prev;
        });
    }
    return id;
  }, [setBlocks, fileSystemTree, storyCanvasTransform, appSettings]);

  const handleCreateBlockConfirm = async (name: string, type: BlockType, folderPath: string) => {
    let content = '';
    const safeName = name.replace(/\.rpy$/, '');
    const fileName = `${safeName}.rpy`;
    
    switch (type) {
        case 'story':
            content = `label ${safeName}:\n    "Start writing your story here..."\n    return\n`;
            break;
        case 'screen':
            content = `screen ${safeName}():\n    zorder 100\n    frame:\n        align (0.5, 0.5)\n        text "New Screen"\n`;
            break;
        case 'config':
            content = `# Configuration for ${safeName}\ndefine ${safeName}_enabled = True\n`;
            break;
    }

    if (window.electronAPI && projectRootPath) {
        try {
            const cleanFolderPath = folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath;
            const relativePath = cleanFolderPath ? `${cleanFolderPath}/${fileName}` : fileName;
            const fullPath = await window.electronAPI.path.join(projectRootPath!, cleanFolderPath, fileName);
            
            const res = await window.electronAPI.writeFile(fullPath, content);
            if (res.success) {
                const id = addBlock(relativePath, content);
                addToast(`Created ${fileName} in ${cleanFolderPath || 'root'}`, 'success');
                const projData = await window.electronAPI.loadProject(projectRootPath!);
                setFileSystemTree(projData.tree);
            } else {
                throw new Error(res.error || 'Unknown error occurred during file creation');
            }
        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            addToast(`Failed to create file: ${errorMessage}`, 'error');
        }
    } else {
        addBlock(fileName, content);
        addToast(`Created block ${fileName}`, 'success');
    }
  };

  const handleCreateBlockFromCanvas = useCallback(async (type: BlockType, position: Position) => {
      const timestamp = Date.now();
      const defaultName = `${type}_${timestamp}`;
      const fileName = `${defaultName}.rpy`;
      
      let content = '';
      switch (type) {
        case 'story':
            content = `label ${defaultName}:\n    "Start writing your story here..."\n    return\n`;
            break;
        case 'screen':
            content = `screen ${defaultName}():\n    zorder 100\n    frame:\n        align (0.5, 0.5)\n        text "New Screen"\n`;
            break;
        case 'config':
            content = `# Configuration for ${defaultName}\ndefine ${defaultName}_enabled = True\n`;
            break;
      }

      if (window.electronAPI && projectRootPath) {
          try {
              const folderPath = 'game';
              const fullPath = await window.electronAPI.path.join(projectRootPath, folderPath, fileName);
              const relativePath = `game/${fileName}`;
              
              const res = await window.electronAPI.writeFile(fullPath, content);
              if (res.success) {
                  addBlock(relativePath, content, position);
                  addToast(`Created ${fileName}`, 'success');
                  const projData = await window.electronAPI.loadProject(projectRootPath);
                  setFileSystemTree(projData.tree);
              } else {
                  throw new Error(res.error || 'Unknown error occurred during file creation');
              }
          } catch(e) {
              console.error(e);
              const errorMessage = e instanceof Error ? e.message : String(e);
              addToast(`Failed to create file: ${errorMessage}`, 'error');
          }
      } else {
          addBlock(fileName, content, position);
          addToast(`Created block ${fileName}`, 'success');
      }
  }, [addBlock, projectRootPath, addToast]);

  // --- Sticky Note Management ---
  const addStickyNote = useCallback((initialPosition?: Position) => {
      const id = `note-${Date.now()}`;
      const width = 200;
      const height = 200;

      let position: Position;
      if (initialPosition) {
          position = initialPosition;
          // Center the note on the click position
          position.x -= width / 2;
          position.y -= height / 2;
      } else {
          const leftOffset = appSettings.isLeftSidebarOpen ? appSettings.leftSidebarWidth : 0;
          const rightOffset = appSettings.isRightSidebarOpen ? appSettings.rightSidebarWidth : 0;
          const topOffset = 64; 

          const visibleWidth = window.innerWidth - leftOffset - rightOffset;
          const visibleHeight = window.innerHeight - topOffset;

          const screenCenterX = leftOffset + (visibleWidth / 2);
          const screenCenterY = topOffset + (visibleHeight / 2);

          const worldCenterX = (screenCenterX - storyCanvasTransform.x) / storyCanvasTransform.scale;
          const worldCenterY = (screenCenterY - storyCanvasTransform.y) / storyCanvasTransform.scale;

          position = {
              x: worldCenterX - (width / 2),
              y: worldCenterY - (height / 2)
          };
      }

      const newNote: StickyNote = {
          id,
          content: '',
          position,
          width,
          height,
          color: 'yellow'
      };

      setStickyNotes(draft => {
          draft.push(newNote);
      });
      setHasUnsavedSettings(true);
  }, [appSettings, storyCanvasTransform, setStickyNotes]);

  const updateStickyNote = useCallback((id: string, data: Partial<StickyNote>) => {
      setStickyNotes(draft => {
          const idx = draft.findIndex(n => n.id === id);
          if (idx !== -1) Object.assign(draft[idx], data);
      });
      setHasUnsavedSettings(true);
  }, [setStickyNotes]);

  const deleteStickyNote = useCallback((id: string) => {
      setStickyNotes(draft => {
          const idx = draft.findIndex(n => n.id === id);
          if (idx !== -1) draft.splice(idx, 1);
      });
      setHasUnsavedSettings(true);
  }, [setStickyNotes]);


  const getSelectedFolderForNewBlock = useCallback(() => {
    if (explorerSelectedPaths.size === 1) {
        const selectedPath = Array.from(explorerSelectedPaths)[0];
        if (!fileSystemTree) return 'game/';
        const findNode = (node: FileSystemTreeNode, targetPath: string): FileSystemTreeNode | null => {
            if (node.path === targetPath) return node;
            if (node.children) {
                for (const child of node.children) {
                    const found = findNode(child, targetPath);
                    if (found) return found;
                }
            }
            return null;
        };
        const node = findNode(fileSystemTree, selectedPath);
        if (node) {
            if (node.children) {
                return node.path ? (node.path.endsWith('/') ? node.path : node.path + '/') : ''; 
            } else {
                const parts = node.path.split('/');
                parts.pop();
                return parts.length > 0 ? parts.join('/') + '/' : '';
            }
        }
    }
    return 'game/';
  }, [explorerSelectedPaths, fileSystemTree]);

  const deleteBlock = useCallback((id: string) => {
    setGroups(draft => {
        draft.forEach(g => {
            g.blockIds = g.blockIds.filter(bid => bid !== id);
        });
    });
    
    setBlocks(prev => prev.filter(b => b.id !== id));
    setOpenTabs(prev => prev.filter(t => t.blockId !== id));
    if (activeTabId === id) setActiveTabId('canvas');
  }, [setBlocks, setGroups, activeTabId]);

  // --- Layout ---
  const handleTidyUp = useCallback((showToast = true) => {
    setStatusBarMessage('Organizing layout...');
    // Use setTimeout to allow the UI to update with the status message before the heavy calculation
    setTimeout(() => {
        try {
            const links = analysisResult.links;
            const newLayout = computeAutoLayout(blocks, links);
            setBlocks(newLayout);
            if (showToast) {
                addToast('Layout organized', 'success');
            }
            setStatusBarMessage('Layout organized.');
            setTimeout(() => setStatusBarMessage(''), 2000);
        } catch (e) {
            console.error("Failed to tidy up layout:", e);
            if (showToast) {
                addToast('Failed to organize layout', 'error');
            }
            setStatusBarMessage('Error organizing layout.');
        }
    }, 10);
  }, [blocks, analysisResult, setBlocks, addToast]);

  useEffect(() => {
    if (initialLayoutNeeded.current && blocks.length > 0 && analysisResult) {
        initialLayoutNeeded.current = false; 
        setTimeout(() => handleTidyUp(false), 100);
    }
  }, [blocks, analysisResult, handleTidyUp]);

  // --- Tab Management Helpers ---
  const handleOpenStaticTab = useCallback((type: 'canvas' | 'route-canvas') => {
        const id = type;
        setOpenTabs(prev => {
            if (!prev.find(t => t.id === id)) {
                return [...prev, { id, type }];
            }
            return prev;
        });
        setActiveTabId(id);
  }, []);

  // --- File System Integration ---
  
  const loadProject = useCallback(async (path: string) => {
      setIsLoading(true);
      setLoadingMessage('Reading project files...');
      setStatusBarMessage(`Loading project from ${path}...`);
      try {
          const projectData = await window.electronAPI!.loadProject(path);
          
          const loadedBlocks: Block[] = projectData.files.map((f: any, index: number) => ({
              id: `block-${index}-${Date.now()}`,
              content: f.content,
              filePath: f.path,
              position: { x: (index % 5) * 350, y: Math.floor(index / 5) * 250 },
              width: 320,
              height: 200,
              title: f.path.split('/').pop()
          }));
          const blockFilePathMap = new Map(loadedBlocks.map(b => [b.filePath, b]));

          if (loadedBlocks.length === 0) {
             const defaultBlock = {
                 id: `block-${Date.now()}`,
                 content: `label start:\n    "Welcome to your new project!"\n    return\n`,
                 filePath: `script.rpy`,
                 position: { x: 50, y: 50 },
                 width: 320, height: 200, title: 'script.rpy'
             };
             loadedBlocks.push(defaultBlock);
             if (window.electronAPI?.writeFile) {
                 const scriptPath = await window.electronAPI.path.join(projectData.rootPath, 'script.rpy');
                 await window.electronAPI.writeFile(scriptPath, defaultBlock.content);
                 if (projectData.tree) {
                     projectData.tree.children = [...(projectData.tree.children || []), { name: 'script.rpy', path: 'script.rpy' }];
                 }
             }
          }

          setProjectRootPath(projectData.rootPath);
          
          // Update Recent Projects
          updateAppSettings(draft => {
              // Remove if exists to move to top
              const filtered = draft.recentProjects.filter(p => p !== projectData.rootPath);
              draft.recentProjects = [projectData.rootPath, ...filtered].slice(0, 25);
          });

          setBlocks(loadedBlocks);
          initialLayoutNeeded.current = true;
          setFileSystemTree(projectData.tree);
          
          const imgMap = new Map<string, ProjectImage>();
          projectData.images.forEach((img: any) => {
              imgMap.set(img.path, { 
                  ...img, 
                  filePath: img.path,
                  fileName: img.path.split('/').pop(), 
                  isInProject: true, 
                  fileHandle: null 
              });
          });
          setImages(imgMap);

          const audioMap = new Map<string, RenpyAudio>();
          projectData.audios.forEach((aud: any) => {
              audioMap.set(aud.path, { 
                  ...aud, 
                  filePath: aud.path,
                  fileName: aud.path.split('/').pop(), 
                  isInProject: true, 
                  fileHandle: null 
              });
          });
          setAudios(audioMap);

          if (projectData.settings) {
              updateProjectSettings(draft => {
                  draft.enableAiFeatures = projectData.settings.enableAiFeatures ?? false;
                  draft.selectedModel = projectData.settings.selectedModel ?? 'gemini-2.5-flash';
              });
              setStickyNotes(projectData.settings.stickyNotes || []);
              setCharacterProfiles(projectData.settings.characterProfiles || {});
              
              // Load Scene Compositions
              // Helper to link saved paths back to loaded image objects
              const rehydrateSprite = (s: any) => {
                  const path = s.image.filePath;
                  // Try to find the image in the project images map
                  // If not found (e.g. was external), create a placeholder. 
                  const img = imgMap.get(path) || { 
                      filePath: path, 
                      fileName: path.split(/[/\\]/).pop() || 'unknown', 
                      isInProject: false, 
                      fileHandle: null,
                      dataUrl: '' 
                  };
                  return { ...s, image: img };
              };

              const rehydrateScene = (sc: any) => ({
                  background: sc.background ? rehydrateSprite(sc.background) : null,
                  sprites: (sc.sprites || []).map(rehydrateSprite)
              });

              if (projectData.settings.sceneCompositions) {
                  const restoredScenes: Record<string, SceneComposition> = {};
                  Object.entries(projectData.settings.sceneCompositions as Record<string, any>).forEach(([id, sc]) => {
                      const comp = sc as SceneComposition;
                      restoredScenes[id] = {
                          background: comp.background ? rehydrateSprite(comp.background) : null,
                          sprites: comp.sprites.map(rehydrateSprite)
                      };
                  });
                  setSceneCompositions(restoredScenes);
                  setSceneNames(projectData.settings.sceneNames || {});
              } else if (projectData.settings.sceneComposition) {
                  // Migration for legacy single scene
                  const defaultId = 'scene-default';
                  setSceneCompositions({ [defaultId]: rehydrateScene(projectData.settings.sceneComposition) });
                  setSceneNames({ [defaultId]: 'Default Scene' });
              } else {
                  setSceneCompositions({});
                  setSceneNames({});
              }

              // Restore Scan Directories
              if (projectData.settings.scannedImagePaths) {
                  const paths = projectData.settings.scannedImagePaths;
                  const map = new Map<string, FileSystemDirectoryHandle>();
                  paths.forEach((p: string) => map.set(p, {} as any));
                  setImageScanDirectories(map);
                  
                  // Trigger scan
                  if (window.electronAPI) {
                       paths.forEach((dirPath: string) => {
                           window.electronAPI!.scanDirectory(dirPath).then(({ images: scanned }) => {
                               setImages(prev => {
                                   const next = new Map(prev);
                                   scanned.forEach((img: any) => {
                                       if (!next.has(img.path)) {
                                           // Check if this file exists in the project
                                           const fileName = img.path.split('/').pop();
                                           const potentialProjectPath = `game/images/${fileName}`;
                                           const linkedPath = next.has(potentialProjectPath) ? potentialProjectPath : undefined;

                                           // Ensure external images also have filePath set correctly
                                           next.set(img.path, { 
                                             ...img, 
                                             filePath: img.path, 
                                             isInProject: false, 
                                             fileHandle: null,
                                             projectFilePath: linkedPath 
                                           });
                                       }
                                   });
                                   return next;
                               });
                           });
                       });
                  }
              }
              
              if (projectData.settings.scannedAudioPaths) {
                  const paths = projectData.settings.scannedAudioPaths;
                  const map = new Map<string, FileSystemDirectoryHandle>();
                  paths.forEach((p: string) => map.set(p, {} as any));
                  setAudioScanDirectories(map);

                  // Trigger scan
                  if (window.electronAPI) {
                       paths.forEach((dirPath: string) => {
                           window.electronAPI!.scanDirectory(dirPath).then(({ audios: scanned }) => {
                               setAudios(prev => {
                                   const next = new Map(prev);
                                   scanned.forEach((aud: any) => {
                                       if (!next.has(aud.path)) {
                                           // Check if this file exists in the project
                                           const fileName = aud.path.split('/').pop();
                                           const potentialProjectPath = `game/audio/${fileName}`;
                                           const linkedPath = next.has(potentialProjectPath) ? potentialProjectPath : undefined;

                                           // Ensure external audio also has filePath set correctly
                                           next.set(aud.path, { 
                                             ...aud, 
                                             filePath: aud.path, 
                                             isInProject: false, 
                                             fileHandle: null, 
                                             projectFilePath: linkedPath
                                           });
                                       }
                                   });
                                   return next;
                               });
                           });
                       });
                  }
              }

              const savedTabs: EditorTab[] = projectData.settings.openTabs ?? [{ id: 'canvas', type: 'canvas' }];
              const tempAnalysis = performRenpyAnalysis(loadedBlocks);

              const validTabs = savedTabs.filter(tab => {
                  if (tab.type === 'editor' && tab.filePath) {
                      return blockFilePathMap.has(tab.filePath);
                  }
                  if (tab.type === 'image' && tab.filePath) {
                      return imgMap.has(tab.filePath);
                  }
                  if (tab.type === 'audio' && tab.filePath) {
                      return audioMap.has(tab.filePath);
                  }
                  if (tab.type === 'character' && tab.characterTag) {
                      return tempAnalysis.characters.has(tab.characterTag);
                  }
                  if (tab.type === 'scene-composer' && tab.sceneId) {
                      // We allow opening even if not strictly in state yet (might be migrated)
                      return true;
                  }
                  return tab.type === 'canvas' || tab.type === 'route-canvas';
              });

              const rehydratedTabs = validTabs.map(tab => {
                  if (tab.type === 'editor' && tab.filePath) {
                      const matchingBlock = blockFilePathMap.get(tab.filePath);
                      if (matchingBlock) {
                          return { ...tab, id: matchingBlock.id, blockId: matchingBlock.id };
                      }
                  }
                  // Migrate old single scene tab
                  if (tab.type === 'scene-composer' && !tab.sceneId) {
                      return { ...tab, sceneId: 'scene-default' };
                  }
                  return tab;
              });

              setOpenTabs(rehydratedTabs);
              
              const activeTabIsValid = rehydratedTabs.some(t => t.id === projectData.settings.activeTabId);
              setActiveTabId(activeTabIsValid ? projectData.settings.activeTabId : 'canvas');
              
          } else {
              updateProjectSettings(draft => {
                  draft.enableAiFeatures = false;
                  draft.selectedModel = 'gemini-2.5-flash';
              });
              setOpenTabs([{ id: 'canvas', type: 'canvas' }]);
              setActiveTabId('canvas');
              setStickyNotes([]);
              setCharacterProfiles({});
              setSceneCompositions({});
              setSceneNames({});
          }
          
          setHasUnsavedSettings(false);
          setShowWelcome(false);
          addToast('Project loaded successfully', 'success');
          setStatusBarMessage('Project loaded.');
          setTimeout(() => setStatusBarMessage(''), 3000);
      } catch (err) {
          console.error(err);
          addToast('Failed to load project', 'error');
          setStatusBarMessage('Error loading project.');
      } finally {
          setIsLoading(false);
      }
  }, [setBlocks, setImages, setAudios, updateProjectSettings, addToast, setFileSystemTree, setStickyNotes, setCharacterProfiles, updateAppSettings, setSceneCompositions, setSceneNames]);


  const handleOpenProjectFolder = useCallback(async () => {
    try {
        if (window.electronAPI) {
            const path = await window.electronAPI.openDirectory();
            if (path) {
                await loadProject(path);
            }
        } else {
            alert("To use local file system features, please run this app in Electron or use a compatible browser with FS Access API support (Chrome/Edge). For now, you are in Browser Mode.");
        }
    } catch (err) {
        console.error(err);
        addToast('Failed to open project', 'error');
    }
  }, [loadProject, addToast]);

  const handleCreateProject = useCallback(async () => {
      try {
          if (window.electronAPI?.createProject) {
              const path = await window.electronAPI.createProject();
              if (path) {
                  await loadProject(path);
              }
          } else {
              alert("Project creation is only supported in the Electron app.");
          }
      } catch (err) {
          console.error(err);
          addToast('Failed to create project', 'error');
      }
  }, [loadProject, addToast]);

  const handleSaveBlock = useCallback(async (blockId: string) => {
    const editor = editorInstances.current.get(blockId);
    let contentToSave: string | undefined;

    if (editor) {
        contentToSave = editor.getValue();
        updateBlock(blockId, { content: contentToSave });
    } else {
        const block = blocks.find(b => b.id === blockId);
        contentToSave = block?.content;
    }

    if (contentToSave === undefined) return;

    if (window.electronAPI && projectRootPath) {
        const block = blocks.find(b => b.id === blockId);
        if (block && block.filePath) {
             const absPath = await window.electronAPI.path.join(projectRootPath, block.filePath);
             const res = await window.electronAPI.writeFile(absPath, contentToSave);
             if (res.success) {
                 addToast(`Saved ${block.title || 'file'}`, 'success');
             } else {
                 addToast(`Failed to save: ${res.error}`, 'error');
             }
        }
    }

    setDirtyBlockIds(prev => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
    });
    setDirtyEditors(prev => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
    });

  }, [blocks, projectRootPath, updateBlock, addToast]);
  
  const handleSaveProjectSettings = useCallback(async () => {
    if (!projectRootPath || !window.electronAPI) return;
    try {
      // Serialize scenes: map images to just their paths to avoid circular refs and huge files
      const serializeSprite = (s: any) => ({
          ...s,
          image: { filePath: s.image.filePath }
      });

      const serializableScenes: Record<string, any> = {};
      Object.entries(sceneCompositions).forEach(([id, sc]) => {
          const comp = sc as SceneComposition;
          serializableScenes[id] = {
              background: comp.background ? serializeSprite(comp.background) : null,
              sprites: comp.sprites.map(serializeSprite)
          };
      });

      const settingsToSave: ProjectSettings = {
        ...(projectSettings as Omit<ProjectSettings, 'characterProfiles' | 'sceneCompositions' | 'sceneNames' | 'scannedImagePaths' | 'scannedAudioPaths'>),
        openTabs,
        activeTabId,
        stickyNotes: Array.from(stickyNotes),
        characterProfiles,
        sceneCompositions: serializableScenes,
        sceneNames,
        scannedImagePaths: Array.from(imageScanDirectories.keys()),
        scannedAudioPaths: Array.from(audioScanDirectories.keys()),
      };
      const settingsPath = await window.electronAPI.path.join(projectRootPath, 'game/project.ide.json');
      await window.electronAPI.writeFile(settingsPath, JSON.stringify(settingsToSave, null, 2));
      setHasUnsavedSettings(false);
    } catch (e) {
      console.error("Failed to save IDE settings:", e);
      addToast('Failed to save workspace settings', 'error');
    }
  }, [projectRootPath, projectSettings, openTabs, activeTabId, stickyNotes, characterProfiles, addToast, sceneCompositions, sceneNames, imageScanDirectories, audioScanDirectories]);


  const handleSaveAll = useCallback(async () => {
    setSaveStatus('saving');
    setStatusBarMessage('Saving files...');
    try {
        let currentBlocks = [...blocks];
        const editorUpdates = new Map<string, string>();

        for (const blockId of dirtyEditors) {
             const editor = editorInstances.current.get(blockId);
             if (editor) {
                 const content = editor.getValue();
                 editorUpdates.set(blockId, content);
                 const idx = currentBlocks.findIndex(b => b.id === blockId);
                 if (idx !== -1) {
                     currentBlocks[idx] = { ...currentBlocks[idx], content };
                 }
             }
        }

        if (editorUpdates.size > 0) {
            setBlocks(prev => prev.map(b => {
                if(editorUpdates.has(b.id)) {
                    return { ...b, content: editorUpdates.get(b.id)! };
                }
                return b;
            }));
        }

        const blocksToSave = new Set([...dirtyBlockIds, ...dirtyEditors]);

        if (!projectRootPath && !directoryHandle) {
             setDirtyBlockIds(new Set());
             setDirtyEditors(new Set());
             setHasUnsavedSettings(false);
             setSaveStatus('saved');
             addToast('Changes saved to memory', 'success');
             setStatusBarMessage('Saved to memory.');
             setTimeout(() => { setSaveStatus('saved'); setStatusBarMessage(''); }, 2000);
             return;
        }

        if (window.electronAPI) {
            for (const blockId of blocksToSave) {
                const block = currentBlocks.find(b => b.id === blockId);
                if (block && block.filePath) {
                    const absPath = await window.electronAPI.path.join(projectRootPath!, block.filePath);
                    const res = await window.electronAPI.writeFile(absPath, block.content);
                    if (!res.success) throw new Error(res.error || 'Unknown error saving file');
                }
            }
            await handleSaveProjectSettings();
        } 

        setDirtyBlockIds(new Set());
        setDirtyEditors(new Set());
        setSaveStatus('saved');
        addToast('All changes saved', 'success');
        setStatusBarMessage('All files saved.');
        setTimeout(() => { setSaveStatus('saved'); setStatusBarMessage(''); }, 2000);
    } catch (err) {
        console.error(err);
        setSaveStatus('error');
        addToast('Failed to save changes', 'error');
        setStatusBarMessage('Error saving files.');
    }
  }, [blocks, dirtyEditors, dirtyBlockIds, projectRootPath, directoryHandle, addToast, setBlocks, handleSaveProjectSettings]);
  
  const handleNewProjectRequest = useCallback(() => {
    const hasUnsaved = dirtyBlockIds.size > 0 || dirtyEditors.size > 0 || hasUnsavedSettings;
    
    if (hasUnsaved) {
      setUnsavedChangesModalInfo({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Do you want to save them before creating a new project?',
        confirmText: 'Save & Create',
        dontSaveText: "Don't Save & Create",
        onConfirm: async () => {
          await handleSaveAll();
          handleCreateProject();
          setUnsavedChangesModalInfo(null);
        },
        onDontSave: () => {
          handleCreateProject();
          setUnsavedChangesModalInfo(null);
        },
        onCancel: () => {
          setUnsavedChangesModalInfo(null);
        }
      });
    } else {
      handleCreateProject();
    }
  }, [dirtyBlockIds, dirtyEditors, hasUnsavedSettings, handleCreateProject, handleSaveAll]);
  
  // --- Tab Management ---
  const handleOpenEditor = useCallback((blockId: string, line?: number) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const existing = openTabs.find(t => t.id === blockId);
    if (!existing) {
        setOpenTabs(prev => [...prev, { 
            id: blockId, 
            type: 'editor', 
            blockId,
            filePath: block.filePath,
            scrollRequest: line ? { line, key: Date.now() } : undefined 
        }]);
    } else if (line) {
        setOpenTabs(prev => prev.map(tab => 
            tab.id === blockId 
                ? { ...tab, scrollRequest: { line, key: Date.now() } }
                : tab
        ));
    }
    setActiveTabId(blockId);
  }, [blocks, openTabs]);

  const handleOpenImageEditorTab = useCallback((filePath: string) => {
    const tabId = `img-${filePath}`;
    setOpenTabs(prev => {
      if (!prev.find(t => t.id === tabId)) {
        return [...prev, { id: tabId, type: 'image', filePath: filePath }];
      }
      return prev;
    });
    setActiveTabId(tabId);
  }, []);

  const handlePathDoubleClick = useCallback((filePath: string) => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const lowerFilePath = filePath.toLowerCase();

    if (lowerFilePath.endsWith('.rpy')) {
      const block = blocks.find(b => b.filePath === filePath);
      if (block) {
        handleOpenEditor(block.id);
      }
    } else if (imageExtensions.some(ext => lowerFilePath.endsWith(ext))) {
      handleOpenImageEditorTab(filePath);
    }
  }, [blocks, handleOpenEditor, handleOpenImageEditorTab]);

  const handleCloseTab = useCallback((tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
        setActiveTabId('canvas');
    }
  }, [activeTabId]);

  const handleTabContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      setContextMenuInfo({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  const handleCloseOthersRequest = useCallback((tabId: string) => {
    const tabsToClose = openTabs.filter(t => t.id !== tabId && t.id !== 'canvas');
    const hasUnsaved = tabsToClose.some(t => t.blockId && (dirtyBlockIds.has(t.blockId) || dirtyEditors.has(t.blockId)));
    
    const closeAction = () => {
        const keptTabs = openTabs.filter(t => t.id === tabId || t.id === 'canvas');
        setOpenTabs(keptTabs);
        if (!keptTabs.some(t => t.id === activeTabId)) {
            setActiveTabId(tabId);
        }
    };

    if (hasUnsaved) {
        setUnsavedChangesModalInfo({
            title: 'Close Other Tabs',
            message: 'You have unsaved changes. Do you want to save them before closing other tabs?',
            confirmText: 'Save & Close',
            dontSaveText: "Don't Save & Close",
            onConfirm: async () => {
                await handleSaveAll();
                closeAction();
                setUnsavedChangesModalInfo(null);
            },
            onDontSave: () => {
                closeAction();
                setUnsavedChangesModalInfo(null);
            },
            onCancel: () => {
                setUnsavedChangesModalInfo(null);
            }
        });
    } else {
        closeAction();
    }
  }, [openTabs, activeTabId, dirtyBlockIds, dirtyEditors, handleSaveAll]);

  const handleCloseAllRequest = useCallback(() => {
    const tabsToClose = openTabs.filter(t => t.id !== 'canvas');
    const hasUnsaved = tabsToClose.some(t => t.blockId && (dirtyBlockIds.has(t.blockId) || dirtyEditors.has(t.blockId)));

    const closeAction = () => {
        setOpenTabs([{ id: 'canvas', type: 'canvas' }]);
        setActiveTabId('canvas');
    };

    if (hasUnsaved) {
        setUnsavedChangesModalInfo({
            title: 'Close All Tabs',
            message: 'You have unsaved changes. Do you want to save them before closing all tabs?',
            confirmText: 'Save & Close',
            dontSaveText: "Don't Save & Close",
            onConfirm: async () => {
                await handleSaveAll();
                closeAction();
                setUnsavedChangesModalInfo(null);
            },
            onDontSave: () => {
                closeAction();
                setUnsavedChangesModalInfo(null);
            },
            onCancel: () => {
                setUnsavedChangesModalInfo(null);
            }
        });
    } else {
        closeAction();
    }
  }, [openTabs, dirtyBlockIds, dirtyEditors, handleSaveAll]);

  const handleSwitchTab = (tabId: string) => setActiveTabId(tabId);

  const handleCenterOnBlock = useCallback((blockId: string) => {
      setActiveTabId('canvas');
      setCenterOnBlockRequest({ blockId, key: Date.now() });
  }, []);

  const handleFindUsages = (id: string, type: 'character' | 'variable') => {
      const ids = new Set<string>();
      if (type === 'character') {
          const lines = analysisResult.dialogueLines;
          lines.forEach((dialogues, blockId) => {
              if (dialogues.some(d => d.tag === id)) ids.add(blockId);
          });
      } else {
          const usages = analysisResult.variableUsages.get(id);
          usages?.forEach(u => ids.add(u.blockId));
      }
      
      setFindUsagesHighlightIds(ids);
      setActiveTabId('canvas');
      addToast(`Found usages in ${ids.size} blocks`, 'info');
  };

  const analysisResultWithProfiles = useMemo(() => {
    if (!analysisResult) return analysisResult;
    const newCharacters = new Map(analysisResult.characters);
    newCharacters.forEach((char, tag) => {
        const profile = characterProfiles[tag];
        if (profile !== undefined) {
            newCharacters.set(tag, { ...char, profile });
        }
    });
    return { ...analysisResult, characters: newCharacters };
  }, [analysisResult, characterProfiles]);

  // --- Character Editor ---
  const handleOpenCharacterEditor = useCallback((tag: string) => {
      const tabId = `char-${tag}`;
      setOpenTabs(prev => {
          if (!prev.find(t => t.id === tabId)) {
              return [...prev, { id: tabId, type: 'character', characterTag: tag }];
          }
          return prev;
      });
      setActiveTabId(tabId);
  }, []);

  const handleUpdateCharacter = useCallback(async (char: Character, oldTag?: string) => {
    const buildCharacterString = (char: Character): string => {
        const args: string[] = [];
        if (char.name && char.name !== char.tag) {
            args.push(`"${char.name}"`);
        }

        const kwargs: Record<string, string> = {};
        if (char.color) kwargs.color = `"${char.color}"`;
        if (char.image) kwargs.image = `"${char.image}"`;
        if (char.who_prefix) kwargs.who_prefix = `"${char.who_prefix}"`;
        if (char.who_suffix) kwargs.who_suffix = `"${char.who_suffix}"`;
        if (char.what_prefix) kwargs.what_prefix = `"${char.what_prefix}"`;
        if (char.what_suffix) kwargs.what_suffix = `"${char.what_suffix}"`;
        if (char.what_color) kwargs.what_color = `"${char.what_color}"`;
        if (char.slow) kwargs.slow = 'True';
        if (char.ctc) kwargs.ctc = `"${char.ctc}"`;
        if (char.ctc_position && char.ctc_position !== 'nestled') kwargs.ctc_position = `"${char.ctc_position}"`;

        const kwargStrings = Object.entries(kwargs).map(([key, value]) => `${key}=${value}`);
        const allArgs = [...args, ...kwargStrings].join(', ');

        return `define ${char.tag} = Character(${allArgs})`;
    };

    const newCharString = buildCharacterString(char);

    setCharacterProfiles(draft => {
        if (oldTag && oldTag !== char.tag) { // Should not happen with read-only tag
            delete draft[oldTag];
        }
        if (char.profile) {
            draft[char.tag] = char.profile;
        } else {
            delete draft[char.tag];
        }
    });
    setHasUnsavedSettings(true);

    if (oldTag) { // Updating existing character
        const originalCharDef = analysisResult.characters.get(oldTag);
        if (!originalCharDef) {
            addToast(`Error: Cannot find original definition for character '${oldTag}'.`, 'error');
            return;
        }

        const blockToUpdate = blocks.find(b => b.id === originalCharDef.definedInBlockId);
        if (!blockToUpdate) {
            addToast(`Error: Cannot find file for character '${oldTag}'.`, 'error');
            return;
        }

        const regex = new RegExp(`^(\\s*define\\s+${oldTag}\\s*=\\s*Character\\s*\\([\\s\\S]*?\\))`, 'm');
        if (regex.test(blockToUpdate.content)) {
            const newContent = blockToUpdate.content.replace(regex, newCharString);
            updateBlock(blockToUpdate.id, { content: newContent });
        } else {
            addToast(`Error: Could not find the Character definition for '${oldTag}' to update.`, 'error');
            return;
        }
    } else { // Creating new character
        const charFilePath = 'game/characters.rpy';
        const existingFileBlock = blocks.find(b => b.filePath === charFilePath);
        
        if (existingFileBlock) {
            const newContent = `${existingFileBlock.content.trim()}\n\n${newCharString}\n`;
            updateBlock(existingFileBlock.id, { content: newContent });
        } else {
            const newContent = `# This file stores character definitions.\n\n${newCharString}\n`;
            if (window.electronAPI && projectRootPath) {
                try {
                    const fullPath = await window.electronAPI.path.join(projectRootPath, charFilePath);
                    const res = await window.electronAPI.writeFile(fullPath, newContent);
                    if (res.success) {
                        addBlock(charFilePath, newContent);
                        const projData = await window.electronAPI.loadProject(projectRootPath);
                        setFileSystemTree(projData.tree);
                    } else { throw new Error(res.error || 'Unknown file creation error'); }
                } catch (e) {
                    addToast(`Failed to create characters.rpy: ${e instanceof Error ? e.message : String(e)}`, 'error');
                    return;
                }
            } else {
                addBlock(charFilePath, newContent);
            }
        }
    }
    
    addToast(`Character '${char.name}' saved.`, 'success');
  }, [addToast, analysisResult.characters, blocks, projectRootPath, setCharacterProfiles, updateBlock, addBlock, setFileSystemTree]);

  // --- Search ---
  const handleToggleSearch = () => {
    setActiveLeftPanel('search');
    if (!appSettings.isLeftSidebarOpen) {
      updateAppSettings(draft => { draft.isLeftSidebarOpen = true; });
    }
  };

  const handleSearch = useCallback(async () => {
    if (!projectRootPath || !searchQuery.trim() || !window.electronAPI) return;
    setIsSearching(true);
    setSearchResults([]);
    setStatusBarMessage('Searching...');
    try {
      const results = await window.electronAPI.searchInProject({
        projectPath: projectRootPath,
        query: searchQuery,
        ...searchOptions,
      });
      setSearchResults(results);
      setStatusBarMessage(`Search complete. Found ${results.reduce((acc, r) => acc + r.matches.length, 0)} matches in ${results.length} files.`);
      setTimeout(() => setStatusBarMessage(''), 3000);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      addToast(`Search failed: ${errorMessage}`, 'error');
      setStatusBarMessage('Search failed.');
    } finally {
      setIsSearching(false);
    }
  }, [projectRootPath, searchQuery, searchOptions, setSearchResults, addToast]);

  const handleSearchResultClick = useCallback((filePath: string, lineNumber: number) => {
    const block = blocks.find(b => b.filePath === filePath);
    if (block) {
      handleOpenEditor(block.id, lineNumber);
    }
  }, [blocks, handleOpenEditor]);

  const handleReplaceAll = useCallback(() => {
    const totalMatches = searchResults.reduce((sum, file) => sum + file.matches.length, 0);
    if (totalMatches === 0) return;

    setReplaceAllConfirmInfo({
      totalMatches,
      totalFiles: searchResults.length,
      onConfirm: () => {
        try {
          let flags = 'g';
          if (!searchOptions.isCaseSensitive) flags += 'i';

          let searchPattern = searchOptions.isRegex ? searchQuery : searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (searchOptions.isWholeWord) {
            searchPattern = `\\b${searchPattern}\\b`;
          }
          const regex = new RegExp(searchPattern, flags);
          
          const updatedBlockIds = new Set<string>();

          const newBlocks = blocks.map(block => {
            const fileResult = searchResults.find(r => r.filePath === block.filePath);
            if (fileResult) {
              const newContent = block.content.replace(regex, replaceQuery);
              if (newContent !== block.content) {
                updatedBlockIds.add(block.id);
                
                const editorInstance = editorInstances.current.get(block.id);
                if (editorInstance && editorInstance.getValue() !== newContent) {
                  editorInstance.setValue(newContent);
                }
                return { ...block, content: newContent };
              }
            }
            return block;
          });
          
          setBlocks(newBlocks);
          setDirtyBlockIds(prev => new Set([...prev, ...updatedBlockIds]));

          addToast(`Replaced ${totalMatches} occurrences across ${updatedBlockIds.size} files.`, 'success');

          // Clear search state
          setSearchQuery('');
          setReplaceQuery('');
          setSearchResults([]);

        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          addToast(`Replace failed: ${errorMessage}`, 'error');
        } finally {
          setReplaceAllConfirmInfo(null);
        }
      }
    });
  }, [searchResults, searchQuery, replaceQuery, searchOptions, blocks, addToast, setBlocks, setDirtyBlockIds, setSearchQuery, setReplaceQuery, setSearchResults]);


  // --- Highlights ---
  const clearHighlights = () => {
      setFindUsagesHighlightIds(null);
      setHoverHighlightIds(null);
  };

  // --- Route Canvas Support ---
  const [routeCanvasData, setRouteCanvasData] = useState<{
      labelNodes: LabelNode[], routeLinks: any[], identifiedRoutes: any[]
  }>({ labelNodes: [], routeLinks: [], identifiedRoutes: [] });

  const handleAnalyzeRoutes = useCallback(() => {
      setStatusBarMessage('Analyzing route paths...');
      // Allow render cycle to update status bar before heavy calculation
      setTimeout(() => {
          const { labelNodes, routeLinks, identifiedRoutes } = performRouteAnalysis(blocks, analysisResult.labels, analysisResult.jumps);
          const layoutedNodes = computeAutoLayout(labelNodes, routeLinks);
          setRouteCanvasData({ labelNodes: layoutedNodes, routeLinks, identifiedRoutes });
          
          const tabId = 'route-canvas';
          setOpenTabs(prev => {
              if (!prev.some(t => t.id === tabId)) {
                  return [...prev, { id: tabId, type: 'route-canvas' }];
              }
              return prev;
          });
          setActiveTabId(tabId);
          setStatusBarMessage('Route analysis complete.');
          setTimeout(() => setStatusBarMessage(''), 3000);
      }, 10);
  }, [blocks, analysisResult]);

  // --- Asset Management ---
  const handleAddImageScanDirectory = useCallback(async () => {
      if (!window.electronAPI) return;
      
      const path = await window.electronAPI.openDirectory();
      if (!path) return;

      setIsRefreshingImages(true);
      try {
          const { images } = await window.electronAPI.scanDirectory(path);
          
          setImages(prev => {
              const next = new Map(prev);
              images.forEach((img: any) => {
                  const key = img.path;
                  if (!next.has(key)) {
                      const fileName = img.path.split('/').pop();
                      const potentialProjectPath = `game/images/${fileName}`;
                      const linkedPath = next.has(potentialProjectPath) ? potentialProjectPath : undefined;

                      next.set(key, { 
                        ...img, 
                        filePath: img.path, 
                        isInProject: false, 
                        fileHandle: null,
                        projectFilePath: linkedPath 
                      });
                  }
              });
              return next;
          });
          
          setImageScanDirectories(prev => new Map(prev).set(path, {} as any));
          setImagesLastScanned(Date.now());
          setHasUnsavedSettings(true);
          addToast(`Scanned ${images.length} images from ${path}`, 'success');
      } catch (e) {
          console.error(e);
          addToast('Failed to scan image directory', 'error');
      } finally {
          setIsRefreshingImages(false);
      }
  }, [addToast]);

  const handleAddAudioScanDirectory = useCallback(async () => {
      if (!window.electronAPI) return;
      
      const path = await window.electronAPI.openDirectory();
      if (!path) return;

      setIsRefreshingAudios(true);
      try {
          const { audios } = await window.electronAPI.scanDirectory(path);
          
          setAudios(prev => {
              const next = new Map(prev);
              audios.forEach((aud: any) => {
                  const key = aud.path;
                  if (!next.has(key)) {
                      const fileName = aud.path.split('/').pop();
                      const potentialProjectPath = `game/audio/${fileName}`;
                      const linkedPath = next.has(potentialProjectPath) ? potentialProjectPath : undefined;

                      next.set(key, { 
                        ...aud, 
                        filePath: aud.path, 
                        isInProject: false, 
                        fileHandle: null, 
                        projectFilePath: linkedPath 
                      });
                  }
              });
              return next;
          });
          
          setAudioScanDirectories(prev => new Map(prev).set(path, {} as any));
          setAudiosLastScanned(Date.now());
          setHasUnsavedSettings(true);
          addToast(`Scanned ${audios.length} audio files from ${path}`, 'success');
      } catch (e) {
          console.error(e);
          addToast('Failed to scan audio directory', 'error');
      } finally {
          setIsRefreshingAudios(false);
      }
  }, [addToast]);

  const handleRefreshImages = useCallback(async () => {
      if (!window.electronAPI) return;
      setIsRefreshingImages(true);
      try {
          const scanDirs = Array.from(imageScanDirectories.keys());
          const newScannedImages = new Map<string, ProjectImage>();

          // Re-scan all directories
          for (const dirPath of scanDirs) {
              const { images: scanned } = await window.electronAPI.scanDirectory(dirPath);
              scanned.forEach((img: any) => {
                  newScannedImages.set(img.path, { ...img, filePath: img.path, isInProject: false, fileHandle: null });
              });
          }

          setImages(prev => {
              const next = new Map<string, ProjectImage>();
              // Keep all project images
              prev.forEach((val, key) => {
                  if (val.isInProject) {
                      next.set(key, val);
                  }
              });
              // Add freshly scanned images
              newScannedImages.forEach((val, key) => {
                  if (!next.has(key)) {
                      const fileName = val.filePath.split('/').pop();
                      const potentialProjectPath = `game/images/${fileName}`;
                      const linkedPath = next.has(potentialProjectPath) ? potentialProjectPath : undefined;

                      next.set(key, { ...val, projectFilePath: linkedPath });
                  }
              });
              return next;
          });

          setImagesLastScanned(Date.now());
          addToast('Images refreshed', 'success');
      } catch (e) {
          console.error(e);
          addToast('Failed to refresh images', 'error');
      } finally {
          setIsRefreshingImages(false);
      }
  }, [imageScanDirectories, addToast]);

  const handleRemoveImageScanDirectory = useCallback((dirPath: string) => {
      setImageScanDirectories(prev => {
          const next = new Map(prev);
          next.delete(dirPath);
          return next;
      });
      
      setImages(prev => {
          const next = new Map<string, ProjectImage>();
          prev.forEach((val, key) => {
              // If it's a project file, keep it.
              // If it's an external file, keep it ONLY if it doesn't start with the removed directory path.
              if (val.isInProject || !val.filePath.startsWith(dirPath)) {
                  next.set(key, val);
              }
          });
          return next;
      });
      setHasUnsavedSettings(true);
  }, []);

  const handleRefreshAudios = useCallback(async () => {
      if (!window.electronAPI) return;
      setIsRefreshingAudios(true);
      try {
          const scanDirs = Array.from(audioScanDirectories.keys());
          const newScannedAudios = new Map<string, RenpyAudio>();

          for (const dirPath of scanDirs) {
              const { audios: scanned } = await window.electronAPI.scanDirectory(dirPath);
              scanned.forEach((aud: any) => {
                  newScannedAudios.set(aud.path, { ...aud, filePath: aud.path, isInProject: false, fileHandle: null });
              });
          }

          setAudios(prev => {
              const next = new Map<string, RenpyAudio>();
              prev.forEach((val, key) => {
                  if (val.isInProject) {
                      next.set(key, val);
                  }
              });
              newScannedAudios.forEach((val, key) => {
                  if (!next.has(key)) {
                      const fileName = val.filePath.split('/').pop();
                      const potentialProjectPath = `game/audio/${fileName}`;
                      const linkedPath = next.has(potentialProjectPath) ? potentialProjectPath : undefined;

                      next.set(key, { ...val, projectFilePath: linkedPath });
                  }
              });
              return next;
          });

          setAudiosLastScanned(Date.now());
          addToast('Audio files refreshed', 'success');
      } catch (e) {
          console.error(e);
          addToast('Failed to refresh audio files', 'error');
      } finally {
          setIsRefreshingAudios(false);
      }
  }, [audioScanDirectories, addToast]);

  const handleRemoveAudioScanDirectory = useCallback((dirPath: string) => {
      setAudioScanDirectories(prev => {
          const next = new Map(prev);
          next.delete(dirPath);
          return next;
      });
      
      setAudios(prev => {
          const next = new Map<string, RenpyAudio>();
          prev.forEach((val, key) => {
              if (val.isInProject || !val.filePath.startsWith(dirPath)) {
                  next.set(key, val);
              }
          });
          return next;
      });
      setHasUnsavedSettings(true);
  }, []);

  const handleCopyImagesToProject = async (sourcePaths: string[]) => {
      if (!projectRootPath || !window.electronAPI) return;
      
      setIsLoading(true);
      setStatusBarMessage('Copying images to project...');
      try {
          // Prepare updates first
          const updates: { src: string, newData: any }[] = [];

          for (const src of sourcePaths) {
              const fileName = src.split(/[/\\]/).pop();
              if (!fileName) continue;
              
              const relativeDest = `game/images/${fileName}`;
              const destPath = await window.electronAPI.path.join(projectRootPath, 'game', 'images', fileName);
              
              const img = images.get(src);
              if (img) {
                 await window.electronAPI.copyEntry(img.filePath, destPath);
                 
                 // Robust URL Construction
                 // destPath is absolute OS path
                 // We need to normalize it for URL and encode it safely
                 const normalized = destPath.replace(/\\/g, '/');
                 // Ensure path starts with / for URL pathname construction if it's absolute
                 const urlPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
                 
                 // Split into segments to encode component-wise to handle #, ?, etc.
                 const encodedPath = urlPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
                 const mediaUrl = `media://${encodedPath}`;
                 
                 updates.push({
                     src,
                     newData: {
                         filePath: relativeDest,
                         fileName,
                         isInProject: true,
                         projectFilePath: relativeDest,
                         dataUrl: mediaUrl,
                         size: img.size,
                         lastModified: Date.now()
                     }
                 });
              }
          }

          // Apply state updates synchronously
          setImages(prev => {
             const next = new Map(prev);
             updates.forEach(({ src, newData }) => {
                 // Add the new project-local image
                 next.set(newData.filePath, { ...newData, fileHandle: null });
                 
                 // Update the original scanned image to link to the project file
                 const sourceImg = next.get(src);
                 if (sourceImg) {
                     next.set(src, { ...sourceImg, projectFilePath: newData.filePath });
                 }
             });
             return next;
          });

          // Refresh file explorer tree without reading file contents
          const projData = await window.electronAPI.refreshProjectTree(projectRootPath);
          setFileSystemTree(projData.tree);

          addToast('Images copied to project', 'success');
          setStatusBarMessage('Images copied successfully.');
      } catch (e) {
          console.error(e);
          addToast('Failed to copy images', 'error');
          setStatusBarMessage('Error copying images.');
      } finally {
          setIsLoading(false);
          setTimeout(() => setStatusBarMessage(''), 3000);
      }
  };

  const handleCopyAudiosToProject = async (sourcePaths: string[]) => {
      if (!projectRootPath || !window.electronAPI) return;
      
      setIsLoading(true);
      setStatusBarMessage('Copying audio to project...');
      try {
          const updates: { src: string, newData: any }[] = [];

          for (const src of sourcePaths) {
              const fileName = src.split(/[/\\]/).pop();
              if (!fileName) continue;
              
              const relativeDest = `game/audio/${fileName}`;
              const destPath = await window.electronAPI.path.join(projectRootPath, 'game', 'audio', fileName);
              
              const aud = audios.get(src);
              if (aud) {
                 await window.electronAPI.copyEntry(aud.filePath, destPath);
                 
                 // Robust URL Construction
                 const normalized = destPath.replace(/\\/g, '/');
                 const urlPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
                 
                 // Split into segments to encode component-wise to handle #, ?, etc.
                 const encodedPath = urlPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
                 const mediaUrl = `media://${encodedPath}`;
                 
                 updates.push({
                     src,
                     newData: {
                         filePath: relativeDest,
                         fileName,
                         isInProject: true,
                         projectFilePath: relativeDest,
                         dataUrl: mediaUrl,
                         size: aud.size,
                         lastModified: Date.now()
                     }
                 });
              }
          }

          setAudios(prev => {
             const next = new Map(prev);
             updates.forEach(({ src, newData }) => {
                 // Add the new project-local audio
                 next.set(newData.filePath, { ...newData, fileHandle: null });

                 // Update the original scanned audio to link to the project file
                 const sourceAud = next.get(src);
                 if (sourceAud) {
                     next.set(src, { ...sourceAud, projectFilePath: newData.filePath });
                 }
             });
             return next;
          });

          // Refresh file explorer tree without reading file contents
          const projData = await window.electronAPI.refreshProjectTree(projectRootPath);
          setFileSystemTree(projData.tree);

          addToast('Audio files copied to project', 'success');
          setStatusBarMessage('Audio files copied successfully.');
      } catch (e) {
          console.error(e);
          addToast('Failed to copy audio files', 'error');
          setStatusBarMessage('Error copying audio files.');
      } finally {
          setIsLoading(false);
          setTimeout(() => setStatusBarMessage(''), 3000);
      }
  };
  
    // --- File System Operations ---
    const handleCreateNode = useCallback(async (parentPath: string, name: string, type: 'file' | 'folder') => {
        if (!projectRootPath || !window.electronAPI?.path) return;
        const newPath = await window.electronAPI.path.join(parentPath, name);
        const fullPath = await window.electronAPI.path.join(projectRootPath, newPath);
        
        try {
            if (type === 'folder') {
                await window.electronAPI.createDirectory(fullPath);
            } else {
                const content = name.endsWith('.rpy') ? `# New file: ${name}\n\nlabel ${name.replace('.rpy', '')}_start:\n    return\n` : '';
                await window.electronAPI.writeFile(fullPath, content);
                if (name.endsWith('.rpy')) {
                    addBlock(newPath, content);
                }
            }
            await loadProject(projectRootPath);
            addToast(`${type === 'file' ? 'File' : 'Folder'} created: ${name}`, 'success');
        } catch(e) {
            addToast(`Failed to create ${type}`, 'error');
            console.error(e);
        }
    }, [projectRootPath, addToast, addBlock, loadProject]);

    const handleDeleteNode = useCallback((paths: string[]) => {
        if (!projectRootPath || !window.electronAPI?.removeEntry) return;

        setDeleteConfirmInfo({
            paths,
            onConfirm: async () => {
                try {
                    for (const path of paths) {
                        const fullPath = await window.electronAPI!.path.join(projectRootPath, path);
                        const res = await window.electronAPI!.removeEntry!(fullPath);
                        if (!res.success) throw new Error(res.error);
                    }
                    await loadProject(projectRootPath);
                    addToast(`${paths.length} item(s) deleted`, 'success');
                } catch(e) {
                    addToast(`Failed to delete items`, 'error');
                }
                setDeleteConfirmInfo(null);
            }
        });
    }, [projectRootPath, loadProject, addToast]);

    const handleRenameNode = useCallback(async (oldPath: string, newName: string) => {
        if (!projectRootPath || !window.electronAPI?.moveFile) return;
        const oldName = oldPath.split('/').pop();
        if(newName === oldName) return;

        const newPath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1) + newName;
        const fullOldPath = await window.electronAPI.path.join(projectRootPath, oldPath);
        const fullNewPath = await window.electronAPI.path.join(projectRootPath, newPath);

        try {
            await window.electronAPI.moveFile(fullOldPath, fullNewPath);
            await loadProject(projectRootPath);
            addToast(`Renamed to ${newName}`, 'success');
        } catch (e) {
            addToast('Rename failed', 'error');
        }
    }, [projectRootPath, loadProject, addToast]);

    const handleMoveNode = useCallback(async (sourcePaths: string[], targetFolderPath: string) => {
        if (!projectRootPath || !window.electronAPI?.moveFile) return;
        try {
            for(const sourcePath of sourcePaths) {
                const sourceName = sourcePath.split('/').pop();
                if(!sourceName) continue;
                
                const newPath = await window.electronAPI.path.join(targetFolderPath, sourceName);
                if(newPath === sourcePath) continue;

                const fullOldPath = await window.electronAPI.path.join(projectRootPath, sourcePath);
                const fullNewPath = await window.electronAPI.path.join(projectRootPath, newPath);
                await window.electronAPI.moveFile(fullOldPath, fullNewPath);
            }
            await loadProject(projectRootPath);
            addToast(`${sourcePaths.length} item(s) moved`, 'success');
        } catch (e) {
            addToast('Move failed', 'error');
        }
    }, [projectRootPath, loadProject, addToast]);

    const handleCut = useCallback((paths: string[]) => {
        setClipboard({ type: 'cut', paths: new Set(paths) });
        addToast(`${paths.length} item(s) cut to clipboard`, 'info');
    }, []);

    const handleCopy = useCallback((paths: string[]) => {
        setClipboard({ type: 'copy', paths: new Set(paths) });
        addToast(`${paths.length} item(s) copied to clipboard`, 'info');
    }, []);

    const handlePaste = useCallback(async (targetFolderPath: string) => {
        if (!clipboard || !projectRootPath || !window.electronAPI) return;
        
        try {
            for(const sourcePath of clipboard.paths) {
                const sourceName = sourcePath.split('/').pop();
                if(!sourceName) continue;
                
                const destPath = await window.electronAPI.path.join(targetFolderPath, sourceName);
                const fullSourcePath = await window.electronAPI.path.join(projectRootPath, sourcePath);
                const fullDestPath = await window.electronAPI.path.join(projectRootPath, destPath);

                if (clipboard.type === 'copy') {
                    await window.electronAPI.copyEntry!(fullSourcePath, fullDestPath);
                } else {
                    await window.electronAPI.moveFile!(fullSourcePath, fullDestPath);
                }
            }

            if(clipboard.type === 'cut') {
                setClipboard(null);
            }
            
            await loadProject(projectRootPath);
            addToast('Paste successful', 'success');

        } catch (e) {
             addToast('Paste failed', 'error');
        }
    }, [clipboard, projectRootPath, loadProject, addToast]);


    // --- Game Execution ---
    const handleRunGame = useCallback(async () => {
        if (!window.electronAPI || !projectRootPath) return;

        if (!appSettings.renpyPath) {
            setShowConfigureRenpyModal(true);
            return;
        }

        await handleSaveAll();
        setStatusBarMessage('Launching game...');
        window.electronAPI!.runGame(appSettings.renpyPath, projectRootPath!);

    }, [appSettings.renpyPath, projectRootPath, handleSaveAll]);

    const handleStopGame = useCallback(() => {
        if (window.electronAPI) {
            window.electronAPI.stopGame();
        }
    }, []);

    const handleDeleteSelected = useCallback(() => {
        if (activeTabId !== 'canvas') return;
        
        let deletedCount = 0;

        if (selectedBlockIds.length > 0) {
            setGroups(draft => {
                draft.forEach(g => {
                    g.blockIds = g.blockIds.filter(bid => !selectedBlockIds.includes(bid));
                });
            });
            setBlocks(prev => prev.filter(b => !selectedBlockIds.includes(b.id)));
            // Close tabs for deleted blocks
            setOpenTabs(prev => prev.filter(t => !t.blockId || !selectedBlockIds.includes(t.blockId)));
            deletedCount += selectedBlockIds.length;
            setSelectedBlockIds([]);
        }

        if (selectedGroupIds.length > 0) {
             setGroups(draft => {
                 return draft.filter(g => !selectedGroupIds.includes(g.id));
             });
             deletedCount += selectedGroupIds.length;
             setSelectedGroupIds([]);
        }
        
        if (deletedCount > 0) {
            addToast(`Deleted ${deletedCount} items`, 'info');
        }
    }, [activeTabId, selectedBlockIds, selectedGroupIds, setBlocks, setGroups, setOpenTabs, addToast]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input/textarea is focused
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

            // Shortcuts
            
            // F5: Run Game
            if (e.key === 'F5') {
                e.preventDefault();
                handleRunGame();
            }
            
            // Ctrl+Shift+F: Search
            if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                handleToggleSearch();
            }

            // Ctrl+S: Save All (if not editor handling it)
            if (cmdOrCtrl && e.key.toLowerCase() === 's') {
                e.preventDefault();
                handleSaveAll();
            }

            // Undo/Redo (Custom implementation for app-wide history)
            if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    if (canRedo) redo();
                } else {
                    if (canUndo) undo();
                }
            }
            if (cmdOrCtrl && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                if (canRedo) redo();
            }

            // N: New Block (Context aware, mostly Canvas)
            if (e.key.toLowerCase() === 'n' && activeTabId === 'canvas') {
                e.preventDefault();
                setCreateBlockModalOpen(true);
            }

            // Delete / Backspace
            if ((e.key === 'Delete' || e.key === 'Backspace') && activeTabId === 'canvas') {
                if (selectedBlockIds.length > 0 || selectedGroupIds.length > 0) {
                    e.preventDefault();
                    handleDeleteSelected();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleRunGame, handleToggleSearch, handleSaveAll, canUndo, canRedo, undo, redo, activeTabId, handleDeleteSelected, selectedBlockIds, selectedGroupIds]);

    useEffect(() => {
        if (window.electronAPI) {
            const removeStarted = window.electronAPI.onGameStarted(() => {
                setIsGameRunning(true);
                setStatusBarMessage('Game running.');
            });
            const removeStopped = window.electronAPI.onGameStopped(() => {
                setIsGameRunning(false);
                setStatusBarMessage('Game stopped.');
                setTimeout(() => setStatusBarMessage(''), 3000);
            });
            const removeError = window.electronAPI.onGameError((error) => {
                addToast(`Failed to launch game: ${error}`, 'error');
                setStatusBarMessage('Error launching game.');
                setIsGameRunning(false);
            });
            return () => {
                removeStarted();
                removeStopped();
                removeError();
            };
        }
    }, [addToast]);
    

  // --- Menu Command Listener ---
  useEffect(() => {
      if (window.electronAPI?.onMenuCommand) {
          const removeListener = window.electronAPI.onMenuCommand((data: any) => {
              switch (data.command) {
                  case 'new-project':
                      handleNewProjectRequest();
                      break;
                  case 'open-project':
                      handleOpenProjectFolder();
                      break;
                  case 'run-project':
                      handleRunGame();
                      break;
                  case 'open-static-tab':
                      if (data.type === 'canvas' || data.type === 'route-canvas') {
                          handleOpenStaticTab(data.type);
                      }
                      break;
                  case 'open-recent':
                      if (data.path && typeof data.path === 'string') {
                          loadProject(String(data.path));
                      }
                      break;
                  case 'open-about':
                      setAboutModalOpen(true);
                      break;
              }
          });
          return () => removeListener();
      }
  }, [handleNewProjectRequest, handleOpenProjectFolder, handleOpenStaticTab, handleRunGame, loadProject]);
  
  // --- Exit confirmation flow ---
  useEffect(() => {
    if (window.electronAPI) {
      const removeCheckListener = window.electronAPI.onCheckUnsavedChangesBeforeExit(() => {
        const hasUnsaved = dirtyBlockIds.size > 0 || dirtyEditors.size > 0 || hasUnsavedSettings;
        window.electronAPI!.replyUnsavedChangesBeforeExit(hasUnsaved);
      });

      const removeShowModalListener = window.electronAPI.onShowExitModal(() => {
        setUnsavedChangesModalInfo({
          title: 'Quit Application',
          message: 'You have unsaved changes. Do you want to save them before quitting?',
          confirmText: 'Save & Quit',
          dontSaveText: "Don't Save & Quit",
          onConfirm: async () => {
            await handleSaveAll();
            window.electronAPI!.forceQuit();
          },
          onDontSave: () => {
            window.electronAPI!.forceQuit();
          },
          onCancel: () => {
            setUnsavedChangesModalInfo(null);
          },
        });
      });
      
      const removeSaveStateListener = window.electronAPI.onSaveIdeStateBeforeQuit(async () => {
        if (projectRootPath) {
          await handleSaveProjectSettings();
        }
        window.electronAPI!.ideStateSavedForQuit();
      });

      return () => {
        removeCheckListener();
        removeShowModalListener();
        removeSaveStateListener();
      };
    }
  }, [dirtyBlockIds, dirtyEditors, hasUnsavedSettings, handleSaveAll, handleSaveProjectSettings, projectRootPath]);

  const handleEditorMount = useCallback((id: string, editor: monaco.editor.IStandaloneCodeEditor) => {
      editorInstances.current.set(id, editor);
  }, []);

  const handleEditorUnmount = useCallback((id: string) => {
      editorInstances.current.delete(id);
  }, []);

  // --- Sash/Resizing Handlers ---
  const handleLeftSashDrag = useCallback((delta: number) => {
    updateAppSettings(draft => {
        const newWidth = draft.leftSidebarWidth + delta;
        draft.leftSidebarWidth = Math.max(200, Math.min(newWidth, 600));
    });
  }, [updateAppSettings]);

  const handleRightSashDrag = useCallback((delta: number) => {
    updateAppSettings(draft => {
        const newWidth = draft.rightSidebarWidth - delta;
        draft.rightSidebarWidth = Math.max(240, Math.min(newWidth, 600));
    });
  }, [updateAppSettings]);


  // --- Render Helpers ---
  const activeBlock = useMemo(() => blocks.find(b => b.id === activeTabId), [blocks, activeTabId]);
  const activeTab = useMemo(() => openTabs.find(t => t.id === activeTabId), [openTabs, activeTabId]);

  const settingsForModal: IdeSettings = useMemo(() => ({
      ...(appSettings as any),
      ...(projectSettings as any),
  } as IdeSettings), [appSettings, projectSettings]);

  const handleSettingsChange = useCallback((key: keyof IdeSettings, value: any) => {
      updateAppSettings(draft => {
          if (key in draft) {
            (draft as any)[key] = value;
          }
      });
      updateProjectSettings(draft => {
          if (key in draft) {
            (draft as any)[key] = value;
          }
      });
  }, [updateAppSettings, updateProjectSettings]);

  const projectWordStats = useMemo(() => {
    if (!projectRootPath) {
        return { totalWords: 0, currentFileWords: null, readingTime: '≈ 0 min read' };
    }
    const totalWords = blocks.reduce((sum, block) => sum + countWordsInRenpyScript(block.content), 0);
    
    const activeEditorTab = openTabs.find(t => t.id === activeTabId && t.type === 'editor');
    const activeBlockForCount = activeEditorTab ? blocks.find(b => b.id === activeEditorTab.blockId) : null;
    const currentFileWords = activeBlockForCount ? countWordsInRenpyScript(activeBlockForCount.content) : null;
    
    const readingTimeMinutes = Math.round(totalWords / 200); // 200 wpm
    
    let readingTime = '';
    if (readingTimeMinutes < 1) {
        readingTime = '< 1 min read';
    } else if (readingTimeMinutes < 60) {
        readingTime = `≈ ${readingTimeMinutes} min read`;
    } else {
        const hours = Math.floor(readingTimeMinutes / 60);
        const minutes = readingTimeMinutes % 60;
        readingTime = `≈ ${hours}h ${minutes}m read`;
    }

    return { totalWords, currentFileWords, readingTime };
  }, [blocks, activeTabId, openTabs, projectRootPath]);


  return (
    <div className="fixed inset-0 flex flex-col bg-primary text-primary overflow-hidden">
      {showWelcome && (
        <WelcomeScreen 
            onOpenProject={handleOpenProjectFolder}
            onCreateProject={handleNewProjectRequest}
            isElectron={!!window.electronAPI}
            recentProjects={appSettings.recentProjects}
            onOpenRecent={loadProject}
        />
      )}
      <div className="flex-none z-40">
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
            addBlock={() => setCreateBlockModalOpen(true)}
            handleTidyUp={handleTidyUp}
            onAnalyzeRoutes={handleAnalyzeRoutes}
            onRequestNewProject={handleNewProjectRequest}
            requestOpenFolder={handleOpenProjectFolder}
            handleSave={handleSaveAll}
            onOpenSettings={() => setSettingsModalOpen(true)}
            isLeftSidebarOpen={appSettings.isLeftSidebarOpen}
            setIsLeftSidebarOpen={(open) => updateAppSettings(draft => { draft.isLeftSidebarOpen = open; })}
            isRightSidebarOpen={appSettings.isRightSidebarOpen}
            setIsRightSidebarOpen={(open) => updateAppSettings(draft => { draft.isRightSidebarOpen = open; })}
            onOpenStaticTab={handleOpenStaticTab}
            onAddStickyNote={() => addStickyNote()}
            isGameRunning={isGameRunning}
            onRunGame={handleRunGame}
            onStopGame={handleStopGame}
            onToggleSearch={handleToggleSearch}
            onOpenShortcuts={() => setShortcutsModalOpen(true)}
        />
      </div>
      
      <div className="flex-1 flex overflow-hidden min-h-0">
        {appSettings.isLeftSidebarOpen && (
            <>
                <div 
                    className="flex-none border-r border-primary bg-secondary flex flex-col overflow-hidden h-full"
                    style={{ width: appSettings.leftSidebarWidth }}
                >
                    <div className="flex-none flex border-b border-primary">
                        <button
                        onClick={() => setActiveLeftPanel('explorer')}
                        className={`flex-1 px-4 py-2 text-sm font-semibold text-center transition-colors ${activeLeftPanel === 'explorer' ? 'bg-secondary text-accent' : 'bg-primary text-secondary hover:bg-tertiary-hover'}`}
                        >
                        Explorer
                        </button>
                        <button
                        onClick={() => setActiveLeftPanel('search')}
                        className={`flex-1 px-4 py-2 text-sm font-semibold text-center transition-colors ${activeLeftPanel === 'search' ? 'bg-secondary text-accent' : 'bg-primary text-secondary hover:bg-tertiary-hover'}`}
                        >
                        Search
                        </button>
                    </div>
                    
                    <div className="flex-1 min-h-0 relative">
                        <div className={`w-full h-full absolute top-0 left-0 transition-opacity ${activeLeftPanel === 'explorer' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                        {activeLeftPanel === 'explorer' && (
                            <FileExplorerPanel 
                                tree={fileSystemTree}
                                onFileOpen={handlePathDoubleClick}
                                onCreateNode={handleCreateNode}
                                onRenameNode={handleRenameNode}
                                onDeleteNode={handleDeleteNode}
                                onMoveNode={handleMoveNode}
                                clipboard={clipboard}
                                onCut={handleCut}
                                onCopy={handleCopy}
                                onPaste={handlePaste}
                                onCenterOnBlock={(filePath) => {
                                    const block = blocks.find(b => b.filePath === filePath);
                                    if (block) handleCenterOnBlock(block.id);
                                }}
                                selectedPaths={explorerSelectedPaths}
                                setSelectedPaths={setExplorerSelectedPaths}
                                lastClickedPath={explorerLastClickedPath}
                                setLastClickedPath={setExplorerLastClickedPath}
                                expandedPaths={explorerExpandedPaths}
                                onToggleExpand={handleToggleExpandExplorer}
                            />
                        )}
                        </div>
                        <div className={`w-full h-full absolute top-0 left-0 transition-opacity ${activeLeftPanel === 'search' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                        {activeLeftPanel === 'search' && (
                            <SearchPanel
                            query={searchQuery}
                            setQuery={setSearchQuery}
                            replace={replaceQuery}
                            setReplace={setReplaceQuery}
                            options={searchOptions}
                            setOptions={setSearchOptions}
                            results={searchResults}
                            onSearch={handleSearch}
                            onReplaceAll={handleReplaceAll}
                            onResultClick={handleSearchResultClick}
                            isSearching={isSearching}
                            />
                        )}
                        </div>
                    </div>
                </div>
                <Sash onDrag={handleLeftSashDrag} />
            </>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-primary relative">
            <div className="flex-none flex flex-wrap items-center bg-tertiary border-b border-primary">
                {openTabs.map(tab => {
                    const block = blocks.find(b => b.id === tab.blockId);
                    let title = 'Unknown';
                    if (tab.type === 'canvas') title = 'Story Canvas';
                    else if (tab.type === 'route-canvas') title = 'Route Canvas';
                    else if (tab.type === 'scene-composer') {
                        const name = tab.sceneId ? sceneNames[tab.sceneId] : 'New Scene';
                        title = `Scene: ${name}`;
                    }
                    else if (tab.type === 'editor' && block) title = block.title || block.filePath || 'Untitled';
                    else if (tab.type === 'image' && tab.filePath) title = tab.filePath.split(/[/\\]/).pop() || 'Image';
                    else if (tab.type === 'audio' && tab.filePath) title = tab.filePath.split(/[/\\]/).pop() || 'Audio';
                    else if (tab.type === 'character' && tab.characterTag) {
                        const char = analysisResultWithProfiles.characters.get(tab.characterTag);
                        title = char ? `Char: ${char.name}` : (tab.characterTag === 'new_character' ? 'New Character' : 'Unknown Character');
                    }
                    
                    const isDirty = (tab.blockId && (dirtyBlockIds.has(tab.blockId) || dirtyEditors.has(tab.blockId))) || false;

                    const isActive = activeTabId === tab.id;
                    return (
                        <div 
                            key={tab.id}
                            onClick={() => handleSwitchTab(tab.id)}
                            onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                            className={`group flex items-center px-4 py-2 text-sm cursor-pointer border-r border-primary min-w-[120px] max-w-[200px] flex-shrink-0 ${isActive ? 'bg-secondary font-medium text-accent border-t-2 border-t-accent' : 'bg-tertiary hover:bg-tertiary-hover text-secondary'}`}
                        >
                            <span className="truncate flex-grow flex items-center">
                                {title}
                                {isDirty && <span className="text-accent ml-1.5">•</span>}
                            </span>
                            {tab.id !== 'canvas' && (
                                <button 
                                    onClick={(e) => handleCloseTab(tab.id, e)}
                                    className="ml-2 text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="flex-1 relative overflow-hidden">
                {activeTabId === 'canvas' && (
                    <StoryCanvas 
                        blocks={blocks}
                        groups={groups}
                        stickyNotes={stickyNotes}
                        analysisResult={analysisResult}
                        updateBlock={updateBlock}
                        updateGroup={updateGroup}
                        updateBlockPositions={updateBlockPositions}
                        updateGroupPositions={updateGroupPositions}
                        updateStickyNote={updateStickyNote}
                        deleteStickyNote={deleteStickyNote}
                        onInteractionEnd={() => {}}
                        deleteBlock={deleteBlock}
                        onOpenEditor={handleOpenEditor}
                        selectedBlockIds={selectedBlockIds}
                        setSelectedBlockIds={setSelectedBlockIds}
                        selectedGroupIds={selectedGroupIds}
                        setSelectedGroupIds={setSelectedGroupIds}
                        findUsagesHighlightIds={findUsagesHighlightIds}
                        clearFindUsages={clearHighlights}
                        dirtyBlockIds={dirtyBlockIds}
                        canvasFilters={canvasFilters}
                        setCanvasFilters={setCanvasFilters}
                        centerOnBlockRequest={centerOnBlockRequest}
                        flashBlockRequest={flashBlockRequest}
                        hoverHighlightIds={hoverHighlightIds}
                        transform={storyCanvasTransform}
                        onTransformChange={setStoryCanvasTransform}
                        onCreateBlock={handleCreateBlockFromCanvas}
                        onAddStickyNote={addStickyNote}
                    />
                )}
                
                {activeTabId === 'route-canvas' && (
                    <RouteCanvas 
                        labelNodes={routeCanvasData.labelNodes}
                        routeLinks={routeCanvasData.routeLinks}
                        identifiedRoutes={routeCanvasData.identifiedRoutes}
                        updateLabelNodePositions={(updates) => {
                             setRouteCanvasData(prev => {
                                 const nextNodes = prev.labelNodes.map(n => {
                                     const up = updates.find(u => u.id === n.id);
                                     return up ? { ...n, position: up.position } : n;
                                 });
                                 return { ...prev, labelNodes: nextNodes };
                             });
                        }}
                        onOpenEditor={handleOpenEditor}
                        transform={routeCanvasTransform}
                        onTransformChange={setRouteCanvasTransform}
                    />
                )}

                {activeTab?.type === 'scene-composer' && activeTab.sceneId && (
                    <SceneComposer 
                        images={Array.from(images.values())}
                        metadata={imageMetadata}
                        scene={sceneCompositions[activeTab.sceneId] || { background: null, sprites: [] }}
                        onSceneChange={(val) => handleSceneUpdate(activeTab.sceneId!, val)}
                        sceneName={sceneNames[activeTab.sceneId] || 'Unnamed Scene'}
                        onRenameScene={(name) => handleRenameScene(activeTab.sceneId!, name)}
                    />
                )}

                {activeBlock && activeTab?.type === 'editor' && (
                    <EditorView 
                        key={activeBlock.id}
                        block={activeBlock}
                        blocks={blocks}
                        analysisResult={analysisResultWithProfiles}
                        initialScrollRequest={activeTab.scrollRequest}
                        onSwitchFocusBlock={(blockId, line) => {
                            handleOpenEditor(blockId, line);
                        }}
                        onSave={(id, content) => updateBlock(id, { content })}
                        onTriggerSave={handleSaveBlock}
                        onDirtyChange={(id, isDirty) => {
                            if (isDirty) setDirtyEditors(prev => new Set(prev).add(id));
                            else setDirtyEditors(prev => { const s = new Set(prev); s.delete(id); return s; });
                        }}
                        editorTheme={appSettings.theme.includes('dark') || appSettings.theme === 'colorful' ? 'dark' : 'light'}
                        editorFontFamily={appSettings.editorFontFamily}
                        editorFontSize={appSettings.editorFontSize}
                        enableAiFeatures={projectSettings.enableAiFeatures}
                        availableModels={['gemini-2.5-flash', 'gemini-3-pro-preview']}
                        selectedModel={projectSettings.selectedModel}
                        addToast={addToast}
                        onEditorMount={handleEditorMount}
                        onEditorUnmount={handleEditorUnmount}
                    />
                )}

                {activeTab?.type === 'image' && activeTab.filePath && (
                    <ImageEditorView 
                        image={images.get(activeTab.filePath) || { filePath: activeTab.filePath, fileName: 'Unknown', isInProject: false, fileHandle: null, dataUrl: '' }}
                        allImages={Array.from(images.values())}
                        metadata={imageMetadata.get(activeTab.filePath) || (images.get(activeTab.filePath)?.projectFilePath ? imageMetadata.get(images.get(activeTab.filePath)!.projectFilePath!) : undefined)}
                        onUpdateMetadata={(path, meta) => {
                             setImageMetadata(prev => {
                                const next = new Map(prev);
                                next.set(path, meta);
                                return next;
                             });
                             addToast('Image metadata saved', 'success');
                        }}
                        onCopyToProject={(src, meta) => {
                            handleCopyImagesToProject([src]);
                            const fileName = src.split(/[/\\]/).pop() || '';
                            const projectPath = `game/images/${fileName}`;
                            setImageMetadata(prev => {
                                const next = new Map(prev);
                                next.set(projectPath, meta);
                                return next;
                             });
                        }}
                    />
                )}

                {activeTab?.type === 'audio' && activeTab.filePath && (
                    <AudioEditorView 
                        key={activeTab.filePath} // Force re-render on file switch
                        audio={audios.get(activeTab.filePath) || { filePath: activeTab.filePath, fileName: 'Unknown', dataUrl: '', fileHandle: null, isInProject: false }}
                        metadata={audioMetadata.get(activeTab.filePath) || (audios.get(activeTab.filePath)?.projectFilePath ? audioMetadata.get(audios.get(activeTab.filePath)!.projectFilePath!) : undefined)}
                        onUpdateMetadata={(path, meta) => {
                             setAudioMetadata(prev => {
                                const next = new Map(prev);
                                next.set(path, meta);
                                return next;
                             });
                             addToast('Audio metadata saved', 'success');
                        }}
                        onCopyToProject={(src, meta) => {
                             handleCopyAudiosToProject([src]);
                        }}
                    />
                )}

                {activeTab?.type === 'character' && activeTab.characterTag && (
                    <CharacterEditorView 
                        character={analysisResultWithProfiles.characters.get(activeTab.characterTag)}
                        onSave={handleUpdateCharacter}
                        existingTags={Array.from(analysisResultWithProfiles.characters.keys())}
                        projectImages={Array.from(images.values())}
                        imageMetadata={imageMetadata}
                    />
                )}
            </div>
        </div>

        {appSettings.isRightSidebarOpen && (
            <>
                <Sash onDrag={handleRightSashDrag} />
                <div 
                    className="flex-none border-l border-primary bg-secondary flex flex-col overflow-hidden h-full"
                    style={{ width: appSettings.rightSidebarWidth }}
                >
                    <StoryElementsPanel 
                        analysisResult={analysisResultWithProfiles}
                        onOpenCharacterEditor={handleOpenCharacterEditor}
                        onFindCharacterUsages={(tag) => handleFindUsages(tag, 'character')}
                        onAddVariable={() => {}}
                        onFindVariableUsages={(name) => handleFindUsages(name, 'variable')}
                        onAddScreen={() => {}}
                        onFindScreenDefinition={() => {}}
                        projectImages={images}
                        imageMetadata={imageMetadata}
                        imageScanDirectories={imageScanDirectories}
                        onAddImageScanDirectory={handleAddImageScanDirectory}
                        onRemoveImageScanDirectory={handleRemoveImageScanDirectory}
                        onCopyImagesToProject={handleCopyImagesToProject}
                        onUpdateImageMetadata={(path, meta) => {
                             setImageMetadata(prev => {
                                const next = new Map(prev);
                                next.set(path, meta);
                                return next;
                             });
                        }}
                        onOpenImageEditor={handleOpenImageEditorTab}
                        imagesLastScanned={imagesLastScanned}
                        isRefreshingImages={isRefreshingImages}
                        onRefreshImages={handleRefreshImages}
                        
                        projectAudios={audios}
                        audioMetadata={audioMetadata}
                        audioScanDirectories={audioScanDirectories}
                        onAddAudioScanDirectory={handleAddAudioScanDirectory}
                        onRemoveAudioScanDirectory={handleRemoveAudioScanDirectory}
                        onCopyAudiosToProject={handleCopyAudiosToProject}
                        onUpdateAudioMetadata={(path, meta) => {
                             setAudioMetadata(prev => {
                                const next = new Map(prev);
                                next.set(path, meta);
                                return next;
                             });
                        }}
                        onOpenAudioEditor={(path) => {
                            const tabId = `aud-${path}`;
                            setOpenTabs(prev => {
                                if(!prev.find(t => t.id === tabId)) {
                                    return [...prev, { id: tabId, type: 'audio', filePath: path }];
                                }
                                return prev;
                            });
                            setActiveTabId(tabId);
                        }}
                        audiosLastScanned={audiosLastScanned}
                        isRefreshingAudios={isRefreshingAudios}
                        onRefreshAudios={handleRefreshAudios}
                        isFileSystemApiSupported={!!window.electronAPI}
                        onHoverHighlightStart={(id) => {
                            const defBlock = analysisResult.variables.get(id)?.definedInBlockId;
                            if(defBlock) setHoverHighlightIds(new Set([defBlock]));
                        }}
                        onHoverHighlightEnd={() => setHoverHighlightIds(null)}
                        
                        scenes={Object.entries(sceneNames).map(([id, name]) => ({ id, name }))}
                        onOpenScene={handleOpenScene}
                        onCreateScene={handleCreateScene}
                        onDeleteScene={handleDeleteScene}

                        snippetCategoriesState={appSettings.snippetCategoriesState || {}}
                        onToggleSnippetCategory={(name, isOpen) => {
                            updateAppSettings(draft => {
                                if (!draft.snippetCategoriesState) draft.snippetCategoriesState = {};
                                draft.snippetCategoriesState[name] = isOpen;
                            });
                        }}
                    />
                </div>
            </>
        )}
      </div>

      {!showWelcome && (
        <StatusBar
          totalWords={projectWordStats.totalWords}
          currentFileWords={projectWordStats.currentFileWords}
          readingTime={projectWordStats.readingTime}
          statusMessage={statusBarMessage}
        />
      )}

      {settingsModalOpen && (
        <SettingsModal 
            isOpen={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            settings={settingsForModal}
            onSettingsChange={handleSettingsChange}
            availableModels={['gemini-2.5-flash', 'gemini-3-pro-preview']}
        />
      )}
      
      {shortcutsModalOpen && (
        <KeyboardShortcutsModal 
            isOpen={shortcutsModalOpen}
            onClose={() => setShortcutsModalOpen(false)}
        />
      )}

      {aboutModalOpen && (
        <AboutModal 
            isOpen={aboutModalOpen}
            onClose={() => setAboutModalOpen(false)}
        />
      )}
      
      {showConfigureRenpyModal && (
        <ConfigureRenpyModal
          isOpen={showConfigureRenpyModal}
          onClose={() => setShowConfigureRenpyModal(false)}
          onSave={(path) => {
            updateAppSettings(draft => { draft.renpyPath = path; });
            setShowConfigureRenpyModal(false);
            if (projectRootPath) {
                setTimeout(() => {
                    if (window.electronAPI) {
                        handleSaveAll().then(() => {
                            window.electronAPI!.runGame(path, projectRootPath!);
                        });
                    }
                }, 100);
            }
          }}
        />
      )}

      {createBlockModalOpen && (
          <CreateBlockModal 
            isOpen={createBlockModalOpen}
            onClose={() => setCreateBlockModalOpen(false)}
            onConfirm={(name, type) => handleCreateBlockConfirm(name, type, getSelectedFolderForNewBlock())}
            defaultPath={getSelectedFolderForNewBlock()}
          />
      )}

      {deleteConfirmInfo && (
        <ConfirmModal 
            title={`Delete ${deleteConfirmInfo.paths.length} item(s)?`}
            onConfirm={deleteConfirmInfo.onConfirm}
            onClose={() => setDeleteConfirmInfo(null)}
        >
            Are you sure you want to permanently delete these items? This action cannot be undone.
            <ul className="text-xs list-disc list-inside mt-2 max-h-24 overflow-y-auto bg-tertiary rounded p-2 text-secondary">
                {deleteConfirmInfo.paths.map(p => <li key={p} className="truncate">{p.split('/').pop()}</li>)}
            </ul>
        </ConfirmModal>
      )}

      {replaceAllConfirmInfo && (
        <ConfirmModal
          title="Confirm Global Replace"
          confirmText="Replace All"
          confirmClassName="bg-accent hover:bg-accent-hover"
          onConfirm={() => {
            replaceAllConfirmInfo.onConfirm();
            setReplaceAllConfirmInfo(null);
          }}
          onClose={() => setReplaceAllConfirmInfo(null)}
        >
          {`Are you sure you want to replace ${replaceAllConfirmInfo.totalMatches} occurrence(s) across ${replaceAllConfirmInfo.totalFiles} file(s)? This action will modify your open files but will NOT save them automatically.`}
        </ConfirmModal>
      )}
      
      {unsavedChangesModalInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-secondary rounded-lg shadow-2xl w-full max-w-md m-4 flex flex-col p-6 border border-primary">
            <h2 className="text-xl font-bold mb-4 text-primary">{unsavedChangesModalInfo.title}</h2>
            <p className="text-secondary mb-6">
              {unsavedChangesModalInfo.message}
            </p>
            <div className="flex justify-end space-x-3">
               <button
                onClick={unsavedChangesModalInfo.onCancel}
                className="px-4 py-2 rounded text-secondary hover:bg-tertiary font-medium"
              >
                Cancel
              </button>
              <button
                onClick={unsavedChangesModalInfo.onDontSave}
                className="px-4 py-2 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium"
              >
                {unsavedChangesModalInfo.dontSaveText}
              </button>
              <button
                onClick={unsavedChangesModalInfo.onConfirm}
                className="px-4 py-2 rounded bg-accent hover:bg-accent-hover text-white font-bold"
              >
                {unsavedChangesModalInfo.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <LoadingOverlay progress={loadingProgress} message={loadingMessage} />}

      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
             <div key={t.id} className="pointer-events-auto">
                <Toast toast={t} onDismiss={removeToast} />
             </div>
        ))}
      </div>

      {contextMenuInfo && createPortal(
        <TabContextMenu
            x={contextMenuInfo.x}
            y={contextMenuInfo.y}
            tabId={contextMenuInfo.tabId}
            onClose={() => setContextMenuInfo(null)}
            onCloseTab={(tabId) => handleCloseTab(tabId)}
            onCloseOthers={handleCloseOthersRequest}
            onCloseAll={handleCloseAllRequest}
        />,
        document.body
      )}
    </div>
  );
};

export default App;
