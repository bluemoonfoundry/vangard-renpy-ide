# Ren'Py Visual Novel Accelerator

The Ren'Py Visual Novel Accelerator is a powerful, web-based visual editor designed to streamline and enhance the development process for Ren'Py projects. It provides a dynamic canvas where your Ren'Py script files (`.rpy`) are represented as draggable blocks. The editor automatically analyzes your code to draw connections for `jump` and `call` statements, helping you visualize your story's flow and structure at a glance.

This tool is perfect for writers, designers, and programmers who want a more intuitive and organized way to manage complex branching narratives.

> [!CAUTION]
> Full disclosure: Sections of this codebase have been developed with the help of Gemini Build, a generative AI code assisstant.

> [!TIP]
> The demo folder contains the a simple Ren'py example project. Click the "Open Folder" button and select the "demo" folder to load it into the app. 


## Key Features

**Visual Story Canvas**: 
 - Drag, resize, and arrange blocks representing your `.rpy` files.
 - Automatic Flow Visualization. Arrows are automatically drawn between blocks to show `jump` and `call` relationships.
<img width="3818" height="2050" alt="Screenshot 2025-11-06 213207" src="https://github.com/user-attachments/assets/a7371ee5-a2b8-4ec3-bf70-5c872b6b3db1" />


**On-Demand Route Canvas**:
 - Generate a detailed, label-by-label graph of your story's control flow to understand complex branching. This is an opt-in feature to maintain performance on large projects.
 - Route Path Analysis & Highlighting. The Route Canvas automatically identifies all unique paths from start to finish. A floating panel allows you to highlight specific routes with distinct colors.
<img width="1857" height="536" alt="Screenshot 2025-11-06 213856" src="https://github.com/user-attachments/assets/3df313ce-210e-456f-a2e7-e3fb30f21229" />

 
**Integrated Code Editor**: A full-featured Monaco editor (the engine behind VS Code) is built-in for editing your script files directly within the app.
<img width="3271" height="1411" alt="Screenshot 2025-11-06 213257" src="https://github.com/user-attachments/assets/9c14b534-b031-487f-8c3d-e3f505eb84bc" />


**Comprehensive Project Management**: 
 - A built-in file explorer allows you to create, rename, move, and delete files and folders in your project.
 - File System Integration. Works directly with your local project folders for a seamless development experience (recommended).

**Story Element Management**: 
 - A dedicated panel to view, create, and manage Characters, Variables, Images, Audio, and Screens.
 - Asset PipelinE. Scan external directories for images and audio, and easily copy them into your project.

<img width="2552" height="1357" alt="Screenshot 2025-11-06 214627" src="https://github.com/user-attachments/assets/51826acc-ba89-4c90-9a09-229d6d21e19e" />

- **Browser-Only Mode**: Start creating and prototyping without needing a local project folder, then download your work as a `.zip` file.
- **Expanded Theme Support**: Personalize your workspace with multiple themes, including Light, Dark, Solarized, and Colorful variants.
- **UI State Persistence**: The editor remembers your theme, sidebar layout, and open tabs between sessions for a consistent workflow.
- **Customizable Layout**: Sidebars are resizable, allowing you to tailor the interface to your needs.

---

## Installation and Setup

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

3.  **Run the Development Server**:
    Once the dependencies are installed, you can start the Vite development server:
    ```bash
    npm run dev
    ```

4.  **Open in Browser**:
    The server will start and print a local URL to the terminal, typically `http://localhost:5173`. Open this URL in your web browser to start the application. The server features Hot Module Replacement (HMR), meaning most changes you make to the code will appear instantly in the browser without a full page reload.

---

## Usage Guide

### Getting Started

On first launch, you'll see a welcome screen with three options:

1.  **Open Project Folder**: **(Recommended)** This uses the File System Access API to open your Ren'Py project folder directly. The app can read your files and, with your permission, save changes directly back to them. This provides the most integrated experience.
2.  **Upload .zip Project**: If you have a Ren'Py project in a `.zip` archive, you can upload it to load it into the editor. Note that saving is not direct; you'll need to download your work as a new `.zip` file.
3.  **Continue in Browser**: This starts a blank project stored in your browser's local storage. It's great for quick prototyping. You can download your files as a `.zip` when you're done.

### The Main Interface

The application is divided into three main sections: the Project Explorer on the left, the main view (Canvas/Editor) in the center, and the Story Elements panel on the right. The left and right sidebars can be resized by dragging the handles on their inner edges.

#### Toolbar

The top toolbar provides access to global actions and tools.

| Button/Icon         | Function                                                                                                 | Shortcut           |
| ------------------- | -------------------------------------------------------------------------------------------------------- | ------------------ |
| **Undo/Redo**       | Reverts or re-applies changes like moving blocks, creating blocks, etc.                                  | `Ctrl+Z` / `Ctrl+Y` |
| **Add Block**       | Creates a new, blank `.rpy` file and adds it to the canvas.                                              | `N`                |
| **Tidy Up Layout**  | Automatically arranges the blocks on the canvas based on the story flow to reduce clutter.               |                    |
| **Analyze Routes**  | Generates and opens the Route Canvas tab, showing label-to-label connections.                            |                    |
| **Open Folder**     | Opens a new project folder, replacing the current workspace.                                             |                    |
| **Save All**        | Saves all unsaved changes to your local files. Only enabled when a project folder is open.               | `Ctrl+S`           |
| **Download .zip**   | Downloads all the script files in the current workspace as a `.zip` archive.                             |                    |
| **Upload .zip**     | Opens a file picker to upload and load a `.zip` project archive.                                         |                    |
| **Clear Canvas**    | Deletes all blocks and groups from the canvas.                                                           |                    |
| **Toggle Sidebars** | Shows or hides the left and right sidebars.                                                              |                    |
| **Toggle Theme**    | Cycles between System, Light, Dark, Solarized Light, Solarized Dark, Colorful, and Colorful Light themes.|                    |

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

- **Snippets Tab**:
  - A handy library of common Ren'Py code patterns for dialogue, logic, visual effects, and more.
  - Find the snippet you need and click **Copy** to paste it into your code.
