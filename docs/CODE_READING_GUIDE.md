# Code Reading Guide

This guide helps new contributors understand the Ren'IDE codebase before making their first meaningful contribution.

Ren'IDE is an Electron + React/TypeScript desktop application for Ren'Py projects. It loads `.rpy` files, represents them as visual blocks, analyzes Ren'Py structure, and exposes that structure through canvases, editors, diagnostics, tabs, asset tools, and native Electron integration.

## Who this guide is for

This guide is for contributors who want to:

- understand the project structure before editing code;
- trace a UI action from React components to implementation details;
- know which files to read first;
- debug renderer, main-process, IPC, state, or canvas interaction issues;
- avoid common mistakes when changing shared models, canvas behavior, analysis, diagnostics, or Electron APIs.

It is intentionally practical. The goal is not to document every file, but to give you a safe path into the codebase.

## Recommended reading order

### 1. `CLAUDE.md`

Start here for project conventions, architecture notes, commands, and contribution expectations.

This file gives the fastest overview of how the app is organized, how state flows, which conventions matter, and which commands are used during development.

### 2. `src/types.ts`

Read this next because it defines the shared domain model used across the app.

Important types to understand early:

- `Block` — a Ren'Py `.rpy` file represented as a draggable canvas item.
- `Link` — a connection between story blocks.
- `LabelNode` and `RouteLink` — label-level graph data used by flow canvases.
- `RenpyAnalysisResult` — derived analysis output used by canvases, diagnostics, navigation, and editor features.
- `DiagnosticIssue` and `DiagnosticsResult` — diagnostic data shown to users.
- `EditorTab` — the tab model for canvases, editors, diagnostics, assets, and composer views.
- `ProjectImage`, `RenpyAudio`, `ImageMetadata`, and `AudioMetadata` — asset-related models.
- `StickyNote`, `BlockGroup`, and canvas layout settings — data used by the visual canvases.

Do not treat `types.ts` as a passive type dump. It is the shared vocabulary of the project. A small type change here can ripple through hooks, canvases, diagnostics, persistence, and tests.

### 3. `src/App.tsx`

Use this as the high-level map of renderer state, hooks, tabs, canvases, editors, diagnostics, settings, and Electron calls.

`App.tsx` is large because it coordinates many pieces of the application. Do not try to memorize it in one pass. First identify:

- which state is owned directly in `App.tsx`;
- which state is delegated to hooks;
- which callbacks are passed into components;
- where `window.electronAPI` is called;
- how `useRenpyAnalysis` and `useDiagnostics` are wired;
- how tabs are opened, updated, split, and closed;
- where filesystem writes and project setting writes are triggered.

A useful first pass is to scan the section comments. They separate state groups, derived state, route analysis, project loading, file operations, tab rendering, and modal rendering.

### 4. Core hooks

Read these after `App.tsx`:

- `src/hooks/useRenpyAnalysis.ts` — parses Ren'Py files into labels, jumps, links, characters, variables, screens, and route graph data.
- `src/hooks/useHistory.ts` — manages undo/redo for `blocks[]`.
- `src/hooks/useDiagnostics.ts` — turns analysis, validation, assets, and ignored rules into diagnostics.
- `src/hooks/useTabManagement.ts` — manages open tabs, active tabs, split panes, and tab movement.
- `src/hooks/useCanvasInteraction.ts` — manages canvas transforms, selection, centering, and highlights.
- `src/hooks/useFileSystemState.ts` — manages explorer state and file-tree interactions.
- `src/hooks/useAssetManagement.ts` — manages images, audio, and metadata.
- `src/hooks/useSettingsManagement.ts` — manages app and project settings.
- `src/hooks/useCompositionState.ts` — manages scene, imagemap, and screen layout composer state.
- `src/hooks/useStickyNotes.ts` — manages sticky notes across canvases.

When reading a hook, focus on three things:

1. what state it owns;
2. what derived values it creates;
3. which callbacks it exposes back to `App.tsx`.

### 5. Canvas components

Read the canvas components only after understanding the shared types and analysis result.

