/**
 * @file types.ts
 * @description Central type definitions for the Vangard Ren'Py IDE.
 * Defines all core data structures used throughout the application including
 * story blocks, characters, variables, assets, UI components, and context values.
 * This file serves as the single source of truth for type safety across the project.
 */

/**
 * Represents a 2D coordinate position on the canvas.
 * @interface Position
 * @property {number} x - The x-coordinate (horizontal position)
 * @property {number} y - The y-coordinate (vertical position)
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Represents a Ren'Py story block (typically a .rpy file) displayed on the canvas.
 * Blocks are the primary containers for story content and connect through Links.
 * @interface Block
 * @property {string} id - Unique identifier for the block
 * @property {string} content - The full Ren'Py Python/script content of the file
 * @property {Position} position - Canvas position where the block is rendered
 * @property {number} width - Width of the block when displayed on canvas (pixels)
 * @property {number} height - Height of the block when displayed on canvas (pixels)
 * @property {string} [title] - Optional display title (usually first label name)
 * @property {string} [filePath] - File system path to the source .rpy file (e.g., "game/script.rpy")
 * @property {FileSystemFileHandle} [fileHandle] - File system API handle for direct file access
 * @property {string} [color] - Hex color code for visual display (#RRGGBB format)
 */
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

/**
 * Represents a group of blocks on the canvas for visual organization.
 * Used to create logical groupings without affecting story flow.
 * @interface BlockGroup
 * @property {string} id - Unique identifier for the group
 * @property {string} title - Display name for the group
 * @property {Position} position - Top-left corner position of the group
 * @property {number} width - Width of the group rectangle (pixels)
 * @property {number} height - Height of the group rectangle (pixels)
 * @property {string[]} blockIds - Array of block IDs contained in this group
 */
export interface BlockGroup {
  id: string;
  title: string;
  position: Position;
  width: number;
  height: number;
  blockIds: string[];
}

/**
 * Type for sticky note colors available in the UI.
 * @typedef {('yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'red')} NoteColor
 */
export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'red';

/**
 * Represents a sticky note placed on the canvas for annotations and notes.
 * @interface StickyNote
 * @property {string} id - Unique identifier for the note
 * @property {string} content - Markdown-formatted text content of the note
 * @property {Position} position - Canvas position of the note's top-left corner
 * @property {number} width - Note width (pixels)
 * @property {number} height - Note height (pixels)
 * @property {NoteColor} color - Visual color of the note
 */
export interface StickyNote {
  id: string;
  content: string;
  position: Position;
  width: number;
  height: number;
  color: NoteColor;
}

/**
 * Represents a freeform notecard on the Notecard Canvas — an unstructured
 * scratchpad element, never parsed or referenced by Ren'Py analysis.
 * @interface Notecard
 */
export interface Notecard {
  id: string;
  title: string;
  content: string;
  position: Position;
  width: number;
  height: number;
  color: NoteColor;
  /** Index of the timeline column (slot) this card is pinned to. Undefined = unsorted/freeform. */
  timelineSlot?: number;
  /** Position within its timelineSlot column (0 = top). Meaningless when timelineSlot is undefined. */
  timelineOrder?: number;
}

/**
 * A directional link between two notecards on the Notecard Canvas.
 * @interface NotecardLink
 */
