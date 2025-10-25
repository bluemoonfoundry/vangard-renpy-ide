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
  definedInBlockId: string;
}

export interface Variable {
  name: string;
  type: 'define' | 'default';
  initialValue: string;
  definedInBlockId: string;
  line: number;
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
}