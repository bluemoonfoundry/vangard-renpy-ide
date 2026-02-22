# Test Automation Plan — Vangard Ren'Py IDE

## Current State

- **No test framework, no linter, zero test files** in the codebase
- 46 components, 4 hooks, 3 contexts, a 25K-line Ren'Py parser, and 20+ IPC handlers — all untested
- Build toolchain: Vite + TypeScript + React 18 + Electron 29

---

## Recommended Toolchain

| Layer | Tool | Rationale |
|-------|------|-----------|
| Unit / Hook tests | **Vitest** | Vite-native, same config, fast HMR-based watch mode |
| Component tests | **React Testing Library** + **jsdom** | Standard for React, tests behavior not implementation |
| IPC / Main process | **Vitest** (Node mode) | Test electron.js handlers in isolation with mocked Electron APIs |
| E2E | **Playwright + Electron** | `electron = electronApp.launch()` — real app, real menus, real IPC |
| Coverage | **v8** (built into Vitest) | Zero-config coverage via `--coverage` |
| CI | **GitHub Actions** (existing) | Add test job before build job |

---

## Phase 1 — Foundation (Week 1-2)

### 1.1 Install & Configure

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
```

Add to `vite.config.ts`:

```ts
/// <reference types="vitest" />
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['components/**', 'hooks/**', 'contexts/**', 'App.tsx'],
    },
  },
});
```

Add scripts to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

Create `test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';

