# Phase 2: App.tsx Decomposition Plan

## Overview

Decompose the 5,328-line App.tsx component into manageable custom hooks to improve maintainability, testability, and code organization. This builds on Phase 1's src/ directory migration.

**Current State:**
- 170+ state pieces (useState/useImmer/useRef)
- 108 handler functions (~7,500 lines)
- 26 useEffect hooks (~600 lines)
- 80+ useMemo/useCallback memoizations
- 5,328 total lines

**Target State:**
- Extract ~5,000 lines into 14 custom hooks
- Reduce App.tsx to ~500-1,000 lines (orchestration only)
- Maintain all tests passing (481/481)
- Zero functional changes

## Strategy

### Approach: Bottom-Up Extraction
1. Start with **independent** hooks (no dependencies on other extracted hooks)
2. Move to **dependent** hooks (require other hooks as inputs)
3. Keep **orchestration** in App.tsx (component composition, props passing)

### Risk Mitigation
- Extract one hook per stage
- Full test verification after each stage
- Commit after each successful extraction
- Ability to rollback any individual extraction

---

## Extraction Stages (14 total)

### Stage 1: Toast & Notifications Hook
**Priority:** High (simple, independent)
**Lines:** ~50 lines
**File:** `src/hooks/useToasts.ts`

**Extracts:**
- State: `toasts[]`, `statusBarMessage`
- Handlers: `addToast()`, `removeToast()`

**Dependencies:** None (pure state management)

**Rationale:** Simple, self-contained, no dependencies. Good warmup.

---

### Stage 2: Modal State Hook
**Priority:** High (simple, high payoff)
**Lines:** ~200 lines
**File:** `src/hooks/useModalState.ts`

**Extracts:**
- State: All 11 modal boolean flags + modal-specific state
  - `createBlockModalOpen`, `createBlockModalType`, `createBlockModalPosition`, `createBlockModalFolderPath`
  - `deleteConfirmInfo`, `unsavedChangesModalInfo`, `contextMenuInfo`
  - `shortcutsModalOpen`, `aboutModalOpen`
  - `userSnippetModalOpen`, `editingSnippet`
  - `menuConstructorModalOpen`, `editingMenuTemplate`
  - `showTutorial`, `settingsModalOpen`, `wizardModalOpen`, `showConfigureRenpyModal`
  - `isGoToLabelOpen`, `isWarpToLabelOpen`, `isWarpVariablesOpen`
- Handlers: Modal open/close functions

**Dependencies:** None

**Rationale:** Consolidates fragmented modal state into one hook.

---

### Stage 3: Sticky Notes Hook
**Priority:** High (clean boundaries)
**Lines:** ~150 lines
**File:** `src/hooks/useStickyNotes.ts`

**Extracts:**
- State: `stickyNotes`, `routeStickyNotes`, `choiceStickyNotes`
- Handlers: 9 handlers (add/update/delete × 3 canvases)
- Memoized: `allStickyNotes`

**Dependencies:** None (pure state management)

**Rationale:** Unified interface for all 3 canvas sticky notes.

---

### Stage 4: Canvas Transform & Filters Hook
**Priority:** Medium
**Lines:** ~150 lines
**File:** `src/hooks/useCanvasTransforms.ts`

**Extracts:**
- State: `storyCanvasTransform`, `routeCanvasTransform`, `choiceCanvasTransform`, `canvasFilters`
- Handlers: Pan/zoom setters, filter toggles

**Dependencies:** None

**Rationale:** Simple transform state, no complex logic.

---

### Stage 5: Canvas Navigation & Highlighting Hook
**Priority:** Medium
**Lines:** ~300 lines
**File:** `src/hooks/useCanvasNavigation.ts`

**Extracts:**
- State: All center/highlight request flags
  - `centerOnBlockRequest`, `centerOnRouteStartRequest`, `centerOnChoiceStartRequest`
  - `centerOnRouteNodeRequest`, `centerOnChoiceNodeRequest`
  - `flashBlockRequest`
  - `findUsagesHighlightIds`, `hoverHighlightIds`
- Handlers: `handleCenterOnBlock()`, `handleGoToLabel()`, `handleWarpToLabel()`, `handleClearFindUsages()`, `handleHoverHighlightStart/End()`
- Effects: 4 auto-center effects

