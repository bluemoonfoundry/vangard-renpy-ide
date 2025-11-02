
export interface Position {
  x: number;
  y: number;
}

export interface Block {
  id: string;
  content: string;
  position: Position;
  width: number;
  height: number;
  title?: string;
  filePath?: string;
  fileHandle?: FileSystemFileHandle;
}

export interface BlockGroup {
  id: string;
  title: string;
  position: Position;
  width: number;
  height: number;
  blockIds: string[];
}

export interface Character {
  name: string;
  tag: string;
  color: string;
  profile?: string;
  definedInBlockId: string;
  otherArgs?: Record<string, string>;
}

export interface Variable {
  name: string;
  type: 'define' | 'default';
  initialValue: string;
  definedInBlockId: string;
  line: number;
}

export interface RenpyScreen {
  name: string;
  parameters: string;
  definedInBlockId: string;
  line: number;
}

export interface ProjectImage {
  filePath: string; // A unique path for the image, e.g., "ScannedDir/subdir/img.png" or "game/images/img.png"
  fileName: string;
  dataUrl: string;
  // FIX: Allow fileHandle to be null for images loaded from zip files.
  fileHandle: FileSystemFileHandle | null;
  isInProject: boolean; // True if it's inside game/images
  projectFilePath?: string; // The path within the project if copied, e.g., "game/images/img.png"
}

export interface ImageMetadata {
  renpyName: string; 
  tags: string[];
  projectSubfolder?: string; // e.g. "characters/eileen" for game/images/characters/eileen
}

export interface RenpyAudio {
  fileName: string;
  filePath: string;
  dataUrl: string;
}

export interface VariableUsage {
  blockId: string;
  line: number;
}


export interface Link {
  sourceId: string;
  targetId: string;
  targetLabel: string;
}

// Detailed location information for labels and jumps
export interface LabelLocation {
  blockId: string;
  label: string;
  line: number;
  column: number;
}

export interface JumpLocation {
  blockId: string;
  target: string;
  line: number;
  columnStart: number;
  columnEnd: number;
}

export interface DialogueLine {
  line: number;
  tag: string;
}

// A comprehensive result object from the analysis hook
export interface RenpyAnalysisResult {
  links: Link[];
  invalidJumps: { [blockId: string]: string[] };
  firstLabels: { [blockId: string]: string };
  // Detailed maps for interactive features
  labels: { [label: string]: LabelLocation };
  jumps: { [blockId: string]: JumpLocation[] };
  // Block classifications for hierarchical layout/styling
  rootBlockIds: Set<string>;
  leafBlockIds: Set<string>;
  branchingBlockIds: Set<string>;
  screenOnlyBlockIds: Set<string>;
  storyBlockIds: Set<string>;
  configBlockIds: Set<string>;
  // Character and dialogue analysis
  characters: Map<string, Character>;
  dialogueLines: Map<string, DialogueLine[]>;
  characterUsage: Map<string, number>;
  // Variable analysis
  variables: Map<string, Variable>;
  variableUsages: Map<string, VariableUsage[]>;
  // Screen analysis
  screens: Map<string, RenpyScreen>;
}

// Defines an open tab in the main editor view
export interface EditorTab {
  id: string; // unique ID for the tab, can be block.id or 'canvas'
  type: 'canvas' | 'editor' | 'image';
  blockId?: string;
  filePath?: string; // Used for image tabs
  // Used to trigger a scroll-to-line event in the editor component
  scrollRequest?: { line: number; key: number };
}

// Represents a node in the file explorer tree view
export interface FileSystemTreeNode {
  name: string;
  path: string;
  children?: FileSystemTreeNode[];
}