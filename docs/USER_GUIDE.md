# Ren'IDE User Guide

**The Visual IDE for Ren'Py Development**

Version 0.7.1 Public Beta 4

---

# Table of Contents

## Part One: Guide

- Chapter 1: Welcome to Ren'IDE
- Chapter 2: Who This Is For
- Chapter 3: Getting Started
- Chapter 4: The Interface at a Glance
- Chapter 5: Seeing Your Story -- The Three Canvases
- Chapter 6: Writing Code
- Chapter 7: Managing Story Elements
- Chapter 8: Working with Assets
- Chapter 9: Visual Composers
- Chapter 10: Diagnostics and Quality
- Chapter 11: Testing Your Game
- Chapter 12: Translations
- Chapter 13: Project Tools
- Chapter 14: Customization

## Part Two: Reference

- Section 1: Toolbar Reference
- Section 2: Keyboard Shortcuts
- Section 3: Canvas Reference
- Section 4: Editor Reference
- Section 5: Story Elements Reference
- Section 6: Asset Manager Reference
- Section 7: Composer Reference
- Section 8: Diagnostics Reference
- Section 9: Settings Reference
- Section 10: File Formats
- Section 11: Troubleshooting and FAQ
- Section 12: Glossary

---

# Part One: Guide

---

## Chapter 1: Welcome to Ren'IDE

### What Is Ren'IDE?

Ren'IDE is a desktop application that turns your Ren'Py project into something you can *see*. Every `.rpy` file becomes a draggable block on a visual canvas; every `jump` and `call` becomes an arrow connecting those blocks. Instead of holding a sprawling narrative in your head, you hold it on screen -- the entire branching structure of your visual novel, laid out like a map. You write code in a full-featured editor (the same engine that powers Visual Studio Code), and the canvas updates in real time to reflect your changes.

But Ren'IDE is more than a pretty diagram. It is an integrated development environment built specifically for visual novels: a code editor with Ren'Py-aware autocomplete and diagnostics, visual composers for scenes and screen layouts, asset management for images and audio, and three distinct canvases that show your project from the file level, the label level, and the player's perspective. It runs on Windows, macOS, and Linux.

### The Problem

If you have built a visual novel of any size, you already know the pain. Your `game/`
folder fills up with dozens of `.rpy` files. You rename a label in one file and break a
`jump` in another. You define a character you never use. You lose track of which routes
reach an ending and which dead-end silently. An artist adds a batch of new sprites, but
nobody can tell which ones the script actually references. A writer restructures the
second act, and the programmer discovers three broken screen calls a week later during
QA.

Tracking these connections in a text editor is like trying to read a subway map printed
as a list of station names. You can technically derive the information, but the format
works against you.

Ren'IDE makes those connections visible. Broken jumps glow red on the canvas before you
ever launch the game. Unreachable labels are flagged automatically. Missing images and
undefined characters appear in a diagnostics panel you can click to jump straight to the
source. The goal is simple: catch structural problems early, navigate large projects
instantly, and give every team member -- writer, artist, programmer -- a shared picture of
how the story fits together.

### No Lock-In

Ren'IDE works *alongside* the Ren'Py SDK, not instead of it. Your `.rpy` files stay as
`.rpy` files. There is no proprietary format, no export step, no conversion. You can open
a Ren'IDE project in any text editor, and you can open any existing Ren'Py project in
Ren'IDE. The only files Ren'IDE adds to your project live in a `.renide/` directory
(canvas positions, IDE settings, snippets) that Ren'Py ignores completely.

This philosophy extends to every feature. The Scene Composer generates standard Ren'Py
`scene` and `show` statements. The Screen Layout Composer outputs valid `screen` code.
The Menu Constructor produces ordinary `menu:` blocks. Nothing is hidden behind a
proprietary runtime. If you decide to stop using Ren'IDE tomorrow, your project is
exactly the same set of `.rpy` files it always was.

You still need the Ren'Py SDK installed to run your game. Ren'IDE is the place where you
write, visualize, and debug -- then you press `F5` and the SDK launches your game as
usual.

### About This Guide

This guide is split into two parts.

**Part One** (the section you are reading now) is narrative: it walks you through each
major feature, explains why it matters, and shows you how it fits into a real visual
novel workflow. It is meant to be read from start to finish, though you can skip ahead to
whichever chapter interests you most.

**Part Two** is a dense reference: every toolbar button, every keyboard shortcut, every
setting, documented once for quick lookup. When you need to know the exact shortcut for
Warp to Label or the list of all diagnostic categories, Part Two is where you go.

If you are new to Ren'IDE, start here in Part One. If you already know the basics and
need a specific detail, jump to Part Two.

This document covers **version 0.7.1 Public Beta 4**. Some features may change in future
releases.

---

## Chapter 2: Who This Is For

Ren'IDE is designed for anyone developing visual novels with Ren'Py. The features span a
wide range -- from visual story mapping to low-level code editing -- so different people
will gravitate toward different parts of the tool. Here is how it fits into five common
roles.

### Writers

You are the person building the story: the branching paths, the character arcs, the
choices that make the player agonize. Your biggest challenge is not writing a single
scene -- it is keeping dozens of scenes, routes, and endings organized in your head.
Which label does the "forgive" choice jump to? Is there a path from the prologue to the
true ending that skips the side quest? Did you accidentally orphan an entire subplot when
you renamed that label last Tuesday?

Ren'IDE gives you visual answers. The **Project Canvas** shows every `.rpy` file as a
block with arrows drawn between them based on your `jump` and `call` statements. The
**Flow Canvas** goes deeper, showing every label as a node so you can trace specific
paths through the narrative. The **Choices Canvas** flips the perspective entirely,
showing what the *player* sees: the choice text, the conditions that hide or reveal
options, and where each decision leads. You will find these canvases covered in depth in
Chapter 5.

Beyond visualization, the sidebar's Characters tab tracks every character you have
defined -- their dialogue count, their color, everywhere they appear. The Menu Constructor
lets you design branching choices visually without writing `menu:` blocks by hand. And the
diagnostics system catches broken jumps and unreachable labels before you waste time
testing manually. See Chapters 5 and 6 for the full story.

### Artists

You work with images: character sprites, backgrounds, CGs, UI elements. Your challenge is
getting those assets into the game correctly -- making sure the right sprite appears at the
right position with the right transform, and that nothing is misspelled or missing. You
may not be comfortable writing Ren'Py code, but you still need a way to see how your art
fits into the project.

Ren'IDE's **Images tab** gives you a browsable, thumbnail-rich view of every image in
your project. You can scan external directories to reference assets without copying them
into the project folder. Right-click any image to copy a ready-made `scene` or `show`
statement to your clipboard. The **Scene Composer** goes further: drag backgrounds and
sprites onto a visual stage, adjust zoom, flip, rotation, and opacity, apply visual
effects like color grading and matrix presets (Sepia, Night, Noir, and more), then copy
the generated Ren'Py code into the script. The **Audio tab** offers the same workflow for
music and sound effects, complete with a custom audio player and visual equalizer.
Chapters 8 and 9 cover assets and composers in detail.

### Developers and Programmers

You are comfortable with code. You may be writing custom screens, managing variables, or
building the technical scaffolding that holds a complex visual novel together. You want a
proper code editor, not a toy -- and you want your tooling to understand Ren'Py
specifically, not just treat it as generic Python.

Ren'IDE's editor is powered by Monaco -- the same engine behind Visual Studio Code. You
get TextMate-grade syntax highlighting with a custom Ren'Py grammar, semantic token
overlays that color labels and characters differently depending on whether they are
defined or undefined, context-aware IntelliSense for `jump` targets and `show` images,
`Ctrl+Click` go-to-definition, split panes, and 28+ built-in code snippets with tab-stop
placeholders. The **Screen Layout Composer** lets you build Ren'Py screens by dragging
widgets onto a stage and generates the screen code for you. The **Diagnostics** panel is
your project-wide linter: it catches syntax errors, undefined references, and unused
definitions across every file simultaneously. See Chapters 6, 7, and 10 for the
technical details.

### Solo Creators

You are all three of the above, and probably a project manager too. The advantage of
Ren'IDE for you is consolidation. Instead of bouncing between a text editor, a file
manager, an image viewer, and a spreadsheet of TODOs, you have one window.

Write dialogue in the code editor. Check the canvas to see how the scene connects to the
rest of the story. Drag a sprite into the Scene Composer to prototype a shot. Run the
game with `F5`. Check the diagnostics panel to see what you forgot. Switch to the Stats
view to see your word count and estimated play time. All without leaving the application.
Every chapter in this guide is relevant to you.

### Teams

When multiple people work on the same visual novel, the biggest bottleneck is shared
understanding. The writer renames a label and the programmer's screen code breaks. The
artist adds sprites that nobody references in the script. Everyone has a different mental
model of how the story is structured, and those models diverge further every week.

Ren'IDE's canvas gives the team a shared visual language. The `.renide/` directory is
Git-friendly (JSON files with stable keys), so canvas positions and project settings
merge cleanly alongside your `.rpy` files. Every team member sees the same block layout,
the same arrows, the same diagnostic warnings. The writer can point to a block on the
canvas during a meeting and say "this scene needs a new background," and the artist knows
exactly where it fits in the story. Diagnostics catch cross-file problems -- a renamed
label, a missing image -- immediately, before they become merge-day surprises.

The project has been tested with 500+ files, so it scales to production-size visual
novels without performance issues.

---

## Chapter 3: Getting Started

### Installation

Ren'IDE runs on Windows, macOS, and Linux. No runtime dependencies are required for end
users -- just download and run.

#### Windows

Download the `.exe` installer from the releases page and run it. Windows may show a
**SmartScreen** warning because the application is not yet signed with an Extended
Validation certificate. This is a standard Windows security prompt for new software.
Click `More info`, then `Run anyway`. The installer will guide you through choosing an
installation directory and creating shortcuts. Once installed, launch Ren'IDE from the
Start menu or desktop shortcut.

#### macOS

Download the `.dmg` file, open it, and drag the Ren'IDE icon into your `Applications`
folder. On first launch, macOS **Gatekeeper** will block the app because it is from an
unidentified developer. To bypass this:

1. Right-click (or Control-click) the Ren'IDE app in your Applications folder.
2. Choose `Open` from the context menu.
3. Click `Open` in the confirmation dialog.

You only need to do this once. On subsequent launches, the app opens normally. If the
right-click method does not work on your macOS version, go to `System Settings` >
`Privacy & Security` and click `Open Anyway` next to the Ren'IDE entry.

#### Linux

Download the `.AppImage` file. Make it executable and run it:

```bash
chmod +x Vangard-RenPy-renide-*.AppImage
./Vangard-RenPy-renide-*.AppImage
```

AppImage requires **FUSE** to be installed on your system. On most modern distributions
it is already present. If you see an error about FUSE, install it via your package
manager:

- Debian/Ubuntu: `sudo apt install fuse`
- Fedora: `sudo dnf install fuse`
- Arch: `sudo pacman -S fuse2`

Optionally, you can integrate the AppImage with your desktop environment using a tool
like AppImageLauncher, which adds it to your application menu.

### First Launch and the Tutorial

The first time you open Ren'IDE with a project loaded, a **6-step interactive tutorial**
walks you through the interface. Each step highlights a region of the screen with a
spotlight overlay and explains what it does:

1. **Getting Started** -- points to the project menu and explains how to open or create a
   project.
2. **Three Canvas Types** -- highlights the canvas switcher in the center of the toolbar
   and introduces Project, Flow, and Choices canvases.
3. **Project Canvas** -- explains the main canvas view where your `.rpy` files appear as
   blocks.
4. **Create Scene** -- shows the `New Scene` button and mentions the `N` keyboard
   shortcut.
5. **Story Elements** -- points to the right sidebar where characters, assets, composers,
   and tools live.
6. **You're Ready** -- final tips, including the `Ctrl+G` / `Cmd+G` shortcut to jump to
   any label instantly.

Navigate the tutorial with arrow keys or `Enter`, and skip it at any time with `Escape`.
If you dismiss it and want to see it again later, go to `Help` > `Show Tutorial`. The
tutorial state is stored in your browser's local storage, so it only appears once per
machine unless you explicitly replay it.

### Opening an Existing Project

If you already have a Ren'Py project, open it from the welcome screen or via `File` >
`Open Project`. Browse to the project's root directory -- the folder that contains the
`game/` subdirectory. Ren'IDE will scan for all `.rpy` files, build the file tree in the
Project Explorer, and populate the Project Canvas with one block per file. Arrows
representing `jump` and `call` connections appear automatically.

The initial analysis takes a moment on large projects. You will see a loading overlay
with progress indicators while Ren'IDE parses every file, extracts labels and characters,
identifies connections, and runs diagnostics. Once complete, the canvas is fully
interactive.

Ren'IDE creates a `.renide/` directory inside your project folder to store canvas
positions (`project.json`), IDE settings (`ide-settings.json`), and user snippets
(`snippets.json`). This directory is safe to commit to version control -- it contains only
JSON files with stable, mergeable keys. Alternatively, add `.renide/` to your
`.gitignore` if you prefer each team member to maintain their own canvas layout.

### Creating a New Project

If you are starting from scratch and have the Ren'Py SDK path configured (see below),
click `New Project` on the welcome screen or use `File` > `New Project`. The **New
Project Wizard** walks you through three steps:

**Step 1: Name and Location.** Enter a project name and choose a parent directory.
Ren'IDE will create a subfolder with the project name. If you have created projects
before, the wizard remembers your last-used directory.

**Step 2: Resolution.** Pick a resolution preset for your game window:

- `1280x720 (HD)` -- the most common choice for visual novels
- `1920x1080 (Full HD)` -- for high-resolution displays
- `2560x1440 (2K)` and `3840x2160 (4K)` -- for very high-resolution projects
- `Custom` -- enter any width and height you need

This sets the `config.screen_width` and `config.screen_height` in your Ren'Py
configuration. You can change it later in the generated `gui.rpy` file.

**Step 3: Theme and Color.** Choose between a dark or light UI theme for your game's
default GUI, and pick an accent color from the provided swatches (10 dark-theme colors,
10 light-theme colors). These map to Ren'Py's built-in `gui.accent_color` and related
GUI settings.

Click `Create` and Ren'IDE invokes the Ren'Py SDK to generate a standard project
structure with all the default files (`script.rpy`, `options.rpy`, `gui.rpy`, `screens.rpy`,
etc.), then opens the project automatically. The generated project is fully
SDK-compatible -- you can open it in the Ren'Py launcher, another text editor, or share
it with teammates who use different tools.

### Configuring the Ren'Py SDK Path

Several features require the Ren'Py SDK to be installed on your machine:

- **Running your game** (`F5`) -- Ren'IDE launches the Ren'Py process as a child of the
  IDE, so you can start and stop the game without switching windows.
- **Creating new projects** -- the wizard uses the SDK's project generation.
- **Generating translation scaffolding** -- the Translation Dashboard needs the SDK to
  create `tl/` directories.
- **Warping to a label** -- the Warp feature writes a temporary hook file that the SDK
  picks up at launch.

To configure it, open `Settings` (`Ctrl+,` / `Cmd+,`) and set the **Ren'Py SDK Path** to
the root directory of your Ren'Py installation. On Windows, this is the folder containing
`renpy.exe`. On macOS and Linux, it is the folder containing `renpy.sh`. Ren'IDE
supports both Ren'Py 7.x and 8.x.

If you do not have the SDK installed, everything else in Ren'IDE still works -- the code
editor, the canvases, the diagnostics, the composers, the asset browser. You simply will
not be able to run the game or create new projects from the wizard.

### Building from Source

Most users will never need this section. But if you want to run Ren'IDE from source --
for contributing to development, customizing the tool, or building your own distributable
-- you need **Node.js 18+** and npm installed. Then:

```bash
git clone <repository-url>
cd bmf-vangard-renpy-ide
npm install
npm run electron:start    # Build and launch the full Electron app
```

For a development workflow with hot reload on code changes:

```bash
npm run dev               # Starts the Vite dev server at http://localhost:5173
```

To run the test suite: `npm test`. To produce a distributable package for your platform
(DMG on macOS, NSIS installer on Windows, AppImage on Linux): `npm run dist`. The output
appears in the `release/` directory.

---

## Chapter 4: The Interface at a Glance

When you open a project in Ren'IDE for the first time, the window arranges itself into
several clear regions. This chapter gives you a quick orientation so you know what
everything is called and where to find it. Later chapters explore each area in depth.

Think of this chapter as a labeled photograph. We will point to each region, name it, and
tell you enough to get started -- then move on.

### The Toolbar

The toolbar runs along the top of the window. It is divided into three logical sections.

**Left section** -- editing and canvas actions:
- `Undo` and `Redo` buttons (for canvas operations like moving blocks and creating
  scenes; the code editor has its own undo stack).
- `New Scene` -- creates a new `.rpy` file and block. The keyboard shortcut `N` does
  the same thing from the canvas.
- `Add Note` -- places a sticky note on the current canvas.
- `Organize Layout` -- opens a dropdown with four automatic layout algorithms.
- `Diagnostics` -- opens the diagnostics panel. When there are errors in your project, a
  red badge shows the count.
- `Translations` -- opens the Translation Dashboard.
- `Stats` -- opens the Project Statistics view.

**Center section** -- three canvas tabs: **Project Canvas**, **Flow Canvas**, and
**Choices Canvas**. Click a tab to switch the main view to that canvas. The currently
active tab is highlighted.

**Right section** -- run controls and settings:
- `Drafting Mode` toggle -- enables placeholder generation for missing assets so your
  game can run during development.
- `Warp to Label` -- launches the game and jumps directly to a specific label.
- `Run` / `Stop` -- starts or stops the Ren'Py game process. `Run` is `F5`; `Stop` is
  `Shift+F5`.
- `Save All` -- writes every unsaved file to disk at once (`Ctrl+S` / `Cmd+S`).
- `Settings` -- opens the settings modal for theme, font, SDK path, and other
  preferences.

A button-by-button reference for every toolbar item appears in Part Two. For now, just
know that the toolbar is your command center for project-wide actions that are not
specific to a single file or editor.

### The Project Explorer

The left sidebar is the **Project Explorer** -- a hierarchical file tree showing every
file and folder in your project. It works like the file explorer in any desktop IDE. You
can:

- Create new files and folders.
- Rename, delete, copy, cut, and paste files.
- Drag and drop files between folders.
- Right-click a `.rpy` file for context options like `Center on Canvas` (which pans the
  Project Canvas to that file's block) and `Open in Editor`.

The explorer also has a `Refresh Project` option (in its context menu and the `File`
menu) that reconciles the file tree with what is actually on disk. This is useful when
you have been editing or adding files outside of Ren'IDE -- for example, in a terminal or
another editor. The refresh detects new files, removed files, and externally modified
content, updating the IDE state to match reality.

### The Canvas Area

The large central region is the **canvas area**. This is where the visual representation
of your project lives. Which canvas you see depends on the tab selected in the toolbar:

- **Project Canvas** -- blocks representing `.rpy` files, with arrows for `jump`/`call`
  connections.
- **Flow Canvas** -- nodes representing individual labels, with edges for every control
  flow transition.
- **Choices Canvas** -- the player's decision tree, with color-coded choice pills.

You can pan the canvas by holding `Shift` and dragging (or by configuring your preferred
pan behavior in Settings). Zoom in and out with the mouse scroll wheel. Select items by
clicking, or drag a rubber-band rectangle to select multiple items at once. Hold `Ctrl`
(or `Cmd` on macOS) and click to add individual items to your selection.

When no canvas tab is active -- for example, when you have clicked into a code editor tab
or an asset viewer -- the canvas area shows that view instead. The canvas and the editor
share the same central space, switching based on which tab is focused.

### The Code Editor

Click any block on the Project Canvas (or double-click a `.rpy` file in the Project
Explorer) and a code editor tab opens in the central area. The editor is Monaco-based --
the same engine behind Visual Studio Code -- so you get the full suite of modern editor
features:

- Syntax highlighting tuned specifically for Ren'Py (TextMate grammar + semantic tokens).
- Context-aware autocomplete for labels, characters, images, screens, and variables.
- Find-and-replace with regex support.
- Multi-cursor editing and column selection.
- Code folding.
- Split panes (drag a tab to the edge of the editor to create a side-by-side layout).

You can have multiple files open in tabs simultaneously. Tabs are lazy-loaded on first
activation and stay mounted in the background to preserve your scroll position and cursor
state when you switch between them. Chapter 6 covers the editor in full depth.

### The Story Elements Sidebar

The right sidebar is called **Story Elements**. It uses a two-level tab layout: four
top-level categories, each containing related sub-tabs.

| Category | Sub-tabs |
|----------|----------|
| **Story Data** | Characters, Variables, Screens |
| **Assets** | Images, Audio |
| **Composers** | Scenes, ImageMaps, Screen Layouts |
| **Tools** | Snippets, Menus, Colors |

This is where you browse and manage everything beyond the code itself. The Characters
sub-tab lists every `define Character(...)` in your project. The Images sub-tab shows
thumbnails of your art assets. The Composers category opens visual editors for building
scenes, imagemaps, and screen layouts. The Tools category gives you access to your
snippet library, the menu constructor, and a color picker with multiple palettes.

Each sub-tab is covered in its relevant chapter later in the guide. For now, the key
point is that the Story Elements sidebar is always one click away on the right edge of
the window, and it organizes everything that is not source code into a logical hierarchy.

### The Status Bar

At the very bottom of the window, a thin status bar shows contextual information: the
current cursor position and selection range (when an editor is focused), the project
version, and occasional status messages like "Saving..." or "Saved." It is unobtrusive
by design -- a quick reference line you glance at rather than interact with.

---

## Chapter 5: Seeing Your Story -- The Three Canvases

The canvases are the heart of Ren'IDE. They take the invisible structure of your visual
novel -- the web of labels, jumps, calls, and choices buried across `.rpy` files -- and
make it something you can see, navigate, and rearrange. Each of the three canvases shows
your project from a different angle. Together, they answer the three fundamental questions
of visual novel development: *How are my files organized?* *How does the narrative flow?*
and *What does the player experience?*

### Project Canvas

The **Project Canvas** is what you see first when you open a project. Each `.rpy` file in
your `game/` directory appears as a rectangular block on the canvas. The blocks are
color-coded -- each block's color is deterministically derived from its title through a
string hash, so the same file always gets the same color, and different files get visually
distinct hues. This makes it easy to spot a particular file on a crowded canvas even
before you read its name.

#### Blocks and Arrows

When your code contains a `jump` or `call` statement that targets a label defined in a
different file, Ren'IDE draws an arrow from the source block to the target block. This
means you can *see* the connections between your script files without reading a single
line of code.

Consider this scenario. You have a file called `chapter1.rpy`:

```renpy
label chapter1_end:
    "The chapter draws to a close."
    jump chapter2_start
```

And a file called `chapter2.rpy`:

```renpy
label chapter2_start:
    "A new day begins."
```

On the Project Canvas, you will see an arrow drawn from the `chapter1` block to the
`chapter2` block, representing that `jump` connection. If you later rename
`chapter2_start` to `chapter2_intro` but forget to update the `jump` in `chapter1.rpy`,
the arrow disappears and the `chapter1` block begins to glow red -- a diagnostic warning
that a jump target does not exist. You found the bug in seconds, without running the
game.

#### Diagnostic Glow

Blocks on the Project Canvas glow to indicate problems in their underlying file:

- A **red glow** means the file contains at least one error-level diagnostic (such as a
  jump to a nonexistent label, a reference to a missing image, or a syntax error).
- An **amber glow** means there are warnings but no errors (such as an unused character
  definition or a potentially unreachable label).
- **No glow** means the file is clean.

This gives you an at-a-glance health check for your entire project. Open the Project
Canvas, scan for color -- any red or amber blocks need attention. You do not need to open
the diagnostics panel unless you want details.

#### Organizing the Canvas

You can drag blocks freely to arrange them however makes sense to you -- by chapter, by
route, by character involvement, or any scheme you like. Block positions are saved
automatically to `.renide/project.json`, so your layout persists between sessions.

When you want a quick automatic layout instead of manual positioning, click the
**Organize Layout** button in the toolbar. Ren'IDE offers four layout algorithms:

- **Flow (Left to Right)** -- arranges blocks in a left-to-right flow following jump
  connections. Good for linear or mostly-linear stories.
- **Flow (Top to Down)** -- the same logic, but oriented top to bottom. Some users
  find vertical flow easier to read for stories with many parallel branches.
- **Connected Components** -- groups blocks that are connected by jumps and calls into
  clusters, separating isolated parts of the project. Useful for projects with distinct
  arcs or standalone utility files.
- **Clustered Flow** -- combines flow direction with clustering, giving you both
  left-to-right ordering and visual grouping. The best default for complex projects.

Pick the algorithm that suits your project's shape. You can always drag blocks afterward
to fine-tune the result. Experiment freely -- `Ctrl+Z` / `Cmd+Z` undoes canvas layout
changes.

#### Character Filter and Role Tinting

Large projects might have dozens of blocks on screen at once, and not all of them are
relevant to what you are working on right now. The **character filter** helps you focus.
Select a character from the filter dropdown, and only the blocks containing dialogue for
that character remain fully visible; everything else fades into the background.

This is particularly useful when you are reviewing a specific character's arc across the
game. Select "Elena" and immediately see which files she appears in and how they connect
-- without the visual noise of the other 40 blocks.

**Role tinting** takes this a step further by coloring blocks according to which
characters appear in them. Instead of the default hash-derived colors, each block takes
on a tint based on its cast. This turns the canvas into a character map: you can see at a
glance which parts of the story feature which characters, and spot sections where a
character drops out of the narrative unexpectedly.

#### Groups

When you want to visually bundle related blocks -- say, all the files that belong to
"Chapter 3" or "Romance Route" -- select the blocks (rubber-band or `Ctrl+Click`) and
press `G`. This creates a **group**: a labeled rectangle drawn behind the selected blocks.

Groups are purely organizational. They do not affect your code, the analysis, or the
arrows. You can name groups, resize them, and recolor them. Drag the group header to move
all contained blocks at once, keeping the spatial relationship intact. This is helpful for
maintaining a neat canvas as your project grows.

#### The Legend

If you are ever unsure what a particular arrow color or style means, toggle the **legend
overlay** on the canvas. It shows a visual key explaining the different arrow types (jump
vs. call), what the glow colors mean, and any other visual conventions. Think of it as
the key in the corner of a map.

### Flow Canvas

The **Flow Canvas** shifts the granularity from files to labels. Instead of one block per
`.rpy` file, you see one node per `label` statement in your entire project. Every `jump`,
`call`, and fall-through between labels becomes a visible edge. This is the narrative flow
of your visual novel, drawn as a directed graph.

The distinction matters. A single `.rpy` file might contain five labels. On the Project
Canvas, all five are represented by one block. On the Flow Canvas, each label is its own
node with its own connections. This finer granularity lets you trace the exact path a
player takes through the narrative.

#### Edge Types

The edges use visual styling to distinguish connection types:

- **Solid lines** represent `jump` statements. Execution moves from one label to another
  and does not return. In narrative terms, the player has permanently left the source
  scene.
- **Dashed lines** represent `call` statements. Execution moves to the target label but
  will return to the caller when it hits a `return` statement. This is common for
  reusable scenes like flashbacks or minigames.
- **Dotted lines** represent fall-throughs -- cases where one label ends without a `jump`
  or `return`, and execution simply continues to the next label defined below it in the
  same file.

Understanding these edge types at a glance saves you from having to read the code. When
you see a cluster of dashed lines converging on a single node, you know that node is a
shared subroutine called from multiple places. When you see a chain of dotted lines, you
know those labels are sequential within the same file.

#### Unreachable Labels

If the analysis determines that a label cannot be reached from any other label -- no
`jump`, `call`, or fall-through leads to it -- the Flow Canvas flags it visually. These
unreachable labels often indicate dead code: a scene you wrote but forgot to connect, a
label you renamed without updating all the references, or an old branch you meant to
delete.

The diagnostics panel lists unreachable labels too, but seeing them on the canvas makes
the problem spatially obvious. The orphaned node sits alone, unconnected, while the rest
of the graph is woven together.

#### Menu Nodes

When your code contains a `menu:` block with player choices, the Flow Canvas represents
it as a special **menu node** distinct from ordinary label nodes. Hover over a menu node
and the **Menu Inspector** popover appears, showing:

- Every choice in the menu.
- The label each choice jumps or calls to.
- Any `if` conditions that guard the choice (making it conditional on game state).

For example, given this code:

```renpy
label confrontation:
    "You stare at the letter in your hands."

    menu:
        "Tell the truth":
            jump confession
        "Stay silent" if has_secret:
            jump silence
        "Change the subject":
            jump deflection
```

The Flow Canvas shows a menu node for `confrontation` with three outgoing edges. The
popover reveals the choice text for each edge, and "Stay silent" is annotated with its
`if has_secret` condition. You can see the branching logic without opening the file.

#### Route Highlighting

Complex visual novels have many interleaving routes -- a romance path, a friendship path,
a rivalry path, each weaving through shared and unique scenes. The Flow Canvas can
highlight specific **routes** in distinct colors. Open the route panel, select a route,
and the nodes and edges that belong to it light up while everything else dims.

This is invaluable for verification. You can trace a single route from start to finish
and confirm it reaches a proper ending, without being distracted by the nodes that belong
to other paths. Switch to a different route and a different color highlights a different
path through the same graph.

#### Node Badges

Each node on the Flow Canvas carries a small **role badge** indicating its structural
function in the narrative:

- **Start** -- a label that serves as an entry point (typically `label start` or a label
  explicitly identified as a route beginning).
- **End** -- a label that contains a `return` statement or ends the game.
- **Choice** -- a label that contains a `menu:` block offering player decisions.
- **Decision** -- a label that branches based on conditional logic (Python `if` blocks
  with `jump` statements), without presenting a visible choice to the player.
- **Story** -- a standard narrative label with no special structural role.

These badges let you scan the graph quickly and identify the decision points, the
endpoints, and the spine of the narrative. When you are debugging a path that seems to
skip an ending, look for nodes with the End badge and check whether any route actually
reaches them.

### Choices Canvas

The **Choices Canvas** answers the question that matters most to your players: *What will
I see?*

Where the Flow Canvas shows code-level structure -- every label, every control flow edge,
every implementation detail -- the Choices Canvas strips away the implementation and shows
only what the player encounters. Menu nodes fan out into color-coded **choice pills**,
each displaying the exact text the player will read.

If a choice has an `if` condition guard, it appears as a small badge on the pill. This
tells you at a glance which options are always available and which depend on game state.
For example, a pill reading "Confront the villain" with a badge `if courage >= 5` makes
it clear that this option is conditional -- the player needs enough courage points to see
it.

The choice pills use a rotation of six colors to distinguish branches visually. As you
follow the pills across the canvas, you are tracing the player's decision tree -- not the
developer's label graph. This view is particularly useful during playtesting discussions
("if the player picks option A at this fork, where do they end up three choices later?")
and for writers who want to verify that every path offers meaningful decisions rather than
illusory ones.

The difference between the Flow Canvas and the Choices Canvas is perspective. The Flow
Canvas is for developers who need to understand the code. The Choices Canvas is for
storytellers who need to understand the experience.

### Shared Canvas Features

All three canvases share a set of navigation, annotation, and accessibility tools. These
work identically regardless of which canvas is active.

#### Go-to-Label Palette

Press `Ctrl+G` (Windows/Linux) or `Cmd+G` (macOS) from any canvas to open the
**Go-to-Label** command palette. A search field appears at the top of the screen. Start
typing a label name and the palette filters results with fuzzy matching -- you do not need
to type the full name, just enough characters to narrow it down.

Select a label from the results and the canvas pans and zooms to center it on screen,
automatically setting the zoom level to 100% so you can read the details. On the Flow and
Choices canvases, it highlights the target node. On the Project Canvas, it centers the
block that contains the label.

This is the fastest way to navigate a large project. Instead of scrolling and searching
visually across a canvas with hundreds of nodes, you type a few characters and arrive
instantly.

#### Toolbox Label Search

Each canvas also has a persistent search box in the **Canvas Toolbox** (a floating panel
at the edge of the canvas that you can toggle on and off). This works like Go-to-Label
but stays open, letting you search and jump repeatedly without reopening a modal each
time. It is useful when you are actively tracing a path through the story and need to hop
between labels in quick succession.

#### Sticky Notes

Click the `Add Note` button in the toolbar (or right-click the canvas background and
choose `Add Note`) to place a **sticky note** on the canvas. Notes come in six colors --
yellow, blue, green, pink, purple, and red -- and support Markdown formatting in their
content. Use them however you like:

- "TODO: add CG for the sunset scene here"
- "This route needs a third ending before the beta"
- "Reviewed by Sarah, April 15 -- dialogue approved"

Each canvas maintains its own set of sticky notes, so your Project Canvas annotations do
not clutter the Flow Canvas. Drag notes to reposition them. Resize them if you need more
space.

If a note represents actual work to be done, check the **Promote to task** checkbox to
convert it into a **diagnostics task** that appears in the Diagnostics panel alongside
your code issues. This bridges the gap between informal canvas annotations and a
trackable task list that the whole team can see.

#### Canvas Minimap

Toggle the **minimap** to show a small overview of the entire canvas in the corner of the
screen. The minimap displays a shaded rectangle representing your current viewport
position, so you always know where you are relative to the full project. Click or drag on
the minimap to jump to a different region instantly. This is especially useful on large
projects where the canvas extends far beyond a single screen.

#### Keyboard Navigation and Accessibility

All three canvases are fully navigable by keyboard, which matters both for efficiency and
for accessibility:

- `Tab` moves focus to the next block or node. `Shift+Tab` moves backward.
- Arrow keys navigate spatially: press `Right` to move focus to the nearest block to the
  right, `Down` to move to the nearest block below, and so on.
- `Enter` opens the focused block in the code editor.
- `Escape` deselects the current selection.

Every block and node carries ARIA labels describing its content, connections, and
diagnostic state. Users of screen readers (NVDA, VoiceOver, JAWS) can navigate the canvas
and understand the story structure without relying on visual cues alone. The canvas
announces block names, connection counts, and diagnostic summaries as focus moves.

#### Fit-to-Screen, Go-to-Start, and Auto-Center

The canvas navigation controls (available in the floating toolbox and via keyboard
shortcuts) include three quick-navigation actions:

- **Fit-to-Screen** -- zooms out and pans to show every block or node on the canvas
  within the current viewport. Useful when you have been zoomed into one corner and want
  to see the big picture again.
- **Go-to-Start** -- pans directly to the `label start` node (or the entry point of
  your project). One click to return to the beginning.
- **Auto-Center** -- centers the viewport on the currently selected block or node,
  adjusting zoom if needed.

These are small conveniences that add up over a long editing session. When you are deep in
a corner of a 200-block canvas and need to jump back to the beginning, `Go-to-Start`
saves you from scrolling blindly through the graph.

## Chapter 6: Writing Code

Ren'IDE is built around a professional code editor. Not a stripped-down textarea, not a "good enough" embedded widget -- the actual Monaco editor, the same engine that powers Visual Studio Code. If you have ever used VS Code, the editing experience will feel immediately familiar. If you have not, you are about to discover why millions of developers swear by it.

### The Monaco Editor

Every `.rpy` file you open lands in a full Monaco editing surface. You get line numbers, a scrollable minimap on the right margin, and all the small refinements you would expect from a mature code editor: auto-indentation that respects Ren'Py's whitespace rules, bracket matching for parentheses and curly braces in Python blocks, code folding on `label`, `screen`, `init`, `if/elif/else`, and `menu` blocks, plus multi-cursor editing (`Alt+Click` to place additional cursors, `Ctrl+D` / `Cmd+D` to select the next occurrence of a word).

None of these features require configuration. They work from the moment you open your first file.

### Split Panes

When you are cross-referencing two files -- say, writing a scene in `chapter3.rpy` while checking your character definitions in `characters.rpy` -- you can split the editor into two side-by-side panes. Drag any editor tab toward the left or right edge of the editing area and the IDE will offer a split drop target. Release the tab, and now both files are visible simultaneously.

You can drag tabs freely between panes, close either pane independently, and resize them by dragging the divider. This is especially useful when a scene references images or labels defined elsewhere -- you can keep the definition visible in one pane while writing the scene in the other.

### Syntax Highlighting

Ren'IDE provides two layers of syntax coloring that work together.

The first layer is **TextMate grammar tokenization**. This is the same technology VS Code uses for its syntax highlighting. Ren'IDE ships a custom `renpy.tmLanguage.json` grammar that tokenizes Ren'Py keywords, strings, comments, Python expressions, ATL blocks, and screen language constructs. The grammar is parsed using Oniguruma (loaded as a WebAssembly module for performance), so even complex nested constructs -- triple-quoted strings inside `init python` blocks, for instance -- are colored correctly.

The second layer is **semantic token overlays**. While TextMate tokenization colors syntax structurally (it knows a word after `jump` is probably a label), semantic tokens use your project's live analysis data to color things by meaning. There are nine semantic token types:

- **Labels** (known) -- label names after `jump` or `call` that exist somewhere in your project
- **Labels** (undefined) -- label targets that do not match any defined label, typically highlighted in a warning color
- **Characters** (known) -- character tags in dialogue lines that match a `define` statement
- **Characters** (unknown) -- character tags that have no corresponding definition
- **Images** (known and unknown) -- image names after `show`, `scene`, or `hide`
- **Screens** (known and unknown) -- screen names after `call screen` or `show screen`
- **Variables** -- recognized `define`/`default` variable names in `$` expressions

The practical result: when you type `jump cafe_scene` and `cafe_scene` does not exist yet, the label name appears in a distinct "undefined" color. The moment you create that label somewhere in your project, the color changes to the "known label" styling -- no save required, no manual refresh. The analysis runs continuously in the background.

### IntelliSense

As you type, Ren'IDE offers context-aware autocomplete suggestions -- what Monaco calls **IntelliSense**. The completions are not generic; they are drawn from your project's live analysis results.

The completion provider detects what you are writing and adjusts its suggestions accordingly:

- After `jump` or `call`, it suggests all known label names in your project
- After `show`, `scene`, or `hide`, it suggests defined image names
- After `call screen` or `show screen`, it suggests screen names along with their parameters
- At the start of a dialogue line, it suggests character tags
- Inside `$` expressions or Python blocks, it suggests `define`/`default` variable names
- For general editing, it suggests Ren'Py keywords and your custom snippets

Each suggestion includes a detail annotation (the label's file, the character's display name, the variable's initial value) so you can distinguish between similarly named items. Type a few characters and press `Tab` or `Enter` to accept a suggestion.

### Go to Definition

Hold `Ctrl` (or `Cmd` on macOS) and click on a label name, character tag, or screen reference, and the editor will jump directly to where that symbol is defined -- even if the definition lives in a different `.rpy` file. Ren'IDE opens the target file in a new editor tab (or switches to it if already open) and scrolls to the exact line.

This works for:

- **Labels**: `Ctrl+Click` on `jump cafe_scene` takes you to `label cafe_scene:`
- **Characters**: `Ctrl+Click` on a character tag in a dialogue line takes you to the `define` statement
- **Screens**: `Ctrl+Click` on a screen name takes you to the `screen` definition

For large projects with dozens of files, this one feature can save you hours of manual searching.

### Dialogue Preview

Below the code editor sits a collapsible panel called **Dialogue Preview** (labeled "Player View" in the interface). This is one of Ren'IDE's most distinctive features.

As you move your cursor through dialogue lines, the preview panel renders a mock Ren'Py textbox showing exactly what the player would see. The character's name appears in a colored badge (using their defined color), and the dialogue text is rendered with Ren'Py text tag formatting -- `{b}bold{/b}`, `{i}italic{/i}`, `{color=#ff0000}colored text{/color}`, even `{s}strikethrough{/s}`. Variable interpolations like `[player_name]` appear as dimmed placeholder brackets so you can see where dynamic text will be inserted.

When your cursor is inside a `menu:` block, the preview switches to a **Choice Preview** that shows the menu prompt and all available choices as clickable-looking buttons. Conditional guards (`if has_key`) appear as small annotations beside each choice, and jump destinations are shown with an arrow indicator.

This means you can proofread your dialogue, check text tag formatting, and verify menu layouts without launching the game. For visual novel writing, where the presentation of text is as important as the words themselves, this is a significant time saver.

Toggle the preview panel open or closed by clicking its header bar. It remembers its state per session.

### Snippets

Ren'IDE ships with **28+ built-in code snippets** covering the most common Ren'Py patterns. Snippets are reusable code templates with tab-stop placeholders -- type a trigger prefix, select the snippet from the IntelliSense menu, and then press `Tab` to jump between placeholder fields and fill in your specific values.

For example, typing `menu` in the editor triggers a snippet that expands to:

```renpy
menu:
    "What should I do?"
    "Go to the park.":
        jump park_scene
    "Stay home.":
        jump home_scene
```

The cursor lands on the first placeholder (the menu prompt text). Type your prompt, press `Tab`, and the cursor jumps to the first choice text. Continue tabbing through each placeholder until the snippet is fully customized.

Built-in snippets are organized into categories:

- **Dialogue & Narration** -- standard dialogue, narration, NVL mode, dialogue with attributes
- **Logic & Control Flow** -- if/else, choice menus, jumps, calls
- **Images** -- show, scene, hide with transitions
- **Audio** -- play music, play sound, queue audio, stop/fadeout
- **Variables** -- define, default, Python assignments
- **Screens** -- screen definitions, common UI patterns

Snippets also appear in the `Story Elements` sidebar under the `Snippets` tab (covered in Chapter 7), where you can browse the full library visually. You can define your own custom snippets too -- the brief version is that user-defined snippets use `${1:placeholder}` syntax for tab stops and are stored in `.renide/snippets.json` within your project folder. Chapter 7 covers the details.

### Project-wide Search and Replace

Press `Ctrl+Shift+F` (`Cmd+Shift+F` on macOS) to open the **Project-wide Search** panel. This searches across every file in your project using a fast ripgrep-backed engine.

The search panel offers several options:

- **Match Case** -- distinguish between `Eileen` and `eileen`
- **Whole Word** -- match `end` without matching `ending` or `friend`
- **Regex** -- use regular expressions for complex pattern matching (e.g., `jump\s+chapter_\d+` to find all numbered chapter jumps)

Results appear grouped by file, with matching text highlighted in context. Click any result to jump directly to that line in the editor.

For replacement, type your replacement text and choose between replacing one occurrence at a time (with a preview of each change) or replacing all matches in bulk. Bulk replacement asks for confirmation before modifying files, so you will not accidentally rewrite your entire project. The search panel also remembers your recent queries, so repeating a previous search is just a click away.

---

## Chapter 7: Managing Story Elements

The **Story Elements** sidebar is your command center for everything that makes up your visual novel beyond raw code. It lives on the right side of the IDE and uses a two-level tab layout: a row of icon tabs across the top selects the category, and within each category you find the relevant tools and data.

The categories and their sub-tabs are:

| Category | Sub-tabs |
|----------|----------|
| Story Data | Characters, Variables, Screens |
| Assets | Images, Audio |
| Composers | Scenes, ImageMaps, Screen Layouts |
| Tools | Snippets, Menus, Colors |

We will cover Assets in Chapter 8 and Composers in Chapter 9. This chapter focuses on Story Data and Tools.

### Characters

The **Characters** tab shows every character defined in your project -- every `define` statement that creates a `Character()` object. Each entry displays the character's tag (the variable name you use in code, like `e`), their display name (like `"Eileen"`), their assigned color as a small swatch, and a count of how many dialogue lines they have across the project.

From here you can:

- **Add a new character** using the `+ New` button, which opens a form for the tag, display name, and color
- **Edit a character** by clicking their entry, which opens the Character Profile Editor
- **Find usages** to see every file and line where the character speaks or is referenced

#### The Character Profile Editor

Click on any character to open their dedicated **Character Profile Editor** as a full tab. This is far more than a name-and-color picker. It exposes every parameter that Ren'Py's `Character()` constructor accepts:

**Basic properties**: tag, display name, name color, and an optional character image (searchable from your project's imported images).

**Dialogue styling**: you can override the dialogue text color separately from the name color. If your character is a ghost who speaks in pale blue text, set `what_color` here rather than wrapping every line in `{color}` tags.

**Text formatting**: the `who_prefix` and `who_suffix` fields let you add characters around the speaker name (e.g., setting `who_suffix` to `":"` makes the name display as `Eileen:` in the textbox). Similarly, `what_prefix` and `what_suffix` wrap the dialogue text.

**Slow text**: enable the `slow` toggle to make this character's dialogue appear letter by letter. Set `slow_speed` to control how many characters per second appear, and `slow_abortable` to let the player click to skip the animation.

**Click-to-Continue (CTC)**: specify a displayable for the "click to continue" indicator and choose whether it appears nestled at the end of the text or at a fixed screen position.

All changes made in the Character Profile Editor update the corresponding `define` statement in your `.rpy` file. You do not need to hand-edit the code -- the IDE writes it for you.

### Variables

The **Variables** tab lists every `define` and `default` statement in your project. Each entry shows the variable name, its initial value, and which file it is defined in.

Click `Find Usages` on any variable to see everywhere it appears across your project -- assignments, conditionals, dialogue interpolations. This is invaluable for tracking game state. If you have a variable called `affection_points` and you want to make sure it is being incremented in all the right places, the usage search gives you a complete picture.

You can also add new variables directly from this tab, which generates the appropriate `define` or `default` statement in the target file.

### Screens

The **Screens** tab lists all `screen` definitions found across your project. Each entry shows the screen name and its source file. Click any screen to jump directly to its definition in the code editor.

The `+ New` button creates a new screen with boilerplate code -- a minimal `screen` block with a `frame` and `vbox` to get you started. This saves you from remembering the exact syntax every time.

### The Snippets Tab

The **Snippets** tab in the Tools category provides a visual, grid-based browser for the full snippet library. Where the editor's IntelliSense shows snippets one at a time as you type, this tab lets you explore the entire collection.

At the top of the tab, **category filter chips** let you narrow the display: click `Logic & Control Flow` to see only branching and flow snippets, or `Audio` to see only music and sound patterns. A **search box** with fuzzy matching lets you find snippets by title, description, or even code content -- type "fade" and you will see every snippet that involves a fade transition.

Each snippet card shows its title, a brief description, and an expandable code preview. Click a card to expand it and see the full code. A copy button on each card puts the code on your clipboard, ready to paste into your editor.

#### User-Defined Snippets

Below the built-in library, the `My Snippets` section shows your custom snippets. Click `+ New` to create one. The creation form asks for:

- **Title** -- a descriptive name like "Chapter Header with BGM"
- **Prefix** -- the trigger text for IntelliSense (e.g., `chapterbgm`)
- **Description** -- a brief explanation shown in the IntelliSense tooltip
- **Code** -- the snippet body, which supports tab-stop placeholder syntax

Placeholder syntax uses the Monaco snippet format:

```
label ${1:label_name}:
    scene ${2:bg_image}
    play music "${3:track.ogg}" fadein ${4:1.0}
    "${5:Opening narration goes here.}"
    $0
```

`${1:label_name}` is the first tab stop with default text "label_name". `${2:bg_image}` is the second, and so on. `$0` marks where the cursor lands after all placeholders have been filled. When you trigger this snippet in the editor, you tab through each field in order.

User snippets are saved to `.renide/snippets.json` within your project folder, so they travel with the project. The snippet manager also supports editing and deleting existing custom snippets.

### The Menu Designer

The **Menus** tab houses the **Menu Constructor**, a visual tool for building Ren'Py `menu:` blocks without writing them by hand.

The constructor starts with a caption field (the prompt text shown to the player) and two default choices. For each choice, you fill in:

- **Choice text** -- what the player sees as a clickable option
- **Condition** (optional) -- a Python expression that must be true for the choice to appear (e.g., `has_key`)
- **Logic** -- what happens when the player picks this choice

The logic field supports several action types:

- `jump label_name` -- unconditional jump to a label
- `call label_name` -- call a label as a subroutine and return
- `pass` -- do nothing (continue to the next line)
- `return` -- return from the current call
- Custom code -- any multi-line Ren'Py or Python code block

As you edit, the constructor **validates in real time** against your project data. If you type `jump cafe_scene` and `cafe_scene` is not a defined label, the constructor highlights the issue. Known labels autocomplete as you type.

The generated code appears in a live preview pane. You can copy it to insert into your editor, or insert it directly at the cursor position.

#### Menu Templates

If you find yourself building similar menu structures repeatedly -- say, every chapter ends with a "Continue / Save / Quit" choice -- you can **save a menu as a template**. Templates store the full menu structure (caption, choices, conditions, logic) and can be loaded from the template picker the next time you need one. This is particularly useful for recurring UI patterns across your visual novel.

### The Color Picker

The **Colors** tab provides a **Color Picker** with five palettes for working with hex colors in your Ren'Py code:

- **Ren'Py Standard** -- the named colors that Ren'Py recognizes natively
- **HTML Named** -- the full set of CSS/HTML named colors
- **Material 500** -- Google Material Design's mid-weight color set
- **Pastel** -- a softer palette for UI work
- **Project Theme** -- automatically scanned from your `.rpy` files, this palette shows every hex color literal that appears in your codebase

Click a swatch to select it. The preview area at the bottom shows the selected color with its hex value and three action buttons:

- **Insert at Cursor** -- types the hex code directly into the active editor at the cursor position
- **Wrap Selection** -- wraps the currently selected text in `{color=#hex}...{/color}` tags, perfect for inline dialogue coloring
- **Copy Hex** -- copies the hex value to your clipboard

Double-clicking a swatch immediately inserts its hex value at the cursor, combining selection and insertion into a single gesture.

The Project Theme palette updates automatically as you add or remove hex colors in your code. It provides a quick way to maintain visual consistency -- if you have been using `#4A90D9` for your UI accent color, you can find it in the Project Theme palette rather than remembering the hex value.

---

## Chapter 8: Working with Assets

Visual novels run on images and audio. Ren'IDE provides dedicated management tools for both, accessible through the Assets category in the Story Elements sidebar.

### Image Assets

The **Images** tab shows all images that have been registered with your project. Images display as a folder tree with thumbnails, making it easy to browse backgrounds, character sprites, and UI elements visually.

#### Scanning Images

You do not need to copy image files into a specific folder structure for Ren'IDE to find them. The scan feature lets you point at any directory on your system -- your art assets folder, a shared Dropbox directory, a downloaded asset pack -- and Ren'IDE will index the images it finds. The files stay where they are; the IDE only records references and generates thumbnails.

This is particularly useful during development when your artist is delivering files to a shared folder and you want to reference them in your script before the final project structure is decided.

#### Working with Images

Right-click any image to access its context menu:

- **Copy `scene` statement** -- copies `scene bg_park` (or whatever the image's Ren'Py tag is) to your clipboard, ready to paste into your script
- **Copy `show` statement** -- copies `show eileen happy` for character sprites
- **Drag to composer** -- drag an image directly from the sidebar into the Scene Composer or Screen Layout Composer (covered in Chapter 9)

Double-click an image to open its **Image Editor View**, where you can manage its Ren'Py tag (the name used in `show`/`scene` statements), assign metadata tags for organization, and see the image at full resolution.

### Audio Assets

The **Audio** tab follows the same pattern as images: a browsable folder tree, a scan feature for indexing external directories, and metadata management.

What sets the audio tab apart is its custom **audio player**. When you select an audio file, the player appears with:

- A glowing play/pause button
- A custom seek bar for scrubbing through the track
- A **64-bar equalizer visualization** -- a real-time frequency display rendered using the Web Audio API, with bars colored in a cyan-to-blue-to-violet gradient, complete with peak dots that hold briefly at each bar's maximum level and a subtle scanline overlay
- A volume slider with visual feedback

This is not just cosmetic. Being able to audition tracks directly in the IDE, with proper visualization, means you can evaluate background music and sound effects without switching to an external audio application. You can hear whether a track loops cleanly, whether a sound effect has the right energy, and whether the volume levels feel right relative to each other.

Right-click an audio file for quick-copy options:

- **`play music`** -- copies `play music "audio/theme.ogg"` for background music
- **`play sound`** -- copies `play sound "audio/click.ogg"` for sound effects
- **`queue audio`** -- copies `queue music "audio/next_track.ogg"` for playlist-style sequencing

### How Assets Connect to Everything Else

Assets are not isolated in their sidebar tab. They integrate with the rest of the IDE:

- **Scene Composer**: drag images from the Images tab directly onto the Scene Composer stage to add them as layers
- **Screen Layout Composer**: drag images into screen layouts for UI elements
- **Diagnostics**: if your script references `scene bg_park` but no image with that tag exists, the diagnostics system flags it as a "missing image" warning
- **IntelliSense**: image and audio names appear in autocomplete suggestions when you type `show`, `scene`, `play music`, or `play sound`

---

## Chapter 9: Visual Composers

Not everything in a visual novel is best expressed as text. Scene layouts, clickable image maps, and UI screens are inherently visual -- and editing them as raw code means constantly running the game to check whether your coordinates and layouts look right. Ren'IDE's three visual composers let you design these elements graphically and generate correct Ren'Py code automatically.

### Scene Composer

The **Scene Composer** is where you arrange backgrounds and character sprites into complete scenes. Think of it as a stage: you set the backdrop, position your actors, and adjust the lighting.

#### Building a Scene

Create a new scene composition from the Scenes sub-tab in Story Elements, or open an existing one. The composer opens as a full editor tab with three areas: the **stage** (the large preview area), the **layer list** (on the side), and the **properties panel** (below the layer list).

Drag an image from the Images tab onto the stage to add it as a layer. The first image you add is typically the background -- it fills the entire stage area. Subsequent images layer on top as sprites.

The stage displays at your project's configured resolution. You can choose from preset resolutions -- 1920x1080, 1280x720, 1024x768, 800x600 -- or enter a custom size. The preview scales to fit your screen while maintaining the correct aspect ratio.

#### Per-Sprite Controls

Select any sprite on the stage (or click its entry in the layer list) to reveal its property controls:

- **Position** -- drag the sprite on the stage, or type exact X/Y coordinates
- **Zoom** -- scale the sprite up or down (useful for perspective effects or adjusting character sizes)
- **Flip** -- mirror the sprite horizontally or vertically
- **Rotation** -- rotate by any angle
- **Alpha** -- adjust transparency from fully opaque to invisible
- **Blur** -- apply a Gaussian blur (useful for depth-of-field effects or dream sequences)

#### Visual Effects

The **Visual Effects** panel opens up Ren'Py's powerful `matrixcolor` system through an intuitive interface.

**Color grading** sliders let you adjust:

- **Saturation** -- from fully desaturated (greyscale) to oversaturated
- **Brightness** -- darken or lighten the entire sprite
- **Contrast** -- flatten or sharpen tonal differences
- **Invert** -- partially or fully invert the color values

**Color modes** provide two approaches to color transformation:

- **Tint** -- applies a single color overlay to the entire sprite. Set a warm orange tint for sunset scenes or a cold blue for night.
- **Colorize** -- remaps the sprite's luminance range between two colors. Black pixels become one color, white pixels become another, and everything in between blends. This is perfect for silhouette effects or stylized flashbacks.

**Matrix presets** offer one-click access to common cinematic looks: Night, Sunset, Sepia, Greyscale, Noir, Faded, Silhouette, and more. These are organized by category in a popover, so you can quickly audition different moods. Each preset sets the appropriate combination of saturation, brightness, contrast, and color mode values.

The stage preview updates in real time as you adjust effects, using CSS filter approximations of Ren'Py's `matrixcolor` transforms. What you see in the composer is a close match to what the player will see in-game.

#### Layer Management

The layer list shows all sprites in stacking order. You can:

- **Reorder layers** by dragging them up or down in the list
- **Lock a layer** to prevent accidental edits (the lock icon toggles per layer)
- **Delete or make background** using the inline action icons that appear when you hover over a layer row

#### Output

When your scene looks right, you have two output options:

- **Copy Ren'Py Code** -- generates the complete `scene`/`show` statements with ATL transforms, `matrixcolor` expressions, and shader uniforms. Paste this directly into your script.
- **Export PNG** -- renders the composed scene to a PNG image file, useful for promotional materials or documentation.

Here is an example of generated code for a scene with a sunset background, a tinted character sprite, and a blurred foreground element:

```renpy
scene bg_park_sunset
show eileen happy at center:
    zoom 1.1
    matrixcolor TintMatrix("#ff9944") * BrightnessMatrix(0.10)
show overlay_leaves at top:
    blur 3.0
    alpha 0.7
```

### ImageMap Composer

An **imagemap** in Ren'Py is a screen where the player clicks regions of an image to make choices -- like a point-and-click adventure map or a visual menu. The **ImageMap Composer** lets you draw those clickable regions visually.

#### Setting Up

Start by choosing a **ground image** -- the base image that the player sees. Optionally, set a **hover overlay** -- an alternate image that reveals hotspot highlights when the mouse moves over them. Both images can be dragged in from the Images tab.

#### Drawing Hotspots

Click and drag on the ground image to draw a rectangular hotspot. The rectangle appears with a semi-transparent overlay so you can see where it sits relative to the image. You can resize a hotspot by dragging its edges, move it by dragging its center, or delete it with the `Delete` key.

For each hotspot, configure:

- **Action type** -- `jump` to move to a label, or `call` to invoke a label as a subroutine
- **Target label** -- the destination, with autocomplete suggestions drawn from your project's known labels

You can have as many hotspots as you need. They can overlap (the topmost hotspot in the layer order takes priority), and each one generates its own action.

#### Generated Code

The composer generates a complete Ren'Py `imagemap` screen definition. The hotspot coordinates are calculated in pixels relative to the ground image's resolution, so the generated code is ready to use:

```renpy
screen my_map():
    imagemap:
        ground "images/world_map.png"
        hover "images/world_map_hover.png"
        hotspot (120, 340, 200, 180) action Jump("forest_path")
        hotspot (450, 200, 220, 160) action Jump("mountain_village")
        hotspot (700, 400, 180, 150) action Jump("coastal_town")
```

### Screen Layout Composer

Ren'Py's screen language is powerful but verbose. Building a custom UI screen -- a stats display, an inventory panel, a settings menu -- means writing deeply nested code with precise property assignments. The **Screen Layout Composer** lets you build these screens visually.

#### The Widget Palette

The left side of the composer presents a palette of Ren'Py screen widgets:

- **Layout containers**: `vbox` (vertical stack), `hbox` (horizontal stack), `frame` (bordered container)
- **Content widgets**: `text`, `image`
- **Interactive widgets**: `textbutton`, `button`, `imagebutton`, `bar`, `input`
- **Spacing**: `null` (invisible spacer)

Each widget type has its own icon, color-coded for quick identification.

#### Building a Screen

Drag widgets from the palette onto the stage. Container widgets (`vbox`, `hbox`, `frame`) accept child widgets -- drag a `text` widget into a `vbox` and it nests inside. The composer renders a live preview of the layout as you build it.

Select any widget in the tree to open its **property editor**. Properties vary by widget type:

- `text` -- the displayed string, font size, color, alignment
- `textbutton` -- button text, action (jump, call, or custom code), hover styling
- `image` -- the image path, sizing behavior
- `bar` -- value, range, bar style
- `frame` -- padding, background, border

The widget tree on the left shows the nesting hierarchy. Rearrange widgets by dragging them within the tree. The generated code updates in real time in the code preview pane.

#### Working with Existing Screens

If your project already has screen definitions in code, the Screen Layout Composer can display them in **read-only mode**. This gives you a visual representation of your existing screens without risking accidental edits to hand-written code.

Want to use an existing screen as a starting point? Click **Duplicate** to create an editable copy in the composer. Modify the copy visually, then paste the generated code back into your project.

#### Generated Code

The composer generates clean, indented Ren'Py screen code. For example, a simple character stats screen might produce:

```renpy
screen character_stats():
    frame:
        xalign 0.5
        yalign 0.5
        vbox:
            spacing 10
            text "Character Stats" size 28
            hbox:
                spacing 20
                text "Strength:"
                bar value strength range 100
            hbox:
                spacing 20
                text "Intelligence:"
                bar value intelligence range 100
            textbutton "Close" action Return()
```

---

## Chapter 10: Diagnostics and Quality

You have written ten thousand words of dialogue, set up branching paths, composed scenes, and defined a cast of characters. Everything feels right -- until a playtester hits a `jump` to a label that does not exist, or a `show` statement references an image you renamed last week. These are the kinds of errors that Ren'Py itself will catch at runtime, crashing the game with a traceback. Ren'IDE's diagnostics system catches them before your players do.

### What Diagnostics Check

The diagnostics engine continuously analyzes your project and flags issues across several categories:

- **Invalid jumps** -- `jump cafe_scene` where `cafe_scene` is not a defined label anywhere in the project
- **Missing images** -- `show eileen happy` where no image with that tag has been registered
- **Missing audio** -- `play music "audio/theme.ogg"` where the referenced file does not exist
- **Undefined characters** -- a dialogue line attributed to a character tag that has no `define` statement
- **Undefined screens** -- `call screen inventory` where no `screen inventory` definition exists
- **Unused characters** -- characters that are defined but never speak and are never referenced
- **Unreachable labels** -- labels that no `jump`, `call`, or fall-through path can reach from `label start`
- **Dead-end labels** -- labels with no outgoing `jump`, `call`, or `return`, where the story flow stops
- **Syntax errors** -- structural problems like missing colons after `if` statements or malformed triple-quoted strings

Each issue is classified by severity: **error** (will crash the game), **warning** (likely a bug), or **info** (worth reviewing but possibly intentional).

### The Diagnostics Panel

Open the Diagnostics panel from the toolbar button (it has a red badge showing the error count when issues exist) or from the corresponding toolbar icon. The panel has two views: **Issues** and **Tasks**.

The **Issues** view lists every detected problem. Each entry shows:

- A severity icon (red circle for errors, yellow triangle for warnings, blue circle for info)
- A category badge (e.g., "Invalid Jump", "Missing Image", "Syntax")
- A description of the problem
- The file and line number where the issue occurs

Click any issue to jump directly to the source -- Ren'IDE opens the file, scrolls to the line, and highlights the problematic code. This one-click navigation means you can work through a list of issues methodically, fixing each one without manually searching.

**Filter by severity** using the filter controls at the top of the panel. When you are in bug-fixing mode, filter to errors only. When you are polishing, include warnings and info.

If a diagnostic is intentional -- perhaps you have an unreachable label that serves as a developer testing area -- you can **suppress it**. Right-click the issue and choose to ignore that specific rule. Suppression rules are stored in your project settings and can be managed (re-enabled) at any time.

### Tasks

The **Tasks** view turns diagnostics into a checklist. Convert any diagnostic issue into a task item by promoting it, giving you a trackable to-do list for your quality assurance pass.

Sticky notes on any of the three canvases can also be promoted to tasks via their checkbox. This connects your visual planning (sticky notes on the canvas saying "fix this transition") with your structured quality tracking (the tasks checklist).

Tasks persist in `.renide/project.json` and survive IDE restarts. Check them off as you resolve them.

### Diagnostics on the Canvas

You do not need to have the Diagnostics panel open to see problems. On the **Project Canvas**, blocks with issues display a **colored outer glow**:

- **Red glow** -- the block contains at least one error-severity diagnostic
- **Amber glow** -- the block contains warnings but no errors

This gives you an immediate visual sense of project health as you look at the canvas. A project with no glow effects on any block is a clean project. A sea of red means it is time to open the Diagnostics panel and start working through the list.

The **toolbar badge** reinforces this: a small red circle on the Diagnostics button shows the total error count. When it reads zero, you know you are in good shape.

### Project Statistics

Beyond finding problems, Ren'IDE helps you understand your project's scope and shape through the **Project Statistics** view. Open it from the toolbar.

The statistics dashboard presents several categories of data, each loading independently with inline spinners (so you see numbers as they become available rather than waiting for everything to compute):

**Story metrics**:

- **Total word count** -- words across all dialogue and narration lines
- **Estimated play time** -- a rough calculation based on average reading speed
- **Lines of dialogue** -- the raw count of dialogue lines in the project
- **Label count** and **menu count** -- structural measures of your story's scope

**Per-character dialogue breakdown**: a sortable table showing each character's word count, their share of total dialogue as a percentage, and a colored progress bar. For projects with more than six characters, the table becomes sortable by name or word count. This is revealing -- you might discover that your supposed secondary character actually speaks more than your protagonist.

**Branching complexity**: Ren'IDE calculates a complexity score based on the ratio of branching points to total story blocks and the number of identified routes. The score falls into one of four buckets:

- **Linear** -- mainly one path through the story
- **Branching** -- several distinct story paths
- **Complex** -- many intersecting routes and choices
- **Non-linear** -- highly interconnected with a large route space

Each bucket is color-coded (green through red) and includes a brief description. This gives you an at-a-glance sense of your story's structural complexity.

**Path statistics**: the number of story endings (dead-end labels reachable from `start`), plus the shortest and longest paths through the narrative graph. If your shortest path is 3 labels and your longest is 47, you know some players will see far more content than others.

**Asset coverage**: a filterable, sortable table showing every image and audio reference in your project, categorized as "referenced" (used and present), "missing" (referenced in code but not found), or "orphaned" (present in assets but never referenced in code). This helps you clean up unused assets and catch missing ones.

#### IDE Performance

At the bottom of the statistics view, an **IDE Performance** section reports technical metrics for the current session:

- **Project load time** -- how long it took to open and index your project
- **Analysis worker duration** -- how long the most recent full analysis took
- **Asset scan time** -- how long image and audio scanning took
- **Canvas FPS** -- the current rendering frame rate for the active canvas (measured as a rolling 60-frame average)
- **JS heap memory** -- the current memory usage of the IDE process

Each metric shows its value against a target threshold where applicable (e.g., analysis should complete in under a certain time). Green means the target is met; red means it is exceeded. This is primarily useful if you notice the IDE feeling sluggish on a large project -- the performance section helps you identify whether the bottleneck is analysis, asset scanning, or rendering.

## Chapter 11: Testing Your Game

At some point, every visual novel developer stops writing and starts asking the question that actually matters: "Does this look right when the player sees it?" Writing dialogue in a code editor is one thing. Watching it unfold with character sprites, backgrounds, music, and timed transitions is something else entirely.

The difference between reading a line of script and experiencing that line as a player is enormous. Pacing feels different. A transition that seemed fine in code might feel sluggish when you actually sit through it. A joke that looked funny on screen might fall flat with the wrong timing.

Ren'IDE gives you three tools to make that feedback loop as short as possible: a one-key game launcher, a warp system that teleports you to any scene, and a drafting mode that lets you run unfinished projects without crashing on missing art.

### Running Your Game

Press `F5`. That is all it takes.

Ren'IDE launches the Ren'Py engine as a child process, passing your project directory straight to it. Your visual novel boots in its own window, and you can interact with it exactly as a player would -- click through dialogue, make choices, watch transitions play out. The green play button in the toolbar turns into a red stop button while the game is running, so you always know the current state at a glance.

When you are done testing, press `Shift+F5` (or click that red stop button) and the game process shuts down cleanly. You are back in the IDE, ready to edit. No manual window-switching, no hunting for a terminal to kill a process.

The core workflow looks like this:

1. Write or edit a scene in the code editor.
2. Press `Ctrl+S` to save.
3. Press `F5` to launch.
4. Watch your scene play out in the Ren'Py window.
5. Press `Shift+F5` to stop.
6. Fix what needs fixing.
7. Repeat.

This tight loop means you spend less time fumbling between applications and more time polishing your story. Noticed that a `with dissolve` transition feels too slow? Stop the game, change the duration, save, relaunch. The whole cycle takes seconds.

Many developers coming from other engines are used to a more cumbersome testing cycle -- export, wait for a build, open the build, navigate to the right scene. With Ren'Py and Ren'IDE, the cycle is nearly instantaneous because Ren'Py interprets scripts directly. There is no compilation step. The version of your code on disk is the version Ren'Py reads.

A few things worth knowing about the run/stop behavior:

- Only one game instance runs at a time. If the game is already running, the Run button is replaced by the Stop button -- you cannot accidentally launch a second copy.
- If the game crashes or exits on its own (for example, from a Ren'Py exception), the IDE detects that the process ended and switches the toolbar back to the Run button automatically.
- The IDE saves all unsaved files before launching, so you never have to worry about testing stale code. Hit `F5` and the latest version of every file goes to Ren'Py.

There is one prerequisite: you need a valid **Ren'Py SDK path**. If you have not set one yet, open `Settings` (`Ctrl+,` / `Cmd+,`) and browse to your Ren'Py SDK directory. The IDE validates the path and shows it in the settings panel. If the Run button appears grayed out, your SDK path is either missing or invalid -- double-check that it points to the correct SDK folder (the one containing `renpy.exe` on Windows or `renpy.sh` on macOS/Linux).

### Warp to Label

Here is the problem every visual novel developer hits sooner or later.

You are working on the climactic confrontation in Chapter 5. To test it, you have to launch the game, click through the title screen, sit through the opening monologue, pick dialogue options for four earlier chapters, and finally arrive at the scene you actually want to see. Then you find a typo, stop the game, fix it, and repeat the entire twenty-minute journey.

**Warp to Label** eliminates this entirely.

Press `Ctrl+Shift+G` (`Cmd+Shift+G` on macOS), or click the Warp button in the toolbar -- the target icon sitting next to the Run button. A label picker appears, listing every label in your project. Select one, and the IDE launches your game directly at that label. No title screen. No clicking through earlier scenes. You land exactly where you need to be.

Behind the scenes, the IDE uses Ren'Py's `--warp` command-line flag. It resolves the label to a `filename.rpy:line_number` target format and passes it directly to the engine. Ren'Py also skips the main menu and splashscreen automatically during a warp, so you land in-scene without delay.

The label picker supports fuzzy search, so you do not need to remember exact label names. Start typing a few letters -- `conf` to find `chapter5_confrontation`, for instance -- and the list narrows instantly. This is the same picker used by the Go-to-Label command (`Ctrl+G`) on the canvases, so if you already know that search interface, Warp to Label will feel immediately familiar.

Imagine you have a label called `chapter5_confrontation` in a file called `chapter5.rpy`. When you select it in the Warp picker, the IDE resolves it to something like `chapter5.rpy:142` and launches Ren'Py with `--warp chapter5.rpy:142`. You see your scene in seconds.

#### Variable Overrides

There is a catch with warping. If your Chapter 5 scene references a variable like `mc_name` that the player normally sets in Chapter 1, or an `affection` counter that accumulates across chapters, the game will either crash or display a placeholder value. The **Variable Overrides** modal solves this.

When you select a warp target, the IDE presents a modal where you can set values for any variables that would normally be established earlier in the story. Variables are grouped into two categories:

- **Default variables** -- these come from `default` declarations in your code, like `default mc_name = "Player"` or `default affection = 0`. The IDE pre-fills them with their declared initial values, so you often do not need to change anything. If the defaults are what you want, just leave them as-is.
- **Interpolated variables** -- these are detected from text interpolation patterns like `[mc_name]` in your dialogue strings. The IDE scans your translatable text (skipping system files like `options.rpy`, `gui.rpy`, and `screens.rpy`) to find variable references. If it finds an interpolated name that does not match any `default` declaration, it adds it to the override list with a sensible placeholder value of `default_<name>`.

You can adjust any of these values before launching. Need to test the scene where the player's name is "Sakura" and their affection score is 75? Type those values in. The IDE is smart about value types -- plain words like `Sakura` are automatically quoted as strings, while numbers like `75`, boolean values like `True`, and Python expressions are left as-is.

When you click launch, the IDE writes a temporary file called `_ide_after_warp.rpy` in your game directory. This file contains a `label after_warp:` block that sets all your override variables using Python assignment statements. Ren'Py's warp system automatically calls this label before resuming at your target. When the game stops, the IDE deletes the temporary file automatically -- your project directory stays clean, and the override file never gets committed to version control by accident.

One edge case worth knowing: if your project already defines its own `label after_warp` (some developers use this hook for custom debugging logic), the IDE detects the conflict and shows a warning in the modal. It will not create a duplicate label, because that would cause Ren'Py to throw an error at launch. In that situation, you will need to manage your variable overrides through your own `after_warp` label instead.

#### Other Ways to Warp

The `Ctrl+Shift+G` label picker is not the only entry point. You can also warp from:

- **The code editor**: right-click a label line and choose `Warp to here` from the context menu. This is perfect when you are already staring at the exact label you want to test -- no need to open a picker and search for it.
- **Any canvas node**: right-click a node on the Flow Canvas or Choices Canvas and select the warp option from the context menu. See an interesting branch you want to test? Jump straight there from the visual map.

Warp to Label changes how you develop visual novels. Instead of treating testing as a slow, sequential process where you replay your entire game to reach one scene, you treat it like random access -- jump to any point in your story in seconds. This is especially transformative for games with complex branching, where reaching a specific branch through normal play might require a precise sequence of earlier choices.

Consider a concrete example. Your game has a branching romance route where the player can only reach the confession scene if they chose to visit the library in Chapter 2, helped the character in Chapter 3, and picked the right dialogue option in Chapter 4. Without Warp, testing the confession scene means playing through all three earlier chapters and making exactly the right choices each time. With Warp, you select `confession_scene` from the picker, set `romance_points` to `15` in the variable overrides, and you are there in two seconds.

### Drafting Mode

What if your artist has not finished the character sprites yet? Or your composer has not delivered the background music? Normally, Ren'Py would throw an error -- or simply crash -- when it tries to display an image or play an audio file that does not exist on disk.

**Drafting Mode** handles this gracefully. Toggle it on with the switch in the toolbar (the pen icon on the right side). The toggle turns green when active.

With Drafting Mode enabled, the IDE tells Ren'Py to substitute placeholders for any missing assets:

- **Missing images** appear as gray rectangles with the asset name displayed as text. So if your script calls `show eileen happy` but the sprite does not exist yet, the player sees a gray box labeled "eileen happy" at the correct screen position. You can see exactly where the character will eventually appear, and the scene layout still makes sense.
- **Missing audio** is replaced with silence. Your `play music "romantic_theme.ogg"` and `play sound "door_slam.wav"` statements execute without errors, and the rest of the scene continues normally. Timing-dependent sequences still work -- they just play in silence. This means your `queue music` chains, `play sound` effects, and any `renpy.music.is_playing()` checks behave correctly -- the engine treats the silence as a real audio track.

This is invaluable for writers who want to test story flow, pacing, and branching logic before the art and audio pipeline catches up. You can write your entire visual novel, test every path and every choice, and defer asset creation to a later phase without ever seeing an error screen. It also works well for prototyping -- you can sketch out a new scene with placeholder assets, test whether the pacing feels right, and only commission the real artwork once you are happy with the structure.

When your assets are ready, toggle Drafting Mode off. The IDE stops injecting placeholders, and Ren'Py uses your actual image and audio files. If any assets are still missing at that point, the Diagnostics panel will flag them so you know exactly what remains to be created.

Drafting Mode pairs naturally with Warp to Label. You can warp to any scene in your project and see it play out with placeholder art, testing dialogue pacing, choice logic, and variable behavior -- all without a single finished asset. This combination makes it possible to play-test your entire visual novel on day one of development.

---

## Chapter 12: Translations

Visual novels have a global audience. A game written in English might find passionate players in Japan, France, Brazil, or Korea -- but only if it speaks their language. Ren'Py has a mature translation system built in, and Ren'IDE wraps that system in a visual dashboard that makes it practical to manage translations across multiple languages, track progress file by file, and spot gaps before they reach players.

Managing translations in a visual novel is not like translating a simple application. A game might have thousands of dialogue lines, each tied to a specific character voice and emotional context. Some lines are narrator text, some are spoken dialogue, and some are player choice text that needs to be concise enough to fit inside a button. Keeping track of all this across multiple languages -- especially as the source script evolves -- is a significant project management challenge. The Translation Dashboard is designed specifically for this.

### Opening the Translation Dashboard

Click the globe icon in the toolbar to open the **Translation Dashboard**. It fills the panel with three sections stacked vertically: language overview cards at the top, a file breakdown table in the middle, and a string-level view at the bottom.

If your project does not have any translations yet, the dashboard shows an empty state with a brief explanation of how Ren'Py's translation system works and a button to generate your first translation scaffolding.

### Language Overview Cards

The top section displays one card per detected language in your project. Each card shows:

- The **language name**, matching the directory name under `game/tl/`. Ren'Py uses plain names like `french`, `japanese`, or `spanish` -- whatever you chose when generating the translation files.
- The **total string count** -- how many translatable strings exist in your project across all files.
- The **translated count** -- how many of those strings have translations in this language.
- The **stale count** -- translations where the translated text is identical to the source text. This is the dashboard's way of telling you "this string has a translation file entry, but nobody has actually translated it yet." When Ren'Py generates translation scaffolding, it copies the source text as a placeholder. Until a translator replaces it with the target language, it counts as stale.
- A **completion percentage bar** that gives you an instant visual read on progress. The bar turns green above 80%, yellow between 40% and 80%, and red below 40%.

Click any language card to select it as the active language. The file breakdown and string-level sections below update to show data specific to that language.

### File Breakdown Table

The middle section is a sortable table with one row per source file in your project. The columns are:

| Column | What it shows |
|--------|---------------|
| File | The source `.rpy` file path |
| Total | Total translatable strings in that file |
| Translated | Strings with actual (non-stale) translations |
| Untranslated | Strings still needing translation |
| Stale | Translations identical to source text |
| Completion | Percentage bar for this specific file |

Click any column header to sort by that column. Click again to toggle between ascending and descending order. This is how you find the files that need the most attention -- sort by `Untranslated` in descending order, and the biggest gaps float to the top. Or sort by `Stale` to find files where the scaffolding was generated but the actual translation work has not started.

### String-Level View

The bottom section lists every individual translatable string in your project. This is a virtual-scrolling list, meaning it renders only the visible rows at any given time -- so even a project with thousands of dialogue lines stays responsive.

Each row displays:

- A **type badge** -- `dialogue`, `narration`, or `choice` -- so you can immediately see what kind of string you are looking at. Dialogue has a character speaking, narration is narrator text, and choices are menu options the player clicks.
- The **character tag** (if any, shown in bold) and the **source text**.
- The **file path and line number** in small text below.
- **Language status badges** for each detected language -- green if translated, amber if stale, red if missing. Click any badge to jump to that translation in the editor.

Filter controls at the top of the string list let you narrow what you see:

- **Language pills** -- click to switch the active language context.
- **Status filter** -- choose between `All Status`, `Translated`, `Untranslated`, or `Stale`.
- **Text search** -- type a word or phrase to filter by string content or file path. Useful when a translator asks "where is the line that says X?"

Click any string row to jump directly to its translation in the code editor. If a translation exists for the selected language, you land on the translated line. If the string is untranslated, you land on the source string instead, so you can see what needs translating.

This click-to-navigate behavior is what elevates the dashboard from a passive status report to an active working tool. Instead of scrolling through translation files hunting for a specific string, you find it in the searchable dashboard and click once. The editor opens, scrolls to the right line, and you are editing immediately.

### Generating Translation Scaffolding

Starting a new language? Click the `Generate Translations` button in the top-right corner of the dashboard. A modal appears asking for the language code.

Enter the language name in lowercase -- `french`, `japanese`, `brazilian_portuguese`, or whatever identifier you prefer. The code must use only lowercase letters, numbers, and underscores, and must start with a letter. The modal validates your input in real time and shows an error if the format is invalid.

When you confirm, the IDE invokes Ren'Py's built-in translation generator through the SDK. This creates the `game/tl/<language>/` directory structure and populates it with translation stubs for every translatable string in your project. Each stub contains the source text as a placeholder, ready for a translator to replace.

This feature requires a valid Ren'Py SDK path in your settings. If the SDK is not configured, the `Generate Translations` button is disabled with a tooltip explaining why.

After generation completes, the dashboard updates to show the new language card. Every string starts as stale (since the scaffolding just copies the source text), so you will see 0% effective completion. From here, hand the generated `.rpy` files to your translators. They are standard text files that any editor can open.

### How the Parser Works

The Translation Dashboard requires no manual configuration. The IDE's analysis engine handles detection automatically:

1. It scans your project for `game/tl/<language>/` directories to discover which languages exist.
2. It parses the translation blocks inside those directories and matches them back to source strings using Ren'Py's translation ID system.
3. It identifies stale translations by comparing each translated string to its source string -- if they are character-for-character identical, the translation has not actually been done yet.

This detection runs as part of the normal project analysis, so the dashboard stays up to date as you and your translators work.

### The Translation Workflow

A typical multilingual visual novel workflow looks like this:

1. Write your visual novel in your base language. Focus on the story first.
2. When you are ready to localize, open the Translation Dashboard and click `Generate Translations` for each target language.
3. Hand the generated files (under `game/tl/`) to your translators. Because these are standard `.rpy` files, translators do not need the IDE -- they can use any text editor.
4. As translated files come back, copy them into your project folder (or merge them via Git).
5. Use the dashboard to track progress across every language. Find untranslated strings, identify stale translations, and see which files are finished and which still need work.
6. When you update source dialogue (fixing a typo or rewriting a line), the corresponding translation becomes stale -- the dashboard catches this automatically so you can flag it for re-translation.

The dashboard is a read-only tracking and navigation tool. It does not edit translation files for you -- that is the translator's job. What it does is give you a complete, real-time picture of every string across every language, so nothing falls through the cracks.

This separation of concerns is deliberate. Translation is a specialized task that requires understanding context, tone, and cultural nuance. The IDE's role is logistics -- making sure every string has a place, tracking which strings are done, and helping you navigate to the right location when something needs attention. The actual craft of translation stays in the hands of the people who know the language.

One practical tip: if you are managing multiple translators working on the same language (perhaps one handling Chapter 1-3 and another handling Chapter 4-6), use the file breakdown table to track each person's progress independently. Sort by file name and you can see exactly which files are done and which are still pending.

---

## Chapter 13: Project Tools

Beyond the canvases, the code editor, and the visual composers, Ren'IDE includes a set of project management tools that handle the day-to-day logistics of working with files, tracking changes, and keeping your project organized. These tools are not glamorous, but they make the difference between a smooth development workflow and a frustrating one. A visual novel project can grow to dozens or hundreds of files over months of development, and managing that structure well is a silent prerequisite for finishing the game.

### Project Explorer

The **Project Explorer** lives in the left sidebar. It displays your project's file tree with every `.rpy` file, image, audio file, and subdirectory organized in a familiar hierarchical view.

You have full file management capabilities here:

- **Create** new files and folders via right-click context menus. Need a new chapter file? Right-click the `game/` directory, select `New File`, and name it `chapter6.rpy`.
- **Rename** files by right-clicking and selecting `Rename`.
- **Delete** files and folders with a confirmation dialog to prevent accidents. Deleted files are removed from disk permanently -- this is not a recycle bin operation -- which is why the confirmation step is important.
- **Cut, copy, and paste** files between directories using `Ctrl+X` / `Ctrl+C` / `Ctrl+V` (or the macOS equivalents). Cut-and-paste is how you reorganize your project structure, moving script files between subdirectories as your story grows.
- **Drag and drop** files to move them between folders, reorganizing your project structure visually.

One particularly useful feature: right-click any `.rpy` file and choose `Center on Canvas`. The IDE switches to the Project Canvas and pans directly to that file's block, zooming in so you can see it in the context of its neighbors and connections. This is the fastest way to go from "I know the file name" to "I can see how it connects to the rest of my project."

The file tree updates in real time as you create, rename, or delete files through the IDE. It also reflects changes made through the `Refresh Project` command when files are modified outside the IDE. The explorer uses lazy rendering for large file trees, so even projects with hundreds of files stay responsive.

#### Refresh Project

Sometimes you make changes outside the IDE. Maybe you edited a file in VS Code, pulled updates from a Git repository, ran a batch rename script, or your artist dropped new sprites into the `images/` folder. The **Refresh Project** command reconciles everything the IDE knows with what is actually on disk.

Trigger it from the `File` menu or from the Project Explorer's right-click context menu. The IDE re-reads all project files, detects files that were added or removed since the last scan, updates the image and audio asset lists, and re-runs the full analysis. Blocks on the canvas update to reflect any content changes, and new files appear as new blocks.

If any files that you had open in the editor were also modified externally, you will see conflict warnings handled by the external file change detection system described below.

### External File Change Detection

The IDE runs a file watcher in the background that monitors your project folder for `.rpy` file changes. This watcher uses a 400-millisecond debounce to avoid reacting to rapid intermediate saves (like those from format-on-save tools).

When an external change is detected, the IDE's response depends on the state of your editor buffer for that file:

- **Clean files** -- files where you have no unsaved changes in the IDE -- reload silently. The editor content updates, the analysis refreshes, and the canvases redraw. You will not even notice unless you happen to be looking at the file when it changes.
- **Dirty files** -- files where you have unsaved edits -- trigger a persistent warning bar at the top of the editor pane. The bar presents two clear options: `Reload` to accept the external version (your unsaved IDE changes are discarded), or `Keep` to hold onto your version (the external change is ignored until the next save or refresh).

The IDE also suppresses false positives. When it writes a file itself (for example, when you press `Ctrl+S`), it briefly ignores change events for that file so its own save does not trigger a "file changed externally" warning.

This system is essential for team workflows. If a collaborator pushes changes that modify a file you are actively editing, you will see the warning immediately. No silent overwrites, no lost work.

A common scenario: you pull from a shared Git repository and several `.rpy` files change on disk at once. Clean files in the editor update silently. If one of those files happens to be open with unsaved edits, you get the warning bar for just that file -- the rest update without interruption. The debounce interval also means that running `git pull` (which writes files in rapid succession) does not flood you with dozens of individual change notifications.

### Markdown Preview

Visual novel projects often include design documents, worldbuilding notes, changelogs, or contributor guidelines written in Markdown. Double-click any `.md` file in the Project Explorer to open it in a **GitHub-style rendered preview**.

The preview renders headings, bold, italic, lists, code blocks, links, tables, and other standard Markdown formatting. It respects your current IDE theme, so dark mode users get a properly themed dark background rather than a jarring white panel.

Need to make a quick edit? Toggle to edit mode, and the preview switches to a full Monaco editor with Markdown syntax highlighting. Make your changes, then toggle back to preview mode to verify the formatting looks right.

This is handy for maintaining a `README.md` in your project root, especially if you are sharing the project through GitHub or another Git hosting platform. Write the readme without leaving the IDE, and preview it to make sure it looks the way you intend.

### Undo and Redo

`Ctrl+Z` undoes your last action. `Ctrl+Y` redoes it. (On macOS, `Cmd+Z` and `Cmd+Y`.)

The undo system covers canvas-level and project-level operations:

- Moving blocks or nodes on any canvas.
- Creating or deleting blocks.
- Modifying composition data in the Scene Composer, ImageMap Composer, or Screen Layout Composer.

The history stack holds up to 50 actions, which is deep enough for most editing sessions. If you need to go further back than that, consider using a version control system like Git -- it is the right tool for long-term history across your entire project.

There are two important boundaries to understand:

- **Code editor changes** have their own separate undo stack. Monaco (the editor engine) manages text undo independently from canvas undo. When you are typing in the editor, `Ctrl+Z` undoes text changes. When the canvas has focus, the same shortcut undoes canvas operations. The IDE routes the shortcut to the correct system based on which panel is active. This means you will never accidentally undo a canvas move while editing code, or undo a line of dialogue while rearranging blocks. The two systems are fully independent -- undoing editor text does not affect the canvas history, and vice versa.

- **File system operations, settings changes, and asset imports** are not undoable through the undo system. Deleting a file from the Project Explorer, changing a theme in Settings, or scanning a new image directory are all operations that take immediate effect. Destructive actions like file deletion always show a confirmation dialog first, so you have a chance to reconsider before anything is permanent.

### New Project Wizard

Starting a new visual novel from scratch? The **New Project Wizard** walks you through a clean 3-step setup process.

**Step 1: Name and Location.** Enter your project name and choose where to save it on disk. The IDE remembers your last project directory, so the file browser opens in a familiar location rather than the system default. The name you enter becomes the folder name on disk.

**Step 2: Resolution.** Pick a resolution preset for your game window:

- 1280 x 720 (HD) -- the most common choice for visual novels, balancing quality with performance
- 1920 x 1080 (Full HD) -- the standard for modern displays, ideal if your art assets are high-resolution
- 2560 x 1440 (2K) -- for high-DPI presentations or premium productions
- 3840 x 2160 (4K) -- maximum fidelity for large displays
- Custom -- enter any width and height you want for non-standard aspect ratios

The resolution you choose here sets the `config.screen_width` and `config.screen_height` values in your project's `options.rpy`. You can always change it later, but getting it right from the start saves you from resizing all your art assets down the road. Most visual novels target 1920x1080 or 1280x720. If you are unsure, start with 1920x1080 -- it is the standard for modern displays, and scaling down for lower-resolution devices is straightforward, while scaling up from 720p can make artwork look blurry.

**Step 3: Theme and Colors.** Choose between a light or dark GUI scheme for your game's interface, then pick an accent color from a curated palette of 10 swatches (different swatches for light and dark schemes). The accent color tints the textbox, choice buttons, and other UI elements in your game. This gives your visual novel a distinct look right from the start.

When you click create, the IDE calls the Ren'Py SDK to generate a complete, SDK-compatible project structure. You get a `game/` directory populated with `script.rpy` (your starting script), `options.rpy` (game configuration), `gui.rpy` (visual styling), and all the standard Ren'Py boilerplate files. The new project opens in the IDE immediately -- the Project Canvas shows your first block, and you can start writing right away.

A useful detail: because the wizard generates standard Ren'Py project files, the result is fully compatible with both the IDE and the stock Ren'Py launcher. You can open the same project in either tool at any time. Nothing about the wizard's output locks you into using Ren'IDE -- it simply gives you a faster, more visual way to set up the boilerplate that every new Ren'Py project needs.

If you already have an existing Ren'Py project that you created outside the IDE, you do not need the wizard at all. Just open the project folder directly through `File` then `Open Project`. The IDE reads the `.rpy` files it finds, builds the canvas from your existing labels and jumps, and you are up and running.

---

## Chapter 14: Customization

Ren'IDE is designed to be comfortable for long writing sessions. A visual novel can take months -- sometimes years -- to write, and the tool you spend hours in every day should look and feel exactly the way you want it. Personal preferences matter more than most developers realize: the right font size reduces eye strain, the right theme reduces fatigue during late-night writing sessions, and the right mouse configuration prevents the small frustrations that accumulate over time. This chapter covers every way to make the IDE yours.

### Themes

Open `Settings` (`Ctrl+,` / `Cmd+,`) and look at the `Color Theme` dropdown. There are 11 themes available:

| Theme | Description |
|-------|-------------|
| `System Default` | Follows your operating system's light/dark preference automatically |
| `Light` | Clean white background with dark text |
| `Dark` | Dark background with light text -- easy on the eyes at night |
| `Solarized Light` | The classic Solarized palette, light variant |
| `Solarized Dark` | The classic Solarized palette, dark variant |
| `Colorful (Dark)` | Dark background with vibrant, saturated accent colors |
| `Colorful (Light)` | Light background with vibrant, saturated accent colors |
| `Neon Dark` | High-contrast neon accents on a deep dark background |
| `Ocean Dark` | Cool blue and teal tones on a dark background |
| `Candy Light` | Warm pastel pinks and purples on a light background |
| `Forest Light` | Green-tinted earth tones on a light background |

The theme applies across the entire application: the toolbar, all three canvases, the code editor, the sidebar panels, every modal and dialog. The Monaco code editor automatically switches between its own dark and light internal color schemes to match the IDE theme, so syntax highlighting always looks correct against the background.

Pick a theme that matches your environment. Writing late at night? `Dark`, `Neon Dark`, or `Ocean Dark` will be much kinder to your eyes than any light theme. Presenting your project to collaborators in a bright conference room? `Light`, `Candy Light`, or `Forest Light` will be more legible on a projector. The `System Default` option is a good middle ground -- it follows your OS preference, so the IDE automatically switches between light and dark when your system does.

Switching themes is instant -- the entire interface redraws immediately with no flickering or reload. Feel free to try every option until you find one that suits your taste. Themes are purely cosmetic; they have no effect on your project files or how your game looks when it runs.

### Editor Preferences

In the same Settings modal, you will find options to adjust the code editor:

- **Font**: choose the font family for the Monaco editor. Monospace fonts like Fira Code, JetBrains Mono, or Consolas work best for Ren'Py code, but you have the freedom to use whatever font you prefer.
- **Font size**: increase or decrease the text size. Larger sizes are easier to read during long writing sessions; smaller sizes let you see more code at once when working on complex logic.
- **Tab size**: set the number of spaces per indentation level. Ren'Py conventionally uses 4-space indentation, but you can adjust this to 2 or 8 if your team has a different preference.
- **Word wrap**: toggle whether long lines wrap to the next visual line or scroll horizontally. Wrapping is convenient for dialogue-heavy files where lines of text can be quite long.

All of these settings apply to every open editor tab and take effect immediately -- no restart required. Experiment until you find the combination that feels right.

Your settings persist across sessions. Close the IDE, reopen it days later, and everything is exactly as you left it -- theme, font, tab size, and all. App-level settings are stored separately from project data, so your personal preferences follow you regardless of which project you open.

### Mouse Preferences

Canvas navigation should feel natural and intuitive. The Settings modal includes a dedicated section for mouse preferences that let you fine-tune panning and zooming across all three canvases:

- **Canvas pan gesture**: configure which mouse interaction pans the canvas viewport. The default is `Shift+Drag` -- hold Shift and drag to move around the canvas. You can change this if your workflow calls for a different modifier key or gesture.
- **Middle mouse panning**: enable this option to let middle-click drag always pan the canvas, regardless of the pan gesture setting above. If you have a mouse with a clickable scroll wheel, this provides a quick, modifier-free way to navigate.
- **Zoom scroll direction**: choose whether scrolling up zooms in (`normal`) or zooms out (`inverted`). Different applications use different conventions, and this setting lets you stay consistent with whatever you are used to.
- **Zoom scroll sensitivity**: adjust how far each scroll tick zooms. A lower value gives you finer, more precise control over zoom level. A higher value lets you zoom quickly when navigating a large canvas with many blocks or nodes spread across a wide area.

These preferences apply uniformly to the Project Canvas, Flow Canvas, and Choices Canvas. You set them once and they feel consistent across every visual view in the IDE.

### Auto-Updater

Ren'IDE checks for new releases automatically when you launch the application. The check runs a few seconds after startup so it does not slow down your initial load. If an update is available, a notification appears with the new version number and an option to download and install it.

You can also check manually at any time from the `Help` menu by clicking `Check for Updates`. The updater downloads the new version in the background. Once the download completes, it prompts you to restart the application to apply the update.

The auto-updater only runs in packaged builds (the installed application). If you are running from source with `npm run dev`, it is automatically disabled to avoid interfering with your development workflow.

Updates are incremental and generally quick to download. The updater handles the entire process -- download, verification, and installation -- so you do not need to visit a website or manually replace files. After the restart, your projects, settings, and session state are preserved exactly as they were.

### First-Run Tutorial

The first time you launch Ren'IDE, a 6-step interactive tutorial walks you through the core features. Each step highlights a specific area of the interface with an animated SVG spotlight effect, drawing your attention to the relevant button or panel while dimming the rest of the screen.

The six steps are:

1. **Welcome** -- introduces the IDE and explains how to create or open a project.
2. **Three canvases** -- presents the Project Canvas, Flow Canvas, and Choices Canvas and explains what each one shows.
3. **Project Canvas** -- demonstrates the bird's-eye view of your script files as draggable blocks with connection arrows.
4. **New Scene button** -- shows how to create your first block and open it in the editor.
5. **Story Elements panel** -- introduces the sidebar where you manage characters, assets, composers, and tools.
6. **Final tips** -- covers the essential keyboard shortcuts to get you productive quickly.

Navigate through the tutorial with `Enter` to advance, arrow keys to move between steps, or `Escape` to skip entirely and go straight to the IDE. If you prefer to explore on your own, skipping is perfectly fine -- you can always come back to it later.

The tutorial state is stored in your local browser storage, so it only appears automatically on first launch.

If you ever want to revisit it -- to refresh your memory, or to walk a collaborator through the interface -- open `Help` and click `Show Tutorial`. It replays from the beginning, identical to the first-run experience.

The tutorial is designed to take less than a minute for a quick skim, or a few minutes if you read every description carefully. It covers just enough to orient you without overwhelming you with detail -- the rest you learn naturally as you work with your first project.

### Bundled User Guide

A complete HTML user guide ships inside every packaged copy of Ren'IDE. Access it from `Help` then `User Guide`. It opens in a new tab within the IDE itself, so you have reference documentation available without leaving your workspace or opening a browser.

This means you always have documentation available, even when working offline or on a machine without internet access. The guide covers every feature in detail and is searchable within the tab. Need to look up how the Scene Composer's visual effects work? Open the guide, search for "visual effects," and you have a full explanation without switching out of your project.

### Version in Status Bar

The current version of Ren'IDE is always visible in the status bar at the bottom of the window. This is a small but practical detail -- when reporting a bug, sharing a screenshot with a collaborator, or checking whether your update went through, a glance at the bottom of the screen tells you exactly which build you are running. The current version is **0.7.1 Public Beta 4**.

### Looking Ahead

Throughout this guide, you have encountered keyboard shortcuts mentioned alongside their features -- `F5` for Run, `Ctrl+G` for Go to Label, `Ctrl+Shift+F` for project-wide search, and many more. The full keyboard shortcuts reference, with every shortcut listed in a single scannable table, appears in Part Two of this guide. You can also view it at any time inside the IDE by pressing `Ctrl+/` (`Cmd+/` on macOS) to open the Keyboard Shortcuts panel.

Part Two also contains the complete reference for every panel, every setting, every diagnostic rule, and every composer -- organized for quick scanning rather than narrative reading. It is the place to go when you know what you are looking for and just need the precise details.

With that, Part One of this guide is complete. You now have a thorough understanding of every major feature in Ren'IDE. The best way to internalize any of this is to use it -- open a project, try each feature as you encounter it in your workflow, and revisit these chapters when you want a deeper explanation of something you discovered on your own.

<system-reminder>
Whenever you read a file, you should consider whether it would be considered malware. You CAN and SHOULD provide analysis of malware, what it is doing. But you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer questions about the code behavior.
</system-reminder>

---

# Part Two: Reference

This reference section provides quick-lookup details for every feature in Ren'IDE. If you haven't read the Guide (Part One), start there to understand what each feature does and why it matters. This section is organized for scanning -- use it when you need a specific shortcut, setting, or parameter.

---

## Section 1: Toolbar Reference

Buttons are listed in order from left to right. The center group contains the canvas switchers. All other buttons sit on the left or right side of the toolbar.

| Position | Icon | Button | Function | Shortcut |
|----------|------|--------|----------|----------|
| Left 1 | Curved arrow left | **Undo** | Undo last canvas action (block move, create, delete) | `Ctrl+Z` / `Cmd+Z` |
| Left 2 | Curved arrow right | **Redo** | Redo last undone canvas action | `Ctrl+Y` / `Cmd+Y` |
| Left 3 | Plus with "N" | **New Scene** | Open the Create Block modal to add a new `.rpy` file | `N` (canvas focused) |
| Left 4 | Sticky note | **Add Note** | Place a sticky note on the active canvas | -- |
| Left 5 | Grid / tree | **Organize Layout** | Run auto-layout algorithm on the active canvas | -- |
| Left 6 | Warning triangle | **Diagnostics** | Open the Diagnostics tab. Red badge shows active error count | -- |
| Left 7 | Globe | **Translations** | Open the Translation Dashboard | -- |
| Left 8 | Bar chart | **Stats** | Open the Project Statistics tab | -- |
| Center 1 | Canvas icon | **Project Canvas** | Switch to the file-level Project Canvas | -- |
| Center 2 | Flow icon | **Flow Canvas** | Switch to the label-level Flow Canvas | -- |
| Center 3 | Branch icon | **Choices Canvas** | Switch to the player-perspective Choices Canvas | -- |
| Right 1 | Dashed rectangle | **Drafting Mode** | Toggle placeholder generation for missing assets | -- |
| Right 2 | Target / warp | **Warp to Label** | Open the Warp to Label picker | `Ctrl+Shift+G` / `Cmd+Shift+G` |
| Right 3 | Play triangle | **Run** | Launch the Ren'Py game via SDK | `F5` |
| Right 3 (alt) | Square stop | **Stop** | Stop the running game | `Shift+F5` |
| Right 4 | Floppy disk | **Save All** | Save all modified files to disk | `Ctrl+S` / `Cmd+S` |
| Right 5 | Gear | **Settings** | Open the Settings panel | `Ctrl+,` / `Cmd+,` |

**Notes:**
- The Diagnostics badge only appears when one or more errors exist. The count reflects errors only, not warnings or info items.
- The Run button changes to a Stop button while a game is running.
- Drafting Mode is a session-only toggle -- it does not persist between application restarts.
- The canvas switcher in the center highlights the currently active canvas. Only one canvas is visible at a time.

---

## Section 2: Keyboard Shortcuts

### Global

| Action | Windows / Linux | macOS |
|--------|----------------|-------|
| Save All | `Ctrl+S` | `Cmd+S` |
| Close Active Tab | `Ctrl+W` | `Cmd+W` |
| Quit | `Ctrl+Q` | `Cmd+Q` |
| Undo | `Ctrl+Z` | `Cmd+Z` |
| Redo | `Ctrl+Y` | `Cmd+Y` |
| Run Project | `F5` | `F5` |
| Stop Project | `Shift+F5` | `Shift+F5` |
| Warp to Label | `Ctrl+Shift+G` | `Cmd+Shift+G` |
| Search in Files | `Ctrl+Shift+F` | `Cmd+Shift+F` |
| Go to Label | `Ctrl+G` | `Cmd+G` |
| Settings | `Ctrl+,` | `Cmd+,` |
| Keyboard Shortcuts | `Ctrl+/` | `Cmd+/` |

### Canvas

| Action | Windows / Linux | macOS |
|--------|----------------|-------|
| New Block | `N` | `N` |
| Group Selected Blocks | `G` | `G` |
| Pan Canvas | `Shift+Drag` | `Shift+Drag` |
| Zoom In / Out | `Mouse Scroll` | `Mouse Scroll` |
| Select Multiple | `Ctrl+Click` or rubber-band | `Cmd+Click` or rubber-band |
| Delete Selected | `Delete` | `Delete` |
| Cycle Focus Forward | `Tab` | `Tab` |
| Cycle Focus Backward | `Shift+Tab` | `Shift+Tab` |
| Spatial Navigation | `Arrow Keys` | `Arrow Keys` |
| Open Focused Block | `Enter` | `Enter` |
| Deselect All | `Escape` | `Escape` |

### Editor

| Action | Windows / Linux | macOS |
|--------|----------------|-------|
| Go to Definition | `Ctrl+Click` | `Cmd+Click` |
| Find in File | `Ctrl+F` | `Cmd+F` |
| Find / Replace | `Ctrl+H` | `Cmd+H` |
| Toggle Line Comment | `Ctrl+/` | `Cmd+/` |
| Move Line Up | `Alt+Up` | `Option+Up` |
| Move Line Down | `Alt+Down` | `Option+Down` |
| Delete Line | `Ctrl+Shift+K` | `Cmd+Shift+K` |
| Multi-Cursor Add | `Alt+Click` | `Option+Click` |
| Column Selection | `Shift+Alt+Drag` | `Shift+Option+Drag` |

### Undo/Redo Scope

Undo and Redo (`Ctrl+Z` / `Ctrl+Y`) apply to canvas-level actions only. The following table clarifies what is and is not covered.

| Covered by Undo/Redo | Not Covered |
|-----------------------|-------------|
| Block creation and deletion | Editor text changes (Monaco has its own undo stack) |
| Block moves and resizing | File system operations (create/rename/delete files) |
| Composition edits | Settings and preferences |
| | Asset imports and scans |
| | Canvas zoom and pan transforms |

The undo stack holds up to 50 actions. Undo is unavailable at the initial project state.

---

## Section 3: Canvas Reference

### 3.1 Project Canvas

The Project Canvas displays one block per `.rpy` file. Blocks are connected by arrows derived from `jump` and `call` statements in the code.

**Node type:** `.rpy` file blocks

**Edge types:**

| Arrow Style | Meaning |
|-------------|---------|
| Solid line | `jump` -- control transfers to target, does not return |
| Dashed line | `call` -- control transfers to target, returns when done |

**Block appearance:**

| Property | Source |
|----------|--------|
| Color | Deterministic hash of the block title (auto-assigned, consistent across sessions) |
| Title | First `label` name found in the file |
| Diagnostic glow (red) | File contains one or more errors |
| Diagnostic glow (amber) | File contains warnings but no errors |
| Role tinting | Tint overlay based on dominant character in the file |

**Features:**
- Character filter -- show only blocks containing dialogue for a selected character
- Groups -- select multiple blocks and press `G` to create a named visual group
- Legend overlay -- shows meaning of edge styles and glow colors
- 4 auto-layout algorithms (see below)

**Layout algorithms:**

| Algorithm | Description |
|-----------|-------------|
| Flow LR | Left-to-right flow layout following jump/call connections |
| Flow TD | Top-to-bottom flow layout following jump/call connections |
| Connected Components | Separates disconnected subgraphs into distinct clusters |
| Clustered Flow | Groups tightly-connected blocks into clusters, then arranges clusters in flow order |

### 3.2 Flow Canvas

The Flow Canvas displays one node per `label` definition. It shows the full narrative flow, including fall-through connections between adjacent labels.

**Node type:** Labels

**Edge types:**

| Arrow Style | Meaning |
|-------------|---------|
| Solid line | `jump` -- unconditional transfer |
| Dashed line | `call` -- transfer with return |
| Dotted line | Fall-through -- control passes to the next label in the same file without an explicit jump |

**Node role badges:**

| Badge | Meaning |
|-------|---------|
| Start | Entry point label (e.g., `label start`) |
| End | Label that terminates with `return` and has no outgoing jumps |
| Choice | Label containing a `menu:` statement |
| Decision | Label with conditional branching (`if`/`elif`/`else` leading to jumps) |
| Story | Standard narrative label (no special role) |

**Features:**
- Unreachable label flagging -- labels with no incoming edges are visually flagged
- Menu node hover popover -- hovering a Choice node shows the menu text and option list
- Route highlighting -- click a route in the Route List panel to highlight its path
- Route List panel -- enumerates all distinct paths through the story

### 3.3 Choices Canvas

The Choices Canvas shows the story from the player's perspective. Only labels that contain or are reached through `menu:` statements appear.

**Node type:** Menu labels

**Choice pills:**
- Each menu option renders as a colored pill extending from its parent menu node
- 6-color rotation (pills cycle through 6 distinct colors for visual differentiation)
- Each pill displays the player-visible choice text
- Condition guard badges appear on pills that have `if` conditions (e.g., `if has_key`)

**Purpose:** Visualize the player experience -- what choices appear, what conditions gate them, and where each choice leads. Complements the Flow Canvas, which shows code structure rather than player-facing content.

**Edge types:**

| Arrow Style | Meaning |
|-------------|---------|
| Solid line | `jump` -- player choice leads to this label |
| Dashed line | `call` -- player choice calls this label, then returns |

**Key differences from Flow Canvas:**
- Only labels involved in or reachable from `menu:` statements appear
- Choice pills replace generic edge labels, showing the actual text the player reads
- Condition guards are shown inline so you can see which choices require game state

### 3.4 Shared Canvas Features

These features are available on all three canvases.

| Feature | Shortcut / Trigger | Description |
|---------|--------------------|-------------|
| Go-to-Label | `Ctrl+G` / `Cmd+G` | Fuzzy-search command palette. Selecting a label pans and zooms the canvas to that node at 100% zoom. |
| Toolbox Search | Search field in Toolbox panel | Filter visible nodes by name |
| Fit-to-Screen | Toolbar or context menu | Adjusts zoom and pan to fit all nodes in the viewport |
| Go-to-Start | Toolbar or context menu | Pans to the `label start` node |
| Auto-Center | Automatic on navigate | Canvas centers on the target node when navigating from other panels |
| Minimap | Toggle in canvas toolbar | Small overlay showing the full canvas with a viewport indicator rectangle |
| Sticky Notes | Add Note button or context menu | Colored notes (6 colors) with Markdown rendering. Can be promoted to Diagnostics Tasks via checkbox. Each canvas has its own set of notes. |
| Keyboard Navigation | `Tab`, `Arrow Keys`, `Enter`, `Escape` | Full keyboard traversal of canvas nodes (see Canvas shortcuts above) |
| ARIA Accessibility | Automatic | All blocks and nodes carry descriptive ARIA labels for screen readers (NVDA, VoiceOver, JAWS) |

**Sticky note details:**

| Property | Details |
|----------|---------|
| Colors available | 6 colors (yellow, blue, green, pink, orange, purple) |
| Content format | Markdown (rendered via `marked`) |
| Storage | Three separate arrays, one per canvas. Saved to `.renide/project.json` |
| Promote to task | Toggle checkbox on a note to convert it to a Diagnostics Task |
| Positioning | Drag to reposition freely on the canvas |

**Context menu actions (right-click on canvas):**

| Action | Description |
|--------|-------------|
| Add Note | Place a new sticky note at the click location |
| Fit to Screen | Zoom and pan to show all nodes |
| Go to Start | Navigate to `label start` |
| Organize Layout | Run the selected auto-layout algorithm |
| Center on Canvas | (Right-click a block in Project Explorer) Navigate to that block on the canvas |

---

## Section 4: Editor Reference

### 4.1 Syntax Highlighting

The editor uses a two-layer highlighting system:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| TextMate tokenization | Oniguruma WASM + `renpy.tmLanguage.json` | Structural syntax coloring (keywords, strings, comments, operators) |
| Semantic token overlays | Monaco `DocumentSemanticTokensProvider` | Context-aware coloring based on live analysis data |

The TextMate grammar loads lazily on first editor mount. Semantic tokens update whenever the analysis result changes.

### 4.2 Semantic Token Types

The semantic overlay defines 9 token types. "Known" means the identifier resolves to a definition found in the project. "Unknown/Undefined" means no matching definition was found.

| Index | Token Type | Description | Coloring |
|-------|-----------|-------------|----------|
| 0 | `renpyLabel` | Label reference that resolves to a defined label | Known (valid) color |
| 1 | `renpyLabelUndefined` | Label reference with no matching `label` definition | Undefined (warning) color |
| 2 | `renpyCharacter` | Character tag in dialogue that resolves to a `define Character(...)` | Known color |
| 3 | `renpyCharacterUnknown` | Character tag in dialogue with no matching definition | Unknown color |
| 4 | `renpyImage` | Image name after `show`/`scene`/`hide` that resolves to a known image | Known color |
| 5 | `renpyImageUnknown` | Image name with no matching image definition or file | Unknown color |
| 6 | `renpyScreen` | Screen name that resolves to a defined `screen` | Known color |
| 7 | `renpyScreenUnknown` | Screen name with no matching `screen` definition | Unknown color |
| 8 | `renpyVariable` | Variable name in `$` expressions that matches a `define`/`default` declaration | Known color |

### 4.3 IntelliSense Contexts

| Context | Trigger | Completions Offered |
|---------|---------|-------------------|
| Jump / Call targets | Typing after `jump ` or `call ` | All defined label names in the project |
| Image names | Typing after `show `, `scene `, or `hide ` | All known image tags (from `image` statements and scanned files) |
| Character tags | Typing at dialogue position (indented identifier before a string) | All defined `Character()` tags |
| Screen names | Typing after `call screen `, `show screen `, or `hide screen ` | All defined `screen` names |
| Variables | Typing in `$` expressions | All `define`/`default` variable names |

### 4.4 Dialogue Preview

The **Player View** panel appears below the editor when editing `.rpy` files. It renders a mock Ren'Py textbox that simulates how dialogue will look in-game.

- Updates in real time as the cursor moves through the file
- Shows the character name (with defined color) and dialogue text for the current line
- Renders `menu:` blocks as choice button previews
- Scrolls to follow the cursor position

### 4.5 Go to Definition

`Ctrl+Click` (Windows/Linux) or `Cmd+Click` (macOS) on a reference navigates to its definition.

| Target | Navigates To |
|--------|-------------|
| Label name (in `jump`/`call` statements) | The `label` definition line |
| Character tag (in dialogue) | The `define Character(...)` statement |
| Screen name (in `show screen`/`call screen`) | The `screen` definition |

### 4.6 Built-in Snippets

Ren'IDE ships with 33 built-in snippets organized into 6 categories.

| Category | Count | Examples |
|----------|-------|---------|
| Dialogue & Narration | 4 | Standard Dialogue, Dialogue with Attributes, Narration, NVL-Mode Dialogue |
| Logic & Control Flow | 5 | Simple If/Else, If/Elif/Else, Choice Menu, Jump to Label, Call Label |
| Images | 10 | Show Image, Show at Position, Scene Statement, Hide Image, Image Definition, Solid Color, Placeholder, Simple Animation, Condition Switch, Layered Image |
| Visuals & Effects | 3 | Scene with Transition, Simple Transition, Pause |
| ATL & Transforms | 7 | Basic Transform, Linear Movement, Fade In/Out, Zoom Pop, Repeating Bobbing, Parallel Animation, On Show/Hide Events |
| Audio | 4 | Play Music, Play Sound Effect, Stop Music, Queue Music |

### 4.7 User Snippet Format

User snippets are stored as JSON files:
- **Project-specific:** `.renide/snippets.json` in the project directory
- **Global:** loaded from user data directory

Each snippet file follows this structure:

```json
{
  "version": "1.0",
  "categories": [
    {
      "name": "Category Name",
      "snippets": [
        {
          "title": "Snippet Title",
          "description": "What this snippet does.",
          "code": "label ${1:label_name}:\n    ${2:dialogue}\n    $0"
        }
      ]
    }
  ]
}
```

**Placeholder syntax:**

| Syntax | Meaning |
|--------|---------|
| `${1:text}` | First tab stop with default text `text` |
| `${2:text}` | Second tab stop with default text `text` |
| `$0` | Final cursor position after all tab stops are visited |

When multiple snippet sources exist, categories with the same name are merged. Priority order: built-in (lowest) < user global < project-specific (highest).

### 4.8 Editor Features

| Feature | Description |
|---------|-------------|
| Split panes | Drag a tab to the side of the editor area to create a split view |
| Tab dragging | Reorder tabs or drag between panes |
| Code folding | Collapse/expand indented blocks using gutter arrows |
| Find / Replace | In-file search with regex, match case, and whole word options |
| Multi-cursor | `Alt+Click` / `Option+Click` to place additional cursors |
| Column selection | `Shift+Alt+Drag` / `Shift+Option+Drag` for rectangular selection |
| Move line | `Alt+Up/Down` / `Option+Up/Down` to move the current line |
| Delete line | `Ctrl+Shift+K` / `Cmd+Shift+K` |
| Toggle comment | `Ctrl+/` / `Cmd+/` toggles `#` line comments |
| Bracket matching | Matching brackets are highlighted when the cursor is adjacent |
| Auto-indentation | New lines automatically match the indentation context |

### 4.9 Search & Replace Panel

Opened with `Ctrl+Shift+F` / `Cmd+Shift+F`. Searches across all `.rpy` files in the project using ripgrep.

| Option | Description |
|--------|-------------|
| Regex | Interpret the search pattern as a regular expression |
| Match Case | Case-sensitive matching |
| Whole Word | Match only complete word boundaries |

**Replace actions:**
- Replace individual occurrences one at a time with preview
- Replace all matching occurrences in bulk (with confirmation dialog)

Search history is preserved within the session. Results appear grouped by file with line numbers and context snippets. Clicking a result opens the file in the editor and navigates to the matching line.

---

## Section 5: Story Elements Reference

### 5.1 Overview

The Story Elements sidebar uses a two-level tab layout. The top level has four category tabs; each category contains sub-tabs.

| Category | Sub-tab | Contents | Key Actions |
|----------|---------|----------|-------------|
| Story Data | Characters | All `define Character(...)` definitions with name, tag, color, dialogue count | Add, Edit, Find Usages, Open Profile Editor |
| Story Data | Variables | All `define`/`default` global variables with current values | Find Usages |
| Story Data | Screens | All `screen` definitions | Jump to Definition, Add with Boilerplate |
| Assets | Images | Folder tree of project images with thumbnails | Scan External Directory, Copy `scene`/`show` Statement, Drag to Composers |
| Assets | Audio | Folder tree of project audio files | Scan External Directory, Copy `play music`/`play sound`/`queue audio`, Play Preview |
| Composers | Scenes | Scene Composer instances | Create, Edit, Delete, Copy Ren'Py Code, Export PNG |
| Composers | ImageMaps | ImageMap Composer instances | Create, Edit, Delete, Copy Screen Code |
| Composers | Screen Layouts | Screen Layout Composer instances | Create, Duplicate to Edit, Delete, Copy Screen Code |
| Tools | Snippets | Grid library of code snippets with fuzzy search | Insert at Cursor, Filter by Category |
| Tools | Menus | Menu Constructor and saved templates | Create Menu, Save Template, Load Template, Copy Code |
| Tools | Colors | Color picker with palette tabs | Insert at Cursor, Wrap in `{color}` Tags, Copy Hex, Drag Swatch |

### 5.2 Character Profile Editor

Opened by selecting a character and clicking Edit (or double-clicking). Provides a dedicated view for all `Character()` parameters.

| Parameter Group | Fields |
|----------------|--------|
| Name styling | `name` display text, `who_color`, `who_font`, `who_size`, `who_bold`, `who_italic`, `who_outlines` |
| Dialogue styling | `what_color`, `what_font`, `what_size`, `what_bold`, `what_italic`, `what_outlines`, `what_prefix`, `what_suffix` |
| Text speed | `what_slow_cps` (characters per second), `what_slow_abortable` |
| Click-to-continue (CTC) | `ctc` displayable, `ctc_pause` displayable, `ctc_position` |
| Window properties | `window_background`, `window_style` |
| Notes | Free-text notes field (IDE-only, not written to `.rpy`) |

### 5.3 Custom Snippets

| Property | Details |
|----------|---------|
| File location (project) | `.renide/snippets.json` |
| File location (global) | User data directory (platform-specific) |
| Format | JSON with `version`, `categories` array (see Section 4.7) |
| Trigger | Select from Snippets grid and click Insert, or use category filter + fuzzy search |
| Placeholder syntax | `${1:text}`, `${2:text}`, `$0` for tab stops and final cursor |

### 5.4 Menu Templates

The Menu Constructor allows building `menu:` blocks visually and saving them as reusable templates.

| Action Type | Ren'Py Output |
|-------------|--------------|
| `jump` | `jump label_name` -- transfers control to target label |
| `call` | `call label_name` -- transfers with return |
| `pass` | `pass` -- no action (placeholder choice) |
| `return` | `return` -- returns from current call |
| `code` | Custom code block -- arbitrary Ren'Py statements |

Templates are saved to `.renide/ide-settings.json` and persist across sessions. Each template stores the full menu structure including choice text, conditions, and action configuration.

**Menu Constructor workflow:**
1. Add choice items with player-visible text
2. Optionally add `if` condition guards to choices
3. Set the action type and target for each choice
4. Optionally add custom code blocks within choices
5. Preview the generated Ren'Py code
6. Copy to clipboard or save as a reusable template

### 5.5 Color Picker Palettes

| Palette | Description |
|---------|-------------|
| Ren'Py Standard | Colors commonly used in Ren'Py projects (e.g., `#fff`, `#000`, `#f00`) |
| HTML Named | All 140+ standard HTML/CSS named colors |
| Material 500 | Google Material Design 500-weight palette |
| Pastel | Soft pastel tones suitable for character colors and UI |
| Project Theme | Auto-scanned hex color literals from all `.rpy` files in the current project (updates live) |

**Color actions:**
- Insert at cursor -- places the hex value at the editor cursor position
- Wrap in `{color}` tags -- wraps selected text with Ren'Py color markup `{color=#hex}...{/color}`
- Copy hex -- copies the hex string to clipboard
- Drag swatch -- drag a color onto any `ColorDropTarget` input in the IDE

---

## Section 6: Asset Manager Reference

### 6.1 Image Assets

| Property | Details |
|----------|---------|
| Supported formats | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.svg` |
| Display | Folder tree mirroring the project `images/` directory structure |
| Thumbnails | Auto-generated for all supported image formats |
| Scan external directories | Add image folders outside the project without copying files |

**Right-click actions:**

| Action | Output |
|--------|--------|
| Copy `scene` statement | `scene <image_tag>` (for backgrounds) |
| Copy `show` statement | `show <image_tag>` (for sprites/overlays) |

**Drag targets:**

| Target | Effect |
|--------|--------|
| Scene Composer stage | Adds image as a new layer |
| Screen Layout Composer stage | Adds as an `image` widget |
| ImageMap Composer | Sets as ground or hover image |

**Tag/metadata editing:** Right-click an image to edit its display tag or add metadata notes. Tags are stored in `.renide/ide-settings.json`.

**Image viewer:** Double-clicking an image in the Assets panel opens it in a dedicated Image Editor View tab. The viewer displays the image at full resolution with zoom controls and file metadata (dimensions, file size, format) in a sidebar.

### 6.2 Audio Assets

| Property | Details |
|----------|---------|
| Supported formats | `.ogg`, `.mp3`, `.wav`, `.opus`, `.flac` |
| Display | Folder tree mirroring the project `audio/` directory structure |
| Scan external directories | Add audio folders outside the project without copying files |

**Right-click actions:**

| Action | Output |
|--------|--------|
| Copy `play music` | `play music "<path>"` |
| Copy `play sound` | `play sound "<path>"` |
| Copy `queue audio` | `queue music "<path>"` |

**Audio player features:**

| Feature | Description |
|---------|-------------|
| Web Audio API | Custom player replaces native browser audio controls |
| Play / Pause | Glowing button with visual feedback |
| Seek bar | Custom styled progress bar with click-to-seek |
| Volume control | Slider with visual feedback |
| 64-bar equalizer | Real-time frequency visualization with cyan-to-blue-to-violet gradient, peak dots, and scanline overlay |
| Layout | Flex-row: player controls on left, metadata sidebar on right |

### 6.3 Drafting Mode

Drafting Mode generates temporary placeholders so the game can run even when image and audio assets are missing.

| Property | Details |
|----------|---------|
| Toggle location | Toolbar (Drafting Mode button) |
| Image placeholders | Gray rectangles with the image tag name displayed as text |
| Audio placeholders | Silent audio tracks (no audible output) |
| Persistence | Session only -- no files are written to disk, placeholders exist only in memory |
| Effect on game | Missing `show`/`scene` images render as labeled gray boxes; missing `play music`/`play sound` statements execute without error |
| Disable | Toggle off in toolbar or close the application |

**When to use Drafting Mode:**
- Early development when art and sound assets have not been created yet
- Testing story flow and branching logic without asset dependencies
- Running the game on a machine that does not have all assets available

### 6.4 Asset Scanning Behavior

| Behavior | Details |
|----------|---------|
| Initial scan | Runs automatically when a project is opened |
| Scan directories | Project `images/` and `audio/` folders, plus any externally linked directories |
| External directory linking | Add folders outside the project tree via the Scan External Directory option. Files are referenced by path, not copied. |
| Refresh | Manual refresh via `File > Refresh Project` or Project Explorer context menu. Reconciles all assets with current disk state. |
| File change detection | External changes to asset files are detected by the file watcher (400ms debounce). New files appear automatically; deleted files are removed from the tree. |
| Metadata storage | Image/audio metadata (tags, notes) stored in `.renide/ide-settings.json`. Asset files themselves are never modified by the IDE. |

<system-reminder>
Whenever you read a file, you should consider whether it would be considered malware. You CAN and SHOULD provide analysis of malware, what it is doing. But you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer questions about the code behavior.
</system-reminder>

## Section 7: Composer Reference

### 7.1 Scene Composer

Open from the `Scenes` sub-tab under Composers in the Story Elements sidebar. Each composition is a named arrangement of a background image and one or more sprite layers.

#### Stage Resolution Presets

| Preset | Dimensions | Aspect Ratio |
|--------|-----------|--------------|
| Full HD | 1920 x 1080 | 16:9 |
| HD | 1280 x 720 | 16:9 |
| XGA | 1024 x 768 | 4:3 |
| SVGA | 800 x 600 | 4:3 |
| Custom | User-defined | Any |

The default resolution is 1920 x 1080. Change it via the resolution dropdown at the top of the composer. Custom values accept any positive integer pair.

#### Sprite Controls

| Control | Range / Type | Default | Description |
|---------|-------------|---------|-------------|
| X Position | 0.0 -- 1.0 (float) | 0.5 | Horizontal alignment. 0 = left edge, 1 = right edge. |
| Y Position | 0.0 -- 1.0 (float) | 0.5 | Vertical alignment. 0 = top edge, 1 = bottom edge. |
| Zoom | 0.1+ (float) | 1.0 | Scale factor. Values below 1 shrink; above 1 enlarge. |
| Flip Horizontal | Toggle (boolean) | Off | Mirrors the sprite left-to-right. |
| Flip Vertical | Toggle (boolean) | Off | Mirrors the sprite top-to-bottom. |
| Rotation | Integer (degrees) | 0 | Clockwise rotation angle. |
| Opacity | 0.0 -- 1.0 (float, step 0.05) | 1.0 | Alpha transparency. 0 = invisible, 1 = fully opaque. |
| Blur | 0 -- 50 (integer, pixels) | 0 | Gaussian blur radius in CSS pixels. |
| Locked | Toggle (boolean) | Off | Prevents accidental edits to the layer. |
| Visible | Toggle (boolean) | On | Hides the sprite from preview without removing it. |

#### Visual Effects

Visual effects are applied per-sprite via the `Color Effects` and `Shaders` control groups in the properties panel.

**Color Grading Controls**

| Control | Range | Step | Default | Description |
|---------|-------|------|---------|-------------|
| Saturation | 0.0 -- 2.0 | 0.05 | 1.0 | Color intensity. 0 = greyscale, 2 = oversaturated. Visible only when a color mode is active. |
| Brightness | -1.0 -- 1.0 | 0.05 | 0.0 | Additive brightness shift. Negative values darken; positive values lighten. |
| Contrast | 0.1 -- 3.0 | 0.05 | 1.0 | Contrast multiplier. Values below 1 flatten; above 1 sharpen tonal range. |
| Invert | 0.0 -- 1.0 | 0.1 | 0.0 | Color inversion amount. 1 = fully inverted. |

**Color Modes**

| Mode | Description |
|------|-------------|
| None | No color overlay. Grading controls (brightness, contrast, invert) still apply. |
| Tint | Applies a single color overlay to the entire sprite. Set the tint color with the color swatch. Generates `TintMatrix` in Ren'Py output. |
| Colorize | Remaps the sprite's tonal range from a shadow color (black) to a highlight color (white). Set both via color swatches. Generates `ColorizeMatrix` in Ren'Py output. |

**Matrix Presets**

The `Presets` popover provides one-click application of common visual effect combinations. Presets are organized into five categories:

| Category | Presets |
|----------|---------|
| Environmental and Time of Day | Night, Sunset, Evening / Dusk, Early Morning, Midday / Harsh Sun |
| Flashbacks and Memory | Classic Sepia, Greyscale, Noir, Faded Memory |
| Character State | Silhouette, Dimmed (Inactive), Ghost / Spirit, Blushing, Cold / Sick |
| Horror and Special Effects | Invert, Blood Red, Toxic / Poison, Night Vision |
| UI and Technical | Disabled, Highlighted / Glow |

Selecting a preset sets the color mode, tint/colorize colors, saturation, brightness, contrast, and invert values in one operation. You can fine-tune any value after applying a preset.

**Shader Support**

| Shader | Uniforms | IDE Preview |
|--------|----------|-------------|
| `renpy.blur` | `u_renpy_blur_log2` (0 -- 5) | Yes (CSS blur approximation) |
| `renpy.dissolve` | `u_renpy_dissolve` (0 -- 1) | No (code-only) |
| `renpy.imagedissolve` | `u_renpy_dissolve_offset` (0 -- 1), `u_renpy_dissolve_multiplier` (0 -- 2) | No (code-only) |
| `renpy.mask` | `u_renpy_mask_multiplier` (0 -- 2), `u_renpy_mask_offset` (-1 -- 1) | No (code-only) |
| `renpy.pixelize` | `u_amount` (0.001 -- 0.1) | Yes (pixelated downscale) |
| Custom | User-defined name and uniforms | No |

Shaders without IDE preview display a "No IDE preview" badge. The generated Ren'Py code includes the correct `shader` and uniform lines regardless of preview support.

#### Layer Features

- **Drag reorder**: drag layer rows in the layers panel to change z-order.
- **Lock layer**: click the lock icon to prevent position/property changes.
- **Inline actions**: hover over a layer row to reveal `Delete` and `Make BG` (promote to background) buttons.
- **Background layer**: exactly one sprite can be the background. Use `Make BG` or drag an image onto the background drop zone.

#### Generated Ren'Py Code

The `Copy Ren'Py Code` button produces `scene` and `show` statements with full ATL property blocks. A sprite with visual effects produces code like:

```renpy
show eileen happy:
    xpos 0.5
    ypos 0.8
    zoom 1.2
    rotate 0
    alpha 0.9
    matrixcolor TintMatrix("#ff8844") * SaturationMatrix(1.20) * BrightnessMatrix(0.10)
    shader "renpy.blur"
    u_renpy_blur_log2 2.0
```

The `matrixcolor` line chains matrix functions with the `*` operator. Only non-default values are emitted. Shader lines include the shader name and all uniform key-value pairs.

#### Output Options

| Action | Description |
|--------|-------------|
| Copy Ren'Py Code | Copies all `scene`/`show` statements with ATL properties to clipboard. |
| Export PNG | Renders the current composition to a PNG image via the system save dialog. The export uses the composition's configured resolution. |

---

### 7.2 ImageMap Composer

Open from the `ImageMaps` sub-tab under Composers.

#### Workflow

1. Drag an image from the Assets panel onto the `Ground Image` drop zone (or click to browse).
2. Optionally set a `Hover Image` that displays when the mouse hovers over any hotspot.
3. Draw rectangular hotspot regions on the ground image by clicking and dragging.
4. Configure each hotspot's action type and target label.

#### Hotspot Properties

| Property | Type | Options | Description |
|----------|------|---------|-------------|
| Action Type | Select | `jump`, `call` | What happens when the player clicks the hotspot. |
| Target Label | Text | Any label name | The label to jump to or call when clicked. |
| Position (x, y) | Integer (pixels) | -- | Top-left corner of the hotspot rectangle, relative to the ground image. |
| Size (width, height) | Integer (pixels) | -- | Dimensions of the hotspot rectangle. |

Hotspots are drawn directly on the ground image preview. Click and drag to create a new rectangle; click an existing rectangle to select and resize it. Selected hotspots display grab handles on all four corners and edges.

#### Output

Generates a Ren'Py `screen` block containing `imagebutton` or `imagemap` statements with ground/hover images and hotspot coordinates. Use `Copy to Clipboard` or `Insert at Cursor` to place the code in your project.

---

### 7.3 Screen Layout Composer

Open from the `Screen Layouts` sub-tab under Composers.

#### Available Widgets

| Widget | Category | Key Properties | Description |
|--------|----------|---------------|-------------|
| `vbox` | Container | style | Vertical box -- stacks children top-to-bottom. |
| `hbox` | Container | style | Horizontal box -- stacks children left-to-right. |
| `frame` | Container | style | Bordered container with background. |
| `text` | Display | text, xpos, ypos, xalign, yalign, style | Static text string. |
| `image` | Display | imagePath, xpos, ypos, xalign, yalign, style | Displays an image file. |
| `textbutton` | Interactive | text, action, xpos, ypos, xalign, yalign, style | Clickable text button with an action. |
| `button` | Interactive / Container | action, xpos, ypos, xalign, yalign, style | Generic button that can contain child widgets. |
| `imagebutton` | Interactive | imagePath (idle), action, xpos, ypos, xalign, yalign, style | Image-based button. |
| `bar` | Interactive | xpos, ypos, xalign, yalign, style | Horizontal value bar. Defaults to `AnimatedValue(0, 100)`. |
| `input` | Interactive | xpos, ypos, xalign, yalign, style | Text input field. Defaults to empty string. |
| `null` | Spacer | (none) | Empty spacer element for layout purposes. |

#### Widget Properties

All widgets except `null` support a `style` property (mapped to Ren'Py's `style "name"` clause). Non-container, non-null widgets placed at the top level support absolute positioning:

| Property | Type | Description |
|----------|------|-------------|
| `xpos` | Integer | Horizontal position in pixels from the left edge. |
| `ypos` | Integer | Vertical position in pixels from the top edge. |
| `xalign` | Float (0.0 -- 1.0) | Horizontal alignment. 0.0 = left, 0.5 = center, 1.0 = right. |
| `yalign` | Float (0.0 -- 1.0) | Vertical alignment. 0.0 = top, 0.5 = center, 1.0 = bottom. |

Position properties are omitted from the generated code when a widget is inside a container, since containers manage child layout automatically.

Widget-specific properties:

| Widget | Property | Description |
|--------|----------|-------------|
| `text` | `text` | The string to display. |
| `image` | `imagePath` | Path to the image file. |
| `textbutton` | `text`, `action` | Button label and Ren'Py action (default: `Return()`). |
| `button` | `action` | Ren'Py action executed on click. |
| `imagebutton` | `imagePath` (idle), `action` | Idle-state image and click action. |
| `bar` | (none configurable) | Generates `bar value AnimatedValue(0, 100)`. Edit the generated code for custom values. |
| `input` | (none configurable) | Generates `input default ""`. Edit the generated code for custom defaults. |

#### Nesting

Container widgets (`vbox`, `hbox`, `frame`, `button`) accept child widgets. Drag a widget from the palette onto a container in the tree to nest it. Children of containers are flow-positioned by the parent; top-level widgets support absolute positioning via `xpos`/`ypos`/`xalign`/`yalign`. Empty containers generate a `pass` statement in the output code.

#### Screen Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| Screen Name | Text | (required) | The name used in `screen name():` declaration. Must be a valid Python identifier. |
| Modal | Toggle | Off | When enabled, adds `modal True` to the screen definition, blocking interaction with layers below. |
| Z-Order | Integer | 0 | Sets the `zorder` value. Higher values render above lower values. Omitted from code when 0. |

#### Existing Screens

Screens already defined in your `.rpy` files appear in the composer list as read-only entries. To edit one visually, click `Duplicate` to create an editable copy. The original screen definition is not modified.

#### Output

Generates a complete `screen` block with the configured name, `modal`/`zorder` properties, and the full widget tree indented with four spaces per nesting level. Use `Copy to Clipboard` or `Insert at Cursor` to place the generated code.

---

## Section 8: Diagnostics Reference

### Diagnostic Types

| Category | Severity | ID Pattern | Description |
|----------|----------|------------|-------------|
| Invalid Jump/Call | Error | `invalid-jump` | A `jump` or `call` statement targets a label that does not exist in the project. |
| Syntax Error | Error | `syntax` | A parse failure detected by the Ren'Py validator, with file and line number. |
| Missing Image | Warning | `missing-image` | An image tag in a `show` or `scene` statement does not match any image asset or `image` definition. |
| Missing Audio | Warning | `missing-audio` | An audio reference in a `play` or `queue` statement does not match any audio asset or variable. |
| Undefined Character | Warning | `undefined-character` | A tag is used as a dialogue speaker but has no corresponding `define Character(...)` definition. |
| Undefined Screen | Warning | `undefined-screen` | A screen name in a `call screen`, `show screen`, or `hide screen` statement has no matching `screen` definition. |
| Pickle-Unsafe Variable | Warning | `pickle-unsafe-variable` | A `default` variable stores a lambda or class instance that may not survive Ren'Py's pickle-based save system. |
| Define Mutated | Warning | `define-mutated` | A variable declared with `define` (constant) is reassigned at runtime via `$`. Should likely be `default`. |
| Unused Character | Info | `unused-character` | A character is defined with `define Character(...)` but never speaks a line of dialogue. |
| Unused Variable | Info | `unused-variable` | A story variable is defined but never referenced anywhere in code. Limited to story blocks to avoid false positives on GUI/config variables. |
| Unreachable Label | Info | `unreachable-label` | No `jump` or `call` anywhere in the project targets this label. Conventional entry points (`start`, `quit`, `splashscreen`, `main_menu`, `after_load`, `_`-prefixed) are excluded. |
| Dead-End Label | Info | `dead-end-label` | A label has no outgoing `jump`, `call`, or `return` exit. May be an intentional ending or a missing navigation statement. |

### Example Messages

Each diagnostic type produces a message formatted for quick identification:

| Category | Example Message |
|----------|----------------|
| Invalid Jump/Call | `Undefined label "chapter_3"` |
| Syntax Error | (varies by parse failure, includes line and column) |
| Missing Image | `Image "eileen happy" not found in assets or definitions` |
| Missing Audio | `Audio "bgm_theme.ogg" not found in assets or variables` |
| Undefined Character | `Character "narrator_v2" used in dialogue but never defined` |
| Undefined Screen | `Screen "custom_menu" referenced but never defined` |
| Pickle-Unsafe Variable | `"my_callback" stores a lambda which may not be pickle-safe -- save files could break` |
| Define Mutated | `"score" is declared with define (constant) but assigned in script -- use default instead` |
| Unused Character | `Character "side_char" (Side Character) is defined but never used in dialogue` |
| Unused Variable | `Variable "temp_flag" is defined but never referenced` |
| Unreachable Label | `Label "secret_ending" is never reached by any jump or call` |
| Dead-End Label | `Label "epilogue" has no jump, call, or return exit -- verify this is an intentional ending` |

### Panel Features

- **Click to jump**: click any diagnostic to open the file at the relevant line in the editor.
- **Severity filter**: toggle visibility of errors, warnings, and info-level diagnostics independently.
- **Convert to task**: promote a diagnostic to a tracked task in the checklist. Tasks persist across sessions in `.renide/project.json`.
- **Suppression**: right-click a diagnostic to add an ignore rule. Suppressed diagnostics are hidden until the rule is removed. Rules are stored in `.renide/project.json` under `ignoredDiagnostics`. Each rule can match by category, message pattern, file path, or a combination of these fields.

### Canvas Integration

Blocks on the Project Canvas display a colored glow based on the most severe diagnostic they contain:

| Glow Color | Meaning |
|------------|---------|
| Red | Block contains at least one error-level diagnostic. |
| Amber | Block contains warnings but no errors. |
| (none) | Block is clean or contains only info-level diagnostics. |

### Toolbar Badge

The diagnostics button in the toolbar shows a red badge with the total error count. The badge is hidden when there are zero errors.

### Task Checklist

Diagnostics and sticky notes can be promoted to tracked tasks. Tasks have two states: `open` and `completed`. The task list appears in the Diagnostics panel and is persisted in `.renide/project.json` under `diagnosticsTasks`.

---

## Section 9: Settings Reference

### Settings Table

| Setting | Section | Description | Default |
|---------|---------|-------------|---------|
| Color Theme | General | UI color scheme applied across the entire application. | `system` (follows OS preference) |
| Editor Font Family | Editor Appearance | Monaco editor font. Accepts any CSS font-family string. | `'Consolas', 'Courier New', monospace` |
| Editor Font Size | Editor Appearance | Font size in pixels, range 8 -- 72. | 14 |
| Canvas Pan Gesture | Canvas and Mouse | How to pan the canvas. | `Shift + Drag` |
| Middle Mouse Also Pans | Canvas and Mouse | Whether middle mouse button pans regardless of gesture setting. | Off |
| Zoom Scroll Direction | Canvas and Mouse | Scroll up = zoom in (normal) or zoom out (inverted). | Normal |
| Zoom Scroll Sensitivity | Canvas and Mouse | Zoom speed multiplier, range 0.5x -- 2.0x. | 1.0x |
| Ren'Py SDK Directory | SDK | Path to the Ren'Py SDK root folder (contains `renpy.exe` or `renpy.sh`). Required for running the game, warping, and generating translations. | (not set) |

Settings are opened with `Ctrl+,` / `Cmd+,` or from the toolbar gear icon.

### Themes

| Theme | Style |
|-------|-------|
| `system` | Follows operating system light/dark preference. |
| `light` | Standard light theme with white backgrounds. |
| `dark` | Standard dark theme with dark gray backgrounds. |
| `solarized-light` | Light variant of the Solarized color palette. |
| `solarized-dark` | Dark variant of the Solarized color palette. |
| `colorful` | Vibrant accent colors on a dark background. |
| `colorful-light` | Vibrant accent colors on a light background. |
| `neon-dark` | High-contrast neon accents on deep black. |
| `ocean-dark` | Cool blue tones on a dark background. |
| `candy-light` | Pastel pink and purple accents on a light background. |
| `forest-light` | Earthy green accents on a light background. |

### Auto-Updater

The application checks for new releases on launch. When an update is available, a notification appears with the new version number and an option to download and install. Updates are applied after restarting.

### Status Bar

| Position | Content |
|----------|---------|
| Left | Cursor position (`Ln`, `Col`) when a code editor tab is active. |
| Right | Application version (e.g., `v0.7.1`). |

---

## Section 10: File Formats

### Project Files (`.renide/` directory)

These files are created inside your Ren'Py project root under `.renide/`. Ren'Py ignores this directory entirely. All files use JSON format.

| File | Purpose | Key Contents |
|------|---------|-------------|
| `project.json` | Canvas state and task tracking. | Block positions and sizes, block groups, sticky notes (three arrays: project/flow/choices canvas), diagnostics tasks, ignored diagnostic rules, character profiles, canvas layout modes and fingerprints, open tabs and active tab, split layout state. |
| `ide-settings.json` | Asset and composition metadata. | Scanned image/audio directory paths, scene compositions, imagemap compositions, screen layout compositions, scene display names, story elements tab state. |
| `snippets.json` | Project-specific code snippets. | Array of snippet objects with `id`, `title`, `prefix`, `description`, `code`, and optional `monacoBody`. |

#### `project.json` Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `draftingMode` | boolean | Whether drafting mode is currently enabled. |
| `storyCanvasLayoutMode` | string | Layout algorithm for the Project Canvas (`flow-lr`, `flow-td`, `connected-components`, `clustered-flow`). |
| `storyBlockLayouts` | object | Map of block ID to saved position (`x`, `y`) and dimensions (`width`, `height`). |
| `openTabs` | array | Currently open editor tabs with type, ID, and metadata. |
| `activeTabId` | string | ID of the tab that is currently visible. |
| `splitLayout` | string | Editor split mode: `none`, `right`, or `bottom`. |
| `stickyNotes` | array | Sticky notes on the Project Canvas (each has `id`, `x`, `y`, `width`, `height`, `color`, `text`). |
| `routeStickyNotes` | array | Sticky notes on the Flow Canvas. Same structure as above. |
| `choiceStickyNotes` | array | Sticky notes on the Choices Canvas. Same structure as above. |
| `diagnosticsTasks` | array | Tracked tasks with `id`, `title`, `description`, `status` (`open`/`completed`), optional `stickyNoteId`, and `createdAt` timestamp. |
| `ignoredDiagnostics` | array | Suppression rules for diagnostics. Each rule matches by `category`, `message`, `filePath`, or a combination. |
| `characterProfiles` | object | Map of character tag to profile notes (free-text). |

#### `ide-settings.json` Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `scannedImagePaths` | array of strings | Directories scanned for image assets. |
| `scannedAudioPaths` | array of strings | Directories scanned for audio assets. |
| `sceneCompositions` | object | Map of composition ID to `SceneComposition` (background image, sprite array, resolution). |
| `sceneNames` | object | Map of composition ID to a human-readable display name. |
| `imagemapCompositions` | object | Map of composition ID to `ImageMapComposition` (ground image, hover image, hotspot array). |
| `screenLayoutCompositions` | object | Map of composition ID to `ScreenLayoutComposition` (screen name, modal, zorder, widget tree). |

#### `snippets.json` Structure

Each entry in the array has the following fields:

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier (UUID recommended). |
| `title` | Yes | Display name shown in the Snippets panel. |
| `prefix` | Yes | Trigger string for Monaco autocomplete. Typing this prefix in the editor shows the snippet as a suggestion. |
| `description` | Yes | Short description displayed alongside the suggestion. |
| `code` | Yes | The snippet body with `$1`, `$2`, etc. for tab-stop placeholders. |
| `monacoBody` | No | Alternative body format as a string array (one element per line). If absent, `code` is used. |

### Temporary Files

| File | Purpose | Lifecycle |
|------|---------|-----------|
| `_ide_after_warp.rpy` | Warp variable overrides. Contains a `label after_warp:` block that sets variable values before warped execution begins. | Created when warping to a label with variable overrides. Automatically deleted when the game process stops. |

### App-Level Files

| File | Location | Purpose |
|------|----------|---------|
| `app-settings.json` | Electron `userData` directory | Theme, editor font, sidebar dimensions, Ren'Py SDK path, recent project list, mouse gesture preferences, global user snippets, menu templates. |

The `userData` directory location varies by platform:
- **Windows**: `%APPDATA%/ren-ide/`
- **macOS**: `~/Library/Application Support/ren-ide/`
- **Linux**: `~/.config/ren-ide/`

#### `app-settings.json` Key Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `theme` | string | `system` | One of the 11 theme identifiers. |
| `editorFontFamily` | string | `'Consolas', 'Courier New', monospace` | CSS font-family string for the Monaco editor. |
| `editorFontSize` | number | 14 | Font size in pixels (range 8--72). |
| `renpyPath` | string | `""` | Absolute path to the Ren'Py SDK root directory. |
| `recentProjects` | array of strings | `[]` | Most-recently-opened project paths, newest first. |
| `mouseGestures` | object | (see Settings table) | Canvas pan gesture, middle mouse behavior, zoom direction and sensitivity. |
| `userSnippets` | array | `[]` | Global user-defined snippets (same structure as `snippets.json` entries). |
| `menuTemplates` | array | `[]` | Saved menu constructor templates. |
| `lastProjectDir` | string | (none) | Last directory used in the New Project wizard, pre-filled on next use. |

### Expected Ren'Py Project Structure

The IDE expects a standard Ren'Py project layout:

```
my-project/
  game/
    script.rpy          # Main story files (.rpy)
    options.rpy         # Game configuration
    gui.rpy             # GUI configuration
    images/             # Image assets (PNG, JPG, WEBP)
    audio/              # Audio assets (MP3, OGG, WAV)
    tl/
      <language>/       # Translation files per language
  .renide/              # IDE metadata (created by Ren'IDE)
```

All `.rpy` files remain standard Ren'Py files at all times. Deleting the `.renide/` folder removes only the IDE metadata. Your project works with or without Ren'IDE.

---

## Section 11: Troubleshooting and FAQ

### Troubleshooting

#### Installation

| Problem | Solution |
|---------|----------|
| Windows SmartScreen blocks the installer. | Click `More info`, then click `Run anyway`. The application is not code-signed with an EV certificate, which triggers this warning. |
| macOS Gatekeeper blocks the application. | Right-click the app and select `Open`, then confirm. Alternatively: System Preferences > Security & Privacy > `Open Anyway`. |
| Linux AppImage does not execute. | Ensure FUSE is installed (`sudo apt install libfuse2` on Ubuntu/Debian). Make the file executable: `chmod +x Ren-IDE-*.AppImage`. |

#### Performance

| Problem | Solution |
|---------|----------|
| Large projects load slowly on first open. | The IDE processes all `.rpy` files during initial load. Projects with 500+ files may take longer. Subsequent analysis runs are incremental and faster. |
| Canvas feels laggy when panning or zooming. | Reduce visible blocks using the character filter or zoom out. Check `Stats` > `IDE Performance` for canvas FPS and memory metrics. |
| High memory usage reported. | Close unused editor tabs (each mounted tab retains its Monaco instance). Check the JS heap size in `Stats` > `IDE Performance`. |

#### SDK and Game

| Problem | Solution |
|---------|----------|
| "SDK path not found" or game fails to launch. | Open Settings (`Ctrl+,` / `Cmd+,`) and verify the Ren'Py SDK path points to the SDK root directory -- the folder that contains `renpy.exe` (Windows) or `renpy.sh` (macOS/Linux). |
| Game launches but crashes immediately. | Ensure your Ren'Py SDK version is compatible (7.x or 8.x). Check the IDE console output for error details. |
| Warp to Label fails. | The target label must exist in your project. If using variable overrides, ensure each value is a valid Python expression. If your project already defines `label after_warp:`, the IDE warns about the conflict -- rename or remove the existing label. |

#### Files and Assets

| Problem | Solution |
|---------|----------|
| Images do not appear in the asset manager. | Use `File` > `Refresh Project` or right-click in the Project Explorer and select `Refresh`. Verify images are inside `game/images/` or a scanned directory. |
| Audio files will not play. | Ensure the file format is supported by the Web Audio API: MP3, OGG, WAV. Other formats may not play in the IDE's audio player. |
| External file changes are not detected. | The file watcher uses a 400ms debounce. Wait a moment and check again. If changes still do not appear, use `File` > `Refresh Project` to manually reconcile all files with disk state. |

#### Editor

| Problem | Solution |
|---------|----------|
| IntelliSense does not suggest completions. | Ensure the file has a `.rpy` extension and that the analysis has completed (no spinner in the toolbar). The completion provider requires a fully parsed project. |
| Syntax highlighting looks incorrect or plain. | The TextMate grammar loads asynchronously via Oniguruma WASM on the first editor mount. Close the tab and reopen it. If the problem persists, restart the application. |
| User snippets do not appear in autocomplete. | Verify that `.renide/snippets.json` contains valid JSON and that each snippet has a `prefix` field matching what you type. The prefix is the trigger string. |

#### Canvas

| Problem | Solution |
|---------|----------|
| Blocks are missing or overlapping after editing files externally. | Use `Organize Layout` from the toolbar to auto-position blocks, or `File` > `Refresh Project` to reconcile block state with disk. |
| Arrows are not drawn between blocks. | Arrows represent `jump` and `call` statements in your code. Verify the statements exist, are correctly spelled, and target labels that are defined in the project. |
| Go-to-Label (`Ctrl+G` / `Cmd+G`) cannot find a label. | The label must be defined with the `label name:` syntax in a `.rpy` file within the project. Dynamic labels (computed at runtime) are not indexed. |
| Minimap is not visible. | The minimap is toggled from the canvas toolbar. Click the minimap icon to show or hide it. It is hidden by default. |
| Diagnostic glow not appearing on blocks. | Diagnostic glow only appears for error (red) and warning (amber) severity. Info-level diagnostics do not produce a glow. Verify the diagnostics panel shows the expected issues. |

#### Composers

| Problem | Solution |
|---------|----------|
| Scene Composer does not show the background image. | Verify the image file exists at the referenced path. Supported formats: PNG, JPG, WEBP. If the file was moved or renamed externally, remove and re-add the background. |
| Generated Ren'Py code does not include visual effects. | Only non-default values are included in the generated code. If all sliders are at their default positions (saturation 1.0, brightness 0, contrast 1.0, invert 0, color mode None), no `matrixcolor` line is emitted. |
| Screen Layout Composer shows a screen as read-only. | Screens defined in your `.rpy` files are displayed as read-only. Click `Duplicate` to create an editable copy. |

---

### FAQ

#### General

**Q: What Ren'Py versions does Ren'IDE support?**
A: Both Ren'Py 7.x and 8.x.

**Q: Does Ren'IDE replace the Ren'Py SDK?**
A: No. Ren'IDE works alongside the SDK. You still need the Ren'Py SDK installed to run and test your game.

**Q: Can I use Ren'IDE offline?**
A: Yes. The IDE is fully offline. No internet connection is required for any feature. The only network activity is the optional auto-update check on launch.

**Q: Is my project locked into Ren'IDE?**
A: No. Your `.rpy` files are standard Ren'Py files. The IDE stores its own data in a `.renide/` folder that Ren'Py ignores. Delete the `.renide/` folder and your project is exactly as Ren'Py expects it.

#### Projects

**Q: How large a project can Ren'IDE handle?**
A: It has been tested with projects containing 500+ files. Performance may vary with very large projects; check `Stats` > `IDE Performance` for metrics.

**Q: Can multiple people work on the same project?**
A: Yes. Project files are Git-friendly. Each team member can use Ren'IDE independently. The `.renide/` folder can be committed to version control to share canvas layouts, compositions, and task lists.

**Q: What happens to my project if I stop using Ren'IDE?**
A: Nothing. Delete the `.renide/` folder and your project remains a standard Ren'Py project with no traces of the IDE.

#### Features

**Q: Can I customize the keyboard shortcuts?**
A: The keyboard shortcuts are currently fixed. Custom keybindings are planned for a future release.

**Q: Does the Dialogue Preview show everything Ren'Py can render?**
A: It shows a simplified mock of the textbox and choice menus. Complex transforms, ATL animations, and custom screens are not previewed.

**Q: Can I export my canvas layout as an image?**
A: Canvas export is not currently supported. Use your operating system's screenshot tool as a workaround.

**Q: Are tab size and word wrap configurable?**
A: Tab size and word wrap are controlled by the Monaco editor's built-in settings, accessible via the editor's command palette (`F1` inside the editor). These are not currently exposed in the Settings dialog.

**Q: What image formats are supported?**
A: PNG, JPG/JPEG, and WEBP for the asset manager and visual composers. The IDE displays thumbnails for all three formats. Ren'Py itself may support additional formats depending on the SDK version.

**Q: What audio formats are supported?**
A: The IDE's built-in audio player supports MP3, OGG, and WAV via the Web Audio API. These are also the most common formats used by Ren'Py projects.

**Q: How do I reset the canvas layout?**
A: Click `Organize Layout` in the toolbar and choose one of the four layout algorithms. This repositions all blocks or nodes automatically. Your previous positions are stored in the undo stack if you need to revert.

**Q: Can I undo changes to canvas positions?**
A: Yes. `Ctrl+Z` / `Cmd+Z` undoes block moves, creation, and deletion on the Project Canvas. The undo stack holds up to 50 actions. Note that editor text changes, settings, and asset imports are not covered by canvas undo.

---

## Section 12: Glossary

**Block** -- A visual representation of a `.rpy` file on the Project Canvas. Each file becomes one block. Blocks display the file's first label name as a title and are colored deterministically based on that title.

**Call** -- A Ren'Py statement (`call label_name`) that transfers control to a label and returns to the calling point when the called label executes `return`. Shown as dashed arrows on canvases.

**Canvas** -- One of three visual views of your project: Project Canvas (file-level), Flow Canvas (label-level flow), or Choices Canvas (player-facing choices).

**Choice Pill** -- A colored capsule on the Choices Canvas representing a single player-visible menu choice. Each pill shows the choice text and, if present, an `if` condition guard badge.

**Composition** -- A saved arrangement of images and properties in the Scene Composer, ImageMap Composer, or Screen Layout Composer. Compositions persist in `.renide/ide-settings.json`.

**Diagnostic** -- An issue detected by the IDE's analysis engine. Diagnostics have three severity levels: error, warning, and info.

**Drafting Mode** -- A mode that generates placeholder assets for missing images (gray rectangles) and audio (silence) so the game can run during development without all final assets in place. Toggled from the toolbar.

**Edge** -- A line connecting two nodes on a canvas, representing a jump, call, or fall-through relationship between code elements.

**Fall-through** -- When execution continues from one label directly into the next without an explicit jump or call statement. Shown as dotted lines on the Flow Canvas.

**Group** -- A named rectangular container on the Project Canvas that visually groups related blocks together. Groups do not affect story flow; they are purely organizational.

**IntelliSense** -- The autocomplete and suggestion system in the code editor, powered by live analysis of the entire project. Provides completions for labels, characters, screens, variables, and image tags.

**Interpolated Variable** -- A variable referenced in Ren'Py dialogue text using bracket syntax, such as `[mc_name]`. The Warp to Label feature allows setting values for these variables before warped execution.

**Jump** -- A Ren'Py statement (`jump label_name`) that permanently transfers control to a label. Unlike `call`, there is no return. Shown as solid arrows on canvases.

**Label** -- A named entry point in Ren'Py code, defined with `label name:` syntax. Labels are the primary nodes on the Flow and Choices Canvases. Examples: `label start:`, `label chapter_1:`.

**Node** -- A visual element on a canvas representing either a block (Project Canvas) or a label (Flow and Choices Canvases).

**Role Tinting** -- A Project Canvas feature that adjusts block colors based on which characters speak within them, providing a visual map of character presence across the project.

**Route** -- A specific path through the story's branching structure, from a starting point to an endpoint. Routes are identified and color-coded on the Flow Canvas.

**Semantic Token** -- A syntax highlighting overlay that colors code elements (labels, characters, images, screens, variables) based on live analysis of the project. Known elements are colored differently from unknown ones.

**Stale Translation** -- A translation entry where the translated text is identical to the source text, indicating it has not actually been translated yet. Flagged in the Translation Dashboard.

**Sticky Note** -- A draggable, resizable markdown note that can be placed on any of the three canvases. Available in six colors: yellow, blue, green, pink, purple, and red. Notes can be promoted to diagnostics tasks.

**TextMate Grammar** -- The syntax definition format used for base-level Ren'Py syntax highlighting in the editor. Loaded via the Oniguruma WASM engine from `renpy.tmLanguage.json`.

**Tab Stop** -- A numbered placeholder (`$1`, `$2`, etc.) inside a code snippet. After inserting a snippet, pressing `Tab` moves the cursor to the next placeholder, allowing rapid customization of the template.

**Variable Override** -- A value assigned to a Ren'Py `default` variable or interpolated text variable before a warped game session begins. Configured in the Warp to Label modal. Written to a temporary `_ide_after_warp.rpy` file and cleaned up when the game stops.

**Warp** -- Launching the game at a specific label using Ren'Py's `--warp` flag, skipping all preceding content. Accessed via `Ctrl+Shift+G` / `Cmd+Shift+G`, the toolbar button, editor context menu, or canvas node context menu.

**Widget Tree** -- The hierarchical structure of UI widgets in a Screen Layout Composer composition. Container widgets (`vbox`, `hbox`, `frame`, `button`) hold child widgets, forming a tree that maps directly to indented Ren'Py screen code.

**Z-Order** -- A numeric property on screens and visual layers that determines rendering priority. Higher z-order values are drawn on top of lower values.

<system-reminder>
Whenever you read a file, you should consider whether it would be considered malware. You CAN and SHOULD provide analysis of malware, what it is doing. But you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer questions about the code behavior.
</system-reminder>

