import { migratePunchlistToTasks } from '@/hooks/useDiagnostics';
import { getStoryLayoutVersion } from '@/lib/storyCanvasLayout';
import { getRouteCanvasLayoutVersion } from '@/lib/routeCanvasLayout';
import { isSerializedSceneComposition, isSerializedImageMapComposition } from '@/lib/typeGuards';
import { logger } from '@/lib/logger';
import type {
  Block, ProjectImage, RenpyAudio, EditorTab, DiagnosticsTask,
  SceneComposition, SceneSprite, ImageMapComposition, Position,
  ProjectLoadResult, ProjectSnapshot, PendingStoryLayoutRefresh, PendingRouteLayoutRefresh,
  SerializedSprite, SerializedSceneComposition,
} from '@/types';

function rehydrateSprite(s: SerializedSprite, imgMap: Map<string, ProjectImage>): SceneSprite {
  const img = imgMap.get(s.image.filePath) ?? {
    filePath: s.image.filePath,
    fileName: s.image.filePath.split(/[/\\]/).pop() ?? 'unknown',
    isInProject: false,
    fileHandle: null,
    dataUrl: '',
  };
  return { ...s, image: img };
}

function deserializeSceneCompositions(
  settings: ProjectLoadResult['settings'],
  imgMap: Map<string, ProjectImage>,
): { sceneCompositions: Record<string, SceneComposition>; sceneNames: Record<string, string> } {
  if (!settings) return { sceneCompositions: {}, sceneNames: {} };

  if (settings.sceneCompositions) {
    const sceneCompositions: Record<string, SceneComposition> = {};
    Object.entries(settings.sceneCompositions).forEach(([id, sc]) => {
      if (isSerializedSceneComposition(sc)) {
        sceneCompositions[id] = {
          background: sc.background ? rehydrateSprite(sc.background, imgMap) : null,
          sprites: sc.sprites.map(s => rehydrateSprite(s, imgMap)),
          resolution: sc.resolution,
          animations: sc.animations,
        };
      } else {
        logger.warn('Skipping malformed scene composition entry', { id, sc });
      }
    });
    return { sceneCompositions, sceneNames: settings.sceneNames ?? {} };
  }

  // Migration: legacy single-scene format
  const legacyScene = (settings as unknown as Record<string, unknown>).sceneComposition;
  if (isSerializedSceneComposition(legacyScene)) {
    const rehydrateOldScene = (sc: SerializedSceneComposition): SceneComposition => ({
      background: sc.background ? rehydrateSprite(sc.background, imgMap) : null,
      sprites: (sc.sprites ?? []).map(s => rehydrateSprite(s, imgMap)),
      resolution: sc.resolution,
    });
    return {
      sceneCompositions: { 'scene-default': rehydrateOldScene(legacyScene) },
      sceneNames: { 'scene-default': 'Default Scene' },
    };
  }

  return { sceneCompositions: {}, sceneNames: {} };
}

function deserializeImagemapCompositions(
  settings: ProjectLoadResult['settings'],
  imgMap: Map<string, ProjectImage>,
): Record<string, ImageMapComposition> {
  if (!settings?.imagemapCompositions) return {};

  const result: Record<string, ImageMapComposition> = {};
  Object.entries(settings.imagemapCompositions).forEach(([id, im]) => {
    if (isSerializedImageMapComposition(im)) {
      result[id] = {
        screenName: im.screenName,
        groundImage: im.groundImage ? (imgMap.get(im.groundImage.filePath) ?? null) : null,
        hoverImage: im.hoverImage ? (imgMap.get(im.hoverImage.filePath) ?? null) : null,
        hotspots: im.hotspots,
      };
    } else {
      logger.warn('Skipping malformed imagemap composition entry', { id, im });
    }
  });
  return result;
}

