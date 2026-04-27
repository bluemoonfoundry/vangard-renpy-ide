/**
 * @file useTabManagement.ts
 * @description Custom hook for managing editor tabs and split panes
 *
 * Handles all tab-related state including primary/secondary panes, split layout,
 * tab drag-and-drop, and tab lifecycle (open/close/switch). Supports multiple
 * tab types: canvas, editor, image, audio, markdown, composers, etc.
 */

import { useState, useCallback } from 'react';
import type { EditorTab } from '@/types';

export interface UseTabManagementReturn {
  // Primary pane state
  openTabs: EditorTab[];
  activeTabId: string;
  setOpenTabs: React.Dispatch<React.SetStateAction<EditorTab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;

  // Secondary pane state
  secondaryOpenTabs: EditorTab[];
  secondaryActiveTabId: string;
  activePaneId: 'primary' | 'secondary';
  setSecondaryOpenTabs: React.Dispatch<React.SetStateAction<EditorTab[]>>;
  setSecondaryActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  setActivePaneId: React.Dispatch<React.SetStateAction<'primary' | 'secondary'>>;

  // Split layout state
  splitLayout: 'none' | 'right' | 'bottom';
  splitPrimarySize: number;
  setSplitLayout: React.Dispatch<React.SetStateAction<'none' | 'right' | 'bottom'>>;
  setSplitPrimarySize: React.Dispatch<React.SetStateAction<number>>;

  // Drag state
  draggedTabId: string | null;
  dragSourcePaneId: 'primary' | 'secondary';
  setDraggedTabId: React.Dispatch<React.SetStateAction<string | null>>;
  setDragSourcePaneId: React.Dispatch<React.SetStateAction<'primary' | 'secondary'>>;

  // Tab lifecycle handlers
  openTab: (tab: EditorTab, paneId?: 'primary' | 'secondary') => void;
  closeTab: (tabId: string, paneId: 'primary' | 'secondary') => void;
  switchTab: (tabId: string, paneId: 'primary' | 'secondary') => void;
  updateTab: (tabId: string, updates: Partial<EditorTab>, paneId?: 'primary' | 'secondary') => void;

  // Bulk operations
  closeTabs: (tabIds: string[], paneId: 'primary' | 'secondary') => void;
  setTabs: (tabs: EditorTab[], activeId: string, paneId?: 'primary' | 'secondary') => void;

  // Split pane management
  createSplit: (direction: 'right' | 'bottom') => void;
  closeSplit: () => void;
  setSplitSize: (size: number) => void;
  moveTabToPane: (tabId: string, fromPane: 'primary' | 'secondary', toPane: 'primary' | 'secondary') => void;

  // Drag handlers
  startDrag: (tabId: string, paneId: 'primary' | 'secondary') => void;
  endDrag: () => void;

  // Utilities
  findTab: (tabId: string) => { tab: EditorTab; paneId: 'primary' | 'secondary' } | null;
  getActiveTab: () => EditorTab | undefined;
}

/**
 * Hook for managing all tab state and operations
 *
 * @returns Object containing tab state and management functions
 *
 * @example
 * ```tsx
 * const {
 *   openTabs,
 *   activeTabId,
 *   openTab,
 *   closeTab,
 *   switchTab
 * } = useTabManagement();
 *
 * // Open a new editor tab
 * openTab({ id: 'block-1', type: 'editor', blockId: 'block-1', filePath: 'game/script.rpy' });
 *
 * // Switch to a tab
 * switchTab('block-1', 'primary');
 *
 * // Close a tab
 * closeTab('block-1', 'primary');
 * ```
 */
