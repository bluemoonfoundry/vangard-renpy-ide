// REVIEW: App.tsx is the app's central state hub (see CLAUDE.md's State Hub
// table) and was as large as ~5,300 lines pre-1.0; a tracked refactor
// (beads bmf-vangard-renpy-ide-cfo, closed) brought it to 2,464 lines by
// extracting focused hooks (useProjectIO, useAssetManagement,
// useCanvasLayout, useBlockManagement, DualPaneContext, etc.) -- it's since
// dropped further to ~2,250. That issue's closing notes identified two more
// possible extraction streams (a render-tree extraction for
// StoryElementsPanel/asset-tab callback memoization, and a
// CanvasLayoutContext for block-position/layout-trigger state) that were
// never turned into separate tracked work -- worth a decision on whether
// they're still worth pursuing given the size target was already met, or
// whether this is diminishing returns.
//
// TODO(bmf-vangard-renpy-ide-51mb): SettingsModal, MenuConstructorModal,
// NewProjectWizardModal, KeyboardShortcutsModal, AboutModal, and the other
// modals below are all static imports even though each only ever renders
// while its own "is open" flag is true -- same static-import-vs-bundle-size
// issue as src/hooks/useTabContentRenderer.tsx's tab components. Candidates
// for React.lazy()+Suspense.
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useImmer } from 'use-immer';
import Toolbar from '@/components/Toolbar';
import FileExplorerPanel from '@/components/FileExplorerPanel';
import SearchPanel from '@/components/SearchPanel';
import StoryElementsPanel from '@/components/StoryElementsPanel';
import SettingsModal from '@/components/SettingsModal';
import ConfirmModal from '@/components/ConfirmModal';
import CreateBlockModal from '@/components/CreateBlockModal';
import QuickCreateFileModal from '@/components/QuickCreateFileModal';
import ConfigureRenpyModal from '@/components/ConfigureRenpyModal';
import Toast from '@/components/Toast';
import LoadingOverlay from '@/components/LoadingOverlay';
import AnalysisOverlay from '@/components/AnalysisOverlay';
import WarpVariablesModal from '@/components/WarpVariablesModal';
import CrashLogModal from '@/components/CrashLogModal';
import { useDiagnostics } from '@/hooks/useDiagnostics';
import { useDebounce } from '@/hooks/useDebounce';
import TabContextMenu from '@/components/TabContextMenu';
import Sash from '@/components/Sash';
import StatusBar from '@/components/StatusBar';
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal';
import AboutModal from '@/components/AboutModal';
import ExternalChangesBanner from '@/components/ExternalChangesBanner';
import UserSnippetModal from '@/components/UserSnippetModal';
import NewProjectWizardModal from '@/components/NewProjectWizardModal';
import { MenuConstructorModal } from '@/components/MenuConstructorModal';
import FirstRunTutorial from '@/components/FirstRunTutorial';
import { SearchProvider } from '@/contexts/SearchContext';
import { DualPaneContext } from '@/contexts/DualPaneContext';
import type { DualPaneContextValue } from '@/contexts/DualPaneContext';
import GoToLabelModal, { GoToLabelItem } from '@/components/GoToLabelModal';
import { useRenpyAnalysis, deriveSceneImageNames } from '@/hooks/useRenpyAnalysis';
import { useHistory } from '@/hooks/useHistory';
import { useProjectColorScan } from '@/hooks/useProjectColorScan';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useToasts } from '@/hooks/useToasts';
import { useMilestones } from '@/hooks/useMilestones';
import { useModalState } from '@/hooks/useModalState';
import { useTabManagement } from '@/hooks/useTabManagement';
import { useCanvasInteraction, type CanvasTransform } from '@/hooks/useCanvasInteraction';
import { useNotecards } from '@/hooks/useNotecards';
import { useAssetManagement } from '@/hooks/useAssetManagement';
import { useDraftingArtifacts } from '@/hooks/useDraftingArtifacts';
import { useCompositionState } from '@/hooks/useCompositionState';
import { useSettingsManagement } from '@/hooks/useSettingsManagement';
import { useFileSystemState } from '@/hooks/useFileSystemState';
import { useStickyNotes } from '@/hooks/useStickyNotes';
import { useProjectLoad, type PendingStoryLayoutRefresh, type PendingRouteLayoutRefresh } from '@/hooks/useProjectLoad';
import { useProjectIO } from '@/hooks/useProjectIO';
import { useFileSystemManager } from '@/hooks/useFileSystemManager';
import { useTabContentRenderer } from '@/hooks/useTabContentRenderer';
import { useCharacterManagement } from '@/hooks/useCharacterManagement';
import { useUntitledFiles } from '@/hooks/useUntitledFiles';
import { useTabLifecycle } from '@/hooks/useTabLifecycle';
import { useTabOpeners } from '@/hooks/useTabOpeners';
import { useMainWindowPopoutSync, POPOUT_SUPPORTED_TAB_TYPES } from '@/hooks/usePopoutSync';
import { useStoryElementsPanel } from '@/hooks/useStoryElementsPanel';
import { useEditorSelectionActions } from '@/hooks/useEditorSelectionActions';
import { useCanvasLayout } from '@/hooks/useCanvasLayout';
import { useBlockManagement } from '@/hooks/useBlockManagement';
import { useLoadingState } from '@/hooks/useLoadingState';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useExternalFileChanges } from '@/hooks/useExternalFileChanges';
import { useGameExecution } from '@/hooks/useGameExecution';
import { useWarpLaunch } from '@/hooks/useWarpLaunch';
import { useMenuCommandDispatch } from '@/hooks/useMenuCommandDispatch';
import { useGoToLabel } from '@/hooks/useGoToLabel';
import { formatErrorMessage } from '@/lib/formatErrorMessage';
import { computeRouteCanvasLayout } from '@/lib/routeCanvasLayout';
import { resolveWarpTarget } from '@/lib/warpTarget';
import { logger } from '@/lib/logger';
import { pruneOrphanedEditorTabs } from '@/lib/tabReconciliation';
import { UI_TIMING } from '@/lib/constants';
import { DEFAULT_FILE_SIZE_THRESHOLDS, getLineCount } from '@/lib/fileSizeSeverity';
import {
  buildAfterWarpScript,
  getWarpVariableDrafts,
  hasAfterWarpLabel,
  type WarpVariableDraft,
} from '@/lib/warpAfterWarp';
import type {
  Block, BlockGroup, Position, FileSystemTreeNode, EditorTab,
  Theme,
  ProjectSettings, PunchlistMetadata, DiagnosticsTask, IgnoredDiagnosticRule,
  UserSnippet, MenuTemplate,
} from '@/types';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';



export function applyTheme(root: HTMLElement, theme: Theme): void {
  root.classList.remove(
    'dark',
    'theme-solarized-light',
    'theme-solarized-dark',
    'theme-colorful',
    'theme-colorful-light',
    'theme-neon-dark',
    'theme-ocean-dark',
    'theme-candy-light',
    'theme-forest-light',
    'theme-synthwave',
  );
  if (theme === 'dark') root.classList.add('dark');
  if (theme === 'solarized-light') root.classList.add('theme-solarized-light');
  if (theme === 'solarized-dark') root.classList.add('dark', 'theme-solarized-dark');
  if (theme === 'colorful') root.classList.add('dark', 'theme-colorful');
  if (theme === 'colorful-light') root.classList.add('theme-colorful-light');
  if (theme === 'neon-dark') root.classList.add('dark', 'theme-neon-dark');
  if (theme === 'ocean-dark') root.classList.add('dark', 'theme-ocean-dark');
  if (theme === 'candy-light') root.classList.add('theme-candy-light');
  if (theme === 'forest-light') root.classList.add('theme-forest-light');
  if (theme === 'synthwave') root.classList.add('dark', 'theme-synthwave');
}

// --- Main App Component ---

