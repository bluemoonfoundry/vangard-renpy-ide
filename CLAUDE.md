# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vangard Ren'Py IDE is a desktop application (Electron + React/TypeScript) for visual novel development with Ren'Py. It represents `.rpy` files as draggable blocks on a canvas, auto-draws `jump`/`call` connection arrows, and provides an integrated Monaco code editor alongside asset and story management tools.

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
npm run release:patch    # Increment version + build
```

**Testing** (Vitest):
```bash
npm test                        # Run all tests once
npm run test:watch               # Run in watch mode
npm run test:coverage            # With coverage report
npx vitest run path/to/file.test.ts  # Run a single test file
```
Coverage is configured for `components/`, `hooks/`, `contexts/`, and `App.tsx` using jsdom environment.

Test infrastructure:
- **Setup**: `test/setup.ts` — imports `@testing-library/jest-dom` matchers
- **Electron mock**: `test/mocks/electronAPI.ts` — mock `window.electronAPI` for renderer tests
- **Sample data**: `test/mocks/sampleData.ts` — reusable test fixtures (blocks, characters, etc.)
- Component tests use `@testing-library/react` with `@testing-library/user-event`

**Linting** (ESLint):
```bash
npm run lint             # Check for lint errors
npm run lint:fix         # Auto-fix lint errors
```
Key rules: `react-hooks/rules-of-hooks` (error), `react-hooks/exhaustive-deps` (warn), `@typescript-eslint/no-explicit-any` (warn). Unused vars prefixed with `_` are allowed.

## Architecture

### Dual-Process Electron App

- **Main process** (`electron.js`, ~1K lines): Window management, IPC handlers, file system operations, API key encryption (safeStorage), Ren'Py game execution as child process, custom `media://` protocol for assets.
- **Renderer process** (React app): All UI, state management, and Ren'Py analysis.
- **Preload bridge** (`preload.js`): Exposes `electronAPI` via contextBridge for secure IPC between processes.

### Core Application State (App.tsx)

`App.tsx` (~4K lines) is the central state hub. It manages all top-level state (blocks, groups, stickyNotes, links, characters, variables, images, audio, screens, scenes, imagemapCompositions, screenLayoutCompositions, diagnosticsTasks, ignoredDiagnostics, settings) using `useImmer` for immutable draft-based updates. State flows down via props; update callbacks are passed through the component hierarchy. Some state has been extracted into context providers (see Context Providers below).

### Key Data Model (types.ts)

`types.ts` (~1,137 lines) is the single source of truth for TypeScript types. Key types:

- **Block**: Represents a `.rpy` file with position, size, content, and filePath
- **BlockGroup**: Groups blocks visually on the canvas
- **Link**: Connection between blocks (from `jump`/`call` statements)
- **StickyNote**: Canvas annotation with text, position, size, and `NoteColor` (`'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'red'`)
- **EditorTab**: Open tab in the editor pane; `type` union: `'canvas' | 'route-canvas' | 'punchlist' | 'diagnostics' | 'editor' | 'image' | 'audio' | 'character' | 'scene-composer' | 'imagemap-composer' | 'screen-layout-composer' | 'ai-generator' | 'stats' | 'markdown'`. Tabs with `imagemap-composer` carry `imagemapId`; tabs with `screen-layout-composer` carry `layoutId`.
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

### Ren'Py Analysis Engine (hooks/useRenpyAnalysis.ts)

~769 lines. Regex-based parser that extracts labels, jumps, calls, characters, variables, screens, images, and audio references from `.rpy` files. Generates flow visualization data. Called via `performRenpyAnalysis()` when files change.

### Visual Canvas System

- **StoryCanvas**: Main view — blocks as draggable rectangles with auto-drawn `jump`/`call` flow arrows. Features: fit-to-screen button, character filter (hide non-player characters), role tinting (visual styling by character role), legend overlay, canvas filter toggles (story elements, screens, config, notes, minimap), sticky notes, and an in-canvas layout control panel (top-left).
- **RouteCanvas**: Label-by-label control flow graph with route highlighting, unreachable label detection, call vs. jump arrow distinction, collapsible panel layout, route names/node roles display, hover-to-expand, fit-to-screen, a menu inspector for route metadata, and an in-canvas layout control panel (top-left).
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

### Context Providers

- **AssetContext** (`contexts/AssetContext.ts` + `hooks/useAssetManager.ts`): Image/audio scanning, copy-to-project pipeline, metadata; persists scan directory paths in IDE settings
- **FileSystemContext** (`contexts/FileSystemContext.ts` + `hooks/useFileSystemManager.ts`): Directory/file handle state, clipboard (cut/copy/paste), tree node CRUD and drag-drop
- **SearchContext** (`contexts/SearchContext.tsx`): Project-wide search/replace state and execution. SearchPanel consumes this context directly (no prop drilling). Extracted from App.tsx.
- **ToastContext** (`contexts/ToastContext.tsx`): User notification system

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

## Key Hooks

- **useHistory<T>**: Generic undo/redo — maintains `past[]`, `present`, `future[]`; exposes `undo()`, `redo()`, `setState()`, `canUndo`, `canRedo`. Guards against undoing past the initial loaded state.
- **useRenpyAnalysis**: Returns `RenpyAnalysisResult` with links, characters, variables, screens, dialogue, and route graphs. Call `performRenpyAnalysis()` after any file change.
- **useDiagnostics**: Consumes `RenpyAnalysisResult` and block content to produce `DiagnosticsResult` — checks for invalid jumps, missing images/audio, undefined characters/screens, unused characters, unreachable labels, and syntax errors. Exposes `ignoredDiagnostics` suppression.
- **useFileSystemManager**: File system abstraction with clipboard state (`Set<string>` of paths for cut/copy).
- **useAssetManager**: Manages `ProjectImage` and `RenpyAudio` Maps with metadata; handles scanning external directories and copying assets into the project.
- **useModalAccessibility**: Reusable hook for dialog accessibility — focus trap (Tab/Shift+Tab cycling), Escape key close, auto-focus first element, focus restore on unmount. Used by all modals.
- **useVirtualList**: Virtualizes long lists for performance.
- **useDebounce**: Generic value debounce hook.

## Keyboard Shortcuts

- `N` — New block
- `G` — Group selected blocks
- `Ctrl+S` — Save
- `Shift+drag` — Pan canvas (default; configurable via `MouseGestureSettings` to `drag` or `middle-drag`)
- `Scroll` — Zoom canvas

## IntelliSense / Autocomplete

`lib/renpyCompletionProvider.ts` provides context-aware autocomplete for the Monaco editor:
- **`detectContext(lineContent, column)`**: Determines completion context from cursor position (jump, call, call-screen, show, hide, scene, variable, character, general)
- **`getRenpyCompletions(context, data, range)`**: Returns Monaco `CompletionItem[]` with appropriate kinds, sort ordering, and snippet placeholders (`$1/$2/$0`)
- Registered once in `EditorView.tsx` via `monacoInstance.languages.registerCompletionItemProvider('renpy', ...)`
- Uses `analysisResultRef` (a React ref) so the closure always reads the latest analysis data without re-registration
- Includes 28 built-in keyword snippets plus user-defined snippets from `AppSettings.userSnippets`

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

## CI/CD

GitHub Actions (`.github/workflows/build.yml`) builds on push/PR to main across Windows, macOS (ARM + Intel), and Linux using Node.js 20. Produces platform-specific installers via electron-builder.
