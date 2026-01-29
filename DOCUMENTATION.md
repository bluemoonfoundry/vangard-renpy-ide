# Vangard Ren'Py IDE - Code Documentation Guide

## Project Overview

The Vangard Ren'Py IDE is a web-based visual development environment for creating Ren'Py visual novels. It provides a canvas-based interface where story files appear as draggable blocks, with automatic flow visualization for the narrative structure.

**Key Technologies:**
- React 18 with TypeScript
- Electron for desktop distribution
- Monaco Editor (VS Code engine) for code editing
- Vite for build tooling
- Tailwind CSS for styling
- File System Access API for local file access

---

## Directory Structure & File Organization

### Core Files

#### `/types.ts`
**Purpose:** Central type definitions for the entire application
- **Exports:** 40+ TypeScript interfaces and types
- **Key Types:**
  - `Block` - Story file blocks on canvas
  - `RenpyAnalysisResult` - Complete analysis of all .rpy files
  - `Character`, `Variable`, `RenpyScreen` - Extracted code elements
  - `EditorTab`, `AppSettings`, `ProjectSettings` - State management
  - Context value types: `AssetContextValue`, `FileSystemContextValue`
- **Documentation:** Fully documented with JSDoc comments for all interfaces

#### `/App.tsx`
**Purpose:** Central application component and state hub (2903 lines)
- **Responsibilities:**
  - Manages all application state (blocks, groups, images, files, etc.)
  - Uses `useImmer` for immutable state updates
  - Handles file I/O operations
  - Manages editor tabs, settings, search functionality
  - Coordinates between Canvas, Editor, and side panels
  - Keyboard shortcuts (Ctrl+S=save, Ctrl+Z=undo, N=new block, etc.)
- **Key Functions:**
  - `updateBlock()`, `updateGroup()` - State mutations
  - `handleSaveAll()` - Persist changes to disk
  - `handleCreateBlock()`, `handleDeleteBlock()` - Block operations
  - `performSearch()` - Full-text search in project
- **State Structure:** Uses immer drafts for safe mutations without direct assignment

#### `/index.tsx`
**Purpose:** Application entry point
- Mounts React app to DOM root element
- Wraps app in StrictMode for development checks

#### `/vite.config.ts`
**Purpose:** Build configuration
- Configures React plugin, environment variables, build optimization
- Defines global constants for API keys and version info
- Enables sourcemaps for debugging

---

## Hooks (`/hooks`)

### `/useRenpyAnalysis.ts`
**Purpose:** Parse and analyze Ren'Py code files
- **Exports:**
  - `performRenpyAnalysis(blocks)` - Synchronous analysis function
  - `performRouteAnalysis(blocks, labels, jumps)` - Graph-based route analysis
  - `useRenpyAnalysis(blocks, trigger)` - React hook with memoization
- **Analysis Includes:**
  - Label extraction and location mapping
  - Jump/call statement parsing (static and dynamic)
  - Character definition extraction with all Ren'Py parameters
  - Variable (define/default) tracking
  - Screen definition identification
  - Block classification (root, leaf, branching, story, config)
  - Dialogue line tracking by character
  - Image tag definition discovery
  - Route graph construction for visualization
- **Key Functions:**
  - `stringToColor()` - Deterministic color generation
  - `parseCharacterArgs()` - Parse Ren'Py Character() parameters
  - `computeGraphLayout()` - Layout algorithm for Route Canvas
  - `findPaths()` - Identify narrative routes
- **Data Structures:**
  - Regex patterns for Ren'Py syntax (LABEL_REGEX, JUMP_CALL_REGEX, etc.)
  - Maps for labels, jumps, characters, variables, screens
  - Sets for classification (rootBlockIds, leafBlockIds, etc.)

### `/useFileSystemManager.ts`
**Purpose:** File system operations and project structure management
- **Exports:**
  - `addNodeToFileTree()` - Immutably add files/folders to tree
  - `removeNodeFromFileTree()` - Immutably remove from tree
  - `useFileSystemManager()` - Main hook