export interface NotecardLink {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

/**
 * Board-level settings for the Notecard Canvas's Timeline pane — a Kanban-style
 * row of scene columns cards can be pinned into. Separate from any individual
 * `Notecard`, one instance per board.
 * @interface NotecardTimelineSettings
 */
export interface NotecardTimelineSettings {
  /** Slot index -> display label (e.g. "Scene 1"). Missing entries fall back to a default label. */
  slotLabels: Record<number, string>;
}

/**
 * Metadata associated with punchlist items for task tracking.
 * @interface PunchlistMetadata
 * @property {string} [notes] - Additional notes for the task
 * @property {string[]} [tags] - Array of tag strings for categorization
 * @property {string} [assignee] - Name or ID of the person responsible
 * @property {'open' | 'completed' | 'ignored'} [status] - Current task status
 */
export interface PunchlistMetadata {
  notes?: string;
  tags?: string[];
  assignee?: string;
  status?: 'open' | 'completed' | 'ignored';
}

// ---------------------------------------------------------------------------
// Diagnostics types
// ---------------------------------------------------------------------------

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticIssue {
  id: string;               // deterministic: "category:blockId:line" or "category:name"
  severity: DiagnosticSeverity;
  category: string;         // "invalid-jump" | "syntax" | "missing-image" | "missing-audio"
                            // | "undefined-character" | "undefined-screen"
                            // | "unused-character" | "unreachable-label" | "jump-cycle"
  message: string;
  blockId?: string;
  filePath?: string;
  line?: number;
  column?: number;
}

export interface IgnoredDiagnosticRule {
  category: string;
  filePath?: string;
  blockId?: string;
  line?: number;
  message: string;
}

export type StoryCanvasLayoutMode = 'flow-lr' | 'flow-td' | 'connected-components' | 'clustered-flow';
export type StoryCanvasGroupingMode = 'none' | 'connected-component' | 'filename-prefix';

export interface SavedStoryBlockLayout {
  position: Position;
  width: number;
  height: number;
  color?: string;
}

export interface SavedRouteNodeLayout {
  position: Position;
}

export interface DiagnosticsTask {
  id: string;               // crypto.randomUUID()
  title: string;
  description?: string;
  status: 'open' | 'completed';
  blockId?: string;         // optional link to a file
  line?: number;
  stickyNoteId?: string;    // if derived from a canvas sticky note
  createdAt: number;        // Date.now()
}

export interface DiagnosticsResult {
  issues: DiagnosticIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

/**
 * Represents a Ren'Py Character definition extracted from code.
 * Includes standard Character() parameters and custom extensions for styling.
 * @interface Character
 * @property {string} name - Display name shown during dialogue
 * @property {string} tag - Python variable name for the character (e.g., "e" for Eileen)
 * @property {string} color - Hex color code used for visual identification
 * @property {string} [profile] - Notes/description extracted from comments
 * @property {string} definedInBlockId - ID of the block containing the character definition
 * @property {string} [image] - Default image for the character (Ren'Py image tag)
 * @property {string} [who_style] - Style for character name in dialogue
 * @property {string} [who_prefix] - Text prefix before character name
 * @property {string} [who_suffix] - Text suffix after character name
 * @property {string} [what_color] - Dialogue text color (CSS format)
 * @property {string} [what_style] - Dialogue text style
 * @property {string} [what_prefix] - Text prefix before dialogue
 * @property {string} [what_suffix] - Text suffix after dialogue
 * @property {boolean} [slow] - Whether to use slow text effect
 * @property {number} [slow_speed] - Text reveal speed in characters per second
 * @property {boolean} [slow_abortable] - Whether player can skip slow text
 * @property {boolean} [all_at_once] - Display entire dialogue at once
 * @property {string} [window_style] - Style for dialogue window
 * @property {string} [ctc] - Click-to-continue indicator image/text
 * @property {'nestled' | 'fixed'} [ctc_position] - Position of click-to-continue indicator
 * @property {boolean} [interact] - Whether character name is clickable
 * @property {boolean} [afm] - Auto-forward mode setting
 * @property {string} [what_properties] - Raw Python dict string for additional dialogue properties
 * @property {string} [window_properties] - Raw Python dict string for additional window properties
 */
export interface Character {
  // Core attributes
  name: string;
  tag: string;
  color: string;
  profile?: string;
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
  what_properties?: string;
  window_properties?: string;
}


/**
 * Represents a Ren'Py variable definition (define or default statement).
 * @interface Variable
 * @property {string} name - Variable identifier (e.g., "persistent.player_name")
 * @property {'define' | 'default' | 'implicit'} type - Statement type: 'define' for constants, 'default' for dynamic, 'implicit' for $ statements
 * @property {string} initialValue - Initial value expression as string
 * @property {string} definedInBlockId - ID of the block where variable is defined
 * @property {number} line - Line number in the file where variable is defined
 */
export interface Variable {
  name: string;
  type: 'define' | 'default' | 'implicit';
  initialValue: string;
  definedInBlockId: string;
  line: number;
}

/**
 * Represents a Ren'Py screen definition extracted from code.
 * @interface RenpyScreen
 * @property {string} name - Name of the screen as defined in code
 * @property {string} parameters - Parameter list string (e.g., "(msg='Hello')")
 * @property {string} definedInBlockId - ID of the block containing this screen
 * @property {number} line - Line number where screen is defined
 */
export interface RenpyScreen {
  name: string;
  parameters: string;
  definedInBlockId: string;
  line: number;
}

// REVIEW: ScreenComponent and ScreenModel below are entirely unused -- no
// file in src/ references either type outside this declaration. They appear
// to predate or anticipate a visual Screen Editor, which per the v1.0.0
// Screen Composer removal decision (see CHANGELOG.md's 1.0.0 "Removed"
// entry) is explicitly not shipping in this release. Either delete these as
// dead code, or if a post-1.0 Screen Editor is genuinely planned, note that
// plan here instead of leaving it implicit. The `any` below was only ever
// exercised by that unbuilt feature.
/**
 * A component within a visual screen editor layout.
 * Used by the Screen Editor (post-1.0 feature).
 */
export interface ScreenComponent {
  id: string;
  type: 'frame' | 'vbox' | 'hbox' | 'text' | 'textbutton' | 'imagebutton' | 'image' | 'null';
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: Record<string, any>;
  children: ScreenComponent[];
}

/**
 * The top-level model for a screen being edited in the visual Screen Editor.
 * Used by the Screen Editor (post-1.0 feature).
 */
export interface ScreenModel {
  name: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  components: ScreenComponent[];
}

/**
 * Represents an image asset that can be used in the project.
 * Supports both internal (game/images/) and external scanned images.
 * @interface ProjectImage
 * @property {string} filePath - Unique file path (e.g., "ScannedDir/subdir/img.png" or "game/images/img.png")
 * @property {string} fileName - Base filename with extension
 * @property {string} [dataUrl] - Data URL for displaying image (blob:, media://, or base64)
 * @property {FileSystemFileHandle | null} fileHandle - File system API handle for direct access
 * @property {boolean} isInProject - True if image is in game/images folder
 * @property {string} [projectFilePath] - Path within project if copied (e.g., "game/images/img.png")
 * @property {number} [lastModified] - File modification timestamp
 * @property {number} [size] - File size in bytes
 */
export interface ProjectImage {
  filePath: string;
  fileName: string;
  dataUrl?: string;
  fileHandle: FileSystemFileHandle | null;
  isInProject: boolean;
  projectFilePath?: string;
  lastModified?: number;
  size?: number;
}

/**
 * Metadata for organizing and tagging images in the project.
 * @interface ImageMetadata
 * @property {string} renpyName - Ren'Py image tag (e.g., "eileen happy")
 * @property {string[]} tags - Searchable tags for categorization
 * @property {string} [projectSubfolder] - Subfolder path (e.g., "characters/eileen" for game/images/characters/eileen)
 */
export interface ImageMetadata {
  renpyName: string;
  tags: string[];
  projectSubfolder?: string;
}

/**
 * Represents an audio asset that can be used in the project.
 * Supports both internal (game/audio/) and external scanned audio files.
 * @interface RenpyAudio
 * @property {string} filePath - Unique file path (e.g., "ScannedDir/subdir/sound.ogg" or "game/audio/sound.ogg")
 * @property {string} fileName - Base filename with extension
 * @property {string} dataUrl - Data URL for audio playback
 * @property {FileSystemFileHandle | null} fileHandle - File system API handle for direct access
 * @property {boolean} isInProject - True if audio is in game/audio folder
 * @property {string} [projectFilePath] - Path within project if copied (e.g., "game/audio/sound.ogg")
 * @property {number} [lastModified] - File modification timestamp
 * @property {number} [size] - File size in bytes
 */
export interface RenpyAudio {
  filePath: string;
  fileName: string;
  dataUrl: string;
  fileHandle: FileSystemFileHandle | null;
  isInProject: boolean;
  projectFilePath?: string;
  lastModified?: number;
  size?: number;
}

/**
 * Metadata for organizing and tagging audio files in the project.
 * @interface AudioMetadata
 * @property {string} renpyName - Ren'Py audio channel (e.g., "music" or "sfx")
 * @property {string[]} tags - Searchable tags for categorization
 * @property {string} [projectSubfolder] - Subfolder path (e.g., "sfx/footsteps" for game/audio/sfx/footsteps)
 */
export interface AudioMetadata {
  renpyName: string;
  tags: string[];
  projectSubfolder?: string;
}

/**
 * Records a single usage instance of a variable in the code.
 * @interface VariableUsage
 * @property {string} blockId - ID of the block where variable is used
 * @property {number} line - Line number of the usage
 */
export interface VariableUsage {
  blockId: string;
  line: number;
}

/**
 * Represents a connection between two story blocks in the narrative flow.
 * @interface Link
 * @property {string} sourceId - Block ID where the jump/call originates
 * @property {string} targetId - Block ID being jumped/called to
 * @property {string} targetLabel - Name of the specific label being targeted
 */
export interface Link {
  sourceId: string;
  targetId: string;
  targetLabel: string;
  type?: 'jump' | 'call';
}

/**
 * Detailed location information for a label definition in code.
 * Used for navigation and editor integration.
 * @interface LabelLocation
 * @property {string} blockId - ID of the block containing this label
 * @property {string} label - Name of the label
 * @property {number} line - Line number where label is defined
 * @property {number} column - Column number where label name starts
 * @property {'label' | 'menu'} type - Whether it's a standard label or menu label
 */
export interface LabelLocation {
  blockId: string;
  label: string;
  line: number;
  column: number;
  type: 'label' | 'menu';
}

/**
 * Records information about a jump or call statement in the code.
 * @interface JumpLocation
 * @property {string} blockId - ID of the block containing the jump
 * @property {string} target - Target label name
 * @property {'jump' | 'call'} type - Jump type (jump exits current flow, call returns)
 * @property {boolean} [isDynamic] - True if target is dynamically determined at runtime
 * @property {number} line - Line number of the jump statement
 * @property {number} columnStart - Starting column of target label in editor
 * @property {number} columnEnd - Ending column of target label in editor
 */
export interface JumpLocation {
  blockId: string;
  target: string;
  type: 'jump' | 'call';
  isDynamic?: boolean;
  line: number;
  columnStart: number;
  columnEnd: number;
  choiceText?: string;      // Set when this jump is inside a menu choice block
  choiceCondition?: string; // The `if <expr>` guard on the choice, if any
  menuLine?: number;        // 1-based line of the `menu:` keyword (groups choices in the same menu)
}

/**
 * Represents a single line of dialogue in the script.
 * @interface DialogueLine
 * @property {number} line - Line number in the block
 * @property {string} tag - Character tag speaking the dialogue
 */
export interface DialogueLine {
  line: number;
  tag: string;
}

/**
 * Represents a single label node on the Flow Canvas.
 * Each label is a distinct point in the narrative flow.
 * @interface LabelNode
 * @property {string} id - Composite key: `${blockId}:${label}`
 * @property {string} label - Label name
 * @property {string} blockId - ID of containing block
 * @property {string} [containerName] - Display name of the file/block
 * @property {number} startLine - Starting line number in the file
 * @property {Position} position - Canvas position for rendering
 * @property {number} width - Node width (pixels)
 * @property {number} height - Node height (pixels)
 */
export interface LabelNode {
  id: string;
  label: string;
  blockId: string;
  containerName?: string;
  startLine: number;
  position: Position;
  width: number;
  height: number;
  /** Image tag from the first `scene` statement in this label's body (e.g. "bg library") */
  sceneImageName?: string;
}

/**
 * Represents a connection between two label nodes on the Flow Canvas.
 * Shows the flow of execution from one label to another.
 * @interface RouteLink
 * @property {string} id - Unique identifier for the link
 * @property {string} sourceId - Source label node ID
 * @property {string} targetId - Target label node ID
 * @property {'jump' | 'call' | 'implicit'} type - Type of flow (explicit jump/call or implicit fall-through)
 */
export interface RouteLink {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'jump' | 'call' | 'implicit';
  choiceText?: string;      // Set when this link originated from a menu choice jump
  choiceCondition?: string; // The `if <expr>` guard on the choice, if any
  sourceLine?: number;      // Line number of the jump statement (for "Open in editor")
  menuLine?: number;        // Line of the `menu:` keyword — groups all edges from the same menu
}

/**
 * Represents one identified route (path) through the entire label graph.
 * Used to color-code different narrative paths in the Flow Canvas.
 * @interface IdentifiedRoute
 * @property {number} id - Unique route identifier
 * @property {string} color - Hex color code for visual representation
 * @property {Set<string>} linkIds - Set of route link IDs that comprise this route
 */
export interface IdentifiedRoute {
  id: number;
  color: string;
  linkIds: Set<string>;
}

/**
 * Comprehensive analysis result containing all extracted data from Ren'Py blocks.
 * Returned by performRenpyAnalysis() and useRenpyAnalysis() hook.
 * @interface RenpyAnalysisResult
 * @property {Link[]} links - Inter-block connections from jump/call statements
 * @property {Object} invalidJumps - Map of block ID to array of unresolvable jump targets
 * @property {Object} firstLabels - Map of block ID to first label name found
 * @property {Object} labels - Map of label name to detailed location information
 * @property {Object} jumps - Map of block ID to array of jump locations
 * @property {Set<string>} rootBlockIds - Block IDs with no incoming jumps (entry points)
 * @property {Set<string>} leafBlockIds - Block IDs with no outgoing jumps (endings)
 * @property {Set<string>} branchingBlockIds - Block IDs with multiple paths (menus/conditions)
 * @property {Set<string>} screenOnlyBlockIds - Block IDs that only define screens, not story
 * @property {Set<string>} storyBlockIds - Block IDs containing story content
 * @property {Set<string>} configBlockIds - Block IDs for configuration (options.rpy, etc.)
 * @property {Map<string, Character>} characters - Map of character tag to Character definition
 * @property {Map<string, DialogueLine[]>} dialogueLines - Map of block ID to dialogue lines
 * @property {Map<string, number>} characterUsage - Map of character tag to appearance count
 * @property {Map<string, Variable>} variables - Map of variable name to definition
 * @property {Map<string, VariableUsage[]>} variableUsages - Map of variable name to usage locations
 * @property {Map<string, RenpyScreen>} screens - Map of screen name to definition
 * @property {Set<string>} definedImages - Set of image tags defined in code
 * @property {Map<string, Set<string>>} blockTypes - Map of block ID to content types found
 * @property {LabelNode[]} labelNodes - All nodes in Flow Canvas visualization
 * @property {RouteLink[]} routeLinks - All connections in Flow Canvas
 * @property {IdentifiedRoute[]} identifiedRoutes - Identified narrative paths
 * @property {boolean} routesTruncated - True when route enumeration hit the hard cap
 * @property {TranslationAnalysisResult} translationData - Translation coverage data
 */

/** A source string that can be translated (dialogue, narration, or menu choice). */
export interface TranslatableString {
  id: string;
  sourceText: string;
  blockId: string;
  filePath: string;
  line: number;
  labelScope: string | null;
  characterTag: string | null;
  type: 'dialogue' | 'narration' | 'menu-choice';
}

/** A translated string extracted from a `translate` block. */
export interface TranslatedString {
  id: string;
  translatedText: string;
  blockId: string;
  filePath: string;
  line: number;
  language: string;
  /** Character tag from dialogue translation, null for narration/string-table entries. */
  characterTag: string | null;
  /** Source text from old/new string tables, null for block translations. */
  sourceText: string | null;
}

/** Per-language translation coverage statistics. */
export interface LanguageCoverage {
  language: string;
  totalStrings: number;
  translatedCount: number;
  staleCount: number;
  untranslatedCount: number;
  completionPercent: number;
  fileBreakdown: TranslationFileBreakdown[];
}

/** Per-file translation breakdown within a language. */
export interface TranslationFileBreakdown {
  sourceFilePath: string;
  totalStrings: number;
  translatedCount: number;
  staleCount: number;
  completionPercent: number;
}

/** Top-level translation analysis result. */
export interface TranslationAnalysisResult {
  translatableStrings: TranslatableString[];
  translatedStrings: Map<string, TranslatedString[]>;
  languageCoverages: LanguageCoverage[];
  detectedLanguages: string[];
  stringTranslations: Map<string, Map<string, TranslatedString>>;
}

export interface RenpyAnalysisResult {
  links: Link[];
  invalidJumps: { [blockId: string]: string[] };
  firstLabels: { [blockId: string]: string };
  labels: { [label: string]: LabelLocation };
  jumps: { [blockId: string]: JumpLocation[] };
  rootBlockIds: Set<string>;
  leafBlockIds: Set<string>;
  branchingBlockIds: Set<string>;
  screenOnlyBlockIds: Set<string>;
  storyBlockIds: Set<string>;
  configBlockIds: Set<string>;
  characters: Map<string, Character>;
  dialogueLines: Map<string, DialogueLine[]>;
  characterUsage: Map<string, number>;
  variables: Map<string, Variable>;
  variableUsages: Map<string, VariableUsage[]>;
  screens: Map<string, RenpyScreen>;
  definedImages: Set<string>;
  blockTypes: Map<string, Set<string>>;
  labelNodes: LabelNode[];
  routeLinks: RouteLink[];
  identifiedRoutes: IdentifiedRoute[];
  routesTruncated: boolean;
  translationData: TranslationAnalysisResult;
}


/**
 * Represents a single open tab in the main editor UI.
 * Tabs can display different views: canvas, code editor, images, characters, etc.
 * @interface EditorTab
 * @property {string} id - Unique tab identifier (block ID or view name)
 * @property {'canvas' | 'route-canvas' | 'punchlist' | 'editor' | 'image' | 'audio' | 'character' | 'scene-composer'} type - Type of tab content
 * @property {string} [blockId] - Block ID if editing code (for editor type)
 * @property {string} [filePath] - File path for image/audio tabs
 * @property {string} [characterTag] - Character tag for character editor tabs
 * @property {string} [initialCharacterTag] - Pre-filled tag for a new character tab opened from an editor selection
 * @property {string} [initialCharacterName] - Pre-filled display name for a new character tab opened from an editor selection
 * @property {string} [sceneId] - Scene ID for scene composer tabs
 * @property {Object} [scrollRequest] - Request to scroll editor to specific line
 * @property {number} scrollRequest.line - Target line number
 * @property {number} scrollRequest.key - Unique key to trigger scroll event
 */
export interface EditorTab {
  id: string;
  type: 'canvas' | 'route-canvas' | 'choice-canvas' | 'notecard-canvas' | 'punchlist' | 'diagnostics' | 'editor' | 'image' | 'audio' | 'character' | 'scene-composer' | 'imagemap-composer' | 'screen-preview' | 'stats' | 'markdown' | 'translations' | 'untitled';
  blockId?: string;
  filePath?: string;
  characterTag?: string;
  initialCharacterTag?: string;
  initialCharacterName?: string;
  sceneId?: string;
  imagemapId?: string;
  scrollRequest?: { line: number; key: number };
  /** Display title for tab types that don't derive one from `blocks[]` or a file path — currently only 'untitled'. */
  title?: string;
}

/**
 * A recently-closed tab, kept on a LIFO stack so it can be reopened (Ctrl+Shift+T).
 * @interface ClosedTabEntry
 * @property {EditorTab} tab - The tab as it existed at close time
 * @property {'primary' | 'secondary'} paneId - Which pane it was closed from
 * @property {number} index - Its position within that pane's tab list, used to reinsert it in roughly the same spot
 */
export interface ClosedTabEntry {
  tab: EditorTab;
  paneId: 'primary' | 'secondary';
  index: number;
}

/**
 * Represents a node in the file explorer tree hierarchy.
 * Used to display the project's folder structure in the left panel.
 * @interface FileSystemTreeNode
 * @property {string} name - File or folder name
 * @property {string} path - Absolute path to the file or folder
 * @property {FileSystemTreeNode[]} [children] - Child nodes for folders
 */
export interface FileSystemTreeNode {
  name: string;
  path: string;
  children?: FileSystemTreeNode[];
}

/**
 * Represents a single toast notification message.
 * Displayed as a temporary notification in the UI.
 * @interface ToastMessage
 * @property {string} id - Unique message identifier
 * @property {string} message - Message text to display
 * @property {'success' | 'error' | 'warning' | 'info'} type - Message severity type
 */
export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

/**
 * Type for available UI themes.
 * @typedef {('system' | 'light' | 'dark' | 'solarized-light' | 'solarized-dark' | 'colorful' | 'colorful-light' | 'neon-dark' | 'ocean-dark' | 'candy-light' | 'forest-light')} Theme
 */
export type Theme = 'system' | 'light' | 'dark' | 'solarized-light' | 'solarized-dark' | 'colorful' | 'colorful-light' | 'neon-dark' | 'ocean-dark' | 'candy-light' | 'forest-light' | 'synthwave';

/**
 * User-configurable line-count thresholds for the file-size warning system.
 * Three ascending cutoffs define four severity zones: Green (Ideal) up to
 * `healthy`, Yellow (Healthy) up to `warning`, Orange (Warning) up to
 * `critical`, Red (Critical) above `critical`.
 * @interface FileSizeThresholds
 */
export interface FileSizeThresholds {
  healthy: number;
  warning: number;
  critical: number;
}

/**
 * Application-level settings persisted across sessions.
 * Includes UI preferences, paths, and editor settings.
 * @interface AppSettings
 * @property {Theme} theme - Current UI theme
 * @property {boolean} isLeftSidebarOpen - Whether left sidebar is visible
 * @property {number} leftSidebarWidth - Width of left sidebar (pixels)
 * @property {boolean} isRightSidebarOpen - Whether right sidebar is visible
 * @property {number} rightSidebarWidth - Width of right sidebar (pixels)
 * @property {string} renpyPath - Path to Ren'Py SDK directory (executable derived per-OS: renpy.exe / renpy.sh)
 * @property {string[]} recentProjects - List of recently opened project paths
 * @property {string} [lastProjectDir] - Parent directory last used when creating a new project (for dialog pre-fill)
 * @property {string} editorFontFamily - Font family for code editor
 * @property {number} editorFontSize - Font size for code editor (pixels)
 * @property {Record<string, boolean>} [snippetCategoriesState] - Collapsed/expanded state of snippet categories
 * @property {FileSizeThresholds} [fileSizeThresholds] - Line-count thresholds for the file-size warning indicators
 */
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
  mouseGestures?: MouseGestureSettings;
  userSnippets?: UserSnippet[];
  menuTemplates?: MenuTemplate[];
  lastProjectDir?: string;
  fileSizeThresholds?: FileSizeThresholds;
}

/**
 * A user-defined code snippet.
 * Stored in AppSettings and available in both the SnippetManager panel and Monaco autocomplete.
 */
export interface UserSnippet {
  id: string;
  title: string;
  prefix: string;
  description: string;
  code: string;
  monacoBody?: string;
}

/**
 * A single built-in/shared code snippet, as loaded from default-snippets.json,
 * a user global custom.json, a project .vangard/snippets.json, or an imported
 * community pack. Distinct from `UserSnippet` (which additionally has an `id`
 * and `prefix` for Monaco autocomplete and is persisted via `AppSettings`).
 */
export interface Snippet {
  title: string;
  description: string;
  code: string;
  /** Optional free-form tags for filtering, beyond the category name. */
  tags?: string[];
}

export interface SnippetCategory {
  name: string;
  snippets: Snippet[];
}

/** A single tunable value on an `ATLPreset`'s template. */
export interface ATLPresetParameter {
  name: string;
  type: 'duration' | 'easing' | 'repeat' | 'offset' | 'intensity';
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
  /** Selectable values for `type: 'easing'`. */
  options?: string[];
}

/**
 * A parameterized ATL (Animation & Transform Language) snippet, browsed and
 * configured via `ATLPresetBrowser`. `atlTemplate` holds `{paramName}`
 * placeholders substituted by `instantiatePreset`; `code` holds the template
 * pre-filled with each parameter's `defaultValue`, so a preset is still a
 * valid, copyable `Snippet` on its own.
 */
export interface ATLPreset extends Snippet {
  parameters: ATLPresetParameter[];
  atlTemplate: string;
}

/** On-disk shape of default-snippets.json, custom.json, .vangard/snippets.json, and exported packs. */
export interface SnippetPackFile {
  version: string;
  categories: SnippetCategory[];
}

/**
 * Represents a single choice in a menu template.
 * @interface MenuChoice
 * @property {string} id - Unique identifier for the choice
 * @property {string} text - Display text for the choice
 * @property {string} [condition] - Optional condition (e.g., "points > 10")
 * @property {'jump' | 'call' | 'pass' | 'return'} action - Action to take when selected
 * @property {string} [target] - Target label for jump/call actions
 */
export interface MenuChoice {
  id: string;
  text: string;
  condition?: string;
  action: 'jump' | 'call' | 'pass' | 'return' | 'code';
  target?: string;
  codeBlock?: string;
}

/**
 * Represents a saved menu template for reuse.
 * @interface MenuTemplate
 * @property {string} id - Unique identifier for the template
 * @property {string} name - Display name for the template
 * @property {string} [description] - Optional description
 * @property {string} [menuStatement] - Optional menu prompt text
 * @property {MenuChoice[]} choices - Array of menu choices
 * @property {number} createdAt - Timestamp when created
 * @property {number} updatedAt - Timestamp when last updated
 */
export interface MenuTemplate {
  id: string;
  name: string;
  description?: string;
  menuStatement?: string;
  choices: MenuChoice[];
  createdAt: number;
  updatedAt: number;
}

export type CanvasPanGesture = 'shift-drag' | 'drag' | 'middle-drag';

export interface MouseGestureSettings {
  canvasPanGesture: CanvasPanGesture;
  middleMouseAlwaysPans: boolean;
  zoomScrollDirection: 'normal' | 'inverted';
  zoomScrollSensitivity: number;
}

/**
 * Represents a sprite in a scene composition.
 * Used by Scene Composer to manage visual elements.
 * @interface SceneSprite
 * @property {string} id - Unique sprite identifier
 * @property {ProjectImage} image - Image asset for the sprite
 * @property {number} x - Horizontal alignment (0.0 to 1.0, where 0 is left, 1 is right)
 * @property {number} y - Vertical alignment (0.0 to 1.0, where 0 is top, 1 is bottom)
 * @property {number} zoom - Scale factor (1.0 is original size)
 * @property {number} zIndex - Layering order (higher = on top)
 * @property {boolean} flipH - Horizontal flip
 * @property {boolean} flipV - Vertical flip
 * @property {number} rotation - Rotation angle in degrees
 * @property {number} alpha - Opacity (0.0 to 1.0)
 * @property {number} blur - Blur effect in pixels
 * @property {boolean} [visible] - Whether sprite is visible
 */
export interface SceneSprite {
  id: string;
  image: ProjectImage;
  x: number;
  y: number;
  zoom: number;
  zIndex: number;
  flipH: boolean;
  flipV: boolean;
  rotation: number;
  alpha: number;
  blur: number;
  visible?: boolean;
  locked?: boolean;
  colorMode?: 'none' | 'tint' | 'colorize';
  tintColor?: string;
  colorizeBlack?: string;
  colorizeWhite?: string;
  saturation?: number;
  brightness?: number;
  contrast?: number;
  invert?: number;
  activeShader?: string;
  shaderUniforms?: Record<string, number>;
}

/**
 * Represents a complete scene composition with background and sprites.
 * Used by Scene Composer to manage visual layouts.
 * @interface SceneComposition
 * @property {SceneSprite | null} background - Background image (null if none)
 * @property {SceneSprite[]} sprites - Array of foreground sprites
 * @property {{ width: number; height: number }} [resolution] - Reference canvas resolution (defaults to 1920×1080)
 */
export interface SceneComposition {
  background: SceneSprite | null;
  sprites: SceneSprite[];
  resolution?: { width: number; height: number };
  animations?: SpriteAnimation[];
}

/** Ren'Py's standard ATL easing/warp functions. */
export type EasingFunction = 'linear' | 'ease' | 'easein' | 'easeout' | 'easein_quad' | 'easeout_quad' | 'easeinout_quad';

export type AnimatableProperty = 'x' | 'y' | 'zoom' | 'alpha' | 'rotation' | 'blur' | 'saturation' | 'brightness' | 'contrast' | 'invert';

/** A full pose snapshot for a timeline's covered properties, at a point in time. */
export interface PoseKeyframe {
  id: string;
  /** Seconds from the start of this timeline (not the sprite's other timelines). */
  time: number;
  /** One value per property in the owning timeline's `properties` set. */
  values: Partial<Record<AnimatableProperty, number>>;
  /** Easing applied to the transition arriving at this keyframe from the previous one. Ignored on a timeline's first keyframe. */
  easing: EasingFunction;
}

/** One named, independently-timed pose-keyframe sequence, scoped to a subset of the owning sprite's animatable properties. */
export interface SpriteTimeline {
  id: string;
  name: string;
  properties: AnimatableProperty[];
  keyframes: PoseKeyframe[];
  duration: number;
  loop: boolean;
}

/** All timeline-based animation for one sprite (SceneSprite.id, or 'background'). */
export interface SpriteAnimation {
  spriteId: string;
  /** How this sprite's timelines combine: simultaneously (default), or one after another in list order. */
  combineMode: 'parallel' | 'sequential';
  timelines: SpriteTimeline[];
}

/**
 * Action type for ImageMap hotspot interactions.
 * Determines what happens when a hotspot is clicked.
 * @typedef {('jump' | 'call')} ImageMapActionType
 */
export type ImageMapActionType = 'jump' | 'call';

/**
 * Represents a clickable hotspot region in an imagemap.
 * @interface ImageMapHotspot
 * @property {string} id - Unique identifier for the hotspot
 * @property {number} x - X coordinate of top-left corner (pixels)
 * @property {number} y - Y coordinate of top-left corner (pixels)
 * @property {number} width - Width of the hotspot region (pixels)
 * @property {number} height - Height of the hotspot region (pixels)
 * @property {ImageMapActionType} actionType - Type of action (jump or call)
 * @property {string} targetLabel - Label to jump/call when clicked
 */
export interface ImageMapHotspot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  actionType: ImageMapActionType;
  targetLabel: string;
}