Start with:

- `src/components/StoryCanvas.tsx` — block-level project canvas.
- `src/components/RouteCanvas.tsx` — label-level flow canvas.
- `src/components/ChoiceCanvas.tsx` — choice-focused label canvas.
- `src/components/CodeBlock.tsx` — visual representation of a block.
- `src/components/GroupContainer.tsx` — visual grouping on the Story Canvas.
- `src/components/StickyNote.tsx` — canvas note rendering and interaction.
- `src/lib/storyCanvasLayout.ts` — automatic story canvas layout.
- `src/lib/routeCanvasLayout.ts` — automatic route canvas layout.

Canvas code is interaction-heavy and performance-sensitive. It is much easier to understand once `Block`, `Link`, `LabelNode`, `RouteLink`, and `RenpyAnalysisResult` are clear.

### 6. `preload.js`

Read this before changing anything that calls `window.electronAPI`.

`preload.js` exposes safe renderer-to-main APIs through Electron's context bridge. It maps renderer calls to IPC channels.

For example:

- `window.electronAPI.writeFile(...)` maps to `ipcRenderer.invoke('fs:writeFile', ...)`.
- `window.electronAPI.loadProject(...)` maps to `ipcRenderer.invoke('project:load', ...)`.
- `window.electronAPI.onFileChangedExternally(...)` subscribes to main-process file watcher events.
- `window.electronAPI.runGame(...)` sends a main-process command to launch Ren'Py.

If a renderer call is undefined, check `preload.js` first.

### 7. `electron.js`

Read this after `preload.js`.

`electron.js` owns the Electron main process: filesystem access, project loading, dialogs, menus, file watching, Ren'Py execution, app settings, local media handling, logging, and IPC handlers.

When tracing an IPC feature, always check both sides:

1. the renderer call in `App.tsx` or a component;
2. the exposed bridge method in `preload.js`;
3. the matching `ipcMain.handle(...)` or `ipcMain.on(...)` handler in `electron.js`.

## Core mental model

The app can be understood as this flow:

```text
Ren'Py project files
→ Electron project loading
→ Block objects in renderer state
→ Ren'Py analysis
→ RenpyAnalysisResult
→ canvases / diagnostics / navigation / editor tabs
→ user actions
→ state updates and optional filesystem writes
```

The important distinction is between source data and derived data.

Source data includes:

- `.rpy` file contents;
- block positions, sizes, and grouping;
- project settings;
- asset metadata;
- sticky notes and composer data.

Derived data includes:

- labels;
- jumps and calls;
- route graph nodes and links;
- diagnostics;
- character and variable indexes;
- navigation targets.

When changing behavior, ask: “Am I editing source state, derived analysis, or just rendering?”

## Key files and their purposes

### Application shell

#### `src/App.tsx`

The renderer state hub.

It wires together project loading, blocks, groups, tabs, editors, canvases, diagnostics, settings, modals, asset state, sticky notes, and Electron APIs.

Common reasons to edit this file:

- adding a new top-level feature;
- wiring a new modal;
- adding a new tab type;
- changing save/load behavior;
- changing how components receive callbacks or derived data.

Be careful: `App.tsx` has many callbacks passed into memoized components. Changing callback identity or dependencies can cause unnecessary rerenders.

#### `src/main.tsx` / app entry files

These mount the React app and global providers. You usually only need them when changing app-level setup.

### Shared models

#### `src/types.ts`

The shared TypeScript model layer.

Start here when changing anything that crosses component boundaries. For example, changes to `Block`, `EditorTab`, `RenpyAnalysisResult`, or `DiagnosticsResult` usually require updates across multiple hooks and components.

### Analysis and diagnostics

#### `src/hooks/useRenpyAnalysis.ts`

Builds the Ren'Py analysis result from blocks.

This is where labels, jumps, calls, variables, characters, screens, menus, and route graph data originate. If a canvas, diagnostic, or navigation feature is missing Ren'Py structure, start here.

#### `src/hooks/useDiagnostics.ts`

