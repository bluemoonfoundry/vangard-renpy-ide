import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectIO } from '@/hooks/useProjectIO';
import { installElectronAPI, createMockElectronAPI } from '@/test/mocks/electronAPI';
import { createBlock, createNotecard, createNotecardLink } from '@/test/mocks/sampleData';
import type { UseProjectIOParams } from '@/hooks/useProjectIO';

function makeParams(overrides: Partial<UseProjectIOParams> = {}): UseProjectIOParams {
  return {
    blocksRef: { current: [createBlock()] },
    dirtyBlockIdsRef: { current: new Set() },
    dirtyEditorsRef: { current: new Set() },
    editorInstances: { current: new Map() },

    projectRootPath: '/project',
    setFileSystemTree: vi.fn(),

    projectSettings: {
      groups: [],
      stickyNotes: [],
      routeStickyNotes: [],
      choiceStickyNotes: [],
      renpyPath: '',
      projectImages: [],
      projectAudios: [],
      imagemapCompositions: {},
      screenLayoutCompositions: {},
      routeNodePositions: {},
      storyNodePositions: {},
      choiceNodePositions: {},
      milestones: [],
      completedMilestones: [],
    } as unknown as UseProjectIOParams['projectSettings'],

    blocks: [createBlock()],
    setBlocks: vi.fn(),

    setImages: vi.fn(),
    setAudios: vi.fn(),
    imageScanDirectories: new Map(),
    audioScanDirectories: new Map(),

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
    dismissedImplicitVarHint: false,
    sceneCompositions: {},
    sceneNames: {},
    imagemapCompositions: {},
    routeNodeLayoutCache: new Map(),
    openTabs: [],
    activeTabId: 'canvas',
    secondaryOpenTabs: [],
    secondaryActiveTabId: '',
    splitLayout: 'none',
    splitPrimarySize: 600,

    dirtyBlockIds: new Set(),
    setDirtyBlockIds: vi.fn(),
    dirtyEditors: new Set(),
    setDirtyEditors: vi.fn(),
    setHasUnsavedSettings: vi.fn(),
    setSaveStatus: vi.fn(),
    filesWithDiskConflict: new Set(),
    setFilesWithDiskConflict: vi.fn(),
    setExternallyChangedFiles: vi.fn(),
    notifyFirstSave: vi.fn(),
    openUnsavedChangesModal: vi.fn(),
    closeUnsavedChangesModal: vi.fn(),

    setOpenTabs: vi.fn(),
    untitledFiles: new Map(),
    saveUntitledFile: vi.fn().mockResolvedValue(true),
    addToast: vi.fn(),
    ...overrides,
  };
}

