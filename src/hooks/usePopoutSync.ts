/**
 * @file usePopoutSync.ts
 * @description Relay layer for detachable ("popped-out") tabs.
 *
 * The main window stays the sole owner of app state (blocks, analysisResult, etc.) --
 * a popped-out tab window is a thin remote view. `useMainWindowPopoutSync` (run in
 * the main window) serializes just the slice of state a popped-out tab needs into a
 * `PopoutSnapshot` and pushes it over IPC whenever that state changes, and answers
 * RPC calls the popout makes back into the *real* handlers (updateBlock,
 * handleSaveBlock, ...) so there is only ever one writer. `usePopoutTabClient` (run
 * in the popout window) is the other end: it holds the latest snapshot and exposes
 * `callHandler` to invoke a named handler in the main window.
 *
 * Supported tab types: all 16 -- `canvas`, `editor`, `untitled`, `markdown`, `image`,
 * `audio`, `character`, `diagnostics`/`punchlist`, `translations`, `stats`,
 * `screen-preview`, `route-canvas`, `choice-canvas`, `notecard-canvas`, `scene-composer`,
 * `imagemap-composer`. (`canvas`, the Project Canvas, was excluded through an earlier
 * pass over an incorrect assumption that it's a permanently pinned/required view --
 * it isn't: `TabContextMenu`'s `isProtectedTab` only disables its Close *menu item* and
 * hides Split options, not the tab strip's own close button or Ctrl+W, so it's exactly
 * as closeable/poppable as any other canvas today.)
 *
 * A note on continuous (per-pointermove) updates, since several of the later tab types
 * have them as their *primary* interaction rather than a secondary one: this was
 * stress-tested directly (60 rapid RPC calls in under a second, all completing cleanly)
 * and isn't the relay's limiting factor. The real hazard is a component computing its
 * next value as a *delta relative to the previous prop value* (`s.x + dx`) rather than
 * from a fixed anchor captured at drag-start (`dragStartX + totalDx`) -- the former
 * silently drifts/resets under IPC lag because each RPC call's "previous value" is
 * whatever snapshot last arrived, not necessarily what the popout just sent. Route/
 * Choice's sticky notes, ImageMapComposer's hotspot drag, and NotecardCanvas's card
 * drag/resize all use the fixed-anchor form (confirmed by reading each drag handler) and
 * relay directly. SceneComposer's sprite drag is the one exception (see the comment on
 * `usePopoutSceneComposerState` below for how that's handled.)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import type {
  AppSettings, AudioMetadata, Block, BlockGroup, Character, DialogueLine, DiagnosticsResult,
  DiagnosticsTask, EditorTab, IdentifiedRoute, IgnoredDiagnosticRule, ImageMapComposition,
  ImageMetadata, JumpLocation, LabelNode, MenuTemplate, MouseGestureSettings, Notecard,
  NotecardLink, NotecardTimelineSettings, PersistedProjectSettings, Position, ProjectImage,
  RenpyAnalysisResult, RenpyAudio, RenpyScreen, RouteLink, SceneComposition, StickyNote,
  StoryCanvasGroupingMode, StoryCanvasLayoutMode, Theme, TranslationAnalysisResult,
  UserSnippet,
} from '@/types';
import type { UntitledFileState } from '@/hooks/useUntitledFiles';
import type { PerformanceSnapshot } from '@/hooks/usePerformanceMetrics';
import type { CanvasFilters } from '@/hooks/useCanvasInteraction';
import type { BlockType } from '@/components/CreateBlockModal';

/** Tab types that can currently be popped out into their own window. */
export const POPOUT_SUPPORTED_TAB_TYPES: ReadonlySet<string> = new Set<EditorTab['type']>([
  'canvas', 'editor', 'untitled', 'markdown', 'image', 'audio',
  'character', 'diagnostics', 'punchlist', 'translations', 'stats', 'screen-preview',
  'route-canvas', 'choice-canvas', 'notecard-canvas', 'scene-composer', 'imagemap-composer',
]);

/** A block stripped of its (potentially large) script text, for views that only ever
 *  cross-reference blocks by id/path/title -- see the Phase 2 research notes in the
 *  plan for which components this applies to. */
export interface LightBlock {
  id: string;
  filePath?: string;
  title?: string;
}

function toLightBlocks(blocks: Block[]): LightBlock[] {
  return blocks.map(b => ({ id: b.id, filePath: b.filePath, title: b.title }));
}