- **Operations:**
  - Create files/folders: `handleCreateNode()`
  - Rename: `handleRenameNode()`
  - Delete: `handleDeleteNode()`
  - Move: `handleMoveNode()`
  - Cut/Copy/Paste: `handleCut()`, `handleCopy()`, `handlePaste()`
  - File tree state management
  - Clipboard state tracking
  - Layout tidying: `tidyUpLayout()` - Auto-arrange blocks
- **File System APIs:**
  - File System Access API (modern browsers, Electron)
  - Fallback detection for browser mode
  - Zip import/export functionality

### `/useAssetManager.ts`
**Purpose:** Image and audio asset management
- **Exports:**
  - `useAssetManager()` - Hook for asset operations
- **Operations:**
  - `scanDirectoryForImages()` - Discover images in folders
  - `scanDirectoryForAudios()` - Discover audio files
  - `loadProjectAssets()` - Load from game/images and game/audio
  - `loadIdeSettings()` - Load project.ide.json settings
  - `handleAddImageScanDirectory()` - Add external image source
  - `handleCopyImagesToProject()` - Import images
  - `handleUpdateImageMetadata()` - Manage tags/organization
  - `handleAddAudioScanDirectory()` - Add external audio source
  - `handleCopyAudiosToProject()` - Import audio
  - `handleUpdateAudioMetadata()` - Manage tags/organization
- **State:**
  - Maps of images/audios with metadata
  - Scan directory handles
  - Metadata (renpyName, tags, subfolders)

### `/useHistory.ts`
**Purpose:** Undo/redo state management
- **Exports:**
  - `useHistory(initialState)` - Generic history hook
- **Features:**
  - Past/present/future state tracking
  - `undo()` - Revert to previous state
  - `redo()` - Move forward in history
  - `setState()` - Update present state
  - `canUndo`, `canRedo` - Boolean checks
  - Prevents undoing to initial blank state
  - JSON comparison to avoid duplicate entries

---

## React Contexts (`/contexts`)

### `/FileSystemContext.ts`
**Purpose:** Centralized file system access
- **Exports:**
  - `FileSystemContext` - React context
  - `useFileSystem()` - Hook to access context
- **Provides:** All file operations, tree structure, clipboard state

### `/AssetContext.ts`
**Purpose:** Centralized asset management
- **Exports:**
  - `AssetContext` - React context
  - `useAssets()` - Hook to access context
- **Provides:** Image/audio state, metadata, scan operations

### `/ToastContext.tsx`
**Purpose:** Toast notification system
- **Exports:**
  - `ToastContext` - React context
  - `useToasts()` - Hook for adding toasts
  - `ToastProvider` - Component wrapping app
- **Features:**
  - Auto-dismiss notifications (uses portal rendering)
  - Multiple message types: success, error, warning, info
  - Centralized toast queue management

---

## Components (`/components`)

### Canvas Components
- **StoryCanvas.tsx** (978 lines)
  - Main visual editor with draggable blocks
  - Handles pan (Shift+drag), zoom (scroll), selection
  - Renders flow arrows between connected blocks
  - Keyboard shortcuts for operations
  - Integration with Minimap for navigation

- **RouteCanvas.tsx**
  - Label-by-label flow visualization
  - Shows detailed narrative routes
  - Used by "View Routes" panel

- **Minimap.tsx**
  - Navigation aid showing all blocks at once
  - Click to jump to block
  - Shows viewport bounds

### Editor Components
- **EditorView.tsx**
  - Monaco code editor for Ren'Py files
  - Syntax highlighting for Ren'Py
  - Error markers, line numbers
  - Integration with analysis results

- **ImageEditorView.tsx**
  - Image asset editor
  - Metadata management (tags, organization)
  - Preview and details display

- **AudioEditorView.tsx**
  - Audio asset editor
  - Playback controls
  - Metadata management

- **CharacterEditorView.tsx**
  - Character definition editor
  - All Ren'Py Character parameters
  - Visual color picker
  - Profile notes

- **SceneComposer.tsx**
  - Visual scene composition tool
  - Drag and position sprites/backgrounds
  - Transform controls (zoom, rotate, flip, blur, alpha)

