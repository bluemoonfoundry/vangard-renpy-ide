[![Build/Release](https://github.com/bluemoonfoundry/bmf-vangard-renpy-ide/actions/workflows/build.yml/badge.svg)](https://github.com/bluemoonfoundry/bmf-vangard-renpy-ide/actions/workflows/build.yml)
[![CodeQL](https://github.com/bluemoonfoundry/bmf-vangard-renpy-ide/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/bluemoonfoundry/bmf-vangard-renpy-ide/actions/workflows/github-code-scanning/codeql)
[![Latest Release](https://img.shields.io/github/v/release/bluemoonfoundry/bmf-vangard-renpy-ide?label=latest%20release&color=blue)](https://github.com/bluemoonfoundry/bmf-vangard-renpy-ide/releases/latest)
![Platform](https://img.shields.io/badge/platform-Windows_%7C_macOS_%7C_Linux-lightgrey)

# Vangard Studio : The Ren'Py Project Organizer

> **The IDE that lets you see your story.**

> _Formerly known as Ren'IDE._

Vangard Studio is a desktop IDE that helps you organize and manage your Ren'Py project as it grows. Built on a "code first" philosophy, it tracks your characters, variables, screens, and assets automatically, catches broken jumps and missing files before they bite you, and gives you a full Monaco code editor with Ren'Py-aware tooling to help you write better `.rpy` code — not write it for you. Visual tools for building scenes and image maps, translation and statistics dashboards, and three complementary canvases for seeing your project's structure, flow, and player experience are all built in.

## Getting Started 

**[Download the latest stable release](https://github.com/bluemoonfoundry/bmf-vangard-renpy-ide/releases/latest)**

**[Download the latest nightly release (bleeding edge, tread carefully!)](https://github.com/bluemoonfoundry/bmf-vangard-renpy-ide/releases/tag/nightly)**

---

<img width="1582" height="1030" alt="story_graph" src="https://github.com/user-attachments/assets/8150b09c-1c04-4d3f-9a1e-0845a5834567" />

<img width="1582" height="1030" alt="stats_pane" src="https://github.com/user-attachments/assets/29f9a3a4-ea28-457f-a817-50e8e9d5081c" />

<img width="2931" height="1958" alt="Screenshot 2026-08-16 235042" src="https://github.com/user-attachments/assets/47c0a0a9-faa5-4c1b-937b-8621c2efcd57" />

<img width="1582" height="1030" alt="file_graph" src="https://github.com/user-attachments/assets/1f57a679-4d4b-4358-a7d7-a42716ca0812" />




---

## Why Vangard Studio?

Managing a Ren'Py project in a plain text editor means juggling dozens of `.rpy` files with no way to see the whole picture. You lose track of where jumps lead, which characters appear in which scenes, and whether your branching structure even makes sense.

Vangard gives you that picture — and keeps it in sync as you write.

- **See your story's structure** at a glance
- **Navigate instantly** from a canvas node to the code behind it
- **Catch problems early** — broken jumps, missing assets, and unreachable labels flagged automatically


## Our Philosophy

Vangard Studio is built on the belief that developer tools should be transparent, stable, and empowering. We reject the "black box" approach to IDE design. Our project is governed by four core principles:

### 1. Code-First Sovereignty
Vangard Studio is a **code-first** environment. The code is the source of truth, you are simply editing your existing Ren'Py script in a (hopefully) more intuitive way. We do not maintain a hidden internal state or proprietary project format. If you make a change in the GUI, it updates your `.rpy` files directly; if you make a change in your text editor, Vangard Studio reflects it instantly. The code always dictates the visual, ensuring you are never fighting against your own project files.

### 2. No Vendor Lock-in
Your game is your property. Vangard Studio reads and writes standard Ren'Py script files. We do not use proprietary project containers or hidden metadata. You can open your project in Vangard Studio, switch to VS Code or any other text editor, and move back again at any time. You are never "trapped"; our IDE is just a tool that sits on top of your work, not a container for it.

### 3. Human-Crafted Code
We believe that for a developer to truly master Ren'Py, they need to own their logic. Vangard Studio is a tool for developers, not a code generator. The focus is on providing reliable editing features—like robust linting, intelligent autocompletion, and visual tooling—that help *you* write better Ren'Py. We believe the best games are built by developers who understand their own scripts.

### 4. Truly Open Source (AGPL)
Vangard Studio is a open-source, community-driven project licensed under the **AGPL**. This means there are no paid tiers, no "Pro" versions, and no subscription models. We have no investors or profit targets that would force us to compromise your workflow. We are building this tool for the community, by a member of the community.

---

## Features

### Story Elements

The right sidebar analyzes your entire project continuously, so your characters, variables, screens, and assets are always tracked and cross-referenced — no manual bookkeeping. Tabs are organized in a two-level layout — primary category tabs across the top, then sub-tabs within each category — for efficient use of vertical space.

| Category | Sub-tabs | What it shows |
|----------|----------|---------------|
| **Story Data** | Characters | All `define Character(...)` definitions — name, tag, color, dialogue count. Add, edit, find usages. |
| | Variables | All `define`/`default` globals. Find usages. |
| | Screens | All `screen` definitions. Jump to definition. Read-only — no visual builder. |
| **Assets** | Images | Image asset manager with thumbnails and folder tree. |
| | Audio | Audio asset manager with built-in player. |
| **Composers** | Scenes | Scene Composer — layer backgrounds and sprites, export PNG. |
| | ImageMaps | ImageMap Composer — draw hotspots, generate imagemap screen code. |
| **Tools** | Snippets | Grid-browsable snippet library with fuzzy search and category filters. Built-in snippets + user global + project-specific. |
| | Menus | Visual menu and choice designer with custom code block support. |
| | Colors | Color picker with four built-in palettes (Ren'Py Standard, HTML Named, Material 500, Pastel) and a live Project Theme palette scanned from your `.rpy` files. Insert at cursor, wrap in `{color}` tags, or copy hex. |

---

### Visual Composers

#### Scene Composer

Layer backgrounds and sprites on a stage. Per-sprite controls: zoom, flip, rotate, alpha, blur. **Visual Effects panel** with color grading (saturation, brightness, contrast, invert), color modes (tint, colorize), and categorized matrix presets (Night, Sunset, Sepia, Greyscale, Noir, Faded, Silhouette, etc.). Lock layers to prevent accidental edits. Inline layer actions (delete, make background) appear as hover-reveal icons on each layer row. Reorder layers by dragging. Configurable stage resolution (presets: 1920×1080, 1280×720, 1024×768, 800×600, or custom). Copy the generated `scene`/`show` Ren'Py code or export the composition as a PNG.

#### ImageMap Composer

Draw clickable hotspot rectangles over a ground image (with optional hover overlay). Each hotspot has a configurable action type (`jump` or `call`) and target label. Generates `imagebutton`/`imagemap` screen code ready to copy into your project. Ground and hover images are set by dragging from the Image Assets panel.

---

### Diagnostics

A dedicated panel surfaces issues across every file in the project, so problems surface before you run the game.

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

### Project Explorer & Search

- **Project Explorer** — file tree with create, rename, delete, cut/copy/paste, and drag-drop. Right-click an `.rpy` file → "Center on Canvas" to locate its block. **Refresh Project** option (File menu, context menu) reconciles all files and assets with disk state.
- **Project-wide Search & Replace** — full-text search with regex. Replace individually or bulk with confirmation.

---

### Translation Dashboard

A dedicated dashboard for tracking and managing Ren'Py translation coverage across every language in your project. Open it from the toolbar.

- **Language overview cards** — one card per detected language showing total strings, translated count, stale (untranslated-identical) count, and a completion percentage bar
- **File breakdown table** — sortable by file, total strings, translated, untranslated, stale, and completion percentage so you can focus effort where it matters
- **String-level view** — a virtual-scrolling list of every translatable string with its translation status. Filter by status (all / translated / untranslated / stale) and search by text
- **Generate translations** — trigger Ren'Py's translation scaffolding for a language directly from the dashboard (requires a valid SDK path in Settings)

The parser automatically detects languages from `tl/<language>/` directories, matches translated blocks back to source strings, and identifies stale translations where the translated text is identical to the source.

---

### Code Editor

A full Monaco editor (the VS Code engine) built right in, with Ren'Py-aware tooling designed to help you write your own code better, not write it for you. Split panes let you edit two files side by side. Drag tabs between panes — or drag a tab off the tab bar entirely (or right-click → **Pop Out to Window**) to detach it into its own movable window; any of the 16 tab types (editors, canvases, composers, panels) can pop out, stays live-synced with the main window, and redocks when its window closes.

- **TextMate syntax highlighting** — accurate, context-aware Ren'Py coloring with semantic token support for labels, variables, and screen references
- **Context-aware IntelliSense** — autocomplete for `jump`/`call` targets, `show`/`scene` images, character tags, screen names, and variables. Suggestions are automatically suppressed while the cursor is inside a quoted string (dialogue text, filenames), so typing prose is never interrupted by a keyword dump
- **Go to Definition** — `Ctrl+Click` a `jump`/`call` target to jump to its label definition
- **Dialogue Preview** — an inline "Player View" panel below the editor shows a mock Ren'Py textbox (or choice menu) that updates in real time as the cursor moves through dialogue lines
- **33 built-in Ren'Py snippets** with tab-stop placeholders
- **User-defined snippets** — create custom snippets with trigger prefixes that integrate with IntelliSense
- Cursor position (Ln/Col) in status bar

---

### Asset Managers

#### Image Assets

Browse all project images organized by folder, with visual thumbnails. Scan external directories without copying files in. Right-click any image to copy a `scene` or `show` statement directly to your clipboard. Drag images onto the Scene Composer stage. Double-click to manage Ren'Py tags and metadata.

#### Audio Assets

Same workflow for audio. Browse, scan external directories, and right-click to copy `play music`, `play sound`, or `queue audio` statements. **Custom audio player** with Web Audio API integration, 64-bar equalizer visualization (cyan→blue→violet gradient with peak dots and scanline overlay), and volume control.

---

### Three Canvases

Three ways to see your project's organization at a glance — not for building your story by dragging nodes, but for navigating and understanding a codebase that keeps growing. Every canvas can be panned and zoomed like a game camera by holding `W`/`A`/`S`/`D` (pan) and `Q`/`E` (zoom), scoped to whichever canvas is hovered or focused so a split view doesn't drive both panes at once, and automatically ignored while typing anywhere text is being entered.

#### Project Canvas

Your `.rpy` files as draggable blocks. `jump` and `call` connections auto-draw as arrows. Drag blocks to organize, click "Redraw" to auto-layout, or filter by character to focus on a single storyline. Role tinting colors blocks by which characters appear in them. A legend overlay explains arrow types and colors. Blocks with diagnostics display a colored outer glow — red for errors, amber for warnings — so problem areas are visible even when fully zoomed out.

Use `Ctrl+G` (or `Cmd+G`) to open the **Go-to-Label** command palette at any time. Type a label name and press `Enter` to jump directly to that node. The toolbox also has a persistent "Go to Label" search box for the same purpose. Both zoom the canvas in to at least 100% so the target is always clearly visible.

#### Flow Canvas

A label-by-label narrative flow graph. Every `label` becomes a node; every `jump`, `call`, and implicit fall-through becomes an edge. Highlight specific routes with distinct colors. Unreachable labels are flagged. Hover over menu nodes to inspect all choices and their destinations. Includes a "Go to Label" toolbox search and responds to the global `Ctrl+G` palette, with zoom-on-navigate consistent with the Project Canvas.

#### Choices Canvas

The player's view. Where the Flow Canvas shows code structure, the Choices Canvas shows the player experience. Menu nodes fan out to destinations via color-coded choice pills. Each pill shows the player-visible choice text and any `if` condition guard as a badge — so you can trace exactly what the player sees and where each choice leads, even when paths cross. Includes a "Go to Label" toolbox search and responds to the global `Ctrl+G` palette.

---

### Warp to Label

Jump straight into any point in your game without playing through from the start. Press `Ctrl+Shift+G` (or click the toolbar button) to open a label picker, select a target, and Vangard Studio launches the game at that label using Ren'Py's `--warp` flag.

Before warping, a **Variable Overrides** modal lets you set values for any `default` variables and interpolated text variables (like `[mc_name]`) that the game would normally set during earlier scenes. Vangard Studio writes a temporary `_ide_after_warp.rpy` that applies these overrides in Ren'Py's `after_warp` hook, then removes the file automatically when the game stops. If your project already defines its own `label after_warp`, the IDE detects it and avoids creating a conflicting label.

You can also warp from within the code editor — right-click a label line and choose **"Warp to here"** — or from any canvas node's context menu.

---

### More

- **New Project Wizard** — 3-step flow: name + location, resolution presets, theme + color picker. Generates a complete SDK-compatible Ren'Py project.
- **Markdown Preview** — double-click any `.md` file for GitHub-style rendered preview with toggle to Monaco edit mode.
- **First-run Tutorial** — a 6-step guided tour on first launch with SVG spotlight effects and keyboard navigation. Replay at any time via **Help → Show Tutorial**.
- **Bundled User Guide** — a complete HTML user guide ships with the app. Open it from **Help → User Guide** in the menu bar.
- **External File Change Detection** — detects when `.rpy` files are modified outside the app. Non-dirty files reload silently; dirty files show a persistent warning bar with Reload / Keep options.
- **Undo/Redo** — full history for canvas moves, block creation/deletion, and composition edits (`Ctrl+Z` / `Ctrl+Y`).
- **Drafting Mode** — adds placeholders for missing images and audio so the game runs during development.
- **Run Game** — launch Ren'Py as a child process directly from the toolbar (`F5` to run, `Shift+F5` to stop).
- **Sticky notes** — per-canvas markdown notes in 6 colors. Drag to reposition. Promote a note to a diagnostics task via its checkbox.
- **Character profile editor** — a dedicated editor view for each character with all Ren'Py `Character()` parameters: name/dialogue styling, text speed, CTC, window properties, and a free-form notes field.
- **Canvas minimap** — a toggle-able minimap overlay on each canvas showing your viewport position within the full graph.
- **Keyboard-accessible canvases** — Tab to move focus between blocks/nodes, Arrow keys for spatial navigation, Enter to open in editor, Escape to deselect. Every canvas element has an `aria-label` for screen readers (NVDA, VoiceOver, JAWS). Visible focus indicators for keyboard-only users.
- **12 Themes** — system, light, dark, solarized light/dark, colorful, colorful light, neon dark, ocean dark, candy light, forest light, synthwave.
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
| Run Project | `F5` |
| Stop Project | `Shift+F5` |
| Warp to Label | `Ctrl+Shift+G` |
| Search in Files | `Ctrl+Shift+F` |
| Go to Label | `Ctrl+G` / `Cmd+G` |
| Go to Definition | `Ctrl+Click` (in editor) |
| Settings | `Ctrl+,` |
| Keyboard Shortcuts | `Ctrl+/` |
| New Block | `N` |
| Group selected blocks | `G` |
| Pan canvas | `Shift+Drag` (configurable) or hold `W`/`A`/`S`/`D` |
| Zoom canvas | Mouse scroll or hold `Q`/`E` |
| Select multiple blocks | `Ctrl+Click` or rubber-band drag |
| Delete selected | `Delete` |
| Pop out tab to window | Drag tab off the tab bar, or right-click → Pop Out to Window |

---

## Getting Started

### Install (Recommended)

Go to the **[releases page](https://github.com/bluemoonfoundry/bmf-vangard-renpy-ide/releases/latest)** and download the appropriate package for your operating system.

#### Windows

**Download:** `Vangard_Studio_Windows_<version>.exe`

1. Run the installer executable
2. Follow the installation wizard
3. Launch Vangard Studio from the Start Menu or desktop shortcut

**⚠️ Security Warning:** Windows SmartScreen will show "Windows protected your PC" because the application is not code-signed. This is expected behavior for open-source software.

**To proceed:**
- Click **"More info"**
- Click **"Run anyway"**

The app is safe - Windows blocks it only because it doesn't have a commercial code-signing certificate ($300-400/year).

#### macOS

**Download:** `Vangard_Studio_macOS_<version>.dmg` (choose `macos-arm64` for Apple Silicon or `macos-intel` for Intel Macs)

1. Open the `.dmg` file
2. Drag **Vangard Studio.app** to your **Applications** folder
3. Launch from Applications

**⚠️ Security Warning:** macOS Gatekeeper will block unsigned applications on first launch. Vangard Studio releases are not code-signed or notarized (no Apple Developer Program membership) — this is a known, tracked limitation ([#61](https://github.com/bluemoonfoundry/bmf-vangard-renpy-ide/issues/61)), not a bug in the app itself.

**On macOS 15.1 and later, use the Terminal method below — it's the only one confirmed to work.** Apple tightened Gatekeeper's handling of unsigned apps in 15.1+; the right-click/System Settings bypasses that worked on older macOS versions may not reliably appear anymore.

**Method 1 (Terminal — required on macOS 15.1+):**
1. Drag **Vangard Studio.app** to Applications first
2. Open Terminal and run:
   ```
   xattr -r -d com.apple.quarantine "/Applications/Vangard Studio.app"
   ```
3. Launch Vangard Studio normally from Applications

**Method 2 (pre-15.1 only — try this first if you're on an older macOS version):**
1. Right-click (or Control+click) **Vangard Studio.app** in Applications
2. Select **"Open"** from the context menu
3. Click **"Open"** in the security dialog that appears

**Method 3 (System Settings, pre-15.1 only):**
1. Try to launch Vangard Studio normally (it will be blocked)
2. Go to **System Settings → Privacy & Security**
3. Scroll down to the **Security** section
4. Click **"Open Anyway"** next to the Vangard Studio message
5. Click **"Open"** in the confirmation dialog

After the first successful launch, macOS will remember your choice and allow the app to run normally.

#### Linux

**Two installation options available:**

##### Option 1: .deb Package (Recommended for Debian/Ubuntu)

**Download:** `Vangard_Studio_Linux_<version>.deb`

**Installation:**
```bash
# Install the package
sudo apt install ./Vangard_Studio_Linux_<version>.deb

# Launch from terminal
vangard-studio

# Or launch from your application menu
```

**Advantages:**
- ✅ No additional dependencies required
- ✅ Integrates with system menus and file associations
- ✅ Automatic updates via APT package manager
- ✅ Cleaner uninstallation (`sudo apt remove vangard-studio`)

**Best for:** Ubuntu, Debian, Linux Mint, Pop!_OS, elementary OS, and other Debian-based distributions

##### Option 2: AppImage (Universal - All Distros)

**Download:** `Vangard_Studio_Linux_<version>.AppImage`

**Method A: With FUSE (Traditional)**

Most modern Linux distributions don't include FUSE2 by default. Install it first:

```bash
# Ubuntu/Debian/Mint
sudo apt install libfuse2

# Fedora/RHEL
sudo dnf install fuse-libs

# Arch/Manjaro
sudo pacman -S fuse2

# openSUSE
sudo zypper install fuse
```

Then run the AppImage:
```bash
chmod +x Vangard_Studio_Linux_<version>.AppImage
./Vangard_Studio_Linux_<version>.AppImage
```

**Method B: Without FUSE (Extract Mode)**

If you don't want to install FUSE, use extract mode:

```bash
chmod +x Vangard_Studio_Linux_<version>.AppImage
./Vangard_Studio_Linux_<version>.AppImage --appimage-extract-and-run
```

This extracts the AppImage to a temporary directory each time it runs (slightly slower startup, but requires no system dependencies).

**Advantages:**
- ✅ Works on all Linux distributions (Fedora, Arch, openSUSE, etc.)
- ✅ No installation required - just download and run
- ✅ Portable - can run from USB drive or external storage
- ✅ Easy to test multiple versions side-by-side

**Best for:** Non-Debian distributions, portable installations, or users who prefer not to install packages system-wide

---

### First Launch

On first launch, Vangard Studio will prompt you to either:
1. **Open an existing Ren'Py project folder**, or
2. **Create a new project** using the 3-step wizard (name + location, resolution, theme + color)

You'll also be asked to locate your Ren'Py SDK installation directory in Settings (`Ctrl+,` or `Cmd+,`) to enable the Run Game and Warp to Label features.

---

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 18.x or newer
- npm (bundled with Node.js)

### Setup

```bash
git clone https://github.com/bluemoonfoundry/bmf-vangard-renpy-ide.git
cd bmf-vangard-renpy-ide
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
| ![Globe](https://img.shields.io/badge/-🌐-gray?style=flat-square) | **Translations** | Open the Translation Dashboard — coverage stats and string-level tracking per language | — |
| ![Bar Chart](https://img.shields.io/badge/-▦-gray?style=flat-square) | **Stats** | Open the project statistics visualization | — |
| ![Layers](https://img.shields.io/badge/-⫶-gray?style=flat-square) | **Project Canvas** | Switch to the Project Canvas — bird's-eye view of script files | — |
| ![Network](https://img.shields.io/badge/-⬡-gray?style=flat-square) | **Flow Canvas** | Switch to the Flow Canvas — trace narrative flow | — |
| ![Grid](https://img.shields.io/badge/-⊞-gray?style=flat-square) | **Choices Canvas** | Switch to the Choices Canvas — player decision tree | — |
| ![Pencil](https://img.shields.io/badge/-✏-green?style=flat-square) + Toggle | **Drafting Mode** | Toggle placeholder images/audio for missing assets; green toggle = on | — |
| ![Warp](https://img.shields.io/badge/-⤯-purple?style=flat-square) | **Warp to Label** | Jump into the game at a specific label with variable overrides | `Ctrl+Shift+G` |
| ![Play](https://img.shields.io/badge/-▶-green?style=flat-square) | **Run** | Launch the Ren'Py game as a child process (requires SDK path in Settings) | `F5` |
| ![Stop](https://img.shields.io/badge/-⏸-red?style=flat-square) | **Stop** | Stop the running game — replaces Run while the game is active | `Shift+F5` |
| ![Save](https://img.shields.io/badge/-💾-gray?style=flat-square) | **Save All** | Save all unsaved changes to disk; button highlights when there are unsaved changes | `Ctrl+S` |
| ![Gear](https://img.shields.io/badge/-⚙-gray?style=flat-square) | **Settings** | Theme, editor font, SDK path, mouse preferences | `Ctrl+,` |

---

*Vangard Studio — v1.1.1*