Turns source data and analysis output into user-facing diagnostics.

Use this for problems such as missing labels, missing assets, invalid references, ignored rules, or task migration.

#### `src/test/renpyAnalysis.test.ts`, `src/hooks/useRenpyAnalysis.test.ts`, `src/hooks/useDiagnostics.test.ts`

Use these tests when changing parsing, graph analysis, or diagnostics. A tiny parser change can have impressively dramatic consequences. Ren'Py syntax enjoys plot twists too.

### Canvas and layout

#### `src/components/StoryCanvas.tsx`

The main visual canvas for `.rpy` blocks.

It handles block rendering, drag and resize interactions, pan and zoom, rubber-band selection, groups, sticky notes, arrows, minimap behavior, and context menu actions.

#### `src/components/RouteCanvas.tsx`

Label-level route graph canvas.

Use this when debugging graph layout, route navigation, label nodes, or jump/call relationships.

#### `src/components/ChoiceCanvas.tsx`

Choice-focused canvas.

Use this when working on menu choices, branching flow, or choice-specific navigation.

#### `src/components/CodeBlock.tsx`

The visual card for a `.rpy` block.

Use this when changing block appearance, drag handles, dirty indicators, labels shown on blocks, or editor-open behavior.

#### `src/components/GroupContainer.tsx`

Group rendering and interaction on the Story Canvas.

#### `src/components/StickyNote.tsx`

Sticky note rendering and canvas note interactions.

#### `src/lib/storyCanvasLayout.ts`

Automatic layout for Story Canvas blocks.

#### `src/lib/routeCanvasLayout.ts`

Automatic layout for Route Canvas nodes.

### Editor, tabs, and panels

#### `src/components/EditorView.tsx`

Monaco editor integration for `.rpy` content.

Use this for editing behavior, cursor tracking, save interactions, keyboard behavior, and editor-specific UI.

#### `src/hooks/useTabManagement.ts`

Tab lifecycle and split-pane behavior.

Use this when adding tab types or changing tab opening/closing behavior.

#### `src/components/DiagnosticsPanel.tsx`

Displays diagnostics and related actions.

#### `src/components/FileExplorerPanel.tsx`

Project tree, file/folder interactions, context menus, and explorer selection.

#### `src/components/SearchPanel.tsx`

Search UI. Search execution crosses into Electron through IPC.

### Electron integration

#### `preload.js`

The bridge between renderer and main process.

Renderer code must use `window.electronAPI`; it should not directly use Node or Electron APIs.

#### `electron.js`

Main process implementation.

Use this for filesystem access, project loading, file watching, dialogs, menus, local media protocol handling, app settings, logging, and Ren'Py process launching.

### Project and app settings

#### `src/hooks/useSettingsManagement.ts`

App and project settings state.

#### `.renide/project.json`

Project-specific persisted IDE state. Some app-wide settings are persisted separately in Electron user data.

### Assets and composers

#### `src/hooks/useAssetManagement.ts`

Images, audio, and metadata state.

#### `src/components/ImageEditorView.tsx`

Image metadata and preview behavior.

#### `src/components/AudioEditorView.tsx`

Audio metadata and preview behavior.

#### `src/components/SceneComposer.tsx`

Scene composition UI.

#### `src/components/ImageMapComposer.tsx`

Imagemap composition UI.

#### `src/components/ScreenLayoutComposer.tsx`

Screen layout composition UI.

#### `src/hooks/useCompositionState.ts`

Shared state for scene, imagemap, and screen layout composers.

## How to trace a feature from UI to implementation

The fastest way to understand this codebase is to trace real features end-to-end.

Do not start by reading every file. Pick one user action, then follow the data.

### Feature trace 1: creating a new scene/block

Goal: understand how the “New Scene” flow moves from UI to file creation and renderer state.

Start with the UI:

1. `src/components/CreateBlockModal.tsx`

   This modal renders the “New Scene” dialog.

   It owns local input state:

   - `name`
   - `type`
   - validation errors

   On confirm, it validates the name and calls:

   ```ts
   onConfirm(trimmedName, type)
   ```

   The modal does not write files itself. That is intentional. It stays presentational and delegates app behavior upward.

