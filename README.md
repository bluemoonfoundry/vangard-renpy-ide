# Ren'IDE - the Ren'Py Visual Development Environment

Ren'Py Visual Novel Accelerator (Ren'IDE) is a visual IDE designed to streamline the development of Ren'Py visual novels. It features a node-based Story Canvas to visualize game flow, an integrated Monaco code editor, asset management panels, and tools for organizing and managing complex branching stories. This tool is aimed at writers, designers, and programmers who want a more intuitive and organized way to manage narrative projects.

**Demo video:** [Short video of initial beta](https://youtu.be/87wSuV8RESg)

> [!IMPORTANT]  
> Full disclosure: this application was developed with the help of Google's Gemini AI Code Builder.

---

## Key Features

- Visual Story Canvas: Drag, resize, and arrange blocks representing your `.rpy` files.
- Automatic Flow Visualization: Arrows between blocks for `jump` and `call` relationships.
- On-Demand Route Canvas: Generate a detailed label-by-label graph of your story's control flow (opt-in for large projects).
- Route Path Analysis & Highlighting: Analyze and highlight unique narrative paths.
- Integrated Code Editor: Monaco editor built-in for full editing capabilities.
- Project Management: File explorer for create/rename/move/delete operations.
- Story Element Management: Manage Characters, Variables, Images, Audio, Screens, and Snippets.
- Asset Pipeline: Scan and import images/audio from external directories.
- File System Integration: Works with local project folders for read/write.
- Theme Support & UI Persistence: Multiple themes and remembered UI state between sessions.
- Ren'Py Integration: Run the Ren'Py project from the app for quick testing.
- Scene Composer: Visual scene builder that generates Ren'Py transform and show/scene code.
- Snippets Library & Sticky Notes for project annotations.

(For component-level details, see the components directory: https://github.com/bluemoonfoundry/vangard-renpy-ide/tree/main/components)

---

## Download & Installation

Besides building from source, you can download ready-to-run release artifacts for your operating system:

- Latest release page (all OS downloads): https://github.com/bluemoonfoundry/vangard-renpy-ide/releases/tag/v0.3.0-alpha
- Windows: https://github.com/bluemoonfoundry/vangard-renpy-ide/releases/download/v0.3.0-alpha/renide-windows-v0.3.0-alpha.zip
- macOS: https://github.com/bluemoonfoundry/vangard-renpy-ide/releases/download/v0.3.0-alpha/renide-macos-v0.3.0-alpha.zip
- Linux (Ubuntu): https://github.com/bluemoonfoundry/vangard-renpy-ide/releases/download/v0.3.0-alpha/renide-ubuntu-v0.3.0-alpha.zip

How to install:
1. Download the appropriate `.zip` for your platform.
2. Unzip to a suitable folder.
3. Run the enclosed installer or executable and follow platform-specific instructions.
4. Go to the folder where you installed the application (or let the installer start the application as the last step) and double-click to get started
5. For instructions on using the application, see the [Usage Guide](#usage-guide) section below

Note: These downloads are from an ALPHA release intended for early testing and demonstration. Check the Releases page for the latest stable artifacts.

---

## Local Development Setup

This repository uses Vite, React, TypeScript, and TailwindCSS.

### Prerequisites

- Node.js (18.x or newer recommended)
- npm (bundled with Node.js)

### Running Locally

1. Clone the repository:
    ```bash
    git clone https://github.com/bluemoonfoundry/vangard-renpy-ide.git
    cd vangard-renpy-ide
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Run the development server:
    ```bash
    npm run dev
    ```
4. Open the local URL printed by Vite (typically http://localhost:5173).

---

## Usage Guide

This section expands usage guidance for major interactive features. It covers the Scene Composer and Editor Tabs in detail and includes practical tips and keyboard shortcuts.

### Starting Up

When you double-click the app, it will present you with the main window an welcome screen. You have the option of creating a blank project or opening an existing Ren'Py project folder. We find it's more straightfoward to use an existing, even if blank, Ren'Py project rather than creating a blank project in this application because you would need to create all the other Ren'Py folders yourself. 


### Main Interface Overview

The app is divided into three main areas:
- Project Explorer (left): file tree, file creation/rename/delete, and file operations.
- Main view (center): canvases and editors (Story Canvas, Route Canvas, Editor Tabs, Scene Composer).
- Story Elements (right): Characters, Variables, Images, Audio, Screens, Snippets.

Toolbar actions include Undo/Redo, Add Block, Tidy Layout, Analyze Routes, New/Open/Save, Toggle Sidebars, and Theme selection.

Shortcuts (examples — see in-app Keyboard Shortcuts modal for full list):
- New Block: N
- Save All: Ctrl/Cmd+S
- Undo/Redo: Ctrl/Cmd+Z / Ctrl/Cmd+Y
- Group: G / Ungroup: Shift+G
- Toggle Sidebars: (configurable)

---

### Story Canvas

- Visual representation where each block corresponds to an `.rpy` file.
- Blocks show labels, character summaries, and quick actions.
- Arrows show `jump`/`call` relationships; dotted lines show fall-through connections.
- Interactions: pan (Shift + drag), zoom (scroll), select (click / shift/ctrl for multi-select), move, resize.
- Double-click a block to open it in the Editor Tabs.

---

### Route Canvas

- On-demand, label-level graph generated by "Analyze Routes".
- Displays label-to-label connections, shows explicit jumps/calls and implicit fall-through edges.
- View Routes panel lists distinct paths; highlight routes using checkboxes; each route gets a unique color.

---

### Scene Composer

Purpose: visually compose a Ren'Py scene by layering backgrounds, sprites, overlays, and transforms — then generate the Ren'Py code required to reproduce that scene.

Key features:
- Layer-based UI: Background layer, Sprite layers (one per character/actor), UI/overlay layers, and an Effects layer.
- Drag & Drop assets: Drag images from the Images panel or Project Explorer onto a layer to add them to the scene.
- Positioning & Anchors: Move sprites using click-and-drag. Numeric position controls and preset anchors (center, left, right, top, bottom) are available for precise placement.
- Scale & Rotation: Adjust scale and rotation with handles or numeric inputs; supports snapping and constrained aspect ratio toggles.
- Z-order: Reorder layers to control draw order (bring forward/send backward).
- Transform Builder: Create named transforms (position/zoom/rotate/alpha) and preview them in the composer.
- Easing & Timing: Define time, transition/easing (linear, ease-in, ease-out), and chain multiple transforms for entrance/exit animations.
- Preview: Play a simple preview timeline inside the composer to see transforms and transitions.
- Export / Generate Code:
  - "Copy Transform" generates a Ren'Py transform block for the selected sprite(s).
  - "Generate Scene" generates a full scene snippet: scene statement, show statements with transforms, and optional Ren'Py screen or layer calls — copy-to-clipboard or insert into the open editor tab.
- Presets & Templates: Save commonly used transform presets and alignment templates for reuse across scenes.
- Asset Linking: Choose whether added assets are copied into the project or referenced from their source path (useful when scanning external folders).
- Accessibility: Snap-to-grid, numeric nudge, and precise property editing for pixel-perfect layouts.

Typical workflow:
1. Open Scene Composer from the Toolbar or Story Elements -> Images context menu.
2. Drag a background into the Background layer.
3. Drag character sprites into Sprite layers and position them.
4. Create transforms for entrance/idle/exit as needed, preview timeline.
5. Export the generated Ren'Py code into an editor tab or copy to clipboard.

---

### Editor Tabs

Ren'IDE embeds the Monaco editor to provide a full-featured editing experience integrated with the visual tools.

Core capabilities:
- Multiple Tabs: Open multiple `.rpy` files in tabs; each tab shows unsaved indicators and a path tooltip on hover.
- Tab Management: Right-click tab context menu for Close, Close Others, and Close All.
- Syntax Highlighting: Syntax coloring for Ren'Py/Python and support for common file types.
- Go-to Definition & Find Usages: Jump to label definitions and locate usages across the project (project-wide search integration).
- Find & Replace: Global and per-file find/replace with regex support and replace all.
- Snippets & Templates: Insert common Ren'Py code blocks (dialogue patterns, menus, screen templates) from the Snippets tab or inline completion.
- Live Preview Integration: When the project is configured with a local Ren'Py install, use the "Run" integration to start Ren'Py and reload changes where supported.
- Undo/Redo and History: Editor-level and workspace-level undo stacks; unsaved changes are preserved between sessions (when workspace supports saving).

Editor + Scene Composer integration:
- Insert generated code from Scene Composer directly into the active editor tab at the caret position.
- Click "Center on Canvas" from an open file's tab to locate the corresponding block on the Story Canvas.
- Quick actions in the editor (e.g., "Find Label Usages") highlight blocks on the Story Canvas for easier navigation.
- Jump from label to label, even across files, by ctrl-clicking on a label to trace routes across the project

Tips:
- Save frequently when the app is linked to a local project folder; the Save All toolbar button helps persist changes across tabs.

---

### Story Elements Panel (recap & quick reference)

- Characters: Add, edit, and find usages of Characters defined with `define`.
- Variables: Inspect and add global variables (`define`, `default`), find usages.
- Images: Scan `game/images/` and external directories, copy assets into the project, generate `scene`/`show` statements.
- Audio: Manage audio files, copy and generate `play`/`queue` statements.
- Screens: Jump to screen definitions, create new screen boilerplate.
- Snippets: Library of reusable Ren'Py code patterns; copy or insert into the editor.
- Menus: A choice menu builder to visually construct choice code, with option to copy the generated code and paste into the editor
---

### File Explorer & Context Menus

- Create, rename, move, delete files and folders. (Deleting will remove files from disk when project folder open)
- Cut/Copy/Paste support for reorganizing project structure.
- Right-click file -> Center on Canvas to locate the corresponding block.
- Upload .zip project support: import and extract as a new workspace (download changes when finished).

---

## Architecture & Technical Stack

- Frontend: React + TypeScript + Tailwind CSS, built with Vite.
- Editor: Monaco Editor for code editing features.
- Desktop: Electron entry points provided (`electron.js`, `preload.js`) for packaging into platform-specific installers.
- File access: Browser File System Access API for in-browser work and native filesystem for Electron builds.
- Components: Modular UI components for canvas, editors, managers, modals, and context menus placed in the `components/` directory.

---

## Contributing

Contributions are welcome. Please read the repository's CONTRIBUTING guidelines and CODE_OF_CONDUCT before opening issues or pull requests. For feature requests, bugs, or help, open an issue and include steps to reproduce, screenshots if applicable, and platform details.

---

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). See [LICENSE](https://github.com/bluemoonfoundry/vangard-renpy-ide/blob/main/LICENSE) for details.

---

## Notes

- This is an actively developing project; many features are in alpha or experimental state. Expect updates and breaking changes during early releases.
- If you rely on Ren'Py run integration, ensure you have a compatible Ren'Py installation and configure it via the Settings modal.
- For the most up-to-date downloads, visit the Releases page: https://github.com/bluemoonfoundry/vangard-renpy-ide/releases