// Mock window.electronAPI globally
vi.stubGlobal('electronAPI', undefined);
```

### 1.2 Create Mock Helpers

**`test/mocks/electronAPI.ts`** — A factory that returns a fully typed mock of the `window.electronAPI` preload bridge (all 20+ methods as `vi.fn()`). Every test that needs Electron can import and configure it.

**`test/mocks/sampleData.ts`** — Reusable fixtures: a minimal `Block`, `BlockGroup`, `Link`, `Character`, `Variable`, `RenpyAnalysisResult`, and `AppSettings` object. Based on `types.ts` interfaces.

---

## Phase 2 — High-Value Unit Tests (Week 2-4)

Priority: test the code with the most logic and fewest UI dependencies.

### 2.1 Ren'Py Parser (`hooks/useRenpyAnalysis.ts`) — **Critical**

This 25K-line file is the core analysis engine. Extract its pure parsing functions and test them directly.

| Test suite | What to cover | Example cases |
|------------|---------------|---------------|
| Label extraction | `label start:`, `label chapter1_scene2:` | Nested labels, labels with parameters, duplicate labels |
| Jump/Call resolution | `jump start`, `call screen_name`, `call expression var` | Forward refs, missing targets, conditional jumps |
| Character parsing | `define e = Character("Eileen")` | All Character() kwargs, DynamicCharacter, auto-voice |
| Variable parsing | `default x = 0`, `define y = True` | Types: int, float, string, bool, list, dict, None |
| Screen parsing | `screen main_menu():` | Nested screens, `use` statements, screen parameters |
| Image references | `image eileen happy = "eileen_happy.png"` | Layered images, ATL, image tags |
| Audio references | `play music "track.ogg"`, `play sound` | Channels, fadeout, loop |
| Flow analysis | Full file → label graph | Multi-file projects, circular jumps, orphan labels |

**Target: 80-90% coverage of parser logic.** This is where bugs are most likely to hide and most expensive to debug.

### 2.2 History Hook (`hooks/useHistory.ts`)

| Test | Description |
|------|-------------|
| Push state | Push multiple states, verify stack grows |
| Undo | Undo returns previous state, `canUndo` toggles |
| Redo | Redo after undo restores, `canRedo` toggles |
| Redo cleared on push | New action after undo clears redo stack |
| Max history size | Stack doesn't grow unbounded |

### 2.3 File System Manager (`hooks/useFileSystemManager.ts`)

Test with mocked `electronAPI`:

| Test | Description |
|------|-------------|
| Create file | Calls `writeFile`, updates tree |
| Rename file | Calls `moveFile`, updates tree and block references |
| Delete file | Calls `removeEntry`, removes from tree |
| Clipboard ops | Cut/copy/paste flow with mock handles |
| Error handling | `writeFile` rejects → toast shown, state unchanged |

### 2.4 Asset Manager (`hooks/useAssetManager.ts`)

| Test | Description |
|------|-------------|
| Scan directory | Returns images/audios from mock scanDirectory |
| Add scan dir | Adds to scan directories map |
| Remove scan dir | Removes from map |
| Copy to project | Calls copyEntry for each source path |

---

## Phase 3 — Component Tests (Week 4-7)

Test UI components with React Testing Library. Focus on user-visible behavior, not implementation details.

### 3.1 Tier 1 — Modals & Simple Components

Easy to test in isolation (no canvas, no complex state):

| Component | Key behaviors to test |
|-----------|----------------------|
| `KeyboardShortcutsModal` | Renders all shortcuts, closes on click/escape |
| `ConfirmModal` | Confirm/cancel callbacks fire correctly |
| `AboutModal` | Renders version info, closes |
| `SettingsModal` | Renders settings, saves on confirm, validates paths |
| `ConfigureRenpyModal` | Path selection, validation feedback |
| `Toast` | Appears with message, auto-dismisses, manual dismiss |
| `StatusBar` | Displays word count, reading time, version |
| `WelcomeScreen` | Open/create project buttons fire callbacks |
| `LoadingOverlay` | Shows/hides based on prop |
| `Toolbar` | All buttons fire callbacks, save button changes style when dirty, run/stop toggle |

### 3.2 Tier 2 — Panels & Editors

More complex, require mock data:

| Component | Key behaviors to test |
|-----------|----------------------|
| `FileExplorerPanel` | Renders tree, double-click opens file, context menu actions |
| `SearchPanel` | Search input, results list, result click navigates |
| `StoryElementsPanel` | Tab switching (characters/variables/screens/images/audio/scenes), list rendering |
| `CharacterEditorView` | Load character, edit fields, save |
| `VariableManager` | Add/edit/delete variables |
| `ScreenManager` | List screens, open screen definition |
| `ImageManager` | Image grid rendering, metadata editing |
| `AudioManager` | Audio list rendering, playback controls |
| `PunchlistManager` | Item rendering, status toggling, filtering |
| `SnippetManager` | Category toggle, snippet insertion |
| `AIGeneratorView` | Model selection, context building, API call mock |

### 3.3 Tier 3 — Canvas Components

Requires mocking pointer/drag events:

| Component | Key behaviors to test |
|-----------|----------------------|
| `CodeBlock` | Renders title/content, drag start fires callback, double-click opens editor |
| `StickyNote` | Renders text, editable, drag, delete |
| `GroupContainer` | Renders group, contains blocks, selection |
| `StoryCanvas` | Block rendering, selection, context menu (mock pointer events) |
| `RouteCanvas` | Node rendering, route highlighting |
| `Minimap` | Renders scaled view, click navigates |

---

## Phase 4 — IPC / Main Process Tests (Week 5-6)

Test `electron.js` handlers in isolation using Vitest in Node mode.

### 4.1 Setup

Create `vitest.config.node.ts` for main-process tests:

```ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/electron/**/*.test.ts'],
  },
});
```

Mock Electron APIs (`app`, `BrowserWindow`, `ipcMain`, `Menu`, `dialog`, `safeStorage`) with `vi.mock('electron')`.

### 4.2 Test Cases

| Handler | Tests |
|---------|-------|
| `dialog:openDirectory` | Returns selected path, returns null on cancel |
| `dialog:createProject` | Creates directory structure, returns path |
| `project:load` | Reads project.ide.json, returns blocks/settings |
| `project:refresh-tree` | Scans directory, returns tree structure |
| `fs:writeFile` | Writes content, returns success |
| `fs:removeEntry` | Deletes file/directory, handles errors |
| `fs:moveFile` | Renames file, returns success |
| `fs:copyEntry` | Copies file, returns success |
| `fs:scanDirectory` | Scans for images/audio by extension |
| `project:search` | Finds query in .rpy files, returns matches with line numbers |
| `app:get-settings` / `app:save-settings` | Read/write settings JSON |
| `app:save-api-key` / `app:get-api-key` | Encrypt/decrypt via safeStorage mock |
| `game:run` | Spawns process, sends `game-started`, menu items toggle |
| `game:stop` | Kills process, sends `game-stopped`, menu items toggle |
| `game:run` (already running) | Returns early, no duplicate spawn |
| `game:run` (spawn error) | Sends `game-error`, cleans up state |
| Menu construction | Correct items, correct accelerators, conditional dev tools |
| Window state | Save/restore window position and size |
| `media://` protocol | Serves files with correct MIME types |

