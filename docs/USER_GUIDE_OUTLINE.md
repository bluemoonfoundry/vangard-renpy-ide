# Ren'IDE User Guide - Detailed Outline

**Version:** 0.7.1 Public Beta 4
**Target Audience:** Ren'Py visual novel developers (writers, artists, programmers)
**Estimated Length:** 100-130 pages

---

## Section 1: Introduction (5-7 pages)

### 1.1 What is Ren'IDE?
- Visual IDE for Ren'Py development
- The problem it solves (managing complex VN projects)
- Core philosophy: visual representation of narrative structure
- Non-destructive: works with standard .rpy files
- No lock-in to proprietary formats

### 1.2 Who Should Use Ren'IDE?
- **Writers** - visual narrative flow, character tracking, choice management
- **Artists** - asset management, scene composition, visual previews
- **Programmers** - code editor, diagnostics, IntelliSense, screen builders
- **Solo developers** - unified environment for all roles
- **Teams** - shared visual understanding of project structure

### 1.3 Key Benefits
- See your entire story structure at a glance
- Catch errors early (broken jumps, missing assets, unreachable labels)
- Navigate large projects instantly
- Compose visually, generate code automatically
- Integrated asset management
- Full-featured code editor

### 1.4 System Requirements
- **Windows**: Windows 10 or later
- **macOS**: macOS 10.15 (Catalina) or later
- **Linux**: Recent distribution with AppImage support
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB for application + project space
- **Display**: 1280×720 minimum, 1920×1080 recommended

---

## Section 2: Getting Started (8-10 pages)

### 2.1 Installation

#### 2.1.1 Windows Installation
- Download the installer from releases page
- Run the .exe installer
- Choose installation directory
- Create desktop/start menu shortcuts
- First launch

#### 2.1.2 macOS Installation
- Download the .dmg file
- Open the DMG
- Drag Ren'IDE to Applications folder
- First launch (security prompts)
- Granting permissions

#### 2.1.3 Linux Installation
- Download the .AppImage
- Make it executable: `chmod +x Vangard-RenPy-renide-*.AppImage`
- Run the AppImage
- Optional: integrate with desktop environment

#### 2.1.4 Building from Source (Optional)
- Prerequisites (Node.js 18+)
- Clone repository
- Install dependencies
- Build and run
- Create distributable

### 2.2 First Launch
- Welcome screen overview
- Open existing project vs. create new
- File system permissions (if needed)
- Initial interface tour

### 2.3 Opening an Existing Project
- Browse to project directory
- What Ren'IDE looks for (.rpy files)
- Initial project analysis
- Understanding the canvas view
- File tree population

### 2.4 Creating a New Project
- New Project Wizard walkthrough
- Step 1: Project name and location
- Step 2: Resolution presets (1920×1080, 1280×720, etc.)
- Step 3: Theme and color selection
- Generated project structure
- SDK compatibility

### 2.5 Configuring Ren'Py SDK Path
- Why you need the Ren'Py SDK
- Settings → Ren'Py SDK Path
- Locating your SDK installation
- Testing the configuration
- Running your game from Ren'IDE

---

## Section 3: Interface Overview (10-12 pages)

### 3.1 Application Layout
- Top toolbar
- Canvas area (center)
- Left sidebar: Project Explorer
- Right sidebar: Story Elements
- Bottom: split pane editor
- Status bar

### 3.2 Toolbar Reference
- **Undo/Redo** - History management
- **Add Block** - Create new .rpy file
- **Add Note** - Canvas annotations
- **Redraw** - Auto-layout blocks
- **Diagnostics** - Error and warning panel
- **Stats** - Project statistics
- **Canvas tabs** - Story / Route / Choice
- **Drafting Mode** - Placeholder assets
- **Run** - Launch game in Ren'Py
- **Save All** - Persist all changes
- **Settings** - Application configuration

### 3.3 Project Explorer (Left Sidebar)
- File tree navigation
- Create/rename/delete operations
- Cut/copy/paste
- Drag-and-drop file organization
- Right-click context menu
- "Center on Canvas" feature

### 3.4 Story Elements Panel (Right Sidebar)
- Two-level tab navigation
- **Characters** tab - character database
- **Variables** tab - global variables
- **Images** tab - image asset manager
- **Snd** tab - audio asset manager
- **Screens** tab - screen definitions
- **Composers** tab - visual composers
- **Menus** tab - menu builder
- **Snippets** tab - code snippet library

