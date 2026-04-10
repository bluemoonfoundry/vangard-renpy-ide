# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vangard Ren'Py IDE (v0.7.0 - Public Beta 4) is a desktop application (Electron + React/TypeScript) for visual novel development with Ren'Py. It represents `.rpy` files as draggable blocks on a canvas, auto-draws `jump`/`call` connection arrows, and provides an integrated Monaco code editor alongside asset and story management tools.

**Key technologies**: Electron 41.2, React 18.2, TypeScript 5.6, Monaco Editor 0.45, Vite 8.0, Tailwind CSS 3.4, Vitest 4.0, use-immer for state.

## Project Structure

**IMPORTANT**: This project uses a **flat directory structure** with NO `src/` folder. All source files are at the project root level:

```
bmf-vangard-renpy-ide/
├── App.tsx (4,174 lines)         # Central state hub
├── types.ts (1,160 lines)        # Type definitions (91+ types)
├── electron.js (1,136 lines)     # Main process
├── preload.js (115 lines)        # IPC bridge
├── index.tsx                      # React entry point
├── index.html                     # HTML shell
├── index.css                      # Global styles + Markdown CSS
├── components/ (65 files)         # All React components
├── contexts/ (4 files)            # Context providers
├── hooks/ (14 files)              # Custom React hooks
├── lib/ (23 files)                # Utilities and pure functions
├── workers/ (1 file)              # Web worker for analysis
├── test/ (21 test files)          # Test infrastructure + specs
├── public/                        # Static assets (onig.wasm)
├── resources/                     # Bundled Ren'Py template
└── DemoProject/                   # Example project
```

Path alias: `@/*` maps to project root in tsconfig.

## Build & Run Commands

```bash
npm run dev              # Vite dev server at http://localhost:5173
npm run build            # Production build to dist/
npm run build:debug      # Development build with sourcemaps
npm run electron:start   # Build + launch Electron app
npm run dist             # Create distributable installer (electron-builder)
```

Version management:
```bash
npm run version:patch    # Increment patch version
npm run version:minor    # Increment minor version
npm run version:major    # Increment major version
npm run release:patch    # Increment version + build
```

## Key Dependencies

**Runtime:**
- **Electron 41.2** — Desktop app framework with IPC, safeStorage, auto-updater
- **React 18.2** — UI framework
- **use-immer 0.10** — Immutable state updates with draft API
- **Monaco Editor 0.45** — Code editor with TextMate grammar support
- **Sharp 0.33.5** — Image processing (lazy-loaded for GUI generation)
- **graphology** — Graph data structures and algorithms for layout engines
- **marked** — GitHub-Flavored Markdown rendering
- **recharts** — Statistics chart rendering
- **@google/genai** — Google Gemini AI integration

**Development:**
- **Vite 8.0** — Build tool with React plugin
- **Vitest 4.0** — Unit testing framework with jsdom + coverage
- **TypeScript 5.6** — Type checking
- **ESLint 9.0** — Linting with TypeScript + React Hooks rules
- **electron-builder 26.8** — Multi-platform packaging
- **Tailwind CSS 3.4** — Utility-first styling

**Testing** (Vitest):
```bash
npm test                        # Run all tests once
npm run test:watch               # Run in watch mode
npm run test:coverage            # With coverage report
npx vitest run path/to/file.test.ts  # Run a single test file
```
Coverage is configured for `components/`, `hooks/`, `contexts/`, and `App.tsx` using jsdom environment.

**Test infrastructure** (21 test files, ~260 tests):
- **Setup**: `test/setup.ts` — imports `@testing-library/jest-dom` matchers, global mocks
- **Electron mock**: `test/mocks/electronAPI.ts` — mock `window.electronAPI` for renderer tests
- **Sample data**: `test/mocks/sampleData.ts` — reusable test fixtures (blocks, characters, etc.)
- Component tests use `@testing-library/react` with `@testing-library/user-event`
- **Tested components**: ConfirmModal, CreateBlockModal, DiagnosticsPanel, SearchPanel, SnippetManager, Toast, Toolbar, UserSnippetModal
- **Tested hooks**: useDebounce, useDiagnostics, useFileSystemManager, useHistory, useModalAccessibility, useRenpyAnalysis
- **Tested lib utilities**: graphLayout, renpyCompletionProvider, renpyValidator, routeCanvasLayout, storyCanvasLayout
- **Integration tests**: renpyAnalysis.test.ts, smoke.test.ts
- CI gating: All tests + lint must pass before merge

**Linting** (ESLint):
```bash
npm run lint             # Check for lint errors
npm run lint:fix         # Auto-fix lint errors
```
Key rules: `react-hooks/rules-of-hooks` (error), `react-hooks/exhaustive-deps` (warn), `@typescript-eslint/no-explicit-any` (warn). Unused vars prefixed with `_` are allowed.

## Architecture

### Dual-Process Electron App

- **Main process** (`electron.js`, 1,136 lines): Window management, IPC handlers (40+ channels), file system operations, API key encryption (safeStorage), Ren'Py game execution as child process, custom `media://` protocol for assets, auto-updater integration.
- **Renderer process** (React app): All UI, state management, and Ren'Py analysis. Uses web worker for background analysis.
- **Preload bridge** (`preload.js`, 115 lines): Exposes `electronAPI` via contextBridge for secure IPC between processes. All channels follow `namespace:action` pattern.

