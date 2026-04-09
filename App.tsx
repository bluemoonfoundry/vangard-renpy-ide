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
import ChoiceCanvas from './components/ChoiceCanvas';
import SettingsModal from './components/SettingsModal';
import ConfirmModal from './components/ConfirmModal';
import CreateBlockModal, { BlockType } from './components/CreateBlockModal';
import ConfigureRenpyModal from './components/ConfigureRenpyModal';
import Toast from './components/Toast';
import LoadingOverlay from './components/LoadingOverlay';
import AnalysisOverlay from './components/AnalysisOverlay';
import ImageEditorView from './components/ImageEditorView';
import AudioEditorView from './components/AudioEditorView';
import CharacterEditorView from './components/CharacterEditorView';
import SceneComposer from './components/SceneComposer';
import ImageMapComposer from './components/ImageMapComposer';
import ScreenLayoutComposer from './components/ScreenLayoutComposer';
import MarkdownPreviewView from './components/MarkdownPreviewView';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import { useDiagnostics, migratePunchlistToTasks } from './hooks/useDiagnostics';
import { useDebounce } from './hooks/useDebounce';
import TabContextMenu from './components/TabContextMenu';
import Sash from './components/Sash';
import StatusBar from './components/StatusBar';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import AboutModal from './components/AboutModal';
import UserSnippetModal from './components/UserSnippetModal';
import NewProjectWizardModal from './components/NewProjectWizardModal';
import { SearchProvider } from './contexts/SearchContext';
import AIGeneratorView from './components/AIGeneratorView';
import StatsView from './components/StatsView';
import { useRenpyAnalysis, performRouteAnalysis } from './hooks/useRenpyAnalysis';
import { useHistory } from './hooks/useHistory';
import { createId } from './lib/createId';
import {
  buildSavedStoryBlockLayouts,
  computeStoryLayout,
  computeStoryLayoutFingerprint,
  getStoryLayoutVersion,
} from './lib/storyCanvasLayout';
import {
  computeRouteCanvasLayout,
  computeRouteCanvasLayoutFingerprint,
  getRouteCanvasLayoutVersion,
} from './lib/routeCanvasLayout';
import type {
  Block, BlockGroup, Position, FileSystemTreeNode, EditorTab,
  ToastMessage, Theme, ProjectImage, RenpyAudio,
  ClipboardState, ImageMetadata, AudioMetadata, Character,
  AppSettings, ProjectSettings, StickyNote, SceneComposition, SceneSprite, ImageMapComposition, ScreenLayoutComposition, PunchlistMetadata, DiagnosticsTask, IgnoredDiagnosticRule,
  SerializedSprite, SerializedSceneComposition, StoryCanvasGroupingMode, StoryCanvasLayoutMode, UserSnippet
} from './types';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// Minimal 1-sample silent WAV base64
const SILENT_WAV_BASE64 = "UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==";


interface SerializedImageRef {
    filePath: string;
}

interface SerializedImageMapComposition {
    screenName: string;
    groundImage: SerializedImageRef | null;
    hoverImage: SerializedImageRef | null;
    hotspots: ImageMapComposition['hotspots'];
}

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

interface PendingStoryLayoutRefresh {
    hasSavedLayouts: boolean;
    savedFingerprint?: string;
    savedVersion?: number;
    savedWasUserAdjusted: boolean;
}

interface PendingRouteLayoutRefresh {
    hasSavedLayouts: boolean;
    savedFingerprint?: string;
    savedVersion?: number;
    savedWasUserAdjusted: boolean;
}

const AVAILABLE_MODELS = [
    'gemini-2.5-flash',
    'gemini-3-pro-preview',
    'gemini-2.5-flash-image',
    'gemini-3-pro-image-preview',
    'veo-3.1-fast-generate-preview',
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20250219',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
];

