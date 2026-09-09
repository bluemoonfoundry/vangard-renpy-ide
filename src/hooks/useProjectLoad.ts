import { useCallback } from 'react';
import type { Updater } from 'use-immer';
import { deserializeProjectData } from '@/lib/projectSerializer';
import { logger } from '@/lib/logger';
import type {
  Block, Position, FileSystemTreeNode, EditorTab, ProjectImage, RenpyAudio,
  AppSettings, PersistedProjectSettings, ProjectSettings, SceneComposition, ImageMapComposition,
  PunchlistMetadata, DiagnosticsTask, IgnoredDiagnosticRule, StickyNote,
  Notecard, NotecardLink, NotecardTimelineSettings,
  ProjectSnapshot,
} from '@/types';

// Re-export from types so importers don't need a second import path.
export type { PendingStoryLayoutRefresh, PendingRouteLayoutRefresh, ProjectSnapshot } from '@/types';

type ProjectSettingsSlice = PersistedProjectSettings;

type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface HydrateSetters {
  pendingStoryLayoutRefreshRef: React.MutableRefObject<import('@/types').PendingStoryLayoutRefresh | null>;
  pendingRouteLayoutRefreshRef: React.MutableRefObject<import('@/types').PendingRouteLayoutRefresh | null>;
  pendingAutoCenterRef: React.MutableRefObject<{ story: boolean; route: boolean; choice: boolean }>;
  setProjectRootPath: React.Dispatch<React.SetStateAction<string | null>>;
  setFileSystemTree: React.Dispatch<React.SetStateAction<FileSystemTreeNode | null>>;
  updateProjectSettings: (updater: (draft: ProjectSettingsSlice) => void) => void;
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  setImages: React.Dispatch<React.SetStateAction<Map<string, ProjectImage>>>;
  setAudios: React.Dispatch<React.SetStateAction<Map<string, RenpyAudio>>>;
  setImageScanDirectories: React.Dispatch<React.SetStateAction<Map<string, FileSystemDirectoryHandle>>>;
  setAudioScanDirectories: React.Dispatch<React.SetStateAction<Map<string, FileSystemDirectoryHandle>>>;
  setIsScanningAssets: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRefreshingImages: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRefreshingAudios: React.Dispatch<React.SetStateAction<boolean>>;
  setImagesLastScanned: React.Dispatch<React.SetStateAction<number | null>>;
  setAudiosLastScanned: React.Dispatch<React.SetStateAction<number | null>>;
  setStickyNotes: Updater<StickyNote[]>;
  setRouteStickyNotes: Updater<StickyNote[]>;
  setChoiceStickyNotes: Updater<StickyNote[]>;
  setNotecards: Updater<Notecard[]>;
  setNotecardLinks: Updater<NotecardLink[]>;
  setNotecardTimeline: Updater<NotecardTimelineSettings>;
  setCharacterProfiles: Updater<Record<string, string>>;
  setCharacterPortraits: Updater<Record<string, string>>;
  setPunchlistMetadata: Updater<Record<string, PunchlistMetadata>>;
  setDiagnosticsTasks: Updater<DiagnosticsTask[]>;
  setIgnoredDiagnostics: Updater<IgnoredDiagnosticRule[]>;
  setDismissedImplicitVarHint: React.Dispatch<React.SetStateAction<boolean>>;
  setSceneCompositions: Updater<Record<string, SceneComposition>>;
  setSceneNames: Updater<Record<string, string>>;
  setImagemapCompositions: Updater<Record<string, ImageMapComposition>>;
  setRouteNodeLayoutCache: React.Dispatch<React.SetStateAction<Map<string, Position>>>;
  setOpenTabs: React.Dispatch<React.SetStateAction<EditorTab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  setSecondaryOpenTabs: React.Dispatch<React.SetStateAction<EditorTab[]>>;
  setSecondaryActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  setSplitLayout: React.Dispatch<React.SetStateAction<'none' | 'right' | 'bottom'>>;
  setSplitPrimarySize: React.Dispatch<React.SetStateAction<number>>;
  setTabs: (tabs: EditorTab[], activeId: string, paneId?: 'primary' | 'secondary') => void;
  perfRecorders: {
    recordScanStart: () => void;
    recordScanEnd: () => void;
  };
}

/**
 * Applies a `ProjectSnapshot` to React state. Exported so tests can call it
 * directly with mock setters — no IPC or React hooks required.
 */
