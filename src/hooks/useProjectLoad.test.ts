import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectLoad, hydrateFromProjectData } from '@/hooks/useProjectLoad';
import { installElectronAPI, uninstallElectronAPI } from '@/test/mocks/electronAPI';
import { createBlock, createNotecard, createNotecardLink } from '@/test/mocks/sampleData';
import type { ProjectSnapshot, HydrateSetters } from '@/hooks/useProjectLoad';
import type { EditorTab } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMinimalSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    rootPath: '/project',
    tree: { name: 'game', path: '/project/game', children: [] },
    blocks: [],
    defaultScriptBlock: null,
    images: new Map(),
    audios: new Map(),
    imageScanPaths: [],
    audioScanPaths: [],
    stickyNotes: [],
    routeStickyNotes: [],
    choiceStickyNotes: [],
    notecards: [],
    notecardLinks: [],
    notecardTimeline: { slotLabels: {} },
    characterProfiles: {},
    characterPortraits: {},
    punchlistMetadata: {},
    diagnosticsTasks: [],
    ignoredDiagnostics: [],
    dismissedImplicitVariableHint: false,
    sceneCompositions: {},
    sceneNames: {},
    imagemapCompositions: {},
    routeNodeLayoutCache: new Map(),
    primaryTabs: [{ id: 'canvas', type: 'canvas' } as EditorTab],
    primaryActiveTabId: 'canvas',
    secondaryTabs: [],
    secondaryActiveTabId: '',
    splitLayout: 'none',
    splitPrimarySize: 600,
    pendingStoryLayoutRefresh: null as unknown as import('@/types').PendingStoryLayoutRefresh,
    pendingRouteLayoutRefresh: null as unknown as import('@/types').PendingRouteLayoutRefresh,
    canvasSettings: {
      draftingMode: false,
      storyCanvasLayoutMode: 'auto',
      storyCanvasGroupingMode: 'none',
      storyCanvasLayoutFingerprint: undefined,
      storyCanvasLayoutVersion: 0,
      storyCanvasLayoutWasUserAdjusted: false,
      routeCanvasLayoutMode: 'auto',
      routeCanvasGroupingMode: 'none',
      routeCanvasLayoutFingerprint: undefined,
      routeCanvasLayoutVersion: 0,
      routeCanvasLayoutWasUserAdjusted: false,
      completedMilestones: [],
    },
    ...overrides,
  };
}

function createMockHydrateSetters(): HydrateSetters {
  return {
    pendingStoryLayoutRefreshRef: { current: null },
    pendingRouteLayoutRefreshRef: { current: null },
    pendingAutoCenterRef: { current: { story: false, route: false, choice: false } },
    setProjectRootPath: vi.fn(),
    setFileSystemTree: vi.fn(),
    updateProjectSettings: vi.fn(),
    setBlocks: vi.fn(),
    setImages: vi.fn(),
    setAudios: vi.fn(),
    setImageScanDirectories: vi.fn(),
    setAudioScanDirectories: vi.fn(),
    setIsScanningAssets: vi.fn(),
    setIsRefreshingImages: vi.fn(),
    setIsRefreshingAudios: vi.fn(),
    setImagesLastScanned: vi.fn(),
    setAudiosLastScanned: vi.fn(),
    setStickyNotes: vi.fn(),
    setRouteStickyNotes: vi.fn(),
    setChoiceStickyNotes: vi.fn(),
    setNotecards: vi.fn(),
    setNotecardLinks: vi.fn(),
    setNotecardTimeline: vi.fn(),
    setCharacterProfiles: vi.fn(),
    setCharacterPortraits: vi.fn(),
    setPunchlistMetadata: vi.fn(),
    setDiagnosticsTasks: vi.fn(),
    setIgnoredDiagnostics: vi.fn(),
    setDismissedImplicitVarHint: vi.fn(),
    setSceneCompositions: vi.fn(),
    setSceneNames: vi.fn(),
    setImagemapCompositions: vi.fn(),
    setRouteNodeLayoutCache: vi.fn(),
    setOpenTabs: vi.fn(),
    setActiveTabId: vi.fn(),
    setSecondaryOpenTabs: vi.fn(),
    setSecondaryActiveTabId: vi.fn(),
    setSplitLayout: vi.fn(),
    setSplitPrimarySize: vi.fn(),
    setTabs: vi.fn(),
    perfRecorders: {
      recordScanStart: vi.fn(),
      recordScanEnd: vi.fn(),
    },
  };
}

// ---------------------------------------------------------------------------
// hydrateFromProjectData
// ---------------------------------------------------------------------------