### Core Application State (App.tsx)

`App.tsx` (~4K lines) is the central state hub. It manages all top-level state (blocks, groups, stickyNotes, links, characters, variables, images, audio, screens, scenes, imagemapCompositions, screenLayoutCompositions, diagnosticsTasks, ignoredDiagnostics, settings) using `useImmer` for immutable draft-based updates. State flows down via props; update callbacks are passed through the component hierarchy. Some state has been extracted into context providers (see Context Providers below).

### Key Data Model (types.ts)

`types.ts` (~1,160 lines) is the single source of truth for TypeScript types. Exports **91+ types** covering all data structures. Key types:

- **Block**: Represents a `.rpy` file with position, size, content, and filePath
- **BlockGroup**: Groups blocks visually on the canvas
- **Link**: Connection between blocks (from `jump`/`call` statements)
- **StickyNote**: Canvas annotation with text, position, size, and `NoteColor` (`'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'red'`)
- **EditorTab**: Open tab in the editor pane; `type` union: `'canvas' | 'route-canvas' | 'choice-canvas' | 'menu-constructor' | 'punchlist' | 'diagnostics' | 'editor' | 'image' | 'audio' | 'character' | 'scene-composer' | 'imagemap-composer' | 'screen-layout-composer' | 'ai-generator' | 'stats' | 'markdown'`. Tabs with `imagemap-composer` carry `imagemapId`; tabs with `screen-layout-composer` carry `layoutId`; tabs with `menu-constructor` carry `blockId`.
- **StoryCanvasLayoutMode**: `'flow-lr' | 'flow-td' | 'connected-components' | 'clustered-flow'` — auto-layout algorithm for both canvases
- **StoryCanvasGroupingMode**: `'none' | 'connected-component' | 'filename-prefix'` — cluster grouping strategy applied within `clustered-flow` mode
- **SavedStoryBlockLayout**: Persisted per-block position/size/color keyed by `filePath` in `ProjectSettings.storyBlockLayouts`
- **LabelNode**: A node in the RouteCanvas graph; carries `id`, `label`, `blockId`, `startLine`, `width`, `height`, `position`, and optional `containerName`
- **RouteLink**: A directed edge in the RouteCanvas graph with `sourceId`, `targetId`, and `type` (`'jump' | 'call'`)
- **ProjectSettings**: Persisted per-project IDE state including split pane layout, open tabs, canvas transforms, `sceneCompositions`, `imagemapCompositions`, `screenLayoutCompositions`, canvas layout/grouping modes, persisted block layouts, and layout fingerprints/versions for change detection
- **AppSettings**: Global app preferences (theme, Ren'Py path, mouse gesture settings, user snippets). `Theme` has 10 options: `'system' | 'light' | 'dark' | 'solarized-light' | 'solarized-dark' | 'colorful' | 'colorful-light' | 'neon-dark' | 'ocean-dark' | 'candy-light' | 'forest-light'`. `MouseGestureSettings` controls pan gesture (`CanvasPanGesture`: `'shift-drag' | 'drag' | 'middle-drag'`), scroll direction, and sensitivity.
- **Character, Variable, RenpyScreen, RenpyAudio**: Story element types
- **DiagnosticSeverity**: `'error' | 'warning' | 'info'`
- **DiagnosticIssue**: Category, message, blockId, line, column, severity. Categories: `invalid-jump`, `syntax`, `missing-image`, `missing-audio`, `undefined-character`, `undefined-screen`, `unused-character`, `unreachable-label`
- **DiagnosticsTask**: Task generated from a diagnostic issue — title, description, status, blockId, line, createdAt
- **DiagnosticsResult**: Issues array + error/warning/info counts
- **IgnoredDiagnosticRule**: Per-category/file/block/line suppression rule
- **UserSnippet**: User-defined code snippet (id, title, prefix, description, code, optional monacoBody for placeholder support)
- **ProjectLoadResult, ScanDirectoryResult**: Typed IPC return shapes
- **SerializedSprite, SerializedSceneComposition**: JSON-safe versions of scene composer types. `SceneComposition` carries an optional `resolution?: { width: number; height: number }` field (defaults to 1920×1080 when absent) persisted in `project.ide.json`.
- **ImageMapComposition**: Container for a clickable imagemap — ground image, optional hover overlay, and an array of hotspots. Persisted in `ProjectSettings.imagemapCompositions` (keyed by id) and saved to `project.ide.json`.
- **ImageMapHotspot**: A single clickable region with `x`, `y`, `width`, `height`, an `ImageMapActionType` (`'jump' | 'call'`), and a target label
- **SerializedImageMapComposition**: JSON-safe version of an imagemap composition
- **ScreenWidget, ScreenWidgetType**: Widget and type union for screen layout composer (`'vbox' | 'hbox' | 'frame' | 'text' | 'image' | 'textbutton' | 'button' | 'imagebutton' | 'bar' | 'input' | 'null'`)
- **ScreenLayoutComposition**: Screen name, game dimensions, modal flag, zorder, widgets array. Persisted in `ProjectSettings.screenLayoutCompositions`.
- **LLMProvider**: `'google' | 'openai' | 'anthropic' | 'other'`; **LLMModel**: provider, modelId, label, requiresAuth
- **CreateProjectOptions**: Options for creating a new Ren'Py project from template (projectDir, projectName, width, height, accentColor, isLight, sdkPath). Used by `dialog:createProjectFromTemplate` IPC channel.

### Component Architecture

**65 React components** organized in `/components/` directory. All functional components using hooks (no class components). Key components:

**Canvas/Visualization** (7 components):
- **StoryCanvas.tsx** — File-level flow visualization with blocks, groups, sticky notes
- **RouteCanvas.tsx** (1,500+ lines) — Label-level control flow graph
- **ChoiceCanvas.tsx** (1,386 lines, NEW v0.7.0) — Player-facing choice tree
- **Minimap.tsx** — Visual overview with click-to-pan
- **LabelBlock.tsx** (155 lines) — Visual node component for RouteCanvas/ChoiceCanvas
- **ViewRoutesPanel.tsx** (72 lines) — Route list sidebar with visibility toggles
- **CanvasLayoutControls.tsx** — Shared layout mode selector for all canvases

**Editors/Composers** (4 components):
- **EditorView.tsx** — Monaco editor with Ren'Py language support
- **SceneComposer.tsx** (1,200+ lines) — Visual sprite positioning editor
- **ImageMapComposer.tsx** (1,100+ lines) — Clickable hotspot editor
- **ScreenLayoutComposer.tsx** (1,121 lines) — Screen widget drag-and-drop builder

**Tools** (5 components):
- **MenuConstructor.tsx** (467 lines, NEW v0.7.0) — Visual menu builder with validation
- **DialoguePreview.tsx** (257 lines, NEW v0.7.0) — Live player view panel
- **DiagnosticsPanel.tsx** — Project-wide diagnostics with task tracking
- **SearchPanel.tsx** — Project-wide search/replace UI
- **StatsView.tsx** — Analytics dashboard with charts

**Panels** (6 components):
- **FileExplorerPanel.tsx** — File tree with drag-drop, cut/copy/paste
- **StoryElementsPanel.tsx** — Tabbed panel for characters/variables/screens/composers
- **ImageManager.tsx** — Image asset browser with metadata
- **AudioManager.tsx** — Audio asset browser with playback
- **CharacterEditorView.tsx** — Character definition editor
- **ScreenEditorView.tsx** — Screen definition editor

**Modals** (15+ components):
- **NewProjectWizardModal.tsx** — 3-step project creation with color derivation
- **SettingsModal.tsx** — Global app preferences
- **UserSnippetModal.tsx** — Create/edit custom code snippets
- **CreateBlockModal.tsx** — New .rpy file creation
- **ConfirmModal.tsx** — Generic confirmation dialog
- **AboutModal.tsx**, **KeyboardShortcutsModal.tsx**, and more

**UI Primitives** (10+ components):
- **Toolbar.tsx** — Top toolbar with actions
- **StatusBar.tsx** — Bottom status bar
- **Toast.tsx** — Toast notification system
- **CopyButton.tsx** — Standardized copy-to-clipboard button (3 sizes: xs/sm/md)
- **Sash.tsx** — Resizable split pane divider
- **TabContextMenu.tsx** — Right-click menu for editor tabs
- **LoadingOverlay.tsx**, **ErrorBoundary.tsx**

**Other** (15+ components):
- **SnippetManager.tsx** — User snippet CRUD UI
- **MarkdownPreviewView.tsx** — Dual-mode Markdown viewer/editor
- **AIGeneratorView.tsx** — AI story generation UI
- **WelcomeScreen.tsx** — Initial project picker screen

### Ren'Py Analysis Engine (hooks/useRenpyAnalysis.ts)

~769 lines. Regex-based parser that extracts labels, jumps, calls, characters, variables, screens, images, and audio references from `.rpy` files. Generates flow visualization data. Called via `performRenpyAnalysis()` when files change.

**Web Worker offloading** (`workers/renpyAnalysis.worker.ts`, 88 lines):
- Runs analysis in background thread to prevent UI blocking on large projects
- Content-hash caching (djb2 hash) — skips re-parsing unchanged files
- Progress reporting with 3 phases: file reading, analysis, result compilation
- Integrated in `useRenpyAnalysis` hook with automatic worker management

**Additional Ren'Py parsing utilities** (all in `lib/`):
- **`renpyValidator.ts`** — 21 validation rules with inline Monaco diagnostics (syntax errors, undefined references, unreachable code)
- **`renpySemanticTokens.ts`** — Semantic token provider for Monaco editor (label/variable/screen/character highlighting)
- **`textmateGrammar.ts`** — TextMate grammar bridge for syntax highlighting (uses `renpy.tmLanguage.json`)
- **`renpyLabelGuards.ts`** — Detects `renpy.has_label()` guard scope to suppress invalid-jump warnings
- **`renpyLogicalLines.ts`** — Multi-line statement parser (handles backslash continuations and triple-quoted strings)
- **`renpyTripleQuotes.ts`** — Triple-quoted string detection for accurate parsing
- **`renpyNames.ts`** — Reserved Ren'Py name checking (prevents naming collisions)

### Visual Canvas System

Three canvas views for different visualization needs:

- **StoryCanvas** (file-level flow): Main view — blocks as draggable rectangles with auto-drawn `jump`/`call` flow arrows. Features: fit-to-screen button, character filter (hide non-player characters), role tinting (visual styling by character role), legend overlay, canvas filter toggles (story elements, screens, config, notes, minimap), sticky notes, and an in-canvas layout control panel (top-left).

- **RouteCanvas** (label-level flow): Label-by-label control flow graph with route highlighting, unreachable label detection, call vs. jump arrow distinction, route names/node roles display, hover-to-expand, fit-to-screen, menu decision inspector, and an in-canvas layout control panel (top-left). Uses **`LabelBlock.tsx`** (155 lines) as the visual node component — displays overlay badges for hub/branch/menu-heavy/call-heavy roles, color-coded borders for entry/unreachable/dead-end states, and optional container names. Route management via **`ViewRoutesPanel.tsx`** (72 lines) — collapsible sidebar with checkboxes to toggle route visibility, shows route start → end with color indicators.

- **ChoiceCanvas** (player-facing choice tree, **NEW in v0.7.0**): Visualization focused on player decisions and branching paths. Shows only menu choices with visual color-coding per destination label. Features: pill-style choice buttons with arrow connections, displays choice text/conditions/menu prompts, unreachable choice detection, uses same layout engine as RouteCanvas with configurable layout modes and grouping. Implemented in **`components/ChoiceCanvas.tsx`** (1,386 lines).

- Canvas coordinates use a transform system (pan configurable via `MouseGestureSettings`, zoom via scroll)

### Canvas Auto-Layout System

Two pure-function layout engines (no external graph library) share the same algorithm family:

- **`lib/storyCanvasLayout.ts`** — operates on `Block[]` + `Link[]`; exports:
  - `computeStoryLayout(blocks, links, layoutMode, groupingMode)` → repositioned `Block[]`
  - `computeStoryLayoutFingerprint(...)` → stable string for change detection (avoids redundant re-layouts)
  - `buildSavedStoryBlockLayouts(blocks)` → `Record<filePath, SavedStoryBlockLayout>` for persistence
  - `getStoryLayoutVersion()` → version number for migration guards

- **`lib/routeCanvasLayout.ts`** — operates on `LabelNode[]` + `RouteLink[]`; exports:
  - `computeRouteCanvasLayout(nodes, edges, layoutMode, groupingMode)` → repositioned `LabelNode[]`
  - `computeRouteCanvasLayoutFingerprint(...)` and `getRouteCanvasLayoutVersion()`

**Layout modes** (shared by both canvases via `StoryCanvasLayoutMode`):
- `flow-lr` — Sugiyama-style layered DAG, left-to-right (default)
- `flow-td` — same algorithm, top-to-bottom
- `connected-components` — separate connected components laid out left-to-right
- `clustered-flow` — two-level layout: clusters positioned as super-nodes, internal nodes laid out within each cluster

**Grouping modes** (active only in `clustered-flow`):
- `none` — no grouping (falls back to connected-component clustering)
- `connected-component` — clusters = graph connected components
- `filename-prefix` — clusters = blocks sharing a filename prefix (e.g. `ep01`, `ch3`)

**`components/CanvasLayoutControls.tsx`** — shared panel rendered inside both canvases. Displays icon-toggle buttons for layout mode (4 options) and grouping mode (3 options). Accepts `canvasLabel`, `layoutMode`, `groupingMode`, and change callbacks as props.

Layout mode and grouping mode are stored in `ProjectSettings` (`storyCanvasLayoutMode`, `storyCanvasGroupingMode`, `routeCanvasLayoutMode`, `routeCanvasGroupingMode`) and persisted to `project.ide.json`. Layout fingerprints (`storyCanvasLayoutFingerprint`, `routeCanvasLayoutFingerprint`) prevent redundant re-layouts on reload.

### Split Pane / Tab System

The editor supports side-by-side or top/bottom split panes (`splitLayout: 'none' | 'right' | 'bottom'`). State is managed in `App.tsx`:
- `primaryOpenTabs` / `secondaryOpenTabs`: tabs per pane
- `activePaneId`: which pane is focused
- `splitPrimarySize`: pixel size of the primary pane
- Tabs can be dragged between panes; removing the last tab from secondary collapses the split
- `Sash.tsx` handles the resizable divider; `TabContextMenu.tsx` handles tab right-click menus
- Split state persists in `ProjectSettings` (written to `project.ide.json`)

### File System Integration

Two modes:
1. **Electron mode** (primary): File System Access API via IPC for direct local folder read/write
2. **Browser mode** (fallback): localStorage with ZIP export

Managed by `hooks/useFileSystemManager.ts` and `contexts/FileSystemContext.ts`.

### Context Providers (4 files in /contexts/)

All context providers use React Context API to avoid prop drilling and reduce component coupling:

- **AssetContext.ts** + `hooks/useAssetManager.ts` — Image/audio scanning, copy-to-project pipeline, metadata management. Persists scan directory paths in IDE settings. Provides `images` and `audio` Maps to all components.

- **FileSystemContext.ts** + `hooks/useFileSystemManager.ts` — Directory/file handle state, clipboard (cut/copy/paste), tree node CRUD and drag-drop. Abstracts Electron vs browser file system modes. Provides `fileTree`, `directoryHandle`, and file operation methods.

- **SearchContext.tsx** (NEW v0.7.0) — Project-wide search/replace state and execution. Extracted from App.tsx to reduce coupling. SearchPanel consumes this context directly (no prop drilling). Provides `searchQuery`, `searchResults`, `replaceText`, and search/replace methods.

- **ToastContext.tsx** — User notification system. Provides `showToast()` method and toast queue. Used for success messages, error alerts, and informational notifications throughout the app.

### IPC Channel Conventions

All `preload.js` channels follow a `namespace:action` naming pattern:

| Prefix | Domain |
|--------|--------|
| `fs:` | File I/O (`readFile`, `writeFile`, `createDirectory`, `removeEntry`, `moveFile`, `copyEntry`, `scanDirectory`) |
| `project:` | Project operations (`load`, `refresh-tree`, `search`) |
| `dialog:` | OS dialogs (`openDirectory`, `createProject`, `createProjectFromTemplate`, `selectRenpy`, `showSaveDialog`) |
| `game:` / `renpy:` | Game process (`run`, `stop`, `check-path`) |
| `app:` | Settings & encrypted API keys |

Exit flow uses a multi-step handshake: `check-unsaved-changes-before-exit` → `show-exit-modal` → `save-ide-state-before-quit` → `ide-state-saved-for-quit` → `force-quit`.

API keys are stored encrypted via Electron's `safeStorage` at `userData/api-keys.enc`. App settings live at `userData/app-settings.json`.

### New Project Wizard

The "Create New Project" flow (invoked from Welcome Screen or File → New Project) uses a 3-step wizard modal that generates SDK-compatible Ren'Py projects with custom colors and resolution:

**IPC Channel:** `dialog:createProjectFromTemplate` — accepts `CreateProjectOptions` (projectDir, projectName, width, height, accentColor, isLight, sdkPath)

**Implementation files:**
- **`components/NewProjectWizardModal.tsx`** — 3-step wizard UI:
  - Step 1: Project name + location picker (browse button)
  - Step 2: Resolution presets (720p/1080p/2K/4K) + custom W×H inputs
  - Step 3: Theme toggle (dark/light) + 20 SDK color swatches (5×4 grid) + custom color picker with preview
- **`lib/colorUtils.js`** (ES module) — `RenpyColor` class with tint/shade/HSV manipulation + `deriveGuiColors()` function that ports Ren'Py SDK's color derivation logic
- **`lib/guiImageGenerator.js`** (ES module) — Generates 8 essential GUI image sets using Sharp (buttons, bars, scrollbars, sliders, textbox, namebox, overlays)
- **`lib/templateProcessor.js`** (ES module) — `updateGuiRpy()`, `updateOptionsRpy()` helpers with regex replacements + `slugify()` utilities

**Template handling:**
- SDK template preferred: `{sdkPath}/gui/game/` (if SDK path configured and template exists)
- Bundled fallback: `resources/renpy-template/` (requires manual population with SDK template files)
- Template files copied to `{projectDir}/game/`, then `gui.rpy` and `options.rpy` are updated with user choices

**Image generation (Sharp):**
- Lazy-loaded on first project creation to avoid blocking app startup if Sharp fails
- If Sharp loads successfully → generates custom accent-tinted GUI images
- If Sharp fails → logs warning and falls back to template default images (non-critical failure)
- **Known issue (macOS arm64 build):** Sharp's native dependencies (libvips) fail to load in packaged app. See `NEW_PROJECT_PLAN.md` for debugging steps.

**Color derivation:** Replicates Ren'Py SDK's exact color math:
- Derived colors: `hover_color`, `muted_color`, `hover_muted_color`, `menu_color`, `title_color`
- Fixed theme colors: `selected_color`, `idle_color`, `idle_small_color`, `text_color`, `insensitive_color`
- Light vs. dark theme affects which fixed colors are used and how accent colors are transformed

**20 SDK swatches:** Top 2 rows = dark theme colors, bottom 2 rows = light theme colors (matches Ren'Py launcher)

## Key Conventions

- **State updates**: Always use `useImmer` draft functions, never mutate state directly
- **UI rendering**: Functional components with hooks only, no class components
- **Modals/overlays**: Rendered via `createPortal()`; all modals use `useModalAccessibility` hook for focus trap, Escape key close, and focus restore
- **Styling**: Tailwind CSS utility classes; dark mode via `class` strategy
- **Copy-to-clipboard**: Always use `components/CopyButton.tsx`. Props: `text` (string to copy), `label` (default `"Copy to Clipboard"`), `size` (`'xs'` for code-preview headers / list rows, `'sm'` default, `'md'` for primary action buttons). Idle state: clipboard icon + label. After click: green bg, checkmark, "Copied!" for 2 s. Never write per-component clipboard state or `alert()` feedback.
- **Path alias**: `@/*` maps to project root in imports (tsconfig)
- **Block = file**: Each `.rpy` file maps 1:1 to a Block on the canvas; the first label becomes the block title
- **Accessibility**: Icon-only buttons must have `aria-label`; modals must have `role="dialog"`, `aria-modal`, and `aria-labelledby`

## Custom Hooks (14 files in /hooks/)

**Core Analysis:**
- **useRenpyAnalysis.ts** (769 lines) — Returns `RenpyAnalysisResult` with links, characters, variables, screens, dialogue, and route graphs. Call `performRenpyAnalysis()` after any file change. Manages web worker for background analysis.
- **useDiagnostics.ts** — Consumes `RenpyAnalysisResult` and block content to produce `DiagnosticsResult`. Checks for invalid jumps, missing images/audio, undefined characters/screens, unused characters, unreachable labels, and syntax errors. Exposes `ignoredDiagnostics` suppression.

**File System:**
- **useFileSystemManager.ts** — File system abstraction with clipboard state (`Set<string>` of paths for cut/copy). Supports both Electron and browser modes.
- **useAssetManager.ts** — Manages `ProjectImage` and `RenpyAudio` Maps with metadata. Handles scanning external directories and copying assets into the project. Persists scan directory paths.

**State Management:**
- **useHistory.ts** — Generic undo/redo hook. Maintains `past[]`, `present`, `future[]`; exposes `undo()`, `redo()`, `setState()`, `canUndo`, `canRedo`. Guards against undoing past the initial loaded state.

**UI Utilities:**
- **useModalAccessibility.ts** — Reusable hook for dialog accessibility. Focus trap (Tab/Shift+Tab cycling), Escape key close, auto-focus first element, focus restore on unmount. Used by all modals.
- **useVirtualList.ts** — Virtualizes long lists for performance. Returns visible slice of data + scroll handlers.
- **useDebounce.ts** (NEW v0.7.0) — Generic value debounce hook with configurable delay.

All hooks have corresponding `.test.ts` files with comprehensive test coverage.

## Library Utilities (23 files in /lib/)

**Auto-Layout Engines** (pure functions, no external graph library):
- **graphLayout.ts** — Shared Sugiyama-style DAG layout algorithm (layering, crossing reduction, coordinate assignment)
- **storyCanvasLayout.ts** (600+ lines) — Block layout engine. Exports: `computeStoryLayout()`, `computeStoryLayoutFingerprint()`, `buildSavedStoryBlockLayouts()`, `getStoryLayoutVersion()`
- **routeCanvasLayout.ts** (600+ lines) — Label node layout engine. Exports: `computeRouteCanvasLayout()`, `computeRouteCanvasLayoutFingerprint()`, `getRouteCanvasLayoutVersion()`

**Ren'Py Language Support:**
- **renpyCompletionProvider.ts** — Context-aware autocomplete for Monaco (28 built-in snippets + user snippets)
- **renpyValidator.ts** (NEW v0.7.0) — 21 validation rules with inline Monaco diagnostics
- **renpySemanticTokens.ts** (NEW v0.7.0) — Semantic token provider for enhanced highlighting
- **textmateGrammar.ts** (NEW v0.7.0) — TextMate grammar bridge
- **renpy.tmLanguage.json** (NEW v0.7.0) — Complete TextMate grammar definition (40+ scopes)

**Ren'Py Parsing Utilities:**
- **renpyLabelGuards.ts** (NEW v0.7.0) — Detects `renpy.has_label()` guard scope
- **renpyLogicalLines.ts** (NEW v0.7.0) — Multi-line statement parser (backslash continuations)
- **renpyTripleQuotes.ts** (NEW v0.7.0) — Triple-quoted string detection
- **renpyNames.ts** (NEW v0.7.0) — Reserved Ren'Py name checking

**Code Generation:**
- **screenCodeGenerator.ts** — Generates Ren'Py screen code from `ScreenLayoutComposition`

**New Project Wizard** (ES modules):
- **colorUtils.js** — `RenpyColor` class with HSV manipulation + `deriveGuiColors()` (replicates SDK color math)
- **guiImageGenerator.js** — Generates 8 GUI image sets using Sharp (buttons, bars, scrollbars, sliders, textbox, namebox, overlays)
- **templateProcessor.js** — Updates `gui.rpy` and `options.rpy` with regex replacements + `slugify()` utilities

**Other:**
- **diagnosticIgnores.ts** — Suppression rule utilities for diagnostics
- **createId.ts** — UUID generation with prefix support

## Keyboard Shortcuts

- `N` — New block
- `G` — Group selected blocks
- `Ctrl+S` — Save
- `Shift+drag` — Pan canvas (default; configurable via `MouseGestureSettings` to `drag` or `middle-drag`)
- `Scroll` — Zoom canvas

## Monaco Editor Integration

`components/EditorView.tsx` integrates Monaco Editor with comprehensive Ren'Py language support:

### Syntax Highlighting (TextMate Grammar)
- **`lib/textmateGrammar.ts`** — Loads and registers TextMate grammar for Ren'Py language
- **`lib/renpy.tmLanguage.json`** — Complete TextMate grammar definition with 40+ scopes (strings, comments, keywords, labels, characters, control flow, etc.)
- Provides accurate syntax coloring that respects theme colors

### Semantic Tokens
- **`lib/renpySemanticTokens.ts`** — Semantic token provider for enhanced highlighting
- Highlights: labels (declaration + references), variables, screens, characters, image/audio assets
- Updates based on `RenpyAnalysisResult` for accurate real-time highlighting

### IntelliSense / Autocomplete
- **`lib/renpyCompletionProvider.ts`** — Context-aware autocomplete:
  - **`detectContext(lineContent, column)`**: Determines completion context from cursor position (jump, call, call-screen, show, hide, scene, variable, character, general)
  - **`getRenpyCompletions(context, data, range)`**: Returns Monaco `CompletionItem[]` with appropriate kinds, sort ordering, and snippet placeholders (`$1/$2/$0`)
  - Registered once in `EditorView.tsx` via `monacoInstance.languages.registerCompletionItemProvider('renpy', ...)`
  - Uses `analysisResultRef` (a React ref) so the closure always reads the latest analysis data without re-registration
  - Includes 28 built-in keyword snippets plus user-defined snippets from `AppSettings.userSnippets`

### Validation / Diagnostics
- **`lib/renpyValidator.ts`** — 21 validation rules with inline Monaco diagnostics:
  - Syntax errors (malformed statements, invalid indentation)
  - Undefined references (labels, characters, screens, images, audio)
  - Unreachable code detection
  - Invalid jump targets (with `renpy.has_label()` guard support)
  - Shows squiggly underlines in editor with error/warning/info severity

## User Code Snippets

Users can create custom code snippets (persisted in `AppSettings.userSnippets`):
- **`components/UserSnippetModal.tsx`**: Create/edit modal with title, prefix, description, code, and optional Monaco placeholder support
- **`components/SnippetManager.tsx`**: Displays "My Snippets" section (create/edit/delete/copy) above built-in Ren'Py snippet categories
- User snippets are integrated with IntelliSense — typing the prefix triggers the snippet in the editor
- CRUD operations wired through `App.tsx` → `updateAppSettings`

## Markdown Preview

`components/MarkdownPreviewView.tsx` provides dual-mode `.md` file viewing:
- **Preview mode** (default): Renders GitHub-flavored Markdown via `marked` library with custom `.markdown-body` CSS styles in `index.css`
- **Edit mode**: Monaco editor with `language="markdown"`, Ctrl+S to save
- Toggle button in the toolbar switches between modes
- File content loaded/saved via `fs:readFile` and `fs:writeFile` IPC channels
- Opened by double-clicking `.md` files in the file explorer (`handlePathDoubleClick` → `handleOpenMarkdownTab`)

## AI Story Generator

The app integrates AI APIs (Google Gemini via `@google/genai`, with optional OpenAI and Anthropic support via dynamic imports) for generating story content. API keys are encrypted at rest using Electron's `safeStorage`. The generator UI lives in `components/AIGeneratorView.tsx`.

## Menu Constructor (NEW in v0.7.0)

**`components/MenuConstructor.tsx`** (467 lines) provides a visual menu builder with real-time validation:
- Visual editor for creating Ren'Py menu blocks (choice menus)
- Add/remove/reorder menu choices with drag-and-drop
- Configure choice text, conditions, and actions (jump/call to label)
- Real-time Ren'Py code generation with syntax highlighting preview
- **Validation**: Checks jump targets (must be valid labels), variable references (must be defined), and syntax correctness
- Integrated with `RenpyAnalysisResult` for autocomplete of labels and variables
- Opened as a `menu-constructor` editor tab with `blockId` property (edits existing menu block)

## Dialogue Preview (NEW in v0.7.0)

**`components/DialoguePreview.tsx`** (257 lines) provides a live "Player View" panel in the editor:
- Shows mock Ren'Py textbox rendering for dialogue lines at cursor position
- Parses and renders Ren'Py text tags (`{b}`, `{i}`, `{color}`, `{size}`, etc.) with accurate formatting
- Displays character name + sprite thumbnail for character dialogue
- Renders menu choices for menu blocks with proper formatting
- Updates in real-time as cursor moves through the file
- Expandable/collapsible panel (toggle via button in editor toolbar)
- Helps writers visualize how dialogue will appear in-game without launching Ren'Py

## Scene Composer

`components/SceneComposer.tsx` provides a visual layout editor for positioning backgrounds and sprites:
- Drag-and-drop images from the Image Assets panel onto the stage; drag sprites to reposition
- Supports per-sprite zoom, flip, rotate, alpha, and blur controls; layer reordering via drag in the layer list
- **Configurable canvas resolution**: toolbar dropdown offers presets (1920×1080, 1280×720, 1024×768, 800×600) plus a "Custom…" option revealing W×H number inputs. Resolution persists in `SceneComposition.resolution` and is saved to `project.ide.json`. Defaults to 1920×1080 when absent (backwards compatible).
- Generates Ren'Py `scene`/`show` code in the Code Preview panel; exports a composited PNG via canvas
- Keyboard: Delete/Backspace removes selected sprite; Arrow keys nudge (Shift = 5× step); Escape clears selection

## ImageMap Composer

`components/ImageMapComposer.tsx` provides a visual editor for creating Ren'Py `imagebutton`/`imagemap` screens with clickable hotspot regions:
- Draw, resize, and manage hotspot rectangles over a ground image (with optional hover overlay image)
- Each hotspot has an `ImageMapActionType` (`'jump' | 'call'`) and a target label
- Ground and hover images are drag-dropped from the Image Assets panel only
- Compositions are stored in `App.tsx` state as `imagemapCompositions: Record<string, ImageMapComposition>` and persisted in `ProjectSettings` (saved to `project.ide.json`)
- Opened via the "Composers" tab in `StoryElementsPanel` (which groups both Scene Composer and ImageMap Composer entries; the tab count reflects `scenes.length + imagemaps.length`)

## Statistics Dashboard

`components/StatsView.tsx` provides a project analytics tab:
- Word counts from dialogue and narration
- Scene, route, character, and variable counts
- Charts rendered via `recharts` (BarChart)
- Opened as a `stats` editor tab

## Diagnostics System

`components/DiagnosticsPanel.tsx` + `hooks/useDiagnostics.ts` provide a comprehensive issue-tracking workflow:
- **Issue categories**: `invalid-jump` (jump to undefined label), `syntax` (parse errors), `missing-image`/`missing-audio` (undefined assets), `undefined-character`/`undefined-screen`, `unused-character`, `unreachable-label`
- Each `DiagnosticIssue` has severity (`error | warning | info`), category, message, blockId, line, column
- Issues can be converted to `DiagnosticsTask` items (tracked separately in App.tsx state as `diagnosticsTasks`)
- Per-rule suppression via `IgnoredDiagnosticRule` stored in `ignoredDiagnostics` state
- Opened as a `diagnostics` editor tab

## Screen Layout Composer

`components/ScreenLayoutComposer.tsx` (~1,121 lines) provides a visual drag-and-drop builder for Ren'Py screen definitions:
- Add, arrange, and nest `ScreenWidget` nodes representing Ren'Py screen DSL elements (`vbox`, `hbox`, `frame`, `text`, `image`, `textbutton`, `button`, `imagebutton`, `bar`, `input`, `null`)
- Each widget has configurable `properties` and optional `children` array
- `lib/screenCodeGenerator.ts` converts a `ScreenLayoutComposition` to Ren'Py screen code
- Compositions stored in App.tsx as `screenLayoutCompositions: Record<string, ScreenLayoutComposition>` and persisted in `ProjectSettings`
- Opened as a `screen-layout-composer` editor tab with `layoutId` property

## Version History

**Current version: 0.7.0 (Public Beta 4)**

### Major Features in v0.7.0:

1. **ChoiceCanvas** (1,386 lines) — Player-facing choice tree visualization with color-coding per destination
2. **MenuConstructor** (467 lines) — Visual menu builder with real-time validation
3. **DialoguePreview** (257 lines) — Live player view panel showing mock textbox rendering
4. **TextMate Syntax Highlighting** — Proper Ren'Py grammar with 40+ scopes
5. **Semantic Tokens** — Label/variable/screen/character/asset highlighting
6. **Diagnostics Panel** — Project-wide code diagnostics with 21 validation rules
7. **ImageMap Composer** — Clickable hotspot editor for imagemap screens
8. **Screen Layout Composer** — Visual screen widget builder
9. **Web Worker Analysis** — Background thread for Ren'Py parsing (prevents UI blocking)

### Architecture Improvements in v0.7.0:

- **SearchContext extraction** — Reduced App.tsx coupling (extracted search state to dedicated context)
- **Web worker offloading** — Improved UI responsiveness during analysis
- **Virtual list rendering** — Better performance for large datasets (`useVirtualList` hook)
- **Memoization** — Reduced unnecessary re-renders across components
- **Debounced updates** — Prevent redundant analysis passes (`useDebounce` hook)
- **Content-hash caching** — Skip re-parsing unchanged files (djb2 hash in worker)

### New Utility Files in v0.7.0:

- `renpyValidator.ts` — 21 validation rules
- `renpySemanticTokens.ts` — Semantic token provider
- `textmateGrammar.ts` — TextMate grammar integration
- `renpyLabelGuards.ts` — Guard scope detection
- `renpyLogicalLines.ts` — Multi-line statement parser
- `renpyTripleQuotes.ts` — Triple-quote detection
- `useDebounce.ts` — Generic debounce hook
- `workers/renpyAnalysis.worker.ts` — Web worker for analysis

## CI/CD

GitHub Actions (`.github/workflows/build.yml`) provides multi-platform builds:

**Test & Lint Job** (runs on ubuntu-latest):
- Runs `npm test` (all 260 tests across 21 test files)
- Runs `npm run lint` (ESLint with TypeScript rules)
- Gates all merges — must pass before build job runs

**Build Job** (runs on 4 platforms):
- **Windows**: windows-latest → produces `.exe` installer (NSIS)
- **macOS ARM**: macos-latest → produces `.dmg` installer
- **macOS Intel**: macos-15-intel → produces `.dmg` installer
- **Linux**: ubuntu-latest → produces `.AppImage` + `.zip`
- Uses Node.js 20 with `--legacy-peer-deps` flag
- Builds with electron-builder (config in package.json)
- Uploads artifacts for each platform

**electron-builder configuration**:
- Output directory: `release/`
- ASAR enabled with unpack patterns for native modules (Sharp)
- Bundled resources: `resources/renpy-template/` (Ren'Py project template)
- Auto-updater integration via electron-updater

**Known build issue**: Sharp's native dependencies (libvips) fail to load in macOS arm64 packaged builds. See `NEW_PROJECT_PLAN.md` for debugging steps. Sharp is lazy-loaded and falls back gracefully if unavailable.
