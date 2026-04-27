/**
 * @file useCanvasInteraction.ts
 * @description Custom hook for managing canvas transforms and interactions
 *
 * Consolidates all canvas-related state including viewport transforms (pan/zoom),
 * selection state, highlight requests, center/flash requests, and canvas filters.
 * Supports three canvases: Story (Project), Route (Flow), and Choice.
 */

import { useState, useCallback } from 'react';

/** Canvas viewport transform (position + zoom) */
export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

/** Canvas filter visibility flags */
export interface CanvasFilters {
  story: boolean;
  screens: boolean;
  config: boolean;
  notes: boolean;
  minimap: boolean;
}

/** Request to center on a block (with key for React re-render trigger) */
export interface CenterOnBlockRequest {
  blockId: string;
  key: number;
}

/** Request to flash a block (with key for React re-render trigger) */
export interface FlashBlockRequest {
  blockId: string;
  key: number;
}

/** Request to center on a label node (with key for React re-render trigger) */
export interface CenterOnNodeRequest {
  nodeId: string;
  key: number;
}

/** Request to center on canvas start (with key for React re-render trigger) */
export interface CenterOnStartRequest {
  key: number;
}

export interface UseCanvasInteractionReturn {
  // Transform state (pan/zoom for each canvas)
  storyCanvasTransform: CanvasTransform;
  routeCanvasTransform: CanvasTransform;
  choiceCanvasTransform: CanvasTransform;
  setStoryCanvasTransform: React.Dispatch<React.SetStateAction<CanvasTransform>>;
  setRouteCanvasTransform: React.Dispatch<React.SetStateAction<CanvasTransform>>;
  setChoiceCanvasTransform: React.Dispatch<React.SetStateAction<CanvasTransform>>;

  // Selection state
  selectedBlockIds: string[];
  selectedGroupIds: string[];
  setSelectedBlockIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedGroupIds: React.Dispatch<React.SetStateAction<string[]>>;

  // Highlight state
  findUsagesHighlightIds: Set<string> | null;
  hoverHighlightIds: Set<string> | null;
  setFindUsagesHighlightIds: React.Dispatch<React.SetStateAction<Set<string> | null>>;
  setHoverHighlightIds: React.Dispatch<React.SetStateAction<Set<string> | null>>;

  // Center/flash requests (action triggers with key for re-render)
  centerOnBlockRequest: CenterOnBlockRequest | null;
  centerOnRouteStartRequest: CenterOnStartRequest | null;
  centerOnChoiceStartRequest: CenterOnStartRequest | null;
  centerOnRouteNodeRequest: CenterOnNodeRequest | null;
  centerOnChoiceNodeRequest: CenterOnNodeRequest | null;
  flashBlockRequest: FlashBlockRequest | null;
  setCenterOnBlockRequest: React.Dispatch<React.SetStateAction<CenterOnBlockRequest | null>>;
  setCenterOnRouteStartRequest: React.Dispatch<React.SetStateAction<CenterOnStartRequest | null>>;
  setCenterOnChoiceStartRequest: React.Dispatch<React.SetStateAction<CenterOnStartRequest | null>>;
  setCenterOnRouteNodeRequest: React.Dispatch<React.SetStateAction<CenterOnNodeRequest | null>>;
  setCenterOnChoiceNodeRequest: React.Dispatch<React.SetStateAction<CenterOnNodeRequest | null>>;
  setFlashBlockRequest: React.Dispatch<React.SetStateAction<FlashBlockRequest | null>>;

  // Canvas filters
  canvasFilters: CanvasFilters;
  setCanvasFilters: React.Dispatch<React.SetStateAction<CanvasFilters>>;

  // High-level operations
  centerOnBlock: (blockId: string) => void;
  flashBlock: (blockId: string) => void;
  centerOnRouteNode: (nodeId: string) => void;
  centerOnChoiceNode: (nodeId: string) => void;
  centerOnRouteStart: () => void;
  centerOnChoiceStart: () => void;
  clearSelection: () => void;
  selectBlocks: (blockIds: string[]) => void;
  selectGroups: (groupIds: string[]) => void;
  toggleBlockSelection: (blockId: string) => void;
}

/**
 * Hook for managing canvas transforms and interactions
 *
 * @returns Object containing canvas state and interaction functions
 *
 * @example
 * ```tsx
 * const {
 *   storyCanvasTransform,
 *   setStoryCanvasTransform,
 *   selectedBlockIds,
 *   centerOnBlock,
 *   flashBlock
 * } = useCanvasInteraction();
 *
 * // Pan/zoom canvas
 * setStoryCanvasTransform({ x: 100, y: 50, scale: 1.5 });
 *
 * // Center on a block
 * centerOnBlock('block-123');
 *
 * // Flash a block (visual feedback)
 * flashBlock('block-123');
 * ```
 */