2. `src/App.tsx`

   Search for:

   ```ts
   handleCreateBlockConfirm
   ```

   This callback is the main renderer-side implementation of the new block flow.

   It is responsible for work such as:

   - determining where the file should be created;
   - creating initial `.rpy` content for story blocks;
   - calling `window.electronAPI.writeFile(...)`;
   - refreshing or updating project state;
   - adding a new `Block` to `blocks[]`;
   - marking state as dirty or saved as needed;
   - opening the editor tab for the new block when appropriate;
   - showing success or error toasts.

3. `preload.js`

   Search for:

   ```js
   writeFile
   ```

   The bridge exposes:

   ```js
   writeFile: (filePath, content, encoding) =>
     ipcRenderer.invoke('fs:writeFile', filePath, content, encoding)
   ```

   This is the renderer-to-main boundary. If the renderer call fails because `window.electronAPI.writeFile` is undefined, this is the first file to check.

4. `electron.js`

   Search for:

   ```js
   fs:writeFile
   ```

   This is the main-process handler that performs the actual filesystem write using Node APIs.

   This handler is also where main-process concerns belong, such as path handling, error handling, and suppressing self-triggered file watcher events.

5. Back to `src/App.tsx`

   After the write succeeds, the renderer must keep its in-memory state consistent with disk.

   Check how the code updates:

   - `blocks`
   - `fileSystemTree`
   - open tabs
   - dirty state
   - diagnostics/analysis inputs

   Remember that analysis is derived from blocks. A new block only appears in analysis-driven UI after the relevant block content is present in renderer state and the debounced analysis pass runs.

Typical bug locations for this feature:

- validation is wrong: check `CreateBlockModal.tsx`;
- modal opens with wrong defaults: check `useModalState.ts` and the caller in `StoryCanvas.tsx` or `App.tsx`;
- file is not written: check `window.electronAPI.writeFile`, `preload.js`, and `electron.js`;
- file exists on disk but not in UI: check `blocks`, `fileSystemTree`, project refresh, and tab opening logic in `App.tsx`;
- diagnostics/canvas do not update immediately: check debounced analysis and `useRenpyAnalysis`.

### Feature trace 2: dragging blocks on the Story Canvas

Goal: understand the canvas performance model.

Start with the canvas:

1. `src/components/StoryCanvas.tsx`

   Search for:

   ```ts
   handlePointerDown
   ```

   The Story Canvas uses pointer events to decide whether the user is:

   - panning the canvas;
   - rubber-band selecting;
   - dragging blocks;
   - dragging groups;
   - dragging sticky notes;
   - resizing blocks, groups, or notes.

   It stores the current gesture in:

   ```ts
   interactionState
   ```

   This is a ref, not normal React state, because pointer movement can be very frequent.

2. Drag start

   When a block drag begins, the canvas records:

   - selected block IDs;
   - initial block positions;
   - affected links;
   - source/target dimensions for arrows.

   This avoids recomputing graph geometry on every pointer move.

3. Pointer move

   During drag, `StoryCanvas.tsx` uses `requestAnimationFrame`.

   For block dragging, it updates DOM element positions directly through refs:

   ```ts
   blockRefs
   groupRefs
   arrowRefs
   ```

   This is deliberate. The canvas avoids pushing every pointer movement through React state, because that would cause too many renders.

   The arrows are also updated imperatively while dragging so visual connections follow the moving blocks.

4. Pointer up

   Search in `StoryCanvas.tsx` for:

   ```ts
   handlePointerUp
   ```

   At the end of the gesture, the canvas commits the final positions by calling callbacks such as:

   ```ts
   updateBlockPositions(...)
   updateGroupPositions(...)
   updateStickyNote(...)
   onInteractionEnd()
   ```

   This is where the temporary DOM movement becomes durable React state.