/** The leaf components that only need id/filePath/title still declare their `blocks`
 *  prop as `Block[]` (they're shared with the in-process render path) -- pad the
 *  canvas-only fields with harmless placeholders rather than relaying them (and
 *  definitely rather than casting past the type system). */
export function fromLightBlocks(blocks: LightBlock[]): Block[] {
  return blocks.map(b => ({ ...b, content: '', position: { x: 0, y: 0 }, width: 0, height: 0 }));
}

interface RouteAnalysisResultLike {
  labelNodes: LabelNode[];
  routeLinks: RouteLink[];
  identifiedRoutes: IdentifiedRoute[];
  routesTruncated: boolean;
}

interface BaseSnapshot {
  tabId: string;
  /** Full app theme, for chrome around the leaf view (see applyTheme in App.tsx). */
  theme: Theme;
}

export interface EditorPopoutSnapshot extends BaseSnapshot {
  kind: 'editor';
  blockId: string;
  block: Block;
  editorTheme: 'light' | 'dark';
  editorFontFamily: string;
  editorFontSize: number;
  draftingMode: boolean;
  existingImageTags: string[];
  existingAudioPaths: string[];
  userSnippets: UserSnippet[];
  menuTemplates: MenuTemplate[];
  jumps: JumpLocation[];
  invalidJumps: string[];
  labelNames: string[];
  variableNames: string[];
}

export interface UntitledPopoutSnapshot extends BaseSnapshot {
  kind: 'untitled';
  content: string;
  title?: string;
  editorTheme: 'light' | 'dark';
  editorFontFamily: string;
  editorFontSize: number;
  draftingMode: boolean;
  existingImageTags: string[];
  existingAudioPaths: string[];
  userSnippets: UserSnippet[];
  menuTemplates: MenuTemplate[];
  labelNames: string[];
  variableNames: string[];
}

export interface MarkdownPopoutSnapshot extends BaseSnapshot {
  kind: 'markdown';
  filePath: string;
  projectRootPath: string;
  editorTheme: 'light' | 'dark';
}

export interface ImagePopoutSnapshot extends BaseSnapshot {
  kind: 'image';
  image: ProjectImage;
  allImages: ProjectImage[];
  metadata?: ImageMetadata;
}

export interface AudioPopoutSnapshot extends BaseSnapshot {
  kind: 'audio';
  audio: RenpyAudio;
  metadata?: AudioMetadata;
}

export interface CharacterPopoutSnapshot extends BaseSnapshot {
  kind: 'character';
  characterTag: string;
  character?: Character;
  initialTag?: string;
  initialName?: string;
  existingTags: string[];
  projectImages: ProjectImage[];
  imageMetadata: Map<string, ImageMetadata>;
  blocks: LightBlock[];
  dialogueLines: Map<string, DialogueLine[]>;
  labelNodes: LabelNode[];
}

export interface DiagnosticsPopoutSnapshot extends BaseSnapshot {
  kind: 'diagnostics';
  diagnostics: DiagnosticsResult;
  blocks: LightBlock[];
  stickyNotes: StickyNote[];
  tasks: DiagnosticsTask[];
  ignoredDiagnostics: IgnoredDiagnosticRule[];
}

export interface TranslationsPopoutSnapshot extends BaseSnapshot {
  kind: 'translations';
  translationData: TranslationAnalysisResult;
  blocks: LightBlock[];
  isGenerating: boolean;
  isRenpyPathValid: boolean;
}

/** `stats` and `screen-preview` genuinely need the full corpus (word counts, define/style
 *  scans, and the active-screen extraction all read every block's raw script text) --
 *  Electron IPC's structured-clone supports Map/Set natively, so these relay `blocks`/
 *  `analysisResult` largely as-is rather than hand-picking fields like the others do. */
export interface StatsPopoutSnapshot extends BaseSnapshot {
  kind: 'stats';
  blocks: Block[];
  analysisResult: RenpyAnalysisResult;
  routeAnalysisResult: RouteAnalysisResultLike;
  images: Map<string, ProjectImage>;
  imageMetadata: Map<string, ImageMetadata>;
  audios: Map<string, RenpyAudio>;
  diagnosticsErrorCount: number;
  performanceMetrics: PerformanceSnapshot;
}