export function hydrateFromProjectData(snapshot: ProjectSnapshot, setters: HydrateSetters): void {
  const {
    pendingStoryLayoutRefreshRef, pendingRouteLayoutRefreshRef, pendingAutoCenterRef,
    setProjectRootPath, setFileSystemTree, updateProjectSettings, setBlocks,
    setImages, setAudios, setImageScanDirectories, setAudioScanDirectories, setIsScanningAssets,
    setIsRefreshingImages, setIsRefreshingAudios, setImagesLastScanned, setAudiosLastScanned,
    setStickyNotes, setRouteStickyNotes, setChoiceStickyNotes, setNotecards, setNotecardLinks, setNotecardTimeline,
    setCharacterProfiles, setCharacterPortraits,
    setPunchlistMetadata, setDiagnosticsTasks, setIgnoredDiagnostics, setDismissedImplicitVarHint,
    setSceneCompositions, setSceneNames, setImagemapCompositions,
    setRouteNodeLayoutCache,
    setOpenTabs, setActiveTabId, setSecondaryOpenTabs, setSecondaryActiveTabId,
    setSplitLayout, setSplitPrimarySize, setTabs,
    perfRecorders,
  } = setters;

  setProjectRootPath(snapshot.rootPath);
  setFileSystemTree(snapshot.tree);
  setBlocks(snapshot.blocks);

  pendingStoryLayoutRefreshRef.current = snapshot.pendingStoryLayoutRefresh;
  pendingRouteLayoutRefreshRef.current = snapshot.pendingRouteLayoutRefresh;
  pendingAutoCenterRef.current = { story: true, route: true, choice: true };

  setRouteNodeLayoutCache(snapshot.routeNodeLayoutCache);
  setImages(snapshot.images);
  setAudios(snapshot.audios);

  updateProjectSettings(draft => {
    const cs = snapshot.canvasSettings;
    draft.draftingMode = cs.draftingMode;
    draft.storyCanvasLayoutMode = cs.storyCanvasLayoutMode as ProjectSettings['storyCanvasLayoutMode'];
    draft.storyCanvasGroupingMode = cs.storyCanvasGroupingMode as ProjectSettings['storyCanvasGroupingMode'];
    draft.storyCanvasLayoutFingerprint = cs.storyCanvasLayoutFingerprint;
    draft.storyCanvasLayoutVersion = cs.storyCanvasLayoutVersion;
    draft.storyCanvasLayoutWasUserAdjusted = cs.storyCanvasLayoutWasUserAdjusted;
    draft.storyCanvasHasAutocentered = false;
    draft.routeCanvasLayoutMode = cs.routeCanvasLayoutMode as ProjectSettings['routeCanvasLayoutMode'];
    draft.routeCanvasGroupingMode = cs.routeCanvasGroupingMode as ProjectSettings['routeCanvasGroupingMode'];
    draft.routeCanvasLayoutFingerprint = cs.routeCanvasLayoutFingerprint;
    draft.routeCanvasLayoutVersion = cs.routeCanvasLayoutVersion;
    draft.routeCanvasLayoutWasUserAdjusted = cs.routeCanvasLayoutWasUserAdjusted;
    draft.routeCanvasHasAutocentered = false;
    draft.choiceCanvasHasAutocentered = false;
    draft.completedMilestones = cs.completedMilestones;
  });

  setStickyNotes(snapshot.stickyNotes);
  setRouteStickyNotes(snapshot.routeStickyNotes);
  setChoiceStickyNotes(snapshot.choiceStickyNotes);
  setNotecards(snapshot.notecards);
  setNotecardLinks(snapshot.notecardLinks);
  setNotecardTimeline(snapshot.notecardTimeline);
  setCharacterProfiles(snapshot.characterProfiles);
  setCharacterPortraits(snapshot.characterPortraits);
  setPunchlistMetadata(snapshot.punchlistMetadata);
  setDiagnosticsTasks(snapshot.diagnosticsTasks);
  setIgnoredDiagnostics(snapshot.ignoredDiagnostics);
  setDismissedImplicitVarHint(snapshot.dismissedImplicitVariableHint);

  setSceneCompositions(snapshot.sceneCompositions);
  setSceneNames(snapshot.sceneNames);
  setImagemapCompositions(snapshot.imagemapCompositions);

  setTabs(snapshot.primaryTabs, snapshot.primaryActiveTabId, 'primary');
  setSplitLayout(snapshot.splitLayout);
  setSplitPrimarySize(snapshot.splitPrimarySize);
  setSecondaryOpenTabs(snapshot.secondaryTabs);
  setSecondaryActiveTabId(snapshot.secondaryActiveTabId);

  // Trigger asset directory scans (side effect — kept here rather than in loadProject
  // because it needs setImages/setAudios to update state incrementally as results arrive).
  if (snapshot.imageScanPaths.length > 0 && window.electronAPI) {
    const map = new Map<string, FileSystemDirectoryHandle>();
    snapshot.imageScanPaths.forEach(p => map.set(p, null as unknown as FileSystemDirectoryHandle));
    setImageScanDirectories(map);
    perfRecorders.recordScanStart();
    setIsScanningAssets(true);
    setIsRefreshingImages(true);
    Promise.all(snapshot.imageScanPaths.map(dirPath =>
      window.electronAPI!.scanDirectory(dirPath).then(({ images: scanned }) => {
        setImages(prev => {
          const next = new Map(prev);
          scanned.forEach(img => {
            if (!next.has(img.path)) {
              const fileName = img.path.split('/').pop();
              const potentialProjectPath = `game/images/${fileName}`;
              next.set(img.path, {
                ...img,
                filePath: img.path,
                isInProject: false,
                fileHandle: null,
                projectFilePath: next.has(potentialProjectPath) ? potentialProjectPath : undefined,
              });
            }
          });
          return next;
        });
      })
    )).finally(() => {
      perfRecorders.recordScanEnd();
      setIsScanningAssets(false);
      setIsRefreshingImages(false);
      setImagesLastScanned(Date.now());
    });
  }

  if (snapshot.audioScanPaths.length > 0 && window.electronAPI) {
    const map = new Map<string, FileSystemDirectoryHandle>();
    snapshot.audioScanPaths.forEach(p => map.set(p, null as unknown as FileSystemDirectoryHandle));
    setAudioScanDirectories(map);
    perfRecorders.recordScanStart();
    setIsScanningAssets(true);
    setIsRefreshingAudios(true);
    Promise.all(snapshot.audioScanPaths.map(dirPath =>
      window.electronAPI!.scanDirectory(dirPath).then(({ audios: scanned }) => {
        setAudios(prev => {
          const next = new Map(prev);
          scanned.forEach(aud => {
            if (!next.has(aud.path)) {
              const fileName = aud.path.split('/').pop();
              const potentialProjectPath = `game/audio/${fileName}`;
              next.set(aud.path, {
                ...aud,
                filePath: aud.path,
                isInProject: false,
                fileHandle: null,
                projectFilePath: next.has(potentialProjectPath) ? potentialProjectPath : undefined,
              });
            }
          });
          return next;
        });
      })
    )).finally(() => {
      perfRecorders.recordScanEnd();
      setIsScanningAssets(false);
      setIsRefreshingAudios(false);
      setAudiosLastScanned(Date.now());
    });
  }

  // No-settings fallback: reset tab/split state that hydrateFromProjectData would
  // otherwise leave at stale values when settings is null.
  if (snapshot.primaryTabs.length === 0) {
    setOpenTabs([{ id: 'canvas', type: 'canvas' }]);
    setActiveTabId('canvas');
  }
}