### Manager Components (Asset/Content Editors)
- **ImageManager.tsx** - Browse and manage project images
- **AudioManager.tsx** - Browse and manage project audio
- **CharacterManager.tsx** - Character database and profiles
- **VariableManager.tsx** - Variable definitions and usage
- **ScreenManager.tsx** - Screen definitions
- **SnippetManager.tsx** - Code snippet library
- **PunchlistManager.tsx** - Task list and progress tracking

### Panel Components (Sidebar Views)
- **FileExplorerPanel.tsx** - Project file tree navigation
- **SearchPanel.tsx** - Full-text search results
- **StoryElementsPanel.tsx** - Labels, jumps, variables, characters, screens
- **ViewRoutesPanel.tsx** - Route visualization and navigation

### Modal Components (Dialogs)
- **CreateBlockModal.tsx** - New block creation
- **EditorModal.tsx** - Code editing in modal
- **SettingsModal.tsx** - App and project settings
- **ConfigureRenpyModal.tsx** - Ren'Py path configuration
- **ConfirmModal.tsx** - Generic confirmation dialog
- **KeyboardShortcutsModal.tsx** - Help/shortcuts reference
- **AboutModal.tsx** - Application information
- **PlaceholderModal.tsx** - Placeholder content
- **GenerateContentModal.tsx** - AI content generation UI

### Utility Components
- **Toolbar.tsx** - Top menu bar with actions
- **StatusBar.tsx** - Bottom status information
- **Toast.tsx** - Notification display
- **LoadingOverlay.tsx** - Loading indicator
- **WelcomeScreen.tsx** - Initial project selection/creation
- **Sash.tsx** - Resizable panel divider
- **GroupContainer.tsx** - Visual block group container
- **LabelBlock.tsx** - Route Canvas node representation
- **CodeBlock.tsx** - Story canvas block representation
- **StickyNote.tsx** - Canvas annotation
- **ImageThumbnail.tsx** - Image preview thumbnail

### Context Menu Components
- **CanvasContextMenu.tsx** - Right-click on canvas
- **FileExplorerContextMenu.tsx** - Right-click on files
- **ImageContextMenu.tsx** - Right-click on images
- **AudioContextMenu.tsx** - Right-click on audio
- **TabContextMenu.tsx** - Right-click on editor tab
- **MenuConstructor.tsx** - Utility for building menus

---

## Key Design Patterns

### State Management
- **Immer Integration:** All state updates use `produce()` for immutable updates
- **Update Functions:** Pass update callbacks down component tree rather than direct state mutation
- **Memoization:** `useMemo()` prevents unnecessary recalculations of analysis results
- **Callback Optimization:** `useCallback()` ensures callbacks maintain referential equality

### Ren'Py Analysis
- **Regex-Based Parsing:** Pattern matching for Ren'Py syntax
- **Block Classification:** Categorizes blocks (story, screen, config, etc.) based on content
- **Graph Construction:** Builds directed graph of label connections
- **Route Identification:** Finds complete narrative paths through the graph

### File System Integration
- **File System Access API:** Modern standards-based local file access
- **Immutable Tree Updates:** File tree changes don't mutate original
- **Clipboard State:** Separate tracking for cut/copy operations
- **Electron Fallback:** Supports both browser and Electron modes

### Canvas Rendering
- **Canvas Transformation:** Pan, zoom with matrix transforms
- **Flow Arrows:** SVG rendering between blocks
- **Performance:** Memoization of rendered elements
- **Keyboard Shortcuts:** Global listeners for navigation and editing

---

## Documentation Status

### Fully Documented Files
✅ `/types.ts` - All 40+ interfaces with JSDoc
✅ `/hooks/useRenpyAnalysis.ts` - File-level documentation
✅ `/hooks/useFileSystemManager.ts` - File-level documentation
✅ `/hooks/useAssetManager.ts` - File-level documentation
✅ `/hooks/useHistory.ts` - File-level and interface documentation
✅ `/contexts/FileSystemContext.ts` - All exports with JSDoc
✅ `/contexts/AssetContext.ts` - All exports with JSDoc
✅ `/contexts/ToastContext.tsx` - Component and interface documentation
✅ `/index.tsx` - Entry point documentation
✅ `/vite.config.ts` - Configuration documentation with comments

