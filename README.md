[![Build/Release](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/build.yml/badge.svg)](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/build.yml)
[![CodeQL](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/github-code-scanning/codeql)
![Version](https://img.shields.io/badge/version-0.7.1_Public_Beta_4-blue)
![Platform](https://img.shields.io/badge/platform-Windows_%7C_macOS_%7C_Linux-lightgrey)

# Ren'IDE : The Ren'Py Visual Designer

> **The IDE that lets you see your story.**

Vangard is a desktop IDE for Ren'Py visual novel development. Your `.rpy` files appear as draggable blocks on a visual canvas — `jump` and `call` connections auto-draw as arrows. Three canvases let you see your project from every angle: file structure, control flow, and the player's choice experience. A full Monaco code editor, three visual composers, asset managers, diagnostics, and a color picker are all built in.

It works **alongside** the Ren'Py SDK. Your `.rpy` files stay as `.rpy` files. No lock-in.

**[Watch the Beta 4 demo reel on YouTube →](https://youtube.com/watch?v=bZ-Wy1cFaYg&si=mxKo5r4Us4XV5brJ)**

**[Download the latest release (v0.6.0 - Beta 3)](https://github.com/bluemoonfoundry/vangard-renpy-ide/releases/latest)**  

**[Download the latest nightly release (bleeding edge, tread carefully!)](https://github.com/bluemoonfoundry/bmf-vangard-renpy-ide/releases/tag/nightly)**



---

## Why Ren'IDE?

Managing a Ren'Py project in a plain text editor means juggling dozens of `.rpy` files with no way to see the whole picture. You lose track of where jumps lead, which characters appear in which scenes, and whether your branching structure even makes sense.

Vangard gives you that picture — and keeps it in sync as you write.

- **See your story's structure** at a glance, without opening a single file
- **Navigate instantly** from a canvas node to the code behind it
- **Catch problems early** — broken jumps, missing assets, and unreachable labels flagged automatically
- **Compose visually** — build scenes, imagemaps, and screens with drag-and-drop, then copy the generated code

---

## Features

### Three Canvases

#### Project Canvas

Your `.rpy` files as draggable blocks. `jump` and `call` connections auto-draw as arrows. Drag blocks to organize, click "Redraw" to auto-layout, or filter by character to focus on a single storyline. Role tinting colors blocks by which characters appear in them. A legend overlay explains arrow types and colors. Blocks with diagnostics display a colored outer glow — red for errors, amber for warnings — so problem areas are visible even when fully zoomed out.

Use `Ctrl+G` (or `Cmd+G`) to open the **Go-to-Label** command palette at any time. Type a label name and press `Enter` to jump directly to that node. The toolbox also has a persistent "Go to Label" search box for the same purpose. Both zoom the canvas in to at least 100% so the target is always clearly visible.

#### Flow Canvas

A label-by-label narrative flow graph. Every `label` becomes a node; every `jump`, `call`, and implicit fall-through becomes an edge. Highlight specific routes with distinct colors. Unreachable labels are flagged. Hover over menu nodes to inspect all choices and their destinations. Includes a "Go to Label" toolbox search and responds to the global `Ctrl+G` palette, with zoom-on-navigate consistent with the Project Canvas.

#### Choices Canvas

The player's view. Where the Flow Canvas shows code structure, the Choices Canvas shows the player experience. Menu nodes fan out to destinations via color-coded choice pills. Each pill shows the player-visible choice text and any `if` condition guard as a badge — so you can trace exactly what the player sees and where each choice leads, even when paths cross. Includes a "Go to Label" toolbox search and responds to the global `Ctrl+G` palette.

---

### Code Editor

A full Monaco editor (the VS Code engine) built right in. Split panes let you edit two files side by side. Drag tabs between panes.

- **TextMate syntax highlighting** — accurate, context-aware Ren'Py coloring with semantic token support for labels, variables, and screen references
- **Context-aware IntelliSense** — autocomplete for `jump`/`call` targets, `show`/`scene` images, character tags, screen names, and variables
- **28+ built-in Ren'Py snippets** with tab-stop placeholders
- **User-defined snippets** — create custom snippets with trigger prefixes that integrate with IntelliSense
- Cursor position (Ln/Col) in status bar

---

### Story Elements

The right sidebar analyzes your entire project continuously. Tabs are organized in a two-level layout — primary category tabs across the top, then sub-tabs within each category — for efficient use of vertical space.

| Category | Sub-tabs | What it shows |
|----------|----------|---------------|
| **Story Data** | Characters | All `define Character(...)` definitions — name, tag, color, dialogue count. Add, edit, find usages. |
| | Variables | All `define`/`default` globals. Find usages. |
| | Screens | All `screen` definitions. Jump to definition. Add with boilerplate. |
| **Assets** | Images | Image asset manager with thumbnails and folder tree. |
| | Audio | Audio asset manager with built-in player. |
| **Composers** | Scenes | Scene Composer — layer backgrounds and sprites, export PNG. |
| | ImageMaps | ImageMap Composer — draw hotspots, generate imagemap screen code. |
| | Screen Layouts | Screen Layout Composer — visual DSL builder for Ren'Py screens. |
| **Tools** | Snippets | Grid-browsable snippet library with fuzzy search and category filters. Built-in snippets + user global + project-specific. |
| | Menus | Visual menu and choice designer with custom code block support. |
| | Colors | Color picker with four built-in palettes (Ren'Py Standard, HTML Named, Material 500, Pastel) and a live Project Theme palette scanned from your `.rpy` files. Insert at cursor, wrap in `{color}` tags, or copy hex. |

### Asset Managers

#### Image Assets

Browse all project images organized by folder, with visual thumbnails. Scan external directories without copying files in. Right-click any image to copy a `scene` or `show` statement directly to your clipboard. Drag images onto the Scene Composer stage or Screen Layout Composer. Double-click to manage Ren'Py tags and metadata.

#### Audio Assets

Same workflow for audio. Browse, scan external directories, and right-click to copy `play music`, `play sound`, or `queue audio` statements. **Custom audio player** with Web Audio API integration, 64-bar equalizer visualization (cyan→blue→violet gradient with peak dots and scanline overlay), and volume control.

---

### Visual Composers

#### Scene Composer

Layer backgrounds and sprites on a stage. Per-sprite controls: zoom, flip, rotate, alpha, blur. **Visual Effects panel** with color grading (saturation, brightness, contrast, invert), color modes (tint, colorize), and categorized matrix presets (Night, Sunset, Sepia, Greyscale, Noir, Faded, Silhouette, etc.). Lock layers to prevent accidental edits. Inline layer actions (delete, make background) appear as hover-reveal icons on each layer row. Reorder layers by dragging. Configurable stage resolution (presets: 1920×1080, 1280×720, 1024×768, 800×600, or custom). Copy the generated `scene`/`show` Ren'Py code or export the composition as a PNG.

#### ImageMap Composer

Draw clickable hotspot rectangles over a ground image (with optional hover overlay). Each hotspot has a configurable action type (`jump` or `call`) and target label. Generates `imagebutton`/`imagemap` screen code ready to copy into your project. Ground and hover images are set by dragging from the Image Assets panel.

#### Screen Layout Composer

Build Ren'Py screens visually. Drag widgets (`vbox`, `hbox`, `frame`, `text`, `image`, `textbutton`, `button`, `imagebutton`, `bar`, `input`, `null`) onto the stage and nest them. Configure properties per widget. Generates ready-to-use `screen` code with copy-to-clipboard support. Existing screens can be viewed in read-only mode; duplicate to create an editable copy.

---

### Diagnostics

A dedicated panel surfaces issues across every file in the project.

- **Invalid jumps** — `jump` or `call` to a label that doesn't exist
- **Missing images / audio** — assets referenced in code but not found in the project
- **Undefined characters / screens** — used but never defined
- **Unused characters** — defined but never spoken
- **Unreachable labels** — labels no path leads to
- **Syntax errors** — parse failures with file and line

Click any issue to jump directly to the source. Filter by severity (error / warning / info). Convert issues to task checklist items tracked with your project.

---

### Project Statistics

Word counts, estimated play time, lines of dialogue, per-character dialogue breakdown (bar chart), scene and route counts, and branching complexity scores. Statistics are computed asynchronously after the tab opens — each metric shows an inline spinner until ready, so the Stats tab appears instantly even for large projects. An **IDE Performance** section at the bottom of the Stats tab shows live diagnostics: project load time, analysis worker duration, asset scan time, canvas FPS, and JS heap memory.

---

### More

- **Project Explorer** — file tree with create, rename, delete, cut/copy/paste, and drag-drop. Right-click an `.rpy` file → "Center on Canvas" to locate its block. **Refresh Project** option (File menu, context menu) reconciles all files and assets with disk state.
- **Project-wide Search & Replace** — full-text search with regex. Replace individually or bulk with confirmation.
- **New Project Wizard** — 3-step flow: name + location, resolution presets, theme + color picker. Generates a complete SDK-compatible Ren'Py project.
- **Markdown Preview** — double-click any `.md` file for GitHub-style rendered preview with toggle to Monaco edit mode.
- **First-run Tutorial** — a 6-step guided tour on first launch with SVG spotlight effects and keyboard navigation. Replay at any time via **Help → Show Tutorial**.
- **Bundled User Guide** — a complete HTML user guide ships with the app. Open it from **Help → User Guide** in the menu bar.
- **External File Change Detection** — detects when `.rpy` files are modified outside the app. Non-dirty files reload silently; dirty files show a persistent warning bar with Reload / Keep options.
- **Undo/Redo** — full history for canvas moves, block creation/deletion, and composition edits (`Ctrl+Z` / `Ctrl+Y`).
- **Drafting Mode** — adds placeholders for missing images and audio so the game runs during development.
- **Run Game** — launch Ren'Py as a child process directly from the toolbar.
- **Keyboard-accessible canvases** — Tab to move focus between blocks/nodes, Arrow keys for spatial navigation, Enter to open in editor, Escape to deselect. Every canvas element has an `aria-label` for screen readers (NVDA, VoiceOver, JAWS). Visible focus indicators for keyboard-only users.
- **11 Themes** — system, light, dark, solarized light/dark, colorful, colorful light, neon dark, ocean dark, candy light, forest light.
- **Auto-updater** — checks for new releases on launch and prompts to install.
- **Version in status bar** — the app version is always visible at the right end of the status bar.
- **Cross-platform** — Windows (NSIS installer), macOS (DMG), Linux (AppImage).

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Save All | `Ctrl+S` |
| Close Active Tab | `Ctrl+W` / `Cmd+W` |
| Quit Application | `Ctrl+Q` / `Cmd+Q` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |
| New Block | `N` |
| Group selected blocks | `G` |
| Go to Label | `Ctrl+G` / `Cmd+G` |
| Pan canvas | `Shift+Drag` (configurable) |
| Zoom canvas | Mouse scroll |
| Select multiple blocks | `Ctrl+Click` or rubber-band drag |
| Delete selected | `Delete` |

---

## Getting Started

### Install (Recommended)

1. Go to the **[releases page](https://github.com/bluemoonfoundry/vangard-renpy-ide/releases/latest)**
2. Download the zip for your OS and unzip it
3. **Windows**: run the `.exe` installer
4. **macOS**: open the `.dmg` and move the app to your Applications folder
5. **Linux**: make the `.AppImage` executable and run it

On first launch, open an existing Ren'Py project folder or create a new project with the wizard.

---

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 18.x or newer
- npm (bundled with Node.js)

### Setup

```bash
git clone https://github.com/bluemoonfoundry/vangard-renpy-ide.git
cd vangard-renpy-ide
npm install
```

### Run

```bash
npm run electron:start   # Build + launch Electron app
npm run dev              # Vite dev server only (http://localhost:5173)
```

### Test

```bash
npm test                              # Run all tests once
npm run test:watch                    # Watch mode
npx vitest run path/to/file.test.ts   # Single file
```

### Build Distributable

```bash
npm run dist
```

Output goes to `release/`. On Windows: run the `.exe` installer. On Mac: open the `.dmg`. On Linux: run the `.AppImage`.

---

## Toolbar Reference

Buttons are arranged left-to-right. The canvas switcher (Story / Route / Choice) sits at the centre; mode toggles and Run/Save live on the right.

| Icon | Button | Function | Shortcut |
|------|--------|----------|----------|
| ![Arrow Left](https://img.shields.io/badge/-←-gray?style=flat-square) | **Undo** | Revert the last canvas or editor change | `Ctrl+Z` |
| ![Arrow Right](https://img.shields.io/badge/-→-gray?style=flat-square) | **Redo** | Re-apply the last undone change | `Ctrl+Y` |
| ![Plus](https://img.shields.io/badge/-+-blue?style=flat-square) | **New Scene** | Create a new blank `.rpy` file on the canvas | `N` |
| ![Pencil](https://img.shields.io/badge/-✎-gray?style=flat-square) | **Add Note** | Add a sticky note to the active canvas | — |
| ![Arrows](https://img.shields.io/badge/-⟲-gray?style=flat-square) | **Organize Layout** | Auto-layout blocks on the active canvas by story flow | — |
| ![Alert Circle](https://img.shields.io/badge/-⚠-gray?style=flat-square) | **Diagnostics** | Open the diagnostics panel (errors, warnings, info, tasks); shows a red badge when errors are present | — |
| ![Bar Chart](https://img.shields.io/badge/-▦-gray?style=flat-square) | **Stats** | Open the project statistics visualization | — |
| ![Layers](https://img.shields.io/badge/-⫶-gray?style=flat-square) | **Project Canvas** | Switch to the Project Canvas — bird's-eye view of script files | — |
| ![Network](https://img.shields.io/badge/-⬡-gray?style=flat-square) | **Flow Canvas** | Switch to the Flow Canvas — trace narrative flow | — |
| ![Grid](https://img.shields.io/badge/-⊞-gray?style=flat-square) | **Choices Canvas** | Switch to the Choices Canvas — player decision tree | — |
| ![Pencil](https://img.shields.io/badge/-✏-green?style=flat-square) + Toggle | **Drafting Mode** | Toggle placeholder images/audio for missing assets; green toggle = on | — |
| ![Play](https://img.shields.io/badge/-▶-green?style=flat-square) | **Run** | Launch the Ren'Py game as a child process (requires SDK path in Settings) | `F5` |
| ![Stop](https://img.shields.io/badge/-⏸-red?style=flat-square) | **Stop** | Stop the running game — replaces Run while the game is active | — |
| ![Save](https://img.shields.io/badge/-💾-gray?style=flat-square) | **Save All** | Save all unsaved changes to disk; button highlights when there are unsaved changes | `Ctrl+S` |
| ![Gear](https://img.shields.io/badge/-⚙-gray?style=flat-square) | **Settings** | Theme, editor font, SDK path, AI keys, mouse preferences | — |

---

*Ren'IDE — v0.7.1 Public Beta 4 (not yet released) · last release: v0.6.0 Public Beta 3*
