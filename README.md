[![Build/Release](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/build.yml/badge.svg)](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/build.yml)
[![CodeQL](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/github-code-scanning/codeql)
![Version](https://img.shields.io/badge/version-0.7.0_Public_Beta_4-blue)
![Platform](https://img.shields.io/badge/platform-Windows_%7C_macOS_%7C_Linux-lightgrey)

# Vangard Ren'Py IDE

> **The IDE that lets you see your story.**

Vangard is a desktop IDE for Ren'Py visual novel development. Your `.rpy` files appear as draggable blocks on a visual canvas — `jump` and `call` connections auto-draw as arrows. Three canvases let you see your project from every angle: file structure, control flow, and the player's choice experience. A full Monaco code editor, three visual composers, asset managers, diagnostics, and AI generation are all built in.

It works **alongside** the Ren'Py SDK. Your `.rpy` files stay as `.rpy` files. No lock-in.

**[Download the latest release →](https://github.com/bluemoonfoundry/vangard-renpy-ide/releases/latest)**  
Windows (installer) · macOS (DMG) · Linux (AppImage) · **Free**

<img width="1973" height="1118" alt="Vangard Ren'Py IDE — Main View" src="https://github.com/user-attachments/assets/cf387ed7-2d2c-444b-9c40-3c1bea90c799" />

---

## Why Vangard?

Managing a Ren'Py project in a plain text editor means juggling dozens of `.rpy` files with no way to see the whole picture. You lose track of where jumps lead, which characters appear in which scenes, and whether your branching structure even makes sense.

Vangard gives you that picture — and keeps it in sync as you write.

- **See your story's structure** at a glance, without opening a single file
- **Navigate instantly** from a canvas node to the code behind it
- **Catch problems early** — broken jumps, missing assets, and unreachable labels flagged automatically
- **Compose visually** — build scenes, imagemaps, and screens with drag-and-drop, then copy the generated code

---

## Features

### Three Canvases

#### Story Canvas

Your `.rpy` files as draggable blocks. `jump` and `call` connections auto-draw as arrows. Drag blocks to organize, click "Tidy Up" to auto-layout, or filter by character to focus on a single storyline. Role tinting colors blocks by which characters appear in them. A legend overlay explains arrow types and colors.


<img width="2002" height="1281" alt="Screenshot 2026-04-09 134418" src="https://github.com/user-attachments/assets/1db35b01-858f-40e8-afb0-64407a03565c" />

#### Route Canvas

A label-by-label control flow graph. Every `label` becomes a node; every `jump`, `call`, and implicit fall-through becomes an edge. Highlight specific routes with distinct colors. Unreachable labels are flagged. Hover over menu nodes to inspect all choices and their destinations.

<img width="2002" height="1281" alt="Screenshot 2026-04-09 134430" src="https://github.com/user-attachments/assets/d9062eec-675b-4dbf-9079-e0f2ebf3a285" />

#### Choice Canvas

The writer's view. Where the Route Canvas shows code structure, the Choice Canvas shows the player experience. Menu nodes fan out to destinations via color-coded choice pills. Each pill shows the player-visible choice text and any `if` condition guard as a badge — so you can trace exactly what the player sees and where each choice leads, even when paths cross.


<img width="2017" height="1297" alt="Screenshot 2026-04-09 134448" src="https://github.com/user-attachments/assets/6be28ed9-3226-4892-b014-8d91458a42f9" />

---

### Code Editor

A full Monaco editor (the VS Code engine) built right in. Split panes let you edit two files side by side. Drag tabs between panes.

- **TextMate syntax highlighting** — accurate, context-aware Ren'Py coloring with semantic token support for labels, variables, and screen references
- **Context-aware IntelliSense** — autocomplete for `jump`/`call` targets, `show`/`scene` images, character tags, screen names, and variables
- **28+ built-in Ren'Py snippets** with tab-stop placeholders
- **User-defined snippets** — create custom snippets with trigger prefixes that integrate with IntelliSense
- Cursor position (Ln/Col) in status bar

<img width="1233" height="1007" alt="Code Editor — Split Pane" src="https://github.com/user-attachments/assets/1aa05b75-7a9a-4356-b6a4-5a4589491a4e" />

---

### Asset Managers

#### Image Assets

Browse all project images organized by folder, with visual thumbnails. Scan external directories without copying files in. Right-click any image to copy a `scene` or `show` statement directly to your clipboard. Drag images onto the Scene Composer stage or Screen Layout Composer. Double-click to manage Ren'Py tags and metadata.

<img width="308" height="1011" alt="Image Assets Panel" src="https://github.com/user-attachments/assets/ab645f13-d21a-4a26-aeb2-b91367fb9a13" />

<img width="1229" height="1001" alt="Image Viewer" src="https://github.com/user-attachments/assets/7c3360fb-484f-4be2-9d61-12c382ca6ef8" />

#### Audio Assets

Same workflow for audio. Browse, scan external directories, and right-click to copy `play music`, `play sound`, or `queue audio` statements. Built-in audio player.

<img width="311" height="1011" alt="Audio Assets Panel" src="https://github.com/user-attachments/assets/90623b20-6a20-4386-85e7-a49db27c2947" />

<img width="1537" height="1007" alt="Audio Viewer / Player" src="https://github.com/user-attachments/assets/893ff1a3-72c7-48c7-ad5d-db547a6885b6" />

---

### Visual Composers

#### Scene Composer

Layer backgrounds and sprites on a stage. Per-sprite controls: zoom, flip, rotate, alpha, blur. Reorder layers by dragging. Configurable stage resolution (presets: 1920×1080, 1280×720, 1024×768, 800×600, or custom). Copy the generated `scene`/`show` Ren'Py code or export the composition as a PNG.

<img width="1718" height="1001" alt="Scene Composer" src="https://github.com/user-attachments/assets/3dd84ee3-7eb6-4664-b93d-ada3690d039a" />

#### ImageMap Composer

Draw clickable hotspot rectangles over a ground image (with optional hover overlay). Each hotspot has a configurable action type (`jump` or `call`) and target label. Generates `imagebutton`/`imagemap` screen code ready to copy into your project. Ground and hover images are set by dragging from the Image Assets panel.

<img width="2004" height="1280" alt="Screenshot 2026-04-09 134836" src="https://github.com/user-attachments/assets/07aa6607-9774-4715-b35e-e5ae1cb4dc87" />

#### Screen Layout Composer

Build Ren'Py screens visually. Drag widgets (`vbox`, `hbox`, `frame`, `text`, `image`, `textbutton`, `button`, `imagebutton`, `bar`, `input`, `null`) onto the stage and nest them. Configure properties per widget. Generates ready-to-use `screen` code with copy-to-clipboard support. Existing screens can be viewed in read-only mode; duplicate to create an editable copy.

<img width="2005" height="1276" alt="Screenshot 2026-04-09 134942" src="https://github.com/user-attachments/assets/435bae88-4e7f-4361-9bd1-c2c6f7c14b60" />

---

### Story Elements

The right sidebar analyzes your entire project continuously.

| Tab | What it shows |
|-----|---------------|
| **Characters** | All `define Character(...)` definitions — name, tag, color, dialogue count. Add, edit, find usages. |
| **Variables** | All `define`/`default` globals. Find usages. |
| **Screens** | All `screen` definitions. Jump to definition. Add with boilerplate. |
| **Scenes** | Saved Scene Composer compositions. |
| **Composers** | All ImageMap + Screen Layout compositions. |
| **Snippets** | Library of Ren'Py code patterns. User snippets with custom trigger prefixes. |

<img width="299" height="998" alt="Characters" src="https://github.com/user-attachments/assets/3c87ba26-3da0-478f-a251-954d226ee703" />
<img width="309" height="1006" alt="Variables" src="https://github.com/user-attachments/assets/fa470bb0-b783-46de-a608-b7298483db57" />
<img width="306" height="1011" alt="Screens" src="https://github.com/user-attachments/assets/40e83b54-44b0-4207-888b-c9ebd11286da" />
<img width="310" height="1008" alt="Composers Tab" src="https://github.com/user-attachments/assets/5a45c071-9ca0-4fe7-94c1-8e92a1dfeec0" />

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

<img width="2001" height="1278" alt="Screenshot 2026-04-09 134751" src="https://github.com/user-attachments/assets/6bc492a7-7eb3-45c4-b7a5-d94ada5cdb92" />

---

### Project Statistics

Word counts, estimated play time, lines of dialogue, per-character dialogue breakdown (bar chart), scene and route counts, and branching complexity scores.


<img width="1992" height="1274" alt="Screenshot 2026-04-09 134804" src="https://github.com/user-attachments/assets/f0134184-e807-400c-8b63-5236450d6ca6" />

---

### More

- **Project Explorer** — file tree with create, rename, delete, cut/copy/paste, and drag-drop. Right-click an `.rpy` file → "Center on Canvas" to locate its block.
- **Project-wide Search & Replace** — full-text search with regex. Replace individually or bulk with confirmation.
- **New Project Wizard** — 3-step flow: name + location, resolution presets, theme + color picker. Generates a complete SDK-compatible Ren'Py project.
- **Markdown Preview** — double-click any `.md` file for GitHub-style rendered preview with toggle to Monaco edit mode.
- **AI Story Generator** — generate content with Google Gemini, OpenAI, or Anthropic. API keys stored encrypted via Electron's `safeStorage`.
- **Undo/Redo** — full history for canvas moves, block creation/deletion, and composition edits (`Ctrl+Z` / `Ctrl+Y`).
- **Drafting Mode** — adds placeholders for missing images and audio so the game runs during development.
- **Run Game** — launch Ren'Py as a child process directly from the toolbar.
- **10 Themes** — system, light, dark, solarized light/dark, colorful light/dark, neon dark, ocean dark, candy light, forest light.
- **Auto-updater** — checks for new releases on launch and prompts to install.
- **Cross-platform** — Windows (NSIS installer), macOS (DMG), Linux (AppImage).

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Save All | `Ctrl+S` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |
| New Block | `N` |
| Group selected blocks | `G` |
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

## Project Explorer

<img width="261" height="1019" alt="Project Explorer" src="https://github.com/user-attachments/assets/c3abdbb8-9606-4353-9e93-3239608b1249" />

---

## Toolbar Reference

<img width="1839" height="83" alt="Screenshot 2026-04-09 135204" src="https://github.com/user-attachments/assets/0d04dc9b-b9b6-42ed-b205-0b31536b6a03" />


| Button | Function | Shortcut |
|--------|----------|----------|
| **Undo / Redo** | Revert or re-apply canvas and editor changes | `Ctrl+Z` / `Ctrl+Y` |
| **Add Block** | Create a new blank `.rpy` file on the canvas | `N` |
| **Add Note** | Add a sticky note to the canvas | — |
| **Tidy Up** | Auto-layout blocks by story flow | — |
| **Analyze Routes** | Open the Route Canvas tab | — |
| **Drafting Mode** | Add placeholders for missing assets | — |
| **Run** | Launch Ren'Py game (requires SDK path in Settings) | — |
| **Save All** | Save all unsaved changes to disk | `Ctrl+S` |
| **Toggle Left** | Show/hide the Project Explorer sidebar | — |
| **Search** | Open project-wide search panel | — |
| **Toggle Right** | Show/hide the Story Elements sidebar | — |
| **Settings** | Theme, editor, SDK path, AI, mouse preferences | — |

---

*Vangard Ren'Py IDE — v0.7.0 Public Beta 4*