**Dependencies:**
- `useToasts` (for error messages)
- `useModalState` (for Go To/Warp modals)

**Rationale:** Navigation logic is cohesive and reusable.

---

### Stage 6: App Settings & Theme Hook
**Priority:** High (affects rendering)
**Lines:** ~200 lines
**File:** `src/hooks/useAppSettings.ts`

**Extracts:**
- State: `appSettingsLoaded`, `appSettings`, `isRenpyPathValid`
- Handlers: Settings save, Ren'Py path validation
- Effects: Load settings from disk, check Ren'Py path

**Dependencies:**
- `useToasts` (for error notifications)

**Rationale:** Settings are foundational for theme/font/UI preferences.

---

### Stage 7: Asset Management Hook
**Priority:** Medium (complex but independent)
**Lines:** ~400 lines
**File:** `src/hooks/useAssetManager.ts`

**Extracts:**
- State: `images`, `audios`, `imageMetadata`, `audioMetadata`, scan directories, scan timestamps, refresh flags
- Handlers: 10 handlers (save metadata, copy to project, add/remove scan dirs, refresh)
- Memoized: `existingImageTags`, `existingAudioPaths`

**Dependencies:**
- `useToasts` (for scan notifications)
- `projectRootPath` (passed as param)

**Rationale:** Asset management is self-contained domain logic.

---

### Stage 8: File Explorer & Operations Hook
**Priority:** Medium
**Lines:** ~350 lines
**File:** `src/hooks/useFileExplorer.ts`

**Extracts:**
- State: `fileSystemTree`, `explorerSelectedPaths`, `explorerLastClickedPath`, `explorerExpandedPaths`, `explorerExternalAction`
- Handlers: 8 handlers (CRUD operations, cut/copy/paste, toggle expand)
- Effects: Delete confirmation dialog

**Dependencies:**
- `useModalState` (for delete confirmation)
- `useToasts` (for operation feedback)
- `directoryHandle` (passed as param)

**Rationale:** File system operations are cohesive.

---

### Stage 9: Tab & Pane Management Hook
**Priority:** High (largest extraction)
**Lines:** ~1,000 lines
**File:** `src/hooks/useTabManager.ts`

**Extracts:**
- State: 9 tab/pane state pieces (openTabs, activeTabId, split layout, drag state)
- Handlers: 13 handlers (close, split, move, drag)
- Refs: `primaryMountedTabsRef`, `secondaryMountedTabsRef`, tab bar refs

**Dependencies:**
- `useModalState` (for unsaved changes confirmation)
- `dirtyBlockIds`, `dirtyEditors` (passed as params)

**Rationale:** Tab management is the largest coherent domain.

---

### Stage 10: Composer Management Hook
**Priority:** Medium
**Lines:** ~450 lines
**File:** `src/hooks/useComposerManager.ts`

**Extracts:**
- State: `sceneCompositions`, `sceneNames`, `imagemapCompositions`, `screenLayoutCompositions`
- Handlers: 18 handlers (6 per composer type)
- Memoized: `scenesArray`, `imagemapsArray`, `screenLayoutsArray`

**Dependencies:**
- `useToasts` (for save feedback)
- `useTabManager` (to open composer tabs)

**Rationale:** Composer state is well-grouped.

---

### Stage 11: Block Operations Hook
**Priority:** Medium
**Lines:** ~600 lines
**File:** `src/hooks/useBlockOperations.ts`

**Extracts:**
- State: `dirtyBlockIds`, `dirtyEditors`, `hasUnsavedSettings`, `saveStatus`
- Handlers: 8 handlers (CRUD, save, save all)
- Refs: `blocksForLayoutRef`, dirty refs

**Dependencies:**
- `useToasts` (for save feedback)
- `blocks`, `setBlocks` (from useHistory - passed as params)

**Rationale:** Block operations are core editing logic.

---

### Stage 12: Character & Variables Hook
**Priority:** Low
**Lines:** ~250 lines
**File:** `src/hooks/useCharactersAndVariables.ts`

**Extracts:**
- State: `characterProfiles`
- Handlers: 6 handlers (character editor, variables, find usages)
- Derived: `characterTagsArray`, `analysisResultWithProfiles`
- Refs: `pendingTagRenameRef`
- Effects: Deferred character tab rename