/**
 * Represents a complete imagemap composition with ground image and hotspots.
 * Used by ImageMap Composer to design clickable image regions.
 * @interface ImageMapComposition
 * @property {string} screenName - Name of the Ren'Py screen
 * @property {ProjectImage | null} groundImage - Base image for the imagemap
 * @property {ProjectImage | null} hoverImage - Optional hover overlay image
 * @property {ImageMapHotspot[]} hotspots - Array of clickable hotspot regions
 */
export interface ImageMapComposition {
  screenName: string;
  groundImage: ProjectImage | null;
  hoverImage: ProjectImage | null;
  hotspots: ImageMapHotspot[];
}

/**
 * Widget types supported by the Screen Layout Composer.
 * Maps to Ren'Py screen language statement types.
 */
export type ScreenWidgetType =
  // Layout containers
  'vbox' | 'hbox' | 'fixed' | 'frame' | 'window' | 'side' |
  // Scrollable / grid containers
  'viewport' | 'vpgrid' | 'grid' |
  // Transform & drag containers
  'transform' | 'drag' | 'draggroup' |
  // Imagemap containers & hotspots
  'imagemap' | 'hotspot' | 'hotbar' |
  // Display
  'text' | 'label' | 'image' |
  // Interactive
  'textbutton' | 'button' | 'imagebutton' | 'bar' | 'vbar' | 'input' | 'null' |
  // Screen inclusion
  'use' | 'transclude' |
  // Utility statements
  'key' | 'timer' | 'mousearea' | 'nearrect' | 'dismiss' | 'on' | 'default' |
  // Fallback — also used for control flow (if/elif/else, for, showif, python)
  'raw';

