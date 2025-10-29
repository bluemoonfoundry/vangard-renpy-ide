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

export interface RenpyImage {
  tag: string; // "bg park" or "eileen happy"
  attributes: string[]; // ["park"] or ["happy"]
  fileName: string; // "park.jpg" or "eileen_happy.png"
  filePath: string; // "images/bg/park.jpg"
  dataUrl: string; // "data:image/jpeg;base64,..."
}

export interface ImageGroup {
  name: string; // "bg" or "characters/eileen"
  images: RenpyImage[];
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
  type: 'canvas' | 'editor';
  blockId?: string;
  // Used to trigger a scroll-to-line event in the editor component
  scrollRequest?: { line: number; key: number };
}