const App: React.FC = () => {
  // --- State: Blocks & Groups (Undo/Redo) ---
  const { state: blocks, setState: setBlocks, undo, redo, canUndo, canRedo } = useHistory<Block[]>([]);
  const [groups, setGroups] = useImmer<BlockGroup[]>([]);
  
  // Use a ref to track blocks for effects that need current blocks without triggering updates
  const blocksRef = useRef(blocks);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  // --- State: File System & Environment ---
  const {
    projectRootPath,
    setProjectRootPath,
    fileSystemTree,
    setFileSystemTree,
    explorerSelectedPaths,
    explorerLastClickedPath,
    setExplorerSelectedPaths,
    setExplorerLastClickedPath,
    explorerExpandedPaths,
    setExplorerExpandedPaths,
    explorerExternalAction,
    setExplorerExternalAction,
    clipboard,
    setClipboard,
    selectPath: _selectPath,
    selectPaths: _selectPaths,
    clearExplorerSelection: _clearExplorerSelection,
    expandPath: _expandPath,
    collapsePath: _collapsePath,
    toggleExpansion: _toggleExpansion,
    expandAll: _expandAll,
    collapseAll: _collapseAll,
    triggerNewFile: _triggerNewFile,
    triggerNewFolder: _triggerNewFolder,
    triggerRename: _triggerRename,
    copyToClipboard: _copyToClipboard,
    cutToClipboard: _cutToClipboard,
    clearClipboard: _clearClipboard,
    closeProject: _closeFileSystemProject,
  } = useFileSystemState();

  // Update window title based on project path
  useEffect(() => {
    if (projectRootPath) {
      document.title = `Vangard Studio ${process.env.APP_VERSION} (${projectRootPath})`;
    } else {
      document.title = `Vangard Studio ${process.env.APP_VERSION}`;
    }
  }, [projectRootPath]);

  // --- State: UI & Editor ---
  const {
    openTabs,
    activeTabId,
    setOpenTabs,
    setActiveTabId,
    secondaryOpenTabs,
    secondaryActiveTabId,
    activePaneId,
    setSecondaryOpenTabs,
    setSecondaryActiveTabId,
    setActivePaneId,
    splitLayout,
    splitPrimarySize,
    setSplitLayout,
    setSplitPrimarySize,
    draggedTabId,
    dragSourcePaneId,
    setDraggedTabId,
    setDragSourcePaneId,
    closedTabsStack,
    setClosedTabsStack,
    poppedOutTabs,
    setPoppedOutTabs,
    openTab: _openTab,
    closeTab: _closeTab,
    switchTab: _switchTab,
    updateTab: _updateTab,
    closeTabs: _closeTabs,
    setTabs,
    createSplit: _createSplit,
    closeSplit: _closeSplit,
    setSplitSize: _setSplitSize,
    moveTabToPane: _moveTabToPane,
    startDrag: _startTabDrag,
    endDrag: _endTabDrag,
    findTab: _findTab,
    getActiveTab: _getActiveTab,
  } = useTabManagement();

  // Canvas interaction state
  const {
    storyCanvasTransform,
    routeCanvasTransform,
    choiceCanvasTransform,
    setStoryCanvasTransform,
    setRouteCanvasTransform,
    setChoiceCanvasTransform,
    selectedBlockIds,
    selectedGroupIds,
    setSelectedBlockIds,
    setSelectedGroupIds,
    findUsagesHighlightIds,
    hoverHighlightIds,
    setFindUsagesHighlightIds,
    setHoverHighlightIds,
    centerOnBlockRequest,
    centerOnRouteStartRequest,
    centerOnChoiceStartRequest,
    centerOnRouteNodeRequest,
    centerOnChoiceNodeRequest,
    flashBlockRequest,
    setCenterOnBlockRequest,
    setCenterOnRouteStartRequest,
    setCenterOnChoiceStartRequest,
    setCenterOnRouteNodeRequest,
    setCenterOnChoiceNodeRequest,
    setFlashBlockRequest,
    canvasFilters,
    setCanvasFilters,
    centerOnBlock: _centerOnBlock,
    flashBlock: _flashBlock,
    centerOnRouteNode: _centerOnRouteNode,
    centerOnChoiceNode: _centerOnChoiceNode,
    centerOnRouteStart: _centerOnRouteStart,
    centerOnChoiceStart: _centerOnChoiceStart,
    clearSelection: _clearSelection,
    selectBlocks: _selectBlocks,
    selectGroups: _selectGroups,
    toggleBlockSelection: _toggleBlockSelection,
  } = useCanvasInteraction();
  const [notecardCanvasTransform, setNotecardCanvasTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 });
  // Punchlist State (kept for migration — not written on save)
  const [punchlistMetadata, setPunchlistMetadata] = useImmer<Record<string, PunchlistMetadata>>({});
  // Diagnostics Tasks State
  const [diagnosticsTasks, setDiagnosticsTasks] = useImmer<DiagnosticsTask[]>([]);
  const [ignoredDiagnostics, setIgnoredDiagnostics] = useImmer<IgnoredDiagnosticRule[]>([]);
  const [dismissedImplicitVarHint, setDismissedImplicitVarHint] = useState(false);

  const {
    dirtyBlockIds, setDirtyBlockIds,
    dirtyEditors, setDirtyEditors,
    dirtyBlockIdsRef, dirtyEditorsRef,
    hasUnsavedSettings, setHasUnsavedSettings,
    saveStatus, setSaveStatus,
  } = useDirtyState();

  // Composition state (Scene/ImageMap/ScreenLayout composers)
  const {
    sceneCompositions,
    sceneNames,
    setSceneCompositions,
    setSceneNames,
    imagemapCompositions,
    setImagemapCompositions,
    clearAllCompositions: _clearAllCompositions,
    handleCreateScene,
    handleOpenScene,
    handleSceneUpdate,
    handleRenameScene,
    handleDeleteScene,
    handleCreateImageMap,
    handleOpenImageMap,
    handleImageMapUpdate,
    handleRenameImageMap,
    handleDeleteImageMap,
  } = useCompositionState({ activeTabId, setOpenTabs, setActiveTabId, setHasUnsavedSettings });
  const [isScanningAssets, setIsScanningAssets] = useState(false);

  // Toast notifications
  const { toasts, addToast, removeToast } = useToasts();

  // Modal state
  const {
    createBlockModalOpen,
    createBlockModalType,
    createBlockModalPosition,
    createBlockModalFolderPath,
    openCreateBlockModal,
    closeCreateBlockModal,
    deleteConfirmInfo,
    openDeleteConfirmModal,
    closeDeleteConfirmModal,
    unsavedChangesModalInfo,
    openUnsavedChangesModal,
    closeUnsavedChangesModal,
    contextMenuInfo,
    openContextMenu,
    closeContextMenu,
    settingsModalOpen,
    openSettingsModal,
    closeSettingsModal,
    shortcutsModalOpen,
    openShortcutsModal,
    closeShortcutsModal,
    aboutModalOpen,
    openAboutModal,
    closeAboutModal,
    showConfigureRenpyModal,
    openConfigureRenpyModal,
    closeConfigureRenpyModal,
    wizardModalOpen,
    openWizardModal,
    closeWizardModal,
    showTutorial,
    openTutorial,
    closeTutorial,
    isGoToLabelOpen,
    openGoToLabelModal,
    closeGoToLabelModal,
    isWarpToLabelOpen,
    openWarpToLabelModal,
    closeWarpToLabelModal,
    isWarpVariablesOpen,
    openWarpVariablesModal,
    closeWarpVariablesModal,
    userSnippetModalOpen,
    editingSnippet,
    openUserSnippetModal,
    closeUserSnippetModal,
    menuConstructorModalOpen,
    editingMenuTemplate,
    openMenuConstructorModal,
    closeMenuConstructorModal,
  } = useModalState();

  const [nonRenpyWarningPath, setNonRenpyWarningPath] = useState<string | null>(null);
  
  // --- State: Application and Project Settings ---
  const {
    appSettings,
    updateAppSettings,
    appSettingsLoaded,
    setAppSettingsLoaded,
    projectSettings,
    updateProjectSettings,
    characterProfiles,
    setCharacterProfiles,
    isRenpyPathValid,
    setIsRenpyPathValid,
    isGeneratingTranslations,
    setIsGeneratingTranslations,
    updateTheme: _updateTheme,
    updateRenpyPath: _updateRenpyPath,
    updateEditorFont: _updateEditorFont,
    toggleSidebar: _toggleSidebar,
    updateSidebarWidth: _updateSidebarWidth,
    addRecentProject: _addRecentProject,
    removeRecentProject: _removeRecentProject,
    clearRecentProjects: _clearRecentProjects,
    resetAppSettings: _resetAppSettings,
    resetProjectSettings: _resetProjectSettings,
  } = useSettingsManagement();

  // Sticky notes (managed separately from composition state)
  const {
    stickyNotes,
    routeStickyNotes,
    choiceStickyNotes,
    setStickyNotes,
    setRouteStickyNotes,
    setChoiceStickyNotes,
    addStickyNote,
    updateStickyNote,
    deleteStickyNote,
    addRouteStickyNote,
    updateRouteStickyNote,
    deleteRouteStickyNote,
    addChoiceStickyNote,
    updateChoiceStickyNote,
    deleteChoiceStickyNote,
    clearAllStickyNotes: _clearAllStickyNotes,
  } = useStickyNotes({
    appSettings,
    storyCanvasTransform,
    onStickyNoteChange: () => setHasUnsavedSettings(true),
  });

  // Notecard Canvas board
  const {
    notecards, notecardLinks, timelineSettings: notecardTimeline,
    setNotecards, setNotecardLinks, setTimelineSettings: setNotecardTimeline,
    addNotecard, updateNotecard, deleteNotecard, deleteNotecards, restoreNotecards,
    addNotecardLink, updateNotecardLink, deleteNotecardLink,
    renameTimelineSlot: renameNotecardTimelineSlot,
    moveNotecardWithinTimeline, unassignNotecardFromTimeline,
    insertTimelineSlot, deleteTimelineSlot,
  } = useNotecards({
    appSettings,
    notecardCanvasTransform,
    onNotecardChange: () => setHasUnsavedSettings(true),
  });

  // --- State: Misc ---
  const [editorCursorPosition, setEditorCursorPosition] = useState<{ line: number; column: number } | null>(null);
  const [editorCursorBlockId, setEditorCursorBlockId] = useState<string | null>(null);

  // --- State: Flow Canvas (label-level flow graph) ---
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

  const [perfSnapshot, perfRecorders] = usePerformanceMetrics();

  // Asset management state
  const {
    images,
    imageMetadata,
    imageScanDirectories,
    imagesLastScanned,
    isRefreshingImages,
    setImages,
    setImageScanDirectories,
    setImagesLastScanned,
    setIsRefreshingImages,
    audios,
    audioMetadata,
    audioScanDirectories,
    audiosLastScanned,
    isRefreshingAudios,
    setAudios,
    setAudioScanDirectories,
    setAudiosLastScanned,
    setIsRefreshingAudios,
    addImage: _addImage,
    removeImage: _removeImage,
    updateImageMetadata: _updateImageMetadata,
    addAudio: _addAudio,
    removeAudio: _removeAudio,
    updateAudioMetadata: _updateAudioMetadata,
    clearImages: _clearImages,
    clearAudios: _clearAudios,
    handleAddImageScanDirectory,
    handleRefreshImages,
    handleRemoveImageScanDirectory,
    handleCopyImagesToProjectBulk,
    handleAddAudioScanDirectory,
    handleRefreshAudios,
    handleRemoveAudioScanDirectory,
    handleCopyAudiosToProjectBulk,
    handleSaveImageMetadata,
    handleCopyImageToProject,
    handleSaveAudioMetadata,
    handleCopyAudioToProject,
    cancelAssetScan,
  } = useAssetManagement({
    projectRootPath, perfRecorders, setIsScanningAssets, setHasUnsavedSettings, setFileSystemTree, addToast,
    setOpenTabs, setSecondaryOpenTabs, setActiveTabId, setSecondaryActiveTabId,
  });

  const [analysisResult, isWorkerPending, analysisProgress] = useRenpyAnalysis(analysisBlocks, 0, perfRecorders.recordAnalysis);
  // Pending covers both: the 500ms debounce window AND the worker's async computation
  const isAnalysisPending = blocks !== debouncedBlocks || isWorkerPending;
  const diagnosticsResult = useDiagnostics(debouncedBlocks, analysisResult, images, imageMetadata, audios, audioMetadata, ignoredDiagnostics);

  const {
    isLoading, setIsLoading,
    isInitialAnalysisPending, setIsInitialAnalysisPending,
    loadingMessage, setLoadingMessage,
    loadingProgress, setLoadingProgress,
    loadCancelRef,
    handleCancelLoad,
  } = useLoadingState({ isWorkerPending, addToast });

  const {
    pendingWarpLabelName,
    pendingWarpTarget,
    pendingWarpVariableDrafts,
    cleanupWarpTempFile,
    resetWarpLaunchState,
    handleConfirmWarpVariables,
    handleWarpToLabel,
  } = useWarpLaunch({
    projectRootPath,
    renpyPath: appSettings.renpyPath,
    blocks,
    analysisResult,
    addToast,
    closeWarpVariablesModal,
    closeWarpToLabelModal,
    openWarpVariablesModal,
  });

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
  
  const { notifyFirstSave } = useMilestones({
    blocks,
    analysisResult,
    images,
    projectSettings,
    updateProjectSettings,
    addToast,
  });

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
  const pendingTagRenameRef = useRef<{ oldTag: string; newTag: string } | null>(null);
  const pendingAutoCenterRef = useRef({ story: false, route: false, choice: false });

  const {
    externallyChangedFiles,
    setExternallyChangedFiles,
    filesWithDiskConflict,
    setFilesWithDiskConflict,
    handleKeepCurrentFile,
  } = useExternalFileChanges({
    projectRootPath,
    blocksRef,
    dirtyBlockIdsRef,
    dirtyEditorsRef,
    setBlocks,
    editorInstances,
    addToast,
  });

  // --- Utility Functions ---
  const _getCurrentContext = useCallback(() => {
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

  const _getCurrentBlockId = useCallback(() => {
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

  const allStickyNotes = useMemo(
    () => [...stickyNotes, ...routeStickyNotes, ...choiceStickyNotes],
    [stickyNotes, routeStickyNotes, choiceStickyNotes]
  );

  const analysisLabelKeys = useMemo(
    () => Object.keys(analysisResult.labels),
    [analysisResult.labels]
  );

  const scenesArray = useMemo(
    () => Object.keys(sceneCompositions).map(id => ({ id, name: sceneNames[id] || 'Scene' })),
    [sceneCompositions, sceneNames]
  );

  const imagemapsArray = useMemo(
    () => Object.keys(imagemapCompositions).map(id => ({ id, name: imagemapCompositions[id]?.screenName || 'ImageMap' })),
    [imagemapCompositions]
  );


  const settingsMerged = useMemo(
    () => ({ ...appSettings, ...projectSettings }),
    [appSettings, projectSettings]
  );

  const menuLabels = useMemo(
    () => new Set(analysisLabelKeys),
    [analysisLabelKeys]
  );

  const menuVariables = useMemo(
    () => new Set(analysisResult.variables.keys()),
    [analysisResult.variables]
  );

  // --- Project Color Scan ---
  const projectColors = useProjectColorScan(blocks);

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
  const handleClearFindUsages = useCallback(() => setFindUsagesHighlightIds(null), [setFindUsagesHighlightIds]);
  const canvasInteractionEnd = useCallback(() => {}, []);

  // Split into two memos so that dragging route nodes (which updates routeNodeLayoutCache)
  // only reruns the cheap position-override step, not the expensive analysis + layout pass.
  // Route graph data (labelNodes, routeLinks, identifiedRoutes) comes directly from the
  // worker result — calling performRouteAnalysis again here would duplicate the expensive
  // findPaths computation on the main thread and freeze the UI on large projects.
  const routeRaw = useMemo(() => {
      const layoutMode = projectSettings.routeCanvasLayoutMode ?? 'flow-lr';
      const groupingMode = projectSettings.routeCanvasGroupingMode ?? 'none';
      const nodesWithScenes = deriveSceneImageNames(analysisResult.labelNodes, blocks);
      const layoutedNodes = computeRouteCanvasLayout(nodesWithScenes, analysisResult.routeLinks, layoutMode, groupingMode);
      return {
          labelNodes: layoutedNodes,
          routeLinks: analysisResult.routeLinks,
          identifiedRoutes: analysisResult.identifiedRoutes,
          routesTruncated: analysisResult.routesTruncated,
      };
  }, [analysisResult, blocks, projectSettings.routeCanvasGroupingMode, projectSettings.routeCanvasLayoutMode]);

  const routeAnalysisResult = useMemo(() => {
      // Apply user-dragged position overrides on top of the auto-layout result.
      const finalNodes = routeRaw.labelNodes.map(n => {
          const cached = routeNodeLayoutCache.get(n.id);
          return cached ? { ...n, position: cached } : n;
      });
      return { ...routeRaw, labelNodes: finalNodes };
  }, [routeRaw, routeNodeLayoutCache]);


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
  }, [activeTabId, openTabs, blocks, setExplorerExpandedPaths, setExplorerLastClickedPath, setExplorerSelectedPaths]);

  const handleToggleExpandExplorer = useCallback((path: string) => {
      setExplorerExpandedPaths(prev => {
          const newSet = new Set(prev);
          if (newSet.has(path)) newSet.delete(path);
          else newSet.add(path);
          return newSet;
      });
  }, [setExplorerExpandedPaths]);


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
        logger.error('Failed to load app settings:', err);
      }).finally(() => {
        setAppSettingsLoaded(true);
      });
      const unsubSettingsWarning = window.electronAPI?.onSettingsWarning?.(() => {
        addToast('App settings could not be read — using defaults', 'warning');
      });
      return unsubSettingsWarning;
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
        } catch (e) { logger.error("Failed to load app settings from localStorage", e); }
      }
      setAppSettingsLoaded(true);
    }
  }, [updateAppSettings, setAppSettingsLoaded, addToast]);

  // --- CLI --project flag: auto-open a project on startup ---
  // Runs once after app settings have loaded to avoid racing the settings fetch.
  useEffect(() => {
    if (!appSettingsLoaded || !window.electronAPI?.getStartupArgs) return;
    window.electronAPI.getStartupArgs().then(({ projectPath }) => {
      if (projectPath) loadProject(projectPath);
    }).catch(err => logger.error('Failed to read startup args:', err));
  }, [appSettingsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!appSettingsLoaded) return;

    if (window.electronAPI?.saveAppSettings) {
      window.electronAPI.saveAppSettings(appSettings)
        .then(result => {
            if (!result || !result.success) {
                logger.error('Failed to save app settings:', result?.error);
            }
        })
        .catch(err => logger.error('Failed to save app settings:', err));
    } else {
      localStorage.setItem('renpy-ide-app-settings', JSON.stringify(appSettings));
    }
    
    const root = window.document.documentElement;
    const resolvedTheme = appSettings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : appSettings.theme;
    applyTheme(root, resolvedTheme);
  }, [appSettings, appSettingsLoaded]);

  // --- Check Ren'Py Path Validity ---
  useEffect(() => {
    if (window.electronAPI?.checkRenpyPath && appSettings.renpyPath) {
      window.electronAPI.checkRenpyPath(appSettings.renpyPath).then(setIsRenpyPathValid).catch(() => setIsRenpyPathValid(false));
    } else {
      setIsRenpyPathValid(false);
    }
  }, [appSettings.renpyPath, setIsRenpyPathValid]);

  const {
    updateBlock, updateGroup, updateBlockPositions, updateGroupPositions,
    addBlock, handleCreateBlockConfirm, handleCreateBlockFromCanvas,
    deleteBlock, deleteBlockWithFile, deleteBlocksWithFile,
    createGroupFromSelection, deleteGroup, getSelectedFolderForNewBlock,
  } = useBlockManagement({
    blocks, setBlocks, setGroups, setDirtyBlockIds,
    updateProjectSettings, setHasUnsavedSettings,
    appSettings, storyCanvasTransform,
    setCenterOnBlockRequest, setFlashBlockRequest, setSelectedBlockIds,
    activeTabId, setActiveTabId, setOpenTabs,
    secondaryActiveTabId, setSecondaryActiveTabId, setSecondaryOpenTabs, setSplitLayout, setActivePaneId,
    fileSystemTree, setFileSystemTree,
    projectRootPath, explorerSelectedPaths,
    openCreateBlockModal, openDeleteConfirmModal,
    addToast,
  });

  // --- Untitled (blank) File Tabs ---
  const { untitledFiles, untitledFilesRef, createUntitledFile, updateUntitledContent, setUntitledDirty, saveUntitledFile, discardUntitledFile } = useUntitledFiles({
    projectRootPath, blocks, addBlock, updateBlock, setFileSystemTree, addToast,
    activePaneId, splitLayout,
    setOpenTabs, setActiveTabId, setSecondaryOpenTabs, setSecondaryActiveTabId,
    setActivePaneId, setSplitLayout,
    poppedOutTabs, setPoppedOutTabs,
  });

  // --- Layout ---
  const {
    handleTidyUp,
    applyRouteLayout,
    handleChangeStoryCanvasLayoutMode, handleChangeStoryCanvasGroupingMode,
    handleChangeRouteCanvasLayoutMode, handleChangeRouteCanvasGroupingMode,
  } = useCanvasLayout({
    blocks, setBlocks,
    analysisResult, routeAnalysisResult,
    routeNodeLayoutCache, setRouteNodeLayoutCache,
    pendingStoryLayoutRefreshRef, pendingRouteLayoutRefreshRef, pendingAutoCenterRef,
    projectSettings, updateProjectSettings, setHasUnsavedSettings, addToast,
    isAnalysisPending, isInitialAnalysisPending,
    setCenterOnBlockRequest, setCenterOnRouteStartRequest, setCenterOnChoiceStartRequest,
  });

  // (Layout callbacks and effects extracted to useCanvasLayout)


  // --- File System Integration ---

  const { loadProject } = useProjectLoad({
      loadCancelRef, blocksRef, pendingStoryLayoutRefreshRef, pendingRouteLayoutRefreshRef,
      pendingAutoCenterRef,
      setIsLoading, setLoadingProgress, setLoadingMessage,
      updateAppSettings,
      setHasUnsavedSettings, setIsInitialAnalysisPending, perfRecorders, addToast,
      poppedOutTabs, setPoppedOutTabs,
      hydrateSetters: {
          pendingStoryLayoutRefreshRef, pendingRouteLayoutRefreshRef, pendingAutoCenterRef,
          setProjectRootPath, setFileSystemTree,
          updateProjectSettings,
          setBlocks,
          setImages, setAudios, setImageScanDirectories, setAudioScanDirectories, setIsScanningAssets,
          setIsRefreshingImages, setIsRefreshingAudios, setImagesLastScanned, setAudiosLastScanned,
          setStickyNotes, setRouteStickyNotes, setChoiceStickyNotes, setNotecards, setNotecardLinks, setNotecardTimeline,
          setCharacterProfiles,
          setPunchlistMetadata, setDiagnosticsTasks, setIgnoredDiagnostics, setDismissedImplicitVarHint,
          setSceneCompositions, setSceneNames, setImagemapCompositions,
          setRouteNodeLayoutCache,
          setOpenTabs, setActiveTabId, setSecondaryOpenTabs, setSecondaryActiveTabId,
          setSplitLayout, setSplitPrimarySize, setTabs,
          perfRecorders,
      },
  });

  const {
      handleSaveProjectSettings,
      handleSaveAll,
      handleReloadFromDisk,
      handleRefreshProject,
  } = useProjectIO({
      blocksRef, dirtyBlockIdsRef, dirtyEditorsRef, editorInstances,
      projectRootPath, setFileSystemTree,
      projectSettings,
      blocks, setBlocks,
      setImages, setAudios, imageScanDirectories, audioScanDirectories,
      stickyNotes, routeStickyNotes, choiceStickyNotes, notecards, notecardLinks, notecardTimeline, characterProfiles,
      punchlistMetadata, diagnosticsTasks, ignoredDiagnostics, dismissedImplicitVarHint,
      sceneCompositions, sceneNames, imagemapCompositions,
      routeNodeLayoutCache,
      openTabs, activeTabId, secondaryOpenTabs, secondaryActiveTabId, splitLayout, splitPrimarySize,
      dirtyBlockIds, setDirtyBlockIds, dirtyEditors, setDirtyEditors,
      setHasUnsavedSettings, setSaveStatus, filesWithDiskConflict, setFilesWithDiskConflict,
      setExternallyChangedFiles, notifyFirstSave, openUnsavedChangesModal, closeUnsavedChangesModal,
      setOpenTabs,
      untitledFiles, saveUntitledFile,
      addToast,
  });



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
          logger.error('Failed to open project:', err);
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
        logger.error('Failed to open project', err);
        addToast('Failed to open project', 'error');
    }
  }, [handleOpenWithRenpyCheck, addToast]);

  const handleCreateProject = useCallback(() => {
      // Open the new project wizard modal
      openWizardModal();
  }, [openWizardModal]);

  const handleWizardComplete = useCallback(async (projectPath: string) => {
      closeWizardModal();
      try {
          await loadProject(projectPath);
          addToast('Project created successfully', 'success');
      } catch (err) {
          logger.error('Failed to load newly created project', err);
          addToast('Failed to load the newly created project', 'error');
      }
  }, [loadProject, addToast, closeWizardModal]);

  // --- Drafting Mode Logic ---
  const { updateDraftingArtifacts, handleToggleDraftingMode } = useDraftingArtifacts({
      projectRootPath, blocks, draftingMode: projectSettings.draftingMode,
      definedImages: analysisResult.definedImages, definedVariables: analysisResult.variables,
      existingImageTags, existingAudioPaths, updateProjectSettings, setHasUnsavedSettings, addToast,
  });

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

  const handleSaveBlock = useCallback(async (blockId: string, liveContent?: string) => {
    const editor = editorInstances.current.get(blockId);
    const block = blocksRef.current.find(b => b.id === blockId);
    // No local Monaco instance means this tab isn't open in *this* window --
    // e.g. it's been popped out into its own window, which keeps blocksRef
    // current via the same updateBlock/setBlockContent calls a local edit
    // would make. Fall back to that instead of silently no-op'ing.
    if (!editor && !block) return;
    // liveContent (passed by a popout that read its own Monaco instance directly)
    // takes priority over blocksRef -- the popout's own flush-then-save call already
    // relays this same value via setBlockContent first, but that's a separate RPC
    // round trip, and relying on blocksRef having synced from it by the time *this*
    // call runs isn't guaranteed. Passing the value straight through removes that race.
    const contentToSave = liveContent !== undefined ? liveContent : (editor ? editor.getValue() : (block?.content ?? ''));

    const doSave = async () => {
      try {
        if (window.electronAPI && projectRootPath) {
          const b = blocksRef.current.find(b => b.id === blockId);
          if (b?.filePath) {
            const absPath = await window.electronAPI.path.join(projectRootPath, b.filePath) as string;
            const res = await window.electronAPI.writeFile(absPath, contentToSave);
            if (res.success) {
              addToast(`Saved ${b.title || 'file'}`, 'success');
              setFilesWithDiskConflict(prev => { const next = new Set(prev); next.delete(b.filePath!); return next; });
            } else {
              addToast(`Failed to save: ${String(res.error)}`, 'error');
              return;
            }
          }
        }
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content: contentToSave } : b));
        setDirtyBlockIds(prev => { const next = new Set(prev); next.delete(blockId); return next; });
        setDirtyEditors(prev => { const next = new Set(prev); next.delete(blockId); return next; });
        notifyFirstSave();
        if (projectSettings.draftingMode) updateDraftingArtifacts();
      } catch (err) {
        logger.error('Failed to save block:', err);
        addToast('Failed to save file', 'error');
      }
    };

    if (block?.filePath && filesWithDiskConflict.has(block.filePath)) {
      openUnsavedChangesModal({
        title: 'Overwrite External Changes?',
        message: `"${block.title || block.filePath}" was changed on disk after you last loaded it. Your editor version will overwrite those changes.`,
        confirmText: 'Overwrite and Save',
        dontSaveText: 'Cancel',
        onConfirm: async () => { closeUnsavedChangesModal(); await doSave(); },
        onDontSave: () => closeUnsavedChangesModal(),
        onCancel: () => closeUnsavedChangesModal(),
      });
      return;
    }

    await doSave();
  }, [projectRootPath, projectSettings.draftingMode, addToast, setBlocks, updateDraftingArtifacts, filesWithDiskConflict, notifyFirstSave, openUnsavedChangesModal, closeUnsavedChangesModal]);
  

  const handleGenerateTranslations = useCallback(async (language: string) => {
    if (!appSettings.renpyPath || !projectRootPath) return;
    setIsGeneratingTranslations(true);
    try {
      const result = await window.electronAPI!.generateTranslations(appSettings.renpyPath, projectRootPath, language);
      if (result.success) {
        addToast(`Translation files generated for "${language}"`, 'success');
        await handleRefreshProject();
      } else {
        const detail = result.error || 'Unknown error';
        logger.error('Generate translations failed:\n', detail);
        // Show first meaningful line in the toast, full output is in the console
        const firstLine = detail.split('\n').find(l => l.trim().length > 0) || detail;
        addToast(`Translation generation failed: ${firstLine}`, 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Failed to generate translations: ${msg}`, 'error');
    } finally {
      setIsGeneratingTranslations(false);
    }
  }, [appSettings.renpyPath, projectRootPath, addToast, handleRefreshProject, setIsGeneratingTranslations]);

  const handleNewProjectRequest = useCallback(async () => {
    // Flush any popped-out editor's still-debouncing edit into dirty state first --
    // otherwise a block being actively typed in a popout window (still inside
    // Monaco's 800ms onContentChange debounce) might not have flipped its dirty
    // flag yet, letting this unsaved-changes check slip past it. dirtyBlockIdsRef/
    // dirtyEditorsRef/untitledFilesRef (the *Ref mirrors, not the closure-captured
    // state) are read afterward so the flush's IPC round trip is actually picked up
    // -- hasUnsavedSettings is read directly since popout content flushing doesn't
    // affect it either way.
    await window.electronAPI?.flushAllPopouts?.();
    const hasUnsavedUntitled = [...untitledFilesRef.current.values()].some(f => f.isDirty);
    const hasUnsaved = dirtyBlockIdsRef.current.size > 0 || dirtyEditorsRef.current.size > 0 || hasUnsavedSettings || hasUnsavedUntitled;

    if (hasUnsaved) {
      openUnsavedChangesModal({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Do you want to save them before creating a new project?',
        confirmText: 'Save & Create',
        dontSaveText: "Don't Save & Create",
        onConfirm: async () => {
          await handleSaveAll();
          handleCreateProject();
          closeUnsavedChangesModal();
        },
        onDontSave: () => {
          handleCreateProject();
          closeUnsavedChangesModal();
        },
        onCancel: () => {
          closeUnsavedChangesModal();
        }
      });
    } else {
      handleCreateProject();
    }
  }, [dirtyBlockIdsRef, dirtyEditorsRef, hasUnsavedSettings, untitledFilesRef, handleCreateProject, handleSaveAll, openUnsavedChangesModal, closeUnsavedChangesModal]);
  
  // --- Tab Management ---
  const {
    handleOpenEditor,
    handleOpenStaticTab,
    handleOpenRouteCanvasTab,
    handleOpenChoiceCanvasTab,
    handleOpenImageEditorTab,
    handleOpenMarkdownTab,
    handleOpenAudioEditorInTab,
    handlePathDoubleClick,
  } = useTabOpeners({
    blocksRef,
    openTabs, secondaryOpenTabs, activePaneId, splitLayout, poppedOutTabs,
    setOpenTabs, setSecondaryOpenTabs,
    setActiveTabId, setSecondaryActiveTabId, setActivePaneId,
  });

  const {
    handleCloseTab,
    processTabCloseRequest,
    handleCloseOthersRequest,
    handleCloseAllRequest,
    handleCloseLeftRequest,
    handleCloseRightRequest,
    handleSwitchTab,
    handleCreateSplit,
    handleOpenInSplit,
    handleMoveToOtherPane,
    handleCloseSecondaryPane,
    handleClosePrimaryPane,
    handleTabDragStart,
    handleTabDragOver,
    handleTabStripDragOver,
    handleTabDrop,
    handleTabDragEnd,
    handleReopenClosedTab,
    handlePopOutTab,
    handleRedockTab,
  } = useTabLifecycle({
    openTabs, secondaryOpenTabs, activeTabId, secondaryActiveTabId, splitLayout,
    draggedTabId, dragSourcePaneId,
    setOpenTabs, setSecondaryOpenTabs, setActiveTabId, setSecondaryActiveTabId, setActivePaneId,
    setSplitLayout, setSplitPrimarySize, setDraggedTabId, setDragSourcePaneId,
    closedTabsStack, setClosedTabsStack,
    poppedOutTabs, setPoppedOutTabs,
    dirtyBlockIds, dirtyEditors, setDirtyBlockIds, setDirtyEditors,
    untitledFiles, saveUntitledFile, discardUntitledFile,
    openUnsavedChangesModal, closeUnsavedChangesModal,
    handleSaveAll, setHasUnsavedSettings,
  });

  // See POPOUT_SUPPORTED_TAB_TYPES in src/hooks/usePopoutSync.ts for which tab types
  // can currently be detached -- the relay this feeds is built per-type there.
  const poppedOutSyncableTabs = useMemo(() => {
    const map = new Map<string, EditorTab>();
    for (const { tab } of poppedOutTabs.values()) {
      if (POPOUT_SUPPORTED_TAB_TYPES.has(tab.type)) map.set(tab.id, tab);
    }
    return map;
  }, [poppedOutTabs]);

  const setBlockContentFromPopout = useCallback((id: string, content: string) => {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, content } : b)));
  }, [setBlocks]);

  const setEditorDirtyFromPopout = useCallback((id: string, dirty: boolean) => {
    setDirtyEditors(prev => {
      const next = new Set(prev);
      if (dirty) next.add(id); else next.delete(id);
      return next;
    });
  }, [setDirtyEditors]);

  // Safety net: an 'editor' tab whose blockId no longer resolves in blocks[] (e.g. the
  // block was deleted/replaced through a path that didn't reconcile tabs) used to render
  // as a blank pane mislabeled "Untitled" (see useTabContentRenderer's blockId-not-found
  // fallback) instead of being closed. Prune those tabs whenever blocks changes.
  useEffect(() => {
    const blockIds = new Set(blocks.map(b => b.id));

    setOpenTabs(prev => {
      const { tabs: next, changed } = pruneOrphanedEditorTabs(prev, blockIds);
      if (!changed) return prev;
      if (activeTabId && !next.some(t => t.id === activeTabId)) {
        setActiveTabId(next[0]?.id ?? 'canvas');
      }
      return next;
    });

    setSecondaryOpenTabs(prev => {
      const { tabs: next, changed } = pruneOrphanedEditorTabs(prev, blockIds);
      if (!changed) return prev;
      if (next.length === 0) {
        setSplitLayout('none');
        setActivePaneId('primary');
        setSecondaryActiveTabId('');
      } else if (secondaryActiveTabId && !next.some(t => t.id === secondaryActiveTabId)) {
        setSecondaryActiveTabId(next[0].id);
      }
      return next;
    });

    // Same safety net for a popped-out editor tab -- pruneOrphanedEditorTabs above
    // only reconciles openTabs/secondaryOpenTabs, so a tab detached into its own
    // window whose backing block gets deleted would otherwise sit there indefinitely
    // and get resurrected as a stale tab when the window closes (handleRedockTab
    // unconditionally reinserts whatever poppedOutTabs still has for that id).
    setPoppedOutTabs(prev => {
      const orphaned = Array.from(prev.values()).filter(
        ({ tab }) => tab.type === 'editor' && !!tab.blockId && !blockIds.has(tab.blockId)
      );
      if (orphaned.length === 0) return prev;
      orphaned.forEach(({ tab }) => { void window.electronAPI?.closePopoutForTab?.(tab.id); });
      const next = new Map(prev);
      orphaned.forEach(({ tab }) => next.delete(tab.id));
      return next;
    });
  }, [blocks, activeTabId, secondaryActiveTabId, setOpenTabs, setSecondaryOpenTabs, setActiveTabId, setSecondaryActiveTabId, setSplitLayout, setActivePaneId, setPoppedOutTabs]);

  const handleTabContextMenu = useCallback((e: React.MouseEvent, tabId: string, paneId: 'primary' | 'secondary' = 'primary') => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, tabId, paneId);
  }, [openContextMenu]);

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
          }, UI_TIMING.CANVAS_CENTER_DELAY_MS);
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
  }, [blocks, analysisResult, addToast, stickyNotes, canvasFilters.notes, setActiveTabId, setCanvasFilters, setCenterOnBlockRequest]);

  const handleRevealInFileManager = useCallback(async (relativePath: string) => {
      if (!projectRootPath || !window.electronAPI) return;
      try {
          const absPath = await window.electronAPI.path.join(projectRootPath, relativePath) as string;
          await window.electronAPI.showItemInFolder?.(absPath);
      } catch (err) {
          logger.error('Failed to reveal item in file manager', err);
          addToast('Could not reveal file', 'error');
      }
  }, [projectRootPath, addToast]);

  const handleCopyPath = useCallback(async (relativePath: string) => {
      if (!projectRootPath || !window.electronAPI) return;
      try {
          const absPath = await window.electronAPI.path.join(projectRootPath, relativePath) as string;
          await navigator.clipboard.writeText(absPath);
          addToast('Path copied to clipboard', 'success');
      } catch (err) {
          logger.error('Failed to copy path', err);
          addToast('Could not copy path', 'error');
      }
  }, [projectRootPath, addToast]);

  // ── Go-to-label (Ctrl+G) ─────────────────────────────────────────────────────

  const activeCanvasTabId = activeTabId === 'canvas' || activeTabId === 'route-canvas' || activeTabId === 'choice-canvas'
    ? activeTabId : null;

  const activeFileBlock = useMemo(() => {
    const isSecondaryFocused = activePaneId === 'secondary' && splitLayout !== 'none';
    const focusedTabs = isSecondaryFocused ? secondaryOpenTabs : openTabs;
    const focusedTabId = isSecondaryFocused ? secondaryActiveTabId : activeTabId;
    const activeEditorTab = focusedTabs.find(t => t.id === focusedTabId && t.type === 'editor');
    if (!activeEditorTab?.blockId) return null;
    return blocks.find(b => b.id === activeEditorTab.blockId) ?? null;
  }, [openTabs, activeTabId, secondaryOpenTabs, secondaryActiveTabId, activePaneId, splitLayout, blocks]);
  const activeFileLineCount = activeFileBlock ? getLineCount(activeFileBlock.content) : null;

  const { goToLabelItems, goToLabelCanvasName, warpLabelItems, handleGoToLabel } = useGoToLabel({
    activeCanvasTabId,
    analysisResult,
    routeAnalysisResult,
    closeGoToLabelModal,
    setCenterOnBlockRequest,
    setCenterOnRouteNodeRequest,
    setCenterOnChoiceNodeRequest,
  });

  const {
    isGameRunning,
    screenshotCount,
    crashLog,
    dismissCrashLog,
    handleRunGame,
    handleOpenScreenshotsFolder,
    handleClearScreenshots,
    handleCopyLatestScreenshotPath,
  } = useGameExecution({
    projectRootPath,
    renpyPath: appSettings.renpyPath,
    isRenpyPathValid,
    onConfigureRenpy: openConfigureRenpyModal,
    addToast,
    cleanupWarpTempFile,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMetaShortcut = e.ctrlKey || e.metaKey;
      const isG = e.key.toLowerCase() === 'g';
      if (isMetaShortcut && e.shiftKey && isG) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (!projectRootPath) return;
        e.preventDefault();
        openWarpToLabelModal();
      } else if (isMetaShortcut && isG) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (!activeCanvasTabId) return;
        e.preventDefault();
        if (isGoToLabelOpen) {
          closeGoToLabelModal();
        } else {
          openGoToLabelModal();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        // Close the currently active tab
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        const currentPaneId = activePaneId;
        const currentTabId = currentPaneId === 'primary' ? activeTabId : secondaryActiveTabId;
        if (currentTabId) {
          handleCloseTab(currentTabId, currentPaneId);
        }
      }
      if (isMetaShortcut && e.shiftKey && e.key.toLowerCase() === 't') {
        // Reopen the most recently closed tab
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        handleReopenClosedTab();
      }
      // Canvas-level Undo/Redo. Skip when focus is in an editable field (text input,
      // Monaco editor) or inside Scene Composer, which each maintain their own undo stack.
      const key = e.key.toLowerCase();
      if (isMetaShortcut && (key === 'z' || key === 'y')) {
        const target = e.target as HTMLElement;
        const isEditable = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
          || target.isContentEditable || !!target.closest?.('.monaco-editor')
          || !!target.closest?.('[data-scene-composer-root]');
        if (!isEditable) {
          e.preventDefault();
          if (key === 'z') {
            if (e.shiftKey) { if (canRedo) redo(); } else if (canUndo) undo();
          } else if (canRedo) {
            redo();
          }
        }
      }
      if (e.key === 'Escape') {
        closeGoToLabelModal();
        closeWarpToLabelModal();
        resetWarpLaunchState();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeCanvasTabId, activePaneId, activeTabId, handleCloseTab, handleReopenClosedTab, projectRootPath, resetWarpLaunchState, secondaryActiveTabId, closeGoToLabelModal, closeWarpToLabelModal, isGoToLabelOpen, openGoToLabelModal, openWarpToLabelModal, canUndo, canRedo, undo, redo]);


  const handleFindUsages = useCallback((id: string, type: 'character' | 'variable') => {
      const ids = new Set<string>();
      if (type === 'character') {
          analysisResult.dialogueLines.forEach((dialogues, blockId) => {
              if (dialogues.some(d => d.tag === id)) ids.add(blockId);
          });
      } else {
          analysisResult.variableUsages.get(id)?.forEach(u => ids.add(u.blockId));
      }
      setFindUsagesHighlightIds(ids);
      setActiveTabId('canvas');
      addToast(`Found usages in ${ids.size} blocks`, 'info');
  }, [analysisResult.dialogueLines, analysisResult.variableUsages, setFindUsagesHighlightIds, setActiveTabId, addToast]);

  const analysisResultWithProfiles = useMemo(() => {
    const newCharacters = new Map(analysisResult.characters);
    newCharacters.forEach((char, tag) => {
        const profile = characterProfiles[tag];
        if (profile !== undefined) {
            newCharacters.set(tag, { ...char, profile });
        }
    });
    return { ...analysisResult, characters: newCharacters };
  }, [analysisResult, characterProfiles]);

  // When a character tag rename is in-flight, wait until analysis has resolved the new
  // tag before updating the open tab.  This avoids the flash of "New Character" form
  // that would occur if we updated characterTag before the analysis re-run completes.
  useEffect(() => {
    const pending = pendingTagRenameRef.current;
    if (!pending) return;
    if (!analysisResult.characters.has(pending.newTag)) return;
    const oldTabId = `char-${pending.oldTag}`;
    const newTabId = `char-${pending.newTag}`;
    setOpenTabs(prev => prev.map(t => t.id === oldTabId ? { ...t, id: newTabId, characterTag: pending.newTag } : t));
    setActiveTabId(prev => prev === oldTabId ? newTabId : prev);
    setSecondaryOpenTabs(prev => prev.map(t => t.id === oldTabId ? { ...t, id: newTabId, characterTag: pending.newTag } : t));
    setSecondaryActiveTabId(prev => prev === oldTabId ? newTabId : prev);
    // Also remove from lazy-mount sets so the new key gets a clean mount
    primaryMountedTabsRef.current.delete(oldTabId);
    secondaryMountedTabsRef.current.delete(oldTabId);
    pendingTagRenameRef.current = null;
  }, [analysisResult.characters, setActiveTabId, setOpenTabs, setSecondaryActiveTabId, setSecondaryOpenTabs]);

  // --- Character Editor ---
  const { handleOpenCharacterEditor, handleUpdateCharacter } = useCharacterManagement({
    blocks, analysisResult, projectRootPath,
    updateBlock, addBlock, setFileSystemTree,
    setCharacterProfiles, setHasUnsavedSettings, addToast,
    pendingTagRenameRef,
    openTabs, secondaryOpenTabs, activePaneId, splitLayout,
    setOpenTabs, setActiveTabId, setSecondaryOpenTabs, setSecondaryActiveTabId, setActivePaneId,
  });

  // --- Search ---
  const handleToggleSearch = useCallback(() => {
    setActiveLeftPanel('search');
    if (!appSettings.isLeftSidebarOpen) {
      updateAppSettings(draft => { draft.isLeftSidebarOpen = true; });
    }
  }, [appSettings.isLeftSidebarOpen, updateAppSettings]);

  const {
      handleCreateNode, handleRenameNode, handleDeleteNode, handleMoveNode,
      handleCut, handleCopy, handlePaste,
  } = useFileSystemManager({
      projectRootPath, setFileSystemTree, blocks, addBlock, updateBlock, deleteBlock,
      clipboard, setClipboard, openDeleteConfirmModal, addToast,
  });

  // --- User Snippet CRUD ---
  const handleSaveSnippet = useCallback((snippet: UserSnippet) => {
      updateAppSettings(draft => {
          if (!draft.userSnippets) draft.userSnippets = [];
          const idx = draft.userSnippets.findIndex(s => s.id === snippet.id);
          if (idx >= 0) { draft.userSnippets[idx] = snippet; }
          else { draft.userSnippets.push(snippet); }
      });
      setHasUnsavedSettings(true);
  }, [updateAppSettings, setHasUnsavedSettings]);

  const handleDeleteSnippet = useCallback((snippetId: string) => {
      updateAppSettings(draft => {
          if (draft.userSnippets) draft.userSnippets = draft.userSnippets.filter(s => s.id !== snippetId);
      });
      setHasUnsavedSettings(true);
  }, [updateAppSettings, setHasUnsavedSettings]);

  // --- Menu Template CRUD ---
  const handleSaveMenuTemplate = useCallback((template: MenuTemplate) => {
      updateAppSettings(draft => {
          if (!draft.menuTemplates) draft.menuTemplates = [];
          const idx = draft.menuTemplates.findIndex(t => t.id === template.id);
          if (idx >= 0) { draft.menuTemplates[idx] = { ...template, updatedAt: Date.now() }; }
          else { draft.menuTemplates.push(template); }
      });
      setHasUnsavedSettings(true);
  }, [updateAppSettings, setHasUnsavedSettings]);

  const handleDeleteMenuTemplate = useCallback((templateId: string) => {
      updateAppSettings(draft => {
          if (draft.menuTemplates) draft.menuTemplates = draft.menuTemplates.filter(t => t.id !== templateId);
      });
      setHasUnsavedSettings(true);
  }, [updateAppSettings, setHasUnsavedSettings]);

  // --- Active Editor Helper ---
  // Returns the currently active editor instance from either primary or secondary panel
  // Prioritizes the currently active pane, then falls back to the other pane
  const getActiveEditor = useCallback(() => {
      // Helper to check a specific panel for an editor
      const getEditorFromPanel = (tabs: EditorTab[], tabId: string) => {
          const editorTab = tabs.find(t => t.id === tabId && t.type === 'editor');
          if (editorTab?.blockId) {
              return editorInstances.current.get(editorTab.blockId) ?? null;
          }
          return null;
      };

      // Check active pane first
      if (activePaneId === 'primary') {
          const editor = getEditorFromPanel(openTabs, activeTabId);
          if (editor) return editor;
          // Fallback to secondary panel
          return getEditorFromPanel(secondaryOpenTabs, secondaryActiveTabId);
      } else {
          const editor = getEditorFromPanel(secondaryOpenTabs, secondaryActiveTabId);
          if (editor) return editor;
          // Fallback to primary panel
          return getEditorFromPanel(openTabs, activeTabId);
      }
  }, [openTabs, activeTabId, secondaryOpenTabs, secondaryActiveTabId, activePaneId]);

  const handleInsertColor = useCallback((hex: string) => {
      const editor = getActiveEditor();
      if (!editor) { addToast('Open a file in the editor to insert a color.', 'warning'); return; }
      const pos = editor.getPosition();
      if (!pos) return;
      editor.executeEdits('color-picker', [{
          range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
          text: hex,
          forceMoveMarkers: true,
      }]);
      editor.focus();
  }, [getActiveEditor, addToast]);

  const handleInsertATLPreset = useCallback((code: string) => {
      const editor = getActiveEditor();
      if (!editor) { addToast('Open a file in the editor to insert an animation.', 'warning'); return; }
      const pos = editor.getPosition();
      if (!pos) return;
      editor.executeEdits('atl-preset', [{
          range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
          text: code,
          forceMoveMarkers: true,
      }]);
      editor.focus();
  }, [getActiveEditor, addToast]);

  const handleWrapSelectionWithColor = useCallback((hex: string) => {
      const editor = getActiveEditor();
      if (!editor) { addToast('Open a file in the editor to wrap text with a color tag.', 'warning'); return; }
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) {
          addToast('Select text in the editor first, then click Wrap.', 'info');
          return;
      }
      const selectedText = editor.getModel()?.getValueInRange(selection) ?? '';
      editor.executeEdits('color-picker-wrap', [{
          range: selection,
          text: `{color=${hex}}${selectedText}{/color}`,
          forceMoveMarkers: true,
      }]);
      editor.focus();
  }, [getActiveEditor, addToast]);

  const handleCopyColorHex = useCallback((hex: string) => {
      navigator.clipboard.writeText(hex)
          .then(() => addToast(`Copied ${hex}`, 'success'))
          .catch(() => addToast('Failed to copy to clipboard', 'error'));
  }, [addToast]);

  // --- Explorer Selection → File Menu State Sync ---
  useEffect(() => {
    if (!window.electronAPI?.updateExplorerMenuState) return;
    const selectedArr = Array.from(explorerSelectedPaths);
    const hasAnySelection = selectedArr.length > 0;
    const hasSingleSelection = selectedArr.length === 1;
    let hasFolderSelected = false;
    if (hasSingleSelection && fileSystemTree) {
      const findNode = (node: FileSystemTreeNode, path: string): FileSystemTreeNode | null => {
        if (node.path === path) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findNode(child, path);
            if (found) return found;
          }
        }
        return null;
      };
      const node = findNode(fileSystemTree, selectedArr[0]);
      hasFolderSelected = node !== null && node.children !== undefined;
    }
    window.electronAPI.updateExplorerMenuState({
      canNewFile: hasFolderSelected,
      canNewFolder: hasFolderSelected,
      canRename: hasSingleSelection,
      canDelete: hasAnySelection,
      canNewUntitledFile: projectRootPath !== null,
    });
  }, [explorerSelectedPaths, fileSystemTree, projectRootPath]);

  // --- Menu Command Handling ---
  useMenuCommandDispatch({
    onNewProject: handleNewProjectRequest,
    onOpenProject: handleOpenProjectFolder,
    onOpenRecent: handleOpenWithRenpyCheck,
    onSaveAll: handleSaveAll,
    onRunProject: handleRunGame,
    onOpenStaticTab: (type) => handleOpenStaticTab(type as 'canvas' | 'route-canvas' | 'diagnostics' | 'translations' | 'screen-preview'),
    onToggleSearch: handleToggleSearch,
    onOpenSettings: openSettingsModal,
    onOpenShortcuts: openShortcutsModal,
    onOpenAbout: openAboutModal,
    onShowTutorial: openTutorial,
    onToggleLeftSidebar: () => updateAppSettings(draft => { draft.isLeftSidebarOpen = !draft.isLeftSidebarOpen; }),
    onToggleRightSidebar: () => updateAppSettings(draft => { draft.isRightSidebarOpen = !draft.isRightSidebarOpen; }),
    onExplorerNewFile: () => setExplorerExternalAction({ type: 'new-file', key: Date.now() }),
    onExplorerNewFolder: () => setExplorerExternalAction({ type: 'new-folder', key: Date.now() }),
    onExplorerRename: () => setExplorerExternalAction({ type: 'rename', key: Date.now() }),
    onExplorerDelete: () => handleDeleteNode(Array.from(explorerSelectedPaths)),
    onExplorerRefresh: handleRefreshProject,
    onOpenScreenshotsFolder: handleOpenScreenshotsFolder,
    onNewUntitledFile: createUntitledFile,
    onCloseTab: () => {
      const currentTabId = activePaneId === 'primary' ? activeTabId : secondaryActiveTabId;
      if (currentTabId) handleCloseTab(currentTabId, activePaneId);
    },
  });

  // --- Exit Handling ---
  const hasUnsavedSettingsRef = useRef(hasUnsavedSettings);
  const handleSaveAllRef = useRef(handleSaveAll);
  const handleSaveProjectSettingsRef = useRef(handleSaveProjectSettings);

  useEffect(() => { hasUnsavedSettingsRef.current = hasUnsavedSettings; }, [hasUnsavedSettings]);
  useEffect(() => { handleSaveAllRef.current = handleSaveAll; }, [handleSaveAll]);
  useEffect(() => { handleSaveProjectSettingsRef.current = handleSaveProjectSettings; }, [handleSaveProjectSettings]);

  // Toast for first-time implicit variable detection
  useEffect(() => {
    if (!analysisResult || !projectRootPath) return;

    const implicitVarCount = Array.from(analysisResult.variables.values())
      .filter(v => v.type === 'implicit').length;

    const hasSeenToast = localStorage.getItem(`implicit-var-toast-${projectRootPath}`);

    if (implicitVarCount >= 10 && !hasSeenToast && !dismissedImplicitVarHint) {
      addToast(`${implicitVarCount} implicit variables detected. Check the Variables pane or Diagnostics tab for details.`, 'info');
      localStorage.setItem(`implicit-var-toast-${projectRootPath}`, 'true');
    }
  }, [analysisResult, projectRootPath, dismissedImplicitVarHint, addToast]);

  useEffect(() => {
      if (!window.electronAPI) return;

      const hasUnsavedChanges = () =>
          dirtyBlockIdsRef.current.size > 0 || dirtyEditorsRef.current.size > 0 || hasUnsavedSettingsRef.current ||
          [...untitledFilesRef.current.values()].some(f => f.isDirty);

      const removeCheck = window.electronAPI.onCheckUnsavedChangesBeforeExit(() => {
          window.electronAPI!.replyUnsavedChangesBeforeExit(hasUnsavedChanges());
      });

      const removeShowModal = window.electronAPI.onShowExitModal(() => {
          openUnsavedChangesModal({
              title: 'Unsaved Changes',
              message: 'You have unsaved changes. Do you want to save them before exiting?',
              confirmText: 'Save & Exit',
              dontSaveText: "Don't Save",
              onConfirm: async () => {
                  // Trust handleSaveAll's own return value rather than re-checking
                  // hasUnsavedChanges() afterward: dirtyBlockIdsRef/hasUnsavedSettingsRef
                  // are only synced via a useEffect, which may not have flushed yet
                  // immediately after this await resolves (caused a double-click-to-exit
                  // bug — the first click's save succeeded but this stale-ref check still
                  // reported unsaved changes).
                  let saveSucceeded = false;
                  try {
                      saveSucceeded = await handleSaveAllRef.current();
                  } catch (err) {
                      logger.error('Failed to save before exit:', err);
                  }
                  if (!saveSucceeded) {
                      // A save was canceled or failed (e.g. an untitled file's Save dialog was
                      // dismissed) — don't quit with unsaved work still pending.
                      return;
                  }
                  window.electronAPI!.ideStateSavedForQuit();
              },
              onDontSave: () => {
                  window.electronAPI!.ideStateSavedForQuit();
              },
              onCancel: () => {
                  closeUnsavedChangesModal();
              }
          });
      });

      const removeSaveState = window.electronAPI.onSaveIdeStateBeforeQuit(async () => {
          try {
              await handleSaveProjectSettingsRef.current();
          } catch (err) {
              logger.error('Failed to save IDE state before quit:', err);
          }
          window.electronAPI!.ideStateSavedForQuit();
      });

      return () => {
          removeCheck();
          removeShowModal();
          removeSaveState();
      };
  }, [closeUnsavedChangesModal, openUnsavedChangesModal]);

  // --- StoryElementsPanel callbacks ---
  const {
    handleAddVariable, handleEditVariable,
    handleFindScreenDefinition,
    handleHoverHighlightStart, handleHoverHighlightEnd,
  } = useStoryElementsPanel({
    blocks, analysisResult, updateBlock, addBlock,
    setFileSystemTree, setHoverHighlightIds,
    projectRootPath, addToast, handleOpenEditor,
  });

  // --- Editor selection actions (Monaco "create from selection" context menu) ---
  const {
    quickCreateFileModal, pendingVariablePrefill,
    handleCreateFileFromSelection, handleCreateVariableFromSelection, handleCreateCharacterFromSelection,
    handleConfirmQuickCreateFile, closeQuickCreateFileModal, clearPendingVariablePrefill,
  } = useEditorSelectionActions({
    blocksRef, analysisResult, addToast, handleCreateNode, handleOpenEditor,
    handleAddVariable, handleOpenCharacterEditor, updateAppSettings,
  });

  // Named equivalents of the inline onUpdateTasks/onUpdateIgnoredDiagnostics closures
  // useTabContentRenderer.tsx passes to DiagnosticsPanel in-process -- popoutHandlers
  // needs a stable name to register, which an inline closure there can't provide.
  const handleUpdateDiagnosticsTasks = useCallback((tasks: DiagnosticsTask[]) => {
    setDiagnosticsTasks(tasks);
    setHasUnsavedSettings(true);
  }, [setDiagnosticsTasks, setHasUnsavedSettings]);

  const handleUpdateIgnoredDiagnostics = useCallback((rules: IgnoredDiagnosticRule[]) => {
    setIgnoredDiagnostics(rules);
    setHasUnsavedSettings(true);
  }, [setIgnoredDiagnostics, setHasUnsavedSettings]);

  const popoutHandlers = useMemo(() => ({
    updateBlock,
    handleSaveBlock,
    handleSaveAll,
    setBlockContent: setBlockContentFromPopout,
    setEditorDirty: setEditorDirtyFromPopout,
    handleWarpToLabel,
    handleCreateFileFromSelection,
    handleCreateVariableFromSelection,
    handleCreateCharacterFromSelection,
    handleSaveMenuTemplate,
    addToast,
    handleOpenEditor,
    updateUntitledContent,
    setUntitledDirty,
    saveUntitledFile,
    handleSaveImageMetadata,
    handleCopyImageToProject,
    handleSaveAudioMetadata,
    handleCopyAudioToProject,
    handleUpdateCharacter,
    handleUpdateDiagnosticsTasks,
    handleUpdateIgnoredDiagnostics,
    handleCenterOnBlock,
    handleGenerateTranslations,
    handleOpenStaticTab,
    handleUpdateRouteNodePositions,
    addRouteStickyNote,
    updateRouteStickyNote,
    deleteRouteStickyNote,
    handleChangeRouteCanvasLayoutMode,
    handleChangeRouteCanvasGroupingMode,
    addChoiceStickyNote,
    updateChoiceStickyNote,
    deleteChoiceStickyNote,
    addNotecard,
    updateNotecard,
    deleteNotecard,
    deleteNotecards,
    restoreNotecards,
    addNotecardLink,
    updateNotecardLink,
    deleteNotecardLink,
    renameNotecardTimelineSlot,
    moveNotecardWithinTimeline,
    unassignNotecardFromTimeline,
    insertTimelineSlot,
    deleteTimelineSlot,
    handleSceneUpdate,
    handleRenameScene,
    handleImageMapUpdate,
    handleRenameImageMap,
    updateGroup,
    updateBlockPositions,
    updateGroupPositions,
    deleteBlockWithFile,
    deleteBlocksWithFile,
    createGroupFromSelection,
    deleteGroup,
    addStickyNote,
    updateStickyNote,
    deleteStickyNote,
    handleCreateBlockFromCanvas,
    handleChangeStoryCanvasLayoutMode,
    handleChangeStoryCanvasGroupingMode,
    handleOpenRouteCanvasTab,
    setCanvasFilters,
  }), [updateBlock, handleSaveBlock, handleSaveAll, setBlockContentFromPopout, setEditorDirtyFromPopout, handleWarpToLabel, handleCreateFileFromSelection, handleCreateVariableFromSelection, handleCreateCharacterFromSelection, handleSaveMenuTemplate, addToast, handleOpenEditor, updateUntitledContent, setUntitledDirty, saveUntitledFile, handleSaveImageMetadata, handleCopyImageToProject, handleSaveAudioMetadata, handleCopyAudioToProject, handleUpdateCharacter, handleUpdateDiagnosticsTasks, handleUpdateIgnoredDiagnostics, handleCenterOnBlock, handleGenerateTranslations, handleOpenStaticTab, handleUpdateRouteNodePositions, addRouteStickyNote, updateRouteStickyNote, deleteRouteStickyNote, handleChangeRouteCanvasLayoutMode, handleChangeRouteCanvasGroupingMode, addChoiceStickyNote, updateChoiceStickyNote, deleteChoiceStickyNote, addNotecard, updateNotecard, deleteNotecard, deleteNotecards, restoreNotecards, addNotecardLink, updateNotecardLink, deleteNotecardLink, renameNotecardTimelineSlot, moveNotecardWithinTimeline, unassignNotecardFromTimeline, insertTimelineSlot, deleteTimelineSlot, handleSceneUpdate, handleRenameScene, handleImageMapUpdate, handleRenameImageMap, updateGroup, updateBlockPositions, updateGroupPositions, deleteBlockWithFile, deleteBlocksWithFile, createGroupFromSelection, deleteGroup, addStickyNote, updateStickyNote, deleteStickyNote, handleCreateBlockFromCanvas, handleChangeStoryCanvasLayoutMode, handleChangeStoryCanvasGroupingMode, handleOpenRouteCanvasTab, setCanvasFilters]);

  useMainWindowPopoutSync({
    poppedOutTabs: poppedOutSyncableTabs,
    blocks,
    analysisResult,
    appSettings,
    projectSettings,
    existingImageTags,
    existingAudioPaths,
    images,
    imageMetadata,
    audios,
    audioMetadata,
    untitledFiles,
    projectRootPath,
    charactersByTag: analysisResultWithProfiles.characters,
    characterTagsArray,
    allStickyNotes,
    diagnosticsTasks,
    ignoredDiagnostics,
    diagnosticsResult,
    routeAnalysisResult,
    performanceMetrics: perfSnapshot,
    isGeneratingTranslations,
    isRenpyPathValid,
    editorCursorBlockId,
    editorCursorPosition,
    routeStickyNotes,
    choiceStickyNotes,
    notecards,
    notecardLinks,
    notecardTimeline,
    sceneCompositions,
    sceneNames,
    imagemapCompositions,
    analysisLabelKeys,
    groups,
    stickyNotes,
    canvasFilters,
    dirtyBlockIds,
    onRedock: handleRedockTab,
    handlers: popoutHandlers,
  });

  // --- Tab helpers (used by both panes) ---
  const { renderTabContent, renderTabBar } = useTabContentRenderer({
    editorInstances, blocksRef, pendingTagRenameRef,
    blocks, groups, selectedBlockIds, setSelectedBlockIds, selectedGroupIds, setSelectedGroupIds,
    updateBlock, updateGroup, updateBlockPositions, updateGroupPositions, deleteBlockWithFile,
    deleteBlocksWithFile, createGroupFromSelection, deleteGroup,
    analysisResult, analysisResultWithProfiles, routeAnalysisResult, diagnosticsResult,
    diagnosticsTasks, setDiagnosticsTasks, ignoredDiagnostics, setIgnoredDiagnostics,
    setHasUnsavedSettings, analysisLabelKeys,
    stickyNotes, updateStickyNote, deleteStickyNote, addStickyNote,
    routeStickyNotes, addRouteStickyNote, updateRouteStickyNote, deleteRouteStickyNote,
    choiceStickyNotes, addChoiceStickyNote, updateChoiceStickyNote, deleteChoiceStickyNote,
    allStickyNotes,
    notecards, notecardLinks, updateNotecard, deleteNotecard, deleteNotecards, restoreNotecards, addNotecard,
    addNotecardLink, updateNotecardLink, deleteNotecardLink,
    notecardTimeline, renameNotecardTimelineSlot,
    moveNotecardWithinTimeline, unassignNotecardFromTimeline,
    insertTimelineSlot, deleteTimelineSlot,
    notecardCanvasTransform, setNotecardCanvasTransform,
    canvasInteractionEnd, findUsagesHighlightIds, handleClearFindUsages,
    canvasFilters, setCanvasFilters, centerOnBlockRequest, flashBlockRequest, hoverHighlightIds,
    storyCanvasTransform, setStoryCanvasTransform, routeCanvasTransform, setRouteCanvasTransform,
    choiceCanvasTransform, setChoiceCanvasTransform,
    centerOnRouteStartRequest, centerOnChoiceStartRequest, centerOnRouteNodeRequest, centerOnChoiceNodeRequest,
    handleUpdateRouteNodePositions, handleWarpToLabel, handleCenterOnBlock,
    appSettings, projectSettings,
    handleChangeStoryCanvasLayoutMode, handleChangeStoryCanvasGroupingMode,
    handleChangeRouteCanvasLayoutMode, handleChangeRouteCanvasGroupingMode,
    handleCreateBlockFromCanvas,
    dirtyBlockIds, dirtyEditors, setDirtyEditors,
    splitLayout, activePaneId, draggedTabId,
    handleTabDrop, handleSwitchTab, handleTabDragStart, handleTabDragOver, handleTabStripDragOver, handleTabDragEnd,
    handleTabContextMenu, handleCloseTab, handleCreateSplit,
    handleClosePrimaryPane, handleCloseSecondaryPane,
    handleOpenEditor, handleOpenRouteCanvasTab, handleOpenStaticTab,
    images, imagesArray, imageMetadata, audios, audioMetadata,
    handleSaveImageMetadata, handleCopyImageToProject, handleSaveAudioMetadata, handleCopyAudioToProject,
    existingImageTags, existingAudioPaths,
    perfSnapshot, handleGenerateTranslations, isGeneratingTranslations, isRenpyPathValid,
    editorCursorBlockId, editorCursorPosition,
    setBlocks, handleSaveBlock, syncEditorToStateAndMarkDirty,
    setEditorCursorPosition, setEditorCursorBlockId, addToast, handleSaveMenuTemplate,
    onCreateFileFromSelection: handleCreateFileFromSelection,
    onCreateVariableFromSelection: handleCreateVariableFromSelection,
    onCreateCharacterFromSelection: handleCreateCharacterFromSelection,
    characterTagsArray, handleUpdateCharacter,
    sceneCompositions, sceneNames, handleSceneUpdate, handleRenameScene, getActiveEditor,
    imagemapCompositions, handleImageMapUpdate, handleRenameImageMap,
    projectRootPath,
    untitledFiles, updateUntitledContent, setUntitledDirty, saveUntitledFile,
  });
  const focusedTabId = activePaneId === 'secondary' && splitLayout !== 'none'
    ? secondaryActiveTabId
    : activeTabId;
  const activeCanvasType: 'story' | 'route' | 'choice' | 'notecard' | null =
    focusedTabId === 'route-canvas' ? 'route' :
    focusedTabId === 'choice-canvas' ? 'choice' :
    focusedTabId === 'notecard-canvas' ? 'notecard' :
    focusedTabId === 'canvas' ? 'story' : null;
  const activeCanvasLayoutMode = activeCanvasType === 'route'
    ? (projectSettings.routeCanvasLayoutMode ?? 'flow-lr')
    : (projectSettings.storyCanvasLayoutMode ?? 'flow-lr');
  const activeCanvasGroupingMode = activeCanvasType === 'route'
    ? (projectSettings.routeCanvasGroupingMode ?? 'none')
    : (projectSettings.storyCanvasGroupingMode ?? 'none');
  const handleActiveCanvasTidyUp = useCallback(() => {
    if (activeCanvasType === 'route') {
      applyRouteLayout(activeCanvasLayoutMode, activeCanvasGroupingMode, { showToast: true });
      return;
    }
    if (activeCanvasType === 'choice') return;
    handleTidyUp(true);
  }, [activeCanvasType, activeCanvasLayoutMode, activeCanvasGroupingMode, applyRouteLayout, handleTidyUp]);

  const activeCanvasOnAddStickyNote = useMemo<(() => void) | null>(() => {
    if (activeCanvasType === 'story') return () => addStickyNote();
    if (activeCanvasType === 'route') return () => addRouteStickyNote();
    if (activeCanvasType === 'choice') return () => addChoiceStickyNote();
    return null;
  }, [activeCanvasType, addStickyNote, addRouteStickyNote, addChoiceStickyNote]);

  const dualPaneContextValue = useMemo<DualPaneContextValue>(() => ({
    openTabs, activeTabId, setOpenTabs, setActiveTabId,
    secondaryOpenTabs, secondaryActiveTabId, setSecondaryOpenTabs, setSecondaryActiveTabId,
    activePaneId, setActivePaneId,
    splitLayout, splitPrimarySize, setSplitLayout, setSplitPrimarySize,
    draggedTabId, dragSourcePaneId, setDraggedTabId, setDragSourcePaneId,
    closedTabsStack, setClosedTabsStack,
    poppedOutTabs, setPoppedOutTabs,
    openTab: _openTab, closeTab: _closeTab, switchTab: _switchTab, updateTab: _updateTab,
    closeTabs: _closeTabs, setTabs,
    createSplit: _createSplit, closeSplit: _closeSplit, setSplitSize: _setSplitSize,
    moveTabToPane: _moveTabToPane,
    startDrag: _startTabDrag, endDrag: _endTabDrag,
    findTab: _findTab, getActiveTab: _getActiveTab,
    dirtyBlockIds, dirtyEditors, setDirtyBlockIds, setDirtyEditors,
    dirtyBlockIdsRef, dirtyEditorsRef,
    handleCloseTab, processTabCloseRequest, handleCloseOthersRequest, handleCloseAllRequest,
    handleCloseLeftRequest, handleCloseRightRequest,
    handleSwitchTab, handleCreateSplit, handleOpenInSplit, handleMoveToOtherPane,
    handleCloseSecondaryPane, handleClosePrimaryPane,
    handleTabDragStart, handleTabDragOver, handleTabStripDragOver, handleTabDrop, handleTabDragEnd, handleReopenClosedTab,
    handlePopOutTab, handleRedockTab,
    handleTabContextMenu,
    handleOpenEditor, handleOpenStaticTab, handleOpenRouteCanvasTab, handleOpenChoiceCanvasTab,
    handleOpenImageEditorTab, handleOpenMarkdownTab, handleOpenAudioEditorInTab, handlePathDoubleClick,
  }), [
    openTabs, activeTabId, setOpenTabs, setActiveTabId,
    secondaryOpenTabs, secondaryActiveTabId, setSecondaryOpenTabs, setSecondaryActiveTabId,
    activePaneId, setActivePaneId,
    splitLayout, splitPrimarySize, setSplitLayout, setSplitPrimarySize,
    draggedTabId, dragSourcePaneId, setDraggedTabId, setDragSourcePaneId,
    closedTabsStack, setClosedTabsStack,
    poppedOutTabs, setPoppedOutTabs,
    _openTab, _closeTab, _switchTab, _updateTab, _closeTabs, setTabs,
    _createSplit, _closeSplit, _setSplitSize, _moveTabToPane,
    _startTabDrag, _endTabDrag, _findTab, _getActiveTab,
    dirtyBlockIds, dirtyEditors, setDirtyBlockIds, setDirtyEditors,
    dirtyBlockIdsRef, dirtyEditorsRef,
    handleCloseTab, processTabCloseRequest, handleCloseOthersRequest, handleCloseAllRequest,
    handleCloseLeftRequest, handleCloseRightRequest,
    handleSwitchTab, handleCreateSplit, handleOpenInSplit, handleMoveToOtherPane,
    handleCloseSecondaryPane, handleClosePrimaryPane,
    handleTabDragStart, handleTabDragOver, handleTabStripDragOver, handleTabDrop, handleTabDragEnd, handleReopenClosedTab,
    handlePopOutTab, handleRedockTab, handleTabContextMenu,
    handleOpenEditor, handleOpenStaticTab, handleOpenRouteCanvasTab, handleOpenChoiceCanvasTab,
    handleOpenImageEditorTab, handleOpenMarkdownTab, handleOpenAudioEditorInTab, handlePathDoubleClick,
  ]);

  return (
    <DualPaneContext.Provider value={dualPaneContextValue}>
    <SearchProvider
      blocks={blocks}
      setBlocks={setBlocks}
      setDirtyBlockIds={setDirtyBlockIds}
      projectRootPath={projectRootPath}
      addToast={addToast}
    >
    <div
      data-app-ready={appSettingsLoaded ? "true" : undefined}
      data-project-ready={(!isLoading && !isInitialAnalysisPending && !!projectRootPath) ? "true" : undefined}
      className={`fixed inset-0 flex flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 ${appSettings.theme}`}>
      <Toolbar
        activeCanvasType={activeCanvasType}
        projectRootPath={projectRootPath}
        hasUnsavedSettings={hasUnsavedSettings}
        saveStatus={saveStatus}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        hideUndoRedo={openTabs.find(t => t.id === activeTabId)?.type === 'scene-composer'}
        addBlock={() => openCreateBlockModal('story')}
        handleTidyUp={handleActiveCanvasTidyUp}
        handleSave={handleSaveAll}
        onOpenSettings={() => openSettingsModal()}
        onOpenShortcuts={() => openShortcutsModal()}
        onOpenStaticTab={handleOpenStaticTab as (type: 'canvas' | 'route-canvas' | 'choice-canvas' | 'notecard-canvas' | 'stats' | 'diagnostics' | 'translations' | 'screen-preview') => void}
        diagnosticsErrorCount={diagnosticsResult.errorCount}
        onAddStickyNote={activeCanvasOnAddStickyNote}
        isGameRunning={isGameRunning}
        onRunGame={handleRunGame}
        onWarpToLabel={() => openWarpToLabelModal()}
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
                    onRefresh={handleRefreshProject}
                    onRevealInFileManager={handleRevealInFileManager}
                    onCopyPath={handleCopyPath}
                    selectedPaths={explorerSelectedPaths}
                    setSelectedPaths={setExplorerSelectedPaths}
                    lastClickedPath={explorerLastClickedPath}
                    setLastClickedPath={setExplorerLastClickedPath}
                    expandedPaths={explorerExpandedPaths}
                    onToggleExpand={handleToggleExpandExplorer}
                    externalAction={explorerExternalAction}
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
                  <div className="flex flex-col sm:flex-row gap-3 justify-center" data-tutorial="project-menu">
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
            <>
            {/* External file change notifications */}
            <ExternalChangesBanner
              items={externallyChangedFiles}
              onReload={handleReloadFromDisk}
              onKeep={handleKeepCurrentFile}
            />
            {/* Panes container — flex-row for right split, flex-col for bottom split */}
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
            </>
          )}{/* end panes container / empty state */}

          <StatusBar
              isAnalysisPending={isAnalysisPending}
              isScanningAssets={isScanningAssets}
              onCancelScan={cancelAssetScan}
              saveStatus={saveStatus}
              blockCount={blocks.length}
              errorCount={diagnosticsResult.errorCount}
              warningCount={diagnosticsResult.warningCount}
              screenshotCount={screenshotCount}
              onOpenScreenshotsFolder={handleOpenScreenshotsFolder}
              onClearScreenshots={handleClearScreenshots}
              onCopyLatestScreenshotPath={handleCopyLatestScreenshotPath}
              activeFileLineCount={activeFileLineCount}
              fileSizeThresholds={appSettings.fileSizeThresholds ?? DEFAULT_FILE_SIZE_THRESHOLDS}
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
                onAddVariable={handleAddVariable}
                onEditVariable={handleEditVariable}
                onFindVariableUsages={(name) => handleFindUsages(name, 'variable')}
                pendingVariablePrefill={pendingVariablePrefill}
                onVariablePrefillConsumed={clearPendingVariablePrefill}
                onFindScreenDefinition={handleFindScreenDefinition}
                // Image Props
                projectImages={images}
                imageMetadata={imageMetadata}
                imageScanDirectories={imageScanDirectories}
                onAddImageScanDirectory={handleAddImageScanDirectory}
                onRemoveImageScanDirectory={handleRemoveImageScanDirectory}
                onCopyImagesToProject={handleCopyImagesToProjectBulk}
                onOpenImageEditor={handleOpenImageEditorTab}
                imagesLastScanned={imagesLastScanned}
                isRefreshingImages={isRefreshingImages}
                onRefreshImages={handleRefreshImages}
                
                // Audio Props
                projectAudios={audios}
                audioMetadata={audioMetadata}
                audioScanDirectories={audioScanDirectories}
                onAddAudioScanDirectory={handleAddAudioScanDirectory}
                onRemoveAudioScanDirectory={handleRemoveAudioScanDirectory}
                onCopyAudiosToProject={handleCopyAudiosToProjectBulk}
                onOpenAudioEditor={handleOpenAudioEditorInTab}
                audiosLastScanned={audiosLastScanned}
                isRefreshingAudios={isRefreshingAudios}
                onRefreshAudios={handleRefreshAudios}
                isFileSystemApiSupported={!!window.electronAPI}
                onHoverHighlightStart={handleHoverHighlightStart}
                onHoverHighlightEnd={handleHoverHighlightEnd}
                // Scene Props
                scenes={scenesArray}
                onOpenScene={handleOpenScene}
                onCreateScene={handleCreateScene}
                onDeleteScene={handleDeleteScene}
                // ImageMap Props
                imagemaps={imagemapsArray}
                onOpenImageMap={handleOpenImageMap}
                onCreateImageMap={handleCreateImageMap}
                onDeleteImageMap={handleDeleteImageMap}
                // Snippet Props
                userSnippets={appSettings.userSnippets}
                onCreateSnippet={() => openUserSnippetModal()}
                onEditSnippet={(snippet) => openUserSnippetModal(snippet)}
                onDeleteSnippet={handleDeleteSnippet}
                projectRootPath={projectRootPath}
                // Menu Template Props
                menuTemplates={appSettings.menuTemplates || []}
                onCreateMenuTemplate={() => openMenuConstructorModal()}
                onEditMenuTemplate={(template) => openMenuConstructorModal(template)}
                onDeleteMenuTemplate={handleDeleteMenuTemplate}
                // Color Picker
                onInsertATLPresetAtCursor={handleInsertATLPreset}
                onInsertColorAtCursor={handleInsertColor}
                onWrapColorSelection={handleWrapSelectionWithColor}
                onCopyColorHex={handleCopyColorHex}
                projectColors={projectColors}
                // Accordion State Props
                projectSettings={projectSettings}
                onUpdateProjectSettings={updateProjectSettings}
                hasProject={!!projectRootPath}
                // Implicit Variable Banner
                dismissedImplicitVarHint={dismissedImplicitVarHint}
                onDismissImplicitVarHint={() => setDismissedImplicitVarHint(true)}
                onOpenDiagnostics={() => handleOpenStaticTab('diagnostics')}
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
        onClose={closeCreateBlockModal}
        onConfirm={(name, type) => handleCreateBlockConfirm(name, type, createBlockModalFolderPath, createBlockModalPosition)}
        defaultPath={createBlockModalFolderPath || getSelectedFolderForNewBlock()}
        initialType={createBlockModalType}
      />

      <QuickCreateFileModal
        isOpen={quickCreateFileModal !== null}
        directoryPath={quickCreateFileModal?.directoryPath ?? ''}
        extension={quickCreateFileModal?.extension ?? '.rpy'}
        initialFileName={quickCreateFileModal?.initialFileName ?? ''}
        collidingWithExisting={quickCreateFileModal?.collidingWithExisting ?? false}
        onConfirm={handleConfirmQuickCreateFile}
        onClose={closeQuickCreateFileModal}
      />

      <ConfigureRenpyModal
        isOpen={showConfigureRenpyModal}
        onClose={() => closeConfigureRenpyModal()}
        onSave={(path) => {
            updateAppSettings(draft => { draft.renpyPath = path; });
            closeConfigureRenpyModal();
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
                closeDeleteConfirmModal();
            }}
            onClose={() => closeDeleteConfirmModal()}
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
              filePath={(() => {
                  const tabs = contextMenuInfo.paneId === 'secondary' ? secondaryOpenTabs : openTabs;
                  const tab = tabs.find(t => t.id === contextMenuInfo.tabId);
                  if (!tab) return undefined;
                  return tab.type === 'editor'
                      ? blocks.find(b => b.id === tab.blockId)?.filePath
                      : tab.filePath;
              })()}
              tabType={(() => {
                  const tabs = contextMenuInfo.paneId === 'secondary' ? secondaryOpenTabs : openTabs;
                  return tabs.find(t => t.id === contextMenuInfo.tabId)?.type;
              })()}
              onClose={() => closeContextMenu()}
              onCloseTab={(id) => handleCloseTab(id, contextMenuInfo.paneId)}
              onCloseOthers={(id) => handleCloseOthersRequest(id, contextMenuInfo.paneId)}
              onCloseLeft={(id) => handleCloseLeftRequest(id, contextMenuInfo.paneId)}
              onCloseRight={(id) => handleCloseRightRequest(id, contextMenuInfo.paneId)}
              onCloseAll={() => handleCloseAllRequest(contextMenuInfo.paneId)}
              onSplitRight={(id) => handleOpenInSplit(id, 'right')}
              onSplitBottom={(id) => handleOpenInSplit(id, 'bottom')}
              onMoveToOtherPane={(id) => handleMoveToOtherPane(id, contextMenuInfo.paneId)}
              onPopOut={(id) => handlePopOutTab(id, contextMenuInfo.paneId)}
              onRevealInFileManager={handleRevealInFileManager}
              onCopyPath={handleCopyPath}
          />,
          document.body
      )}

      <SettingsModal 
        isOpen={settingsModalOpen} 
        onClose={() => closeSettingsModal()}
        settings={settingsMerged}
        onSettingsChange={(key, value) => {
            if (key in appSettings) {
                updateAppSettings(draft => {
                    (draft as unknown as Record<string, unknown>)[key] = value;
                });
            } else {
                updateProjectSettings(draft => {
                    (draft as Record<string, unknown>)[key] = value;
                });
                setHasUnsavedSettings(true);
            }
        }}
      />

      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => closeShortcutsModal()}
        mouseGestures={appSettings.mouseGestures}
        onOpenSettings={() => { closeShortcutsModal(); openSettingsModal(); }}
      />

      <UserSnippetModal
        isOpen={userSnippetModalOpen}
        onClose={() => closeUserSnippetModal()}
        onSave={handleSaveSnippet}
        existingSnippet={editingSnippet}
      />

      <MenuConstructorModal
        isOpen={menuConstructorModalOpen}
        onClose={() => closeMenuConstructorModal()}
        onInsert={(code, templateData) => {
          if (templateData) {
            const now = Date.now();
            const template: MenuTemplate = {
              id: editingMenuTemplate?.id || `template-${now}`,
              name: templateData.name,
              description: templateData.description,
              menuStatement: templateData.menuStatement,
              choices: templateData.choices,
              createdAt: editingMenuTemplate?.createdAt || now,
              updatedAt: now,
            };
            handleSaveMenuTemplate(template);
          }
          closeMenuConstructorModal();
        }}
        initialTemplate={editingMenuTemplate || undefined}
        labels={menuLabels}
        variables={menuVariables}
        mode="edit-template"
        activeEditor={getActiveEditor()}
      />

      <NewProjectWizardModal
        isOpen={wizardModalOpen}
        onClose={() => closeWizardModal()}
        onComplete={handleWizardComplete}
        sdkPath={appSettings.renpyPath}
        lastProjectDir={appSettings.lastProjectDir || ''}
        onProjectDirSaved={(dir) => updateAppSettings(draft => { draft.lastProjectDir = dir; })}
      />

      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => closeAboutModal()}
      />
      <GoToLabelModal
        isOpen={isGoToLabelOpen}
        items={goToLabelItems}
        canvasName={goToLabelCanvasName}
        onSelect={handleGoToLabel}
        onClose={() => closeGoToLabelModal()}
      />
      <GoToLabelModal
        isOpen={isWarpToLabelOpen}
        items={warpLabelItems}
        canvasName="Warp"
        title="Warp to Label"
        placeholder="Warp to label…"
        emptyStateText="No labels available"
        onSelect={handleWarpToLabel}
        onClose={() => closeWarpToLabelModal()}
      />
      <WarpVariablesModal
        isOpen={isWarpVariablesOpen}
        defaultVariables={pendingWarpVariableDrafts}
        hasExistingAfterWarp={hasAfterWarpLabel(analysisResult.labels)}
        warpLabelName={pendingWarpLabelName ?? undefined}
        onClose={resetWarpLaunchState}
        onConfirm={handleConfirmWarpVariables}
      />
      <CrashLogModal
        isOpen={!!crashLog}
        tracebackText={crashLog ?? ''}
        onClose={dismissCrashLog}
      />

      <FirstRunTutorial
        forceShow={showTutorial}
        onComplete={() => closeTutorial()}
      />
    </div>
    </SearchProvider>
    </DualPaneContext.Provider>
  );
};

export default App;