/**
 * A single widget node in a screen layout composition.
 * Widgets may be nested (vbox/hbox/frame carry children).
 * Top-level widgets support absolute positioning via xpos/ypos/xalign/yalign.
 * Children of container widgets are flow-positioned by the container.
 */

/**
 * Resolved visual style properties parsed from inline style-property lines
 * (background, color, size, bold, etc.) inside a widget block.
 * Preview-only — not used by code generation.
 */
export interface ScreenWidgetStyleProps {
  background?: string;    // CSS colour string (from "#hex" or Solid())
  bgImagePath?: string;   // image path from Frame()/Image() background
  color?: string;         // text / foreground colour
  fontSize?: number;      // Ren'Py size in game pixels
  bold?: boolean;
  italic?: boolean;
  xpadding?: number;      // in game pixels
  ypadding?: number;
  xfill?: boolean;
  yfill?: boolean;
  xmaximum?: number;
  ymaximum?: number;
  xminimum?: number;
  yminimum?: number;
  textAlign?: number;     // 0 = left, 0.5 = centre, 1 = right
}

export interface ScreenWidget {
  id: string;
  type: ScreenWidgetType;
  xpos?: number;
  ypos?: number;
  xalign?: number;
  yalign?: number;
  text?: string;
  action?: string;
  imagePath?: string;
  /** Preview-only: data/media URL for displaying the image in the composer. Not used in code generation. */
  imageDataUrl?: string;
  style?: string;
  xsize?: number;
  ysize?: number;
  children?: ScreenWidget[];
  /** 'viewport' widget: which scrollbars to show */
  scrollbars?: 'vertical' | 'horizontal' | 'both';
  /** 'viewport' widget: whether to enable mousewheel scrolling */
  mousewheel?: boolean;
  /** 'raw' widget: verbatim source content (also holds control-flow blocks: if/for/python/showif) */
  code?: string;
  /** Unrecognised attribute lines preserved verbatim; emitted before children in code gen */
  extraProps?: string[];
  /** Parsed visual style properties — preview-only, not used in code gen */
  styleProps?: ScreenWidgetStyleProps;
  /** style_prefix property — passed down to children to compute their effective style name */
  stylePrefix?: string;