### 3.5 Split Pane Editor (Bottom)
- Side-by-side editing
- Bottom split mode
- Dragging tabs between panes
- Closing panes
- Editor persistence

### 3.6 Status Bar
- Current file indicator
- Cursor position (Ln/Col)
- Analysis status
- Application version
- Build number (if applicable)

### 3.7 Keyboard Shortcuts
- **Ctrl+S** - Save All
- **Ctrl+Z / Ctrl+Y** - Undo / Redo
- **Ctrl+G** - Go to Label
- **N** - New Block
- **G** - Group selected blocks
- **Delete** - Delete selected
- **Shift+Drag** - Pan canvas
- **Mouse Scroll** - Zoom canvas
- **Ctrl+Click** - Multi-select
- **Escape** - Deselect / Close modal

### 3.8 Themes
- 10 available themes
- Light themes: System Light, Colorful Light, Candy Light, Forest Light, Solarized Light
- Dark themes: System Dark, Colorful Dark, Neon Dark, Ocean Dark, Solarized Dark
- Changing themes in Settings
- Theme persistence

---

## Section 4: Core Features Tour (15-20 pages)

### 4.1 The Three Canvas System

#### 4.1.1 Story Canvas - File-Level View
- What it shows: .rpy files as draggable blocks
- Jump and call arrows
- Block positioning and organization
- Drag to rearrange
- Zoom and pan controls
- Minimap navigation
- Block colors and role tinting
- Diagnostic glow (red=error, amber=warning)
- Canvas legend overlay
- Filtering by character
- Auto-layout with "Redraw"
- Grouping modes (connected components, file prefix)
- Layout modes (flow, hierarchical, circular, clustered flow)

#### 4.1.2 Route Canvas - Label-Level View
- What it shows: labels as nodes, jumps/calls as edges
- Control flow graph
- Unreachable label detection
- Menu decision inspector (hover popover)
- Route highlighting with colors
- Route list panel (collapsible)
- Node roles: start, end, choice, decision
- Call vs. jump distinction
- Graph layout algorithms

#### 4.1.3 Choice Canvas - Player Experience View
- What it shows: player-facing choices
- Menu nodes with choice pills
- Color-coded choice destinations
- Conditional badges (if guards)
- Tracing player paths
- Understanding branching complexity
- Choice text preview

#### 4.1.4 Canvas Navigation
- Go-to-Label command palette (Ctrl+G)
- Toolbox label search
- Zoom-on-navigate behavior
- Fit-to-screen button
- Go-to-start button
- Auto-center on first open

### 4.2 Code Editor

#### 4.2.1 Monaco Editor Basics
- VS Code engine integration
- Opening files for editing
- Multi-file editing (split panes)
- Tab management
- Saving changes

#### 4.2.2 Syntax Highlighting
- TextMate grammar for Ren'Py
- Semantic token provider
- Context-aware coloring
- Labels, variables, screen references

#### 4.2.3 IntelliSense & Autocomplete
- Jump/call target suggestions
- Show/scene image suggestions
- Character tag completion
- Screen name completion
- Variable suggestions
- Triggering IntelliSense (Ctrl+Space)

#### 4.2.4 Snippets
- 28+ built-in Ren'Py snippets
- Tab-stop placeholders
- Snippet trigger prefixes
- User-defined snippets
- Creating custom snippets
- Snippet integration with IntelliSense

#### 4.2.5 Editor Features
- Line numbers
- Error markers
- Cursor position in status bar
- Find and replace (in-file)
- Code folding
- Multi-cursor editing

### 4.3 Project-Wide Search & Replace
- Opening the search panel
- Full-text search with regex
- Search results navigation
- Jump to file and line
- Replace individual instances
- Bulk replace with confirmation
- Search history

### 4.4 Diagnostics Panel
- Error detection and display
- Warning identification
- Info-level issues
- Severity filtering
- Issue categories:
  - Invalid jumps (missing labels)
  - Missing images/audio
  - Undefined characters/screens
  - Unused characters
  - Unreachable labels
  - Syntax errors
- Click to jump to source
- Converting issues to tasks
- Task tracking integration

### 4.5 Project Statistics
- Opening the Stats tab
- Deferred loading with spinners
- Metrics tracked:
  - Total word count
  - Estimated play time
  - Lines of dialogue
  - Per-character dialogue breakdown (bar chart)
  - Scene count
  - Route count
  - Branching complexity scores
  - Asset coverage
