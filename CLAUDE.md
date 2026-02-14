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

No test framework or linter is currently configured.

## Architecture

### Dual-Process Electron App

- **Main process** (`electron.js`, ~25K lines): Window management, IPC handlers, file system operations, API key encryption (safeStorage), Ren'Py game execution as child process, custom `media://` protocol for assets.
- **Renderer process** (React app): All UI, state management, and Ren'Py analysis.
- **Preload bridge** (`preload.js`): Exposes `electronAPI` via contextBridge for secure IPC between processes.

### Core Application State (App.tsx)

`App.tsx` (~3K lines) is the central state hub. It manages all top-level state (blocks, groups, links, characters, variables, images, audio, screens, scenes, settings) using `useImmer` for immutable draft-based updates. State flows down via props; update callbacks are passed through the component hierarchy.

### Key Data Model (types.ts)

- **Block**: Represents a `.rpy` file with position, size, content, and filePath
- **BlockGroup**: Groups blocks visually on the canvas
- **Link**: Connection between blocks (from `jump`/`call` statements)
- **Character, Variable, ImageAsset, AudioAsset, Screen, Scene**: Story element types

### Ren'Py Analysis Engine (hooks/useRenpyAnalysis.ts)

The largest source file (~25K lines). Regex-based parser that extracts labels, jumps, calls, characters, variables, screens, images, and audio references from `.rpy` files. Generates flow visualization data. Called via `performRenpyAnalysis()` when files change.

### Visual Canvas System

- **StoryCanvas**: Main view — blocks as draggable rectangles with auto-drawn flow arrows
- **RouteCanvas**: On-demand label-by-label control flow graph with route highlighting
- Canvas coordinates use a transform system (pan via Shift+drag, zoom via scroll)

### File System Integration

Two modes:
1. **Electron mode** (primary): File System Access API via IPC for direct local folder read/write
2. **Browser mode** (fallback): localStorage with ZIP export

Managed by `hooks/useFileSystemManager.ts` and `contexts/FileSystemContext.ts`.

### Context Providers

- **AssetContext**: Image/audio scanning, metadata, and asset pipeline
- **FileSystemContext**: Directory/file handle state
- **ToastContext**: User notification system

## Key Conventions

- **State updates**: Always use `useImmer` draft functions, never mutate state directly
- **UI rendering**: Functional components with hooks only, no class components
- **Modals/overlays**: Rendered via `createPortal()`
- **Styling**: Tailwind CSS utility classes; dark mode via `class` strategy
- **Path alias**: `@/*` maps to project root in imports (tsconfig)
- **Block = file**: Each `.rpy` file maps 1:1 to a Block on the canvas; the first label becomes the block title

## Keyboard Shortcuts

- `N` — New block
- `G` — Group selected blocks
- `Ctrl+S` — Save
- `Shift+drag` — Pan canvas
- `Scroll` — Zoom canvas

## CI/CD

GitHub Actions (`.github/workflows/build.yml`) builds on push/PR to main across Windows, macOS (ARM + Intel), and Linux using Node.js 20. Produces platform-specific installers via electron-builder.