export interface ScreenPreviewPopoutSnapshot extends BaseSnapshot {
  kind: 'screen-preview';
  blocks: Block[];
  screens: Map<string, RenpyScreen>;
  cursorBlockId: string | null;
  cursorLine: number | null;
  images: Map<string, ProjectImage>;
}

/** Pan/zoom (`transform`) is deliberately NOT part of this snapshot -- it's already
 *  ephemeral, non-persisted `useState` in the main window (resets to {0,0,1} on
 *  reload), so a popout owning its own local transform doesn't violate any shared
 *  truth. Likewise `centerOnStartRequest`/`centerOnNodeRequest` (external "scroll to X"
 *  triggers, e.g. from Go-to-Label) aren't relayed -- there's no such trigger UI in a
 *  popout yet. */
export interface RouteCanvasPopoutSnapshot extends BaseSnapshot {
  kind: 'route-canvas';
  labelNodes: LabelNode[];
  routeLinks: RouteLink[];
  identifiedRoutes: IdentifiedRoute[];
  routesTruncated?: boolean;
  stickyNotes: StickyNote[];
  images: Map<string, ProjectImage>;
  mouseGestures?: MouseGestureSettings;
  layoutMode: StoryCanvasLayoutMode;
  groupingMode: StoryCanvasGroupingMode;
}

export interface ChoiceCanvasPopoutSnapshot extends BaseSnapshot {
  kind: 'choice-canvas';
  labelNodes: LabelNode[];
  routeLinks: RouteLink[];
  blocks: { id: string; content: string }[];
  analysisResult: RenpyAnalysisResult;
  stickyNotes: StickyNote[];
  mouseGestures?: MouseGestureSettings;
}

/** Self-contained data, no `blocks`/`analysisResult` dependency at all -- both drag
 *  (fixed-anchor + total delta, App.tsx never reads back its own transform mid-drag)
 *  and resize use the same safe pattern as Route/Choice's sticky notes. */
export interface NotecardCanvasPopoutSnapshot extends BaseSnapshot {
  kind: 'notecard-canvas';
  notecards: Notecard[];
  notecardLinks: NotecardLink[];
  timelineSettings: NotecardTimelineSettings;
}

export interface SceneComposerPopoutSnapshot extends BaseSnapshot {
  kind: 'scene-composer';
  sceneId: string;
  scene: SceneComposition;
  sceneName: string;
  images: ProjectImage[];
  imageMetadata: Map<string, ImageMetadata>;
}

export interface ImageMapComposerPopoutSnapshot extends BaseSnapshot {
  kind: 'imagemap-composer';
  imagemapId: string;
  imagemap: ImageMapComposition;
  images: ProjectImage[];
  labels: string[];
}

/** Block/group dragging is batched to release (confirmed by reading StoryCanvas's
 *  pointer-up handler); resize computes from a fixed anchor (`block.width` captured at
 *  drag-start) plus total delta since drag-start, the same safe pattern as everywhere
 *  else -- so this relays directly like Route/Choice, no local-optimistic-state needed.
 *  Selection (`selectedBlockIds`/`selectedGroupIds`) and find-usages/center/flash
 *  requests are treated as per-window UI state, not relayed, same reasoning as pan/zoom. */
export interface StoryCanvasPopoutSnapshot extends BaseSnapshot {
  kind: 'canvas';
  blocks: Block[];
  groups: BlockGroup[];
  stickyNotes: StickyNote[];
  analysisResult: RenpyAnalysisResult;
  canvasFilters: CanvasFilters;
  mouseGestures?: MouseGestureSettings;
  layoutMode: StoryCanvasLayoutMode;
  groupingMode: StoryCanvasGroupingMode;
  diagnosticsResult?: DiagnosticsResult;
  fileSizeThresholds?: AppSettings['fileSizeThresholds'];
  /** StoryCanvas reads `dirtyBlockIds` from `useDualPane()` for the unsaved-dot
   *  indicator -- the only field of that ~90-field context it actually touches.
   *  PopoutTabRoot wraps it in a minimal DualPaneContext.Provider with just this. */
  dirtyBlockIds: Set<string>;
}