export interface UseProjectLoadParams {
  // Refs
  loadCancelRef: React.MutableRefObject<boolean>;
  blocksRef: React.MutableRefObject<Block[]>;
  pendingStoryLayoutRefreshRef: React.MutableRefObject<import('@/types').PendingStoryLayoutRefresh | null>;
  pendingRouteLayoutRefreshRef: React.MutableRefObject<import('@/types').PendingRouteLayoutRefresh | null>;
  pendingAutoCenterRef: React.MutableRefObject<{ story: boolean; route: boolean; choice: boolean }>;

  // Loading overlay
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingProgress: React.Dispatch<React.SetStateAction<number>>;
  setLoadingMessage: React.Dispatch<React.SetStateAction<string>>;

  // App settings (for recent projects)
  updateAppSettings: (updater: (draft: AppSettings) => void) => void;

  // Save state
  setHasUnsavedSettings: React.Dispatch<React.SetStateAction<boolean>>;
  setIsInitialAnalysisPending: React.Dispatch<React.SetStateAction<boolean>>;

  // Popped-out (detached-window) tabs -- closed before loading a different project,
  // since their relayed RPC calls would otherwise keep targeting block ids from the
  // project being replaced.
  poppedOutTabs: Map<string, { tab: EditorTab; paneId: 'primary' | 'secondary'; index: number }>;
  setPoppedOutTabs: React.Dispatch<React.SetStateAction<Map<string, { tab: EditorTab; paneId: 'primary' | 'secondary'; index: number }>>>;

