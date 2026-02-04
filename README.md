[![Build/Release](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/build.yml/badge.svg)](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/build.yml)
[![CodeQL](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/bluemoonfoundry/vangard-renpy-ide/actions/workflows/github-code-scanning/codeql)

# Ren'Py Visual Novel Accelerator

The VANGARD Ren'Py Visual Novel Accelerator is a desktop application designed to streamline and enhance the development process for Ren'Py projects. It provides a dynamic canvas where your Ren'Py script files (`.rpy`) are represented as draggable blocks. The editor automatically analyzes your code to draw connections for `jump` and `call` statements, helping you visualize your story's flow and structure at a glance. It is intended to be a one-stop shop for editing Ren'Py projects, but still allow flexibility to use whatever tools are necessary outside the application. In other words, using this application won't prevent you from editing your project outside of it. You're not locked in. 

This tool is perfect for writers, designers, and programmers who want a more intuitive and organized way to manage complex branching narratives.


<img width="1973" height="1118" alt="Main View" src="https://github.com/user-attachments/assets/cf387ed7-2d2c-444b-9c40-3c1bea90c799" />


# Quick Startup

If you just want to install the application on your desktop and run it, you can simply do this:

1. Go to the [release page](https://github.com/bluemoonfoundry/vangard-renpy-ide/releases/tag/v0.4.6-beta) and find the release zip for your operating system (Windows, Mac, Linux)
2. Download the zip file to a loction on your machine and unzip it
3. For Windows, double-click the installer file found in the zip and follow the installtion instructions
4. For Mac, open the DMG file found in the zip and copy the application to a location on your machine
5. Double-click the installed application and you're all set to go!

---

## Key Features

- **Visual Story Canvas**: Drag, resize, and arrange blocks representing your `.rpy` files. Arrows are automatically drawn between blocks to show `jump` and `call` relationships.

<img width="1103" height="389" alt="Story Canvas" src="https://github.com/user-attachments/assets/b594803d-7909-4ff1-9d90-227d7e906596" />


- **On-Demand Route Canvas**: Generate a detailed, label-by-label graph of your story's control flow to understand complex branching. This is an opt-in feature to maintain performance on large projects. The Route Canvas automatically identifies all unique paths from start to finish. A floating panel allows you to highlight specific routes with distinct colors.

<img width="1964" height="1114" alt="Route Canvas" src="https://github.com/user-attachments/assets/62da186a-7505-406d-b66c-b4d7f9ed8d7e" />


- **Integrated Code Editor**: A full-featured Monaco editor (the engine behind VS Code) is built-in for editing your script files directly within the app.

<img width="1233" height="1007" alt="Code Editor" src="https://github.com/user-attachments/assets/1aa05b75-7a9a-4356-b6a4-5a4589491a4e" />

- **Comprehensive Project Management**: A built-in file explorer allows you to create, rename, move, and delete files and folders in your project.

<img width="261" height="1019" alt="Project Explorer" src="https://github.com/user-attachments/assets/c3abdbb8-9606-4353-9e93-3239608b1249" />

- **Story Element Management**: A dedicated panel to view and manage Characters, Variables, Images, Audio, Screens, and Scenes. Scan external directories for images and audio, and easily copy them into your project.

  <img width="299" height="998" alt="Story Elements - Characters" src="https://github.com/user-attachments/assets/3c87ba26-3da0-478f-a251-954d226ee703" />
  <img width="309" height="1006" alt="Story Elements - Variables" src="https://github.com/user-attachments/assets/fa470bb0-b783-46de-a608-b7298483db57" />
  <img width="308" height="1011" alt="Story Elements - Images" src="https://github.com/user-attachments/assets/ab645f13-d21a-4a26-aeb2-b91367fb9a13" />
  <img width="311" height="1011" alt="Story Elements - Audio" src="https://github.com/user-attachments/assets/90623b20-6a20-4386-85e7-a49db27c2947" />
  <img width="306" height="1011" alt="Story Elements - Screens" src="https://github.com/user-attachments/assets/40e83b54-44b0-4207-888b-c9ebd11286da" />
  <img width="310" height="1008" alt="Story Elements - Scenes" src="https://github.com/user-attachments/assets/5a45c071-9ca0-4fe7-94c1-8e92a1dfeec0" />

  Scene Composer: Visually build scenes by layering backgrounds and sprites. Scale, zoom, orient them as you like. The application generates the Ren'Py code that can be copy/pasted. 
  <img width="1718" height="1001" alt="Story Elements - Scene Editor Tab" src="https://github.com/user-attachments/assets/3dd84ee3-7eb6-4664-b93d-ada3690d039a" />

  Image Viewer:
  <img width="1229" height="1001" alt="Image Viewer" src="https://github.com/user-attachments/assets/7c3360fb-484f-4be2-9d61-12c382ca6ef8" />

  Audio Viewer/Player:
  <img width="1537" height="1007" alt="Story Elements - Audio Viewer" src="https://github.com/user-attachments/assets/893ff1a3-72c7-48c7-ad5d-db547a6885b6" />

- **File System Integration**: Works directly with your local project folders for a seamless development experience.
- **Theme Support**: Personalize your workspace with multiple themes, including Light, Dark, Solarized, and Colorful variants.
- **UI State Persistence**: The editor remembers your theme, sidebar layout, and open tabs between sessions for a consistent workflow.
- **Customizable Layout**: Sidebars are resizable, allowing you to tailor the interface to your needs.
- **AI Integration**: Optional feature to generate AI content using Google, OpenAI, and Anthropic models. Generated content can be copy/pasted wherever you want.**

---

## Usage Guide

### Getting Started

On first launch, you'll see a welcome screen with an option to create a new project or a open an existing Ren'Py project folder. The latter option is recommended. The application maintains a list of recently opened projects, which you can open by clicking on them.

### The Main Interface

The application is divided into three main sections: the Project Explorer on the left, the main view (Canvas/Editor) in the center, and the Story Elements panel on the right. The left and right sidebars can be resized by dragging the handles on their inner edges.

#### Toolbar

The top toolbar provides access to global actions and tools.

<img width="1574" height="88" alt="Toolbar" src="https://github.com/user-attachments/assets/ab97e8ce-9030-4068-9698-942316db6b86" />

| Button/Icon         | Function                                                                                                 | Shortcut           |
| ------------------- | -------------------------------------------------------------------------------------------------------- | ------------------ |
| **Undo/Redo**       | Reverts or re-applies changes like moving blocks, creating blocks, etc.                                  | `Ctrl+Z` / `Ctrl+Y`|
| **Add Block**       | Creates a new, blank `.rpy` file and adds it to the canvas.                                              | `N`                |
| **Add Note**        | Add a sticky note to the canvas board. Notes are not included as Ren'Py code.                            |                    |
| **Tidy Up**         | Automatically arranges the blocks on the canvas based on the story flow to reduce clutter.               |                    |
| **Analyze Routes**  | Generates and opens the Route Canvas tab, showing label-to-label connections.                            |                    |
| **Drafting Mode**   | Toggle drafting mode, which adds placeholders for all images and sound files that are not yet created.   |                    |    
| **Run**             | Launch Ren'Py and run your game as a child of the application (requires Ren'Py Launcher Path to be set in Settings|                                           |                    |
| **Save All**        | Saves all unsaved changes to your local files. Only enabled when a project folder is open.               | `Ctrl+S`           |
| **Toggle Left**     | Hide/unhide the left sidebar with the Project Explorer and Search Tabs                                   |                    |
| **Search**          | Open search tab on the left sidebar                                                                      |                    |
| **Toggle Right**    | Hide/unhide the right sidebar with the Story Elements tabs                                               |                    |
| **Settings**        | Set specific user settings, including Color Theme, Editor Appearance, Ren'Py Launcher Path, and Enabling AI||

#### The Canvases

The central area is your main workspace for visualizing the story. It can contain multiple tabs, including two special canvas types.

##### Story Canvas

This is the default high-level view of your project.

- **Blocks**: Each block represents a single `.rpy` file. The title displays the file's name or the first label found within it. Blocks show summary information like labels, characters, and content types (dialogue, menus, Python code).
- **Arrows**: These lines connect blocks, representing `jump` and `call` statements, giving you an immediate sense of your story's structure.
- **Interactions**:
  - **Pan**: Hold `Shift` and drag the canvas background.
  - **Zoom**: Use your mouse scroll wheel.
  - **Select Blocks**: Click a block. Hold `Shift` or `Ctrl`/`Cmd` to select multiple. Drag a selection box (rubber-band) to select multiple blocks.
  - **Move Blocks**: Click and drag a block's header.
  - **Resize Blocks**: Drag the handle in the bottom-right corner.
  - **Group/Ungroup**: Select multiple blocks and press `G` to group them. Select a group and press `Shift+G` to ungroup.
  - **Open Editor**: Double-click a block to open its file in a new editor tab.

##### Route Canvas

The Route Canvas provides a much more granular view of your story's control flow. It is generated on-demand by clicking the "Analyze Routes" button in the toolbar.

- **Label Blocks**: Each `label` in your project is represented as a small, distinct block.
- **Connections**: Arrows show not only explicit `jump` and `call` statements (solid lines) but also implicit "fall-through" flow where one label follows another in a file (dotted lines).
- **Route Highlighting**: A floating 'View Routes' panel lists all unique paths the analysis could find. Check a box next to a route to highlight its specific path on the canvas with a unique color.

#### Project Explorer (Left Sidebar)

This panel shows a tree view of your project's file system.

- **File Operations**: Right-click on a file or folder to open the context menu, which allows you to:
  - **Create** new files (`.rpy`) or folders.
  - **Rename** existing files or folders.
  - **Delete** items (this will delete them from your disk if you have a project folder open!).
  - **Cut, Copy, and Paste** files and folders to reorganize your project.
- **Navigation**:
  - Double-click an `.rpy` file to open it in the editor.
  - Right-click an `.rpy` file and select "Center on Canvas" to locate its block in the visual editor.


#### Search Panel (Left Sidebar)

- **Search Operations**: Search all files in the project for specified keyword or regular expression. 

#### Story Elements (Right Sidebar)

This powerful panel analyzes your entire project to give you an overview of all its core components.

- **Characters Tab**:
  - Lists all characters defined with `define e = Character(...)`.
  - Shows their display name, code tag, color, and how many lines of dialogue they have.
  - You can **Add** a new character, **Find Usages** to highlight all blocks where a character speaks, or **Edit** an existing character's properties in a dedicated view.

- **Variables Tab**:
  - Lists all global variables defined with `define` or `default`.
  - You can **Add** new variables and **Find Usages** to see where they are used in your code.

- **Images Tab**:
  - Manages all your project's visual assets.
  - It automatically finds images in `game/images/`.
  - You can **Add Directory to Scan** to include images from other folders on your computer without copying them first.
  - Images not yet in your project are marked with a red border. Select them and click **Copy to Project**.
  - Right-click an image to copy a `scene` or `show` statement to your clipboard.
  - Double-click an image to open the Image Editor to manage its Ren'Py tags and subfolder location.

- **Audio Tab**:
  - Works just like the Images tab, but for your audio files (`.ogg`, `.mp3`, etc.).
  - Manages files in `game/audio/` and other scanned directories.
  - Right-click an audio file to copy a `play audio` or `queue audio` statement.

- **Screens Tab**:
  - Lists all screens defined with the `screen` statement.
  - You can **Add** a new screen, which will create a new `.rpy` file with boilerplate code.
  - You can also quickly **Find Definition** to jump to the code where a screen is defined.
 
- **Scene Tab**:
  - Create a scene image by layering images and sprites and arranging them to suit
  - Copy/paste generated code directly into Ren'Py code file

- **Snippets Tab**:
  - A handy library of common Ren'Py code patterns for dialogue, logic, visual effects, and more.
  - Find the snippet you need and click **Copy** to paste it into your code.

 #### PunchList (View Menu -> Punchlist)
 - A list of generated tasks is added to a list that is maintained with the project
 - Includes images and audio files that are referenced in the code but don't exist in the project yet
 - Project notes are included in the punchlist automatically

 #### AI Generator (View Menu -> AI Generator)
 - Opens a tab in which the user can generate AI content using Google Gemini, OpenAI, or Anthropic
 - Requires an API key to be entered for each provider (Google, OpenAI, Anthropic) the first time it is used in the project
 - Generated content can be copied and then pasted wherever the user wants

# Details for Developers

## Local Development Setup

This project uses a standard Node.js-based toolchain with Vite for a fast and modern development experience.

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18.x or newer recommended)
- npm (which comes bundled with Node.js)

### Running Locally

1.  **Clone the Repository** (if you haven't already):
    ```bash
    git clone https://github.com/your-username/renpy-visual-editor.git
    cd renpy-visual-editor
    ```

2.  **Install Dependencies**:
    Navigate to the project's root directory in your terminal and run `npm install` to download all the necessary packages defined in `package.json`.
    ```bash
    npm install
    ```

3.  **Build the distribution**:
    ```bash
    npm run dist
    ```

4.  **Run the built app**:
    In the ``release``` directory, find the OS specific folder (e.g. win-unpack) and the executable application underneath it. Double click the application run it.

    Mac users: To run your built application on Mac, use the open -x /path/to/xyz.app command instead. 
---