- Asynchronous computation

### 4.6 Undo/Redo System
- What can be undone:
  - Canvas block moves
  - Block creation/deletion
  - Composition edits
  - Code changes
- History depth
- Using Ctrl+Z / Ctrl+Y
- Visual feedback

---

## Section 5: For Writers (12-15 pages)

### 5.1 Visualizing Your Narrative

#### 5.1.1 Using the Story Canvas
- See all story files at once
- Understanding jump connections
- Identifying story branches
- Following narrative threads
- Using role tinting to track character arcs

#### 5.1.2 Using the Route Canvas
- Tracing control flow
- Understanding label connections
- Finding unreachable content
- Analyzing narrative complexity
- Highlighting specific routes

#### 5.1.3 Using the Choice Canvas
- Player perspective
- Seeing what choices players will encounter
- Understanding conditional choices
- Tracing choice outcomes
- Identifying dead ends

### 5.2 Character Management

#### 5.2.1 Character Database
- Viewing all defined characters
- Character properties:
  - Name
  - Tag
  - Color
  - Dialogue count
- Adding new characters
- Editing character definitions
- Finding character usages

#### 5.2.2 Character Editor
- Opening the character editor
- Editing character attributes
- Visual color picker
- Profile notes
- Ren'Py parameter configuration
- Character-specific settings

#### 5.2.3 Dialogue Tracking
- Per-character dialogue counts
- Finding where characters speak
- Unused character detection
- Character filter on Story Canvas

### 5.3 Menu Builder & Choices

#### 5.3.1 Visual Menu Designer
- Accessing the Menus tab
- Creating menu structures
- Adding choices
- Setting choice destinations (jump/call)
- Conditional choices (if guards)
- Custom code blocks in choices

#### 5.3.2 Menu Analysis
- Viewing all menus in project
- Menu decision inspector on Route Canvas
- Understanding choice consequences
- Testing branching paths

### 5.4 Go-to-Label Navigation

#### 5.4.1 Command Palette (Ctrl+G)
- Opening the palette
- Fuzzy search with smart ranking
- Exact matches, prefix matches, substring matches
- Navigating to labels
- Zoom-on-navigate behavior
- Using from any canvas

#### 5.4.2 Toolbox Label Search
- Story Canvas toolbox
- Choice Canvas toolbox
- Route Canvas toolbox
- Filtering and jumping to labels

### 5.5 Story Flow Visualization

#### 5.5.1 Understanding Arrows
- Jump arrows (solid)
- Call arrows (dashed/distinct)
- Arrow colors
- Legend overlay

#### 5.5.2 Block Classification
- Root blocks (entry points)
- Leaf blocks (endings)
- Branching blocks (choices)
- Story blocks vs. config blocks

#### 5.5.3 Layout Strategies
- Manual positioning
- Auto-layout with Redraw
- Grouping by connected components
- Grouping by file prefix
- Layout modes

### 5.6 Variable Tracking
- Viewing all defined variables
- Variable types (define vs. default)
- Finding variable usages
- Understanding variable scope

### 5.7 Writing Tips & Workflow
- Starting a new story
- Organizing files and labels
- Using sticky notes for annotations
- Collaborative workflow considerations
- Best practices for large projects

---

## Section 6: For Artists (12-15 pages)

### 6.1 Image Asset Management

#### 6.1.1 Image Assets Tab
- Browsing project images
- Folder organization
- Visual thumbnails
- Image metadata

#### 6.1.2 Scanning External Directories
- Adding scan directories
- Importing without copying
- Managing scan locations
- Refreshing asset lists

#### 6.1.3 Importing Images
- Drag-and-drop import
- Copy to project
- Subfolder organization
- Batch import

#### 6.1.4 Image Metadata
- Ren'Py tags
- Custom tags
- Subfolder categorization
- Metadata editor
- Search and filter by metadata

#### 6.1.5 Quick Code Generation
- Right-click context menu
- Copy `scene` statement
- Copy `show` statement
- Direct clipboard integration

### 6.2 Audio Asset Management

#### 6.2.1 Audio Assets Tab
- Browsing project audio
- Supported formats
- Audio metadata

#### 6.2.2 Built-in Audio Player
- Playback controls
- Volume adjustment
- Seeking
- Loop playback

