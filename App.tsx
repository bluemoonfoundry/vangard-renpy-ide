


import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useImmer } from 'use-immer';
import Toolbar from './components/Toolbar';
import StoryCanvas from './components/StoryCanvas';
import FileExplorerPanel from './components/FileExplorerPanel';
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
import TabContextMenu from './components/TabContextMenu';
import { useRenpyAnalysis, performRouteAnalysis } from './hooks/useRenpyAnalysis';
import { useHistory } from './hooks/useHistory';
import type { 
  Block, BlockGroup, Link, Position, FileSystemTreeNode, EditorTab, 
  ToastMessage, IdeSettings, Theme, ProjectImage, RenpyAudio, 
  ClipboardState, ImageMetadata, AudioMetadata, LabelNode, Character,
  AppSettings, ProjectSettings, StickyNote
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
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [fileSystemTree, setFileSystemTree] = useState<FileSystemTreeNode | null>(null);
  const [images, setImages] = useImmer<Map<string, ProjectImage>>(new Map());
  const [audios, setAudios] = useImmer<Map<string, RenpyAudio>>(new Map());
  const [imageMetadata, setImageMetadata] = useImmer<Map<string, ImageMetadata>>(new Map());
  const [audioMetadata, setAudioMetadata] = useImmer<Map<string, AudioMetadata>>(new Map());
  
  // --- State: File Explorer Selection ---
  const [explorerSelectedPaths, setExplorerSelectedPaths] = useState<Set<string>>(new Set());
  const [explorerLastClickedPath, setExplorerLastClickedPath] = useState<string | null>(null);

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
  
  const [dirtyBlockIds, setDirtyBlockIds] = useState<Set<string>>(new Set());
  const [dirtyEditors, setDirtyEditors] = useState<Set<string>>(new Set()); // Blocks modified in editor but not synced to block state yet
  const [hasUnsavedSettings, setHasUnsavedSettings] = useState(false); // Track project setting changes like sticky notes
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{ paths: string[]; onConfirm: () => void; } | null>(null);
  const [createBlockModalOpen, setCreateBlockModalOpen] = useState(false);
  const [unsavedChangesModalInfo, setUnsavedChangesModalInfo] = useState<UnsavedChangesModalInfo | null>(null);
  const [contextMenuInfo, setContextMenuInfo] = useState<{ x: number; y: number; tabId: string } | null>(null);
  
  // --- State: View Transforms ---
  const [storyCanvasTransform, setStoryCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [routeCanvasTransform, setRouteCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });

  // --- State: Game Execution ---
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [showConfigureRenpyModal, setShowConfigureRenpyModal] = useState(false);

  // --- State: Application and Project Settings ---
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [appSettingsLoaded, setAppSettingsLoaded] = useState(false);
  const [appSettings, updateAppSettings] = useImmer<AppSettings>({
    theme: 'system',
    isLeftSidebarOpen: true,
    leftSidebarWidth: 250,
    isRightSidebarOpen: true,
    rightSidebarWidth: 300,
    renpyPath: '',
  });
  const [projectSettings, updateProjectSettings] = useImmer<Omit<ProjectSettings, 'openTabs' | 'activeTabId' | 'stickyNotes'>>({
    enableAiFeatures: false,
    selectedModel: 'gemini-2.5-flash',
  });

  // --- State: Clipboard & Search ---
  const [clipboard, setClipboard] = useState<ClipboardState>(null);
  const [findUsagesHighlightIds, setFindUsagesHighlightIds] = useState<Set<string> | null>(null);
  const [centerOnBlockRequest, setCenterOnBlockRequest] = useState<{ blockId: string, key: number } | null>(null);
  const [flashBlockRequest, setFlashBlockRequest] = useState<{ blockId: string, key: number } | null>(null);
  const [canvasFilters, setCanvasFilters] = useState({ story: true, screens: true, config: false, notes: true });
  const [hoverHighlightIds, setHoverHighlightIds] = useState<Set<string> | null>(null);

  // --- Analysis ---
  const analysisResult = useRenpyAnalysis(blocks, 0); // 0 is a trigger for force re-analysis if needed
  
  // --- Refs ---
  const editorInstances = useRef<Map<string, monaco.editor.IStandaloneCodeEditor>>(new Map());
  const initialLayoutNeeded = useRef(false);

  // --- Initial Load of App Settings & Theme Management ---
  useEffect(() => {
    // Load app-level settings from Electron main process or fallback to localStorage
    if (window.electronAPI?.getAppSettings) {
      window.electronAPI.getAppSettings().then(savedSettings => {
        if (savedSettings) {
          updateAppSettings(draft => { Object.assign(draft, savedSettings) });
        }
      }).finally(() => {
        setAppSettingsLoaded(true);
      });
    } else { // Browser fallback
      const savedSettings = localStorage.getItem('renpy-ide-app-settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          updateAppSettings(draft => { Object.assign(draft, parsed) });
        } catch (e) { console.error("Failed to load app settings from localStorage", e); }
      }
      setAppSettingsLoaded(true);
    }
  }, [updateAppSettings]);

  useEffect(() => {
    // Prevent saving the initial default state before settings have been loaded
    if (!appSettingsLoaded) {
      return;
    }

    // Save app settings whenever they change
    if (window.electronAPI?.saveAppSettings) {
      window.electronAPI.saveAppSettings(appSettings)
        .then(result => {
            if (!result || !result.success) {
                console.error('Failed to save app settings:', result?.error);
            }
        });
    } else { // Browser fallback
      localStorage.setItem('renpy-ide-app-settings', JSON.stringify(appSettings));
    }
    
    // Apply theme based on settings
    const root = window.document.documentElement;
    const applyTheme = (theme: Theme) => {
      root.classList.remove('dark', 'theme-solarized-light', 'theme-solarized-dark', 'theme-colorful', 'theme-colorful-light');
      if (theme === 'dark') root.classList.add('dark');
      if (theme === 'solarized-light') root.classList.add('theme-solarized-light');
      if (theme === 'solarized-dark') root.classList.add('dark', 'theme-solarized-dark');
      if (theme === 'colorful') root.classList.add('dark', 'theme-colorful');
      if (theme === 'colorful-light') root.classList.add('theme-colorful-light');
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


  const addBlock = useCallback((filePath: string, content: string) => {
    const id = `block-${Date.now()}`;
    const blockWidth = 320;
    const blockHeight = 200;

    const leftOffset = appSettings.isLeftSidebarOpen ? appSettings.leftSidebarWidth : 0;
    const rightOffset = appSettings.isRightSidebarOpen ? appSettings.rightSidebarWidth : 0;
    const topOffset = 64; // h-16 (header)

    const visibleWidth = window.innerWidth - leftOffset - rightOffset;
    const visibleHeight = window.innerHeight - topOffset;

    const screenCenterX = leftOffset + (visibleWidth / 2);
    const screenCenterY = topOffset + (visibleHeight / 2);

    const worldCenterX = (screenCenterX - storyCanvasTransform.x) / storyCanvasTransform.scale;
    const worldCenterY = (screenCenterY - storyCanvasTransform.y) / storyCanvasTransform.scale;

    const position = {
        x: worldCenterX - (blockWidth / 2),
        y: worldCenterY - (blockHeight / 2)
    };

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
                const projData = await window.electronAPI.loadProject(projectRootPath);
                setFileSystemTree(projData.tree);
            } else {
                throw new Error(res.error || 'Unknown error occurred during file creation');
            }
        } catch (e) {
            console.error(e);
            // FIX: The 'e' object in a catch block is of type 'unknown'. We must safely extract a message from it before passing it to functions expecting a string.
            let errorMessage: string;
            if (e instanceof Error) {
              errorMessage = e.message;
            } else {
              errorMessage = String(e);
            }
            addToast(`Failed to create file: ${errorMessage}`, 'error');
        }
    } else {
        addBlock(fileName, content);
        addToast(`Created block ${fileName}`, 'success');
    }
  };

  // --- Sticky Note Management ---
  const addStickyNote = useCallback(() => {
      const id = `note-${Date.now()}`;
      const width = 200;
      const height = 200;

      const leftOffset = appSettings.isLeftSidebarOpen ? appSettings.leftSidebarWidth : 0;
      const rightOffset = appSettings.isRightSidebarOpen ? appSettings.rightSidebarWidth : 0;
      const topOffset = 64; 

      const visibleWidth = window.innerWidth - leftOffset - rightOffset;
      const visibleHeight = window.innerHeight - topOffset;

      const screenCenterX = leftOffset + (visibleWidth / 2);
      const screenCenterY = topOffset + (visibleHeight / 2);

      const worldCenterX = (screenCenterX - storyCanvasTransform.x) / storyCanvasTransform.scale;
      const worldCenterY = (screenCenterY - storyCanvasTransform.y) / storyCanvasTransform.scale;

      const position = {
          x: worldCenterX - (width / 2),
          y: worldCenterY - (height / 2)
      };

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
    try {
        const links = analysisResult.links;
        const newLayout = computeAutoLayout(blocks, links);
        setBlocks(newLayout);
        if (showToast) {
            addToast('Layout organized', 'success');
        }
    } catch (e) {
        console.error("Failed to tidy up layout:", e);
        if (showToast) {
            addToast('Failed to organize layout', 'error');
        }
    }
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
      try {
          const projectData = await window.electronAPI!.loadProject(path);
          
          let loadedBlocks: Block[] = projectData.files.map((f: any, index: number) => ({
              id: `block-${index}-${Date.now()}`,
              content: f.content,
              filePath: f.path,
              position: { x: (index % 5) * 350, y: Math.floor(index / 5) * 250 },
              width: 320,
              height: 200,
              title: f.path.split('/').pop()
          }));

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

          // Load Project Settings
          if (projectData.settings) {
            updateProjectSettings(draft => {
              draft.enableAiFeatures = projectData.settings.enableAiFeatures ?? false;
              draft.selectedModel = projectData.settings.selectedModel ?? 'gemini-2.5-flash';
            });
            setOpenTabs(projectData.settings.openTabs ?? [{ id: 'canvas', type: 'canvas' }]);
            setActiveTabId(projectData.settings.activeTabId ?? 'canvas');
            setStickyNotes(projectData.settings.stickyNotes || []);
          } else {
            // Reset to defaults for a new/unconfigured project
            updateProjectSettings(draft => {
              draft.enableAiFeatures = false;
              draft.selectedModel = 'gemini-2.5-flash';
            });
            setOpenTabs([{ id: 'canvas', type: 'canvas' }]);
            setActiveTabId('canvas');
            setStickyNotes([]);
          }
          
          setHasUnsavedSettings(false);
          setShowWelcome(false);
          addToast('Project loaded successfully', 'success');
      } catch (err) {
          console.error(err);
          addToast('Failed to load project', 'error');
      } finally {
          setIsLoading(false);
      }
  }, [setBlocks, setImages, setAudios, updateProjectSettings, addToast, setFileSystemTree, setStickyNotes]);

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

  const handleSaveAll = useCallback(async () => {
    setSaveStatus('saving');
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
             setTimeout(() => setSaveStatus('saved'), 2000);
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
            
             const settingsToSave: ProjectSettings = {
                ...projectSettings,
                openTabs,
                activeTabId,
                stickyNotes,
             };
             const settingsPath = await window.electronAPI.path.join(projectRootPath!, 'game/project.ide.json');
             await window.electronAPI.writeFile(settingsPath, JSON.stringify(settingsToSave, null, 2));
        } 

        setDirtyBlockIds(new Set());
        setDirtyEditors(new Set());
        setHasUnsavedSettings(false);
        setSaveStatus('saved');
        addToast('All changes saved', 'success');
        setTimeout(() => setSaveStatus('saved'), 2000);
    } catch (err) {
        console.error(err);
        setSaveStatus('error');
        addToast('Failed to save changes', 'error');
    }
  }, [blocks, dirtyEditors, dirtyBlockIds, projectRootPath, directoryHandle, projectSettings, openTabs, activeTabId, stickyNotes, addToast, setBlocks]);
  
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
    const existing = openTabs.find(t => t.id === blockId);
    if (!existing) {
        const block = blocks.find(b => b.id === blockId);
        if (block) {
            setOpenTabs(prev => [...prev, { 
                id: blockId, 
                type: 'editor', 
                blockId, 
                scrollRequest: line ? { line, key: Date.now() } : undefined 
            }]);
        }
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

  const handleUpdateCharacter = (char: Character, oldTag?: string) => {
      addToast(`Saved character ${char.name} (Simulated)`, 'success');
  };

  // --- Search & Highlights ---
  const clearHighlights = () => {
      setFindUsagesHighlightIds(null);
      setHoverHighlightIds(null);
  };

  // --- Route Canvas Support ---
  const [routeCanvasData, setRouteCanvasData] = useState<{
      labelNodes: LabelNode[], routeLinks: any[], identifiedRoutes: any[]
  }>({ labelNodes: [], routeLinks: [], identifiedRoutes: [] });

  const handleAnalyzeRoutes = useCallback(() => {
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
  }, [blocks, analysisResult]);

  // --- Asset Management (Basic Implementation) ---
  const handleCopyImagesToProject = async (sourcePaths: string[]) => {
      if (!projectRootPath || !window.electronAPI) return;
      
      setIsLoading(true);
      try {
          for (const src of sourcePaths) {
              const fileName = src.split(/[/\\]/).pop();
              if (!fileName) continue;
              const destPath = await window.electronAPI.path.join(projectRootPath, 'game', 'images', fileName);
              
              const img = (Array.from(images.values()) as ProjectImage[]).find(i => i.filePath === src);
              if (img && img.dataUrl) {
                 const base64Data = img.dataUrl.split(',')[1];
                 await window.electronAPI.writeFile(destPath, base64Data, 'base64');
                 
                 setImages(draft => {
                     const existing = draft.get(src);
                     if (existing) existing.isInProject = true;
                     const relativePath = `game/images/${fileName}`;
                     draft.set(relativePath, { ...existing!, filePath: relativePath, isInProject: true, projectFilePath: relativePath });
                 });
              }
          }
          addToast('Images copied to project', 'success');
      } catch (e) {
          console.error(e);
          addToast('Failed to copy images', 'error');
      } finally {
          setIsLoading(false);
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
                    await loadProject(projectRootPath); // Reload to reflect changes
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
                } else { // cut
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
        window.electronAPI.runGame(appSettings.renpyPath, projectRootPath);

    }, [appSettings.renpyPath, projectRootPath, handleSaveAll]);

    const handleStopGame = useCallback(() => {
        if (window.electronAPI) {
            window.electronAPI.stopGame();
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F5') {
                e.preventDefault();
                handleRunGame();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleRunGame]);

    useEffect(() => {
        if (window.electronAPI) {
            const removeStarted = window.electronAPI.onGameStarted(() => setIsGameRunning(true));
            const removeStopped = window.electronAPI.onGameStopped(() => setIsGameRunning(false));
            const removeError = window.electronAPI.onGameError((error) => {
                addToast(`Failed to launch game: ${error}`, 'error');
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
          const removeListener = window.electronAPI.onMenuCommand((data) => {
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
              }
          });
          return () => removeListener();
      }
  }, [handleNewProjectRequest, handleOpenProjectFolder, handleOpenStaticTab, handleRunGame]);
  
  // --- Exit Confirmation Handling ---
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

      return () => {
        removeCheckListener();
        removeShowModalListener();
      };
    }
  }, [dirtyBlockIds, dirtyEditors, hasUnsavedSettings, handleSaveAll]);

  const handleEditorMount = useCallback((id: string, editor: monaco.editor.IStandaloneCodeEditor) => {
      editorInstances.current.set(id, editor);
  }, []);

  const handleEditorUnmount = useCallback((id: string) => {
      editorInstances.current.delete(id);
  }, []);

  // --- Render Helpers ---
  const activeBlock = useMemo(() => blocks.find(b => b.id === activeTabId), [blocks, activeTabId]);
  const activeTab = useMemo(() => openTabs.find(t => t.id === activeTabId), [openTabs, activeTabId]);

  const settingsForModal: IdeSettings = useMemo(() => ({
      ...appSettings,
      ...projectSettings,
  }), [appSettings, projectSettings]);

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


  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {showWelcome && (
        <WelcomeScreen 
            onOpenProject={handleOpenProjectFolder}
            onCreateProject={handleNewProjectRequest}
            isElectron={!!window.electronAPI}
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
            onAddStickyNote={addStickyNote}
            isGameRunning={isGameRunning}
            onRunGame={handleRunGame}
            onStopGame={handleStopGame}
        />
      </div>
      
      <div className="flex-1 flex overflow-hidden min-h-0">
        {appSettings.isLeftSidebarOpen && (
            <div className="w-64 flex-none border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden h-full">
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
                />
            </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-100 dark:bg-gray-900 relative">
            <div className="flex-none flex flex-wrap items-center bg-gray-200 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
                {openTabs.map(tab => {
                    const block = blocks.find(b => b.id === tab.blockId);
                    let title = 'Unknown';
                    if (tab.type === 'canvas') title = 'Story Canvas';
                    else if (tab.type === 'route-canvas') title = 'Route Canvas';
                    else if (tab.type === 'editor' && block) title = block.title || block.filePath || 'Untitled';
                    else if (tab.type === 'image' && tab.filePath) title = tab.filePath.split(/[/\\]/).pop() || 'Image';
                    else if (tab.type === 'audio' && tab.filePath) title = tab.filePath.split(/[/\\]/).pop() || 'Audio';
                    else if (tab.type === 'character' && tab.characterTag) {
                        const char = analysisResult.characters.get(tab.characterTag);
                        title = char ? `Char: ${char.name}` : (tab.characterTag === 'new_character' ? 'New Character' : 'Unknown Character');
                    }
                    
                    const isDirty = (tab.blockId && (dirtyBlockIds.has(tab.blockId) || dirtyEditors.has(tab.blockId))) || false;

                    const isActive = activeTabId === tab.id;
                    return (
                        <div 
                            key={tab.id}
                            onClick={() => handleSwitchTab(tab.id)}
                            onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                            className={`group flex items-center px-4 py-2 text-sm cursor-pointer border-r border-gray-300 dark:border-gray-700 min-w-[120px] max-w-[200px] flex-shrink-0 ${isActive ? 'bg-white dark:bg-gray-900 font-medium text-indigo-600 dark:text-indigo-400 border-t-2 border-t-indigo-500' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                        >
                            <span className="truncate flex-grow flex items-center">
                                {title}
                                {isDirty && <span className="text-indigo-500 ml-1.5">•</span>}
                            </span>
                            {tab.id !== 'canvas' && (
                                <button 
                                    onClick={(e) => handleCloseTab(tab.id, e)}
                                    className="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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

                {activeBlock && activeTab?.type === 'editor' && (
                    <EditorView 
                        key={activeBlock.id}
                        block={activeBlock}
                        blocks={blocks}
                        analysisResult={analysisResult}
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
                        metadata={imageMetadata.get(activeTab.filePath) || (images.get(activeTab.filePath)?.projectFilePath ? imageMetadata.get(images.get(activeTab.filePath)!.projectFilePath!) : undefined)}
                        onUpdateMetadata={(path, meta) => {
                             setImageMetadata(draft => { draft.set(path, meta); });
                             addToast('Image metadata saved', 'success');
                        }}
                        onCopyToProject={(src, meta) => {
                            handleCopyImagesToProject([src]);
                            const fileName = src.split(/[/\\]/).pop() || '';
                            const projectPath = `game/images/${fileName}`;
                            setImageMetadata(draft => { draft.set(projectPath, meta); });
                        }}
                    />
                )}

                {activeTab?.type === 'audio' && activeTab.filePath && (
                    <AudioEditorView 
                        audio={audios.get(activeTab.filePath) || { filePath: activeTab.filePath, fileName: 'Unknown', dataUrl: '', fileHandle: null, isInProject: false }}
                        metadata={audioMetadata.get(activeTab.filePath) || (audios.get(activeTab.filePath)?.projectFilePath ? audioMetadata.get(audios.get(activeTab.filePath)!.projectFilePath!) : undefined)}
                        onUpdateMetadata={(path, meta) => {
                             setAudioMetadata(draft => { draft.set(path, meta); });
                             addToast('Audio metadata saved', 'success');
                        }}
                        onCopyToProject={(src, meta) => {
                             addToast('Copy not implemented fully', 'warning');
                        }}
                    />
                )}

                {activeTab?.type === 'character' && activeTab.characterTag && (
                    <CharacterEditorView 
                        character={analysisResult.characters.get(activeTab.characterTag)}
                        onSave={handleUpdateCharacter}
                        existingTags={Array.from(analysisResult.characters.keys())}
                        projectImages={Array.from(images.values())}
                        imageMetadata={imageMetadata}
                    />
                )}
            </div>
        </div>

        {appSettings.isRightSidebarOpen && (
             <div className="w-80 flex-none border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col overflow-hidden h-full">
                <StoryElementsPanel 
                    analysisResult={analysisResult}
                    onOpenCharacterEditor={handleOpenCharacterEditor}
                    onFindCharacterUsages={(tag) => handleFindUsages(tag, 'character')}
                    onAddVariable={() => {}}
                    onFindVariableUsages={(name) => handleFindUsages(name, 'variable')}
                    onAddScreen={() => {}}
                    onFindScreenDefinition={() => {}}
                    projectImages={images}
                    imageMetadata={imageMetadata}
                    imageScanDirectories={imageScanDirectories}
                    onAddImageScanDirectory={() => {}}
                    onRemoveImageScanDirectory={() => {}}
                    onCopyImagesToProject={handleCopyImagesToProject}
                    onUpdateImageMetadata={() => {}}
                    onOpenImageEditor={handleOpenImageEditorTab}
                    imagesLastScanned={imagesLastScanned}
                    isRefreshingImages={isRefreshingImages}
                    onRefreshImages={() => {}}
                    
                    projectAudios={audios}
                    audioMetadata={audioMetadata}
                    audioScanDirectories={audioScanDirectories}
                    onAddAudioScanDirectory={() => {}}
                    onRemoveAudioScanDirectory={() => {}}
                    onCopyAudiosToProject={() => {}}
                    onUpdateAudioMetadata={() => {}}
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
                    onRefreshAudios={() => {}}
                    isFileSystemApiSupported={!!window.electronAPI}
                    onHoverHighlightStart={(id) => {
                        const defBlock = analysisResult.variables.get(id)?.definedInBlockId;
                        if(defBlock) setHoverHighlightIds(new Set([defBlock]));
                    }}
                    onHoverHighlightEnd={() => setHoverHighlightIds(null)}
                />
            </div>
        )}
      </div>

      {settingsModalOpen && (
        <SettingsModal 
            isOpen={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            settings={settingsForModal}
            onSettingsChange={handleSettingsChange}
            availableModels={['gemini-2.5-flash', 'gemini-3-pro-preview']}
        />
      )}
      
      {showConfigureRenpyModal && (
        <ConfigureRenpyModal
          isOpen={showConfigureRenpyModal}
          onClose={() => setShowConfigureRenpyModal(false)}
          onSave={(path) => {
            updateAppSettings(draft => { draft.renpyPath = path; });
            setShowConfigureRenpyModal(false);
            // Re-trigger run game after saving
            if (projectRootPath) {
                setTimeout(() => {
                    if (window.electronAPI) {
                        handleSaveAll().then(() => {
                            window.electronAPI.runGame(path, projectRootPath);
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
            <ul className="text-xs list-disc list-inside mt-2 max-h-24 overflow-y-auto bg-gray-100 dark:bg-gray-700 p-2 rounded">
                {deleteConfirmInfo.paths.map(p => <li key={p} className="truncate">{p.split('/').pop()}</li>)}
            </ul>
        </ConfirmModal>
      )}
      
      {unsavedChangesModalInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md m-4 flex flex-col p-6">
            <h2 className="text-xl font-bold mb-4 dark:text-white">{unsavedChangesModalInfo.title}</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {unsavedChangesModalInfo.message}
            </p>
            <div className="flex justify-end space-x-3">
               <button
                onClick={unsavedChangesModalInfo.onCancel}
                className="px-4 py-2 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
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
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
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