export type PopoutSnapshot =
  | EditorPopoutSnapshot
  | UntitledPopoutSnapshot
  | MarkdownPopoutSnapshot
  | ImagePopoutSnapshot
  | AudioPopoutSnapshot
  | CharacterPopoutSnapshot
  | DiagnosticsPopoutSnapshot
  | TranslationsPopoutSnapshot
  | StatsPopoutSnapshot
  | ScreenPreviewPopoutSnapshot
  | RouteCanvasPopoutSnapshot
  | ChoiceCanvasPopoutSnapshot
  | NotecardCanvasPopoutSnapshot
  | SceneComposerPopoutSnapshot
  | ImageMapComposerPopoutSnapshot
  | StoryCanvasPopoutSnapshot;

export interface PopoutHandlers {
  updateBlock: (id: string, data: Partial<Block>) => void;
  handleSaveBlock: (blockId: string, liveContent?: string) => Promise<void>;
  handleSaveAll: () => Promise<boolean>;
  setBlockContent: (id: string, content: string) => void;
  setEditorDirty: (id: string, dirty: boolean) => void;
  handleWarpToLabel: (labelName: string) => void;
  handleCreateFileFromSelection: (blockId: string, selectedText: string) => void | Promise<void>;
  handleCreateVariableFromSelection: (selectedText: string) => void;
  handleCreateCharacterFromSelection: (selectedText: string) => void;
  handleSaveMenuTemplate: (template: MenuTemplate) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  handleOpenEditor: (blockId: string, line?: number) => void;
  updateUntitledContent: (tabId: string, content: string) => void;
  setUntitledDirty: (tabId: string, isDirty: boolean) => void;
  saveUntitledFile: (tabId: string, liveContent?: string) => Promise<boolean>;
  handleSaveImageMetadata: (currentFilePath: string, newMeta: ImageMetadata) => Promise<void>;
  handleCopyImageToProject: (sourcePath: string, meta: ImageMetadata) => void | Promise<void>;
  handleImportPortraitImage: (sourcePath: string) => Promise<ProjectImage | null>;
  handleSaveAudioMetadata: (currentFilePath: string, newMeta: AudioMetadata) => Promise<void>;
  handleCopyAudioToProject: (sourcePath: string, meta: AudioMetadata) => void | Promise<void>;
  handleUpdateCharacter: (char: Character, oldTag?: string) => void | Promise<void>;
  handleUpdateDiagnosticsTasks: (tasks: DiagnosticsTask[]) => void;
  handleUpdateIgnoredDiagnostics: (rules: IgnoredDiagnosticRule[]) => void;
  handleCenterOnBlock: (target: string) => void;
  handleGenerateTranslations: (language: string) => Promise<void>;
  handleOpenStaticTab: (type: 'canvas' | 'route-canvas' | 'choice-canvas' | 'notecard-canvas' | 'diagnostics' | 'stats' | 'translations' | 'screen-preview') => void;
  handleUpdateRouteNodePositions: (updates: { id: string; position: Position }[]) => void;
  addRouteStickyNote: (position: Position) => void;
  updateRouteStickyNote: (id: string, data: Partial<StickyNote>) => void;
  deleteRouteStickyNote: (id: string) => void;
  handleChangeRouteCanvasLayoutMode: (mode: StoryCanvasLayoutMode) => void;
  handleChangeRouteCanvasGroupingMode: (mode: StoryCanvasGroupingMode) => void;
  addChoiceStickyNote: (position: Position) => void;
  updateChoiceStickyNote: (id: string, data: Partial<StickyNote>) => void;
  deleteChoiceStickyNote: (id: string) => void;
  addNotecard: (position?: Position) => void;
  updateNotecard: (id: string, data: Partial<Notecard>) => void;
  deleteNotecard: (id: string) => void;
  deleteNotecards: (ids: string[]) => void;
  restoreNotecards: (cards: Notecard[], links: NotecardLink[]) => void;
  addNotecardLink: (fromId: string, toId: string) => void;
  updateNotecardLink: (id: string, data: Partial<NotecardLink>) => void;
  deleteNotecardLink: (id: string) => void;
  renameNotecardTimelineSlot: (slot: number, label: string) => void;
  moveNotecardWithinTimeline: (id: string, toSlot: number, toIndex: number) => void;
  unassignNotecardFromTimeline: (id: string, position?: Position) => void;
  insertTimelineSlot: (beforeSlot: number) => void;
  deleteTimelineSlot: (slot: number) => void;
  handleSceneUpdate: (sceneId: string, scene: SceneComposition) => void;
  handleRenameScene: (sceneId: string, newName: string) => void;
  handleImageMapUpdate: (imagemapId: string, imagemap: ImageMapComposition) => void;
  handleRenameImageMap: (imagemapId: string, newName: string) => void;
  updateGroup: (id: string, data: Partial<BlockGroup>) => void;
  updateBlockPositions: (updates: { id: string; position: Position }[]) => void;
  updateGroupPositions: (updates: { id: string; position: Position }[]) => void;
  deleteBlockWithFile: (id: string) => Promise<void>;
  deleteBlocksWithFile: (ids: string[]) => Promise<void>;
  createGroupFromSelection: (blockIds: string[]) => string | null;
  deleteGroup: (id: string) => void;
  addStickyNote: (position?: Position) => void;
  updateStickyNote: (id: string, data: Partial<StickyNote>) => void;
  deleteStickyNote: (id: string) => void;
  handleCreateBlockFromCanvas: (type: BlockType, position: Position) => void;
  handleChangeStoryCanvasLayoutMode: (mode: StoryCanvasLayoutMode) => void;
  handleChangeStoryCanvasGroupingMode: (mode: StoryCanvasGroupingMode) => void;
  handleOpenRouteCanvasTab: () => void;
  setCanvasFilters: (filters: CanvasFilters) => void;
}