**Dependencies:**
- `useTabManager` (to open character editor)
- `useCanvasNavigation` (for find usages)
- `analysisResult` (passed as param)

**Rationale:** Character/variable management is specialized domain.

---

### Stage 13: Drafting Mode & Warp Hook
**Priority:** Low (complex, many dependencies)
**Lines:** ~500 lines
**File:** `src/hooks/useDraftingMode.ts`

**Extracts:**
- State: 7 warp-related state pieces
- Handlers: 5 handlers (game execution, warp setup, drafting toggle)
- Effects: Game state listener, drafting cleanup
- Refs: `warpTempFilePathRef`

**Dependencies:**
- `useToasts` (for error messages)
- `useModalState` (for warp modals)
- `projectSettings` (passed as param)
- `blocks`, `images`, `audios` (for temp file generation)

**Rationale:** Drafting mode is complex but self-contained feature.

---

### Stage 14: Project Lifecycle Hook
**Priority:** Low (most complex, many dependencies)
**Lines:** ~800 lines
**File:** `src/hooks/useProjectLifecycle.ts`

**Extracts:**
- State: `projectRootPath`, `isLoading`, loading progress, external file warnings
- Handlers: 8 handlers (load, refresh, open, file conflicts)
- Effects: 4 effects (load on startup, file watcher, conflict handling)
- Refs: `loadCancelRef`, `analysisWorkerHasStartedRef`