describe('hydrateFromProjectData', () => {
  it('calls setProjectRootPath with snapshot.rootPath', () => {
    const snapshot = createMinimalSnapshot({ rootPath: '/my/project' });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setProjectRootPath).toHaveBeenCalledWith('/my/project');
  });

  it('calls setBlocks with snapshot.blocks', () => {
    const blocks = [createBlock({ id: 'b1' })];
    const snapshot = createMinimalSnapshot({ blocks });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setBlocks).toHaveBeenCalledWith(blocks);
  });

  it('calls setFileSystemTree with snapshot.tree', () => {
    const tree = { name: 'game', path: '/project/game', children: [] };
    const snapshot = createMinimalSnapshot({ tree });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setFileSystemTree).toHaveBeenCalledWith(tree);
  });

  it('calls setImages with snapshot.images', () => {
    const images = new Map([['img-1', { filePath: '/img.png' } as unknown as import('@/types').ProjectImage]]);
    const snapshot = createMinimalSnapshot({ images });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setImages).toHaveBeenCalledWith(images);
  });

  it('calls setAudios with snapshot.audios', () => {
    const audios = new Map();
    const snapshot = createMinimalSnapshot({ audios });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setAudios).toHaveBeenCalledWith(audios);
  });

  it('calls setDiagnosticsTasks with snapshot.diagnosticsTasks', () => {
    const tasks = [{ id: 't1', title: 'Fix it', description: '', status: 'open' as const, createdAt: 0 }];
    const snapshot = createMinimalSnapshot({ diagnosticsTasks: tasks });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setDiagnosticsTasks).toHaveBeenCalledWith(tasks);
  });

  it('calls setIgnoredDiagnostics with snapshot.ignoredDiagnostics', () => {
    const ignored = [{ category: 'invalid-jump' as const, filePath: 'game/s.rpy', line: 1, message: 'msg' }];
    const snapshot = createMinimalSnapshot({ ignoredDiagnostics: ignored });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setIgnoredDiagnostics).toHaveBeenCalledWith(ignored);
  });

  it('calls setTabs with primaryTabs and primaryActiveTabId', () => {
    const tabs: EditorTab[] = [{ id: 'canvas', type: 'canvas' } as EditorTab];
    const snapshot = createMinimalSnapshot({ primaryTabs: tabs, primaryActiveTabId: 'canvas' });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setTabs).toHaveBeenCalledWith(tabs, 'canvas', 'primary');
  });

  it('calls setSplitLayout with snapshot.splitLayout', () => {
    const snapshot = createMinimalSnapshot({ splitLayout: 'right' });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setSplitLayout).toHaveBeenCalledWith('right');
  });

  it('sets pendingAutoCenterRef to all true', () => {
    const snapshot = createMinimalSnapshot();
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.pendingAutoCenterRef.current).toEqual({ story: true, route: true, choice: true });
  });

  it('calls updateProjectSettings with canvas settings', () => {
    const snapshot = createMinimalSnapshot();
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.updateProjectSettings).toHaveBeenCalled();
  });

  it('falls back to canvas tab when primaryTabs is empty', () => {
    const snapshot = createMinimalSnapshot({ primaryTabs: [], primaryActiveTabId: '' });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setOpenTabs).toHaveBeenCalledWith([{ id: 'canvas', type: 'canvas' }]);
    expect(setters.setActiveTabId).toHaveBeenCalledWith('canvas');
  });

  it('calls setDismissedImplicitVarHint', () => {
    const snapshot = createMinimalSnapshot({ dismissedImplicitVariableHint: true });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setDismissedImplicitVarHint).toHaveBeenCalledWith(true);
  });

  it('calls setRouteStickyNotes with snapshot.routeStickyNotes', () => {
    const notes = [{ id: 'n1', content: 'todo', position: { x: 0, y: 0 }, width: 200, height: 150, color: 'yellow' as const }];
    const snapshot = createMinimalSnapshot({ routeStickyNotes: notes });
    const setters = createMockHydrateSetters();
    hydrateFromProjectData(snapshot, setters);
    expect(setters.setRouteStickyNotes).toHaveBeenCalledWith(notes);
  });

  it('hydrates notecards and notecardLinks from the snapshot', () => {
    const setNotecards = vi.fn();
    const setNotecardLinks = vi.fn();
    const notecards = [createNotecard()];
    const notecardLinks = [createNotecardLink()];
    const snapshot = createMinimalSnapshot({ notecards, notecardLinks });
    const setters = { ...createMockHydrateSetters(), setNotecards, setNotecardLinks };
    hydrateFromProjectData(snapshot, setters);
    expect(setNotecards).toHaveBeenCalledWith(notecards);
    expect(setNotecardLinks).toHaveBeenCalledWith(notecardLinks);
  });

  it('hydrates notecardTimeline from the snapshot', () => {
    const setNotecardTimeline = vi.fn();
    const notecardTimeline = { slotLabels: { 0: 'Opening' } };
    const snapshot = createMinimalSnapshot({ notecardTimeline });
    const setters = { ...createMockHydrateSetters(), setNotecardTimeline };
    hydrateFromProjectData(snapshot, setters);
    expect(setNotecardTimeline).toHaveBeenCalledWith(notecardTimeline);
  });
});

// ---------------------------------------------------------------------------
// useProjectLoad
// ---------------------------------------------------------------------------