---

## Phase 5 — Integration Tests (Week 7-8)

Test cross-cutting flows that span multiple components/hooks:

| Flow | Description |
|------|-------------|
| Open project → analysis → canvas | Load project files → parser runs → blocks appear on canvas with links |
| Edit block → dirty state → save | Change content → dirty indicator shows → Ctrl+S → file written → indicator clears |
| Create block → file created → appears on canvas | New block modal → file written to disk → block rendered |
| Search → navigate to result | Search query → results rendered → click result → editor opens at line |
| Undo/redo across operations | Multiple edits → undo reverts each → redo restores |
| Settings change → persist → reload | Change theme → save → reload project → theme persisted |
| Run game → stop game | Run → button/menu state changes → stop → state reverts |

These tests use the real React component tree (rendered with a test wrapper providing contexts) but mock `electronAPI`.

---

## Phase 6 — E2E Tests (Week 8-10)

### 6.1 Setup

```bash
npm install -D playwright @playwright/test electron
```

Create `playwright.config.ts` targeting the Electron app:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  use: {
    trace: 'on-first-retry',
  },
});
```

Use Playwright's `_electron.launch()` to test against the real packaged app.

### 6.2 Test Scenarios

| Scenario | Steps |
|----------|-------|
| Fresh launch | App opens → welcome screen shown → no project loaded |
| Open demo project | Open DemoProject → files loaded → canvas shows blocks → links drawn |
| Create new project | File > New → enter name → project directory created → empty canvas |
| Full edit cycle | Open project → open block → edit in Monaco → save → verify file on disk |
| Menu integration | All menu items clickable → correct views/modals open |
| Keyboard shortcuts | Ctrl+S saves, F5 runs, Ctrl+Shift+F opens search, etc. |
| Sidebar collapse/expand | Click collapse → sidebar collapses → click expand → sidebar returns |
| Canvas interaction | Drag block → position updates → zoom → pan |
| Settings persistence | Change setting → close → reopen → setting persisted |

---

## Phase 7 — CI Integration (Week 9-10)

Update `.github/workflows/build.yml`:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  build:
    needs: test    # Build only runs if tests pass
    # ... existing build matrix ...
```

---

## Coverage Targets

| Area | Target | Rationale |
|------|--------|-----------|
| `hooks/useRenpyAnalysis.ts` | 85% | Core logic, high complexity, most likely to regress |
| `hooks/useHistory.ts` | 95% | Small, pure logic, easy to cover fully |
| `hooks/useFileSystemManager.ts` | 80% | Critical I/O paths |
| `hooks/useAssetManager.ts` | 80% | Asset pipeline correctness |
| `electron.js` IPC handlers | 75% | Main process reliability |
| Components (Tier 1) | 90% | Simple components, easy to test |
| Components (Tier 2) | 70% | Moderate complexity |
| Components (Tier 3 - Canvas) | 50% | Hard to test pointer/drag, diminishing returns |
| Overall project | **65%** | Realistic starting target for a previously-untested codebase |

---

## Effort Estimate

| Phase | Scope | Approximate effort |
|-------|-------|-------------------|
| 1. Foundation | Toolchain setup, mocks, helpers | Small |
| 2. Unit tests | Parser, hooks | Medium-Large (parser is 25K lines) |
| 3. Component tests | 46 components across 3 tiers | Large |
| 4. IPC tests | 20+ handlers | Medium |
| 5. Integration tests | 7 cross-cutting flows | Medium |
| 6. E2E tests | 9 scenarios | Medium |
| 7. CI integration | Pipeline config | Small |

---

## Recommended Starting Order

1. **Phase 1** — Get Vitest running (prerequisite for everything)
2. **Phase 2.1** — Parser tests (highest value: complex, pure logic, most fragile)
3. **Phase 2.2** — History hook tests (quick win, builds confidence)
4. **Phase 3.1** — Tier 1 component tests (quick wins, covers modals/toolbar)
5. **Phase 4** — IPC handler tests (catches main process regressions)
6. **Phase 3.2-3.3** — Remaining component tests
7. **Phase 5-6** — Integration and E2E (highest effort, highest confidence)
8. **Phase 7** — CI gate (prevents regressions from merging)
