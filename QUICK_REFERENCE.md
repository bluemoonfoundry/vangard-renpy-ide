# Quick Reference - Vangard Ren'Py IDE

## File Location Quick Links

### Core Application
- **App.tsx** - Central state and orchestration (2903 lines)
- **types.ts** - All type definitions (737 lines)
- **index.tsx** - React entry point
- **vite.config.ts** - Build configuration

### State Management
- **hooks/useRenpyAnalysis.ts** - Parse Ren'Py code (580 lines)
- **hooks/useFileSystemManager.ts** - File operations (268 lines)
- **hooks/useAssetManager.ts** - Image/audio assets
- **hooks/useHistory.ts** - Undo/redo (72 lines)

### Context Providers
- **contexts/FileSystemContext.ts** - File system access
- **contexts/AssetContext.ts** - Asset management
- **contexts/ToastContext.tsx** - Notifications

### Visual Components
- **components/StoryCanvas.tsx** - Main editor (978 lines)
- **components/RouteCanvas.tsx** - Route visualization (521 lines)
- **components/EditorView.tsx** - Code editor (761 lines)
- **components/Minimap.tsx** - Navigation aid
- **components/FileExplorerPanel.tsx** - File tree (452 lines)

### Editors
- **components/ImageEditorView.tsx** - Image editor
- **components/AudioEditorView.tsx** - Audio editor
- **components/CharacterEditorView.tsx** - Character editor
- **components/SceneComposer.tsx** - Scene layout tool

### Panels
- **components/SearchPanel.tsx** - Search UI (179 lines)
- **components/StoryElementsPanel.tsx** - Story elements list
- **components/ViewRoutesPanel.tsx** - Route panel

### Dialogs/Modals
- **components/CreateBlockModal.tsx** - New block dialog
- **components/SettingsModal.tsx** - Settings dialog (188 lines)
- **components/ConfigureRenpyModal.tsx** - Ren'Py configuration
- **components/ConfirmModal.tsx** - Confirmation dialog
- **components/KeyboardShortcutsModal.tsx** - Shortcuts help
- **components/AboutModal.tsx** - About dialog
- **components/EditorModal.tsx** - Modal code editor
- **components/GenerateContentModal.tsx** - AI content generation

### Managers
- **components/ImageManager.tsx** - Image management
- **components/AudioManager.tsx** - Audio management
- **components/CharacterManager.tsx** - Character database
- **components/VariableManager.tsx** - Variable tracking
- **components/ScreenManager.tsx** - Screen definitions
- **components/SnippetManager.tsx** - Code snippets
- **components/PunchlistManager.tsx** - Task tracking

### Utilities
- **components/Toolbar.tsx** - Top menu
- **components/StatusBar.tsx** - Bottom status
- **components/GroupContainer.tsx** - Block grouping
- **components/LabelBlock.tsx** - Route node
- **components/CodeBlock.tsx** - Story block
- **components/StickyNote.tsx** - Canvas notes
- **components/Toast.tsx** - Notification
- **components/LoadingOverlay.tsx** - Loading indicator
- **components/WelcomeScreen.tsx** - Initial screen
- **components/Sash.tsx** - Resizable divider
- **components/ImageThumbnail.tsx** - Image preview

### Context Menus
- **components/CanvasContextMenu.tsx** - Canvas right-click
- **components/FileExplorerContextMenu.tsx** - File right-click
- **components/ImageContextMenu.tsx** - Image right-click
- **components/AudioContextMenu.tsx** - Audio right-click
- **components/TabContextMenu.tsx** - Tab right-click
- **components/MenuConstructor.tsx** - Menu builder

---

## Common Development Tasks

### Add a New Data Type
1. Define interface in `types.ts`
2. Document with JSDoc
3. Use in relevant hooks/components
4. Update App.tsx state if needed

### Add a New Component
1. Create `components/NewComponent.tsx`
2. Add file-level JSDoc comment
3. Define Props interface
4. Export React.FC component
5. Add to parent component or App.tsx

### Add State Management
1. Add to types in `types.ts`
2. Initialize in App.tsx
3. Create update function
4. Pass callbacks to children
5. Document in DOCUMENTATION.md

### Add UI Setting
1. Add to AppSettings in types.ts
2. Add input in SettingsModal.tsx
3. Handle in App.tsx loading/saving
4. Persist to localStorage or file

### Add Keyboard Shortcut
1. Add listener (App.tsx or component)
2. Add to KeyboardShortcutsModal.tsx
3. Document in code comment
4. Update DOCUMENTATION.md if major feature

---

## Key Architecture Patterns

### State Updates
```typescript
// Use immer's produce() for immutable updates
updateBlock(id, data) => {
  setBlocks(draft => {
    const block = draft.find(b => b.id === id);
    if (block) Object.assign(block, data);
  });
}
```

### Component Props
```typescript
// Always define Props interface
interface MyComponentProps {
  data: Type;
  onChange: (newData: Type) => void;
  onError?: (error: Error) => void;
}
```

### Hook Usage
```typescript
// Access context with hook
const fileSystem = useFileSystem();
const assets = useAssets();
const { addToast } = useToasts();
```

### Analysis Integration
```typescript
// Use memoized analysis results
const analysis = useRenpyAnalysis(blocks, trigger);
// Access: analysis.labels, analysis.characters, etc.
```