#### 6.2.3 Importing Audio
- Scan directories
- Copy to project
- Audio organization

#### 6.2.4 Quick Code Generation
- Copy `play music` statement
- Copy `play sound` statement
- Copy `queue audio` statement

### 6.3 Scene Composer

#### 6.3.1 Overview
- What is the Scene Composer?
- Use cases: scene mockups, reference compositions, quick layouts

#### 6.3.2 Creating a Composition
- Opening the Scene Composer
- Adding backgrounds
- Adding sprites
- Layer management

#### 6.3.3 Stage Controls
- Configurable resolution (presets + custom)
- Zoom controls
- Pan stage
- Grid/guides (if applicable)

#### 6.3.4 Sprite Transforms
- Position (drag)
- Zoom/scale
- Flip horizontal/vertical
- Rotate
- Alpha/opacity
- Blur
- Per-sprite controls

#### 6.3.5 Layer Ordering
- Drag to reorder layers
- Bring forward / send backward
- Understanding layer hierarchy

#### 6.3.6 Code Generation
- Copy generated Ren'Py code
- `scene` and `show` statements
- Transform attributes

#### 6.3.7 Exporting as PNG
- Flat image export
- Use cases: social media, previews

#### 6.3.8 Managing Compositions
- Saving compositions (persisted in project.ide.json)
- Loading compositions
- Deleting compositions
- Composition library

### 6.4 ImageMap Composer

#### 6.4.1 Overview
- What is an imagemap?
- Use cases: clickable UIs, point-and-click navigation

#### 6.4.2 Setting Ground and Hover Images
- Drag images from Assets panel
- Ground image (base)
- Hover overlay (optional)

#### 6.4.3 Drawing Hotspots
- Click and drag to create rectangles
- Resize handles
- Move hotspots
- Delete hotspots

#### 6.4.4 Configuring Hotspot Actions
- Action type: jump or call
- Target label selection
- Hotspot naming

#### 6.4.5 Code Generation
- Generated `imagebutton`/`imagemap` screen code
- Copy to clipboard
- Integrate into project

#### 6.4.6 Managing ImageMap Compositions
- Save/load imagemap compositions
- Composition persistence
- Updating compositions

### 6.5 Asset Preview Features
- Image thumbnails in file tree
- Double-click to open in editor
- Full-size preview
- Image dimensions display
- File size information

### 6.6 Drafting Mode for Artists
- What is Drafting Mode?
- Placeholder images for missing assets
- Placeholder audio
- Continuing work while assets are in progress
- Running the game with placeholders

### 6.7 Artist Workflow Tips
- Organizing assets by scene/character
- Naming conventions
- Using tags for filtering
- Coordinating with writers (character/scene references)
- Version control for assets

---

## Section 7: For Developers (15-20 pages)

### 7.1 Code Editor for Developers

#### 7.1.1 Monaco Editor Features
- Full VS Code engine
- Multi-file editing
- Split pane workflows
- Tab management and persistence

#### 7.1.2 Advanced Editing
- Multi-cursor editing
- Column selection
- Find and replace (regex)
- Code folding
- Bracket matching
- Auto-indentation

#### 7.1.3 IntelliSense Deep Dive
- How IntelliSense works in Ren'IDE
- Jump/call target completion
- Image/audio completion
- Character tag completion
- Screen name completion
- Variable completion
- Triggering manually
- Configuring suggestions

### 7.2 Syntax Highlighting

#### 7.2.1 TextMate Grammar
- What is a TextMate grammar?
- renpy.tmLanguage.json
- Accurate context-aware coloring
- Supported Ren'Py constructs

#### 7.2.2 Semantic Token Provider
- Enhanced highlighting beyond syntax
- Labels in scope
- Variables in scope
- Screen references
- Custom semantic coloring

### 7.3 Snippets Library

#### 7.3.1 Built-in Snippets
- Overview of 28+ built-in snippets
- Common patterns (label, jump, call, show, scene, menu, etc.)
- Tab-stop placeholders
- Using snippets (type prefix + trigger)

#### 7.3.2 Creating Custom Snippets
- User-defined snippets
- Snippet syntax
- Trigger prefixes
- Multi-line snippets
- Placeholder variables
- Integration with IntelliSense

#### 7.3.3 Snippet Management
- Snippets tab in Story Elements
- Add/edit/delete snippets
- Organizing snippet library
- Import/export snippets

### 7.4 Screen Layout Composer