5. `src/App.tsx`

   Search for where `StoryCanvas` is rendered and find the prop:

   ```tsx
   updateBlockPositions={...}
   ```

   The implementation in `App.tsx` updates `blocks[]` through the app's state/history layer. That state then flows back down into `StoryCanvas`.

6. Memoization and analysis

   In `App.tsx`, note the analysis optimization:

   ```ts
   const analysisBlocks = useMemo(
     () => debouncedBlocks.map(({ id, content, filePath }) => ({ id, content, filePath })),
     [debouncedBlocks],
   );
   ```

   Position and size are intentionally excluded from analysis input.

   This matters: dragging a block should not re-run Ren'Py parsing. If you add position-like data to analysis input, canvas dragging may become slow.

Typical bug locations for this feature:

- block does not start dragging: check drag handles in `CodeBlock.tsx` and hit-testing in `StoryCanvas.tsx`;
- selection behaves oddly: check `selectedBlockIds`, `selectedGroupIds`, and `selectedNoteIds`;
- dragging is visually smooth but position resets after release: check the final `updateBlockPositions` commit path;
- dragging is slow: check accidental React state updates inside pointer move, unstable props, or unnecessary analysis dependencies;
- arrows lag or point to old positions: check `draggedLinks`, `arrowRefs`, and final render after state commit.

### Feature trace 3: opening and editing a `.rpy` file

Goal: understand editor tabs and dirty state.

1. A block or explorer item triggers an open-editor callback.
2. `App.tsx` opens or activates an `EditorTab`.
3. `EditorView.tsx` displays Monaco editor content for the selected block.
4. Editor changes update dirty editor state and eventually block content.
5. Save actions call `window.electronAPI.writeFile(...)`.
6. Updated block content feeds debounced analysis.
7. Diagnostics, canvases, and navigation update from the new `RenpyAnalysisResult`.

When debugging editor issues, always distinguish:

- content currently in Monaco;
- content stored in `blocks[]`;
- content persisted on disk;
- debounced content currently used for analysis.

Those can differ briefly, and that is normal.

### Feature trace 4: loading a project

Goal: understand how disk data becomes UI state.

1. `App.tsx` calls `window.electronAPI.loadProject(...)`.
2. `preload.js` maps that to `ipcRenderer.invoke('project:load', rootPath)`.
3. `electron.js` handles project loading.
4. The main process scans the project, reads `.rpy` files, assets, and project settings.
5. `App.tsx` receives project data and converts files into `Block` objects.
6. Hooks derive analysis, diagnostics, assets, tabs, and canvas layout state.

If a project loads but looks empty, debug in this order:

1. Did Electron return files?
2. Did `App.tsx` convert them into blocks?
3. Were blocks filtered by type or path?
4. Did analysis run?
5. Did the active tab point to the expected canvas/editor?

## Debugging guide

### Renderer process debugging

Use renderer debugging for React, UI, state, hooks, Monaco, and canvas behavior.

Useful tools:

- Chromium DevTools console;
- React DevTools;
- breakpoints in `src/App.tsx`, hooks, and components;
- temporary logging through the project logger where appropriate.

Start with these checks:

1. Is the component rendering?
2. Are the props what you expect?
3. Is the local state what you expect?
4. Is the callback being called?
5. Does state update but get overwritten by derived state or an effect?
6. Is a memoized value stale because a dependency is missing?
7. Is a callback unstable and causing excessive rerenders?

For canvas issues, log sparingly. Pointer events fire frequently. Logging every pointer move will turn your debugging session into a tiny denial-of-service attack against yourself.

Prefer logging:

- drag start;
- selected IDs;
- initial positions;
- final committed positions;
- callback invocations.

### Main process debugging

Use main-process debugging for filesystem, dialogs, menus, app lifecycle, Ren'Py execution, local media, app settings, and IPC handlers.

Start in `electron.js`.

Common checks:

1. Did the `ipcMain.handle(...)` or `ipcMain.on(...)` handler run?
2. Did it receive the arguments you expected?
3. Is the path absolute or project-relative?
4. Is the path normalized correctly across Windows/macOS/Linux?
5. Did the filesystem operation throw?
6. Is the error returned to the renderer or only logged?
7. Is a file watcher suppressing or emitting the expected event?