  // ── vpgrid / grid ────────────────────────────────────────────────────────
  cols?: number;
  rows?: number;

  // ── side ─────────────────────────────────────────────────────────────────
  /** side widget: positions string, e.g. "t l c r b" */
  sidePositions?: string;

  // ── use ──────────────────────────────────────────────────────────────────
  /** use widget: target screen name */
  useScreen?: string;
  /** use widget: argument string, e.g. "title=_('Save')" */
  useArgs?: string;

  // ── key / timer ──────────────────────────────────────────────────────────
  /** key widget: keysym string, e.g. "game_menu" */
  keyBinding?: string;
  /** timer widget: delay expression, e.g. "0.5" */
  timerDelay?: string;

  // ── bar / vbar ───────────────────────────────────────────────────────────
  /** bar/vbar value expression, e.g. "Preference('music volume', 'set')" */
  barValue?: string;

  // ── interactive events ───────────────────────────────────────────────────
  hovered?: string;
  unhovered?: string;
  sensitive?: string;
  selected?: string;

  // ── accessibility ────────────────────────────────────────────────────────
  alt?: string;

  // ── imagebutton ──────────────────────────────────────────────────────────
  /** imagebutton auto format string, e.g. "gui/button/%s.png" */
  auto?: string;

  // ── layout ───────────────────────────────────────────────────────────────
  /** spacing between children (string: may reference a variable) */
  spacing?: string;

