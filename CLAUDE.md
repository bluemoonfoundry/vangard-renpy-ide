# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Vangard Studio (formerly Ren'IDE) is an Electron + React/TypeScript desktop application for visual novel development. It maps `.rpy` files to draggable blocks on a canvas, provides integrated Monaco editors, and includes visual composers for scenes and image maps. Current version: **1.1.1**.

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


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
