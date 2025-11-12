



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
  // Core attributes
  name: string;
  tag: string;
  color: string;
  profile?: string; // Notes/description
  definedInBlockId: string;

  // Other Ren'Py Character parameters
  image?: string;

  // who_ prefix (name label)
  who_style?: string;
  who_prefix?: string;
  who_suffix?: string;

  // what_ prefix (dialogue text)
  what_color?: string;
  what_style?: string;
  what_prefix?: string;
  what_suffix?: string;
  
  // Slow text parameters
  slow?: boolean;
  slow_speed?: number;
  slow_abortable?: boolean;
  all_at_once?: boolean;
  
  // window_ prefix (dialogue window)
  window_style?: string;

  // Click-to-continue
  ctc?: string;
  ctc_position?: 'nestled' | 'fixed';

  // Other behaviors
  interact?: boolean;
  afm?: boolean;

  // Raw properties for complex cases
  what_properties?: string; // Stored as a string representing a Python dict
  window_properties?: string; // Stored as a string representing a Python dict
}


export interface Variable {
  name: string;
  type: 'define' | 'default';
  initialValue: string;
  definedInBlockId: string;
  line: number;
}

export interface RenpyScreen {
  name:string;
  parameters: string;
  definedInBlockId: string;
  line: number;
}

export interface ProjectImage {
  filePath: string; // A unique path for the image, e.g., "ScannedDir/subdir/img.png" or "game/images/img.png"
  fileName: string;
  dataUrl?: string; // Made optional for lazy loading
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
  filePath: string; // A unique path, e.g., "ScannedDir/subdir/sound.ogg" or "game/audio/sound.ogg"
  fileName: string;
  dataUrl: string;
  fileHandle: FileSystemFileHandle | null;
  isInProject: boolean; // True if it's inside game/audio
  projectFilePath?: string; // The path within the project if copied, e.g., "game/audio/sound.ogg"
}

export interface AudioMetadata {
  renpyName: string;
  tags: string[];
  projectSubfolder?: string; // e.g. "sfx/footsteps" for game/audio/sfx/footsteps
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
  type: 'label' | 'menu';
}

export interface JumpLocation {
  blockId: string;
  target: string;
  type: 'jump' | 'call';
  isDynamic?: boolean;
  line: number;
  columnStart: number;
  columnEnd: number;
}

export interface DialogueLine {
  line: number;
  tag: string;
}

// A node on the Route Canvas, representing a single label.
export interface LabelNode {
  id: string; // composite key: `${blockId}:${label}`
  label: string;
  blockId: string;
  startLine: number;
  position: Position;
  width: number;
  height: number;
}

// A link on the Route Canvas between two labels.
export interface RouteLink {
  id: string; // unique identifier for the link
  sourceId: string; // source LabelNode id
  targetId: string; // target LabelNode id
  type: 'jump' | 'call' | 'implicit';
}

// Represents one complete, unique path through the label graph.
export interface IdentifiedRoute {
    id: number;
    color: string;
    linkIds: Set<string>;
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
  // Content summary for UI hints
  blockTypes: Map<string, Set<string>>;
  // Route Canvas data
  labelNodes: Map<string, LabelNode>;
  routeLinks: RouteLink[];
  identifiedRoutes: IdentifiedRoute[];
}

// Defines an open tab in the main editor view
export interface EditorTab {
  id: string; // unique ID for the tab, can be block.id or 'canvas'
  type: 'canvas' | 'route-canvas' | 'editor' | 'image' | 'audio' | 'character';
  blockId?: string;
  filePath?: string; // Used for image and audio tabs
  characterTag?: string; // Used for character tabs
  // Used to trigger a scroll-to-line event in the editor component
  scrollRequest?: { line: number; key: number };
}

// Represents a node in the file explorer tree view
export interface FileSystemTreeNode {
  name: string;
  path: string;
  children?: FileSystemTreeNode[];
}

// A message for the toast notification system
export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export type Theme = 'system' | 'light' | 'dark' | 'solarized-light' | 'solarized-dark' | 'colorful' | 'colorful-light';

export interface IdeSettings {
  theme: Theme;
  isLeftSidebarOpen: boolean;
  leftSidebarWidth: number;
  isRightSidebarOpen: boolean;
  rightSidebarWidth: number;
  openTabs: EditorTab[];
  activeTabId: string;
  apiKey?: string;
  enableAiFeatures?: boolean;
  selectedModel?: string;
}