describe('useProjectIO', () => {
  beforeEach(() => {
    installElectronAPI();
  });

  it('returns all four expected functions', () => {
    const { result } = renderHook(() => useProjectIO(makeParams()));
    expect(typeof result.current.handleSaveProjectSettings).toBe('function');
    expect(typeof result.current.handleSaveAll).toBe('function');
    expect(typeof result.current.handleReloadFromDisk).toBe('function');
    expect(typeof result.current.handleRefreshProject).toBe('function');
  });

  // ---------------------------------------------------------------------------
  // handleSaveProjectSettings
  // ---------------------------------------------------------------------------

  it('does nothing when projectRootPath is null', async () => {
    const setSaveStatus = vi.fn();
    const { result } = renderHook(() =>
      useProjectIO(makeParams({ projectRootPath: null, setSaveStatus })),
    );
    await act(async () => { await result.current.handleSaveProjectSettings(); });
    expect(setSaveStatus).not.toHaveBeenCalled();
  });

  it('writes project.ide.json to the correct path', async () => {
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    api.writeFile.mockResolvedValue({ success: true });
    installElectronAPI(api);

    const { result } = renderHook(() => useProjectIO(makeParams()));
    await act(async () => { await result.current.handleSaveProjectSettings(); });

    expect(api.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('project.ide.json'),
      expect.any(String),
    );
  });

  it('calls setHasUnsavedSettings(false) after successful settings save', async () => {
    const setHasUnsavedSettings = vi.fn();
    const { result } = renderHook(() => useProjectIO(makeParams({ setHasUnsavedSettings })));
    await act(async () => { await result.current.handleSaveProjectSettings(); });
    expect(setHasUnsavedSettings).toHaveBeenCalledWith(false);
  });

  it('calls addToast with error when settings writeFile fails', async () => {
    const api = createMockElectronAPI();
    api.writeFile.mockRejectedValue(new Error('disk full'));
    installElectronAPI(api);
    const addToast = vi.fn();
    const { result } = renderHook(() => useProjectIO(makeParams({ addToast })));
    await act(async () => { await result.current.handleSaveProjectSettings(); });
    expect(addToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('does not clear the unsaved-settings flag when writeFile resolves with success: false', async () => {
    // fs:writeFile in electron.js never rejects -- it catches internally and
    // resolves { success: false, error }. A settings save that "fails" this
    // way must not be treated as saved, or a crash-safety gap opens: the
    // user believes their workspace state persisted when it didn't.
    const api = createMockElectronAPI();
    api.writeFile.mockResolvedValue({ success: false, error: 'ENOSPC: no space left on device' });
    installElectronAPI(api);
    const setHasUnsavedSettings = vi.fn();
    const addToast = vi.fn();
    const { result } = renderHook(() => useProjectIO(makeParams({ setHasUnsavedSettings, addToast })));

    await act(async () => { await result.current.handleSaveProjectSettings(); });

    expect(setHasUnsavedSettings).not.toHaveBeenCalledWith(false);
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('ENOSPC'), 'error');
  });

  it('serializes sceneCompositions to file-path-only sprites', async () => {
    const api = createMockElectronAPI();
    installElectronAPI(api);
    const sceneCompositions: UseProjectIOParams['sceneCompositions'] = {
      'scene-1': {
        background: {
          id: 's1',
          image: { filePath: 'game/images/bg.png', fileName: 'bg.png', dataUrl: 'data:...', fileHandle: null, isInProject: true, lastModified: 0, size: 0 },
          x: 0.5, y: 1, zoom: 1, zIndex: 0, flipH: false, flipV: false, rotation: 0, alpha: 1, blur: 0,
        },
        sprites: [],
        resolution: { width: 1280, height: 720 },
      },
    };
    const { result } = renderHook(() => useProjectIO(makeParams({ sceneCompositions })));
    await act(async () => { await result.current.handleSaveProjectSettings(); });
    const written = JSON.parse(api.writeFile.mock.calls[0][1] as string);
    expect(written.sceneCompositions['scene-1'].background.image).toEqual({ filePath: 'game/images/bg.png' });
  });

  it('includes notecards and notecardLinks in the saved settings payload', async () => {
    const api = createMockElectronAPI();
    installElectronAPI(api);
    const notecards = [createNotecard({ id: 'nc-1' })];
    const notecardLinks = [createNotecardLink({ id: 'ncl-1', fromId: 'nc-1', toId: 'nc-2' })];
    const { result } = renderHook(() => useProjectIO(makeParams({ notecards, notecardLinks })));
    await act(async () => { await result.current.handleSaveProjectSettings(); });
    const written = JSON.parse(api.writeFile.mock.calls[0][1] as string);
    expect(written.notecards).toEqual(notecards);
    expect(written.notecardLinks).toEqual(notecardLinks);
  });

  it('includes notecardTimeline in the saved settings payload', async () => {
    const api = createMockElectronAPI();
    installElectronAPI(api);
    const notecardTimeline = { slotLabels: { 0: 'Opening' } };
    const { result } = renderHook(() => useProjectIO(makeParams({ notecardTimeline })));
    await act(async () => { await result.current.handleSaveProjectSettings(); });
    const written = JSON.parse(api.writeFile.mock.calls[0][1] as string);
    expect(written.notecardTimeline).toEqual(notecardTimeline);
  });

  // ---------------------------------------------------------------------------
  // handleSaveAll
  // ---------------------------------------------------------------------------

  it('handleSaveAll does nothing when no dirty blocks and no dirty editors', async () => {
    const setSaveStatus = vi.fn();
    const { result } = renderHook(() =>
      useProjectIO(makeParams({ setSaveStatus, dirtyBlockIds: new Set(), dirtyEditors: new Set() })),
    );
    await act(async () => { await result.current.handleSaveAll(); });
    expect(true).toBe(true); // no throw
  });

  it('writes each dirty block file and clears dirty state', async () => {
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    api.writeFile.mockResolvedValue({ success: true });
    installElectronAPI(api);

    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy', content: 'label start:\n    return\n' });
    const setDirtyBlockIds = vi.fn();
    const setDirtyEditors = vi.fn();
    const addToast = vi.fn();

    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      dirtyBlockIds: new Set(['b1']),
      dirtyEditors: new Set(),
      setDirtyBlockIds,
      setDirtyEditors,
      addToast,
    })));

    await act(async () => { await result.current.handleSaveAll(); });

    expect(api.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('script.rpy'),
      block.content,
    );
    expect(setDirtyBlockIds).toHaveBeenCalledWith(new Set());
    expect(setDirtyEditors).toHaveBeenCalledWith(new Set());
    expect(addToast).toHaveBeenCalledWith('All changes saved', 'success');
  });

  it('handleSaveAll resolves true when everything saves successfully', async () => {
    // The exit-confirmation flow (App.tsx) trusts this return value directly
    // instead of re-deriving "is it safe to quit" from dirty-state refs that
    // are only synced via a useEffect -- checking those refs immediately after
    // this promise resolves can read stale (pre-clear) values. See
    // bmf-vangard-renpy-ide-6o47.1 follow-up: double-click-to-exit bug.
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    api.writeFile.mockResolvedValue({ success: true });
    installElectronAPI(api);

    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy', content: 'label start:\n    return\n' });
    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      dirtyBlockIds: new Set(['b1']),
      dirtyEditors: new Set(),
    })));

    let saveResult: boolean | undefined;
    await act(async () => { saveResult = await result.current.handleSaveAll(); });

    expect(saveResult).toBe(true);
  });

  it('handleSaveAll resolves false when a block write fails', async () => {
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    api.writeFile.mockResolvedValue({ success: false, error: 'write failed' });
    installElectronAPI(api);

    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy' });
    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      dirtyBlockIds: new Set(['b1']),
      dirtyEditors: new Set(),
    })));

    let saveResult: boolean | undefined;
    await act(async () => { saveResult = await result.current.handleSaveAll(); });

    expect(saveResult).toBe(false);
  });

  it('handleSaveAll resolves false when an untitled file save is canceled, even though blocks saved', async () => {
    // doSaveAll still clears dirtyBlockIds/dirtyEditors and toasts a "warning"
    // (not error) in this case -- but the untitled file itself is still
    // unsaved, so it must not be treated as safe to quit.
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    api.writeFile.mockResolvedValue({ success: true });
    installElectronAPI(api);

    const saveUntitledFile = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useProjectIO(makeParams({
      openTabs: [{ id: 'untitled-1', type: 'untitled', title: 'Untitled-1' } as never],
      untitledFiles: new Map([['untitled-1', { title: 'Untitled-1', content: 'a', isDirty: true }]]),
      saveUntitledFile,
    })));

    let saveResult: boolean | undefined;
    await act(async () => { saveResult = await result.current.handleSaveAll(); });

    expect(saveResult).toBe(false);
  });

  it('does not clear dirty state or report success when the block saves but project.ide.json fails to save', async () => {
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    api.writeFile.mockImplementation((filePath: string) => {
      if (filePath.includes('project.ide.json')) {
        return Promise.resolve({ success: false, error: 'ENOSPC: no space left on device' });
      }
      return Promise.resolve({ success: true });
    });
    installElectronAPI(api);

    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy', content: 'label start:\n    return\n' });
    const setDirtyBlockIds = vi.fn();
    const setDirtyEditors = vi.fn();
    const setSaveStatus = vi.fn();
    const addToast = vi.fn();

    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      dirtyBlockIds: new Set(['b1']),
      dirtyEditors: new Set(),
      setDirtyBlockIds,
      setDirtyEditors,
      setSaveStatus,
      addToast,
    })));

    await act(async () => { await result.current.handleSaveAll(); });

    // The block content did get written to disk, but the overall save must
    // not be reported as clean/successful -- the workspace metadata (open
    // tabs, layouts, etc.) never persisted.
    expect(setDirtyBlockIds).not.toHaveBeenCalledWith(new Set());
    expect(setSaveStatus).toHaveBeenCalledWith('error');
    expect(addToast).not.toHaveBeenCalledWith('All changes saved', 'success');
  });

  it('saves dirty untitled tabs across both panes', async () => {
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    installElectronAPI(api);

    const saveUntitledFile = vi.fn().mockResolvedValue(true);
    const addToast = vi.fn();

    const { result } = renderHook(() => useProjectIO(makeParams({
      openTabs: [{ id: 'untitled-1', type: 'untitled', title: 'Untitled-1' } as never],
      secondaryOpenTabs: [{ id: 'untitled-2', type: 'untitled', title: 'Untitled-2' } as never],
      untitledFiles: new Map([
        ['untitled-1', { title: 'Untitled-1', content: 'a', isDirty: true }],
        ['untitled-2', { title: 'Untitled-2', content: 'b', isDirty: true }],
      ]),
      saveUntitledFile,
      addToast,
    })));

    await act(async () => { await result.current.handleSaveAll(); });

    expect(saveUntitledFile).toHaveBeenCalledWith('untitled-1');
    expect(saveUntitledFile).toHaveBeenCalledWith('untitled-2');
    expect(addToast).toHaveBeenCalledWith('All changes saved', 'success');
  });

  it('does not save a non-dirty untitled tab, and warns instead of full success when an untitled save is canceled', async () => {
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    installElectronAPI(api);

    const saveUntitledFile = vi.fn().mockResolvedValue(false);
    const addToast = vi.fn();

    const { result } = renderHook(() => useProjectIO(makeParams({
      openTabs: [
        { id: 'untitled-1', type: 'untitled', title: 'Untitled-1' } as never,
        { id: 'untitled-2', type: 'untitled', title: 'Untitled-2' } as never,
      ],
      untitledFiles: new Map([
        ['untitled-1', { title: 'Untitled-1', content: 'a', isDirty: true }],
        ['untitled-2', { title: 'Untitled-2', content: '', isDirty: false }],
      ]),
      saveUntitledFile,
      addToast,
    })));

    await act(async () => { await result.current.handleSaveAll(); });

    expect(saveUntitledFile).toHaveBeenCalledTimes(1);
    expect(saveUntitledFile).toHaveBeenCalledWith('untitled-1');
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('untitled files were not saved'), 'warning');
  });

  it('reads content from editor instance for dirtyEditors', async () => {
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    api.writeFile.mockResolvedValue({ success: true });
    installElectronAPI(api);

    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy', content: 'old content' });
    const editorContent = 'new content from editor';
    const mockEditorInstance = { getValue: vi.fn(() => editorContent) };

    const setBlocks = vi.fn();
    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      dirtyBlockIds: new Set(),
      dirtyEditors: new Set(['b1']),
      editorInstances: { current: new Map([['b1', mockEditorInstance as never]]) },
      setBlocks,
    })));

    await act(async () => { await result.current.handleSaveAll(); });

    expect(mockEditorInstance.getValue).toHaveBeenCalled();
    expect(api.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('script.rpy'),
      editorContent,
    );
  });

  it('sets setSaveStatus to error when writeFile fails', async () => {
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    api.writeFile.mockResolvedValue({ success: false, error: 'write failed' });
    installElectronAPI(api);

    const setSaveStatus = vi.fn();
    const addToast = vi.fn();
    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy' });

    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      dirtyBlockIds: new Set(['b1']),
      dirtyEditors: new Set(),
      setSaveStatus,
      addToast,
    })));

    await act(async () => { await result.current.handleSaveAll(); });

    expect(setSaveStatus).toHaveBeenCalledWith('error');
    expect(addToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('names the failing file and the underlying error in the save-failure toast', async () => {
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    api.writeFile.mockResolvedValue({ success: false, error: 'ENOSPC: no space left on device' });
    installElectronAPI(api);

    const addToast = vi.fn();
    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy' });

    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      dirtyBlockIds: new Set(['b1']),
      dirtyEditors: new Set(),
      addToast,
    })));

    await act(async () => { await result.current.handleSaveAll(); });

    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/game\/script\.rpy.*ENOSPC: no space left on device/),
      'error',
    );
  });

  it('saves to memory when projectRootPath is null', async () => {
    const addToast = vi.fn();
    const setDirtyBlockIds = vi.fn();
    const notifyFirstSave = vi.fn();

    const { result } = renderHook(() => useProjectIO(makeParams({
      projectRootPath: null,
      dirtyBlockIds: new Set(['block-1']),
      addToast,
      setDirtyBlockIds,
      notifyFirstSave,
    })));

    await act(async () => { await result.current.handleSaveAll(); });

    expect(addToast).toHaveBeenCalledWith('Changes saved to memory', 'success');
    expect(setDirtyBlockIds).toHaveBeenCalledWith(new Set());
    expect(notifyFirstSave).toHaveBeenCalled();
  });

  it('opens conflict modal when dirty files have disk conflicts', async () => {
    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy' });
    const openUnsavedChangesModal = vi.fn();

    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      dirtyBlockIds: new Set(['b1']),
      filesWithDiskConflict: new Set(['game/script.rpy']),
      openUnsavedChangesModal,
    })));

    await act(async () => { await result.current.handleSaveAll(); });

    expect(openUnsavedChangesModal).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Overwrite') })
    );
  });

  it('calls notifyFirstSave after a successful save', async () => {
    const api = createMockElectronAPI();
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    api.writeFile.mockResolvedValue({ success: true });
    installElectronAPI(api);

    const notifyFirstSave = vi.fn();
    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy' });

    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      dirtyBlockIds: new Set(['b1']),
      dirtyEditors: new Set(),
      notifyFirstSave,
    })));

    await act(async () => { await result.current.handleSaveAll(); });

    expect(notifyFirstSave).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // handleReloadFromDisk
  // ---------------------------------------------------------------------------

  it('reads the file and updates block content on reload', async () => {
    const api = createMockElectronAPI();
    const newContent = 'label reloaded:\n    return\n';
    api.readFile.mockResolvedValue(newContent);
    installElectronAPI(api);

    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy', content: 'old' });
    const setBlocks = vi.fn();
    const setDirtyBlockIds = vi.fn();

    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      setBlocks,
      setDirtyBlockIds,
    })));

    await act(async () => {
      await result.current.handleReloadFromDisk({ relativePath: 'game/script.rpy', absolutePath: '/project/game/script.rpy' });
    });

    expect(api.readFile).toHaveBeenCalledWith('/project/game/script.rpy');
    expect(setBlocks).toHaveBeenCalled();
    expect(setDirtyBlockIds).toHaveBeenCalled();
  });

  it('does nothing when block for relativePath is not found', async () => {
    const api = createMockElectronAPI();
    installElectronAPI(api);
    const setBlocks = vi.fn();

    const { result } = renderHook(() => useProjectIO(makeParams({ setBlocks })));

    await act(async () => {
      await result.current.handleReloadFromDisk({ relativePath: 'game/missing.rpy', absolutePath: '/project/game/missing.rpy' });
    });

    expect(api.readFile).not.toHaveBeenCalled();
    expect(setBlocks).not.toHaveBeenCalled();
  });

  it('calls addToast with error when readFile throws on reload', async () => {
    const api = createMockElectronAPI();
    api.readFile.mockRejectedValue(new Error('file gone'));
    installElectronAPI(api);
    const addToast = vi.fn();
    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy' });

    const { result } = renderHook(() => useProjectIO(makeParams({ blocks: [block], addToast })));

    await act(async () => {
      await result.current.handleReloadFromDisk({ relativePath: 'game/script.rpy', absolutePath: '/project/game/script.rpy' });
    });

    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('game/script.rpy'), 'error');
  });

  it('updates open Monaco editor model content on reload', async () => {
    const api = createMockElectronAPI();
    const freshContent = 'label fresh:\n    return\n';
    api.readFile.mockResolvedValue(freshContent);
    installElectronAPI(api);

    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy' });
    const mockModel = { getValue: vi.fn(() => 'old'), setValue: vi.fn() };
    const mockEditor = { getModel: vi.fn(() => mockModel) };

    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      editorInstances: { current: new Map([['b1', mockEditor as never]]) },
    })));

    await act(async () => {
      await result.current.handleReloadFromDisk({ relativePath: 'game/script.rpy', absolutePath: '/project/game/script.rpy' });
    });

    expect(mockModel.setValue).toHaveBeenCalledWith(freshContent);
  });

  it('removes entry from externallyChangedFiles after reload', async () => {
    const api = createMockElectronAPI();
    api.readFile.mockResolvedValue('content');
    installElectronAPI(api);

    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy' });
    const setExternallyChangedFiles = vi.fn();

    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      setExternallyChangedFiles,
    })));

    await act(async () => {
      await result.current.handleReloadFromDisk({ relativePath: 'game/script.rpy', absolutePath: '/project/game/script.rpy' });
    });

    expect(setExternallyChangedFiles).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // handleRefreshProject
  // ---------------------------------------------------------------------------

  it('does nothing when projectRootPath is null', async () => {
    const setFileSystemTree = vi.fn();
    const { result } = renderHook(() =>
      useProjectIO(makeParams({ projectRootPath: null, setFileSystemTree })),
    );
    await act(async () => { await result.current.handleRefreshProject(); });
    expect(setFileSystemTree).not.toHaveBeenCalled();
  });

  it('calls addToast with error when refreshProject throws', async () => {
    const api = createMockElectronAPI();
    (api as unknown as Record<string, unknown>).refreshProject = vi.fn().mockRejectedValue(new Error('network error'));
    installElectronAPI(api);

    const addToast = vi.fn();
    const { result } = renderHook(() => useProjectIO(makeParams({ addToast })));

    await act(async () => { await result.current.handleRefreshProject(); });

    expect(addToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('updates file system tree on successful refresh', async () => {
    const api = createMockElectronAPI();
    const freshTree = { name: 'game', path: '/project/game', children: [] };
    (api as unknown as Record<string, unknown>).refreshProject = vi.fn().mockResolvedValue({
      tree: freshTree,
      files: [],
      images: [],
      audios: [],
    });
    installElectronAPI(api);

    const setFileSystemTree = vi.fn();
    const { result } = renderHook(() => useProjectIO(makeParams({ setFileSystemTree })));

    await act(async () => { await result.current.handleRefreshProject(); });

    expect(setFileSystemTree).toHaveBeenCalledWith(freshTree);
  });

  it('silently updates clean blocks with fresh content on refresh', async () => {
    const api = createMockElectronAPI();
    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy', content: 'old' });
    const freshContent = 'label updated:\n    return\n';
    (api as unknown as Record<string, unknown>).refreshProject = vi.fn().mockResolvedValue({
      tree: { name: 'game', path: '/project/game', children: [] },
      files: [{ path: 'game/script.rpy', content: freshContent }],
      images: [],
      audios: [],
    });
    installElectronAPI(api);

    const setBlocks = vi.fn();
    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      setBlocks,
    })));

    await act(async () => { await result.current.handleRefreshProject(); });

    expect(setBlocks).toHaveBeenCalled();
  });

  it('queues dirty blocks with changed disk content for conflict review', async () => {
    const api = createMockElectronAPI();
    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy', content: 'editor content' });
    api.path.join.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    (api as unknown as Record<string, unknown>).refreshProject = vi.fn().mockResolvedValue({
      tree: { name: 'game', path: '/project/game', children: [] },
      files: [{ path: 'game/script.rpy', content: 'disk content different' }],
      images: [],
      audios: [],
    });
    installElectronAPI(api);

    const setExternallyChangedFiles = vi.fn();
    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      dirtyBlockIdsRef: { current: new Set(['b1']) },
      setExternallyChangedFiles,
    })));

    await act(async () => { await result.current.handleRefreshProject(); });

    expect(setExternallyChangedFiles).toHaveBeenCalled();
  });

  it('shows "up to date" toast when no changes found during refresh', async () => {
    const api = createMockElectronAPI();
    const block = createBlock({ id: 'b1', filePath: 'game/script.rpy', content: 'unchanged' });
    (api as unknown as Record<string, unknown>).refreshProject = vi.fn().mockResolvedValue({
      tree: { name: 'game', path: '/project/game', children: [] },
      files: [{ path: 'game/script.rpy', content: 'unchanged' }],
      images: [],
      audios: [],
    });
    installElectronAPI(api);

    const addToast = vi.fn();
    const { result } = renderHook(() => useProjectIO(makeParams({
      blocks: [block],
      blocksRef: { current: [block] },
      addToast,
    })));

    await act(async () => { await result.current.handleRefreshProject(); });

    expect(addToast).toHaveBeenCalledWith('Project is up to date', 'success');
  });
});