  // ── on ───────────────────────────────────────────────────────────────────
  /** on widget: event name, e.g. "show", "hide", "replace" */
  onEvent?: string;

  // ── default ──────────────────────────────────────────────────────────────
  /** default widget: screen variable name */
  defaultVariable?: string;
  /** default widget: default value expression */
  defaultValue?: string;

  // ── hotspot / hotbar ─────────────────────────────────────────────────────
  /** hotspot/hotbar: area tuple string, e.g. "(0, 0, 100, 100)" */
  hotspotArea?: string;

  // ── nearrect ─────────────────────────────────────────────────────────────
  /** nearrect: focus name to track */
  nearrectFocus?: string;
  /** nearrect: preferred side, e.g. "bottom" */
  nearrectSide?: string;

  // ── drag ─────────────────────────────────────────────────────────────────
  /** drag widget: drag_name property */
  dragName?: string;
}

/**
 * A complete screen layout composition managed by the Screen Layout Composer.
 * Generates a Ren'Py `screen` block. Persisted in ProjectSettings.
 */
export interface ScreenLayoutComposition {
  screenName: string;
  /** Raw parameter list from the screen declaration, e.g. "title, scroll=None" */
  parameters?: string;
  gameWidth: number;
  gameHeight: number;
  modal: boolean;
  zorder: number;
  widgets: ScreenWidget[];
}

/**
 * Project-level settings stored per Ren'Py project.
 * Includes tab state and custom content.
 * @interface ProjectSettings
 * @property {boolean} draftingMode - Whether drafting mode is active
 * @property {EditorTab[]} openTabs - Currently open editor tabs
 * @property {string} activeTabId - ID of the currently active tab
 * @property {StickyNote[]} [stickyNotes] - Annotations on the canvas
 * @property {Record<string, string>} [characterProfiles] - Character profile notes indexed by character tag
 * @property {Record<string, PunchlistMetadata>} [punchlistMetadata] - Task tracking metadata
 * @property {Record<string, SceneComposition>} [sceneCompositions] - Saved scene layouts indexed by scene ID
 * @property {Record<string, string>} [sceneNames] - Display names for scenes
 * @property {string[]} [scannedImagePaths] - Paths to directories scanned for images
 * @property {string[]} [scannedAudioPaths] - Paths to directories scanned for audio
 */
export interface ProjectSettings {
  draftingMode: boolean;
  storyCanvasLayoutMode?: StoryCanvasLayoutMode;
  storyCanvasGroupingMode?: StoryCanvasGroupingMode;
  storyCanvasLayoutFingerprint?: string;
  storyCanvasLayoutVersion?: number;
  storyCanvasLayoutWasUserAdjusted?: boolean;
  storyBlockLayouts?: Record<string, SavedStoryBlockLayout>;
  storyCanvasHasAutocentered?: boolean;
  routeCanvasLayoutMode?: StoryCanvasLayoutMode;
  routeCanvasGroupingMode?: StoryCanvasGroupingMode;
  routeCanvasLayoutFingerprint?: string;
  routeCanvasLayoutVersion?: number;
  routeCanvasLayoutWasUserAdjusted?: boolean;
  routeNodeLayouts?: Record<string, SavedRouteNodeLayout>;
  routeCanvasHasAutocentered?: boolean;
  choiceCanvasLayoutMode?: StoryCanvasLayoutMode;
  choiceCanvasGroupingMode?: StoryCanvasGroupingMode;
  choiceCanvasHasAutocentered?: boolean;
  openTabs: EditorTab[];
  activeTabId: string;
  splitLayout?: 'none' | 'right' | 'bottom';
  splitPrimarySize?: number;
  secondaryOpenTabs?: EditorTab[];
  secondaryActiveTabId?: string;
  stickyNotes?: StickyNote[];
  routeStickyNotes?: StickyNote[];
  choiceStickyNotes?: StickyNote[];
  notecards?: Notecard[];
  notecardLinks?: NotecardLink[];
  notecardTimeline?: NotecardTimelineSettings;
  characterProfiles?: Record<string, string>;
  punchlistMetadata?: Record<string, PunchlistMetadata>;
  diagnosticsTasks?: DiagnosticsTask[];
  ignoredDiagnostics?: IgnoredDiagnosticRule[];
  sceneCompositions?: Record<string, SerializedSceneComposition>;
  sceneNames?: Record<string, string>;
  imagemapCompositions?: Record<string, SerializedImageMapComposition>;
  scannedImagePaths?: string[];
  scannedAudioPaths?: string[];
  storyElementsTabState?: {
    activeTab: 'storyData' | 'assets' | 'composers' | 'tools';
    activeSubTab?: 'characters' | 'variables' | 'screens' | 'images' | 'audio' | 'scenes' | 'imagemaps' | 'snippets' | 'animations' | 'menuTemplates' | 'colorPalette';
  };
  dismissedImplicitVariableHint?: boolean;
  completedMilestones?: string[];
}

