# Vangard Ren'Py IDE - AI Coding Assistant Instructions

## Project Overview
This is a web-based IDE for Ren'Py visual novel development, built as an Electron app with React/TypeScript frontend. It provides a visual canvas interface for editing story flows, integrated Monaco code editor, and comprehensive project management for Ren'Py games.

## Architecture & Key Components

### Core State Management
- **App.tsx**: Central state hub managing all application data (blocks, groups, images, file system, etc.)
- **State Updates**: Use `useImmer` for immutable state changes - always call update functions rather than direct mutation
- **Data Structures**: Defined in `types.ts` - Block (represents .rpy files), BlockGroup, Link (story connections), Character, Variable, etc.

### Visual Canvas System
- **StoryCanvas**: Main visual editor where .rpy files appear as draggable blocks with automatic flow arrows
- **RouteCanvas**: Detailed label-by-label flow visualization (generated on-demand)
- **Canvas Interactions**: Pan with Shift+drag, zoom with scroll, select/drag blocks, group with 'G' key

### File System Integration
- **File System Access API**: Direct local folder access (recommended mode)
- **Browser Mode**: localStorage-based prototyping with .zip export
- **File Operations**: Create, rename, delete files/folders through FileExplorerPanel

### Asset Management
- **AssetContext**: Manages images/audio scanning and metadata
- **Asset Pipeline**: Scan external directories, copy assets to project, generate Ren'Py statements
- **Image/Audio Editors**: Dedicated views for managing asset tags and organization

## Critical Developer Workflows

### Build & Run Commands
```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Production build to dist/
npm run build:debug  # Development build with sourcemaps
npm run electron:start  # Build + launch Electron app
npm run dist         # Create distributable package
```

### Ren'Py Analysis Engine
- **useRenpyAnalysis Hook**: Parses .rpy files for labels, jumps, characters, variables, screens
- **Regex Patterns**: Custom regex for Ren'Py syntax (LABEL_REGEX, JUMP_CALL_REGEX, etc.)
- **Flow Visualization**: Automatic arrow drawing between connected blocks
- **performRenpyAnalysis()**: Re-analyze entire project when files change

### State Update Patterns
```typescript
// Correct: Use provided update functions
updateBlock(blockId, { position: newPos, content: newContent });

// Wrong: Direct state mutation
setBlocks(blocks => blocks.map(b => b.id === blockId ? {...b, position: newPos} : b));
```

### Component Communication
- **Props Drilling**: Pass update callbacks down through component hierarchy
- **Context Usage**: FileSystemContext and AssetContext for shared state
- **Event Handling**: onInteractionEnd() called after drag operations to trigger saves

## Project-Specific Conventions

### Ren'Py Integration
- **Block Representation**: Each .rpy file = one Block with position, size, content
- **Label Extraction**: First label in file becomes block title
- **Connection Logic**: `jump`/`call` statements create Links between blocks
- **Asset References**: Images/audio referenced by Ren'Py tag system (e.g., "bg forest")

### UI Patterns
- **Modal System**: createPortal() for overlays (settings, editors, confirmations)
- **Context Menus**: Right-click handlers with portal rendering
- **Keyboard Shortcuts**: Global shortcuts (N=new block, Ctrl+S=save, G=group)
- **Toast Notifications**: ToastContext for user feedback

### File Organization
- **components/**: React components (StoryCanvas, EditorView, panels)
- **hooks/**: Custom logic (useRenpyAnalysis, useFileSystemManager)
- **contexts/**: React contexts for state sharing
- **DemoProject/**: Sample Ren'Py project for testing

### Code Style Notes
- **TypeScript Strict**: Full type safety with interfaces in types.ts
- **Functional Components**: React hooks throughout, no class components
- **Immer Integration**: All state updates through immer's draft system
- **Monaco Editor**: Integrated code editing with Ren'Py syntax highlighting

## Integration Points

### External Dependencies
- **Monaco Editor**: VS Code's editor engine for code editing
- **Electron**: Desktop app wrapper with preload.js for security
- **Vite**: Fast build tool with React plugin
- **Tailwind CSS**: Utility-first styling
- **Google GenAI**: AI content generation features

### File System API
- **Directory Handles**: FileSystemDirectoryHandle for folder access
- **File Handles**: FileSystemFileHandle for individual files
- **Permission Requests**: User grants read/write access to local folders

### Ren'Py Compatibility
- **Syntax Parsing**: Regex-based analysis of Ren'Py script syntax
- **Asset Discovery**: Automatic scanning of game/images/, game/audio/
- **Project Structure**: Standard Ren'Py layout (game/, gui/, etc.)

## Common Patterns & Examples

### Adding New Block Types
```typescript
// In CreateBlockModal.tsx
export type BlockType = 'story' | 'screen' | 'config';

// Usage in App.tsx
const handleCreateBlock = (type: BlockType, position: Position) => {
  const newBlock: Block = {
    id: generateId(),
    content: getTemplateForType(type),
    position,
    width: 300,
    height: 150,
    filePath: `game/${type}_${Date.now()}.rpy`
  };
  setBlocks(draft => { draft.push(newBlock); });
};
```

### Ren'Py Code Analysis
```typescript
// In useRenpyAnalysis.ts
const LABEL_REGEX = /^\s*label\s+([a-zA-Z0-9_]+):/;
const JUMP_REGEX = /\b(jump|call)\s+([a-zA-Z0-9_]+)/g;

// Extract labels and connections
const labels = content.match(LABEL_REGEX)?.map(match => match[1]) || [];
const jumps = [...content.matchAll(JUMP_REGEX)].map(match => ({
  type: match[1] as 'jump' | 'call',
  target: match[2]
}));
```

### Canvas Coordinate System
```typescript
// Transform screen coordinates to canvas coordinates
const screenToCanvas = (screenPos: Position): Position => ({
  x: (screenPos.x - transform.x) / transform.scale,
  y: (screenPos.y - transform.y) / transform.scale
});
```

Remember: This codebase uses visual programming concepts - blocks on a canvas represent code files, and arrows show execution flow. Always consider both the visual UI state and the underlying file system when making changes.