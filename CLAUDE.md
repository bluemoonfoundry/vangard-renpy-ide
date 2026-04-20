# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Vangard Ren'Py IDE is an Electron + React/TypeScript desktop application for visual novel development. It maps `.rpy` files to draggable blocks on a canvas, provides integrated Monaco editors, and includes visual composers for scenes, image maps, and screens.

## Commands
```bash
npm run dev                        # Vite dev server (http://localhost:5173)
npm run electron:start             # Build + launch full Electron app
npm run build                      # Production build to dist/
npm run dist                       # Package to release/ (DMG/NSIS/AppImage)
npm test                           # Vitest once
npm run test:watch                 # Vitest watch mode
npx vitest run hooks/useHistory.test.ts  # Run a single test file
npm run test:coverage              # Coverage report (v8)
npm run lint:fix                   # ESLint auto-fix
```

## Architecture & State

### State Hub (`App.tsx`)
All core state lives in `App.tsx` using `useImmer`. Key state categories:

| State | Hook | Persisted To |
|-------|------|-------------|
| `blocks[]` | `useHistory` (undo/redo) | Individual `.rpy` files + `.renide/project.json` (positions) |
| `groups[]`, `stickyNotes[]` | `useImmer` | `.renide/project.json` |
| `imageMetadata`, `audioMetadata` | `useState` | `.renide/ide-settings.json` |
| `sceneCompositions`, `screenLayoutCompositions` | `useImmer` | `.renide/ide-settings.json` |
| `analysisResult`, `diagnosticsResult` | derived/computed | Never — recalculated on change |
| `openTabs[]`, `activeTabId`, `selectedBlockIds[]` | `useState` | Never — session-only |

App-level settings (theme, font, layout prefs) persist to `userData/app-settings.json`. API keys are stored via Electron's `safeStorage` (encrypted OS keychain), accessed through `app:load-api-keys` / `app:save-api-key` IPC handlers.

**Undo/redo** (`useHistory`) only covers `blocks[]`. It does not affect editor text (Monaco handles that), canvas transforms, or project settings. It also prevents undoing past the initial state (`canUndo` only if `past.length > 1`).

### Block Lifecycle
1. User opens `CreateBlockModal` → inputs name, type (`story|screen|config`), folder
2. `handleCreateBlockConfirm()` writes file to disk via IPC, pushes a new `Block` to state, opens an editor tab
3. `debouncedBlocks` (500ms debounce) feeds `useRenpyAnalysis` — **only passes `{ id, content, filePath }`**, not position/width/color, so drag events never trigger re-analysis
4. Analysis extracts the first label name → sets `block.title`; color is deterministically derived from title via string hash
5. Block position/size persist to `.renide/project.json` every ~2 seconds

### IPC Pattern
All cross-process calls use `namespace:action` strings:
```typescript
// Renderer
await window.electronAPI.fs.readFile(path);
// Main (electron.js)
ipcMain.handle('fs:readFile', async (event, path) => fs.readFile(path, 'utf-8'));
```
Namespaces: `fs`, `project`, `dialog`, `game`, `renpy`, `app`, `path`, `shell`, `explorer`. Async push events from main (file watcher, game lifecycle) arrive via `ipcRenderer.on` and are exposed as `electronAPI.on*` callbacks: `onLoadProgress`, `onFileChangedExternally`, `onGameStarted`, `onGameStopped`, `onGameError`, `onMenuCommand`, `onCheckUnsavedChangesBeforeExit`, `onShowExitModal`, `onSaveIdeStateBeforeQuit`.

### External File Watcher
Main process watches the project folder for `.rpy` changes. If the block is clean in the editor, it auto-reloads silently. If dirty, it shows a persistent warning bar ("Reload" / "Keep"). Main suppresses change events for 3 seconds after the app writes a file to avoid false positives.

### Tab System
`openTabs: EditorTab[]` tracks open panels. Tabs mount lazily on first activation, then stay mounted-but-hidden to preserve Monaco scroll/state. Valid tab types: `canvas`, `route-canvas`, `choice-canvas`, `editor`, `image`, `audio`, `character`, `scene-composer`, `stats`, `diagnostics`, `punchlist`.

### Context Providers
All four wrap the entire app in `App.tsx`:
- **`AssetContext`** — `projectImages: Map<path, ProjectImage>`, `projectAudios`, `imageMetadata`, `audioMetadata`. Tags and Ren'Py names (`renpyName`) are stored in metadata separately from file paths.
- **`FileSystemContext`** — file tree CRUD, clipboard state, drag-drop; delegates FS ops to Electron via IPC.
- **`SearchContext`** — offloads search state from App to avoid prop drilling; delegates to `electronAPI.searchInProject` for ripgrep-backed search.
- **`ToastContext`** — `addToast(message, type)` renders a portal at bottom-right.

### Memoization Discipline
`App.tsx` aggressively memoizes derived arrays/sets to prevent canvas re-renders on unrelated state changes:
```typescript
const imagesArray = useMemo(() => Array.from(images.values()), [images]);
const menuLabels  = useMemo(() => new Set(Object.keys(analysisResult.labels)), [analysisResult.labels]);
```
Without this, every tab switch recalculates arrays and re-renders the full canvas.

### Three Canvases
All three canvases share the same pointer-event drag model: global `pointermove`/`pointerup` listeners are attached on `pointerdown` and removed on release — no React synthetic events during drag for performance. Drag state is tracked in a local state machine (`dragging-blocks`, `dragging-groups`, `dragging-notes`), initial positions stored in a Map, deltas applied live.