#### 7.4.1 Overview
- What is the Screen Layout Composer?
- Visual screen builder
- Widget-based approach
- Use cases: custom UIs, menus, HUDs

#### 7.4.2 Available Widgets
- **Containers**: vbox, hbox, frame, null
- **Content**: text, image
- **Buttons**: textbutton, button, imagebutton
- **Input**: input, bar
- Widget properties
- Drag-and-drop placement

#### 7.4.3 Building a Screen
- Creating a new screen composition
- Adding widgets to stage
- Nesting widgets (hierarchy)
- Configuring widget properties
- Preview mode

#### 7.4.4 Asset Integration
- Drag images from Assets panel
- Image widgets
- Imagebutton widgets

#### 7.4.5 Code Generation
- Generated `screen` code
- Copy to clipboard
- Ready-to-use in Ren'Py

#### 7.4.6 Locked-Screen Workflow
- Viewing existing screens (read-only)
- Duplicate to edit
- Preserving original screens

#### 7.4.7 Managing Screen Compositions
- Save/load screen compositions
- Composition library
- Deleting compositions

### 7.5 Diagnostics Panel for Developers

#### 7.5.1 Error Detection
- Parse errors
- Syntax errors
- File and line information
- Click to jump to source

#### 7.5.2 Warning Categories
- Unused characters
- Missing assets
- Unreachable labels
- Invalid jumps

#### 7.5.3 Code Quality Checks
- Undefined references
- Orphaned variables
- Dead code detection

#### 7.5.4 Task Tracking
- Convert diagnostics to tasks
- Task list management
- Marking tasks complete
- Task persistence

### 7.6 Project Statistics for Developers

#### 7.6.1 Code Metrics
- Lines of code
- Lines of dialogue
- Scene count
- Label count
- Jump/call count

#### 7.6.2 Complexity Analysis
- Branching complexity
- Path depth statistics
- Cyclomatic complexity (if applicable)
- Route graph metrics

#### 7.6.3 Asset Coverage
- Images defined vs. used
- Audio defined vs. used
- Missing asset identification

### 7.7 Ren'Py SDK Integration

#### 7.7.1 Configuring SDK Path
- Settings → Ren'Py SDK Path
- Locating SDK installation
- Testing configuration

#### 7.7.2 Running the Game
- "Run" button in toolbar
- Launch Ren'Py as child process
- Console output (if applicable)
- Error handling

#### 7.7.3 Build and Distribution
- Using Ren'Py SDK tools
- Building distributables from SDK
- Ren'IDE workflow integration

### 7.8 File System Integration

#### 7.8.1 File System Access API
- Modern standards-based access
- Directory handles
- File persistence

#### 7.8.2 Project Structure
- What Ren'IDE expects
- game/ directory
- .rpy files
- project.ide.json (settings and compositions)

#### 7.8.3 File Operations
- Create/rename/delete via Project Explorer
- Cut/copy/paste
- Drag-and-drop organization
- File system watches (if applicable)

### 7.9 Developer Workflow Tips
- Organizing code by module
- Using labels effectively
- Naming conventions for maintainability
- Leveraging diagnostics for QA
- Version control integration (Git)
- Collaborative development

---

## Section 8: Complete Feature Reference (20-25 pages)

### 8.1 Canvas Features

#### 8.1.1 Story Canvas
- Block representation of .rpy files
- Draggable positioning
- Jump and call arrows
- Block colors and role tinting
- Diagnostic glow (error/warning)
- Character filtering
- Canvas legend overlay
- Grouping modes (connected components, file prefix)
- Layout modes (flow, hierarchical, circular, clustered flow)
- Auto-layout with Redraw
- Zoom and pan controls
- Minimap navigation
- Go-to-Label toolbox search
- Fit-to-screen
- Go-to-start
- Auto-center on first open
- Sticky notes for annotations
- Multi-select (Ctrl+Click, rubber-band)
- Group selected blocks (G key)
- Delete selected (Delete key)
- New block (N key)

#### 8.1.2 Route Canvas
- Label-by-label control flow graph
- Jump, call, fall-through edges
- Unreachable label detection
- Menu decision inspector (hover popover)
- Route highlighting with colors
- Route list panel (collapsible, hover-to-expand)
- Node roles (start, end, choice, decision)
- Call vs. jump distinction
- Graph layout algorithms
- Go-to-Label toolbox search
- Ctrl+G command palette
- Fit-to-screen
- Go-to-start
- Zoom and pan
- Minimap