const App: React.FC = () => {
  // --- State: Blocks & Groups (Undo/Redo) ---
  const { state: blocks, setState: setBlocks, undo, redo, canUndo, canRedo } = useHistory<Block[]>([]);
  const [groups, setGroups] = useImmer<BlockGroup[]>([]);
  const [stickyNotes, setStickyNotes] = useImmer<StickyNote[]>([]);
  const [routeStickyNotes, setRouteStickyNotes] = useImmer<StickyNote[]>([]);
  const [choiceStickyNotes, setChoiceStickyNotes] = useImmer<StickyNote[]>([]);
  
  // Use a ref to track blocks for effects that need current blocks without triggering updates
  const blocksRef = useRef(blocks);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

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

  const [directoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
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
  const [imagesLastScanned] = useState<number | null>(null);
  const [audiosLastScanned] = useState<number | null>(null);
  const [isRefreshingImages] = useState(false);
  const [isRefreshingAudios] = useState(false);

  // --- State: UI & Editor ---
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([{ id: 'canvas', type: 'canvas' }]);
  const [activeTabId, setActiveTabId] = useState<string>('canvas');
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragSourcePaneId, setDragSourcePaneId] = useState<'primary' | 'secondary'>('primary');
  const [splitLayout, setSplitLayout] = useState<'none' | 'right' | 'bottom'>('none');
  const [splitPrimarySize, setSplitPrimarySize] = useState<number>(600);
  const [secondaryOpenTabs, setSecondaryOpenTabs] = useState<EditorTab[]>([]);
  const [secondaryActiveTabId, setSecondaryActiveTabId] = useState<string>('');
  const [activePaneId, setActivePaneId] = useState<'primary' | 'secondary'>('primary');
  
  // Scene Composer State
  const [sceneCompositions, setSceneCompositions] = useImmer<Record<string, SceneComposition>>({});
  const [sceneNames, setSceneNames] = useImmer<Record<string, string>>({});

  // ImageMap Composer State
  const [imagemapCompositions, setImagemapCompositions] = useImmer<Record<string, ImageMapComposition>>({});

  // Screen Layout Composer State
  const [screenLayoutCompositions, setScreenLayoutCompositions] = useImmer<Record<string, ScreenLayoutComposition>>({});

  // Punchlist State (kept for migration — not written on save)
  const [punchlistMetadata, setPunchlistMetadata] = useImmer<Record<string, PunchlistMetadata>>({});
  // Diagnostics Tasks State
  const [diagnosticsTasks, setDiagnosticsTasks] = useImmer<DiagnosticsTask[]>([]);
  const [ignoredDiagnostics, setIgnoredDiagnostics] = useImmer<IgnoredDiagnosticRule[]>([]);
  
  const [dirtyBlockIds, setDirtyBlockIds] = useState<Set<string>>(new Set());
  const [dirtyEditors, setDirtyEditors] = useState<Set<string>>(new Set()); // Blocks modified in editor but not synced to block state yet
  const [hasUnsavedSettings, setHasUnsavedSettings] = useState(false); // Track project setting changes like sticky notes
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  const [, setStatusBarMessage] = useState('');
  const [isScanningAssets, setIsScanningAssets] = useState(false);
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialAnalysisPending, setIsInitialAnalysisPending] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const loadCancelRef = useRef(false);
  const [nonRenpyWarningPath, setNonRenpyWarningPath] = useState<string | null>(null);
  
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{ paths: string[]; onConfirm: () => void; } | null>(null);
  const [createBlockModalOpen, setCreateBlockModalOpen] = useState(false);
  const [unsavedChangesModalInfo, setUnsavedChangesModalInfo] = useState<UnsavedChangesModalInfo | null>(null);
  const [contextMenuInfo, setContextMenuInfo] = useState<{ x: number; y: number; tabId: string; paneId: 'primary' | 'secondary' } | null>(null);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  
  // --- State: View Transforms ---
  const [storyCanvasTransform, setStoryCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [routeCanvasTransform, setRouteCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [choiceCanvasTransform, setChoiceCanvasTransform] = useState({ x: 0, y: 0, scale: 1 });

  // --- State: Game Execution ---
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [showConfigureRenpyModal, setShowConfigureRenpyModal] = useState(false);

  // --- State: User Snippet Modal ---
  const [userSnippetModalOpen, setUserSnippetModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<UserSnippet | null>(null);

  // --- State: Application and Project Settings ---
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [wizardModalOpen, setWizardModalOpen] = useState(false);
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
    mouseGestures: { canvasPanGesture: 'shift-drag', middleMouseAlwaysPans: false, zoomScrollDirection: 'normal', zoomScrollSensitivity: 1.0 },
    lastProjectDir: '',
  });
  const [isRenpyPathValid, setIsRenpyPathValid] = useState(false);
  const [projectSettings, updateProjectSettings] = useImmer<Omit<ProjectSettings, 'openTabs' | 'activeTabId' | 'stickyNotes' | 'characterProfiles' | 'punchlistMetadata' | 'diagnosticsTasks' | 'ignoredDiagnostics' | 'sceneCompositions' | 'sceneNames' | 'scannedImagePaths' | 'scannedAudioPaths'>>({
    enableAiFeatures: false,
    selectedModel: 'gemini-2.5-flash',
    draftingMode: false,
    storyCanvasLayoutMode: 'flow-lr',
    storyCanvasGroupingMode: 'none',
    storyCanvasLayoutVersion: getStoryLayoutVersion(),
    storyCanvasLayoutWasUserAdjusted: false,
    routeCanvasLayoutMode: 'flow-lr',
    routeCanvasGroupingMode: 'none',
    routeCanvasLayoutVersion: getRouteCanvasLayoutVersion(),
    routeCanvasLayoutWasUserAdjusted: false,
  });

  // --- State: Clipboard & Highlights ---
  const [clipboard, setClipboard] = useState<ClipboardState>(null);
  const [findUsagesHighlightIds, setFindUsagesHighlightIds] = useState<Set<string> | null>(null);
  const [centerOnBlockRequest, setCenterOnBlockRequest] = useState<{ blockId: string, key: number } | null>(null);
  const [flashBlockRequest, setFlashBlockRequest] = useState<{ blockId: string, key: number } | null>(null);
  const [canvasFilters, setCanvasFilters] = useState({ story: true, screens: true, config: false, notes: true, minimap: true });
  const [_editorCursorPosition, setEditorCursorPosition] = useState<{ line: number; column: number } | null>(null);
  const [hoverHighlightIds, setHoverHighlightIds] = useState<Set<string> | null>(null);

  // --- State: Route Canvas ---
  const [routeNodeLayoutCache, setRouteNodeLayoutCache] = useState<Map<string, Position>>(new Map());

  // --- State: Search (panel toggle remains here; query/results live in SearchContext) ---
  const [activeLeftPanel, setActiveLeftPanel] = useState<'explorer' | 'search'>('explorer');

  // --- Analysis ---
  // Debounce block content changes before feeding them into expensive analysis passes.
  // The editor state (`blocks`) updates immediately on every keystroke; analysis only
  // runs after 500 ms of inactivity, preventing main-thread freezes during active typing.
  const debouncedBlocks = useDebounce(blocks, 500);

  // Slim block objects for the analysis worker — position/size are irrelevant to parsing
  // and including them caused re-analysis on every canvas drag.
  const analysisBlocks = useMemo(
    () => debouncedBlocks.map(({ id, content, filePath }) => ({ id, content, filePath })),
    [debouncedBlocks],
  );

  const [analysisResult, isWorkerPending, analysisProgress] = useRenpyAnalysis(analysisBlocks, 0);
  // Pending covers both: the 500ms debounce window AND the worker's async computation
  const isAnalysisPending = blocks !== debouncedBlocks || isWorkerPending;
  const diagnosticsResult = useDiagnostics(debouncedBlocks, analysisResult, images, imageMetadata, audios, audioMetadata, ignoredDiagnostics);

  // Ref that latches to true once the analysis worker starts (isWorkerPending goes true)
  // after a project load. Prevents the overlay from closing during the one-render gap
  // between debouncedBlocks updating (which makes isAnalysisPending briefly false) and
  // the useRenpyAnalysis effect actually posting to the worker.
  const analysisWorkerHasStartedRef = useRef(false);

  useEffect(() => {
    if (!isInitialAnalysisPending) {
      // Reset the latch so the next project load works correctly.
      analysisWorkerHasStartedRef.current = false;
      return;
    }
    if (isWorkerPending) {
      // Worker has started — latch on.
      analysisWorkerHasStartedRef.current = true;
    } else if (analysisWorkerHasStartedRef.current) {
      // Worker was running and is now done — safe to close the overlay.
      setIsInitialAnalysisPending(false);
    }
  }, [isWorkerPending, isInitialAnalysisPending]);

  // Memoized flat arrays — Map.values() iteration is O(n); without this every
  // renderTabContent call recreated 14,000-item arrays on each re-render.
  const imagesArray = useMemo(() => Array.from(images.values()), [images]);

  // Stable array of character tag strings passed to CharacterEditorView.
  // Without this, Array.from() in renderTabContent creates a new reference every
  // render, defeating React.memo on CharacterEditorView.
  const characterTagsArray = useMemo(
    () => Array.from(analysisResult.characters.keys()),
    [analysisResult.characters],
  );
  
  // --- Refs ---
  const editorInstances = useRef<Map<string, monaco.editor.IStandaloneCodeEditor>>(new Map());
  // Lazy-mount sets: a tab's content is only rendered once it has been the active tab at
  // least once. After first activation the content stays mounted (visibility: hidden when
  // inactive) so editor state, scroll positions, etc. are preserved across tab switches
  // without paying the mount cost every time.
  const primaryMountedTabsRef = useRef(new Set<string>());
  const secondaryMountedTabsRef = useRef(new Set<string>());
  const primaryTabBarRef = useRef<HTMLDivElement>(null);
  const secondaryTabBarRef = useRef<HTMLDivElement>(null);
  const pendingStoryLayoutRefreshRef = useRef<PendingStoryLayoutRefresh | null>(null);
  const pendingRouteLayoutRefreshRef = useRef<PendingRouteLayoutRefresh | null>(null);

  // --- Utility Functions ---
  const getCurrentContext = useCallback(() => {
    // Find the currently active editor tab
    const activeEditorTab = openTabs.find(t => t.id === activeTabId && t.type === 'editor');
    if (activeEditorTab && activeEditorTab.blockId) {
      const editor = editorInstances.current.get(activeEditorTab.blockId);
      if (editor) {
        const model = editor.getModel();
        const position = editor.getPosition();
        if (model && position) {
          return model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          });
        }
      }
    }
    return '';
  }, [activeTabId, openTabs]);

  const getCurrentBlockId = useCallback(() => {
    // Find the currently active editor tab
    const activeEditorTab = openTabs.find(t => t.id === activeTabId && t.type === 'editor');
    return activeEditorTab?.blockId || '';
  }, [activeTabId, openTabs]);

  // --- Derived State for Drafting Mode ---
  const existingImageTags = useMemo(() => {
      const tags = new Set<string>();
      // Defined in script (e.g. image eileen = ...)
      analysisResult.definedImages.forEach(img => tags.add(img));
      
      // Defined by files in project or scanned
      imageMetadata.forEach((meta) => {
          const fullTag = `${meta.renpyName} ${meta.tags.join(' ')}`.trim();
          tags.add(fullTag);
      });
      images.forEach((img) => {
          if (!img.projectFilePath && !imageMetadata.has(img.filePath)) {
              tags.add(img.fileName.split('.')[0]);
          }
      });
      return tags;
  }, [analysisResult.definedImages, imageMetadata, images]);

  const existingAudioPaths = useMemo(() => {
      const paths = new Set<string>();
      audios.forEach((audio) => {
          // Normalize to forward slashes
          let p = audio.projectFilePath || audio.filePath;
          p = p.replace(/\\/g, '/');
          
          paths.add(p); // Full path
          if (p.startsWith('game/audio/')) {
              paths.add(p.substring('game/audio/'.length)); // Relative to game/audio
          }
          paths.add(audio.fileName); // Just filename (Ren'Py search)
      });
      
      // Add explicit variable names for audio defined in scripts
      analysisResult.variables.forEach(v => {
          paths.add(v.name);
      });
      
      return paths;
  }, [audios, analysisResult.variables]);

  // --- Route View Logic ---
  const handleUpdateRouteNodePositions = useCallback((updates: { id: string, position: Position }[]) => {
      setRouteNodeLayoutCache(prev => {
          const next = new Map(prev);
          updates.forEach(u => next.set(u.id, u.position));
          return next;
      });
      updateProjectSettings(draft => {
          draft.routeCanvasLayoutWasUserAdjusted = true;
      });
      setHasUnsavedSettings(true);
  }, [updateProjectSettings]);

  // Stable callbacks for StoryCanvas — previously inline lambdas that caused the
  // canvas to re-render on every App.tsx state change (e.g. switching any tab).
  const handleClearFindUsages = useCallback(() => setFindUsagesHighlightIds(null), []);
  const canvasInteractionEnd = useCallback(() => {}, []);

  const routeAnalysisResult = useMemo(() => {
      const raw = performRouteAnalysis(debouncedBlocks, analysisResult.labels, analysisResult.jumps);
      const layoutMode = projectSettings.routeCanvasLayoutMode ?? 'flow-lr';
      const groupingMode = projectSettings.routeCanvasGroupingMode ?? 'none';
      const layoutedNodes = computeRouteCanvasLayout(raw.labelNodes, raw.routeLinks, layoutMode, groupingMode);

      // Apply User Overrides (Cache)
      // If the user has manually moved a node, we prioritize that position over the auto-layout
      const finalNodes = layoutedNodes.map(n => {
          const cached = routeNodeLayoutCache.get(n.id);
          return cached ? { ...n, position: cached } : n;
      });

      return {
          ...raw,
          labelNodes: finalNodes,
      };
  }, [debouncedBlocks, analysisResult, routeNodeLayoutCache, projectSettings.routeCanvasGroupingMode, projectSettings.routeCanvasLayoutMode]);

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
          const next = typeof value === 'function' ? (value as (prevState: SceneComposition) => SceneComposition)(prev) : value;
          
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

  // --- ImageMap Composer Management ---
  const handleCreateImageMap = useCallback((initialName?: string) => {
      const id = `imagemap-${Date.now()}`;
      const name = initialName || `imagemap_${Object.keys(imagemapCompositions).length + 1}`;

      setImagemapCompositions(draft => {
          draft[id] = {
              screenName: name,
              groundImage: null,
              hoverImage: null,
              hotspots: []
          };
      });

      setOpenTabs(prev => [...prev, { id, type: 'imagemap-composer', imagemapId: id }]);
      setActiveTabId(id);
      setHasUnsavedSettings(true);
  }, [imagemapCompositions, setImagemapCompositions]);

  const handleOpenImageMap = useCallback((imagemapId: string) => {
      setOpenTabs(prev => {
          if (!prev.find(t => t.id === imagemapId)) {
              return [...prev, { id: imagemapId, type: 'imagemap-composer', imagemapId }];
          }
          return prev;
      });
      setActiveTabId(imagemapId);
  }, []);

  const handleImageMapUpdate = useCallback((imagemapId: string, value: React.SetStateAction<ImageMapComposition>) => {
      setImagemapCompositions(draft => {
          const prev = draft[imagemapId] || { screenName: '', groundImage: null, hoverImage: null, hotspots: [] };
          const next = typeof value === 'function' ? (value as (prevState: ImageMapComposition) => ImageMapComposition)(prev) : value;

          if (JSON.stringify(prev) !== JSON.stringify(next)) {
              draft[imagemapId] = next;
              setHasUnsavedSettings(true);
          }
      });
  }, [setImagemapCompositions]);

  const handleRenameImageMap = useCallback((imagemapId: string, newName: string) => {
      setImagemapCompositions(draft => {
          if (draft[imagemapId] && draft[imagemapId].screenName !== newName) {
              draft[imagemapId].screenName = newName;
              setHasUnsavedSettings(true);
          }
      });
  }, [setImagemapCompositions]);

  const handleDeleteImageMap = useCallback((imagemapId: string) => {
      setImagemapCompositions(draft => { delete draft[imagemapId]; });

      setOpenTabs(prev => prev.filter(t => t.id !== imagemapId));
      if (activeTabId === imagemapId) setActiveTabId('canvas');
      setHasUnsavedSettings(true);
  }, [setImagemapCompositions, activeTabId]);

  // --- Screen Layout Composer Management ---
  const handleCreateScreenLayout = useCallback((initialName?: string) => {
      const id = `screenlayout-${Date.now()}`;
      const name = initialName || `screen_${Object.keys(screenLayoutCompositions).length + 1}`;

      setScreenLayoutCompositions(draft => {
          draft[id] = {
              screenName: name,
              gameWidth: 1920,
              gameHeight: 1080,
              modal: false,
              zorder: 0,
              widgets: []
          };
      });

      setOpenTabs(prev => [...prev, { id, type: 'screen-layout-composer', layoutId: id }]);
      setActiveTabId(id);
      setHasUnsavedSettings(true);
  }, [screenLayoutCompositions, setScreenLayoutCompositions]);

  const handleOpenScreenLayout = useCallback((layoutId: string) => {
      setOpenTabs(prev => {
          if (!prev.find(t => t.id === layoutId)) {
              return [...prev, { id: layoutId, type: 'screen-layout-composer', layoutId }];
          }
          return prev;
      });
      setActiveTabId(layoutId);
  }, []);

  const handleScreenLayoutUpdate = useCallback((layoutId: string, value: React.SetStateAction<ScreenLayoutComposition>) => {
      setScreenLayoutCompositions(draft => {
          const prev = draft[layoutId] || { screenName: '', gameWidth: 1920, gameHeight: 1080, modal: false, zorder: 0, widgets: [] };
          const next = typeof value === 'function' ? (value as (prevState: ScreenLayoutComposition) => ScreenLayoutComposition)(prev) : value;

          if (JSON.stringify(prev) !== JSON.stringify(next)) {
              draft[layoutId] = next;
              setHasUnsavedSettings(true);
          }
      });
  }, [setScreenLayoutCompositions]);

  const handleRenameScreenLayout = useCallback((layoutId: string, newName: string) => {
      setScreenLayoutCompositions(draft => {
          if (draft[layoutId] && draft[layoutId].screenName !== newName) {
              draft[layoutId].screenName = newName;
              setHasUnsavedSettings(true);
          }
      });
  }, [setScreenLayoutCompositions]);

  const handleDuplicateScreenLayout = useCallback((layoutId: string) => {
      const original = screenLayoutCompositions[layoutId];
      if (!original) return;
      const existingNames = new Set(Object.values(screenLayoutCompositions).map(c => c.screenName));
      let counter = 1;
      let newName = `${original.screenName} (${counter})`;
      while (existingNames.has(newName)) { counter++; newName = `${original.screenName} (${counter})`; }
      const newId = `screenlayout-${Date.now()}`;
      setScreenLayoutCompositions(draft => { draft[newId] = { ...original, screenName: newName }; });
      setHasUnsavedSettings(true);
      setOpenTabs(prev => {
          if (!prev.find(t => t.id === newId)) return [...prev, { id: newId, type: 'screen-layout-composer', layoutId: newId }];
          return prev;
      });
      setActiveTabId(newId);
  }, [screenLayoutCompositions, setScreenLayoutCompositions]);

  const handleDeleteScreenLayout = useCallback((layoutId: string) => {
      setScreenLayoutCompositions(draft => { delete draft[layoutId]; });

      setOpenTabs(prev => prev.filter(t => t.id !== layoutId));
      if (activeTabId === layoutId) setActiveTabId('canvas');
      setHasUnsavedSettings(true);
  }, [setScreenLayoutCompositions, activeTabId]);

  // --- Sync Explorer with Active Tab ---
  useEffect(() => {
    if (activeTabId === 'canvas' || activeTabId === 'route-canvas' || activeTabId === 'choice-canvas' || activeTabId === 'punchlist') return;

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
      }).catch(err => {
        console.error('Failed to load app settings:', err);
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
        })
        .catch(err => console.error('Failed to save app settings:', err));
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

  // --- Check Ren'Py Path Validity ---
  useEffect(() => {
    if (window.electronAPI?.checkRenpyPath && appSettings.renpyPath) {
      window.electronAPI.checkRenpyPath(appSettings.renpyPath).then(setIsRenpyPathValid).catch(() => setIsRenpyPathValid(false));
    } else {
      setIsRenpyPathValid(false);
    }
  }, [appSettings.renpyPath]);

  // --- Toast Helper ---
  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = createId('toast');
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Safety timeout: dismiss the analysis overlay if the worker hasn't finished
  // within 30 seconds. Prevents the UI from being permanently locked on very
  // large projects where analysis exceeds reasonable bounds.
  useEffect(() => {
    if (!isInitialAnalysisPending) return;
    const timeout = setTimeout(() => {
      setIsInitialAnalysisPending(false);
      addToast('Analysis took too long and was skipped. Results may be incomplete.', 'warning');
    }, 30_000);
    return () => clearTimeout(timeout);
  }, [isInitialAnalysisPending, addToast]);

  // --- Block Management ---
  const updateBlock = useCallback((id: string, data: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
    if (data.content !== undefined) {
      setDirtyBlockIds(prev => new Set(prev).add(id));
    }
    if (data.position || data.width !== undefined || data.height !== undefined || data.color !== undefined) {
      updateProjectSettings(draft => {
        draft.storyCanvasLayoutWasUserAdjusted = true;
      });
      setHasUnsavedSettings(true);
    }
  }, [setBlocks, updateProjectSettings]);

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
    updateProjectSettings(draft => {
        draft.storyCanvasLayoutWasUserAdjusted = true;
    });
    setHasUnsavedSettings(true);
  }, [setBlocks, updateProjectSettings]);

   const updateGroupPositions = useCallback((updates: { id: string, position: Position }[]) => {
    setGroups(draft => {
      updates.forEach(u => {
        const g = draft.find(g => g.id === u.id);
        if (g) g.position = u.position;
      });
    });
    updateProjectSettings(draft => {
        draft.storyCanvasLayoutWasUserAdjusted = true;
    });
    setHasUnsavedSettings(true);
  }, [setGroups, updateProjectSettings]);


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
            const fullPath = await window.electronAPI.path.join(projectRootPath!, cleanFolderPath, fileName) as string;
            
            const res = await window.electronAPI.writeFile(fullPath, content);
            if (res.success) {
                addBlock(relativePath, content);
                addToast(`Created ${fileName} in ${cleanFolderPath || 'root'}`, 'success');
                const projData = await window.electronAPI.loadProject(projectRootPath!);
                setFileSystemTree(projData.tree);
            } else {
                const errorMsg = typeof res.error === 'string' ? res.error : 'Unknown error occurred during file creation';
                throw new Error(errorMsg);
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
              const fullPath = await window.electronAPI.path.join(projectRootPath!, folderPath, fileName) as string;
              const relativePath = `game/${fileName}`;
              
              const res = await window.electronAPI.writeFile(fullPath, content);
              if (res.success) {
                  addBlock(relativePath, content, position);
                  addToast(`Created ${fileName}`, 'success');
                  const projData = await window.electronAPI.loadProject(projectRootPath);
                  setFileSystemTree(projData.tree);
              } else {
                  const errorMsg = typeof res.error === 'string' ? res.error : 'Unknown error occurred during file creation';
                  throw new Error(errorMsg);
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

  // --- Route Canvas Sticky Note Management ---
  const addRouteStickyNote = useCallback((initialPosition?: Position) => {
      const id = `rnote-${Date.now()}`;
      const width = 200;
      const height = 200;
      const pos = initialPosition
        ? { x: initialPosition.x - width / 2, y: initialPosition.y - height / 2 }
        : { x: 0, y: 0 };
      setRouteStickyNotes(draft => { draft.push({ id, content: '', position: pos, width, height, color: 'yellow' }); });
      setHasUnsavedSettings(true);
  }, [setRouteStickyNotes]);

  const updateRouteStickyNote = useCallback((id: string, data: Partial<StickyNote>) => {
      setRouteStickyNotes(draft => { const idx = draft.findIndex(n => n.id === id); if (idx !== -1) Object.assign(draft[idx], data); });
      setHasUnsavedSettings(true);
  }, [setRouteStickyNotes]);

  const deleteRouteStickyNote = useCallback((id: string) => {
      setRouteStickyNotes(draft => { const idx = draft.findIndex(n => n.id === id); if (idx !== -1) draft.splice(idx, 1); });
      setHasUnsavedSettings(true);
  }, [setRouteStickyNotes]);

  // --- Choice Canvas Sticky Note Management ---
  const addChoiceStickyNote = useCallback((initialPosition?: Position) => {
      const id = `cnote-${Date.now()}`;
      const width = 200;
      const height = 200;
      const pos = initialPosition
        ? { x: initialPosition.x - width / 2, y: initialPosition.y - height / 2 }
        : { x: 0, y: 0 };
      setChoiceStickyNotes(draft => { draft.push({ id, content: '', position: pos, width, height, color: 'yellow' }); });
      setHasUnsavedSettings(true);
  }, [setChoiceStickyNotes]);

  const updateChoiceStickyNote = useCallback((id: string, data: Partial<StickyNote>) => {
      setChoiceStickyNotes(draft => { const idx = draft.findIndex(n => n.id === id); if (idx !== -1) Object.assign(draft[idx], data); });
      setHasUnsavedSettings(true);
  }, [setChoiceStickyNotes]);

  const deleteChoiceStickyNote = useCallback((id: string) => {
      setChoiceStickyNotes(draft => { const idx = draft.findIndex(n => n.id === id); if (idx !== -1) draft.splice(idx, 1); });
      setHasUnsavedSettings(true);
  }, [setChoiceStickyNotes]);


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
  const applyStoryLayout = useCallback((
    layoutMode: StoryCanvasLayoutMode,
    groupingMode: StoryCanvasGroupingMode,
    options?: { showToast?: boolean; successMessage?: string; statusMessage?: string; toastType?: ToastMessage['type']; },
  ) => {
    setStatusBarMessage('Organizing layout...');
    try {
        const links = analysisResult.links;
        const newLayout = computeStoryLayout(blocks, links, layoutMode, groupingMode);
        const layoutFingerprint = computeStoryLayoutFingerprint(newLayout, links, layoutMode, groupingMode);
        setBlocks(newLayout);
        updateProjectSettings(draft => {
            draft.storyCanvasLayoutMode = layoutMode;
            draft.storyCanvasGroupingMode = groupingMode;
            draft.storyCanvasLayoutFingerprint = layoutFingerprint;
            draft.storyCanvasLayoutVersion = getStoryLayoutVersion();
            draft.storyCanvasLayoutWasUserAdjusted = false;
        });
        setHasUnsavedSettings(true);
        if (options?.showToast ?? true) {
            addToast(options?.successMessage ?? 'Layout organized', options?.toastType ?? 'success');
        }
        setStatusBarMessage(options?.statusMessage ?? 'Layout organized.');
        setTimeout(() => setStatusBarMessage(''), 2000);
    } catch (e) {
        console.error("Failed to tidy up layout:", e);
        if (options?.showToast ?? true) {
            addToast('Failed to organize layout', 'error');
        }
        setStatusBarMessage('Error organizing layout.');
    }
  }, [blocks, analysisResult.links, setBlocks, addToast, updateProjectSettings]);

  const handleTidyUp = useCallback((showToast = true) => {
    applyStoryLayout(
      projectSettings.storyCanvasLayoutMode ?? 'flow-lr',
      projectSettings.storyCanvasGroupingMode ?? 'none',
      { showToast },
    );
  }, [applyStoryLayout, projectSettings.storyCanvasGroupingMode, projectSettings.storyCanvasLayoutMode]);

  const handleChangeStoryCanvasLayoutMode = useCallback((mode: StoryCanvasLayoutMode) => {
    updateProjectSettings(draft => {
      draft.storyCanvasLayoutMode = mode;
    });
    setHasUnsavedSettings(true);
    if (blocks.length > 0 && !isAnalysisPending && !isInitialAnalysisPending) {
      const groupingMode = projectSettings.storyCanvasGroupingMode ?? 'none';
      setTimeout(() => {
        applyStoryLayout(mode, groupingMode, {
          showToast: false,
          statusMessage: 'Story layout updated.',
        });
      }, 0);
    }
  }, [
    updateProjectSettings,
    blocks.length,
    isAnalysisPending,
    isInitialAnalysisPending,
    projectSettings.storyCanvasGroupingMode,
    applyStoryLayout,
  ]);

  const handleChangeStoryCanvasGroupingMode = useCallback((mode: StoryCanvasGroupingMode) => {
    updateProjectSettings(draft => {
      draft.storyCanvasGroupingMode = mode;
    });
    setHasUnsavedSettings(true);
    if (blocks.length > 0 && !isAnalysisPending && !isInitialAnalysisPending) {
      const layoutMode = projectSettings.storyCanvasLayoutMode ?? 'flow-lr';
      setTimeout(() => {
        applyStoryLayout(layoutMode, mode, {
          showToast: false,
          statusMessage: 'Story layout updated.',
        });
      }, 0);
    }
  }, [
    updateProjectSettings,
    blocks.length,
    isAnalysisPending,
    isInitialAnalysisPending,
    projectSettings.storyCanvasLayoutMode,
    applyStoryLayout,
  ]);

  const applyRouteLayout = useCallback((
    layoutMode: StoryCanvasLayoutMode,
    groupingMode: StoryCanvasGroupingMode,
    options?: { showToast?: boolean; successMessage?: string; statusMessage?: string; toastType?: ToastMessage['type']; },
  ) => {
    setStatusBarMessage('Organizing route layout...');
    try {
        const sourceNodes = routeAnalysisResult.labelNodes.map(node => ({
            ...node,
            position: routeNodeLayoutCache.get(node.id) ?? node.position,
        }));
        const newLayout = computeRouteCanvasLayout(sourceNodes, routeAnalysisResult.routeLinks, layoutMode, groupingMode);
        const layoutFingerprint = computeRouteCanvasLayoutFingerprint(newLayout, routeAnalysisResult.routeLinks, layoutMode, groupingMode);
        setRouteNodeLayoutCache(new Map(newLayout.map(node => [node.id, node.position])));
        updateProjectSettings(draft => {
            draft.routeCanvasLayoutMode = layoutMode;
            draft.routeCanvasGroupingMode = groupingMode;
            draft.routeCanvasLayoutFingerprint = layoutFingerprint;
            draft.routeCanvasLayoutVersion = getRouteCanvasLayoutVersion();
            draft.routeCanvasLayoutWasUserAdjusted = false;
        });
        setHasUnsavedSettings(true);
        if (options?.showToast ?? true) {
            addToast(options?.successMessage ?? 'Route layout organized', options?.toastType ?? 'success');
        }
        setStatusBarMessage(options?.statusMessage ?? 'Route layout organized.');
        setTimeout(() => setStatusBarMessage(''), 2000);
    } catch (error) {
        console.error('Failed to organize route layout:', error);
        if (options?.showToast ?? true) {
            addToast('Failed to organize route layout', 'error');
        }
        setStatusBarMessage('Error organizing route layout.');
    }
  }, [routeAnalysisResult.labelNodes, routeAnalysisResult.routeLinks, routeNodeLayoutCache, updateProjectSettings, addToast]);

  const handleChangeRouteCanvasLayoutMode = useCallback((mode: StoryCanvasLayoutMode) => {
    updateProjectSettings(draft => {
      draft.routeCanvasLayoutMode = mode;
    });
    setHasUnsavedSettings(true);
    if (routeAnalysisResult.labelNodes.length > 0 && !isAnalysisPending && !isInitialAnalysisPending) {
      const groupingMode = projectSettings.routeCanvasGroupingMode ?? 'none';
      setTimeout(() => {
        applyRouteLayout(mode, groupingMode, {
          showToast: false,
          statusMessage: 'Route layout updated.',
        });
      }, 0);
    }
  }, [
    updateProjectSettings,
    routeAnalysisResult.labelNodes.length,
    isAnalysisPending,
    isInitialAnalysisPending,
    projectSettings.routeCanvasGroupingMode,
    applyRouteLayout,
  ]);

  const handleChangeRouteCanvasGroupingMode = useCallback((mode: StoryCanvasGroupingMode) => {
    updateProjectSettings(draft => {
      draft.routeCanvasGroupingMode = mode;
    });
    setHasUnsavedSettings(true);
    if (routeAnalysisResult.labelNodes.length > 0 && !isAnalysisPending && !isInitialAnalysisPending) {
      const layoutMode = projectSettings.routeCanvasLayoutMode ?? 'flow-lr';
      setTimeout(() => {
        applyRouteLayout(layoutMode, mode, {
          showToast: false,
          statusMessage: 'Route layout updated.',
        });
      }, 0);
    }
  }, [
    updateProjectSettings,
    routeAnalysisResult.labelNodes.length,
    isAnalysisPending,
    isInitialAnalysisPending,
    projectSettings.routeCanvasLayoutMode,
    applyRouteLayout,
  ]);

  const handleChangeChoiceCanvasLayoutMode = useCallback((mode: StoryCanvasLayoutMode) => {
    updateProjectSettings(draft => { draft.choiceCanvasLayoutMode = mode; });
    setHasUnsavedSettings(true);
  }, [updateProjectSettings]);

  const handleChangeChoiceCanvasGroupingMode = useCallback((mode: StoryCanvasGroupingMode) => {
    updateProjectSettings(draft => { draft.choiceCanvasGroupingMode = mode; });
    setHasUnsavedSettings(true);
  }, [updateProjectSettings]);

  useEffect(() => {
    const pendingRefresh = pendingStoryLayoutRefreshRef.current;
    if (!pendingRefresh || blocks.length === 0 || isInitialAnalysisPending || isAnalysisPending) {
        return;
    }
    pendingStoryLayoutRefreshRef.current = null;

    const layoutMode = projectSettings.storyCanvasLayoutMode ?? 'flow-lr';
    const groupingMode = projectSettings.storyCanvasGroupingMode ?? 'none';
    const currentFingerprint = computeStoryLayoutFingerprint(blocks, analysisResult.links, layoutMode, groupingMode);
    const savedVersionMatches = pendingRefresh.savedVersion === getStoryLayoutVersion();
    const shouldRefreshLayout =
      !pendingRefresh.hasSavedLayouts ||
      !pendingRefresh.savedFingerprint ||
      !savedVersionMatches ||
      pendingRefresh.savedFingerprint !== currentFingerprint;

    if (!shouldRefreshLayout) {
      return;
    }

    if (pendingRefresh.hasSavedLayouts && pendingRefresh.savedWasUserAdjusted) {
      updateProjectSettings(draft => {
        draft.storyCanvasLayoutFingerprint = currentFingerprint;
        draft.storyCanvasLayoutVersion = getStoryLayoutVersion();
      });
      setHasUnsavedSettings(true);
      addToast('Story graph changed. Layout preserved; use Redraw to reorganize.', 'info');
      return;
    }

    applyStoryLayout(layoutMode, groupingMode, {
      showToast: pendingRefresh.hasSavedLayouts,
      successMessage: pendingRefresh.hasSavedLayouts
        ? 'Story layout refreshed for changed graph'
        : 'Story layout generated',
      statusMessage: pendingRefresh.hasSavedLayouts
        ? 'Story layout refreshed.'
        : 'Story layout generated.',
      toastType: 'info',
    });
  }, [
    blocks,
    isInitialAnalysisPending,
    isAnalysisPending,
    projectSettings.storyCanvasGroupingMode,
    projectSettings.storyCanvasLayoutMode,
    analysisResult.links,
    applyStoryLayout,
    addToast,
    updateProjectSettings,
  ]);

  useEffect(() => {
    const pendingRefresh = pendingRouteLayoutRefreshRef.current;
    if (!pendingRefresh || isInitialAnalysisPending || isAnalysisPending) {
      return;
    }
    pendingRouteLayoutRefreshRef.current = null;

    const layoutMode = projectSettings.routeCanvasLayoutMode ?? 'flow-lr';
    const groupingMode = projectSettings.routeCanvasGroupingMode ?? 'none';
    const sourceNodes = routeAnalysisResult.labelNodes.map(node => ({
      ...node,
      position: routeNodeLayoutCache.get(node.id) ?? node.position,
    }));
    const currentFingerprint = computeRouteCanvasLayoutFingerprint(sourceNodes, routeAnalysisResult.routeLinks, layoutMode, groupingMode);
    const savedVersionMatches = pendingRefresh.savedVersion === getRouteCanvasLayoutVersion();
    const shouldRefreshLayout =
      !pendingRefresh.hasSavedLayouts ||
      !pendingRefresh.savedFingerprint ||
      !savedVersionMatches ||
      pendingRefresh.savedFingerprint !== currentFingerprint;

    if (!shouldRefreshLayout) {
      return;
    }

    if (pendingRefresh.hasSavedLayouts && pendingRefresh.savedWasUserAdjusted) {
      updateProjectSettings(draft => {
        draft.routeCanvasLayoutFingerprint = currentFingerprint;
        draft.routeCanvasLayoutVersion = getRouteCanvasLayoutVersion();
      });
      setHasUnsavedSettings(true);
      addToast('Route graph changed. Layout preserved; use Redraw to reorganize.', 'info');
      return;
    }

    applyRouteLayout(layoutMode, groupingMode, {
      showToast: pendingRefresh.hasSavedLayouts,
      successMessage: pendingRefresh.hasSavedLayouts
        ? 'Route layout refreshed for changed graph'
        : 'Route layout generated',
      statusMessage: pendingRefresh.hasSavedLayouts
        ? 'Route layout refreshed.'
        : 'Route layout generated.',
      toastType: 'info',
    });
  }, [
    isInitialAnalysisPending,
    isAnalysisPending,
    routeAnalysisResult.labelNodes,
    routeAnalysisResult.routeLinks,
    routeNodeLayoutCache,
    projectSettings.routeCanvasLayoutMode,
    projectSettings.routeCanvasGroupingMode,
    applyRouteLayout,
    addToast,
    updateProjectSettings,
  ]);

  // --- Tab Management Helpers ---
  const handleOpenStaticTab = useCallback((type: 'canvas' | 'route-canvas' | 'choice-canvas' | 'diagnostics' | 'ai-generator' | 'stats') => {
        const id = type;
        // If already open in primary, activate it there
        if (openTabs.find(t => t.id === id)) {
            setActiveTabId(id);
            setActivePaneId('primary');
            return;
        }
        // If already open in secondary, activate it there
        if (secondaryOpenTabs.find(t => t.id === id)) {
            setSecondaryActiveTabId(id);
            setActivePaneId('secondary');
            return;
        }
        // Open in active pane
        if (activePaneId === 'secondary' && splitLayout !== 'none') {
            setSecondaryOpenTabs(prev => [...prev, { id, type }]);
            setSecondaryActiveTabId(id);
        } else {
            setOpenTabs(prev => [...prev, { id, type }]);
            setActiveTabId(id);
        }
  }, [openTabs, secondaryOpenTabs, activePaneId, splitLayout]);

  const handleOpenRouteCanvasTab = useCallback(() => handleOpenStaticTab('route-canvas'), [handleOpenStaticTab]);
  const handleOpenChoiceCanvasTab = useCallback(() => handleOpenStaticTab('choice-canvas'), [handleOpenStaticTab]);

  // --- File System Integration ---
  
  const loadProject = useCallback(async (path: string) => {
      loadCancelRef.current = false;
      setIsLoading(true);
      setLoadingProgress(5);
      setLoadingMessage('Reading project files...');
      setStatusBarMessage(`Loading project from ${path}...`);
      const unsubscribeProgress = window.electronAPI?.onLoadProgress?.((value, message) => {
          setLoadingProgress(value);
          setLoadingMessage(message);
      });
      try {
          const projectData = await window.electronAPI!.loadProject(path);

          // If the user cancelled while the directory was being read, discard results.
          if (loadCancelRef.current) {
              setStatusBarMessage('');
              return;
          }

          setLoadingProgress(93);
          setLoadingMessage(`Processing ${projectData.files.length} files and ${projectData.images.length} images...`);

          const savedStoryBlockLayouts = projectData.settings?.storyBlockLayouts ?? {};
          const savedStoryLayoutMode = projectData.settings?.storyCanvasLayoutMode ?? 'flow-lr';
          const savedStoryGroupingMode = projectData.settings?.storyCanvasGroupingMode ?? 'none';
          const savedRouteNodeLayouts = projectData.settings?.routeNodeLayouts ?? {};
          const savedRouteLayoutMode = projectData.settings?.routeCanvasLayoutMode ?? 'flow-lr';
          const savedRouteGroupingMode = projectData.settings?.routeCanvasGroupingMode ?? 'none';

          // Map existing blocks to preserve IDs and positions
          const existingBlocksMap = new Map<string, Block>();
          // Use ref to get current blocks to avoid stale closures and infinite loop dependency
          blocksRef.current.forEach(b => {
              if (b.filePath) existingBlocksMap.set(b.filePath, b);
          });

          const loadedBlocks: Block[] = projectData.files.map((f, index) => {
              const existing = existingBlocksMap.get(f.path);
              const savedLayout = savedStoryBlockLayouts[f.path];
              return {
                  id: existing ? existing.id : `block-${index}-${Date.now()}`,
                  content: f.content,
                  filePath: f.path,
                  position: savedLayout?.position ?? existing?.position ?? { x: (index % 5) * 350, y: Math.floor(index / 5) * 250 },
                  width: savedLayout?.width ?? existing?.width ?? 320,
                  height: savedLayout?.height ?? existing?.height ?? 200,
                  title: f.path.split('/').pop(),
                  color: savedLayout?.color ?? existing?.color ?? undefined
              };
          });
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
                 const scriptPath = await window.electronAPI.path.join(projectData.rootPath as string, 'script.rpy') as string;
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
          pendingStoryLayoutRefreshRef.current = {
              hasSavedLayouts: Object.keys(savedStoryBlockLayouts).length > 0,
              savedFingerprint: projectData.settings?.storyCanvasLayoutFingerprint,
              savedVersion: projectData.settings?.storyCanvasLayoutVersion,
              savedWasUserAdjusted: projectData.settings?.storyCanvasLayoutWasUserAdjusted ?? false,
          };
          pendingRouteLayoutRefreshRef.current = {
              hasSavedLayouts: Object.keys(savedRouteNodeLayouts).length > 0,
              savedFingerprint: projectData.settings?.routeCanvasLayoutFingerprint,
              savedVersion: projectData.settings?.routeCanvasLayoutVersion,
              savedWasUserAdjusted: projectData.settings?.routeCanvasLayoutWasUserAdjusted ?? false,
          };
          setRouteNodeLayoutCache(new Map(
            Object.entries(savedRouteNodeLayouts).map(([id, layout]) => [id, layout.position]),
          ));
          setFileSystemTree(projectData.tree);
          
          const imgMap = new Map<string, ProjectImage>();
          projectData.images.forEach((img) => {
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
          projectData.audios.forEach((aud) => {
              audioMap.set(aud.path, { 
                  ...aud, 
                  filePath: aud.path,
                  fileName: aud.path.split('/').pop(), 
                  isInProject: true, 
                  fileHandle: null 
              });
          });
          setAudios(audioMap);

          setLoadingProgress(96);
          setLoadingMessage('Restoring workspace...');

          if (projectData.settings) {
              updateProjectSettings(draft => {
                  draft.enableAiFeatures = projectData.settings.enableAiFeatures ?? false;
                  draft.selectedModel = projectData.settings.selectedModel ?? 'gemini-2.5-flash';
                  draft.draftingMode = projectData.settings.draftingMode ?? false;
                  draft.storyCanvasLayoutMode = savedStoryLayoutMode;
                  draft.storyCanvasGroupingMode = savedStoryGroupingMode;
                  draft.storyCanvasLayoutFingerprint = projectData.settings.storyCanvasLayoutFingerprint;
                  draft.storyCanvasLayoutVersion = projectData.settings.storyCanvasLayoutVersion ?? getStoryLayoutVersion();
                  draft.storyCanvasLayoutWasUserAdjusted = projectData.settings.storyCanvasLayoutWasUserAdjusted ?? false;
                  draft.routeCanvasLayoutMode = savedRouteLayoutMode;
                  draft.routeCanvasGroupingMode = savedRouteGroupingMode;
                  draft.routeCanvasLayoutFingerprint = projectData.settings.routeCanvasLayoutFingerprint;
                  draft.routeCanvasLayoutVersion = projectData.settings.routeCanvasLayoutVersion ?? getRouteCanvasLayoutVersion();
                  draft.routeCanvasLayoutWasUserAdjusted = projectData.settings.routeCanvasLayoutWasUserAdjusted ?? false;
              });
              setStickyNotes(projectData.settings.stickyNotes || []);
              setRouteStickyNotes(projectData.settings.routeStickyNotes || []);
              setChoiceStickyNotes(projectData.settings.choiceStickyNotes || []);
              setCharacterProfiles(projectData.settings.characterProfiles || {});
              setPunchlistMetadata(projectData.settings.punchlistMetadata || {});
              // Diagnostics tasks — migrate from old punchlist metadata if needed
              if (projectData.settings.diagnosticsTasks) {
                setDiagnosticsTasks(projectData.settings.diagnosticsTasks);
              } else if (projectData.settings.punchlistMetadata) {
                setDiagnosticsTasks(migratePunchlistToTasks(projectData.settings.punchlistMetadata));
              } else {
                setDiagnosticsTasks([]);
              }
              setIgnoredDiagnostics(projectData.settings.ignoredDiagnostics || []);
              
              // Load Scene Compositions
              // Helper to link saved paths back to loaded image objects
              const rehydrateSprite = (s: SerializedSprite): SceneSprite => {
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

              const rehydrateScene = (sc: SerializedSceneComposition): SceneComposition => ({
                  background: sc.background ? rehydrateSprite(sc.background) : null,
                  sprites: (sc.sprites || []).map(rehydrateSprite),
                  resolution: sc.resolution,
              });

              if (projectData.settings.sceneCompositions) {
                  const restoredScenes: Record<string, SceneComposition> = {};
                  Object.entries(projectData.settings.sceneCompositions).forEach(([id, sc]) => {
                      const comp = sc as unknown as SerializedSceneComposition;
                      restoredScenes[id] = {
                          background: comp.background ? rehydrateSprite(comp.background) : null,
                          sprites: comp.sprites.map(rehydrateSprite),
                          resolution: comp.resolution,
                      };
                  });
                  setSceneCompositions(restoredScenes);
                  setSceneNames(projectData.settings.sceneNames || {});
              } else if ((projectData.settings as unknown as Record<string, unknown>).sceneComposition) {
                  // Migration for legacy single scene (pre-multi-scene format)
                  const defaultId = 'scene-default';
                  setSceneCompositions({ [defaultId]: rehydrateScene((projectData.settings as unknown as Record<string, unknown>).sceneComposition as SerializedSceneComposition) });
                  setSceneNames({ [defaultId]: 'Default Scene' });
              } else {
                  setSceneCompositions({});
                  setSceneNames({});
              }

              // Restore ImageMap Compositions
              if (projectData.settings.imagemapCompositions) {
                  const restoredImagemaps: Record<string, ImageMapComposition> = {};
                  Object.entries(projectData.settings.imagemapCompositions as Record<string, SerializedImageMapComposition>).forEach(([id, im]) => {
                      const groundImg = im.groundImage ? imgMap.get(im.groundImage.filePath) : null;
                      const hoverImg = im.hoverImage ? imgMap.get(im.hoverImage.filePath) : null;
                      restoredImagemaps[id] = {
                          screenName: im.screenName,
                          groundImage: groundImg || null,
                          hoverImage: hoverImg || null,
                          hotspots: im.hotspots
                      };
                  });
                  setImagemapCompositions(restoredImagemaps);
              } else {
                  setImagemapCompositions({});
              }

              // Restore Screen Layout Compositions
              if (projectData.settings.screenLayoutCompositions) {
                  setScreenLayoutCompositions(projectData.settings.screenLayoutCompositions);
              } else {
                  setScreenLayoutCompositions({});
              }

              // Restore Scan Directories
              if (projectData.settings.scannedImagePaths) {
                  const paths = projectData.settings.scannedImagePaths;
                  const map = new Map<string, FileSystemDirectoryHandle>();
                  paths.forEach((p) => map.set(p, null as unknown as FileSystemDirectoryHandle));
                  setImageScanDirectories(map);

                  // Trigger scan
                  if (window.electronAPI) {
                       setIsScanningAssets(true);
                       Promise.all(paths.map((dirPath) =>
                           window.electronAPI!.scanDirectory(dirPath).then(({ images: scanned }) => {
                               setImages(prev => {
                                   const next = new Map(prev);
                                   scanned.forEach((img) => {
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
                           })
                       )).finally(() => setIsScanningAssets(false));
                  }
              }
              
              if (projectData.settings.scannedAudioPaths) {
                  const paths = projectData.settings.scannedAudioPaths;
                  const map = new Map<string, FileSystemDirectoryHandle>();
                  paths.forEach((p) => map.set(p, null as unknown as FileSystemDirectoryHandle));
                  setAudioScanDirectories(map);

                  // Trigger scan
                  if (window.electronAPI) {
                       setIsScanningAssets(true);
                       Promise.all(paths.map((dirPath) =>
                           window.electronAPI!.scanDirectory(dirPath).then(({ audios: scanned }) => {
                               setAudios(prev => {
                                   const next = new Map(prev);
                                   scanned.forEach((aud) => {
                                       if (!next.has(aud.path)) {
                                           // Check if this file exists in the project
                                           const fileName = aud.path.split('/').pop();
                                           const potentialProjectPath = `game/audio/${fileName}`;
                                           const linkedPath = next.has(potentialProjectPath) ? potentialProjectPath : undefined;

                                           // Ensure external audio also have filePath set correctly
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
                           })
                       )).finally(() => setIsScanningAssets(false));
                  }
              }

              const savedTabs: EditorTab[] = projectData.settings.openTabs ?? [{ id: 'canvas', type: 'canvas' }];

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
                      return true; // deferred — worker analysis validates at render time
                  }
                  if (tab.type === 'scene-composer' && tab.sceneId) {
                      // We allow opening even if not strictly in state yet (might be migrated)
                      return true;
                  }
                  if (tab.type === 'markdown' && tab.filePath) {
                      return true; // File existence checked on tab render
                  }
                  return tab.type === 'canvas' || tab.type === 'route-canvas' || tab.type === 'choice-canvas' || tab.type === 'punchlist' || tab.type === 'diagnostics' || tab.type === 'ai-generator' || tab.type === 'stats';
              });

              const rehydratedTabs = validTabs.map(tab => {
                  if (tab.type === 'editor' && tab.filePath) {
                      const matchingBlock = blockFilePathMap.get(tab.filePath);
                      if (matchingBlock) {
                          return { ...tab, id: matchingBlock.id, blockId: matchingBlock.id };
                      }
                  }
                  // Migrate old punchlist tab to diagnostics
                  if (tab.type === 'punchlist' || tab.id === 'punchlist') {
                      return { ...tab, type: 'diagnostics' as const, id: 'diagnostics' };
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

              // Restore split state
              const savedSplitLayout = projectData.settings.splitLayout ?? 'none';
              const savedSecondary: EditorTab[] = projectData.settings.secondaryOpenTabs ?? [];
              const validSecondary = savedSecondary.filter((tab: EditorTab) => {
                  if (tab.type === 'editor' && tab.filePath) return blockFilePathMap.has(tab.filePath);
                  if (tab.type === 'image' && tab.filePath) return imgMap.has(tab.filePath);
                  if (tab.type === 'audio' && tab.filePath) return audioMap.has(tab.filePath);
                  if (tab.type === 'character' && tab.characterTag) return true;
                  if (tab.type === 'markdown' && tab.filePath) return true;
                  return tab.type === 'canvas' || tab.type === 'route-canvas' || tab.type === 'choice-canvas' || tab.type === 'punchlist' || tab.type === 'diagnostics' || tab.type === 'ai-generator' || tab.type === 'stats' || tab.type === 'scene-composer';
              });
              setSplitLayout(validSecondary.length > 0 ? savedSplitLayout : 'none');
              setSplitPrimarySize(projectData.settings.splitPrimarySize ?? 600);
              setSecondaryOpenTabs(validSecondary);
              const savedSecondaryActive = projectData.settings.secondaryActiveTabId ?? '';
              setSecondaryActiveTabId(validSecondary.some((t: EditorTab) => t.id === savedSecondaryActive) ? savedSecondaryActive : validSecondary[0]?.id ?? '');

          } else {
              updateProjectSettings(draft => {
                  draft.enableAiFeatures = false;
                  draft.selectedModel = 'gemini-2.5-flash';
                  draft.draftingMode = false;
                  draft.storyCanvasLayoutMode = 'flow-lr';
                  draft.storyCanvasGroupingMode = 'none';
                  draft.storyCanvasLayoutFingerprint = undefined;
                  draft.storyCanvasLayoutVersion = getStoryLayoutVersion();
                  draft.storyCanvasLayoutWasUserAdjusted = false;
                  draft.routeCanvasLayoutMode = 'flow-lr';
                  draft.routeCanvasGroupingMode = 'none';
                  draft.routeCanvasLayoutFingerprint = undefined;
                  draft.routeCanvasLayoutVersion = getRouteCanvasLayoutVersion();
                  draft.routeCanvasLayoutWasUserAdjusted = false;
              });
              setRouteNodeLayoutCache(new Map());
              setOpenTabs([{ id: 'canvas', type: 'canvas' }]);
              setActiveTabId('canvas');
              setSplitLayout('none');
              setSecondaryOpenTabs([]);
              setSecondaryActiveTabId('');
              setStickyNotes([]);
              setRouteStickyNotes([]);
              setChoiceStickyNotes([]);
              setCharacterProfiles({});
              setPunchlistMetadata({});
              setDiagnosticsTasks([]);
              setIgnoredDiagnostics([]);
              setSceneCompositions({});
              setSceneNames({});
          }
          
          setLoadingProgress(99);
          setLoadingMessage('Done');
          setIsInitialAnalysisPending(true);
          setHasUnsavedSettings(false);
          addToast('Project loaded successfully', 'success');
          setStatusBarMessage('Project loaded.');
          setTimeout(() => setStatusBarMessage(''), 3000);
      } catch (err) {
          if (loadCancelRef.current) {
              setStatusBarMessage('');
              return;
          }
          console.error(err);
          addToast('Failed to load project', 'error');
          setStatusBarMessage('Error loading project.');
      } finally {
          unsubscribeProgress?.();
          setIsLoading(false);
          setLoadingMessage('');
          setLoadingProgress(0);
      }
  }, [setBlocks, setImages, setAudios, updateProjectSettings, addToast, setFileSystemTree, setStickyNotes, setCharacterProfiles, updateAppSettings, setSceneCompositions, setSceneNames, setPunchlistMetadata, setImagemapCompositions, setScreenLayoutCompositions, setDiagnosticsTasks, setIgnoredDiagnostics]);


  const handleCancelLoad = useCallback(() => {
      loadCancelRef.current = true;
      window.electronAPI?.cancelProjectLoad?.();
      // Close the overlay immediately — don't wait for the IPC to reject.
      // The loadProject finally block will also call setIsLoading(false) harmlessly.
      setIsLoading(false);
      setLoadingMessage('');
      setLoadingProgress(0);
      addToast('Project loading cancelled.', 'info');
  }, [addToast]);

  // Checks whether the selected folder looks like a Ren'Py project before loading.
  // If it doesn't (no game/ folder, no .rpy files), shows a confirmation warning first.
  const handleOpenWithRenpyCheck = useCallback(async (path: string) => {
      try {
          if (window.electronAPI?.checkRenpyProject) {
              const check = await window.electronAPI.checkRenpyProject(path);
              if (!check.isRenpyProject) {
                  setNonRenpyWarningPath(path);
                  return;
              }
          }
          await loadProject(path);
      } catch (err) {
          console.error('Failed to open project:', err);
          addToast('Failed to open project', 'error');
      }
  }, [loadProject, addToast]);

  const handleOpenProjectFolder = useCallback(async () => {
    try {
        if (window.electronAPI) {
            const path = await window.electronAPI.openDirectory();
            if (path) {
                await handleOpenWithRenpyCheck(path);
            }
        } else {
            addToast('Local file system features require the Electron app or a compatible browser with File System Access support.', 'warning');
        }
    } catch (err) {
        console.error(err);
        addToast('Failed to open project', 'error');
    }
  }, [handleOpenWithRenpyCheck, addToast]);

  const handleCreateProject = useCallback(() => {
      // Open the new project wizard modal
      setWizardModalOpen(true);
  }, []);

  const handleWizardComplete = useCallback(async (projectPath: string) => {
      setWizardModalOpen(false);
      try {
          await loadProject(projectPath);
          addToast('Project created successfully', 'success');
      } catch (err) {
          console.error(err);
          addToast('Failed to load the newly created project', 'error');
      }
  }, [loadProject, addToast]);

  // --- Stable callbacks for ImageEditorView / AudioEditorView tabs ---
  // These are extracted from the inline renderTabContent so React.memo on the
  // tab components can bail out when switching tabs (instead of re-rendering
  // with 14,000 image DOM nodes every time).
  const handleUpdateImageMetadata = useCallback((path: string, newMeta: ImageMetadata) => {
      setImageMetadata(prev => {
          const next = new Map(prev);
          next.set(path, newMeta);
          return next;
      });
      setHasUnsavedSettings(true);
  }, []);

  const handleCopyImageToProject = useCallback(async (sourcePath: string, meta: ImageMetadata) => {
      try {
          if (window.electronAPI && projectRootPath) {
              const fileName = sourcePath.split('/').pop() || 'image.png';
              const subfolder = meta.projectSubfolder || '';
              const destDir = await window.electronAPI.path.join(projectRootPath, 'game', 'images', subfolder);
              const destPath = await window.electronAPI.path.join(destDir, fileName);
              await window.electronAPI.copyEntry(sourcePath, destPath);
              await loadProject(projectRootPath);
          }
      } catch (err) {
          console.error('Failed to copy image to project:', err);
          addToast('Failed to copy image to project', 'error');
      }
  }, [projectRootPath, loadProject, addToast]);

  const handleUpdateAudioMetadata = useCallback((path: string, newMeta: AudioMetadata) => {
      setAudioMetadata(prev => {
          const next = new Map(prev);
          next.set(path, newMeta);
          return next;
      });
      setHasUnsavedSettings(true);
  }, []);

  const handleCopyAudioToProject = useCallback(async (sourcePath: string, meta: AudioMetadata) => {
      try {
          if (window.electronAPI && projectRootPath) {
              const fileName = sourcePath.split('/').pop() || 'audio.ogg';
              const subfolder = meta.projectSubfolder || '';
              const destDir = await window.electronAPI.path.join(projectRootPath, 'game', 'audio', subfolder);
              const destPath = await window.electronAPI.path.join(destDir, fileName);
              await window.electronAPI.copyEntry(sourcePath, destPath);
              await loadProject(projectRootPath);
          }
      } catch (err) {
          console.error('Failed to copy audio to project:', err);
          addToast('Failed to copy audio to project', 'error');
      }
  }, [projectRootPath, loadProject, addToast]);

  // --- Drafting Mode Logic ---
  const updateDraftingArtifacts = useCallback(async () => {
      if (!projectRootPath || !window.electronAPI || !projectSettings.draftingMode) return;

      try {
      const missingImages = new Set<string>();
      const missingAudioFiles = new Set<string>();
      const missingAudioVariables = new Set<string>();

      // 1. Scan Blocks for missing references
      blocks.forEach(block => {
          // Do not parse the placeholder file itself
          if (block.filePath && (block.filePath.endsWith('debug_placeholders.rpy') || block.filePath === 'game/debug_placeholders.rpy')) return;

          const lines = block.content.split('\n');
          lines.forEach(line => {
              const trimmed = line.trim();
              if (trimmed.startsWith('#')) return;

              // Images: show/scene <tag>
              const showMatch = trimmed.match(/^\s*(?:show|scene)\s+(.+)/);
              if (showMatch) {
                  const rest = showMatch[1];
                  const parts = rest.split(/\s+/);
                  
                  if (parts[0] !== 'expression') {
                      const tagParts: string[] = [];
                      for (const part of parts) {
                          if (['with', 'at', 'as', 'behind', 'zorder', 'on', ':', 'fade', 'in', 'out', 'dissolve', 'zoom', 'alpha', 'rotate', 'align', 'pos', 'anchor', 'xpos', 'ypos', 'xanchor', 'yanchor'].includes(part)) break;
                          if (part.endsWith(':')) {
                              tagParts.push(part.slice(0, -1));
                              break;
                          }
                          tagParts.push(part);
                      }
                      
                      if (tagParts.length > 0) {
                          const tag = tagParts.join(' ');
                          const firstWord = tagParts[0];
                          
                          const isDefined = 
                              analysisResult.definedImages.has(firstWord) || 
                              existingImageTags.has(tag) || 
                              existingImageTags.has(firstWord);

                          if (!isDefined) missingImages.add(tag);
                      }
                  }
              }

              // Audio: play/queue <channel> <file>
              const audioLineRegex = /^\s*(?:play|queue)\s+\w+\s+(.+)/;
              const audMatch = trimmed.match(audioLineRegex);
              
              if (audMatch) {
                  const content = audMatch[1].trim();
                  
                  // Case A: Quoted string -> explicit file path
                  const quotedMatch = content.match(/^["']([^"']+)["']/);
                  if (quotedMatch) {
                      const path = quotedMatch[1];
                      let found = false;
                      if (existingAudioPaths.has(path)) found = true;
                      else {
                          // Check fuzzy match against known audio
                          for (const existing of existingAudioPaths) {
                              if (existing.endsWith(path)) { found = true; break; }
                          }
                      }
                      if (!found) missingAudioFiles.add(path);
                  } 
                  // Case B: Unquoted -> variable or identifier
                  else {
                      // Grab the first token, stop before keywords like 'fadein', 'loop', etc.
                      const firstToken = content.split(/\s+/)[0];
                      
                      if (firstToken !== 'expression') {
                          // It's likely a variable. Check if it's a valid identifier.
                          if (/^[a-zA-Z0-9_]+$/.test(firstToken)) {
                              // If it's not defined in the project, mark as missing variable
                              let isDefined = false;
                              if (analysisResult.variables.has(firstToken)) isDefined = true;
                              // Also check if it happens to be an auto-defined audio file (Ren'Py does this for audio/ directory)
                              if (existingAudioPaths.has(firstToken)) isDefined = true;

                              if (!isDefined) {
                                  missingAudioVariables.add(firstToken);
                              }
                          }
                      }
                  }
              }
          });
      });

      // 2. Generate Content
      let rpyContent: string = `# Auto-generated by Ren'IDE Drafting Mode\n# This file provides placeholders for missing assets.\n\n`;
      
      missingImages.forEach(tag => {
          rpyContent += `image ${tag} = Placeholder("text", text="${tag}")\n`;
      });

      // Generate default variable definitions for missing audio variables
      missingAudioVariables.forEach(varName => {
          rpyContent += `default ${varName} = "renide_assets/placeholder_audio.wav"\n`;
      });

      // Ensure dummy audio file exists if we have ANY audio issues
      if (missingAudioFiles.size > 0 || missingAudioVariables.size > 0) {
          const audioDir = await window.electronAPI.path.join(projectRootPath, 'game/renide_assets');
          await window.electronAPI.createDirectory(audioDir);
          const audioPath = await window.electronAPI.path.join(audioDir, 'placeholder_audio.wav');
          await window.electronAPI.writeFile(audioPath, SILENT_WAV_BASE64, 'base64');

          // Injecting a callback to handle missing audio files (QUOTED STRINGS)
          // This callback intercepts file paths that Ren'Py fails to load.
          rpyContent += `\ninit python:\n`;
          rpyContent += `    if not hasattr(store, 'renide_audio_callback_installed'):\n`;
          rpyContent += `        store.renide_audio_callback_installed = True\n`;
          rpyContent += `        def renide_audio_filter(fn):\n`;
          rpyContent += `            if fn and renpy.loadable(fn):\n`;
          rpyContent += `                return fn\n`;
          rpyContent += `            # If missing, return placeholder\n`;
          rpyContent += `            return "renide_assets/placeholder_audio.wav"\n`;
          rpyContent += `        config.audio_filename_callback = renide_audio_filter\n`;
      }

      // 3. Write File
      const rpyPath = await window.electronAPI.path.join(projectRootPath as string, 'game/debug_placeholders.rpy');
      await window.electronAPI.writeFile(rpyPath, rpyContent);

      } catch (err) {
          console.error('Failed to update drafting artifacts:', err);
      }
  }, [blocks, projectRootPath, projectSettings.draftingMode, analysisResult.definedImages, analysisResult.variables, existingImageTags, existingAudioPaths]);

  const cleanupDraftingArtifacts = useCallback(async () => {
      if (!projectRootPath || !window.electronAPI) return;

      try {
          const rpyPath = await window.electronAPI.path.join(String(projectRootPath), 'game/debug_placeholders.rpy') as string;
          await window.electronAPI.removeEntry(rpyPath);

          const rpycPath = await window.electronAPI.path.join(String(projectRootPath), 'game/debug_placeholders.rpyc') as string;
          await window.electronAPI.removeEntry(rpycPath);
      } catch (err) {
          console.error('Failed to clean up drafting artifacts:', err);
      }
      // We leave the renide_assets folder as it might contain valid cache or be reused
  }, [projectRootPath]);

  const handleToggleDraftingMode = async (enabled: boolean) => {
      updateProjectSettings(draft => { draft.draftingMode = enabled; });
      setHasUnsavedSettings(true); // Persist this choice
      
      if (enabled) {
          addToast('Drafting Mode Enabled: Placeholders will be generated.', 'info');
      } else {
          addToast('Drafting Mode Disabled: Placeholders removed.', 'info');
          await cleanupDraftingArtifacts();
      }
  };

  // React to Drafting Mode changes or Block saves to update placeholders
  useEffect(() => {
      if (projectSettings.draftingMode) {
          updateDraftingArtifacts();
      }
  }, [projectSettings.draftingMode, blocks, updateDraftingArtifacts]);

  const syncEditorToStateAndMarkDirty = useCallback((blockId: string, content: string) => {
    // Update block content in React state
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content } : b));
    
    // The editor is gone, so remove it from dirtyEditors...
    setDirtyEditors(prev => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
    });
    // ...but add it to dirtyBlockIds because it's still not saved to disk.
    setDirtyBlockIds(prev => new Set(prev).add(blockId));
  }, [setBlocks]);

  const handleSaveBlock = useCallback(async (blockId: string) => {
    const editor = editorInstances.current.get(blockId);
    if (!editor) return;

    const contentToSave = editor.getValue();

    // Save to disk first
    try {
    if (window.electronAPI && projectRootPath) {
        const block = blocksRef.current.find(b => b.id === blockId);
        if (block && block.filePath) {
             const absPath = await window.electronAPI.path.join(projectRootPath, block.filePath) as string;
             const res = await window.electronAPI.writeFile(absPath, contentToSave);
             if (res.success) {
                 addToast(`Saved ${block.title || 'file'}`, 'success');
             } else {
                 addToast(`Failed to save: ${String(res.error)}`, 'error');
                 return; // Abort if saving failed
             }
        }
    }

    // After successful save, update state and clear dirty flags.
    // This ensures React state matches the saved state on disk.
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content: contentToSave } : b));
    
    // Clear ALL dirty flags for this block.
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

    if (projectSettings.draftingMode) {
        updateDraftingArtifacts();
    }

    } catch (err) {
        console.error('Failed to save block:', err);
        addToast('Failed to save file', 'error');
    }
  }, [projectRootPath, projectSettings.draftingMode, addToast, setBlocks, updateDraftingArtifacts]);
  
  const handleSaveProjectSettings = useCallback(async () => {
    if (!projectRootPath || !window.electronAPI) return;
    try {
      // Serialize scenes: map images to just their paths to avoid circular refs and huge files
      const serializeSprite = (s: SceneSprite): SerializedSprite => ({
          ...s,
          image: { filePath: s.image.filePath }
      });

      const serializableScenes: Record<string, SerializedSceneComposition> = {};
      Object.entries(sceneCompositions).forEach(([id, sc]) => {
          serializableScenes[id] = {
              background: sc.background ? serializeSprite(sc.background) : null,
              sprites: sc.sprites.map(serializeSprite),
              resolution: sc.resolution,
          };
      });

      // Serialize imagemaps: map images to just their paths
      const serializableImagemaps: Record<string, SerializedImageMapComposition> = {};
      Object.entries(imagemapCompositions).forEach(([id, im]) => {
          serializableImagemaps[id] = {
              screenName: im.screenName,
              groundImage: im.groundImage ? { filePath: im.groundImage.filePath } : null,
              hoverImage: im.hoverImage ? { filePath: im.hoverImage.filePath } : null,
              hotspots: im.hotspots
          };
      });

      const settingsToSave: ProjectSettings = {
        ...projectSettings,
        storyBlockLayouts: buildSavedStoryBlockLayouts(blocks),
        routeNodeLayouts: Object.fromEntries(
          Array.from(routeNodeLayoutCache.entries()).map(([id, position]) => [id, { position }]),
        ),
        openTabs,
        activeTabId,
        splitLayout,
        splitPrimarySize,
        secondaryOpenTabs,
        secondaryActiveTabId,
        stickyNotes: Array.from(stickyNotes),
        routeStickyNotes: Array.from(routeStickyNotes),
        choiceStickyNotes: Array.from(choiceStickyNotes),
        characterProfiles,
        punchlistMetadata,
        diagnosticsTasks,
        ignoredDiagnostics,
        sceneCompositions: serializableScenes as unknown as Record<string, SceneComposition>,
        sceneNames,
        imagemapCompositions: serializableImagemaps,
        screenLayoutCompositions,
        scannedImagePaths: Array.from(imageScanDirectories.keys()),
        scannedAudioPaths: Array.from(audioScanDirectories.keys()),
      };
      const settingsPath = await window.electronAPI.path.join(projectRootPath as string, 'game/project.ide.json') as string;
      await window.electronAPI.writeFile(settingsPath, JSON.stringify(settingsToSave, null, 2));
      setHasUnsavedSettings(false);
    } catch (e) {
      console.error("Failed to save IDE settings:", e);
      addToast('Failed to save workspace settings', 'error');
    }
  }, [projectRootPath, projectSettings, blocks, routeNodeLayoutCache, openTabs, activeTabId, splitLayout, splitPrimarySize, secondaryOpenTabs, secondaryActiveTabId, stickyNotes, characterProfiles, addToast, sceneCompositions, sceneNames, imagemapCompositions, screenLayoutCompositions, imageScanDirectories, audioScanDirectories, punchlistMetadata, diagnosticsTasks, ignoredDiagnostics]);


  const handleSaveAll = useCallback(async () => {
    setSaveStatus('saving');
    setStatusBarMessage('Saving files...');
    try {
        const currentBlocks = [...blocks];
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
                    const absPath = await window.electronAPI.path.join(projectRootPath!, block.filePath) as string;
                    const res = await window.electronAPI.writeFile(absPath, block.content);
                    if (!res.success) throw new Error((res.error as string) || 'Unknown error saving file');
                }
            }
            // Update placeholders if needed on save all
            if (projectSettings.draftingMode) {
                // We need to wait for the block updates to settle, but we passed currentBlocks to save function.
                // updateDraftingArtifacts uses 'blocks' from scope, which might be stale inside this callback if not careful.
                // But the useEffect hook on blocks + draftingMode will catch the state update and run it.
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
  }, [blocks, dirtyEditors, dirtyBlockIds, projectRootPath, directoryHandle, addToast, setBlocks, handleSaveProjectSettings, projectSettings.draftingMode]);
  
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

    // If already in primary, activate there
    if (openTabs.find(t => t.id === blockId)) {
        if (line) setOpenTabs(prev => prev.map(t => t.id === blockId ? { ...t, scrollRequest: { line, key: Date.now() } } : t));
        setActiveTabId(blockId);
        setActivePaneId('primary');
        return;
    }
    // If already in secondary, activate there
    if (secondaryOpenTabs.find(t => t.id === blockId)) {
        if (line) setSecondaryOpenTabs(prev => prev.map(t => t.id === blockId ? { ...t, scrollRequest: { line, key: Date.now() } } : t));
        setSecondaryActiveTabId(blockId);
        setActivePaneId('secondary');
        return;
    }
    // Open in active pane
    const newTab: EditorTab = { id: blockId, type: 'editor', blockId, filePath: block.filePath, scrollRequest: line ? { line, key: Date.now() } : undefined };
    if (activePaneId === 'secondary' && splitLayout !== 'none') {
        setSecondaryOpenTabs(prev => [...prev, newTab]);
        setSecondaryActiveTabId(blockId);
    } else {
        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabId(blockId);
    }
  }, [blocks, openTabs, secondaryOpenTabs, activePaneId, splitLayout]);

  const handleOpenImageEditorTab = useCallback((filePath: string) => {
    const tabId = `img-${filePath}`;
    if (openTabs.find(t => t.id === tabId)) { setActiveTabId(tabId); setActivePaneId('primary'); return; }
    if (secondaryOpenTabs.find(t => t.id === tabId)) { setSecondaryActiveTabId(tabId); setActivePaneId('secondary'); return; }
    const newTab: EditorTab = { id: tabId, type: 'image', filePath };
    if (activePaneId === 'secondary' && splitLayout !== 'none') {
        setSecondaryOpenTabs(prev => [...prev, newTab]);
        setSecondaryActiveTabId(tabId);
    } else {
        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabId(tabId);
    }
  }, [openTabs, secondaryOpenTabs, activePaneId, splitLayout]);

  const handleOpenMarkdownTab = useCallback((filePath: string) => {
    const tabId = `md-${filePath}`;
    if (openTabs.find(t => t.id === tabId)) { setActiveTabId(tabId); setActivePaneId('primary'); return; }
    if (secondaryOpenTabs.find(t => t.id === tabId)) { setSecondaryActiveTabId(tabId); setActivePaneId('secondary'); return; }
    const newTab: EditorTab = { id: tabId, type: 'markdown', filePath };
    if (activePaneId === 'secondary' && splitLayout !== 'none') {
        setSecondaryOpenTabs(prev => [...prev, newTab]);
        setSecondaryActiveTabId(tabId);
    } else {
        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabId(tabId);
    }
  }, [openTabs, secondaryOpenTabs, activePaneId, splitLayout]);

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
    } else if (lowerFilePath.endsWith('.md')) {
      handleOpenMarkdownTab(filePath);
    }
  }, [blocks, handleOpenEditor, handleOpenImageEditorTab, handleOpenMarkdownTab]);

  const handleCloseTab = useCallback((tabId: string, paneId: 'primary' | 'secondary', e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (paneId === 'primary') {
        setOpenTabs(prev => {
            const next = prev.filter(t => t.id !== tabId);
            if (activeTabId === tabId) {
                // Find adjacent tab: prefer next, then previous
                const closedIdx = prev.findIndex(t => t.id === tabId);
                const fallback = next[closedIdx] ?? next[closedIdx - 1] ?? next[0];
                setActiveTabId(fallback?.id ?? '');
            }
            return next;
        });
    } else {
        setSecondaryOpenTabs(prev => {
            const next = prev.filter(t => t.id !== tabId);
            if (next.length === 0) {
                // Auto-close pane when last secondary tab removed
                setSplitLayout('none');
                setActivePaneId('primary');
                setSecondaryActiveTabId('');
            } else {
                if (secondaryActiveTabId === tabId) setSecondaryActiveTabId(next[next.length - 1].id);
            }
            return next;
        });
    }
  }, [activeTabId, secondaryActiveTabId]);

  const handleTabContextMenu = useCallback((e: React.MouseEvent, tabId: string, paneId: 'primary' | 'secondary' = 'primary') => {
      e.preventDefault();
      setContextMenuInfo({ x: e.clientX, y: e.clientY, tabId, paneId });
  }, []);

  const processTabCloseRequest = useCallback((tabsToClose: EditorTab[], fallbackTabId: string, paneId: 'primary' | 'secondary' = 'primary') => {
    if (tabsToClose.length === 0) return;

    const hasUnsaved = tabsToClose.some(t => t.blockId && (dirtyBlockIds.has(t.blockId) || dirtyEditors.has(t.blockId)));

    const performClose = () => {
        const idsToClose = new Set(tabsToClose.map(t => t.id));
        if (paneId === 'primary') {
            setOpenTabs(prev => {
                const next = prev.filter(t => !idsToClose.has(t.id));
                if (idsToClose.has(activeTabId)) {
                    // Use the explicit fallback if it's still open, otherwise pick adjacent
                    if (fallbackTabId && !idsToClose.has(fallbackTabId)) {
                        setActiveTabId(fallbackTabId);
                    } else {
                        const closedIdx = prev.findIndex(t => t.id === activeTabId);
                        const adjacent = next[closedIdx] ?? next[closedIdx - 1] ?? next[0];
                        setActiveTabId(adjacent?.id ?? '');
                    }
                }
                return next;
            });
        } else {
            setSecondaryOpenTabs(prev => {
                const next = prev.filter(t => !idsToClose.has(t.id));
                if (next.length === 0) { setSplitLayout('none'); setActivePaneId('primary'); setSecondaryActiveTabId(''); }
                else if (idsToClose.has(secondaryActiveTabId)) setSecondaryActiveTabId(next[0].id);
                return next;
            });
        }
    };

    if (hasUnsaved) {
        setUnsavedChangesModalInfo({
            title: `Close ${tabsToClose.length > 1 ? 'Tabs' : 'Tab'}`,
            message: `You have unsaved changes in ${tabsToClose.length > 1 ? 'some tabs' : 'this tab'}. Do you want to save them before closing?`,
            confirmText: 'Save & Close',
            dontSaveText: "Don't Save & Close",
            onConfirm: async () => {
                await handleSaveAll();
                performClose();
                setUnsavedChangesModalInfo(null);
            },
            onDontSave: () => {
                // Clear dirty state for closed tabs without saving
                const blockIdsToClean = tabsToClose.map(t => t.blockId).filter(Boolean) as string[];
                setDirtyBlockIds(prev => {
                    const next = new Set(prev);
                    blockIdsToClean.forEach(id => next.delete(id));
                    return next;
                });
                 setDirtyEditors(prev => {
                    const next = new Set(prev);
                    blockIdsToClean.forEach(id => next.delete(id));
                    return next;
                });
                performClose();
                setUnsavedChangesModalInfo(null);
            },
            onCancel: () => {
                setUnsavedChangesModalInfo(null);
            }
        });
    } else {
        performClose();
    }
}, [dirtyBlockIds, dirtyEditors, activeTabId, secondaryActiveTabId, handleSaveAll]);

  const handleCloseOthersRequest = useCallback((tabId: string, paneId: 'primary' | 'secondary' = 'primary') => {
    const tabs = paneId === 'primary' ? openTabs : secondaryOpenTabs;
    const tabsToClose = tabs.filter(t => t.id !== tabId && t.id !== 'ai-generator');
    processTabCloseRequest(tabsToClose, tabId, paneId);
  }, [openTabs, secondaryOpenTabs, processTabCloseRequest]);

  const handleCloseAllRequest = useCallback((paneId: 'primary' | 'secondary' = 'primary') => {
    const tabs = paneId === 'primary' ? openTabs : secondaryOpenTabs;
    const tabsToClose = tabs.filter(t => t.id !== 'ai-generator');
    // Find the first tab that isn't being closed as fallback; otherwise empty
    const fallback = tabs.find(t => t.id === 'ai-generator')?.id ?? '';
    processTabCloseRequest(tabsToClose, fallback, paneId);
  }, [openTabs, secondaryOpenTabs, processTabCloseRequest]);

  const handleCloseLeftRequest = useCallback((tabId: string, paneId: 'primary' | 'secondary' = 'primary') => {
    const tabs = paneId === 'primary' ? openTabs : secondaryOpenTabs;
    const index = tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;
    const tabsToClose = tabs.slice(0, index).filter(t => t.id !== 'ai-generator');
    processTabCloseRequest(tabsToClose, tabId, paneId);
  }, [openTabs, secondaryOpenTabs, processTabCloseRequest]);

  const handleCloseRightRequest = useCallback((tabId: string, paneId: 'primary' | 'secondary' = 'primary') => {
    const tabs = paneId === 'primary' ? openTabs : secondaryOpenTabs;
    const index = tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;
    const tabsToClose = tabs.slice(index + 1).filter(t => t.id !== 'ai-generator');
    processTabCloseRequest(tabsToClose, tabId, paneId);
  }, [openTabs, secondaryOpenTabs, processTabCloseRequest]);

  const handleSwitchTab = (tabId: string, paneId: 'primary' | 'secondary' = 'primary') => {
    if (paneId === 'primary') { setActiveTabId(tabId); setActivePaneId('primary'); }
    else { setSecondaryActiveTabId(tabId); setActivePaneId('secondary'); }
  };

  // --- Split Pane Management ---
  const handleCreateSplit = useCallback((direction: 'right' | 'bottom') => {
    if (splitLayout !== 'none') return;
    const activeTab = openTabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    // Move the active tab to secondary so canvas/route-canvas are never duplicated across both panes
    const remaining = openTabs.filter(t => t.id !== activeTabId);
    setOpenTabs(remaining);
    if (remaining.length > 0) {
      const fallback = remaining.find(t => t.type === 'canvas') ?? remaining[0];
      setActiveTabId(fallback.id);
    }
    setSecondaryOpenTabs([activeTab]);
    setSecondaryActiveTabId(activeTab.id);
    setSplitLayout(direction);
    setSplitPrimarySize(direction === 'right' ? 600 : 400);
    setActivePaneId('secondary');
  }, [splitLayout, openTabs, activeTabId]);

  const handleOpenInSplit = useCallback((tabId: string, direction: 'right' | 'bottom') => {
    const tab = openTabs.find(t => t.id === tabId);
    if (!tab) return;
    if (splitLayout !== 'none') {
      // Already split — move to secondary
      if (!secondaryOpenTabs.find(t => t.id === tabId)) setSecondaryOpenTabs(prev => [...prev, tab]);
      setSecondaryActiveTabId(tabId);
      setOpenTabs(prev => prev.filter(t => t.id !== tabId));
      if (activeTabId === tabId) setActiveTabId('canvas');
      setActivePaneId('secondary');
      return;
    }
    // Create split and move tab to secondary
    setOpenTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) setActiveTabId('canvas');
    setSecondaryOpenTabs([tab]);
    setSecondaryActiveTabId(tabId);
    setSplitLayout(direction);
    setSplitPrimarySize(direction === 'right' ? 600 : 400);
    setActivePaneId('secondary');
  }, [openTabs, activeTabId, secondaryOpenTabs, splitLayout]);

  const handleMoveToOtherPane = useCallback((tabId: string, fromPaneId: 'primary' | 'secondary') => {
    if (fromPaneId === 'primary') {
      const tab = openTabs.find(t => t.id === tabId);
      if (!tab) return;
      setOpenTabs(prev => prev.filter(t => t.id !== tabId));
      if (activeTabId === tabId) setActiveTabId('canvas');
      if (!secondaryOpenTabs.find(t => t.id === tabId)) setSecondaryOpenTabs(prev => [...prev, tab]);
      setSecondaryActiveTabId(tabId);
      setActivePaneId('secondary');
    } else {
      const tab = secondaryOpenTabs.find(t => t.id === tabId);
      if (!tab) return;
      const newSecondary = secondaryOpenTabs.filter(t => t.id !== tabId);
      if (newSecondary.length === 0) {
        setSecondaryOpenTabs([]);
        setSecondaryActiveTabId('');
        setSplitLayout('none');
        setActivePaneId('primary');
      } else {
        setSecondaryOpenTabs(newSecondary);
        if (secondaryActiveTabId === tabId) setSecondaryActiveTabId(newSecondary[0].id);
      }
      if (!openTabs.find(t => t.id === tabId)) setOpenTabs(prev => [...prev, tab]);
      setActiveTabId(tabId);
      setActivePaneId('primary');
    }
  }, [openTabs, activeTabId, secondaryOpenTabs, secondaryActiveTabId]);

  const handleCloseSecondaryPane = useCallback(() => {
    // Merge secondary tabs into primary (skip any already present) so nothing is lost
    if (secondaryOpenTabs.length > 0) {
      setOpenTabs(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const toAdd = secondaryOpenTabs.filter(t => !existingIds.has(t.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    }
    setSecondaryOpenTabs([]);
    setSecondaryActiveTabId('');
    setSplitLayout('none');
    setActivePaneId('primary');
  }, [secondaryOpenTabs]);

  const handleClosePrimaryPane = useCallback(() => {
    // Promote secondary pane to primary; append any unique primary tabs after it
    const existingIds = new Set(secondaryOpenTabs.map(t => t.id));
    const uniquePrimaryTabs = openTabs.filter(t => !existingIds.has(t.id));
    setOpenTabs([...secondaryOpenTabs, ...uniquePrimaryTabs]);
    setActiveTabId(secondaryActiveTabId || secondaryOpenTabs[0]?.id || 'canvas');
    setSecondaryOpenTabs([]);
    setSecondaryActiveTabId('');
    setSplitLayout('none');
    setActivePaneId('primary');
  }, [openTabs, secondaryOpenTabs, secondaryActiveTabId]);

  const handleCenterOnBlock = useCallback((target: string) => {
      let blockId = target;
      let block = blocks.find(b => b.id === target);

      // If no block matches ID, try matching path
      if (!block) {
          // Normalize path separators just in case
          const targetPath = target.replace(/\\/g, '/');
          block = blocks.find(b => b.filePath === targetPath);
          if (block) blockId = block.id;
      }

      if (block) {
          // Ensure the block type is visible in filters
          setCanvasFilters(prev => {
              const next = { ...prev };
              let changed = false;
              
              if (analysisResult.screenOnlyBlockIds.has(blockId) && !prev.screens) {
                  next.screens = true;
                  changed = true;
              } else if (analysisResult.configBlockIds.has(blockId) && !prev.config) {
                  next.config = true;
                  changed = true;
              } else if (analysisResult.storyBlockIds.has(blockId) && !prev.story) {
                  next.story = true;
                  changed = true;
              }
              
              return changed ? next : prev;
          });

          setActiveTabId('canvas');
          // Small timeout to ensure canvas is rendered if switching tabs
          setTimeout(() => {
              setCenterOnBlockRequest({ blockId, key: Date.now() });
          }, 50);
      } else {
          // Attempt to find sticky note
          const note = stickyNotes.find(n => n.id === target);
          if (note) {
               // Ensure notes are visible
               if (!canvasFilters.notes) {
                   setCanvasFilters(prev => ({ ...prev, notes: true }));
               }
               setActiveTabId('canvas');
               // Reuse the block center request for notes (requires StoryCanvas update to handle notes, or a separate mechanism)
               // Assuming StoryCanvas is updated to check note IDs too
               setTimeout(() => {
                   setCenterOnBlockRequest({ blockId: target, key: Date.now() });
               }, 50);
               return;
          }

          addToast(`Could not find a block or note for "${target}"`, 'warning');
      }
  }, [blocks, analysisResult, addToast, stickyNotes, canvasFilters.notes]);

  // DnD Handlers for Tabs
  const handleTabDragStart = (e: React.DragEvent<HTMLDivElement>, tabId: string, paneId: 'primary' | 'secondary' = 'primary') => {
    setDraggedTabId(tabId);
    setDragSourcePaneId(paneId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  };

  const handleTabDragOver = (e: React.DragEvent<HTMLDivElement>, targetTabId: string) => {
    e.preventDefault();
    if (draggedTabId && draggedTabId !== targetTabId) {
       e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleTabDrop = (e: React.DragEvent<HTMLDivElement>, targetTabId: string | null, targetPaneId: 'primary' | 'secondary') => {
    e.preventDefault();
    if (!draggedTabId) { setDraggedTabId(null); return; }
    const sourcePaneId = dragSourcePaneId;

    // ── Same-pane reorder ──────────────────────────────────────────────────
    if (sourcePaneId === targetPaneId) {
      if (!targetTabId || draggedTabId === targetTabId) { setDraggedTabId(null); return; }
      const setTabs = targetPaneId === 'primary' ? setOpenTabs : setSecondaryOpenTabs;
      const tabs    = targetPaneId === 'primary' ? openTabs   : secondaryOpenTabs;
      const fromIndex = tabs.findIndex(t => t.id === draggedTabId);
      const toIndex   = tabs.findIndex(t => t.id === targetTabId);
      if (fromIndex !== -1 && toIndex !== -1) {
        setTabs(prev => {
          const next = [...prev];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return next;
        });
        setHasUnsavedSettings(true);
      }
      setDraggedTabId(null);
      return;
    }

    // ── Cross-pane move ────────────────────────────────────────────────────
    const sourceTabs = sourcePaneId === 'primary' ? openTabs : secondaryOpenTabs;
    const targetTabs = targetPaneId === 'primary' ? openTabs : secondaryOpenTabs;
    const tab = sourceTabs.find(t => t.id === draggedTabId);
    if (!tab) { setDraggedTabId(null); return; }

    // Remove from source pane
    const newSourceTabs = sourceTabs.filter(t => t.id !== draggedTabId);
    if (sourcePaneId === 'primary') {
      setOpenTabs(newSourceTabs);
      if (activeTabId === draggedTabId) {
        const fallback = newSourceTabs.find(t => t.type === 'canvas') ?? newSourceTabs[0];
        if (fallback) setActiveTabId(fallback.id);
      }
    } else {
      if (newSourceTabs.length === 0) {
        // Secondary is now empty — collapse the split
        setSecondaryOpenTabs([]);
        setSecondaryActiveTabId('');
        setSplitLayout('none');
        setActivePaneId('primary');
      } else {
        setSecondaryOpenTabs(newSourceTabs);
        if (secondaryActiveTabId === draggedTabId) setSecondaryActiveTabId(newSourceTabs[0].id);
      }
    }

    // Insert into target pane (at the hovered tab position, or append)
    const insertAt = targetTabId !== null ? targetTabs.findIndex(t => t.id === targetTabId) : -1;
    if (targetPaneId === 'primary') {
      setOpenTabs(prev => {
        const next = [...prev];
        next.splice(insertAt >= 0 ? insertAt : next.length, 0, tab);
        return next;
      });
      setActiveTabId(tab.id);
    } else {
      setSecondaryOpenTabs(prev => {
        const next = [...prev];
        next.splice(insertAt >= 0 ? insertAt : next.length, 0, tab);
        return next;
      });
      setSecondaryActiveTabId(tab.id);
    }

    setActivePaneId(targetPaneId);
    setHasUnsavedSettings(true);
    setDraggedTabId(null);
  };

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
      if (openTabs.find(t => t.id === tabId)) { setActiveTabId(tabId); setActivePaneId('primary'); return; }
      if (secondaryOpenTabs.find(t => t.id === tabId)) { setSecondaryActiveTabId(tabId); setActivePaneId('secondary'); return; }
      const newTab: EditorTab = { id: tabId, type: 'character', characterTag: tag };
      if (activePaneId === 'secondary' && splitLayout !== 'none') {
          setSecondaryOpenTabs(prev => [...prev, newTab]);
          setSecondaryActiveTabId(tabId);
      } else {
          setOpenTabs(prev => [...prev, newTab]);
          setActiveTabId(tabId);
      }
  }, [openTabs, secondaryOpenTabs, activePaneId, splitLayout]);

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
                    const fullPath = await window.electronAPI.path.join(projectRootPath, charFilePath) as string;
                    const res = await window.electronAPI.writeFile(fullPath, newContent);
                    if (res.success) {
                        addBlock(charFilePath, newContent);
                        const projData = await window.electronAPI.loadProject(projectRootPath);
                        setFileSystemTree(projData.tree);
                    } else { throw new Error((res.error as string) || 'Unknown file creation error'); }
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
  const handleToggleSearch = useCallback(() => {
    setActiveLeftPanel('search');
    if (!appSettings.isLeftSidebarOpen) {
      updateAppSettings(draft => { draft.isLeftSidebarOpen = true; });
    }
  }, [appSettings.isLeftSidebarOpen, updateAppSettings]);

  const handleCreateNode = useCallback(async (parentPath: string, name: string, type: 'file' | 'folder') => {
    if (!window.electronAPI || !projectRootPath) return;
    try {
        const fullPath = await window.electronAPI.path.join(projectRootPath, parentPath, name);
        if (type === 'folder') {
            await window.electronAPI.createDirectory(fullPath);
        } else {
            await window.electronAPI.writeFile(fullPath, '');

            // If it's an .rpy file, create a corresponding block
            if (name.toLowerCase().endsWith('.rpy')) {
                const relativePath = parentPath ? `${parentPath}/${name}` : name;
                const content = ''; // Empty content for newly created files
                addBlock(relativePath, content);
                addToast(`Created block for ${name}`, 'success');
            }
        }
        const projData = await window.electronAPI.loadProject(projectRootPath);
        setFileSystemTree(projData.tree);
    } catch (err) {
        console.error('Failed to create file/folder:', err);
        addToast(`Failed to create ${type}: ${name}`, 'error');
    }
  }, [projectRootPath, addBlock, addToast]);

  const handleRenameNode = useCallback(async (oldPath: string, newName: string) => {
      if (!window.electronAPI || !projectRootPath) return;
      try {
          const fullOldPath = await window.electronAPI.path.join(projectRootPath, oldPath) as string;
          const parentDir = oldPath.split('/').slice(0, -1).join('/');
          const fullNewPath = await window.electronAPI.path.join(projectRootPath, parentDir, newName) as string;
          await window.electronAPI.moveFile(fullOldPath, fullNewPath);
          const projData = await window.electronAPI.loadProject(projectRootPath);
          setFileSystemTree(projData.tree);
      } catch (err) {
          console.error('Failed to rename:', err);
          addToast('Failed to rename file', 'error');
      }
  }, [projectRootPath, addToast]);

  const handleDeleteNode = useCallback(async (paths: string[]) => {
      if (!window.electronAPI || !projectRootPath) return;
      
      // Check if any of the paths are .rpy files that have corresponding blocks
      const rpyFilesToDelete = paths.filter(path => path.toLowerCase().endsWith('.rpy'));
      const blocksToDelete = rpyFilesToDelete.map(rpyPath => 
          blocks.find(block => block.filePath === rpyPath)
      ).filter(Boolean) as Block[];
      
      // Show confirmation modal
      setDeleteConfirmInfo({
          paths,
          onConfirm: async () => {
              try {
                  // Delete the files
                  for (const p of paths) {
                      const fullPath = await window.electronAPI.path.join(projectRootPath, p) as string;
                      await window.electronAPI.removeEntry(fullPath);
                  }

                  // Remove corresponding blocks for .rpy files
                  blocksToDelete.forEach(block => {
                      if (block) {
                          deleteBlock(block.id);
                          addToast(`Removed block for ${block.filePath}`, 'info');
                      }
                  });

                  const projData = await window.electronAPI.loadProject(projectRootPath);
                  setFileSystemTree(projData.tree);

                  if (blocksToDelete.length > 0) {
                      addToast(`Deleted ${paths.length} file(s) and removed ${blocksToDelete.length} block(s)`, 'success');
                  } else {
                      addToast(`Deleted ${paths.length} file(s)`, 'success');
                  }
              } catch (err) {
                  console.error('Failed to delete:', err);
                  addToast('Failed to delete file(s)', 'error');
              }
          }
      });
  }, [projectRootPath, blocks, deleteBlock, addToast]);

  const handleMoveNode = useCallback(async (sourcePaths: string[], targetPath: string) => {
      if (!window.electronAPI || !projectRootPath) return;
      try {
          const fullTargetDir = await window.electronAPI.path.join(projectRootPath, targetPath);
          for (const p of sourcePaths) {
              const fullSource = await window.electronAPI.path.join(projectRootPath, p);
              const fileName = p.split('/').pop() || '';
              const fullDest = await window.electronAPI.path.join(fullTargetDir, fileName);
              await window.electronAPI.moveFile(fullSource, fullDest);
          }
          const projData = await window.electronAPI.loadProject(projectRootPath);
          setFileSystemTree(projData.tree);
      } catch (err) {
          console.error('Failed to move file(s):', err);
          addToast('Failed to move file(s)', 'error');
      }
  }, [projectRootPath, addToast]);

  const handleCut = useCallback((paths: string[]) => setClipboard({ type: 'cut', paths: new Set(paths) }), []);
  const handleCopy = useCallback((paths: string[]) => setClipboard({ type: 'copy', paths: new Set(paths) }), []);
  const handlePaste = useCallback(async (targetPath: string) => {
      if (!clipboard || !window.electronAPI || !projectRootPath) return;
      try {
          const fullTargetDir = await window.electronAPI.path.join(projectRootPath!, targetPath);

          for (const p of clipboard.paths) {
              const fullSource = await window.electronAPI.path.join(projectRootPath!, p);
              const fileName = p.split('/').pop() || '';
              const fullDest = await window.electronAPI.path.join(fullTargetDir, fileName);

              if (clipboard.type === 'cut') {
                  await window.electronAPI.moveFile(fullSource, fullDest);
              } else {
                  await window.electronAPI.copyEntry(fullSource, fullDest);
              }
          }

          if (clipboard.type === 'cut') setClipboard(null);
          const projData = await window.electronAPI.loadProject(projectRootPath);
          setFileSystemTree(projData.tree);
      } catch (err) {
          console.error('Failed to paste:', err);
          addToast('Failed to paste file(s)', 'error');
      }
  }, [clipboard, projectRootPath, addToast]);

  const snippetCategoriesState = appSettings.snippetCategoriesState || {};
  const handleToggleSnippetCategory = (name: string, isOpen: boolean) => {
      updateAppSettings(draft => {
          if (!draft.snippetCategoriesState) draft.snippetCategoriesState = {};
          draft.snippetCategoriesState[name] = isOpen;
      });
  };

  // --- User Snippet CRUD ---
  const handleSaveSnippet = (snippet: UserSnippet) => {
      updateAppSettings(draft => {
          if (!draft.userSnippets) draft.userSnippets = [];
          const idx = draft.userSnippets.findIndex(s => s.id === snippet.id);
          if (idx >= 0) {
              draft.userSnippets[idx] = snippet;
          } else {
              draft.userSnippets.push(snippet);
          }
      });
      setHasUnsavedSettings(true);
  };
  const handleDeleteSnippet = (snippetId: string) => {
      updateAppSettings(draft => {
          if (draft.userSnippets) {
              draft.userSnippets = draft.userSnippets.filter(s => s.id !== snippetId);
          }
      });
      setHasUnsavedSettings(true);
  };

  // --- Menu Command Handling ---
  useEffect(() => {
        if (!window.electronAPI) return;
        const removeListener = window.electronAPI.onMenuCommand((data: { command: string, type?: 'canvas' | 'route-canvas' | 'punchlist' | 'ai-generator', path?: string }) => {
            if (data.command === 'new-project') handleNewProjectRequest();
            if (data.command === 'open-project') handleOpenProjectFolder();
            if (data.command === 'open-recent' && data.path) handleOpenWithRenpyCheck(data.path);
            if (data.command === 'save-all') handleSaveAll();
            if (data.command === 'run-project' && projectRootPath) window.electronAPI?.runGame(appSettings.renpyPath, projectRootPath);
            if (data.command === 'stop-project') window.electronAPI?.stopGame();
            if (data.command === 'open-static-tab' && data.type) handleOpenStaticTab(data.type as 'canvas' | 'route-canvas' | 'diagnostics' | 'ai-generator');
            if (data.command === 'toggle-search') handleToggleSearch();
            if (data.command === 'open-settings') setSettingsModalOpen(true);
            if (data.command === 'open-shortcuts') setShortcutsModalOpen(true);
            if (data.command === 'open-about') setAboutModalOpen(true);
            if (data.command === 'toggle-left-sidebar') updateAppSettings(draft => { draft.isLeftSidebarOpen = !draft.isLeftSidebarOpen; });
            if (data.command === 'toggle-right-sidebar') updateAppSettings(draft => { draft.isRightSidebarOpen = !draft.isRightSidebarOpen; });
        });
        return removeListener;
  }, [handleNewProjectRequest, handleOpenProjectFolder, handleOpenWithRenpyCheck, loadProject, handleSaveAll, projectRootPath, appSettings.renpyPath, handleOpenStaticTab, handleToggleSearch, updateAppSettings]);

  // --- Game Running State ---
  useEffect(() => {
      if (!window.electronAPI) return;
      const removeStarted = window.electronAPI.onGameStarted(() => setIsGameRunning(true));
      const removeStopped = window.electronAPI.onGameStopped(() => setIsGameRunning(false));
      return () => { removeStarted(); removeStopped(); };
  }, []);

  // --- Auto-update notifications ---
  useEffect(() => {
      if (!window.electronAPI?.onUpdateAvailable) return;
      const removeAvailable = window.electronAPI.onUpdateAvailable((version: string) => {
          addToast(`Update v${version} is downloading in the background.`, 'info');
      });
      const removeNotAvailable = window.electronAPI.onUpdateNotAvailable?.(() => {
          addToast("Ren'IDE is up to date.", 'info');
      });
      const removeError = window.electronAPI.onUpdateError?.(() => {
          addToast('Could not check for updates. Check your connection and try again.', 'error');
      });
      const removeDownloaded = window.electronAPI.onUpdateDownloaded((version: string) => {
          addToast(`Update v${version} ready — restart Ren'IDE to install.`, 'success');
      });
      return () => {
          removeAvailable();
          removeNotAvailable?.();
          removeError?.();
          removeDownloaded();
      };
  }, [addToast]);

  // --- Exit Handling ---
  const dirtyBlockIdsRef = useRef(dirtyBlockIds);
  const dirtyEditorsRef = useRef(dirtyEditors);
  const hasUnsavedSettingsRef = useRef(hasUnsavedSettings);
  const handleSaveAllRef = useRef(handleSaveAll);
  const handleSaveProjectSettingsRef = useRef(handleSaveProjectSettings);

  useEffect(() => { dirtyBlockIdsRef.current = dirtyBlockIds; }, [dirtyBlockIds]);
  useEffect(() => { dirtyEditorsRef.current = dirtyEditors; }, [dirtyEditors]);
  useEffect(() => { hasUnsavedSettingsRef.current = hasUnsavedSettings; }, [hasUnsavedSettings]);
  useEffect(() => { handleSaveAllRef.current = handleSaveAll; }, [handleSaveAll]);
  useEffect(() => { handleSaveProjectSettingsRef.current = handleSaveProjectSettings; }, [handleSaveProjectSettings]);

  useEffect(() => {
      if (!window.electronAPI) return;

      const removeCheck = window.electronAPI.onCheckUnsavedChangesBeforeExit(() => {
          const hasUnsaved = dirtyBlockIdsRef.current.size > 0 || dirtyEditorsRef.current.size > 0 || hasUnsavedSettingsRef.current;
          window.electronAPI!.replyUnsavedChangesBeforeExit(hasUnsaved);
      });

      const removeShowModal = window.electronAPI.onShowExitModal(() => {
          setUnsavedChangesModalInfo({
              title: 'Unsaved Changes',
              message: 'You have unsaved changes. Do you want to save them before exiting?',
              confirmText: 'Save & Exit',
              dontSaveText: "Don't Save",
              onConfirm: async () => {
                  try {
                      await handleSaveAllRef.current();
                  } catch (err) {
                      console.error('Failed to save before exit:', err);
                  }
                  window.electronAPI!.ideStateSavedForQuit();
              },
              onDontSave: () => {
                  window.electronAPI!.ideStateSavedForQuit();
              },
              onCancel: () => {
                  setUnsavedChangesModalInfo(null);
              }
          });
      });

      const removeSaveState = window.electronAPI.onSaveIdeStateBeforeQuit(async () => {
          try {
              await handleSaveProjectSettingsRef.current();
          } catch (err) {
              console.error('Failed to save IDE state before quit:', err);
          }
          window.electronAPI!.ideStateSavedForQuit();
      });

      return () => {
          removeCheck();
          removeShowModal();
          removeSaveState();
      };
  }, []);

  // --- Tab helpers (used by both panes) ---
  const getTabLabel = (tab: EditorTab): React.ReactNode => {
    if (tab.id === 'canvas') return 'Story Canvas';
    if (tab.id === 'route-canvas') return 'Route Canvas';
    if (tab.id === 'choice-canvas') return 'Choice Canvas';
    if (tab.id === 'diagnostics' || tab.id === 'punchlist') return 'Diagnostics';
    if (tab.id === 'stats') return 'Stats';
    if (tab.type === 'ai-generator') return 'AI Generator';
    if (tab.type === 'scene-composer') return sceneNames[tab.sceneId!] || 'Scene';
    if (tab.type === 'imagemap-composer') return imagemapCompositions[tab.imagemapId!]?.screenName || 'ImageMap';
    if (tab.type === 'screen-layout-composer') return screenLayoutCompositions[tab.layoutId!]?.screenName || 'Screen Layout';
    if (tab.type === 'character') return `Char: ${analysisResult.characters.get(tab.characterTag!)?.name || tab.characterTag}`;
    if (tab.type === 'editor') return blocks.find(b => b.id === tab.blockId)?.title || 'Untitled';
    if (tab.type === 'markdown') return tab.filePath?.split('/').pop() ?? 'Markdown';
    return tab.filePath?.split('/').pop() ?? 'Untitled';
  };

  const renderTabContent = (tab: EditorTab): React.ReactNode => {
    if (tab.type === 'canvas') {
      return <StoryCanvas
        blocks={blocks} groups={groups} stickyNotes={stickyNotes} analysisResult={analysisResult}
        updateBlock={updateBlock} updateGroup={updateGroup} updateBlockPositions={updateBlockPositions}
        updateGroupPositions={updateGroupPositions} updateStickyNote={updateStickyNote} deleteStickyNote={deleteStickyNote}
        onInteractionEnd={canvasInteractionEnd} deleteBlock={deleteBlock} onOpenEditor={handleOpenEditor}
        selectedBlockIds={selectedBlockIds} setSelectedBlockIds={setSelectedBlockIds}
        selectedGroupIds={selectedGroupIds} setSelectedGroupIds={setSelectedGroupIds}
        findUsagesHighlightIds={findUsagesHighlightIds} clearFindUsages={handleClearFindUsages}
        dirtyBlockIds={dirtyBlockIds} canvasFilters={canvasFilters} setCanvasFilters={setCanvasFilters}
        centerOnBlockRequest={centerOnBlockRequest} flashBlockRequest={flashBlockRequest}
        hoverHighlightIds={hoverHighlightIds} transform={storyCanvasTransform} onTransformChange={setStoryCanvasTransform}
        onCreateBlock={handleCreateBlockFromCanvas} onAddStickyNote={addStickyNote} mouseGestures={appSettings.mouseGestures}
        onOpenRouteCanvas={handleOpenRouteCanvasTab}
        layoutMode={projectSettings.storyCanvasLayoutMode ?? 'flow-lr'}
        groupingMode={projectSettings.storyCanvasGroupingMode ?? 'none'}
        onChangeLayoutMode={handleChangeStoryCanvasLayoutMode}
        onChangeGroupingMode={handleChangeStoryCanvasGroupingMode}
      />;
    }
    if (tab.type === 'route-canvas') {
      return <RouteCanvas
        labelNodes={routeAnalysisResult.labelNodes} routeLinks={routeAnalysisResult.routeLinks}
        identifiedRoutes={routeAnalysisResult.identifiedRoutes} routesTruncated={routeAnalysisResult.routesTruncated}
        updateLabelNodePositions={handleUpdateRouteNodePositions}
        stickyNotes={routeStickyNotes} onAddStickyNote={addRouteStickyNote}
        updateStickyNote={updateRouteStickyNote} deleteStickyNote={deleteRouteStickyNote}
        onOpenEditor={handleOpenEditor} transform={routeCanvasTransform} onTransformChange={setRouteCanvasTransform}
        mouseGestures={appSettings.mouseGestures}
        layoutMode={projectSettings.routeCanvasLayoutMode ?? 'flow-lr'}
        groupingMode={projectSettings.routeCanvasGroupingMode ?? 'none'}
        onChangeLayoutMode={handleChangeRouteCanvasLayoutMode}
        onChangeGroupingMode={handleChangeRouteCanvasGroupingMode}
      />;
    }
    if (tab.type === 'choice-canvas') {
      return <ChoiceCanvas
        labelNodes={routeAnalysisResult.labelNodes}
        routeLinks={routeAnalysisResult.routeLinks}
        blocks={blocks}
        analysisResult={analysisResult}
        stickyNotes={choiceStickyNotes} onAddStickyNote={addChoiceStickyNote}
        updateStickyNote={updateChoiceStickyNote} deleteStickyNote={deleteChoiceStickyNote}
        onOpenEditor={handleOpenEditor}
        transform={choiceCanvasTransform}
        onTransformChange={setChoiceCanvasTransform}
        mouseGestures={appSettings.mouseGestures}
        layoutMode={projectSettings.choiceCanvasLayoutMode ?? 'flow-td'}
        groupingMode={projectSettings.choiceCanvasGroupingMode ?? 'none'}
        onChangeLayoutMode={handleChangeChoiceCanvasLayoutMode}
        onChangeGroupingMode={handleChangeChoiceCanvasGroupingMode}
      />;
    }
    if (tab.type === 'diagnostics' || tab.type === 'punchlist') {
      return <DiagnosticsPanel
        diagnostics={diagnosticsResult}
        blocks={blocks} stickyNotes={[...stickyNotes, ...routeStickyNotes, ...choiceStickyNotes]}
        tasks={diagnosticsTasks}
        ignoredDiagnostics={ignoredDiagnostics}
        onUpdateTasks={(updated) => { setDiagnosticsTasks(updated); setHasUnsavedSettings(true); }}
        onUpdateIgnoredDiagnostics={(updated) => { setIgnoredDiagnostics(updated); setHasUnsavedSettings(true); }}
        onOpenBlock={handleOpenEditor} onHighlightBlock={(id) => handleCenterOnBlock(id)}
      />;
    }
    if (tab.type === 'ai-generator') {
      return <AIGeneratorView
        currentBlockId={getCurrentBlockId()} blocks={blocks}
        getCurrentContext={getCurrentContext} availableModels={AVAILABLE_MODELS} selectedModel={projectSettings.selectedModel}
      />;
    }
    if (tab.id === 'stats') {
      return <StatsView
        blocks={blocks}
        analysisResult={analysisResult}
        routeAnalysisResult={routeAnalysisResult}
        projectImages={images}
        imageMetadata={imageMetadata}
        projectAudios={audios}
        diagnosticsErrorCount={diagnosticsResult.errorCount}
        onOpenDiagnostics={() => handleOpenStaticTab('diagnostics')}
      />;
    }
    if (tab.type === 'editor' && tab.blockId) {
      const block = blocks.find(b => b.id === tab.blockId);
      if (block) return <EditorView
        block={block} blocks={blocks} analysisResult={analysisResult} initialScrollRequest={tab.scrollRequest}
        onSwitchFocusBlock={handleOpenEditor} onSave={(id, content) => updateBlock(id, { content })}
        onTriggerSave={handleSaveBlock}
        onDirtyChange={(id, dirty) => { setDirtyEditors(prev => { const next = new Set(prev); if (dirty) { next.add(id); } else { next.delete(id); } return next; }); }}
        onContentChange={(id, content) => { setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b)); }}
        editorTheme={appSettings.theme.includes('dark') ? 'dark' : 'light'} editorFontFamily={appSettings.editorFontFamily}
        editorFontSize={appSettings.editorFontSize} enableAiFeatures={projectSettings.enableAiFeatures}
        availableModels={AVAILABLE_MODELS} selectedModel={projectSettings.selectedModel} addToast={addToast}
        onEditorMount={(id, editor) => editorInstances.current.set(id, editor)}
        onEditorUnmount={(id) => { const editor = editorInstances.current.get(id); if (editor) { const block = blocksRef.current.find(b => b.id === id); if (block && editor.getValue() !== block.content) { syncEditorToStateAndMarkDirty(id, editor.getValue()); } } editorInstances.current.delete(id); }}
        onCursorPositionChange={setEditorCursorPosition}
        draftingMode={projectSettings.draftingMode} existingImageTags={existingImageTags} existingAudioPaths={existingAudioPaths}
        userSnippets={appSettings.userSnippets}
      />;
    }
    if (tab.type === 'image' && tab.filePath) {
      const img = images.get(tab.filePath);
      if (img) { const meta = imageMetadata.get(img.projectFilePath || img.filePath); return <ImageEditorView
        image={img} allImages={imagesArray} metadata={meta}
        onUpdateMetadata={handleUpdateImageMetadata}
        onCopyToProject={handleCopyImageToProject}
      />; }
    }
    if (tab.type === 'audio' && tab.filePath) {
      const aud = audios.get(tab.filePath);
      if (aud) { const meta = audioMetadata.get(aud.projectFilePath || aud.filePath); return <AudioEditorView
        audio={aud} metadata={meta}
        onUpdateMetadata={handleUpdateAudioMetadata}
        onCopyToProject={handleCopyAudioToProject}
      />; }
    }
    if (tab.type === 'character' && tab.characterTag) {
      const char = analysisResultWithProfiles.characters.get(tab.characterTag);
      return <CharacterEditorView character={char} onSave={handleUpdateCharacter}
        existingTags={characterTagsArray}
        projectImages={imagesArray} imageMetadata={imageMetadata}
      />;
    }
    if (tab.type === 'scene-composer' && tab.sceneId) {
      const composition = sceneCompositions[tab.sceneId] || { background: null, sprites: [] };
      const name = sceneNames[tab.sceneId] || 'Scene';
      return <SceneComposer
        images={imagesArray} metadata={imageMetadata} scene={composition}
        onSceneChange={(val) => handleSceneUpdate(tab.sceneId!, val)} sceneName={name}
        onRenameScene={(newName) => handleRenameScene(tab.sceneId!, newName)}
        addToast={addToast}
      />;
    }
    if (tab.type === 'imagemap-composer' && tab.imagemapId) {
      const composition = imagemapCompositions[tab.imagemapId] || {
        screenName: 'imagemap',
        groundImage: null,
        hoverImage: null,
        hotspots: []
      };
      const allLabels = Object.keys(analysisResult.labels);
      return <ImageMapComposer
        images={imagesArray}
        imagemap={composition}
        onImageMapChange={(val) => handleImageMapUpdate(tab.imagemapId!, val)}
        imagemapName={composition.screenName}
        onRenameImageMap={(newName) => handleRenameImageMap(tab.imagemapId!, newName)}
        labels={allLabels}
      />;
    }
    if (tab.type === 'screen-layout-composer' && tab.layoutId) {
      const composition = screenLayoutCompositions[tab.layoutId] || {
        screenName: 'new_screen',
        gameWidth: 1920,
        gameHeight: 1080,
        modal: false,
        zorder: 0,
        widgets: []
      };
      const isLayoutLocked = analysisResult.screens.has(composition.screenName);
      return <ScreenLayoutComposer
        composition={composition}
        onCompositionChange={(val) => handleScreenLayoutUpdate(tab.layoutId!, val)}
        screenName={composition.screenName}
        onRenameScreen={(newName) => handleRenameScreenLayout(tab.layoutId!, newName)}
        labels={Object.keys(analysisResult.labels)}
        isLocked={isLayoutLocked}
        onDuplicate={() => handleDuplicateScreenLayout(tab.layoutId!)}
        onGoToCode={isLayoutLocked ? () => {
            const def = analysisResult.screens.get(composition.screenName);
            if (def) handleOpenEditor(def.definedInBlockId, def.line);
        } : undefined}
      />;
    }
    if (tab.type === 'markdown' && tab.filePath) {
      return <MarkdownPreviewView
        filePath={tab.filePath}
        projectRootPath={projectRootPath!}
        editorTheme={appSettings.theme.includes('dark') ? 'dark' : 'light'}
        addToast={addToast}
      />;
    }
    return null;
  };

  const renderTabBar = (tabs: EditorTab[], activeId: string, paneId: 'primary' | 'secondary', scrollRef: React.RefObject<HTMLDivElement>) => (
    <div className={`flex-none flex items-center bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${splitLayout !== 'none' && activePaneId === paneId ? 'border-t-2 border-t-indigo-500' : ''}`}>
      {/* Scrollable tab strip — also a drop target for appending to this pane */}
      <div
        ref={scrollRef}
        className="flex flex-1 overflow-x-auto no-scrollbar min-w-0"
        onDragOver={(e) => { e.preventDefault(); if (draggedTabId) e.dataTransfer.dropEffect = 'move'; }}
        onDrop={(e) => handleTabDrop(e, null, paneId)}
      >
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`flex items-center px-3 py-2 text-sm border-r border-gray-200 dark:border-gray-700 cursor-pointer min-w-[100px] max-w-[200px] flex-none group ${activeId === tab.id ? 'bg-white dark:bg-gray-900 font-semibold' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            onClick={() => handleSwitchTab(tab.id, paneId)}
            draggable
            onDragStart={(e) => handleTabDragStart(e, tab.id, paneId)}
            onDragOver={(e) => handleTabDragOver(e, tab.id)}
            onDrop={(e) => { e.stopPropagation(); handleTabDrop(e, tab.id, paneId); }}
            onContextMenu={(e) => handleTabContextMenu(e, tab.id, paneId)}
          >
            <span className="truncate flex-grow">{getTabLabel(tab)}</span>
            {(tab.id === 'diagnostics' || tab.id === 'punchlist') && diagnosticsResult.errorCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center flex-none">
                {diagnosticsResult.errorCount}
              </span>
            )}
            <button onClick={(e) => handleCloseTab(tab.id, paneId, e)} aria-label="Close tab" className="ml-2 opacity-0 group-hover:opacity-100 hover:text-red-500 rounded-full p-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
            {tab.blockId && (dirtyBlockIds.has(tab.blockId) || dirtyEditors.has(tab.blockId)) && <div className="w-2 h-2 ml-2 bg-blue-500 rounded-full flex-none" />}
          </div>
        ))}
      </div>
      {/* Pinned right actions */}
      <div className="flex items-center flex-none border-l border-gray-200 dark:border-gray-700">
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: -150, behavior: 'smooth' })}
          title="Scroll tabs left"
          className="px-1 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: 150, behavior: 'smooth' })}
          title="Scroll tabs right"
          className="px-1 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        {paneId === 'primary' && splitLayout === 'none' && (
          <>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
            <button onClick={() => handleCreateSplit('right')} title="Split Right" className="p-1 rounded text-gray-400 hover:text-indigo-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="6" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="2" width="6" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
            </button>
            <button onClick={() => handleCreateSplit('bottom')} title="Split Below" className="p-1 rounded text-gray-400 hover:text-indigo-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="9" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
            </button>
          </>
        )}
        {paneId === 'primary' && splitLayout !== 'none' && (
          <>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
            <button onClick={handleClosePrimaryPane} title="Close Pane (moves tabs to other pane)" className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </>
        )}
        {paneId === 'secondary' && (
          <>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
            <button onClick={handleCloseSecondaryPane} title="Close Pane (moves tabs to other pane)" className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </>
        )}
      </div>
    </div>
  );

  const focusedTabId = activePaneId === 'secondary' && splitLayout !== 'none'
    ? secondaryActiveTabId
    : activeTabId;
  const activeCanvasType: 'story' | 'route' | 'choice' | null =
    focusedTabId === 'route-canvas' ? 'route' :
    focusedTabId === 'choice-canvas' ? 'choice' :
    focusedTabId === 'canvas' ? 'story' : null;
  const activeCanvasLayoutMode = activeCanvasType === 'route'
    ? (projectSettings.routeCanvasLayoutMode ?? 'flow-lr')
    : (projectSettings.storyCanvasLayoutMode ?? 'flow-lr');
  const activeCanvasGroupingMode = activeCanvasType === 'route'
    ? (projectSettings.routeCanvasGroupingMode ?? 'none')
    : (projectSettings.storyCanvasGroupingMode ?? 'none');
  const handleActiveCanvasTidyUp = () => {
    if (activeCanvasType === 'route') {
      applyRouteLayout(activeCanvasLayoutMode, activeCanvasGroupingMode, { showToast: true });
      return;
    }
    if (activeCanvasType === 'choice') return; // Choice canvas has no tidy-up (auto-layout only)
    handleTidyUp(true);
  };
  const activeCanvasOnAddStickyNote: (() => void) | null =
    activeCanvasType === 'story' ? () => addStickyNote() :
    activeCanvasType === 'route' ? () => addRouteStickyNote() :
    activeCanvasType === 'choice' ? () => addChoiceStickyNote() :
    null;

  return (
    <SearchProvider
      blocks={blocks}
      projectRootPath={projectRootPath}
      addToast={addToast}
      onOpenEditor={handleOpenEditor}
    >
    <div className={`fixed inset-0 flex flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 ${appSettings.theme}`}>
      <Toolbar
        activeCanvasType={activeCanvasType}
        projectRootPath={projectRootPath}
        dirtyBlockIds={dirtyBlockIds}
        dirtyEditors={dirtyEditors}
        hasUnsavedSettings={hasUnsavedSettings}
        saveStatus={saveStatus}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        addBlock={() => setCreateBlockModalOpen(true)}
        handleTidyUp={handleActiveCanvasTidyUp}
        handleSave={handleSaveAll}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onOpenStaticTab={handleOpenStaticTab as (type: 'canvas' | 'route-canvas' | 'choice-canvas' | 'stats' | 'diagnostics') => void}
        diagnosticsErrorCount={diagnosticsResult.errorCount}
        onAddStickyNote={activeCanvasOnAddStickyNote}
        isGameRunning={isGameRunning}
        onRunGame={() => window.electronAPI?.runGame(appSettings.renpyPath, projectRootPath!)}
        onStopGame={() => window.electronAPI?.stopGame()}
        isRenpyPathValid={isRenpyPathValid}
        draftingMode={projectSettings.draftingMode}
        onToggleDraftingMode={handleToggleDraftingMode}
      />
      
      <div className="flex-grow flex overflow-hidden">
        {/* Left Sidebar */}
        {!appSettings.isLeftSidebarOpen && (
          <div className="flex-none w-6 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={() => updateAppSettings(draft => { draft.isLeftSidebarOpen = true })}
              className="w-6 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              title="Expand Left Sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.293 14.707a1 1 0 010-1.414L6.586 10 3.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0zm8 0a1 1 0 010-1.414L14.586 10l-3.293-3.293a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </button>
          </div>
        )}
        {appSettings.isLeftSidebarOpen && (
          <div style={{ width: appSettings.leftSidebarWidth }} className="flex-none flex flex-col border-r border-gray-200 dark:border-gray-700">
            <div className="flex-none flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveLeftPanel('explorer')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${activeLeftPanel === 'explorer' ? 'bg-white dark:bg-gray-900 shadow' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  Explorer
                </button>
                <button
                  onClick={() => setActiveLeftPanel('search')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${activeLeftPanel === 'search' ? 'bg-white dark:bg-gray-900 shadow' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  Search
                </button>
              </div>
              <button
                onClick={() => updateAppSettings(draft => { draft.isLeftSidebarOpen = false })}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Collapse Left Sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 14.707a1 1 0 010-1.414L13.414 10l3.293-3.293a1 1 0 00-1.414-1.414l-4 4a1 1 0 000 1.414l4 4a1 1 0 001.414 0zm-8 0a1 1 0 010-1.414L5.414 10l3.293-3.293a1 1 0 00-1.414-1.414l-4 4a1 1 0 000 1.414l4 4a1 1 0 001.414 0z" clipRule="evenodd" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {activeLeftPanel === 'explorer' ? (
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
                    onCenterOnBlock={handleCenterOnBlock}
                    selectedPaths={explorerSelectedPaths}
                    setSelectedPaths={setExplorerSelectedPaths}
                    lastClickedPath={explorerLastClickedPath}
                    setLastClickedPath={setExplorerLastClickedPath}
                    expandedPaths={explorerExpandedPaths}
                    onToggleExpand={handleToggleExpandExplorer}
                />
             ) : (
                <SearchPanel />
             )}
            </div>
          </div>
        )}
        {appSettings.isLeftSidebarOpen && (
            <Sash onDrag={(delta) => updateAppSettings(d => { d.leftSidebarWidth = Math.max(150, d.leftSidebarWidth + delta) })} />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900 relative">

          {!projectRootPath ? (
            /* No-project empty state */
            <div className="flex-grow flex items-center justify-center p-8">
              <div className="w-full max-w-md space-y-8 text-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Project Open</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Use the File menu or the buttons below to get started.</p>
                </div>
                {window.electronAPI && (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={handleCreateProject}
                      className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      New Project
                    </button>
                    <button
                      onClick={handleOpenProjectFolder}
                      className="flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                      Open Project
                    </button>
                  </div>
                )}
                {appSettings.recentProjects.length > 0 && (
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700 text-left">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Recent Projects</h3>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {appSettings.recentProjects.map((p, i) => {
                        const folderName = p.replace(/[/\\]$/, '').split(/[/\\]/).pop();
                        return (
                          <button
                            key={i}
                            onClick={() => handleOpenWithRenpyCheck(p)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group flex items-center gap-3"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" /><path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" /></svg>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{folderName}</p>
                              <p className="text-xs text-gray-500 truncate">{p}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Panes container — flex-row for right split, flex-col for bottom split */
            <div className={`flex-grow flex ${splitLayout === 'bottom' ? 'flex-col' : 'flex-row'} overflow-hidden min-h-0`}>

              {/* PRIMARY PANE */}
              <div
                className="flex flex-col min-w-0 min-h-0"
                style={splitLayout === 'right' ? { width: splitPrimarySize, flexShrink: 0 } : splitLayout === 'bottom' ? { height: splitPrimarySize, flexShrink: 0 } : { flex: 1 }}
                onClick={() => activePaneId !== 'primary' && setActivePaneId('primary')}
              >
                {renderTabBar(openTabs, activeTabId, 'primary', primaryTabBarRef)}
                <div className="flex-grow relative overflow-hidden">
                  {openTabs.map(tab => {
                      const isActive = tab.id === activeTabId;
                      if (isActive) primaryMountedTabsRef.current.add(tab.id);
                      return (
                          <div key={tab.id} className="w-full h-full absolute" style={{ visibility: isActive ? 'visible' : 'hidden' }}>
                              {primaryMountedTabsRef.current.has(tab.id) ? renderTabContent(tab) : null}
                          </div>
                      );
                  })}
                </div>
              </div>

              {/* SASH between panes */}
              {splitLayout !== 'none' && (
                <Sash
                  direction={splitLayout === 'right' ? 'horizontal' : 'vertical'}
                  onDrag={(delta) => setSplitPrimarySize(prev => Math.max(200, prev + delta))}
                />
              )}

              {/* SECONDARY PANE */}
              {splitLayout !== 'none' && (
                <div
                  className="flex-1 flex flex-col min-w-0 min-h-0"
                  onClick={() => activePaneId !== 'secondary' && setActivePaneId('secondary')}
                >
                  {renderTabBar(secondaryOpenTabs, secondaryActiveTabId, 'secondary', secondaryTabBarRef)}
                  <div className="flex-grow relative overflow-hidden">
                    {secondaryOpenTabs.map(tab => {
                      const isActive = tab.id === secondaryActiveTabId;
                      if (isActive) secondaryMountedTabsRef.current.add(tab.id);
                      return (
                          <div key={tab.id} className="w-full h-full absolute" style={{ visibility: isActive ? 'visible' : 'hidden' }}>
                              {secondaryMountedTabsRef.current.has(tab.id) ? renderTabContent(tab) : null}
                          </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}{/* end panes container / empty state */}

          <StatusBar
              isAnalysisPending={isAnalysisPending}
              isScanningAssets={isScanningAssets}
              saveStatus={saveStatus}
              blockCount={blocks.length}
              errorCount={diagnosticsResult.errorCount}
              warningCount={diagnosticsResult.warningCount}
          />

        </div>

        {/* Right Sidebar */}
        {appSettings.isRightSidebarOpen && (
            <Sash onDrag={(delta) => updateAppSettings(d => { d.rightSidebarWidth = Math.max(200, d.rightSidebarWidth - delta) })} />
        )}
        {appSettings.isRightSidebarOpen && (
          <div style={{ width: appSettings.rightSidebarWidth }} className="flex-none relative border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button
              onClick={() => updateAppSettings(draft => { draft.isRightSidebarOpen = false })}
              className="absolute top-3 right-3 z-10 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Collapse Right Sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.293 14.707a1 1 0 010-1.414L6.586 10 3.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0zm8 0a1 1 0 010-1.414L14.586 10l-3.293-3.293a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </button>
            <StoryElementsPanel
                analysisResult={analysisResultWithProfiles}
                onOpenCharacterEditor={handleOpenCharacterEditor}
                onFindCharacterUsages={(tag) => handleFindUsages(tag, 'character')}
                onAddVariable={(v) => {
                    const varContent = `default ${v.name} = ${v.initialValue}\n`;
                    const targetFile = 'game/variables.rpy';
                    const existing = blocks.find(b => b.filePath === targetFile);
                    if (existing) {
                        updateBlock(existing.id, { content: existing.content + '\n' + varContent });
                        addToast(`Added variable ${v.name} to variables.rpy`, 'success');
                    } else {
                        addToast(`Please create 'game/variables.rpy' first.`, 'warning');
                    }
                }}
                onFindVariableUsages={(name) => handleFindUsages(name, 'variable')}
                onFindScreenDefinition={(name) => {
                    const def = analysisResult.screens.get(name);
                    if (def) handleOpenEditor(def.definedInBlockId, def.line);
                }}
                // Image Props
                projectImages={images}
                imageMetadata={imageMetadata}
                imageScanDirectories={imageScanDirectories}
                onAddImageScanDirectory={async () => {
                    if (window.electronAPI) {
                        try {
                            const path = await window.electronAPI.openDirectory();
                            if (path) {
                                setImageScanDirectories(prev => new Map(prev).set(path, null as unknown as FileSystemDirectoryHandle));
                                setIsScanningAssets(true);
                                try {
                                    const { images: scanned } = await window.electronAPI.scanDirectory(path);
                                    setImages(prev => {
                                        const next = new Map(prev);
                                        scanned.forEach((img) => {
                                            if (!next.has(img.path)) next.set(img.path, { ...img, filePath: img.path, isInProject: false, fileHandle: null });
                                        });
                                        return next;
                                    });
                                } finally {
                                    setIsScanningAssets(false);
                                }
                                setHasUnsavedSettings(true);
                            }
                        } catch (err) {
                            console.error('Failed to scan image directory:', err);
                            addToast('Failed to scan image directory', 'error');
                        }
                    }
                }}
                onRemoveImageScanDirectory={(path) => {
                    setImageScanDirectories(prev => {
                        const next = new Map(prev);
                        next.delete(path);
                        return next;
                    });
                    setHasUnsavedSettings(true);
                }}
                onCopyImagesToProject={async (sourcePaths) => {
                    if (window.electronAPI && projectRootPath) {
                        try {
                            for (const src of sourcePaths) {
                                const fileName = src.split('/').pop() || 'image.png';
                                const destDir = await window.electronAPI.path.join(projectRootPath, 'game', 'images');
                                const destPath = await window.electronAPI.path.join(destDir, fileName);
                                await window.electronAPI.copyEntry(src, destPath);
                            }
                            await loadProject(projectRootPath);
                        } catch (err) {
                            console.error('Failed to copy images to project:', err);
                            addToast('Failed to copy images to project', 'error');
                        }
                    }
                }}
                onOpenImageEditor={handleOpenImageEditorTab}
                imagesLastScanned={imagesLastScanned}
                isRefreshingImages={isRefreshingImages}
                onRefreshImages={() => {/* Logic to re-scan all directories */}}
                
                // Audio Props
                projectAudios={audios}
                audioMetadata={audioMetadata}
                audioScanDirectories={audioScanDirectories}
                onAddAudioScanDirectory={async () => {
                     if (window.electronAPI) {
                        try {
                            const path = await window.electronAPI.openDirectory();
                            if (path) {
                                setAudioScanDirectories(prev => new Map(prev).set(path, null as unknown as FileSystemDirectoryHandle));
                                setIsScanningAssets(true);
                                try {
                                    const { audios: scanned } = await window.electronAPI.scanDirectory(path);
                                    setAudios(prev => {
                                        const next = new Map(prev);
                                        scanned.forEach((aud) => {
                                            if (!next.has(aud.path)) next.set(aud.path, { ...aud, filePath: aud.path, isInProject: false, fileHandle: null });
                                        });
                                        return next;
                                    });
                                } finally {
                                    setIsScanningAssets(false);
                                }
                                setHasUnsavedSettings(true);
                            }
                        } catch (err) {
                            console.error('Failed to scan audio directory:', err);
                            addToast('Failed to scan audio directory', 'error');
                        }
                    }
                }}
                onRemoveAudioScanDirectory={(path) => {
                    setAudioScanDirectories(prev => {
                        const next = new Map(prev);
                        next.delete(path);
                        return next;
                    });
                    setHasUnsavedSettings(true);
                }}
                onCopyAudiosToProject={async (sourcePaths) => {
                     if (window.electronAPI && projectRootPath) {
                        try {
                            for (const src of sourcePaths) {
                                const fileName = src.split('/').pop() || 'audio.ogg';
                                const destDir = await window.electronAPI.path.join(projectRootPath, 'game', 'audio');
                                const destPath = await window.electronAPI.path.join(destDir, fileName);
                                await window.electronAPI.copyEntry(src, destPath);
                            }
                            await loadProject(projectRootPath);
                        } catch (err) {
                            console.error('Failed to copy audio to project:', err);
                            addToast('Failed to copy audio to project', 'error');
                        }
                    }
                }}
                onOpenAudioEditor={(filePath) => {
                    const tabId = `aud-${filePath}`;
                    setOpenTabs(prev => {
                        if (!prev.find(t => t.id === tabId)) {
                            return [...prev, { id: tabId, type: 'audio', filePath }];
                        }
                        return prev;
                    });
                    setActiveTabId(tabId);
                }}
                audiosLastScanned={audiosLastScanned}
                isRefreshingAudios={isRefreshingAudios}
                onRefreshAudios={() => {}}
                isFileSystemApiSupported={!!window.electronAPI}
                onHoverHighlightStart={(key, type) => {
                    const ids = new Set<string>();
                    // Highlight logic same as find usages but transient
                    if (type === 'character') {
                        analysisResult.dialogueLines.forEach((dialogues, blockId) => {
                            if (dialogues.some(d => d.tag === key)) ids.add(blockId);
                        });
                    } else {
                        analysisResult.variableUsages.get(key)?.forEach(u => ids.add(u.blockId));
                    }
                    setHoverHighlightIds(ids);
                }}
                onHoverHighlightEnd={() => setHoverHighlightIds(null)}
                // Scene Props
                scenes={Object.keys(sceneCompositions).map(id => ({ id, name: sceneNames[id] || 'Scene' }))}
                onOpenScene={handleOpenScene}
                onCreateScene={handleCreateScene}
                onDeleteScene={handleDeleteScene}
                // ImageMap Props
                imagemaps={Object.keys(imagemapCompositions).map(id => ({ id, name: imagemapCompositions[id]?.screenName || 'ImageMap' }))}
                onOpenImageMap={handleOpenImageMap}
                onCreateImageMap={handleCreateImageMap}
                onDeleteImageMap={handleDeleteImageMap}
                // Screen Layout Props
                screenLayouts={Object.keys(screenLayoutCompositions).map(id => ({ id, name: screenLayoutCompositions[id]?.screenName || 'Screen Layout' }))}
                onOpenScreenLayout={handleOpenScreenLayout}
                onCreateScreenLayout={handleCreateScreenLayout}
                onDeleteScreenLayout={handleDeleteScreenLayout}
                onDuplicateScreenLayout={handleDuplicateScreenLayout}
                // Snippet Props
                snippetCategoriesState={snippetCategoriesState}
                onToggleSnippetCategory={handleToggleSnippetCategory}
                userSnippets={appSettings.userSnippets}
                onCreateSnippet={() => { setEditingSnippet(null); setUserSnippetModalOpen(true); }}
                onEditSnippet={(snippet) => { setEditingSnippet(snippet); setUserSnippetModalOpen(true); }}
                onDeleteSnippet={handleDeleteSnippet}
            />
          </div>
        )}
        {!appSettings.isRightSidebarOpen && (
          <div className="flex-none w-6 flex flex-col border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={() => updateAppSettings(draft => { draft.isRightSidebarOpen = true })}
              className="w-6 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              title="Expand Right Sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 14.707a1 1 0 010-1.414L13.414 10l3.293-3.293a1 1 0 00-1.414-1.414l-4 4a1 1 0 000 1.414l4 4a1 1 0 001.414 0zm-8 0a1 1 0 010-1.414L5.414 10l3.293-3.293a1 1 0 00-1.414-1.414l-4 4a1 1 0 000 1.414l4 4a1 1 0 001.414 0z" clipRule="evenodd" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Modals and Overlays */}
      {nonRenpyWarningPath && (
        <ConfirmModal
          title="Folder may not be a Ren'Py project"
          confirmText="Open Anyway"
          confirmClassName="bg-indigo-600 hover:bg-indigo-700"
          onConfirm={() => {
            const path = nonRenpyWarningPath;
            setNonRenpyWarningPath(null);
            loadProject(path);
          }}
          onClose={() => setNonRenpyWarningPath(null)}
        >
          The selected folder doesn't appear to contain a Ren'Py project — no{' '}
          <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-sm">game/</code>{' '}
          folder or <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-sm">.rpy</code>{' '}
          files were found. You can still open it, but it may not work as expected.
        </ConfirmModal>
      )}

      {isLoading && <LoadingOverlay progress={loadingProgress} message={loadingMessage} onCancel={handleCancelLoad} />}
      {isInitialAnalysisPending && !isLoading && <AnalysisOverlay blockCount={blocks.length} progress={analysisProgress} />}
      
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onDismiss={removeToast} />
          </div>
        ))}
      </div>

      <CreateBlockModal
        isOpen={createBlockModalOpen}
        onClose={() => setCreateBlockModalOpen(false)}
        onConfirm={(name, type) => handleCreateBlockConfirm(name, type, getSelectedFolderForNewBlock())}
        defaultPath={getSelectedFolderForNewBlock()}
      />

      <ConfigureRenpyModal
        isOpen={showConfigureRenpyModal}
        onClose={() => setShowConfigureRenpyModal(false)}
        onSave={(path) => {
            updateAppSettings(draft => { draft.renpyPath = path; });
            setShowConfigureRenpyModal(false);
            if (projectRootPath && window.electronAPI) {
                window.electronAPI.runGame(path, projectRootPath);
            }
        }}
      />

            {unsavedChangesModalInfo && (
                <ConfirmModal
                    title={unsavedChangesModalInfo.title}
                    onConfirm={unsavedChangesModalInfo.onConfirm}
                    onClose={unsavedChangesModalInfo.onCancel}
                    confirmText={unsavedChangesModalInfo.confirmText}
                    secondaryAction={{
                        onClick: unsavedChangesModalInfo.onDontSave,
                        label: unsavedChangesModalInfo.dontSaveText,
                        className: 'bg-red-600 hover:bg-red-700'
                    }}
                >
                        <div className="space-y-4">
                                <p>{unsavedChangesModalInfo.message}</p>
                        </div>
                </ConfirmModal>
            )}

      {deleteConfirmInfo && (
          <ConfirmModal
            title="Confirm Deletion"
            onConfirm={() => {
                deleteConfirmInfo.onConfirm();
                setDeleteConfirmInfo(null);
            }}
            onClose={() => setDeleteConfirmInfo(null)}
            confirmText="Delete"
            confirmClassName="bg-red-600 hover:bg-red-700"
          >
              Are you sure you want to delete {deleteConfirmInfo.paths.length} item(s)? This cannot be undone.
          </ConfirmModal>
      )}

      {contextMenuInfo && createPortal(
          <TabContextMenu
              x={contextMenuInfo.x}
              y={contextMenuInfo.y}
              tabId={contextMenuInfo.tabId}
              paneId={contextMenuInfo.paneId}
              splitLayout={splitLayout}
              onClose={() => setContextMenuInfo(null)}
              onCloseTab={(id) => handleCloseTab(id, contextMenuInfo.paneId)}
              onCloseOthers={(id) => handleCloseOthersRequest(id, contextMenuInfo.paneId)}
              onCloseLeft={(id) => handleCloseLeftRequest(id, contextMenuInfo.paneId)}
              onCloseRight={(id) => handleCloseRightRequest(id, contextMenuInfo.paneId)}
              onCloseAll={() => handleCloseAllRequest(contextMenuInfo.paneId)}
              onSplitRight={(id) => handleOpenInSplit(id, 'right')}
              onSplitBottom={(id) => handleOpenInSplit(id, 'bottom')}
              onMoveToOtherPane={(id) => handleMoveToOtherPane(id, contextMenuInfo.paneId)}
          />,
          document.body
      )}

      <SettingsModal 
        isOpen={settingsModalOpen} 
        onClose={() => setSettingsModalOpen(false)}
        settings={{ ...appSettings, ...projectSettings }}
        onSettingsChange={(key, value) => {
            if (key in appSettings) {
                updateAppSettings(draft => {
                    (draft as Record<string, unknown>)[key] = value;
                });
            } else {
                updateProjectSettings(draft => {
                    (draft as Record<string, unknown>)[key] = value;
                });
                setHasUnsavedSettings(true);
            }
        }}
        availableModels={AVAILABLE_MODELS}
      />

      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        mouseGestures={appSettings.mouseGestures}
        onOpenSettings={() => { setShortcutsModalOpen(false); setSettingsModalOpen(true); }}
      />

      <UserSnippetModal
        isOpen={userSnippetModalOpen}
        onClose={() => setUserSnippetModalOpen(false)}
        onSave={handleSaveSnippet}
        existingSnippet={editingSnippet}
      />

      <NewProjectWizardModal
        isOpen={wizardModalOpen}
        onClose={() => setWizardModalOpen(false)}
        onComplete={handleWizardComplete}
        sdkPath={appSettings.renpyPath}
        lastProjectDir={appSettings.lastProjectDir || ''}
        onProjectDirSaved={(dir) => updateAppSettings(draft => { draft.lastProjectDir = dir; })}
      />

      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />
    </div>
    </SearchProvider>
  );
};

export default App;
