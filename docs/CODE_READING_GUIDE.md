# Code Reading Guide

This guide helps new contributors understand the Ren'IDE codebase before making their first contribution.

Ren'IDE is an Electron + React/TypeScript desktop application for Ren'Py projects. It loads `.rpy` files, represents them as visual blocks, analyzes Ren'Py structure, and exposes that structure through canvases, editors, diagnostics, tabs, and native Electron integration.

## Who this guide is for

This guide is for contributors who want to:

- understand the project structure before editing code;
- trace a UI action from React components to implementation details;
- know which files to read first;
- debug renderer, main-process, IPC, or state-related issues;
- avoid common mistakes when changing shared models, canvas behavior, analysis, or Electron APIs.

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

Do not treat `types.ts` as a passive type dump. It is the shared vocabulary of the project.

### 3. `src/App.tsx`

Use this as the high-level map of renderer state, hooks, tabs, canvases, editors, diagnostics, settings, and Electron calls.

`App.tsx` is large because it coordinates many pieces of the application. Do not try to memorize it in one pass. First identify:

- which state is owned directly in `App.tsx`;
- which state is delegated to hooks;
- which callbacks are passed into components;
- where `window.electronAPI` is called;
- how `useRenpyAnalysis` and `useDiagnostics` are wired.

### 4. Core hooks

Read these after `App.tsx`:

- `src/hooks/useRenpyAnalysis.ts` — parses Ren'Py files into labels, jumps, links, characters, variables, screens, and route graph data.
- `src/hooks/useHistory.ts` — manages undo/redo for `blocks[]`.
- `src/hooks/useDiagnostics.ts` — turns analysis, validation, assets, and ignored rules into diagnostics.
- `src/hooks/useTabManagement.ts` — manages open tabs and active tabs.
- `src/hooks/useCanvasInteraction.ts` — manages canvas transforms, selection, centering, and highlights.
- `src/hooks/useFileSystemState.ts` — manages explorer state and file-tree interactions.
- `src/hooks/useAssetManagement.ts` — manages images, audio, and metadata.
- `src/hooks/useSettingsManagement.ts` — manages app and project settings.

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

Canvas code is interaction-heavy and performance-sensitive. It is easier to understand once `Block`, `Link`, `LabelNode`, `RouteLink`, and `RenpyAnalysisResult` are clear.

### 6. `preload.js`

Read this before changing anything that calls `window.electronAPI`.

`preload.js` exposes safe renderer-to-main APIs through Electron's context bridge. It maps renderer calls to IPC channels.

### 7. `electron.js`

Read this after `preload.js`.

`electron.js` owns the Electron main process: filesystem access, project loading, dialogs, menus, file watching, Ren'Py execution, app settings, local media handling, and IPC handlers.

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