#### 8.1.3 Choice Canvas
- Player-facing choice view
- Menu nodes with choice pills
- Color-coded destinations
- Conditional badges (if guards)
- Choice text preview
- Go-to-Label toolbox search
- Ctrl+G command palette
- Fit-to-screen
- Go-to-start
- Zoom and pan

### 8.2 Code Editor Features
- Monaco editor (VS Code engine)
- TextMate syntax highlighting (renpy.tmLanguage.json)
- Semantic token provider
- IntelliSense autocomplete:
  - Jump/call targets
  - Show/scene images
  - Character tags
  - Screen names
  - Variables
- 28+ built-in Ren'Py snippets
- User-defined snippets
- Multi-file editing
- Split pane support (side-by-side, bottom split)
- Drag tabs between panes
- Line numbers
- Cursor position display (Ln/Col)
- Error markers from diagnostics
- Code folding
- Multi-cursor editing
- Find and replace (in-file, regex)
- Bracket matching
- Auto-indentation

### 8.3 Project Explorer
- File tree navigation
- Create file/folder
- Rename
- Delete
- Cut/copy/paste
- Drag-and-drop organization
- Right-click context menu
- "Center on Canvas" for .rpy files
- File type icons
- Folder collapse/expand

### 8.4 Story Elements Panel

#### 8.4.1 Characters Tab
- All `define Character(...)` definitions
- Character properties (name, tag, color, dialogue count)
- Add new character
- Edit character
- Find character usages
- Jump to definition

#### 8.4.2 Variables Tab
- All `define`/`default` globals
- Variable name and value
- Find usages
- Jump to definition

