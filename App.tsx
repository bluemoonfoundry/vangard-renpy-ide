import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useImmer } from 'use-immer';
import JSZip from 'jszip';
import Toolbar from './components/Toolbar';
import StoryCanvas from './components/StoryCanvas';
import FileExplorerPanel from './components/FileExplorerPanel';
import EditorView from './components/EditorView';
import StoryElementsPanel from './components/StoryElementsPanel';
import RouteCanvas from './components/RouteCanvas';
import SettingsModal from './components/SettingsModal';
import ConfirmModal from './components/ConfirmModal';
import Toast from './components/Toast';
import LoadingOverlay from './components/LoadingOverlay';
import WelcomeScreen from './components/WelcomeScreen';
import ImageEditorView from './components/ImageEditorView';
import AudioEditorView from './components/AudioEditorView';
import CharacterEditorView from './components/CharacterEditorView';
import { useRenpyAnalysis, performRouteAnalysis } from './hooks/useRenpyAnalysis';
import { useHistory } from './hooks/useHistory';
import type { 
  Block, BlockGroup, Link, Position, FileSystemTreeNode, EditorTab, 
  ToastMessage, IdeSettings, Theme, ProjectImage, RenpyAudio, 
  ClipboardState, ImageMetadata, AudioMetadata, LabelNode, Character
} from './types';

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