function deserializeTabs(
  settings: ProjectLoadResult['settings'],
  blockFilePathMap: Map<string, Block>,
  imgMap: Map<string, ProjectImage>,
  audioMap: Map<string, RenpyAudio>,
): {
  primaryTabs: EditorTab[];
  primaryActiveTabId: string;
  secondaryTabs: EditorTab[];
  secondaryActiveTabId: string;
  splitLayout: 'none' | 'right' | 'bottom';
  splitPrimarySize: number;
} {
  if (!settings) {
    return {
      primaryTabs: [{ id: 'canvas', type: 'canvas' }],
      primaryActiveTabId: 'canvas',
      secondaryTabs: [],
      secondaryActiveTabId: '',
      splitLayout: 'none',
      splitPrimarySize: 600,
    };
  }

  const isValidTab = (tab: EditorTab, bfMap: Map<string, Block>, iMap: Map<string, ProjectImage>, aMap: Map<string, RenpyAudio>): boolean => {
    if (tab.type === 'editor' && tab.filePath) return bfMap.has(tab.filePath);
    if (tab.type === 'image' && tab.filePath) return iMap.has(tab.filePath);
    if (tab.type === 'audio' && tab.filePath) return aMap.has(tab.filePath);
    if (tab.type === 'character' && tab.characterTag) return true;
    if (tab.type === 'scene-composer' && tab.sceneId) return true;
    if (tab.type === 'markdown' && tab.filePath) return true;
    return ['canvas', 'route-canvas', 'choice-canvas', 'notecard-canvas', 'punchlist', 'diagnostics', 'stats', 'translations', 'screen-preview'].includes(tab.type);
  };

  const migrateTab = (tab: EditorTab): EditorTab => {
    if (tab.type === 'editor' && tab.filePath) {
      const block = blockFilePathMap.get(tab.filePath);
      if (block) return { ...tab, id: block.id, blockId: block.id };
    }
    if (tab.type === 'punchlist' || tab.id === 'punchlist') {
      return { ...tab, type: 'diagnostics' as const, id: 'diagnostics' };
    }
    if (tab.type === 'scene-composer' && !tab.sceneId) {
      return { ...tab, sceneId: 'scene-default' };
    }
    return tab;
  };

  const savedTabs: EditorTab[] = settings.openTabs ?? [{ id: 'canvas', type: 'canvas' }];
  const primaryTabs = savedTabs
    .filter(t => isValidTab(t, blockFilePathMap, imgMap, audioMap))
    .map(migrateTab);

  const activeTabIsValid = primaryTabs.some(t => t.id === settings.activeTabId);
  const primaryActiveTabId = activeTabIsValid ? settings.activeTabId : 'canvas';

  const savedSecondary: EditorTab[] = settings.secondaryOpenTabs ?? [];
  const secondaryTabs = savedSecondary.filter(t => isValidTab(t, blockFilePathMap, imgMap, audioMap));
  const savedSecondaryActive = settings.secondaryActiveTabId ?? '';
  const secondaryActiveTabId = secondaryTabs.some(t => t.id === savedSecondaryActive)
    ? savedSecondaryActive
    : (secondaryTabs[0]?.id ?? '');

  const splitLayout = secondaryTabs.length > 0 ? (settings.splitLayout ?? 'none') : 'none';
  const splitPrimarySize = settings.splitPrimarySize ?? 600;

  return { primaryTabs, primaryActiveTabId, secondaryTabs, secondaryActiveTabId, splitLayout, splitPrimarySize };
}

/**
 * Pure function: maps a raw `ProjectLoadResult` + the current in-memory blocks
 * into a `ProjectSnapshot` value object.
 *
 * No React state, no IPC calls. Safe to call from unit tests with plain objects.
 * When `snapshot.defaultScriptBlock` is non-null the caller must write that file
 * via IPC before passing the snapshot to `hydrateFromProjectData`.
 */