**Dependencies:**
- `useToasts` (for load feedback)
- `useModalState` (for confirmation dialogs)
- `useFileExplorer` (to update file tree)
- `useAssetManager` (to scan assets)
- `useBlockOperations` (to add blocks)
- `useAppSettings` (for Ren'Py path)

**Rationale:** Project lifecycle orchestrates many hooks - extract last.

---

## After Extraction: App.tsx Structure

```typescript
// src/App.tsx (~500-1,000 lines)

const App: React.FC = () => {
  // Core state (undo/redo)
  const { state: blocks, setState: setBlocks, undo, redo, canUndo, canRedo } = useHistory<Block[]>([]);
  const [groups, setGroups] = useImmer<BlockGroup[]>([]);

  // Extracted hooks (14 custom hooks)
  const { toasts, statusBarMessage, addToast, removeToast } = useToasts();

  const {
    createBlockModalOpen,
    settingsModalOpen,
    // ... all modal state
    openCreateBlockModal,
    closeSettingsModal,
    // ... all modal handlers
  } = useModalState();

  const {
    stickyNotes,
    routeStickyNotes,
    choiceStickyNotes,
    allStickyNotes,
    addStickyNote,
    updateStickyNote,
    deleteStickyNote,
    // ... + route/choice variants
  } = useStickyNotes();

  const {
    storyCanvasTransform,
    routeCanvasTransform,
    choiceCanvasTransform,
    canvasFilters,
    setStoryCanvasTransform,
    // ... setters
  } = useCanvasTransforms();

  const {
    centerOnBlockRequest,
    flashBlockRequest,
    findUsagesHighlightIds,
    hoverHighlightIds,
    handleCenterOnBlock,
    handleGoToLabel,
    handleWarpToLabel,
    handleClearFindUsages,
    handleHoverHighlightStart,
    handleHoverHighlightEnd,
  } = useCanvasNavigation({ addToast, openGoToLabelModal, openWarpModal });

  const {
    appSettings,
    isRenpyPathValid,
    saveAppSettings,
  } = useAppSettings({ addToast });

  const {
    images,
    audios,
    imageMetadata,
    audioMetadata,
    handleSaveImageMetadata,
    handleCopyImageToProject,
    // ... 10+ handlers
  } = useAssetManager({ projectRootPath, addToast });

  const {
    fileSystemTree,
    explorerSelectedPaths,
    handleCreateNode,
    handleDeleteNode,
    // ... 8+ handlers
  } = useFileExplorer({ directoryHandle, addToast, openDeleteConfirmModal });

  const {
    openTabs,
    activeTabId,
    splitLayout,
    handleCloseTab,
    handleCreateSplit,
    // ... 13+ handlers
  } = useTabManager({ dirtyBlockIds, dirtyEditors, openUnsavedChangesModal });

  const {
    sceneCompositions,
    imagemapCompositions,
    screenLayoutCompositions,
    handleCreateScene,
    handleOpenScene,
    // ... 18+ handlers
  } = useComposerManager({ addToast, handleOpenStaticTab: tabManager.handleOpenStaticTab });

  const {
    dirtyBlockIds,
    dirtyEditors,
    saveStatus,
    addBlock,
    updateBlock,
    deleteBlock,
    handleSaveBlock,
    handleSaveAll,
  } = useBlockOperations({ blocks, setBlocks, addToast });

  const {
    characterProfiles,
    handleOpenCharacterEditor,
    handleUpdateCharacter,
    handleAddVariable,
    handleFindUsages,
  } = useCharactersAndVariables({ analysisResult, addToast, tabManager, canvasNavigation });

  const {
    isWarpToLabelOpen,
    pendingWarpTarget,
    handleRunGame,
    handleConfirmWarpVariables,
    handleToggleDraftingMode,
  } = useDraftingMode({ projectSettings, blocks, images, audios, addToast, openWarpVariablesModal });

  const {
    projectRootPath,
    isLoading,
    loadingProgress,
    externallyChangedFiles,
    loadProject,
    handleOpenProjectFolder,
    handleRefreshProject,
  } = useProjectLifecycle({
    addToast,
    modalState,
    fileExplorer,
    assetManager,
    blockOps,
    appSettings,
  });

  // Analysis (stays in App.tsx - needs access to blocks)
  const debouncedBlocks = useDebounce(analysisBlocks, 500);
  const { analysisResult, diagnosticsResult } = useRenpyAnalysis(debouncedBlocks);
  const { diagnosticsWithIgnores } = useDiagnostics(diagnosticsResult, ignoredDiagnostics);

  // Performance monitoring
  const { perfSnapshot } = usePerformanceMetrics();

  // Memoized derived state (minimal, most moved to hooks)
  const analysisLabelKeys = useMemo(() => new Set(Object.keys(analysisResult.labels)), [analysisResult.labels]);

  // Rendering (stays here - JSX composition)
  return (
    <div className="app">
      <Toolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        saveStatus={saveStatus}
        onSaveAll={handleSaveAll}
        onSettings={modalState.openSettingsModal}
        onRunGame={draftingMode.handleRunGame}
        {...otherToolbarProps}
      />

      <div className="main-content">
        <LeftSidebar
          activePanel={activeLeftPanel}
          fileSystemTree={fileExplorer.fileSystemTree}
          onCreateNode={fileExplorer.handleCreateNode}
          {...fileExplorerProps}
        />

        <PrimaryPane
          openTabs={tabManager.openTabs}
          activeTabId={tabManager.activeTabId}
          onCloseTab={tabManager.handleCloseTab}
          renderTabContent={renderTabContent} // stays here
        />

        {splitLayout !== 'none' && (
          <SecondaryPane {...secondaryPaneProps} />
        )}

        <RightSidebar
          images={assetManager.images}
          characters={charactersAndVars.characterProfiles}
          scenes={composerManager.sceneCompositions}
          {...storyElementsProps}
        />
      </div>

      <StatusBar message={toasts.statusBarMessage} />

      {/* Modals */}
      {createPortal(
        <>
          {modalState.createBlockModalOpen && (
            <CreateBlockModal {...createBlockModalProps} />
          )}
          {modalState.settingsModalOpen && (
            <SettingsModal {...settingsModalProps} />
          )}
          {/* ... other modals */}
        </>,
        document.body
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.toasts.map(toast => (
          <Toast key={toast.id} {...toast} onDismiss={toasts.removeToast} />
        ))}
      </div>
    </div>
  );
};
```

---

## Implementation Guidelines

### Hook Design Principles
1. **Single Responsibility**: Each hook manages one domain
2. **Explicit Dependencies**: Pass dependencies as parameters, not global access
3. **Return Interface**: Return state + handlers as named object
4. **Internal Implementation**: Use useState/useImmer/useRef internally
5. **Memoization**: Use useCallback for handlers, useMemo for derived state

### Hook Signature Template
```typescript
export function useHookName({
  // Dependencies (other hooks, props, callbacks)
  addToast,
  openModal,
  // Data dependencies
  projectRootPath,
  analysisResult,
}: UseHookNameParams): UseHookNameReturn {
  // Internal state
  const [internalState, setInternalState] = useState(...);

  // Handlers (useCallback)
  const handleAction = useCallback(() => {
    // Logic
  }, [deps]);

  // Effects
  useEffect(() => {
    // Side effects
  }, [deps]);

  // Return public interface
  return {
    // State
    internalState,
    // Handlers
    handleAction,
    // Derived state
    derivedValue: useMemo(() => ..., [deps]),
  };
}
```

### Testing Strategy
1. **Unit Tests**: Each hook gets its own test file `src/hooks/useHookName.test.ts`
2. **Integration Tests**: Verify hook interactions in App.tsx
3. **Regression Tests**: All existing 481 tests must pass after each stage
4. **Coverage**: Maintain or improve coverage baseline

### Migration Checklist (Per Stage)
- [ ] Create hook file in `src/hooks/useHookName.ts`
- [ ] Extract state declarations
- [ ] Extract handler functions (wrap in useCallback)
- [ ] Extract effects
- [ ] Extract memoized values
- [ ] Add TypeScript interfaces (Params, Return)
- [ ] Update App.tsx to use hook
- [ ] Run tests: `npm test`
- [ ] Run lint: `npm run lint`
- [ ] Build check: `npm run build`
- [ ] Manual smoke test: `npm run electron:start`
- [ ] Git commit with clear message
- [ ] Push to branch

---

## Success Criteria

### Quantitative
- ✅ App.tsx reduced from 5,328 lines to <1,000 lines
- ✅ 14 custom hooks created in `src/hooks/`
- ✅ All 481 tests passing
- ✅ Test coverage maintained (±1%)
- ✅ Build time unchanged
- ✅ Zero functional changes

### Qualitative
- ✅ Each hook has single, clear responsibility
- ✅ State management logic is testable in isolation
- ✅ App.tsx is readable and maintainable
- ✅ Easier to reason about state flow
- ✅ Reduced cognitive load for developers
- ✅ Better encapsulation of domain logic

---

## Timeline Estimate

| Stage | Hook | Complexity | Estimated Time |
|-------|------|-----------|---------------|
| 1 | useToasts | Simple | 1 hour |
| 2 | useModalState | Simple | 2 hours |
| 3 | useStickyNotes | Simple | 2 hours |
| 4 | useCanvasTransforms | Simple | 1.5 hours |
| 5 | useCanvasNavigation | Medium | 3 hours |
| 6 | useAppSettings | Medium | 2.5 hours |
| 7 | useAssetManager | Medium | 4 hours |
| 8 | useFileExplorer | Medium | 3.5 hours |
| 9 | useTabManager | Complex | 5 hours |
| 10 | useComposerManager | Medium | 4 hours |
| 11 | useBlockOperations | Complex | 4.5 hours |
| 12 | useCharactersAndVariables | Medium | 3 hours |
| 13 | useDraftingMode | Complex | 4.5 hours |
| 14 | useProjectLifecycle | Very Complex | 6 hours |
| **Testing & Docs** | | | 3 hours |
| **Total** | | | **50 hours** |

**Recommended pace:** 2-3 stages per day over 10-12 days.

---

## Risks & Mitigation

### Risk 1: Breaking Tests
**Mitigation:** Run full test suite after each stage. Commit granularly for easy rollback.

### Risk 2: Circular Dependencies
**Mitigation:** Extract in bottom-up order (independent → dependent). Pass dependencies as params, not imports.

### Risk 3: Performance Regression
**Mitigation:** Maintain memoization (useCallback/useMemo). Benchmark before/after with `usePerformanceMetrics`.

### Risk 4: State Synchronization Issues
**Mitigation:** Keep state ownership clear. One hook owns state, others receive via params or callbacks.

### Risk 5: Type Complexity
**Mitigation:** Define clear TypeScript interfaces for hook params/returns. Use generics sparingly.

---

## Next Steps After Phase 2

Once App.tsx decomposition is complete:

1. **Phase 3 (Future)**: Extract StoryCanvas, RouteCanvas, ChoiceCanvas into smaller components
2. **Phase 4 (Future)**: Create compound components (TabBar, Pane, Sidebar)
3. **Phase 5 (Future)**: Consider state management library (Zustand/Jotai) if hooks become too complex

Phase 2 establishes the foundation for all future refactoring by reducing App.tsx to a manageable orchestration layer.

---

**Ready to start Stage 1: Toast & Notifications Hook!**