| | StoryCanvas | RouteCanvas | ChoiceCanvas |
|--|-------------|-------------|--------------|
| **Granularity** | Block-level (`.rpy` files) | Label-level | Label-level |
| **Nodes** | `blocks[]` | `labelNodes[]` | `labelNodes[]` |
| **Edges** | `analysisResult.links[]` | `routeLinks[]` | `routeLinks[]` + choice pills |
| **Layout** | `storyCanvasLayout.ts` (4 algorithms) | `routeCanvasLayout.ts` | `routeCanvasLayout.ts` |
| **Visual uniqueness** | Hash-derived block colors, block-type icons, groups | Hub/branch/menu-heavy badges | Choice pills (6-color rotation), dialogue snippets |

`RenpyAnalysisResult` is the central data structure connecting analysis to all three canvases. Beyond labels/jumps/characters/screens, it carries `labelNodes[]`, `routeLinks[]`, and `identifiedRoutes[]` specifically for Route/Choice Canvas rendering.

### Key Hooks
| Hook | Purpose |
|------|---------|
| `useHistory` | Undo/redo stack for `blocks[]` only |
| `useRenpyAnalysis` | Heavy parser — populates `RenpyAnalysisResult` including all canvas data; takes only `{ id, content, filePath }` to avoid drag-triggered re-runs |
| `useDiagnostics` | Computes errors/warnings/info; supports rule suppression via `ignoredDiagnostics` |
| `useFileSystemManager` | File tree CRUD, clipboard (copy/cut), drag-drop routing |
| `useAssetManager` | Scans/syncs image+audio directories; manages Ren'Py names and tags |
| `usePerformanceMetrics` | Per-frame render/layout timing; records FPS spikes |
| `useVirtualList` | Lazy-renders long lists (file explorer) |
| `useSnippetLoader` | Loads user snippets from `.renide/snippets.json` |
| `useDebounce` | Generic 500ms debounce (blocks feed into analysis via this) |

### Monaco & Syntax Highlighting
Monaco uses two layers of Ren'Py language support:
1. **TextMate tokenization** — `textmateGrammar.ts` loads Oniguruma WASM and parses `renpy.tmLanguage.json` (custom grammar), bridged to Monaco via `createTextMateTokensProvider()`. Lazily initialized on first editor mount.
2. **Semantic token overlays** — `renpySemanticTokens.ts` defines 9 token types (labels, characters, images, screens, variables — each in known/unknown variants) and colors them based on live `RenpyAnalysisResult` data.

The app supports 11 themes (`system`, `light`, `dark`, `solarized-light`, `solarized-dark`, `colorful`, `colorful-light`, `neon-dark`, `ocean-dark`, `candy-light`, `forest-light`) defined as the `Theme` type in `types.ts`. Monaco receives `editorTheme` prop and maps to its own dark/light mode setting.

### Key `lib/` Modules
| Module | Purpose |
|--------|---------|
| `storyCanvasLayout.ts` | Auto-layout algorithms (flow-lr, flow-td, connected-components, clustered-flow) |
| `routeCanvasLayout.ts` | Label-node positioning for Route Canvas |
| `graphLayout.ts` | Generic DAG layout + route enumeration for menus/routes |
| `renpyValidator.ts` | Syntax validation (triple quotes, logical lines, label guards) |
| `renpyCompletionProvider.ts` | Monaco autocomplete: labels, characters, screens, variables |
| `renpySemanticTokens.ts` | Syntax highlighting via Monaco semantic tokens |
| `screenCodeGenerator.ts` | Converts Screen Layout Composer tree → Ren'Py screen code |

## Conventions
- **State mutation**: Always use `useImmer` drafts; never mutate state directly.
- **IPC**: Use `namespace:action` pattern in both `preload.js` and `electron.js`.
- **Modals**: Use `createPortal()` to `document.body` + the `useModalAccessibility` hook (focus trap, ESC, ARIA).
- **Styling**: Tailwind CSS + dark mode via `class` strategy.
- **Clipboard UI**: Use `components/CopyButton.tsx`.
- **Sticky notes**: Three separate arrays (`stickyNotes`, `routeStickyNotes`, `choiceStickyNotes`), one per canvas. Content renders as Markdown via `marked`. Notes can be promoted to `DiagnosticsTask` via checkbox.
- **Tests**: Vitest + JSDOM. Setup in `test/setup.ts`. Test files match `**/*.test.{ts,tsx}`.
- **Data models**: `types.ts` is the single source of truth for all interfaces (Block, Link, Diagnostic, Composition, etc.).
- **Canvas drag**: Use native pointer events (`pointerdown`/`pointermove`/`pointerup`) with global listeners — do not use React synthetic events for drag performance.
- **Components**: Canvas block components (`CodeBlock`, `LabelBlock`, `GroupContainer`) use `forwardRef` + `React.memo`. Elements with class `.drag-handle` initiate canvas drag; `button`/`input` children do not propagate drag.

## Testing
`test/mocks/electronAPI.ts` exports `createMockElectronAPI()` (fully-stubbed API with Promise defaults) and `installElectronAPI()` / `uninstallElectronAPI()` for test setup/teardown. `test/mocks/sampleData.ts` exports factory functions (`createBlock()`, `createBlockGroup()`, `createSampleAnalysisResult()`, `createAppSettings()`, etc.) used across unit and integration tests.