export function useCanvasInteraction(): UseCanvasInteractionReturn {
  // --- Transform state ---
  const [storyCanvasTransform, setStoryCanvasTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 });
  const [routeCanvasTransform, setRouteCanvasTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 });
  const [choiceCanvasTransform, setChoiceCanvasTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 });

  // --- Selection state ---
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // --- Highlight state ---
  const [findUsagesHighlightIds, setFindUsagesHighlightIds] = useState<Set<string> | null>(null);
  const [hoverHighlightIds, setHoverHighlightIds] = useState<Set<string> | null>(null);

  // --- Center/flash requests ---
  const [centerOnBlockRequest, setCenterOnBlockRequest] = useState<CenterOnBlockRequest | null>(null);
  const [centerOnRouteStartRequest, setCenterOnRouteStartRequest] = useState<CenterOnStartRequest | null>(null);
  const [centerOnChoiceStartRequest, setCenterOnChoiceStartRequest] = useState<CenterOnStartRequest | null>(null);
  const [centerOnRouteNodeRequest, setCenterOnRouteNodeRequest] = useState<CenterOnNodeRequest | null>(null);
  const [centerOnChoiceNodeRequest, setCenterOnChoiceNodeRequest] = useState<CenterOnNodeRequest | null>(null);
  const [flashBlockRequest, setFlashBlockRequest] = useState<FlashBlockRequest | null>(null);

  // --- Canvas filters ---
  const [canvasFilters, setCanvasFilters] = useState<CanvasFilters>({
    story: true,
    screens: true,
    config: false,
    notes: true,
    minimap: true,
  });

  /**
   * Request to center viewport on a specific block
   */
  const centerOnBlock = useCallback((blockId: string) => {
    setCenterOnBlockRequest({ blockId, key: Date.now() });
  }, []);

  /**
   * Request to flash a block (visual feedback)
   */
  const flashBlock = useCallback((blockId: string) => {
    setFlashBlockRequest({ blockId, key: Date.now() });
  }, []);

  /**
   * Request to center viewport on a route node
   */
  const centerOnRouteNode = useCallback((nodeId: string) => {
    setCenterOnRouteNodeRequest({ nodeId, key: Date.now() });
  }, []);

  /**
   * Request to center viewport on a choice node
   */
  const centerOnChoiceNode = useCallback((nodeId: string) => {
    setCenterOnChoiceNodeRequest({ nodeId, key: Date.now() });
  }, []);

  /**
   * Request to center route canvas on start
   */
  const centerOnRouteStart = useCallback(() => {
    setCenterOnRouteStartRequest({ key: Date.now() });
  }, []);

  /**
   * Request to center choice canvas on start
   */
  const centerOnChoiceStart = useCallback(() => {
    setCenterOnChoiceStartRequest({ key: Date.now() });
  }, []);

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedBlockIds([]);
    setSelectedGroupIds([]);
  }, []);

  /**
   * Select specific blocks (replaces current selection)
   */
  const selectBlocks = useCallback((blockIds: string[]) => {
    setSelectedBlockIds(blockIds);
  }, []);

  /**
   * Select specific groups (replaces current selection)
   */
  const selectGroups = useCallback((groupIds: string[]) => {
    setSelectedGroupIds(groupIds);
  }, []);

  /**
   * Toggle a block's selection state
   */
  const toggleBlockSelection = useCallback((blockId: string) => {
    setSelectedBlockIds(prev => {
      if (prev.includes(blockId)) {
        return prev.filter(id => id !== blockId);
      } else {
        return [...prev, blockId];
      }
    });
  }, []);

  return {
    // Transform state
    storyCanvasTransform,
    routeCanvasTransform,
    choiceCanvasTransform,
    setStoryCanvasTransform,
    setRouteCanvasTransform,
    setChoiceCanvasTransform,

    // Selection state
    selectedBlockIds,
    selectedGroupIds,
    setSelectedBlockIds,
    setSelectedGroupIds,

    // Highlight state
    findUsagesHighlightIds,
    hoverHighlightIds,
    setFindUsagesHighlightIds,
    setHoverHighlightIds,

    // Center/flash requests
    centerOnBlockRequest,
    centerOnRouteStartRequest,
    centerOnChoiceStartRequest,
    centerOnRouteNodeRequest,
    centerOnChoiceNodeRequest,
    flashBlockRequest,
    setCenterOnBlockRequest,
    setCenterOnRouteStartRequest,
    setCenterOnChoiceStartRequest,
    setCenterOnRouteNodeRequest,
    setCenterOnChoiceNodeRequest,
    setFlashBlockRequest,

    // Canvas filters
    canvasFilters,
    setCanvasFilters,

    // High-level operations
    centerOnBlock,
    flashBlock,
    centerOnRouteNode,
    centerOnChoiceNode,
    centerOnRouteStart,
    centerOnChoiceStart,
    clearSelection,
    selectBlocks,
    selectGroups,
    toggleBlockSelection,
  };
}