### Partially Documented Files
🔄 `/App.tsx` - Requires method-level documentation (2903 lines)
🔄 `/components/StoryCanvas.tsx` - File-level added, needs method docs
🔄 Other components - File-level docs recommended

---

## Method Documentation Pattern

When documenting methods, use this JSDoc pattern:

```typescript
/**
 * Brief description of what the method does.
 * 
 * @param {Type} paramName - Description of parameter
 * @param {Type} [optionalParam] - Optional parameter description
 * @returns {ReturnType} Description of return value
 * @throws {ErrorType} Description of when error is thrown
 * 
 * @example
 * // Example usage
 * const result = myFunction(arg1, arg2);
 */
export function myFunction(param1: string, param2?: number): Result {
  // Implementation
}
```

---

## Common Workflows

### Adding a New Block Type
1. Add type to `BlockType` in `CreateBlockModal.tsx`
2. Add template in `CreateBlockModal.tsx`
3. Handle in `App.tsx` `handleCreateBlock()`
4. Ensure analysis handles in `useRenpyAnalysis.ts`

### Adding a New Asset Type
1. Define interfaces in `types.ts`
2. Add scanning logic to `useAssetManager.ts`
3. Create editor component (e.g., `AssetEditorView.tsx`)
4. Add manager component (e.g., `AssetManager.tsx`)
5. Wire into `AssetContext.tsx`

### Adding a Setting
1. Add to `AppSettings` or `ProjectSettings` in `types.ts`
2. Add UI in `SettingsModal.tsx`
3. Handle loading/saving in `App.tsx`
4. Persist to localStorage or file system

### Adding a Keyboard Shortcut
1. Add listener in component or `App.tsx`
2. Add to help text in `KeyboardShortcutsModal.tsx`
3. Document in method comments
4. Add to this guide under "Keyboard Shortcuts"

---

## Building and Running

```bash
# Development
npm run dev              # Start Vite dev server (http://localhost:5173)
npm run build:debug     # Debug build with sourcemaps

# Production
npm run build           # Optimized production build
npm run electron:start  # Build and launch as Electron app
npm run dist            # Create distributable package
```

---

## Environment Variables

- `GEMINI_API_KEY` or `API_KEY` - Google Generative AI API key for content generation
- `BUILD_NUMBER` - Build identifier (defaults to 'dev')

---

## Performance Considerations

1. **Memoization:** Use `useMemo()` for expensive analysis calculations
2. **Canvas Rendering:** Memoize block components to prevent unnecessary re-renders
3. **File Operations:** Async operations prevent UI blocking
4. **Tree Updates:** Immutable updates prevent cascading re-renders
5. **Analysis Caching:** `useRenpyAnalysis()` caches results until blocks change

---

## Error Handling

1. **File System:** Try/catch around File System API calls
2. **Parsing:** Regex patterns handle malformed Ren'Py gracefully
3. **Context Hooks:** Throw descriptive errors if used outside providers
4. **User Feedback:** Toast notifications for all errors

---

## Browser Compatibility

- **Modern Browsers:** Full support with File System Access API
- **Electron:** Complete support with Node.js integration
- **Legacy Browsers:** Limited to localStorage-based prototyping mode

---

## Next Steps for Documentation

For comprehensive documentation of every method and component:

1. Review each component's props interface
2. Add JSDoc to each method explaining:
   - Purpose
   - Parameters with types
   - Return values
   - Error conditions
   - Usage examples where helpful

3. Document key algorithms in:
   - `useRenpyAnalysis.ts` - Analysis algorithms
   - `StoryCanvas.tsx` - Canvas rendering
   - `useFileSystemManager.ts` - Tree operations

4. Create additional guides for:
   - Contributing guidelines
   - Component testing
   - Performance optimization
   - Ren'Py syntax support details

