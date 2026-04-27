/**
 * @file useCompositionState.ts
 * @description Custom hook for managing visual composer state
 *
 * Handles state for three visual composition tools:
 * - Scene Composer: Visual scene builder with sprites, effects, transitions
 * - ImageMap Composer: Interactive image map with clickable hotspots
 * - Screen Layout Composer: UI screen layout designer
 *
 * Each composition type has its own collection stored as a Record<id, composition>.
 */

import { useImmer } from 'use-immer';
import type { SceneComposition, ImageMapComposition, ScreenLayoutComposition } from '@/types';

export interface UseCompositionStateReturn {
  // Scene Composer state
  sceneCompositions: Record<string, SceneComposition>;
  sceneNames: Record<string, string>;
  setSceneCompositions: (update: Record<string, SceneComposition> | ((draft: Record<string, SceneComposition>) => void)) => void;
  setSceneNames: (update: Record<string, string> | ((draft: Record<string, string>) => void)) => void;

  // ImageMap Composer state
  imagemapCompositions: Record<string, ImageMapComposition>;
  setImagemapCompositions: (update: Record<string, ImageMapComposition> | ((draft: Record<string, ImageMapComposition>) => void)) => void;

  // Screen Layout Composer state
  screenLayoutCompositions: Record<string, ScreenLayoutComposition>;
  setScreenLayoutCompositions: (update: Record<string, ScreenLayoutComposition> | ((draft: Record<string, ScreenLayoutComposition>) => void)) => void;

  // High-level operations
  addScene: (sceneId: string, composition: SceneComposition, name?: string) => void;
  updateScene: (sceneId: string, updates: Partial<SceneComposition>) => void;
  removeScene: (sceneId: string) => void;
  renameScene: (sceneId: string, newName: string) => void;

  addImagemap: (imagemapId: string, composition: ImageMapComposition) => void;
  updateImagemap: (imagemapId: string, updates: Partial<ImageMapComposition>) => void;
  removeImagemap: (imagemapId: string) => void;

  addScreenLayout: (layoutId: string, composition: ScreenLayoutComposition) => void;
  updateScreenLayout: (layoutId: string, updates: Partial<ScreenLayoutComposition>) => void;
  removeScreenLayout: (layoutId: string) => void;

  clearAllCompositions: () => void;
}

/**
 * Hook for managing visual composer state
 *
 * @returns Object containing composition state and management functions
 *
 * @example
 * ```tsx
 * const {
 *   sceneCompositions,
 *   addScene,
 *   updateScene,
 *   removeScene
 * } = useCompositionState();
 *
 * // Create a new scene
 * addScene('scene-1', {
 *   background: { type: 'image', path: 'bg.png' },
 *   sprites: [],
 *   music: null,
 *   transitions: []
 * }, 'Opening Scene');
 *
 * // Update scene
 * updateScene('scene-1', {
 *   music: { path: 'music/theme.mp3', volume: 0.8 }
 * });
 *
 * // Delete scene
 * removeScene('scene-1');
 * ```
 */
export function useCompositionState(): UseCompositionStateReturn {
  // --- Scene Composer state ---
  const [sceneCompositions, setSceneCompositions] = useImmer<Record<string, SceneComposition>>({});
  const [sceneNames, setSceneNames] = useImmer<Record<string, string>>({});

  // --- ImageMap Composer state ---
  const [imagemapCompositions, setImagemapCompositions] = useImmer<Record<string, ImageMapComposition>>({});

  // --- Screen Layout Composer state ---
  const [screenLayoutCompositions, setScreenLayoutCompositions] = useImmer<Record<string, ScreenLayoutComposition>>({});

  /**
   * Add a new scene composition
   */
  const addScene = (sceneId: string, composition: SceneComposition, name?: string) => {
    setSceneCompositions(draft => {
      draft[sceneId] = composition;
    });
    if (name) {
      setSceneNames(draft => {
        draft[sceneId] = name;
      });
    }
  };

  /**
   * Update an existing scene composition
   */
  const updateScene = (sceneId: string, updates: Partial<SceneComposition>) => {
    setSceneCompositions(draft => {
      if (draft[sceneId]) {
        Object.assign(draft[sceneId], updates);
      }
    });
  };

  /**
   * Remove a scene composition
   */
  const removeScene = (sceneId: string) => {
    setSceneCompositions(draft => {
      delete draft[sceneId];
    });
    setSceneNames(draft => {
      delete draft[sceneId];
    });
  };

  /**
   * Rename a scene
   */
  const renameScene = (sceneId: string, newName: string) => {
    setSceneNames(draft => {
      draft[sceneId] = newName;
    });
  };

  /**
   * Add a new imagemap composition
   */
  const addImagemap = (imagemapId: string, composition: ImageMapComposition) => {
    setImagemapCompositions(draft => {
      draft[imagemapId] = composition;
    });
  };

  /**
   * Update an existing imagemap composition
   */
  const updateImagemap = (imagemapId: string, updates: Partial<ImageMapComposition>) => {
    setImagemapCompositions(draft => {
      if (draft[imagemapId]) {
        Object.assign(draft[imagemapId], updates);
      }
    });
  };

  /**
   * Remove an imagemap composition
   */
  const removeImagemap = (imagemapId: string) => {
    setImagemapCompositions(draft => {
      delete draft[imagemapId];
    });
  };

  /**
   * Add a new screen layout composition
   */
  const addScreenLayout = (layoutId: string, composition: ScreenLayoutComposition) => {
    setScreenLayoutCompositions(draft => {
      draft[layoutId] = composition;
    });
  };

  /**
   * Update an existing screen layout composition
   */
  const updateScreenLayout = (layoutId: string, updates: Partial<ScreenLayoutComposition>) => {
    setScreenLayoutCompositions(draft => {
      if (draft[layoutId]) {
        Object.assign(draft[layoutId], updates);
      }
    });
  };

  /**
   * Remove a screen layout composition
   */
  const removeScreenLayout = (layoutId: string) => {
    setScreenLayoutCompositions(draft => {
      delete draft[layoutId];
    });
  };

  /**
   * Clear all compositions (typically on project close)
   */
  const clearAllCompositions = () => {
    setSceneCompositions({});
    setSceneNames({});
    setImagemapCompositions({});
    setScreenLayoutCompositions({});
  };

  return {
    // Scene Composer state
    sceneCompositions,
    sceneNames,
    setSceneCompositions,
    setSceneNames,

    // ImageMap Composer state
    imagemapCompositions,
    setImagemapCompositions,

    // Screen Layout Composer state
    screenLayoutCompositions,
    setScreenLayoutCompositions,

    // High-level operations
    addScene,
    updateScene,
    removeScene,
    renameScene,
    addImagemap,
    updateImagemap,
    removeImagemap,
    addScreenLayout,
    updateScreenLayout,
    removeScreenLayout,
    clearAllCompositions,
  };
}