const App: React.FC = () => {
  // --- State: Welcome Screen ---
  const [showWelcome, setShowWelcome] = useState(true);

  // --- State: Blocks & Groups (Undo/Redo) ---
  const { state: blocks, setState: setBlocks, undo, redo, canUndo, canRedo } = useHistory<Block[]>([]);
  const [groups, setGroups] = useImmer<BlockGroup[]>([]);
  
  // --- State: File System & Environment ---
  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [fileSystemTree, setFileSystemTree] = useState<FileSystemTreeNode | null>(null);
  const [images, setImages] = useImmer<Map<string, ProjectImage>>(new Map());
  const [audios, setAudios] = useImmer<Map<string, RenpyAudio>>(new Map());
  const [imageMetadata, setImageMetadata] = useImmer<Map<string, ImageMetadata>>(new Map());
  const [audioMetadata, setAudioMetadata] = useImmer<Map<string, AudioMetadata>>(new Map());
  
  // --- State: Scanning ---
  const [imageScanDirectories, setImageScanDirectories] = useState<Map<string, FileSystemDirectoryHandle>>(new Map());
  const [audioScanDirectories, setAudioScanDirectories] = useState<Map<string, FileSystemDirectoryHandle>>(new Map());
  const [imagesLastScanned, setImagesLastScanned] = useState<number | null>(null);
  const [audiosLastScanned, setAudiosLastScanned] = useState<number | null>(null);
  const [isRefreshingImages, setIsRefreshingImages] = useState(false);
  const [isRefreshingAudios, setIsRefreshingAudios] = useState(false);

  // --- State: UI & Editor ---
  // Using standard useState for openTabs to avoid Immer proxy issues with simple array management
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([{ id: 'canvas', type: 'canvas' }]);
  const [activeTabId, setActiveTabId] = useState<string>('canvas');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  
  const [dirtyBlockIds, setDirtyBlockIds] = useState<Set<string>>(new Set());
  const [dirtyEditors, setDirtyEditors] = useState<Set<string>>(new Set()); // Blocks modified in editor but not synced to block state yet
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // --- State: View Transforms ---
  const [storyCanvasTransform, setStoryCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [routeCanvasTransform, setRouteCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [ideSettings, setIdeSettings] = useState<IdeSettings>({
    theme: 'system',
    isLeftSidebarOpen: true,
    leftSidebarWidth: 250,
    isRightSidebarOpen: true,
    rightSidebarWidth: 300,
    openTabs: [],
    activeTabId: 'canvas',
    enableAiFeatures: false,
    selectedModel: 'gemini-1.5-flash',
  });

  // --- State: Clipboard & Search ---
  const [clipboard, setClipboard] = useState<ClipboardState>(null);
  const [findUsagesHighlightIds, setFindUsagesHighlightIds] = useState<Set<string> | null>(null);
  const [centerOnBlockRequest, setCenterOnBlockRequest] = useState<{ blockId: string, key: number } | null>(null);
  const [canvasFilters, setCanvasFilters] = useState({ story: true, screens: true, config: false });
  const [hoverHighlightIds, setHoverHighlightIds] = useState<Set<string> | null>(null);
  const [isClearConfirmVisible, setIsClearConfirmVisible] = useState(false);

  // --- Analysis ---
  const analysisResult = useRenpyAnalysis(blocks, 0); // 0 is a trigger for force re-analysis if needed
  
  // --- Refs ---
  const editorInstances = useRef<Map<string, any>>(new Map());

  // --- Initial Load & Theme ---
  useEffect(() => {
    const savedSettings = localStorage.getItem('renpy-ide-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setIdeSettings(prev => ({ ...prev, ...parsed }));
        setIsLeftSidebarOpen(parsed.isLeftSidebarOpen ?? true);
        setIsRightSidebarOpen(parsed.isRightSidebarOpen ?? true);
      } catch (e) { console.error("Failed to load settings", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('renpy-ide-settings', JSON.stringify({
      ...ideSettings,
      isLeftSidebarOpen,
      isRightSidebarOpen
    }));
    
    const root = window.document.documentElement;
    const applyTheme = (theme: Theme) => {
      root.classList.remove('dark', 'theme-solarized-light', 'theme-solarized-dark', 'theme-colorful', 'theme-colorful-light');
      if (theme === 'dark') root.classList.add('dark');
      if (theme === 'solarized-light') root.classList.add('theme-solarized-light');
      if (theme === 'solarized-dark') root.classList.add('dark', 'theme-solarized-dark');
      if (theme === 'colorful') root.classList.add('dark', 'theme-colorful');
      if (theme === 'colorful-light') root.classList.add('theme-colorful-light');
      // system & light: no special class (defaults)
    };

    if (ideSettings.theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      applyTheme(systemTheme);
    } else {
      applyTheme(ideSettings.theme);
    }
  }, [ideSettings, isLeftSidebarOpen, isRightSidebarOpen]);

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


  const addBlock = useCallback(() => {
    const id = `block-${Date.now()}`;
    const newBlock: Block = {
      id,
      content: `label new_label_${Math.floor(Math.random() * 1000)}:\n    "Write your dialogue here."\n    return\n`,
      position: { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 },
      width: 320,
      height: 200,
      title: 'New Block',
      filePath: `new_file_${Math.floor(Math.random() * 1000)}.rpy`
    };
    setBlocks(prev => [...prev, newBlock]);
    setDirtyBlockIds(prev => new Set(prev).add(id));
    
    // Update tree if possible (mock for browser, explicit for fs)
    if (fileSystemTree) {
        setFileSystemTree(prev => {
            if (!prev) return null;
            const newNode: FileSystemTreeNode = { name: newBlock.filePath!, path: newBlock.filePath! };
            return { ...prev, children: [...(prev.children || []), newNode] };
        });
    }
  }, [setBlocks, fileSystemTree]);

  const deleteBlock = useCallback((id: string) => {
    // Remove from groups
    setGroups(draft => {
        draft.forEach(g => {
            g.blockIds = g.blockIds.filter(bid => bid !== id);
        });
    });
    
    setBlocks(prev => prev.filter(b => b.id !== id));
    setOpenTabs(prev => prev.filter(t => t.blockId !== id));
    if (activeTabId === id) setActiveTabId('canvas');
    
    // Note: We don't delete the file from disk automatically here, just from the canvas.
  }, [setBlocks, setGroups, activeTabId]);

  // --- Layout ---
  const handleTidyUp = useCallback(() => {
    try {
        const links = analysisResult.links;
        const newLayout = computeAutoLayout(blocks, links);
        setBlocks(newLayout);
        addToast('Layout organized', 'success');
    } catch (e) {
        console.error("Failed to tidy up layout:", e);
        addToast('Failed to organize layout', 'error');
    }
  }, [blocks, analysisResult, setBlocks, addToast]);

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
  
  // Shared project loader
  const loadProject = useCallback(async (path: string) => {
      setIsLoading(true);
      setLoadingMessage('Reading project files...');
      try {
          const projectData = await window.electronAPI!.loadProject(path);
          
          // Convert files to blocks
          let loadedBlocks: Block[] = projectData.files.map((f: any, index: number) => ({
              id: `block-${index}-${Date.now()}`,
              content: f.content,
              filePath: f.path,
              position: { x: (index % 5) * 350, y: Math.floor(index / 5) * 250 }, // Simple grid init
              width: 320,
              height: 200,
              title: f.path.split('/').pop()
          }));

          if (loadedBlocks.length === 0) {
             // Create default block for empty project
             const defaultBlock = {
                 id: `block-${Date.now()}`,
                 content: `label start:\n    "Welcome to your new project!"\n    return\n`,
                 filePath: `script.rpy`,
                 position: { x: 50, y: 50 },
                 width: 320, height: 200, title: 'script.rpy'
             };
             loadedBlocks.push(defaultBlock);
             // Try to write it to disk immediately if possible
             if (window.electronAPI?.writeFile) {
                 const scriptPath = window.electronAPI.path ? window.electronAPI.path.join(projectData.rootPath, 'script.rpy') : `${projectData.rootPath}/script.rpy`;
                 await window.electronAPI.writeFile(scriptPath, defaultBlock.content);
                 // Also update tree to reflect this new file
                 if (projectData.tree) {
                     projectData.tree.children = [...(projectData.tree.children || []), { name: 'script.rpy', path: 'script.rpy' }];
                 }
             }
          }

          setProjectRootPath(projectData.rootPath);
          // Use computeAutoLayout for initial layout
          setBlocks(computeAutoLayout(loadedBlocks, [])); 
          setFileSystemTree(projectData.tree);
          
          // Load Assets
          const imgMap = new Map<string, ProjectImage>();
          projectData.images.forEach((img: any) => {
              // Fix: Map 'path' from Electron to 'filePath' expected by ProjectImage
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
              // Fix: Map 'path' from Electron to 'filePath' expected by RenpyAudio
              audioMap.set(aud.path, { 
                  ...aud, 
                  filePath: aud.path,
                  fileName: aud.path.split('/').pop(), 
                  isInProject: true, 
                  fileHandle: null 
              });
          });
          setAudios(audioMap);

          // Load Settings
           if (projectData.settings) {
              // Merge project settings (like API key) if present
              setIdeSettings(prev => ({ ...prev, ...projectData.settings }));
          }

          setOpenTabs([{ id: 'canvas', type: 'canvas' }]);
          setActiveTabId('canvas');
          setShowWelcome(false);
          addToast('Project loaded successfully', 'success');
      } catch (err) {
          console.error(err);
          addToast('Failed to load project', 'error');
      } finally {
          setIsLoading(false);
      }
  }, [setBlocks, setImages, setAudios, setIdeSettings, addToast, setFileSystemTree]);

  const handleOpenProjectFolder = useCallback(async () => {
    try {
        if (window.electronAPI) {
            const path = await window.electronAPI.openDirectory();
            if (path) {
                await loadProject(path);
            }
        } else {
            // Web File System Access API (Not implemented fully for this demo, falling back to mock)
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

  const handleContinueInBrowser = () => {
      setShowWelcome(false);
      setBlocks([]);
      setFileSystemTree({ name: 'Browser Project', path: '', children: [] });
      // Reset other states
      setProjectRootPath(null);
      setImages(new Map());
      setAudios(new Map());
      addToast('Started in Browser Mode', 'info');
  };

  const handleSaveAll = async () => {
    if (!projectRootPath && !directoryHandle) return; // Browser mode usually requires download
    setSaveStatus('saving');
    try {
        if (window.electronAPI) {
            // Save all dirty blocks
            for (const blockId of dirtyBlockIds) {
                const block = blocks.find(b => b.id === blockId);
                if (block && block.filePath) {
                    const absPath = window.electronAPI.path ? window.electronAPI.path.join(projectRootPath, block.filePath) : `${projectRootPath}/${block.filePath}`;
                    
                    const res = await window.electronAPI.writeFile(absPath, block.content);
                    if (!res.success) throw new Error(res.error);
                }
            }
            
            // Save project settings
             const settingsPath = `${projectRootPath}/game/project.ide.json`;
             await window.electronAPI.writeFile(settingsPath, JSON.stringify({
                 apiKey: ideSettings.apiKey,
                 theme: ideSettings.theme,
                 enableAiFeatures: ideSettings.enableAiFeatures,
                 selectedModel: ideSettings.selectedModel
             }, null, 2));

        } 
        // Web FS API implementation would go here

        setDirtyBlockIds(new Set());
        setSaveStatus('saved');
        addToast('All changes saved', 'success');
        setTimeout(() => setSaveStatus('saved'), 2000);
    } catch (err) {
        console.error(err);
        setSaveStatus('error');
        addToast('Failed to save changes', 'error');
    }
  };

  const handleDownloadZip = async () => {
      setIsLoading(true);
      setLoadingMessage('Compressing files...');
      try {
        const zip = new JSZip();
        const gameFolder = zip.folder("game");
        
        blocks.forEach(block => {
            const fileName = block.filePath || `${block.id}.rpy`;
            gameFolder?.file(fileName, block.content);
        });
        
        // Add images/audio if we have dataUrls
        // Note: Data URLs might be large.
        
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = "renpy-project.zip";
        a.click();
        URL.revokeObjectURL(url);
        addToast('Project downloaded', 'success');
      } catch (e) {
          addToast('Failed to generate zip', 'error');
      } finally {
          setIsLoading(false);
      }
  };

  // --- Tab Management ---
  const handleOpenEditor = useCallback((blockId: string, line?: number) => {
    const existing = openTabs.find(t => t.id === blockId);
    if (!existing) {
        const block = blocks.find(b => b.id === blockId);
        setOpenTabs(prev => [...prev, { 
            id: blockId, 
            type: 'editor', 
            blockId, 
            scrollRequest: line ? { line, key: Date.now() } : undefined 
        }]);
    } else if (line) {
        // Update scroll request for existing tab
        setOpenTabs(prev => prev.map(tab => 
            tab.id === blockId 
                ? { ...tab, scrollRequest: { line, key: Date.now() } }
                : tab
        ));
    }
    setActiveTabId(blockId);
  }, [blocks, openTabs]);

  const handleCloseTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
        setActiveTabId('canvas');
    }
  }, [activeTabId]);

  const handleSwitchTab = (tabId: string) => setActiveTabId(tabId);

  const handleCenterOnBlock = useCallback((blockId: string) => {
      setActiveTabId('canvas');
      setCenterOnBlockRequest({ blockId, key: Date.now() });
  }, []);

  const handleFindUsages = (id: string, type: 'character' | 'variable') => {
      // Simple finding based on analysis result
      const ids = new Set<string>();
      if (type === 'character') {
          // We don't have a direct map of char -> block[] in analysis result exposed simply yet, 
          // but we have dialogueLines.
          const lines = analysisResult.dialogueLines; // Map<blockId, line[]>
          // This is blockId -> lines. We need to search.
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
      // To update a character, we need to update the block that defines it.
      // This is complex because we need to parse/regenerate the define statement.
      // For this demo, we'll just show a success toast but note that full
      // source-code regeneration for characters is a larger task usually involving AST manipulation.
      
      // However, we can try a simple Find & Replace for the definition line if we have `definedInBlockId`.
      addToast(`Saved character ${char.name} (Simulated)`, 'success');
      // In a real implementation, we'd update the block content here.
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
      
      // Fix: Apply automatic layout to the generated route nodes before displaying
      const layoutedNodes = computeAutoLayout(labelNodes, routeLinks);

      setRouteCanvasData({ labelNodes: layoutedNodes, routeLinks, identifiedRoutes });
      
      // Open Route Canvas Tab
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
              const destPath = `${projectRootPath}/game/images/${fileName}`;
              
              const img = (Array.from(images.values()) as ProjectImage[]).find(i => i.filePath === src);
              if (img && img.dataUrl) {
                 // remove data:image/png;base64, prefix
                 const base64Data = img.dataUrl.split(',')[1];
                 await window.electronAPI.writeFile(destPath, base64Data, 'base64');
                 
                 setImages(draft => {
                     const existing = draft.get(src);
                     if (existing) existing.isInProject = true;
                     // Add new entry for the project file
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

  // --- Menu Command Listener ---
  useEffect(() => {
      if (window.electronAPI?.onMenuCommand) {
          const removeListener = window.electronAPI.onMenuCommand((data: any) => {
              switch (data.command) {
                  case 'new-project':
                      handleCreateProject();
                      break;
                  case 'open-project':
                      handleOpenProjectFolder();
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
  }, [handleCreateProject, handleOpenProjectFolder, handleOpenStaticTab]);

  // --- Render Helpers ---
  const activeBlock = useMemo(() => blocks.find(b => b.id === activeTabId), [blocks, activeTabId]);
  const activeTab = useMemo(() => openTabs.find(t => t.id === activeTabId), [openTabs, activeTabId]);

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {showWelcome && (
        <WelcomeScreen 
            onOpenProject={handleOpenProjectFolder}
            onCreateProject={handleCreateProject}
            onContinueInBrowser={handleContinueInBrowser}
            isElectron={!!window.electronAPI}
        />
      )}
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
        requestOpenFolder={handleOpenProjectFolder}
        handleSave={handleSaveAll}
        handleDownloadFiles={handleDownloadZip}
        onUploadClick={() => {/* Upload Zip Impl */}}
        setIsClearConfirmVisible={setIsClearConfirmVisible}
        onOpenSettings={() => setSettingsModalOpen(true)}
        isLeftSidebarOpen={isLeftSidebarOpen}
        setIsLeftSidebarOpen={setIsLeftSidebarOpen}
        isRightSidebarOpen={isRightSidebarOpen}
        setIsRightSidebarOpen={setIsRightSidebarOpen}
        onOpenStaticTab={handleOpenStaticTab}
      />
      
      <div className="flex-grow flex overflow-hidden relative">
        {/* Left Sidebar: File Explorer */}
        {isLeftSidebarOpen && (
            <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300">
                <FileExplorerPanel 
                    tree={fileSystemTree}
                    onFileOpen={(path) => {
                        // Find block with this path or create/open
                        const block = blocks.find(b => b.filePath === path);
                        if (block) handleOpenEditor(block.id);
                    }}
                    onCreateNode={(parent, name, type) => {
                        // Update logic would go here
                        addToast(`${type} created: ${name}`, 'success');
                    }}
                    onRenameNode={() => {}}
                    onDeleteNode={() => {}}
                    onMoveNode={() => {}}
                    clipboard={clipboard}
                    onCut={() => {}}
                    onCopy={() => {}}
                    onPaste={() => {}}
                    onCenterOnBlock={(path) => {
                         const block = blocks.find(b => b.filePath === path);
                         if (block) handleCenterOnBlock(block.id);
                    }}
                />
            </div>
        )}

        {/* Main Content Area */}
        <div className="flex-grow flex flex-col min-w-0 bg-gray-100 dark:bg-gray-900 relative">
            {/* Tab Bar */}
            <div className="flex items-center bg-gray-200 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 overflow-x-auto">
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

                    const isActive = activeTabId === tab.id;
                    return (
                        <div 
                            key={tab.id}
                            onClick={() => handleSwitchTab(tab.id)}
                            className={`group flex items-center px-4 py-2 text-sm cursor-pointer border-r border-gray-300 dark:border-gray-700 min-w-[120px] max-w-[200px] ${isActive ? 'bg-white dark:bg-gray-900 font-medium text-indigo-600 dark:text-indigo-400 border-t-2 border-t-indigo-500' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                        >
                            <span className="truncate flex-grow">{title}</span>
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

            {/* Tab Content */}
            <div className="flex-grow relative overflow-hidden">
                {activeTabId === 'canvas' && (
                    <StoryCanvas 
                        blocks={blocks}
                        groups={groups}
                        analysisResult={analysisResult}
                        updateBlock={updateBlock}
                        updateGroup={updateGroup}
                        updateBlockPositions={updateBlockPositions}
                        updateGroupPositions={updateGroupPositions}
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
                            // Update internal state of route canvas nodes if needed, 
                            // or just let them be transient. 
                            // For now, we can update the state passed to it.
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
                        block={activeBlock}
                        blocks={blocks}
                        analysisResult={analysisResult}
                        initialScrollRequest={activeTab.scrollRequest}
                        onSwitchFocusBlock={(blockId, line) => {
                            handleOpenEditor(blockId, line);
                        }}
                        onSave={(id, content) => updateBlock(id, { content })}
                        onDirtyChange={(id, isDirty) => {
                            if (isDirty) setDirtyEditors(prev => new Set(prev).add(id));
                            else setDirtyEditors(prev => { const s = new Set(prev); s.delete(id); return s; });
                        }}
                        editorTheme={ideSettings.theme.includes('dark') || ideSettings.theme === 'colorful' ? 'dark' : 'light'}
                        apiKey={ideSettings.apiKey}
                        enableAiFeatures={ideSettings.enableAiFeatures}
                        availableModels={['gemini-1.5-flash', 'gemini-1.5-pro']}
                        selectedModel={ideSettings.selectedModel}
                        addToast={addToast}
                        onEditorMount={(id, editor) => editorInstances.current.set(id, editor)}
                        onEditorUnmount={(id) => editorInstances.current.delete(id)}
                    />
                )}

                {activeTab?.type === 'image' && activeTab.filePath && (
                    <ImageEditorView 
                        // Safe lookup or fallback to prevent crash, though content might be empty if lookup fails
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

        {/* Right Sidebar: Story Elements */}
        {isRightSidebarOpen && (
             <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col overflow-hidden transition-all duration-300">
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
                    onOpenImageEditor={(path) => {
                        const tabId = `img-${path}`;
                        setOpenTabs(prev => {
                            if(!prev.find(t => t.id === tabId)) {
                                return [...prev, { id: tabId, type: 'image', filePath: path }];
                            }
                            return prev;
                        });
                        setActiveTabId(tabId);
                    }}
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
                        // Find blocks containing this
                        // Simplified: Just highlight blocks that define it for now
                        const defBlock = analysisResult.variables.get(id)?.definedInBlockId;
                        if(defBlock) setHoverHighlightIds(new Set([defBlock]));
                    }}
                    onHoverHighlightEnd={() => setHoverHighlightIds(null)}
                />
            </div>
        )}
      </div>

      {/* Modals & Overlays */}
      {settingsModalOpen && (
        <SettingsModal 
            isOpen={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
            settings={ideSettings}
            onSettingsChange={(k, v) => setIdeSettings(p => ({ ...p, [k]: v }))}
            availableModels={['gemini-1.5-flash', 'gemini-1.5-pro']}
        />
      )}
      
      {isClearConfirmVisible && (
        <ConfirmModal 
            title="Clear Canvas"
            onConfirm={() => {
                setBlocks([]);
                setGroups([]);
                setOpenTabs([{ id: 'canvas', type: 'canvas' }]);
                setActiveTabId('canvas');
                setIsClearConfirmVisible(false);
            }}
            onClose={() => setIsClearConfirmVisible(false)}
        >
            Are you sure you want to clear the entire project? This action cannot be undone if you haven't saved.
        </ConfirmModal>
      )}

      {isLoading && <LoadingOverlay progress={loadingProgress} message={loadingMessage} />}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
             <div key={t.id} className="pointer-events-auto">
                <Toast toast={t} onDismiss={removeToast} />
             </div>
        ))}
      </div>
    </div>
  );
};

export default App;