For filesystem bugs, log both:

- the path received from the renderer;
- the final path used for Node's filesystem call.

### IPC communication debugging

IPC bugs usually happen at one of four seams.

#### 1. Renderer call

Find the call site, usually in `App.tsx` or a component:

```ts
window.electronAPI.someMethod(...)
```

Check that the method name and argument order are correct.

#### 2. Type declaration

Check the renderer-side type declaration for `window.electronAPI`, if present.

If TypeScript accepts a call that does not exist in `preload.js`, the declaration may be lying. Type declarations are not runtime APIs. Sneaky little gremlins.

#### 3. `preload.js`

Check that the method is exposed:

```js
someMethod: (...args) => ipcRenderer.invoke('channel:name', ...args)
```

For event subscriptions, make sure the cleanup function removes the same listener that was added.

#### 4. `electron.js`

Check the matching handler:

```js
ipcMain.handle('channel:name', async (_event, ...args) => {
  // ...
})
```

The channel string must match exactly.

Also check whether the call should use:

- `ipcRenderer.invoke` + `ipcMain.handle` for request/response;
- `ipcRenderer.send` + `ipcMain.on` for fire-and-forget events;
- `webContents.send` + `ipcRenderer.on` for main-to-renderer notifications.

### State update debugging

Ren'IDE has several layers of state. The most important ones are:

- React state in `App.tsx`;
- hook-owned state;
- `useHistory` state for `blocks[]`;
- Immer state for some collections;
- refs used for performance-sensitive or imperative flows;
- derived state from `useMemo`;
- debounced state used for analysis.

When debugging state:

1. Find the source of truth.
2. Check whether the state is mutable or immutable.
3. Check whether updates go through the correct setter.
4. Check whether a ref is being used to avoid stale closures.
5. Check whether an effect later overwrites the value.
6. Check whether the UI reads raw state or a derived/memoized value.

Common source-of-truth examples:

- `blocks[]` is the source for loaded `.rpy` file content and story block layout.
- `analysisResult` is derived from block content, not manually edited.
- `diagnosticsResult` is derived from debounced blocks, analysis, assets, metadata, and ignored rules.
- `openTabs` and active tab IDs live in tab management state.
- canvas transforms and selections live in canvas interaction state.
- app/project settings live in settings management and are persisted separately.

### Analysis debugging

If a label, jump, character, variable, screen, or diagnostic is wrong, start with:

1. `blocks[]` — is the source text correct?
2. `debouncedBlocks` — has the debounce caught up?
3. `analysisBlocks` — is the right content being sent into analysis?
4. `useRenpyAnalysis.ts` — does the parser recognize the syntax?
5. `RenpyAnalysisResult` consumers — is the UI reading the correct field?

Remember that analysis intentionally ignores layout-only fields such as block position and size.

### File watcher debugging

The main process watches project files for external changes.

When debugging file watcher behavior, check:

- whether the changed file is a `.rpy` file;
- whether the path is normalized consistently;
- whether the change came from Ren'IDE itself;
- whether self-write suppression is hiding an expected event;
- whether the renderer subscription in `preload.js` is active;
- whether `App.tsx` handles the external-change notification correctly.

## Common gotchas and pitfalls

### 1. Mutating state directly

Do not mutate `blocks[]`, tabs, maps, or settings objects directly unless the code is inside an Immer draft.

Bad pattern:

```ts
block.position.x = nextX;
setBlocks(blocks);
```

Prefer creating new objects or using the established updater.

### 2. Treating derived data as source data

Do not manually edit `analysisResult` to fix UI output.

Fix the source content, parser, or transformation that creates it.

### 3. Accidentally re-running analysis on canvas movement

Analysis should depend on file identity and content, not block position or size.

Be careful when changing `analysisBlocks` in `App.tsx`. Adding layout fields can make every drag trigger parsing work.

### 4. Calling Electron or Node APIs directly from renderer code

Renderer code should go through:

```ts
window.electronAPI
```