/**
 * The slice of ProjectSettings actually held in the useSettingsManagement useImmer state.
 * The excluded fields are persisted separately (their own useImmer/useState in App.tsx) or
 * are session-only, per CLAUDE.md's state table.
 */
export type PersistedProjectSettings = Omit<ProjectSettings, 'openTabs' | 'activeTabId' | 'stickyNotes' | 'characterProfiles' | 'punchlistMetadata' | 'diagnosticsTasks' | 'ignoredDiagnostics' | 'sceneCompositions' | 'sceneNames' | 'scannedImagePaths' | 'scannedAudioPaths'>;

/**
 * Combined settings interface for components that need both app and project settings.
 * Used primarily in the Settings Modal.
 * @interface IdeSettings
 * @extends AppSettings
 * @extends PersistedProjectSettings
 */
export interface IdeSettings extends AppSettings, PersistedProjectSettings {}

/**
 * Represents the current clipboard state for cut/copy operations in the file explorer.
 * @typedef {({type: 'copy' | 'cut'; paths: Set<string>} | null)} ClipboardState
 * - null: Nothing in clipboard
 * - type 'copy': Items to be copied to new location
 * - type 'cut': Items to be moved to new location
 */
export type ClipboardState = { type: 'copy' | 'cut'; paths: Set<string> } | null;

/**
 * Represents a single match result from a text search in the project.
 * @interface SearchMatch
 * @property {number} lineNumber - Line number of the match (1-based)
 * @property {string} lineContent - Full text content of the matching line
 * @property {number} startColumn - Starting column of match in the line
 * @property {number} endColumn - Ending column of match in the line
 */
export interface SearchMatch {
  lineNumber: number;
  lineContent: string;
  startColumn: number;
  endColumn: number;
}

/**
 * Represents search results from a single file.
 * @interface SearchResult
 * @property {string} filePath - Path to the file containing matches
 * @property {SearchMatch[]} matches - Array of matches found in the file
 */
export interface SearchResult {
  filePath: string;
  matches: SearchMatch[];
}

// --- IPC Data Shapes (returned by Electron main process) ---

/** A file entry returned by the loadProject IPC handler. */
export interface ProjectFileEntry {
  path: string;
  content: string;
}

/** An image asset entry returned by loadProject or scanDirectory. */
export interface ScannedImageAsset {
  path: string;
  fileName: string;
  dataUrl: string;
  lastModified: number;
  size: number;
}

/** An audio asset entry returned by loadProject or scanDirectory. */
export interface ScannedAudioAsset {
  path: string;
  fileName: string;
  dataUrl: string;
  lastModified: number;
  size: number;
}

/** Result of the loadProject IPC call. */
export interface ProjectLoadResult {
  rootPath: string;
  files: ProjectFileEntry[];
  images: ScannedImageAsset[];
  audios: ScannedAudioAsset[];
  settings: ProjectSettings | null;
  tree: FileSystemTreeNode;
  /** Set when game/project.ide.json existed but could not be parsed/read (as opposed to simply being absent). */
  settingsWarning?: { code: 'corrupted' | 'permission-denied' | 'unknown'; message: string } | null;
}

/** Result of the scanDirectory IPC call. */
export interface ScanDirectoryResult {
  images: ScannedImageAsset[];
  audios: ScannedAudioAsset[];
  truncated?: boolean;
  cancelled?: boolean;
  errors?: { path: string; message: string }[];
  error?: string;
}

/** Result of the searchInProject IPC call. */
export interface ProjectSearchOutcome {
  results: SearchResult[];
  truncated: boolean;
  cancelled: boolean;
  skipped: { path: string; message: string }[];
  regexError: string | null;
}

export interface PendingStoryLayoutRefresh {
  hasSavedLayouts: boolean;
  savedFingerprint?: string;
  savedVersion?: number;
  savedWasUserAdjusted: boolean;
}

export interface PendingRouteLayoutRefresh {
  hasSavedLayouts: boolean;
  savedFingerprint?: string;
  savedVersion?: number;
  savedWasUserAdjusted: boolean;
}

/**
 * Pure value object representing the fully-deserialized project state produced
 * from a `ProjectLoadResult`. Has no React setters or IPC references.
 * Produced by `deserializeProjectData`; consumed by `hydrateFromProjectData`.
 */
export interface ProjectSnapshot {
  rootPath: string;
  tree: FileSystemTreeNode;
  blocks: Block[];
  /** Non-null when the project had no files and a default script.rpy was synthesised — caller must write it via IPC. */
  defaultScriptBlock: Block | null;
  images: Map<string, ProjectImage>;
  audios: Map<string, RenpyAudio>;
  imageScanPaths: string[];
  audioScanPaths: string[];
  stickyNotes: StickyNote[];
  routeStickyNotes: StickyNote[];
  choiceStickyNotes: StickyNote[];
  notecards: Notecard[];
  notecardLinks: NotecardLink[];
  notecardTimeline: NotecardTimelineSettings;
  characterProfiles: Record<string, string>;
  punchlistMetadata: Record<string, PunchlistMetadata>;
  diagnosticsTasks: DiagnosticsTask[];
  ignoredDiagnostics: IgnoredDiagnosticRule[];
  dismissedImplicitVariableHint: boolean;
  sceneCompositions: Record<string, SceneComposition>;
  sceneNames: Record<string, string>;
  imagemapCompositions: Record<string, ImageMapComposition>;
  routeNodeLayoutCache: Map<string, Position>;
  primaryTabs: EditorTab[];
  primaryActiveTabId: string;
  secondaryTabs: EditorTab[];
  secondaryActiveTabId: string;
  splitLayout: 'none' | 'right' | 'bottom';
  splitPrimarySize: number;
  pendingStoryLayoutRefresh: PendingStoryLayoutRefresh;
  pendingRouteLayoutRefresh: PendingRouteLayoutRefresh;
  canvasSettings: {
    draftingMode: boolean;
    storyCanvasLayoutMode: string;
    storyCanvasGroupingMode: string;
    storyCanvasLayoutFingerprint: string | undefined;
    storyCanvasLayoutVersion: number;
    storyCanvasLayoutWasUserAdjusted: boolean;
    routeCanvasLayoutMode: string;
    routeCanvasGroupingMode: string;
    routeCanvasLayoutFingerprint: string | undefined;
    routeCanvasLayoutVersion: number;
    routeCanvasLayoutWasUserAdjusted: boolean;
    completedMilestones: string[];
  };
}

/** Serialized sprite for saving scene compositions (paths only, no data URLs). */
export interface SerializedSprite {
  id: string;
  image: { filePath: string };
  x: number;
  y: number;
  zoom: number;
  zIndex: number;
  flipH: boolean;
  flipV: boolean;
  rotation: number;
  alpha: number;
  blur: number;
  visible?: boolean;
}

/** Serialized scene composition for persistence. */
export interface SerializedSceneComposition {
  background: SerializedSprite | null;
  sprites: SerializedSprite[];
  resolution?: { width: number; height: number };
  animations?: SpriteAnimation[];
}

/** File path reference used when serializing image map compositions for persistence. */
export interface SerializedImageRef {
  filePath: string;
}