export interface PopoutSnapshotDeps {
  blocks: Block[];
  analysisResult: RenpyAnalysisResult;
  appSettings: AppSettings;
  projectSettings: PersistedProjectSettings;
  existingImageTags: Set<string>;
  existingAudioPaths: Set<string>;
  images: Map<string, ProjectImage>;
  imageMetadata: Map<string, ImageMetadata>;
  audios: Map<string, RenpyAudio>;
  audioMetadata: Map<string, AudioMetadata>;
  untitledFiles: Map<string, UntitledFileState>;
  projectRootPath: string | null;
  charactersByTag: Map<string, Character>;
  characterTagsArray: string[];
  allStickyNotes: StickyNote[];
  diagnosticsTasks: DiagnosticsTask[];
  ignoredDiagnostics: IgnoredDiagnosticRule[];
  diagnosticsResult: DiagnosticsResult;
  routeAnalysisResult: RouteAnalysisResultLike;
  performanceMetrics: PerformanceSnapshot;
  isGeneratingTranslations: boolean;
  isRenpyPathValid: boolean;
  editorCursorBlockId: string | null;
  editorCursorPosition: { line: number; column: number } | null;
  routeStickyNotes: StickyNote[];
  choiceStickyNotes: StickyNote[];
  notecards: Notecard[];
  notecardLinks: NotecardLink[];
  notecardTimeline: NotecardTimelineSettings;
  sceneCompositions: Record<string, SceneComposition>;
  sceneNames: Record<string, string>;
  imagemapCompositions: Record<string, ImageMapComposition>;
  analysisLabelKeys: string[];
  groups: BlockGroup[];
  stickyNotes: StickyNote[];
  canvasFilters: CanvasFilters;
  dirtyBlockIds: Set<string>;
}