---

## Ren'Py Syntax Support

### Parsed Elements
- **Labels:** `label name:`
- **Jumps:** `jump target` / `call target`
- **Characters:** `define tag = Character(...)`
- **Variables:** `define/default name = value`
- **Screens:** `screen name(...)`
- **Dialogue:** `character "text"`
- **Narration:** `"text"`
- **Images:** `image name = ...`

### Block Classification
- **Story blocks:** Have labels
- **Config blocks:** No labels (options.rpy, etc.)
- **Screen blocks:** Only define screens
- **Root blocks:** No incoming jumps
- **Leaf blocks:** No outgoing jumps

---

## Key Functions Quick Reference

### In App.tsx
- `updateBlock(id, data)` - Modify block
- `handleCreateBlock(type, pos)` - New block
- `handleDeleteBlock(id)` - Delete block
- `handleSaveAll()` - Save all to disk
- `performSearch(query)` - Full-text search
- `updateBlockPositions(updates)` - Move blocks

### In useRenpyAnalysis.ts
- `performRenpyAnalysis(blocks)` - Parse code
- `performRouteAnalysis(blocks, labels, jumps)` - Build routes
- `useRenpyAnalysis(blocks, trigger)` - Memoized hook

### In useFileSystemManager.ts
- `addNodeToFileTree(tree, path)` - Add file/folder
- `removeNodeFromFileTree(tree, path)` - Remove item
- `handleCreateNode(path, name, type)` - Create
- `handleDeleteNode(paths)` - Delete
- `handleMoveNode(sources, target)` - Move
- `tidyUpLayout(blocks, links)` - Auto-arrange

### In useAssetManager.ts
- `loadProjectAssets(rootHandle)` - Load assets
- `handleCopyImagesToProject(paths, meta)` - Import image
- `handleCopyAudiosToProject(paths, meta)` - Import audio
- `handleUpdateImageMetadata(path, meta)` - Update image
- `handleUpdateAudioMetadata(path, meta)` - Update audio

---

## Type Imports

```typescript
// Main types from types.ts
import type {
  Block, BlockGroup, Link, Position,
  Character, Variable, RenpyScreen,
  RenpyAnalysisResult,
  EditorTab, FileSystemTreeNode,
  ProjectImage, RenpyAudio,
  AppSettings, ProjectSettings
} from '../types';
```

---

## Context Usage

```typescript
// FileSystem context
const fs = useFileSystem();
// fs.directoryHandle, fs.fileTree, fs.clipboard, etc.

// Asset context
const assets = useAssets();
// assets.projectImages, assets.projectAudios, etc.

// Toast context
const { addToast } = useToasts();
// addToast("Message", "success|error|warning|info")
```

---

## Common Keyboard Shortcuts

- **N** - New block
- **G** - Group blocks
- **Ctrl+S** - Save all
- **Ctrl+Z** - Undo
- **Ctrl+Shift+Z** - Redo
- **Shift+Drag** - Pan canvas
- **Scroll** - Zoom canvas
- **Delete** - Delete selected
- **Ctrl+F** - Find
- **Escape** - Deselect/Close modal

---

## File Sizes (Approximate)

| File | Lines | Purpose |
|------|-------|---------|
| App.tsx | 2903 | Central state |
| types.ts | 737 | Type definitions |
| StoryCanvas.tsx | 978 | Main editor |
| EditorView.tsx | 761 | Code editor |
| useRenpyAnalysis.ts | 580 | Code analysis |
| RouteCanvas.tsx | 521 | Flow viz |
| FileExplorerPanel.tsx | 452 | File tree |
| useFileSystemManager.ts | 268 | File ops |
| SettingsModal.tsx | 188 | Settings |
| SearchPanel.tsx | 179 | Search UI |
| useHistory.ts | 72 | Undo/redo |

**Total Application Code:** ~25,000 lines

---

## Important Constants

### Paths
- **IDE Settings:** `game/project.ide.json`
- **Images:** `game/images/`
- **Audio:** `game/audio/`

### Regex Patterns (useRenpyAnalysis.ts)
- `LABEL_REGEX` - Match labels
- `JUMP_CALL_STATIC_REGEX` - Match jumps
- `CHARACTER_REGEX` - Match character defs
- `DEFINE_DEFAULT_REGEX` - Match variables
- `SCREEN_REGEX` - Match screens

### Color Palette
- 18 colors from `stringToColor()` function
- Used for characters, routes, highlights

---

## Debugging Tips

1. **Check block analysis:** Inspect `App.tsx` state in DevTools
2. **Test regex patterns:** Use online regex tester
3. **Monitor file operations:** Check DevTools Network tab
4. **Verify React state:** Use React DevTools extension
5. **Check console errors:** Full error stack traces
6. **Monitor canvas:** StoryCanvas re-render optimization

---

## Resources

- **Project Structure:** See DOCUMENTATION.md
- **Type Reference:** See types.ts
- **Code Examples:** See component implementations
- **Build Info:** See vite.config.ts
- **Issues:** Check error messages in console

---

**Last Updated:** January 28, 2026
**Total Documentation:** ~850 lines
**Components:** 56 files
**Documentation Coverage:** 15% (estimated)