  // Performance metrics
  perfRecorders: {
    recordLoad: (ms: number) => void;
    recordScanStart: () => void;
    recordScanEnd: () => void;
  };

  addToast: (message: string, type?: ToastType) => void;

  // All hydration setters (passed through to hydrateFromProjectData)
  hydrateSetters: HydrateSetters;
}

export interface UseProjectLoadReturn {
  loadProject: (path: string) => Promise<void>;
}

export function useProjectLoad(params: UseProjectLoadParams): UseProjectLoadReturn {
  const {
    loadCancelRef, blocksRef,
    setIsLoading, setLoadingProgress, setLoadingMessage,
    updateAppSettings,
    setHasUnsavedSettings, setIsInitialAnalysisPending,
    perfRecorders, addToast,
    hydrateSetters,
    poppedOutTabs, setPoppedOutTabs,
  } = params;

  const loadProject = useCallback(async (path: string) => {
    loadCancelRef.current = false;
    const loadStartTime = performance.now();

    // A popped-out tab window relays RPC calls (updateBlock, setBlockContent, ...)
    // against the *current* project's block ids -- once this project is replaced,
    // those calls would silently target ids that don't exist (or worse, collide
    // with unrelated ids) in the new project. Close them before touching any state.
    if (poppedOutTabs.size > 0) {
      await window.electronAPI?.closeAllPopouts?.();
      setPoppedOutTabs(new Map());
    }

    setIsLoading(true);
    setLoadingProgress(5);
    setLoadingMessage('Reading project files...');
    const unsubscribeProgress = window.electronAPI?.onLoadProgress?.((value, message) => {
      setLoadingProgress(value);
      setLoadingMessage(message);
    });

    try {
      const projectData = await window.electronAPI!.loadProject(path);

      if (loadCancelRef.current) return;

      if (projectData.settingsWarning) {
        addToast('Project settings could not be read — using defaults', 'warning');
      }

      setLoadingProgress(93);
      setLoadingMessage(`Processing ${projectData.files.length} files and ${projectData.images.length} images...`);

      // Phase 1: pure deserialization — no React state touched
      const snapshot = deserializeProjectData(projectData, blocksRef.current);

      // Write default script.rpy when the project was empty
      if (snapshot.defaultScriptBlock && window.electronAPI?.writeFile) {
        const scriptPath = await window.electronAPI.path.join(projectData.rootPath, 'script.rpy') as string;
        await window.electronAPI.writeFile(scriptPath, snapshot.defaultScriptBlock.content);
        if (snapshot.tree?.children !== undefined) {
          snapshot.tree.children = [
            ...(snapshot.tree.children ?? []),
            { name: 'script.rpy', path: 'script.rpy' },
          ];
        }
      }

      setLoadingProgress(96);
      setLoadingMessage('Restoring workspace...');

      // Phase 2: hydrate React state from snapshot
      hydrateFromProjectData(snapshot, hydrateSetters);

      // Update recent projects (app-level, not project-level state)
      updateAppSettings(draft => {
        const filtered = draft.recentProjects.filter(p => p !== projectData.rootPath);
        draft.recentProjects = [projectData.rootPath, ...filtered].slice(0, 10);
      });

      setLoadingProgress(99);
      setLoadingMessage('Done');
      setIsInitialAnalysisPending(true);
      setHasUnsavedSettings(false);
      perfRecorders.recordLoad(performance.now() - loadStartTime);
      addToast('Project loaded successfully', 'success');
    } catch (err) {
      if (loadCancelRef.current) return;
      logger.error('Failed to load project', err);
      addToast('Failed to load project', 'error');
    } finally {
      unsubscribeProgress?.();
      setIsLoading(false);
      setLoadingMessage('');
      setLoadingProgress(0);
    }
  }, [
    loadCancelRef, blocksRef, hydrateSetters,
    setIsLoading, setLoadingMessage, setLoadingProgress,
    updateAppSettings, setHasUnsavedSettings, setIsInitialAnalysisPending,
    perfRecorders, addToast,
    poppedOutTabs, setPoppedOutTabs,
  ]);

  return { loadProject };
}
