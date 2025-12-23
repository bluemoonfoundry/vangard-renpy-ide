
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
  color?: string;
}

export interface BlockGroup {
  id: string;
  title: string;
  position: Position;
  width: number;
  height: number;
  blockIds: string[];
}

export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'red';

export interface StickyNote {
  id: string;
  content: string;
  position: Position;
  width: number;
  height: number;
  color: NoteColor;
}

export interface PunchlistMetadata {
  notes?: string;
  tags?: string[];
  assignee?: string;
  status?: 'open' | 'completed' | 'ignored';
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
  dataUrl?: string; // Can be a blob: URL (Browser) or media:// URL (Electron) or base64 (legacy)
  fileHandle: FileSystemFileHandle | null;
  isInProject: boolean; // True if it's inside game/images
  projectFilePath?: string; // The path within the project if copied, e.g., "game/images/img.png"
  lastModified?: number;
  size?: number; // File size in bytes
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
  lastModified?: number;
  size?: number; // File size in bytes
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
  containerName?: string; // The name of the file/block containing this label
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
  // Image definitions found in code (e.g. "image eileen happy = ...")
  definedImages: Set<string>;
  // Content summary for UI hints
  blockTypes: Map<string, Set<string>>;
  // Route Canvas data
  labelNodes: LabelNode[];
  routeLinks: RouteLink[];
  identifiedRoutes: IdentifiedRoute[];
}