export function useTabManagement(): UseTabManagementReturn {
  // --- Primary pane state ---
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([{ id: 'canvas', type: 'canvas' }]);
  const [activeTabId, setActiveTabId] = useState<string>('canvas');

  // --- Secondary pane state ---
  const [secondaryOpenTabs, setSecondaryOpenTabs] = useState<EditorTab[]>([]);
  const [secondaryActiveTabId, setSecondaryActiveTabId] = useState<string>('');
  const [activePaneId, setActivePaneId] = useState<'primary' | 'secondary'>('primary');

  // --- Split layout state ---
  const [splitLayout, setSplitLayout] = useState<'none' | 'right' | 'bottom'>('none');
  const [splitPrimarySize, setSplitPrimarySize] = useState<number>(600);

  // --- Drag state ---
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragSourcePaneId, setDragSourcePaneId] = useState<'primary' | 'secondary'>('primary');

  /**
   * Find a tab across both panes
   */
  const findTab = useCallback((tabId: string) => {
    const primaryTab = openTabs.find(t => t.id === tabId);
    if (primaryTab) return { tab: primaryTab, paneId: 'primary' as const };

    const secondaryTab = secondaryOpenTabs.find(t => t.id === tabId);
    if (secondaryTab) return { tab: secondaryTab, paneId: 'secondary' as const };

    return null;
  }, [openTabs, secondaryOpenTabs]);

  /**
   * Get the currently active tab
   */
  const getActiveTab = useCallback(() => {
    if (activePaneId === 'primary') {
      return openTabs.find(t => t.id === activeTabId);
    } else {
      return secondaryOpenTabs.find(t => t.id === secondaryActiveTabId);
    }
  }, [activePaneId, openTabs, activeTabId, secondaryOpenTabs, secondaryActiveTabId]);

  /**
   * Open a tab in the specified pane (or active pane if not specified)
   * If tab already exists, switches to it instead
   */
  const openTab = useCallback((tab: EditorTab, paneId?: 'primary' | 'secondary') => {
    // Check if tab already exists
    const existing = findTab(tab.id);
    if (existing) {
      // Tab exists - just switch to it
      if (existing.paneId === 'primary') {
        setActiveTabId(tab.id);
        setActivePaneId('primary');
      } else {
        setSecondaryActiveTabId(tab.id);
        setActivePaneId('secondary');
      }
      return;
    }

    // Determine target pane
    const targetPane = paneId ?? activePaneId;

    if (targetPane === 'secondary' && splitLayout !== 'none') {
      setSecondaryOpenTabs(prev => [...prev, tab]);
      setSecondaryActiveTabId(tab.id);
      setActivePaneId('secondary');
    } else {
      setOpenTabs(prev => [...prev, tab]);
      setActiveTabId(tab.id);
      setActivePaneId('primary');
    }
  }, [findTab, activePaneId, splitLayout]);

  /**
   * Close a tab from the specified pane
   */
  const closeTab = useCallback((tabId: string, paneId: 'primary' | 'secondary') => {
    if (paneId === 'primary') {
      setOpenTabs(prev => {
        const next = prev.filter(t => t.id !== tabId);
        if (activeTabId === tabId) {
          // Find adjacent tab: prefer next, then previous
          const closedIdx = prev.findIndex(t => t.id === tabId);
          const fallback = next[closedIdx] ?? next[closedIdx - 1] ?? next[0];
          setActiveTabId(fallback?.id ?? '');
        }
        return next;
      });
    } else {
      setSecondaryOpenTabs(prev => {
        const next = prev.filter(t => t.id !== tabId);
        if (next.length === 0) {
          // Auto-close pane when last secondary tab removed
          setSplitLayout('none');
          setActivePaneId('primary');
          setSecondaryActiveTabId('');
        } else {
          if (secondaryActiveTabId === tabId) {
            setSecondaryActiveTabId(next[next.length - 1].id);
          }
        }
        return next;
      });
    }
  }, [activeTabId, secondaryActiveTabId]);

  /**
   * Close multiple tabs at once
   */
  const closeTabs = useCallback((tabIds: string[], paneId: 'primary' | 'secondary') => {
    const idsToClose = new Set(tabIds);

    if (paneId === 'primary') {
      setOpenTabs(prev => {
        const next = prev.filter(t => !idsToClose.has(t.id));
        if (idsToClose.has(activeTabId)) {
          const fallback = next[0];
          setActiveTabId(fallback?.id ?? '');
        }
        return next;
      });
    } else {
      setSecondaryOpenTabs(prev => {
        const next = prev.filter(t => !idsToClose.has(t.id));
        if (next.length === 0) {
          setSplitLayout('none');
          setActivePaneId('primary');
          setSecondaryActiveTabId('');
        } else if (idsToClose.has(secondaryActiveTabId)) {
          setSecondaryActiveTabId(next[0].id);
        }
        return next;
      });
    }
  }, [activeTabId, secondaryActiveTabId]);

  /**
   * Switch to an existing tab
   */
  const switchTab = useCallback((tabId: string, paneId: 'primary' | 'secondary') => {
    if (paneId === 'primary') {
      setActiveTabId(tabId);
      setActivePaneId('primary');
    } else {
      setSecondaryActiveTabId(tabId);
      setActivePaneId('secondary');
    }
  }, []);

  /**
   * Update tab properties (e.g., scroll position, dirty state)
   */
  const updateTab = useCallback((tabId: string, updates: Partial<EditorTab>, paneId?: 'primary' | 'secondary') => {
    const existing = findTab(tabId);
    if (!existing) return;

    const targetPane = paneId ?? existing.paneId;

    if (targetPane === 'primary') {
      setOpenTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t));
    } else {
      setSecondaryOpenTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t));
    }
  }, [findTab]);

  /**
   * Replace all tabs and active tab for a pane (used during project load)
   */
  const setTabs = useCallback((tabs: EditorTab[], activeId: string, paneId: 'primary' | 'secondary' = 'primary') => {
    if (paneId === 'primary') {
      setOpenTabs(tabs);
      setActiveTabId(activeId);
    } else {
      setSecondaryOpenTabs(tabs);
      setSecondaryActiveTabId(activeId);
    }
  }, []);

  /**
   * Create a split pane and move active tab to secondary
   */
  const createSplit = useCallback((direction: 'right' | 'bottom') => {
    if (splitLayout !== 'none') return;

    const activeTab = openTabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    // Move the active tab to secondary
    const remaining = openTabs.filter(t => t.id !== activeTabId);
    setOpenTabs(remaining);

    if (remaining.length > 0) {
      const fallback = remaining.find(t => t.type === 'canvas') ?? remaining[0];
      setActiveTabId(fallback.id);
    }

    setSecondaryOpenTabs([activeTab]);
    setSecondaryActiveTabId(activeTab.id);
    setSplitLayout(direction);
    setSplitPrimarySize(direction === 'right' ? 600 : 400);
    setActivePaneId('secondary');
  }, [splitLayout, openTabs, activeTabId]);

  /**
   * Close secondary pane and merge tabs into primary
   */
  const closeSplit = useCallback(() => {
    if (secondaryOpenTabs.length > 0) {
      setOpenTabs(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const toMerge = secondaryOpenTabs.filter(t => !existingIds.has(t.id));
        return [...prev, ...toMerge];
      });
    }
    setSplitLayout('none');
    setSecondaryOpenTabs([]);
    setSecondaryActiveTabId('');
    setActivePaneId('primary');
  }, [secondaryOpenTabs]);

  /**
   * Set the split pane size
   */
  const setSplitSize = useCallback((size: number) => {
    setSplitPrimarySize(size);
  }, []);

  /**
   * Move a tab from one pane to another
   */
  const moveTabToPane = useCallback((tabId: string, fromPane: 'primary' | 'secondary', toPane: 'primary' | 'secondary') => {
    if (fromPane === toPane) return;

    if (fromPane === 'primary') {
      const tab = openTabs.find(t => t.id === tabId);
      if (!tab) return;

      setOpenTabs(prev => prev.filter(t => t.id !== tabId));
      if (activeTabId === tabId) setActiveTabId('canvas');

      if (!secondaryOpenTabs.find(t => t.id === tabId)) {
        setSecondaryOpenTabs(prev => [...prev, tab]);
      }
      setSecondaryActiveTabId(tabId);
      setActivePaneId('secondary');
    } else {
      const tab = secondaryOpenTabs.find(t => t.id === tabId);
      if (!tab) return;

      const newSecondary = secondaryOpenTabs.filter(t => t.id !== tabId);
      if (newSecondary.length === 0) {
        setSecondaryOpenTabs([]);
        setSecondaryActiveTabId('');
        setSplitLayout('none');
        setActivePaneId('primary');
      } else {
        setSecondaryOpenTabs(newSecondary);
        if (secondaryActiveTabId === tabId) {
          setSecondaryActiveTabId(newSecondary[0].id);
        }
      }

      if (!openTabs.find(t => t.id === tabId)) {
        setOpenTabs(prev => [...prev, tab]);
      }
      setActiveTabId(tabId);
      setActivePaneId('primary');
    }
  }, [openTabs, activeTabId, secondaryOpenTabs, secondaryActiveTabId]);

  /**
   * Start dragging a tab
   */
  const startDrag = useCallback((tabId: string, paneId: 'primary' | 'secondary') => {
    setDraggedTabId(tabId);
    setDragSourcePaneId(paneId);
  }, []);

  /**
   * End tab drag
   */
  const endDrag = useCallback(() => {
    setDraggedTabId(null);
  }, []);

  return {
    // State
    openTabs,
    activeTabId,
    setOpenTabs,
    setActiveTabId,
    secondaryOpenTabs,
    secondaryActiveTabId,
    activePaneId,
    setSecondaryOpenTabs,
    setSecondaryActiveTabId,
    setActivePaneId,
    splitLayout,
    splitPrimarySize,
    setSplitLayout,
    setSplitPrimarySize,
    draggedTabId,
    dragSourcePaneId,
    setDraggedTabId,
    setDragSourcePaneId,

    // Lifecycle
    openTab,
    closeTab,
    switchTab,
    updateTab,

    // Bulk operations
    closeTabs,
    setTabs,

    // Split management
    createSplit,
    closeSplit,
    setSplitSize,
    moveTabToPane,

    // Drag
    startDrag,
    endDrag,

    // Utilities
    findTab,
    getActiveTab,
  };
}
