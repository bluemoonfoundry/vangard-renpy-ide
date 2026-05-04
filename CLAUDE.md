# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Vangard Ren'Py IDE (Ren'IDE) is an Electron + React/TypeScript desktop application for visual novel development. It maps `.rpy` files to draggable blocks on a canvas, provides integrated Monaco editors, and includes visual composers for scenes, image maps, and screens. Current version: **0.8.2**.

## Project Structure

```
src/
├── App.tsx                 # Main application component — state hub (~5k lines)
├── index.tsx               # React entry point
├── types.ts                # TypeScript type definitions (single source of truth)
├── components/             # React UI components
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions and algorithms
├── contexts/               # React context providers (SearchContext)
├── test/                   # Test setup, mocks, and test files
└── workers/                # Web Workers (renpyAnalysis.worker.ts)
```

**Import Convention:** Use the `@/` path alias for all imports (never relative `../`):
```typescript
import type { Block } from '@/types';
import { useHistory } from '@/hooks/useHistory';
```

Root-level: `electron.js` (main process), `preload.js` (IPC bridge), `vite.config.ts`, `tsconfig.json`.

## Commands
```bash
npm run dev                # Vite dev server (http://localhost:5173)
npm run electron:start     # Build + launch full Electron app
npm run build              # Production build to dist/
npm test                   # Vitest once
npm run test:watch         # Vitest watch mode
npm run lint:fix           # ESLint auto-fix
```

## Architecture & State

### State Hub (`App.tsx`)
All core state lives in `App.tsx` using `useImmer` or `useState`.

| State | Hook | Persisted To |
|-------|------|-------------|
| `blocks[]` | `useHistory` (undo/redo) | Individual `.rpy` files + `game/project.ide.json` (positions) |
| `groups[]`, `stickyNotes[]`, `routeStickyNotes[]`, `choiceStickyNotes[]` | `useImmer` | `game/project.ide.json` |
| `projectImages`, `projectAudios` | `useState` (Maps) | `game/project.ide.json` (metadata only) |
| `sceneCompositions`, `imagemapCompositions`, `screenLayoutCompositions` | `useImmer` | `game/project.ide.json` |
| `diagnosticsTasks`, `ignoredDiagnostics`, `characterProfiles` | `useImmer` | `game/project.ide.json` |
| `analysisResult`, `diagnosticsResult` | derived/computed | Never — recalculated on change |
| `openTabs[]`, `activeTabId`, `selectedBlockIds[]` | `useState` | Never — session-only |

App-level settings persist to `userData/app-settings.json`. API keys use Electron's `safeStorage` via `app:load-api-keys` / `app:save-api-key` IPC.

`debouncedBlocks` (500ms) feeds `useRenpyAnalysis` with only `{ id, content, filePath }` — drag/position changes never trigger re-analysis.

### IPC Pattern
All cross-process calls use `namespace:action` strings. Namespaces: `fs`, `project`, `dialog`, `game`, `renpy`, `app`, `path`, `shell`, `explorer`.
```typescript
await window.electronAPI.fs.readFile(path);           // renderer
ipcMain.handle('fs:readFile', async (_, p) => ...);   // main
```

### Three Canvases
All canvases use native pointer events (`pointerdown`/`pointermove`/`pointerup`) with global listeners — no React synthetic events during drag.

| | ProjectCanvas | FlowCanvas | ChoicesCanvas |
|--|-------------|-------------|--------------|
| **Component** | `StoryCanvas.tsx` | `RouteCanvas.tsx` | `ChoiceCanvas.tsx` |
| **Granularity** | Block-level (`.rpy` files) | Label-level | Label-level |
| **Nodes** | `blocks[]` | `labelNodes[]` | `labelNodes[]` |
| **Edges** | `analysisResult.links[]` | `routeLinks[]` | `routeLinks[]` + choice pills |

> Internal files/variables use Story/Route/Choice; display names are Project/Flow/Choices (changed v0.7.1).

`RenpyAnalysisResult` is the central data structure — carries `labelNodes[]`, `routeLinks[]`, and `identifiedRoutes[]` for Flow/Choices Canvas rendering.

## Conventions
- **Imports**: `@/` alias always. No `../` except local siblings.
- **State mutation**: `useImmer` drafts only — never mutate state directly.
- **IPC**: `namespace:action` pattern in both `preload.js` and `electron.js`.
- **Modals**: `createPortal()` to `document.body` + `useModalAccessibility` hook (focus trap, ESC, ARIA).
- **Styling**: Tailwind CSS + dark mode via `class` strategy.
- **Canvas block components** (`CodeBlock`, `LabelBlock`, `GroupContainer`): `forwardRef` + `React.memo`. `.drag-handle` class initiates drag; `button`/`input` children do not propagate.
- **Sticky notes**: Three arrays (`stickyNotes`, `routeStickyNotes`, `choiceStickyNotes`), one per canvas. Markdown via `marked`. Promotable to `DiagnosticsTask`.
- **Color swatches**: Use `ColorDropTarget` for drag-and-drop color input.
- **Clipboard UI**: Use `@/components/CopyButton`.
- **Data models**: `src/types.ts` is the single source of truth.

## Testing
Vitest + JSDOM. `src/test/mocks/electronAPI.ts` exports `createMockElectronAPI()`, `installElectronAPI()`, `uninstallElectronAPI()`. `src/test/mocks/sampleData.ts` has factory functions (`createBlock()`, `createSampleAnalysisResult()`, etc.). Test files match `**/*.test.{ts,tsx}`.