describe('useProjectLoad', () => {
  let api: ReturnType<typeof installElectronAPI>;

  beforeEach(() => {
    api = installElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) =>
      Promise.resolve(parts.join('/'))
    );
  });

  afterEach(() => {
    uninstallElectronAPI();
  });

  function makeParams(overrides: Partial<Parameters<typeof useProjectLoad>[0]> = {}) {
    return {
      loadCancelRef: { current: false },
      blocksRef: { current: [] },
      pendingStoryLayoutRefreshRef: { current: null },
      pendingRouteLayoutRefreshRef: { current: null },
      pendingAutoCenterRef: { current: { story: false, route: false, choice: false } },
      setIsLoading: vi.fn(),
      setLoadingProgress: vi.fn(),
      setLoadingMessage: vi.fn(),
      updateAppSettings: vi.fn(),
      setHasUnsavedSettings: vi.fn(),
      setIsInitialAnalysisPending: vi.fn(),
      perfRecorders: {
        recordLoad: vi.fn(),
        recordScanStart: vi.fn(),
        recordScanEnd: vi.fn(),
      },
      addToast: vi.fn(),
      hydrateSetters: createMockHydrateSetters(),
      poppedOutTabs: new Map(),
      setPoppedOutTabs: vi.fn(),
      ...overrides,
    };
  }

  it('returns a loadProject function', () => {
    const { result } = renderHook(() => useProjectLoad(makeParams()));
    expect(typeof result.current.loadProject).toBe('function');
  });

  it('toasts a warning when the project load result carries a settingsWarning', async () => {
    const params = makeParams();
    api.loadProject.mockResolvedValue({
      rootPath: '/project',
      files: [],
      images: [],
      audios: [],
      tree: { name: 'game', path: '', children: [] },
      settings: null,
      settingsWarning: { code: 'corrupted', message: 'Unexpected token in JSON' },
    } as unknown as Parameters<typeof api.loadProject.mockResolvedValue>[0]);

    const { result } = renderHook(() => useProjectLoad(params));
    await act(async () => {
      await result.current.loadProject('/project');
    });

    expect(params.addToast).toHaveBeenCalledWith(
      expect.stringContaining('Project settings could not be read'),
      'warning',
    );
  });

  it('calls setIsLoading(true) at start of load', async () => {
    const params = makeParams();
    // loadProject() will fail when electronAPI.loadProject is the default mock
    // that returns { blocks: [], settings: {} } — deserializeProjectData may throw.
    // We accept that and just check setIsLoading was called.
    api.loadProject.mockResolvedValue({
      rootPath: '/project',
      files: [],
      images: [],
      audios: [],
      settings: null,
      ideSettings: null,
    } as unknown as Parameters<typeof api.loadProject.mockResolvedValue>[0]);

    const { result } = renderHook(() => useProjectLoad(params));
    await act(async () => {
      try {
        await result.current.loadProject('/project');
      } catch {
        // may throw from deserializeProjectData — that's ok for this test
      }
    });
    expect(params.setIsLoading).toHaveBeenCalledWith(true);
  });

  it('calls setIsLoading(false) in finally block', async () => {
    const params = makeParams();
    api.loadProject.mockRejectedValue(new Error('IPC failed'));
    const { result } = renderHook(() => useProjectLoad(params));
    await act(async () => {
      await result.current.loadProject('/project');
    });
    expect(params.setIsLoading).toHaveBeenCalledWith(false);
  });

  it('calls addToast with error when loadProject IPC rejects', async () => {
    const params = makeParams();
    api.loadProject.mockRejectedValue(new Error('IPC failed'));
    const { result } = renderHook(() => useProjectLoad(params));
    await act(async () => {
      await result.current.loadProject('/project');
    });
    expect(params.addToast).toHaveBeenCalledWith('Failed to load project', 'error');
  });

  it('does not call addToast on error if loadCancelRef is set during load', async () => {
    // loadProject resets the ref to false at start — cancellation is only
    // effective when set DURING the async operation (e.g. from another call).
    // We simulate this by having the IPC mock set the ref to true mid-call.
    const loadCancelRef = { current: false };
    const params = makeParams({ loadCancelRef });
    api.loadProject.mockImplementation(() => {
      loadCancelRef.current = true;
      return Promise.reject(new Error('cancelled mid-load'));
    });
    const { result } = renderHook(() => useProjectLoad(params));
    await act(async () => {
      await result.current.loadProject('/project');
    });
    expect(params.addToast).not.toHaveBeenCalled();
  });

  it('calls setLoadingProgress(5) at start', async () => {
    const params = makeParams();
    api.loadProject.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useProjectLoad(params));
    await act(async () => {
      await result.current.loadProject('/project');
    });
    expect(params.setLoadingProgress).toHaveBeenCalledWith(5);
  });

  it('resets loadingProgress to 0 in finally', async () => {
    const params = makeParams();
    api.loadProject.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useProjectLoad(params));
    await act(async () => {
      await result.current.loadProject('/project');
    });
    expect(params.setLoadingProgress).toHaveBeenCalledWith(0);
  });
});