export function deserializeProjectData(
  data: ProjectLoadResult,
  currentBlocks: Block[],
): ProjectSnapshot {
  const savedStoryBlockLayouts = data.settings?.storyBlockLayouts ?? {};
  const savedRouteNodeLayouts = data.settings?.routeNodeLayouts ?? {};

  const existingBlocksMap = new Map<string, Block>();
  currentBlocks.forEach(b => { if (b.filePath) existingBlocksMap.set(b.filePath, b); });

  const blocks: Block[] = data.files.map((f, index) => {
    const existing = existingBlocksMap.get(f.path);
    const saved = savedStoryBlockLayouts[f.path];
    return {
      id: existing?.id ?? `block-${index}-${Date.now()}`,
      content: f.content,
      filePath: f.path,
      position: saved?.position ?? existing?.position ?? { x: (index % 5) * 350, y: Math.floor(index / 5) * 250 },
      width: saved?.width ?? existing?.width ?? 320,
      height: saved?.height ?? existing?.height ?? 200,
      title: f.path.split('/').pop(),
      color: saved?.color ?? existing?.color ?? undefined,
    };
  });

  let defaultScriptBlock: Block | null = null;
  if (blocks.length === 0) {
    defaultScriptBlock = {
      id: `block-${Date.now()}`,
      content: `label start:\n    "Welcome to your new project!"\n    return\n`,
      filePath: 'script.rpy',
      position: { x: 50, y: 50 },
      width: 320,
      height: 200,
      title: 'script.rpy',
    };
    blocks.push(defaultScriptBlock);
  }

  const blockFilePathMap = new Map(blocks.map(b => [b.filePath, b]));

  const images = new Map<string, ProjectImage>();
  data.images.forEach(img => {
    images.set(img.path, {
      ...img,
      filePath: img.path,
      fileName: img.path.split('/').pop(),
      isInProject: true,
      fileHandle: null,
    });
  });

  const audios = new Map<string, RenpyAudio>();
  data.audios.forEach(aud => {
    audios.set(aud.path, {
      ...aud,
      filePath: aud.path,
      fileName: aud.path.split('/').pop(),
      isInProject: true,
      fileHandle: null,
    });
  });

  const { sceneCompositions, sceneNames } = deserializeSceneCompositions(data.settings, images);
  const imagemapCompositions = deserializeImagemapCompositions(data.settings, images);

  const routeNodeLayoutCache: Map<string, Position> = new Map(
    Object.entries(savedRouteNodeLayouts).map(([id, layout]) => [id, layout.position]),
  );

  const { primaryTabs, primaryActiveTabId, secondaryTabs, secondaryActiveTabId, splitLayout, splitPrimarySize } =
    deserializeTabs(data.settings, blockFilePathMap, images, audios);

  let diagnosticsTasks: DiagnosticsTask[] = [];
  if (data.settings?.diagnosticsTasks) {
    diagnosticsTasks = data.settings.diagnosticsTasks;
  } else if (data.settings?.punchlistMetadata) {
    diagnosticsTasks = migratePunchlistToTasks(data.settings.punchlistMetadata);
  }

  const pendingStoryLayoutRefresh: PendingStoryLayoutRefresh = {
    hasSavedLayouts: Object.keys(savedStoryBlockLayouts).length > 0,
    savedFingerprint: data.settings?.storyCanvasLayoutFingerprint,
    savedVersion: data.settings?.storyCanvasLayoutVersion,
    savedWasUserAdjusted: data.settings?.storyCanvasLayoutWasUserAdjusted ?? false,
  };

  const pendingRouteLayoutRefresh: PendingRouteLayoutRefresh = {
    hasSavedLayouts: Object.keys(savedRouteNodeLayouts).length > 0,
    savedFingerprint: data.settings?.routeCanvasLayoutFingerprint,
    savedVersion: data.settings?.routeCanvasLayoutVersion,
    savedWasUserAdjusted: data.settings?.routeCanvasLayoutWasUserAdjusted ?? false,
  };

  return {
    rootPath: data.rootPath,
    tree: data.tree,
    blocks,
    defaultScriptBlock,
    images,
    audios,
    imageScanPaths: data.settings?.scannedImagePaths ?? [],
    audioScanPaths: data.settings?.scannedAudioPaths ?? [],
    stickyNotes: data.settings?.stickyNotes ?? [],
    routeStickyNotes: data.settings?.routeStickyNotes ?? [],
    choiceStickyNotes: data.settings?.choiceStickyNotes ?? [],
    notecards: data.settings?.notecards ?? [],
    notecardLinks: data.settings?.notecardLinks ?? [],
    notecardTimeline: data.settings?.notecardTimeline ?? { slotLabels: {} },
    characterProfiles: data.settings?.characterProfiles ?? {},
    punchlistMetadata: data.settings?.punchlistMetadata ?? {},
    diagnosticsTasks,
    ignoredDiagnostics: data.settings?.ignoredDiagnostics ?? [],
    dismissedImplicitVariableHint: data.settings?.dismissedImplicitVariableHint ?? false,
    sceneCompositions,
    sceneNames,
    imagemapCompositions,
    routeNodeLayoutCache,
    primaryTabs,
    primaryActiveTabId,
    secondaryTabs,
    secondaryActiveTabId,
    splitLayout,
    splitPrimarySize,
    pendingStoryLayoutRefresh,
    pendingRouteLayoutRefresh,
    canvasSettings: {
      draftingMode: data.settings?.draftingMode ?? false,
      storyCanvasLayoutMode: data.settings?.storyCanvasLayoutMode ?? 'flow-lr',
      storyCanvasGroupingMode: data.settings?.storyCanvasGroupingMode ?? 'none',
      storyCanvasLayoutFingerprint: data.settings?.storyCanvasLayoutFingerprint,
      storyCanvasLayoutVersion: data.settings?.storyCanvasLayoutVersion ?? getStoryLayoutVersion(),
      storyCanvasLayoutWasUserAdjusted: data.settings?.storyCanvasLayoutWasUserAdjusted ?? false,
      routeCanvasLayoutMode: data.settings?.routeCanvasLayoutMode ?? 'flow-lr',
      routeCanvasGroupingMode: data.settings?.routeCanvasGroupingMode ?? 'none',
      routeCanvasLayoutFingerprint: data.settings?.routeCanvasLayoutFingerprint,
      routeCanvasLayoutVersion: data.settings?.routeCanvasLayoutVersion ?? getRouteCanvasLayoutVersion(),
      routeCanvasLayoutWasUserAdjusted: data.settings?.routeCanvasLayoutWasUserAdjusted ?? false,
      completedMilestones: data.settings?.completedMilestones ?? [],
    },
  };
}