function buildPopoutSnapshot(tab: EditorTab, deps: PopoutSnapshotDeps): PopoutSnapshot | null {
  const {
    blocks, analysisResult, appSettings, projectSettings, existingImageTags, existingAudioPaths,
    images, imageMetadata, audios, audioMetadata, untitledFiles, projectRootPath,
    charactersByTag, characterTagsArray, allStickyNotes, diagnosticsTasks, ignoredDiagnostics,
    diagnosticsResult, routeAnalysisResult, performanceMetrics, isGeneratingTranslations,
    isRenpyPathValid, editorCursorBlockId, editorCursorPosition,
    routeStickyNotes, choiceStickyNotes,
    notecards, notecardLinks, notecardTimeline, sceneCompositions, sceneNames,
    imagemapCompositions, analysisLabelKeys, groups, stickyNotes, canvasFilters,
    dirtyBlockIds,
  } = deps;
  const editorTheme: 'light' | 'dark' = appSettings.theme.includes('dark') ? 'dark' : 'light';

  if (tab.type === 'editor' && tab.blockId) {
    const block = blocks.find(b => b.id === tab.blockId);
    if (!block) return null;
    return {
      kind: 'editor', tabId: tab.id, theme: appSettings.theme,
      blockId: tab.blockId, block, editorTheme,
      editorFontFamily: appSettings.editorFontFamily,
      editorFontSize: appSettings.editorFontSize,
      draftingMode: projectSettings.draftingMode,
      existingImageTags: Array.from(existingImageTags),
      existingAudioPaths: Array.from(existingAudioPaths),
      userSnippets: appSettings.userSnippets ?? [],
      menuTemplates: appSettings.menuTemplates ?? [],
      jumps: analysisResult.jumps[tab.blockId] ?? [],
      invalidJumps: analysisResult.invalidJumps[tab.blockId] ?? [],
      labelNames: Object.keys(analysisResult.labels),
      variableNames: Array.from(analysisResult.variables.keys()),
    };
  }

  if (tab.type === 'untitled') {
    const draft = untitledFiles.get(tab.id);
    if (!draft) return null;
    return {
      kind: 'untitled', tabId: tab.id, theme: appSettings.theme,
      content: draft.content, title: draft.title, editorTheme,
      editorFontFamily: appSettings.editorFontFamily,
      editorFontSize: appSettings.editorFontSize,
      draftingMode: projectSettings.draftingMode,
      existingImageTags: Array.from(existingImageTags),
      existingAudioPaths: Array.from(existingAudioPaths),
      userSnippets: appSettings.userSnippets ?? [],
      menuTemplates: appSettings.menuTemplates ?? [],
      labelNames: Object.keys(analysisResult.labels),
      variableNames: Array.from(analysisResult.variables.keys()),
    };
  }

  if (tab.type === 'markdown' && tab.filePath && projectRootPath) {
    return { kind: 'markdown', tabId: tab.id, theme: appSettings.theme, filePath: tab.filePath, projectRootPath, editorTheme };
  }

  if (tab.type === 'image' && tab.filePath) {
    const image = images.get(tab.filePath);
    if (!image) return null;
    return {
      kind: 'image', tabId: tab.id, theme: appSettings.theme,
      image, allImages: Array.from(images.values()),
      metadata: imageMetadata.get(image.projectFilePath || image.filePath),
    };
  }

  if (tab.type === 'audio' && tab.filePath) {
    const audio = audios.get(tab.filePath);
    if (!audio) return null;
    return {
      kind: 'audio', tabId: tab.id, theme: appSettings.theme,
      audio, metadata: audioMetadata.get(audio.projectFilePath || audio.filePath),
    };
  }

  if (tab.type === 'character' && tab.characterTag) {
    return {
      kind: 'character', tabId: tab.id, theme: appSettings.theme,
      characterTag: tab.characterTag,
      character: charactersByTag.get(tab.characterTag),
      initialTag: tab.initialCharacterTag,
      initialName: tab.initialCharacterName,
      existingTags: characterTagsArray,
      projectImages: Array.from(images.values()),
      imageMetadata,
      blocks: toLightBlocks(blocks),
      dialogueLines: analysisResult.dialogueLines,
      labelNodes: analysisResult.labelNodes,
    };
  }

  if (tab.type === 'diagnostics' || tab.type === 'punchlist') {
    return {
      kind: 'diagnostics', tabId: tab.id, theme: appSettings.theme,
      diagnostics: diagnosticsResult,
      blocks: toLightBlocks(blocks),
      stickyNotes: allStickyNotes,
      tasks: diagnosticsTasks,
      ignoredDiagnostics,
    };
  }

  if (tab.type === 'translations') {
    return {
      kind: 'translations', tabId: tab.id, theme: appSettings.theme,
      translationData: analysisResult.translationData,
      blocks: toLightBlocks(blocks),
      isGenerating: isGeneratingTranslations,
      isRenpyPathValid,
    };
  }

  if (tab.type === 'stats') {
    return {
      kind: 'stats', tabId: tab.id, theme: appSettings.theme,
      blocks, analysisResult, routeAnalysisResult,
      images, imageMetadata, audios,
      diagnosticsErrorCount: diagnosticsResult.errorCount,
      performanceMetrics,
    };
  }

  if (tab.type === 'screen-preview') {
    return {
      kind: 'screen-preview', tabId: tab.id, theme: appSettings.theme,
      blocks, screens: analysisResult.screens,
      cursorBlockId: editorCursorBlockId,
      cursorLine: editorCursorPosition?.line ?? null,
      images,
    };
  }

  if (tab.type === 'route-canvas') {
    return {
      kind: 'route-canvas', tabId: tab.id, theme: appSettings.theme,
      labelNodes: routeAnalysisResult.labelNodes,
      routeLinks: routeAnalysisResult.routeLinks,
      identifiedRoutes: routeAnalysisResult.identifiedRoutes,
      routesTruncated: routeAnalysisResult.routesTruncated,
      stickyNotes: routeStickyNotes,
      images,
      mouseGestures: appSettings.mouseGestures,
      layoutMode: projectSettings.routeCanvasLayoutMode ?? 'flow-lr',
      groupingMode: projectSettings.routeCanvasGroupingMode ?? 'none',
    };
  }

  if (tab.type === 'choice-canvas') {
    return {
      kind: 'choice-canvas', tabId: tab.id, theme: appSettings.theme,
      labelNodes: routeAnalysisResult.labelNodes,
      routeLinks: routeAnalysisResult.routeLinks,
      blocks: blocks.map(b => ({ id: b.id, content: b.content })),
      analysisResult,
      stickyNotes: choiceStickyNotes,
      mouseGestures: appSettings.mouseGestures,
    };
  }

  if (tab.type === 'notecard-canvas') {
    return {
      kind: 'notecard-canvas', tabId: tab.id, theme: appSettings.theme,
      notecards, notecardLinks, timelineSettings: notecardTimeline,
    };
  }

  if (tab.type === 'scene-composer' && tab.sceneId) {
    const scene = sceneCompositions[tab.sceneId] || { background: null, sprites: [] };
    return {
      kind: 'scene-composer', tabId: tab.id, theme: appSettings.theme,
      sceneId: tab.sceneId, scene,
      sceneName: sceneNames[tab.sceneId] || 'Scene',
      images: Array.from(images.values()),
      imageMetadata,
    };
  }

  if (tab.type === 'imagemap-composer' && tab.imagemapId) {
    const imagemap = imagemapCompositions[tab.imagemapId] || { screenName: 'imagemap', groundImage: null, hoverImage: null, hotspots: [] };
    return {
      kind: 'imagemap-composer', tabId: tab.id, theme: appSettings.theme,
      imagemapId: tab.imagemapId, imagemap,
      images: Array.from(images.values()),
      labels: analysisLabelKeys,
    };
  }

  if (tab.type === 'canvas') {
    return {
      kind: 'canvas', tabId: tab.id, theme: appSettings.theme,
      blocks, groups, stickyNotes, analysisResult,
      canvasFilters,
      mouseGestures: appSettings.mouseGestures,
      layoutMode: projectSettings.storyCanvasLayoutMode ?? 'flow-lr',
      groupingMode: projectSettings.storyCanvasGroupingMode ?? 'none',
      diagnosticsResult,
      fileSizeThresholds: appSettings.fileSizeThresholds,
      dirtyBlockIds,
    };
  }

  return null;
}