Add or update the bridge in `preload.js`, then implement the main-process handler in `electron.js`.

### 5. Forgetting one side of IPC

IPC changes usually need at least two files, often three:

1. renderer call;
2. `preload.js`;
3. `electron.js`.

Type declarations may also need updates.

### 6. Confusing project-relative and absolute paths

The app uses both. Before changing file logic, identify which one you are holding.

Common path questions:

- Is this path relative to the project root?
- Is this path inside `game/`?
- Does this path use forward slashes?
- Does this need Windows normalization?
- Is this path safe to pass to Node's filesystem APIs?

### 7. Breaking memoization with unstable props

Canvas and editor components can be expensive. Avoid creating new arrays, objects, or inline callbacks in hot render paths unless there is a reason.

Use `useMemo` and `useCallback` when passing data into memoized or heavy components.

### 8. Logging inside pointer move loops

Pointer move handlers can fire many times per second.

Logging in those loops will distort performance and make the bug harder to understand.

### 9. Updating React state on every drag frame

`StoryCanvas.tsx` intentionally uses refs and direct DOM updates during drag, then commits final state on pointer up.

Do not “simplify” this into React state updates on every pointer move unless you are also solving the performance consequences.

### 10. Forgetting dirty state

When changing content or project settings, make sure the appropriate dirty state is updated.

Relevant state includes:

- dirty block IDs;
- dirty editors;
- unsaved settings;
- save status.

### 11. Forgetting persistence

A change can appear to work in memory but disappear after reload.

Check whether the relevant data is saved to:

- `.rpy` files;
- `.renide/project.json`;
- - app settings;
- asset metadata;
- composer state.

### 12. Assuming analysis is immediate

Analysis is debounced and may run asynchronously.

UI that depends on `analysisResult` may update slightly after content changes.

### 13. Updating `types.ts` without updating tests

Types are shared across the app. A type change often requires updates to:

- fixtures;
- tests;
- hooks;
- component props;
- persistence/migration logic.

### 14. Ignoring old projects

Project settings evolve. When adding a project setting, provide safe defaults for projects that do not have it yet.

### 15. Overloading `App.tsx`

`App.tsx` is already the orchestration hub.

For isolated state or reusable logic, prefer a hook or helper module. Use `App.tsx` to wire behavior together, not to bury every implementation detail.

## A practical first-contribution workflow

For a small bug fix:

1. Read the issue and identify the user-visible feature.
2. Find the component that renders that feature.
3. Find the callback passed into that component.
4. Trace the callback into `App.tsx` or a hook.
5. Check whether the feature crosses IPC.
6. Identify the source state and derived state.
7. Add or update a focused test where practical.
8. Run the relevant test suite and a manual smoke test.

For a new contributor, a good first target is usually one of:

- a small UI behavior in a component;
- a diagnostics rule;
- a test around Ren'Py analysis;
- a minor file explorer interaction;
- documentation.

Avoid starting with canvas drag internals, project loading, or IPC-heavy file operations unless the issue is specifically scoped. Those areas are powerful, but they have teeth.

## Quick trace checklist

When you are lost, write down this chain:

```text
UI element
→ component prop
→ callback
→ hook or App.tsx state update
→ optional IPC bridge
→ optional main-process handler
→ source state update
→ derived state update
→ render
```

Then fill in the real file and function names.

Example:

```text
New Scene button
→ CreateBlockModal onConfirm
→ handleCreateBlockConfirm
→ window.electronAPI.writeFile
→ preload.js fs:writeFile bridge
→ electron.js ipcMain handler
→ blocks[] / file tree update
→ analysis debounce
→ canvas/editor/diagnostics render
```

Example:

```text
Block drag
→ StoryCanvas handlePointerDown
→ interactionState
→ requestAnimationFrame DOM updates
→ handlePointerUp
→ updateBlockPositions
→ blocks[] state/history update
→ StoryCanvas rerender
```

That is the basic navigation map for this codebase. Once you can trace those paths, the repo stops looking like a haunted mansion and starts looking like a house with too many closets.