/** Serialized image map composition for persistence (paths only, no loaded image objects). */
export interface SerializedImageMapComposition {
  screenName: string;
  groundImage: SerializedImageRef | null;
  hoverImage: SerializedImageRef | null;
  hotspots: ImageMapHotspot[];
}

/**
 * Options for creating a new Ren'Py project from template
 */
export interface CreateProjectOptions {
  projectDir: string;      // Full path to project directory
  projectName: string;     // User-entered project name
  width: number;           // Game resolution width
  height: number;          // Game resolution height
  accentColor: string;     // Hex color string (e.g., "#00b8c3")
  isLight: boolean;        // True for light theme, false for dark
  sdkPath?: string;        // Optional Ren'Py SDK path
}

/**
 * Global Electron API interface available in windows.electronAPI.
 * Provides access to OS-level features in Electron app mode.
 * Methods for file operations, Ren'Py execution, game control, and IPC.
 */
declare global {
  interface Window {
    electronAPI?: {
          getStartupArgs?: () => Promise<{ projectPath: string | null }>;
          openDirectory: () => Promise<string | null>;
          createProject?: () => Promise<string | null>;
          createProjectFromTemplate?: (options: CreateProjectOptions) => Promise<{ success: boolean; path?: string; error?: string }>;
          checkRenpyProject?: (path: string) => Promise<{ hasGameFolder: boolean; isRenpyProject: boolean }>;
          cancelProjectLoad?: () => void;
          onLoadProgress?: (callback: (value: number, message: string) => void) => () => void;
          loadProject: (path: string) => Promise<ProjectLoadResult>;
          refreshProjectTree: (path: string) => Promise<FileSystemTreeNode>;
          refreshProject: (path: string) => Promise<ProjectLoadResult>;
          readFile: (path: string) => Promise<string>;
          fileExists: (path: string) => Promise<boolean>;
          writeFile: (path: string, content: string, encoding?: string) => Promise<{ success: boolean; error?: string }>;
          createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
          removeEntry: (path: string) => Promise<{ success: boolean; error?: string }>;
          moveFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
          copyEntry: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
          scanDirectory: (path: string) => Promise<ScanDirectoryResult>;
          cancelScanDirectory?: () => void;
          onScanProgress?: (callback: (count: number) => void) => () => void;
          onMenuCommand: (callback: (data: { command: string, type?: 'canvas' | 'route-canvas' | 'punchlist', path?: string }) => void) => () => void;
          onCheckUnsavedChangesBeforeExit: (callback: () => void) => () => void;
          replyUnsavedChangesBeforeExit: (hasUnsaved: boolean) => void;
          onShowExitModal: (callback: () => void) => () => void;
          forceQuit: () => void;
          getAppSettings: () => Promise<Partial<AppSettings> | null>;
          saveAppSettings: (settings: AppSettings) => Promise<{ success: boolean; error?: string }>;
          getUserDataPath: () => Promise<string>;
          selectRenpy: () => Promise<string | null>;
          runGame: (renpyPath: string, projectPath: string, warpTarget?: string) => void;
          stopGame: () => void;
          checkRenpyPath: (path: string) => Promise<boolean>;
          generateTranslations: (sdkDir: string, projectPath: string, language: string) => Promise<{ success: boolean; output: string; error?: string }>;
          onGameStarted: (callback: () => void) => () => void;
          onGameStopped: (callback: () => void) => () => void;
          onGameError: (callback: (error: string) => void) => () => void;
          onGameCrashLog: (callback: (tracebackText: string) => void) => () => void;
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
          }) => Promise<ProjectSearchOutcome>;
          cancelSearch?: () => void;
          onSearchProgress?: (callback: (count: number) => void) => () => void;
          showSaveDialog: (options: {
              title?: string;
              defaultPath?: string;
              buttonLabel?: string;
              filters?: { name: string; extensions: string[] }[];
          }) => Promise<string | null>;
          /**
           * Snippet pack import/export. Deliberately bypass the project-root guard on
           * fs:readFile/fs:writeFile: the user-global path is fixed and computed in the
           * main process (never renderer-supplied), and the export/import paths are
           * chosen by the user via a native dialog opened by the main process itself,
           * not passed in from the renderer.
           */
          readUserGlobalSnippets?: () => Promise<string | null>;
          writeUserGlobalSnippets?: (content: string) => Promise<{ success: boolean; error?: string }>;
          exportSnippetPack?: (suggestedFileName: string, content: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
          importSnippetPack?: () => Promise<{ success: boolean; filePath?: string; content?: string; canceled?: boolean; error?: string }>;
          onUpdateAvailable?: (callback: (version: string) => void) => () => void;
          onUpdateNotAvailable?: (callback: () => void) => () => void;
          onUpdateError?: (callback: () => void) => () => void;
          onUpdateDownloaded?: (callback: (version: string) => void) => () => void;
          installUpdate?: () => void;
          openExternal?: (url: string) => Promise<void>;
          showItemInFolder?: (filePath: string) => Promise<void>;
          updateExplorerMenuState?: (state: { canNewFile?: boolean; canNewFolder?: boolean; canRename?: boolean; canDelete?: boolean; canRefresh?: boolean; hasScreenshots?: boolean; canNewUntitledFile?: boolean }) => void;
          captureScreenshot?: () => Promise<{ success: boolean; filename?: string; filepath?: string; error?: string }>;
          getScreenshotCount?: () => Promise<number>;
          openScreenshotsFolder?: () => Promise<{ success: boolean; error?: string }>;
          clearScreenshots?: () => Promise<{ success: boolean; count: number; error?: string }>;
          getLatestScreenshotPath?: () => Promise<string | null>;
          onScreenshotCaptured?: (callback: (data: { filename: string; filepath: string }) => void) => () => void;
          onFileChangedExternally?: (callback: (data: { relativePath: string; absolutePath: string }) => void) => () => void;
          onWatcherError?: (callback: (data: { message: string }) => void) => () => void;
          onSettingsWarning?: (callback: (data: { code: string; message: string }) => void) => () => void;
          log?: (level: 'error' | 'warn' | 'info' | 'debug', ...args: unknown[]) => void;
          getLogPath?: () => Promise<string | null>;
          openLogDirectory?: () => Promise<{ success: boolean; error?: string }>;
          addToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
          // --- Detachable tab windows ---
          popoutTab?: (tabId: string, tabType: string) => Promise<void>;
          focusMainWindow?: () => void;
          closePopoutSelf?: () => void;
          onTabRedocked?: (callback: (data: { tabId: string }) => void) => () => void;
          callPopoutHandler?: (tabId: string, handlerName: string, args: unknown[]) => Promise<unknown>;
          onPopoutInvokeHandler?: (callback: (payload: { requestId: number; tabId: string; handlerName: string; args: unknown[] }) => void) => () => void;
          replyPopoutHandlerResult?: (requestId: number, result?: unknown, error?: string) => void;
          sendPopoutStateUpdate?: (tabId: string, snapshot: unknown) => void;
          onPopoutPropsUpdate?: (callback: (snapshot: unknown) => void) => () => void;
          requestPopoutSnapshot?: (tabId: string) => void;
          onPopoutSnapshotRequested?: (callback: (data: { tabId: string }) => void) => () => void;
          onPopoutFlushRequested?: (callback: () => void) => () => void;
          acknowledgePopoutFlush?: () => void;
          flushAllPopouts?: () => Promise<void>;
          closeAllPopouts?: () => Promise<void>;
          closePopoutForTab?: (tabId: string) => Promise<void>;
      }
  }
}