export interface UseMainWindowPopoutSyncParams extends PopoutSnapshotDeps {
  poppedOutTabs: Map<string, EditorTab>;
  onRedock: (tabId: string) => void;
  handlers: PopoutHandlers;
}

/** Run once in the main window. Owns no state itself -- just relays. */
export function useMainWindowPopoutSync({
  poppedOutTabs, onRedock, handlers, ...deps
}: UseMainWindowPopoutSyncParams): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // A brand-new popout window's `onPopoutPropsUpdate` listener (and even the main
  // process's window registry entry) may not be ready yet at the instant this hook's
  // state-push effect below first fires -- window:popout-tab is an async IPC call the
  // caller doesn't await. Keeping the latest inputs in a ref lets the popout pull its
  // own snapshot on mount (see usePopoutTabClient's requestPopoutSnapshot call) without
  // waiting for some *other* state change to trigger the next push.
  const depsRef = useRef({ poppedOutTabs, ...deps });
  depsRef.current = { poppedOutTabs, ...deps };

  const pushSnapshotForTab = useCallback((tabId: string) => {
    const api = window.electronAPI;
    if (!api?.sendPopoutStateUpdate) return;
    const d = depsRef.current;
    const tab = d.poppedOutTabs.get(tabId);
    if (!tab) return;
    const snapshot = buildPopoutSnapshot(tab, d);
    if (snapshot) api.sendPopoutStateUpdate(tabId, snapshot);
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onPopoutInvokeHandler) return;
    return api.onPopoutInvokeHandler(async ({ requestId, handlerName, args }) => {
      try {
        const fn = handlersRef.current[handlerName as keyof PopoutHandlers] as ((...a: unknown[]) => unknown) | undefined;
        if (!fn) throw new Error(`Unknown popout handler: ${handlerName}`);
        const result = await fn(...args);
        api.replyPopoutHandlerResult?.(requestId, result);
      } catch (err) {
        api.replyPopoutHandlerResult?.(requestId, undefined, err instanceof Error ? err.message : String(err));
      }
    });
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onTabRedocked) return;
    return api.onTabRedocked(({ tabId }) => onRedock(tabId));
  }, [onRedock]);

  // A popout pulls its own snapshot right after mounting (it can't rely solely on the
  // push below, which may fire before its listener -- or even the window itself -- exists).
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onPopoutSnapshotRequested) return;
    return api.onPopoutSnapshotRequested(({ tabId }) => pushSnapshotForTab(tabId));
  }, [pushSnapshotForTab]);

  useEffect(() => {
    if (poppedOutTabs.size === 0) return;
    for (const tabId of poppedOutTabs.keys()) pushSnapshotForTab(tabId);
    // deps are spread from `deps` -- list each field so the effect re-fires on the
    // slice of state it actually reads, same as before this was generalized.
  }, [
    poppedOutTabs, deps.blocks, deps.analysisResult, deps.appSettings, deps.projectSettings,
    deps.existingImageTags, deps.existingAudioPaths, deps.images, deps.imageMetadata, deps.audios,
    deps.audioMetadata, deps.untitledFiles, deps.projectRootPath, deps.charactersByTag,
    deps.characterTagsArray, deps.allStickyNotes, deps.diagnosticsTasks, deps.ignoredDiagnostics,
    deps.diagnosticsResult, deps.routeAnalysisResult, deps.performanceMetrics,
    deps.isGeneratingTranslations, deps.isRenpyPathValid, deps.editorCursorBlockId,
    deps.editorCursorPosition, deps.routeStickyNotes, deps.choiceStickyNotes,
    deps.notecards, deps.notecardLinks, deps.notecardTimeline, deps.sceneCompositions,
    deps.sceneNames, deps.imagemapCompositions, deps.analysisLabelKeys,
    deps.groups, deps.stickyNotes, deps.canvasFilters, deps.dirtyBlockIds, pushSnapshotForTab,
  ]);
}