// Defines an open tab in the main editor view
export interface EditorTab {
  id: string; // unique ID for the tab, can be block.id or 'canvas'
  type: 'canvas' | 'route-canvas' | 'punchlist' | 'editor' | 'image' | 'audio' | 'character' | 'scene-composer';
  blockId?: string;
  filePath?: string; // Used for image and audio tabs
  characterTag?: string; // Used for character tabs
  sceneId?: string; // Used for scene composer tabs
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

export type Theme = 'system' | 'light' | 'dark' | 'solarized-light' | 'solarized-dark' | 'colorful' | 'colorful-light' | 'neon-dark' | 'ocean-dark' | 'candy-light' | 'forest-light';

export interface AppSettings {
  theme: Theme;
  isLeftSidebarOpen: boolean;
  leftSidebarWidth: number;
  isRightSidebarOpen: boolean;
  rightSidebarWidth: number;
  renpyPath: string;
  recentProjects: string[];
  editorFontFamily: string;
  editorFontSize: number;
  snippetCategoriesState?: Record<string, boolean>;
}

// Scene Composer Types
export interface SceneSprite {
    id: string;
    image: ProjectImage;
    x: number; // 0.0 to 1.0 (align)
    y: number; // 0.0 to 1.0 (align)
    zoom: number;
    zIndex: number;
    flipH: boolean;
    flipV: boolean;
    rotation: number; // degrees
    alpha: number; // 0.0 to 1.0
    blur: number; // pixels
    visible?: boolean;
}

export interface SceneComposition {
    background: SceneSprite | null;
    sprites: SceneSprite[];
}

export interface ProjectSettings {
  enableAiFeatures: boolean;
  selectedModel: string;
  draftingMode: boolean;
  openTabs: EditorTab[];
  activeTabId: string;
  stickyNotes?: StickyNote[];
  characterProfiles?: Record<string, string>;
  punchlistMetadata?: Record<string, PunchlistMetadata>;
  sceneCompositions?: Record<string, SceneComposition>;
  sceneNames?: Record<string, string>;
  scannedImagePaths?: string[];
  scannedAudioPaths?: string[];
}

// This type is a mix for components that need both, like SettingsModal
export interface IdeSettings extends AppSettings, Omit<ProjectSettings, 'openTabs' | 'activeTabId' | 'stickyNotes' | 'characterProfiles' | 'punchlistMetadata' | 'sceneCompositions' | 'sceneNames' | 'scannedImagePaths' | 'scannedAudioPaths'> {}


export type ClipboardState = { type: 'copy' | 'cut'; paths: Set<string> } | null;

export interface SearchMatch {
  lineNumber: number;
  lineContent: string;
  startColumn: number;
  endColumn: number;
}

export interface SearchResult {
  filePath: string;
  matches: SearchMatch[];
}

// FIX: Added missing context value types
export interface AssetContextValue {
  projectImages: Map<string, ProjectImage>;
  imageMetadata: Map<string, ImageMetadata>;
  imageScanDirectories: Map<string, FileSystemDirectoryHandle>;
  projectAudios: Map<string, RenpyAudio>;
  audioMetadata: Map<string, AudioMetadata>;
  audioScanDirectories: Map<string, FileSystemDirectoryHandle>;
  loadProjectAssets: (rootHandle: FileSystemDirectoryHandle) => Promise<void>;
  loadIdeSettings: (rootHandle: FileSystemDirectoryHandle) => Promise<void>;
  setAllAssets: (data: {
    images: Map<string, ProjectImage>;
    audios: Map<string, RenpyAudio>;
    imageMeta: Map<string, ImageMetadata>;
    audioMeta: Map<string, AudioMetadata>;
  }) => void;
  handleAddImageScanDirectory: () => Promise<void>;
  handleCopyImagesToProject: (sourceFilePaths: string[], metadataOverride?: ImageMetadata) => Promise<void>;
  handleUpdateImageMetadata: (projectFilePath: string, newMetadata: ImageMetadata) => Promise<void>;
  handleAddAudioScanDirectory: () => Promise<void>;
  handleCopyAudiosToProject: (sourceFilePaths: string[], metadataOverride?: AudioMetadata) => Promise<void>;
  handleUpdateAudioMetadata: (projectFilePath: string, newMetadata: AudioMetadata) => Promise<void>;
}

export interface FileSystemContextValue {
  directoryHandle: FileSystemDirectoryHandle | null;
  fileTree: FileSystemTreeNode | null;
  clipboard: ClipboardState;
  requestOpenFolder: () => void;
  handleCreateNode: (parentPath: string, name: string, type: 'file' | 'folder') => Promise<void>;
  handleRenameNode: (oldPath: string, newName: string) => Promise<void>;
  handleDeleteNode: (paths: string[]) => void;
  handleMoveNode: (sourcePaths: string[], targetFolderPath: string) => Promise<void>;
  handleCut: (paths: string[]) => void;
  handleCopy: (paths: string[]) => void;
  handlePaste: (targetFolderPath: string) => Promise<void>;
  isWelcomeScreenVisible: boolean;
  setIsWelcomeScreenVisible: React.Dispatch<React.SetStateAction<boolean>>;
  processUploadedFile: (file: File) => Promise<void>;
  uploadConfirm: { visible: boolean; file: File | null; };
  setUploadConfirm: React.Dispatch<React.SetStateAction<{ visible: boolean; file: File | null; }>>;
  tidyUpLayout: (blocksToLayout: Block[], links: Link[]) => Block[];
}

declare global {
  interface Window {
      electronAPI?: {
          openDirectory: () => Promise<string | null>;
          createProject?: () => Promise<string | null>;
          loadProject: (path: string) => Promise<any>;
          refreshProjectTree: (path: string) => Promise<any>;
          writeFile: (path: string, content: string, encoding?: string) => Promise<{ success: boolean; error?: string }>;
          createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
          removeEntry: (path: string) => Promise<{ success: boolean; error?: string }>;
          moveFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
          copyEntry: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
          scanDirectory: (path: string) => Promise<{ images: any[], audios: any[] }>;
          onMenuCommand: (callback: (data: { command: string, type?: 'canvas' | 'route-canvas' | 'punchlist', path?: string }) => void) => () => void;
          onCheckUnsavedChangesBeforeExit: (callback: () => void) => () => void;
          replyUnsavedChangesBeforeExit: (hasUnsaved: boolean) => void;
          onShowExitModal: (callback: () => void) => () => void;
          forceQuit: () => void;
          getAppSettings: () => Promise<Partial<AppSettings> | null>;
          saveAppSettings: (settings: AppSettings) => Promise<{ success: boolean; error?: string }>;
          selectRenpy: () => Promise<string | null>;
          runGame: (renpyPath: string, projectPath: string) => void;
          stopGame: () => void;
          onGameStarted: (callback: () => void) => () => void;
          onGameStopped: (callback: () => void) => () => void;
          onGameError: (callback: (error: string) => void) => () => void;
          onSaveIdeStateBeforeQuit: (callback: () => void) => () => void;
          ideStateSavedForQuit: () => void;
          path: {
              join: (...paths: string[]) => Promise<string>;
          };
          searchInProject: (options: { 
              projectPath: string; 
              query: string; 
              isCaseSensitive?: boolean; 
              isWholeWord?: boolean; 
              isRegex?: boolean; 
          }) => Promise<SearchResult[]>;
          showSaveDialog: (options: {
              title?: string;
              defaultPath?: string;
              buttonLabel?: string;
              filters?: { name: string; extensions: string[] }[];
          }) => Promise<string | null>;
      }
  }
}