#### 8.4.3 Images Tab
- Image asset manager
- Browse by folder
- Visual thumbnails
- Scan external directories
- Import images (copy to project)
- Image metadata (Ren'Py name, tags, subfolders)
- Right-click to copy `scene`/`show` statement
- Drag to Scene Composer / Screen Composer
- Double-click to edit metadata

#### 8.4.4 Snd (Audio) Tab
- Audio asset manager
- Browse by folder
- Scan external directories
- Import audio
- Built-in audio player
- Audio metadata
- Right-click to copy `play music`/`play sound`/`queue audio` statement

#### 8.4.5 Screens Tab
- All `screen` definitions
- Jump to definition
- Add screen with boilerplate
- Screen visibility

#### 8.4.6 Composers Tab
- Scene Composer
- ImageMap Composer
- Screen Layout Composer
- Composition library (saved compositions)
- Create/load/delete compositions

#### 8.4.7 Menus Tab
- Visual Menu Builder
- Create menu structures
- Add choices
- Set destinations (jump/call)
- Conditional choices (if guards)
- Custom code blocks in choices

#### 8.4.8 Snippets Tab
- Built-in Ren'Py snippets
- User-defined snippets
- Add/edit/delete snippets
- Snippet trigger prefixes
- Integration with IntelliSense

### 8.5 Diagnostics Panel
- Error severity levels (error, warning, info)
- Issue categories:
  - Invalid jumps (jump/call to missing label)
  - Missing images
  - Missing audio
  - Undefined characters
  - Undefined screens
  - Unused characters
  - Unreachable labels
  - Syntax errors
- Severity filtering
- Click to jump to source (file + line)
- Convert to tasks
- Task list integration

### 8.6 Project Statistics
- Total word count
- Estimated play time
- Lines of dialogue
- Per-character dialogue breakdown (bar chart)
- Scene count
- Route count
- Branching complexity scores
- Asset coverage (defined vs. used)
- Deferred loading with inline spinners

### 8.7 Search & Replace
- Full-text search across project
- Regex support
- Case-sensitive toggle
- Whole word toggle
- Search results list
- Jump to file and line
- Replace individual instances
- Bulk replace with confirmation
- Search history

### 8.8 Scene Composer
- Visual scene composition
- Layer backgrounds and sprites on stage
- Configurable stage resolution (presets: 1920×1080, 1280×720, 1024×768, 800×600, custom)
- Per-sprite transforms:
  - Position (drag)
  - Zoom/scale
  - Flip horizontal/vertical
  - Rotate
  - Alpha/opacity
  - Blur
- Reorder layers by dragging
- Copy generated `scene`/`show` Ren'Py code
- Export composition as PNG
- Save/load compositions (project.ide.json)

### 8.9 ImageMap Composer
- Visual imagemap editor
- Draw clickable hotspot rectangles
- Ground image and hover overlay
- Drag images from Assets panel
- Per-hotspot configuration:
  - Action type (jump or call)
  - Target label
  - Hotspot name
- Resize and move hotspots
- Delete hotspots
- Generate `imagebutton`/`imagemap` screen code
- Copy to clipboard
- Save/load imagemap compositions

### 8.10 Screen Layout Composer
- Visual Ren'Py screen builder
- Drag widgets onto stage:
  - vbox, hbox, frame, null (containers)
  - text, image (content)
  - textbutton, button, imagebutton (buttons)
  - input, bar (input)
- Nest widgets (hierarchy)
- Configure widget properties
- Drag images from Assets panel
- Preview mode
- Generate `screen` code
- Copy to clipboard
- Locked-screen workflow (view existing, duplicate to edit)
- Save/load screen compositions

### 8.11 New Project Wizard
- 3-step project creation flow
- Step 1: Project name and location
- Step 2: Resolution presets (1920×1080, 1280×720, 1024×768, 800×600, custom)
- Step 3: Theme and color picker
- Generated Ren'Py-compatible project structure
- Initial script.rpy with start label

### 8.12 Markdown Preview
- Double-click .md files for rendered preview
- GitHub-style Markdown rendering
- Toggle to Monaco edit mode
- Syntax highlighting in code blocks

### 8.13 AI Story Generator
- Generate content with AI
- Supported providers:
  - Google Gemini
  - OpenAI
  - Anthropic
- API key management (encrypted via Electron safeStorage)
- Prompt input
- Generated content preview
- Insert into project

### 8.14 Undo/Redo System
- Full history for:
  - Canvas block moves
  - Block creation/deletion
  - Composition edits
  - Code changes
- Ctrl+Z / Ctrl+Y shortcuts
- Visual feedback in toolbar

### 8.15 Drafting Mode
- Placeholder images for missing assets
- Placeholder audio
- Allows game to run during development
- Toggle in toolbar
- Visual indicator when active

### 8.16 Run Game
- Launch Ren'Py SDK from toolbar
- Runs game as child process
- Requires SDK path configuration
- Console output (if applicable)

### 8.17 Themes
- 10 available themes:
  - System Light / System Dark
  - Colorful Light / Colorful Dark
  - Neon Dark
  - Ocean Dark
  - Candy Light
  - Forest Light
  - Solarized Light / Solarized Dark
- Change in Settings modal
- Persisted per project

### 8.18 Auto-Updater
- Checks for new releases on launch
- Prompts to install updates
- Download and install flow
- Release notes display

### 8.19 Settings Modal
- **General Settings**
  - Theme selection
  - Auto-save interval
  - Undo history depth
- **Editor Settings**
  - Font size
  - Tab size
  - Word wrap
  - Minimap visibility
- **Canvas Settings**
  - Pan mode (Shift+Drag vs. other)
  - Zoom sensitivity
  - Auto-layout algorithm preferences
- **Ren'Py SDK Settings**
  - SDK path configuration
  - Test SDK path
- **AI Settings**
  - API provider selection (Google Gemini, OpenAI, Anthropic)
  - API key entry (encrypted storage)
- **Mouse Preferences**
  - Pan mode shortcuts
  - Zoom behavior

### 8.20 Keyboard Shortcuts (Complete List)
- **Ctrl+S** - Save All
- **Ctrl+Z** - Undo
- **Ctrl+Y** / **Ctrl+Shift+Z** - Redo
- **Ctrl+G** / **Cmd+G** - Go to Label (command palette)
- **N** - New Block
- **G** - Group selected blocks
- **Delete** - Delete selected
- **Shift+Drag** - Pan canvas (configurable)
- **Mouse Scroll** - Zoom canvas
- **Ctrl+Click** - Multi-select blocks
- **Escape** - Deselect all / Close modal
- **Ctrl+F** - Find (in editor)
- **Ctrl+H** - Replace (in editor)
- **Ctrl+Space** - Trigger IntelliSense

---

## Section 9: Appendices (5-8 pages)

### Appendix A: Keyboard Shortcuts Reference
- Complete keyboard shortcut table
- Canvas shortcuts
- Editor shortcuts
- Global shortcuts
- Platform differences (Windows/Mac/Linux)

### Appendix B: Troubleshooting

#### B.1 Installation Issues
- Windows: "App cannot be opened" (SmartScreen)
- macOS: "App is damaged" (Gatekeeper)
- Linux: AppImage not launching (permissions, FUSE)

#### B.2 Performance Issues
- Large projects loading slowly
- Canvas rendering lag
- Memory usage

#### B.3 File System Issues
- "Permission denied" errors
- File System Access API not supported
- Lost project handle

#### B.4 Ren'Py SDK Integration
- "SDK path not found"
- Game fails to launch
- SDK version compatibility

#### B.5 Asset Management
- Images not appearing
- Audio playback issues
- Scan directory not refreshing

#### B.6 Code Editor Issues
- IntelliSense not working
- Syntax highlighting missing
- Snippets not triggering

#### B.7 Canvas Issues
- Blocks not rendering
- Arrows not drawing correctly
- Minimap not updating
- Go-to-Label not finding labels

### Appendix C: Frequently Asked Questions

#### C.1 General
- Is Ren'IDE free?
- Does it work with existing Ren'Py projects?
- Will it lock me into a proprietary format?
- Can I use it alongside other editors?
- Does it replace the Ren'Py SDK?

#### C.2 Features
- Can I edit code directly?
- Can I run my game from Ren'IDE?
- Does it support version control (Git)?
- Can multiple people work on the same project?
- Does it support Ren'Py plugins/extensions?

#### C.3 Compatibility
- What Ren'Py versions are supported?
- Does it work on Windows 11?
- Does it work on Apple Silicon Macs?
- What Linux distributions are supported?

#### C.4 Assets
- What image formats are supported?
- What audio formats are supported?
- Can I use external asset libraries?
- How do I organize assets?

#### C.5 Advanced
- Can I customize keyboard shortcuts?
- Can I create custom themes?
- Can I extend Ren'IDE with plugins?
- Is there an API for automation?

### Appendix D: Glossary of Terms
- **Block** - A .rpy file represented as a draggable node on the Story Canvas
- **Canvas** - Visual workspace (Story, Route, or Choice)
- **Composition** - A saved layout from Scene/ImageMap/Screen Composer
- **Diagnostics** - Errors, warnings, and info issues detected in the project
- **Jump** - Ren'Py statement to transfer control to a label
- **Call** - Ren'Py statement to transfer control and return
- **Label** - Ren'Py named point in the script
- **Route** - A complete narrative path through the story graph
- **Drafting Mode** - Mode that adds placeholder assets for development
- **IntelliSense** - Context-aware autocomplete suggestions
- **Monaco** - The VS Code editor engine
- **TextMate Grammar** - Syntax highlighting definition
- **Semantic Tokens** - Enhanced context-aware highlighting
- **Snippet** - Reusable code template
- **Story Elements** - Right sidebar panel with project data tabs
- **SDK** - Ren'Py Software Development Kit

### Appendix E: Resources & Links
- Official website
- GitHub repository
- Issue tracker
- Community Discord / forum
- Ren'Py official documentation
- Ren'Py forum
- Tutorial videos (if available)
- Example projects (if available)

### Appendix F: Credits & Acknowledgments
- Development team
- Open source libraries used
- Community contributors
- Beta testers
- Special thanks

---

## Document Metadata

**Document Version:** 1.0
**Application Version:** 0.7.1 Public Beta 4
**Last Updated:** [Date to be filled]
**Authors:** [To be filled]
**License:** [To be filled]

---

## Notes for Content Creation

- **Screenshots:** Each major feature section should include 2-4 annotated screenshots
- **Step-by-step instructions:** Use numbered lists for workflows
- **Tips and warnings:** Use callout boxes for important information
- **Code examples:** Use syntax-highlighted code blocks
- **Cross-references:** Link between related sections
- **Index:** Consider adding an index for quick reference (Pandoc can generate this)

---

## Estimated Page Distribution

| Section | Pages |
|---------|-------|
| 1. Introduction | 5-7 |
| 2. Getting Started | 8-10 |
| 3. Interface Overview | 10-12 |
| 4. Core Features Tour | 15-20 |
| 5. For Writers | 12-15 |
| 6. For Artists | 12-15 |
| 7. For Developers | 15-20 |
| 8. Complete Feature Reference | 20-25 |
| 9. Appendices | 5-8 |
| **Total** | **100-130** |

---

**End of Outline**