export interface UsePopoutTabClientReturn {
  snapshot: PopoutSnapshot | null;
  callHandler: <T = unknown>(handlerName: keyof PopoutHandlers, ...args: unknown[]) => Promise<T>;
}

/** Run in the popped-out window's own React tree. */
export function usePopoutTabClient(tabId: string): UsePopoutTabClientReturn {
  const [snapshot, setSnapshot] = useState<PopoutSnapshot | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onPopoutPropsUpdate) return;
    const unsubscribe = api.onPopoutPropsUpdate((data) => setSnapshot(data as PopoutSnapshot));
    // Pull an initial snapshot rather than waiting for the main window's next
    // unrelated state change to trigger a push -- see the comment in
    // useMainWindowPopoutSync above.
    api.requestPopoutSnapshot?.(tabId);
    return unsubscribe;
  }, [tabId]);

  const callHandler = useCallback(<T = unknown>(handlerName: keyof PopoutHandlers, ...args: unknown[]): Promise<T> => {
    const api = window.electronAPI;
    if (!api?.callPopoutHandler) return Promise.reject(new Error('electronAPI.callPopoutHandler unavailable'));
    const promise = api.callPopoutHandler(tabId, handlerName, args) as Promise<T>;
    // PopoutTabRoot.tsx fires the vast majority of these as `void callHandler(...)`
    // with no further .catch -- without this, any relayed handler failure (a file
    // write erroring, an unregistered handler name, the main window being
    // unavailable) becomes a silent unhandled promise rejection with zero user-
    // facing feedback, unlike the same operation's error handling in the main
    // window. Attached as a side branch (not chained onto the returned promise) so
    // a caller that DOES attach its own .then/.catch (e.g. ImageEditorView's
    // onSaveMetadata) still sees the rejection normally.
    promise.catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Popout handler '${handlerName}' failed:`, err);
      if (handlerName !== 'addToast') {
        api.callPopoutHandler?.(tabId, 'addToast', [`Action failed: ${message}`, 'error']).catch(() => {
          // Nothing left to report through if even the toast relay is unavailable.
        });
      }
    });
    return promise;
  }, [tabId]);

  return { snapshot, callHandler };
}
