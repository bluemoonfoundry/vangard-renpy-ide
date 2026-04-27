/**
 * @file useFileSystemState.ts
 * @description Custom hook for managing file system and file explorer state
 *
 * Handles project root path, file system tree, explorer selection/expansion state,
 * external actions (new file/folder, rename), and clipboard for copy/cut/paste.
 */

import { useState, useCallback } from 'react';
import type { FileSystemTreeNode, ClipboardState } from '@/types';

export interface UseFileSystemStateReturn {
  // Project root
  projectRootPath: string | null;
  setProjectRootPath: React.Dispatch<React.SetStateAction<string | null>>;

  // File system tree
  fileSystemTree: FileSystemTreeNode | null;
  setFileSystemTree: React.Dispatch<React.SetStateAction<FileSystemTreeNode | null>>;

  // Explorer selection state
  explorerSelectedPaths: Set<string>;
  explorerLastClickedPath: string | null;
  setExplorerSelectedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  setExplorerLastClickedPath: React.Dispatch<React.SetStateAction<string | null>>;

  // Explorer expansion state
  explorerExpandedPaths: Set<string>;
  setExplorerExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Explorer external actions (triggers for UI interactions)
  explorerExternalAction: { type: 'new-file' | 'new-folder' | 'rename'; key: number } | null;
  setExplorerExternalAction: React.Dispatch<React.SetStateAction<{ type: 'new-file' | 'new-folder' | 'rename'; key: number } | null>>;

  // Clipboard
  clipboard: ClipboardState;
  setClipboard: React.Dispatch<React.SetStateAction<ClipboardState>>;

  // High-level operations
  selectPath: (path: string, append?: boolean) => void;
  selectPaths: (paths: string[]) => void;
  clearExplorerSelection: () => void;
  expandPath: (path: string) => void;
  collapsePath: (path: string) => void;
  toggleExpansion: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  triggerNewFile: () => void;
  triggerNewFolder: () => void;
  triggerRename: () => void;
  copyToClipboard: (paths: string[]) => void;
  cutToClipboard: (paths: string[]) => void;
  clearClipboard: () => void;
  closeProject: () => void;
}

/**
 * Hook for managing file system and explorer state
 *
 * @returns Object containing file system state and management functions
 *
 * @example
 * ```tsx
 * const {
 *   projectRootPath,
 *   fileSystemTree,
 *   explorerSelectedPaths,
 *   selectPath,
 *   expandPath,
 *   copyToClipboard
 * } = useFileSystemState();
 *
 * // Select a file
 * selectPath('game/script.rpy');
 *
 * // Expand a folder
 * expandPath('game');
 *
 * // Copy files to clipboard
 * copyToClipboard(['game/script.rpy', 'game/images/bg.png']);
 * ```
 */
export function useFileSystemState(): UseFileSystemStateReturn {
  // --- Project root ---
  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);

  // --- File system tree ---
  const [fileSystemTree, setFileSystemTree] = useState<FileSystemTreeNode | null>(null);

  // --- Explorer selection ---
  const [explorerSelectedPaths, setExplorerSelectedPaths] = useState<Set<string>>(new Set());
  const [explorerLastClickedPath, setExplorerLastClickedPath] = useState<string | null>(null);

  // --- Explorer expansion ---
  const [explorerExpandedPaths, setExplorerExpandedPaths] = useState<Set<string>>(new Set());

  // --- Explorer external actions ---
  const [explorerExternalAction, setExplorerExternalAction] = useState<{ type: 'new-file' | 'new-folder' | 'rename'; key: number } | null>(null);

  // --- Clipboard ---
  const [clipboard, setClipboard] = useState<ClipboardState>(null);

  /**
   * Select a path in the explorer
   */
  const selectPath = useCallback((path: string, append = false) => {
    if (append) {
      setExplorerSelectedPaths(prev => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    } else {
      setExplorerSelectedPaths(new Set([path]));
    }
    setExplorerLastClickedPath(path);
  }, []);

  /**
   * Select multiple paths
   */
  const selectPaths = useCallback((paths: string[]) => {
    setExplorerSelectedPaths(new Set(paths));
    if (paths.length > 0) {
      setExplorerLastClickedPath(paths[paths.length - 1]);
    }
  }, []);

  /**
   * Clear selection
   */
  const clearExplorerSelection = useCallback(() => {
    setExplorerSelectedPaths(new Set());
    setExplorerLastClickedPath(null);
  }, []);

  /**
   * Expand a path in the explorer
   */
  const expandPath = useCallback((path: string) => {
    setExplorerExpandedPaths(prev => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  /**
   * Collapse a path in the explorer
   */
  const collapsePath = useCallback((path: string) => {
    setExplorerExpandedPaths(prev => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  /**
   * Toggle expansion for a path
   */
  const toggleExpansion = useCallback((path: string) => {
    setExplorerExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  /**
   * Expand all folders (not implemented - would need tree traversal)
   */
  const expandAll = useCallback(() => {
    // TODO: Implement if needed (requires tree traversal)
  }, []);

  /**
   * Collapse all folders
   */
  const collapseAll = useCallback(() => {
    setExplorerExpandedPaths(new Set());
  }, []);

  /**
   * Trigger new file creation UI
   */
  const triggerNewFile = useCallback(() => {
    setExplorerExternalAction({ type: 'new-file', key: Date.now() });
  }, []);

  /**
   * Trigger new folder creation UI
   */
  const triggerNewFolder = useCallback(() => {
    setExplorerExternalAction({ type: 'new-folder', key: Date.now() });
  }, []);

  /**
   * Trigger rename UI
   */
  const triggerRename = useCallback(() => {
    setExplorerExternalAction({ type: 'rename', key: Date.now() });
  }, []);

  /**
   * Copy paths to clipboard
   */
  const copyToClipboard = useCallback((paths: string[]) => {
    setClipboard({ type: 'copy', paths });
  }, []);

  /**
   * Cut paths to clipboard
   */
  const cutToClipboard = useCallback((paths: string[]) => {
    setClipboard({ type: 'cut', paths });
  }, []);

  /**
   * Clear clipboard
   */
  const clearClipboard = useCallback(() => {
    setClipboard(null);
  }, []);

  /**
   * Close project and reset all state
   */
  const closeProject = useCallback(() => {
    setProjectRootPath(null);
    setFileSystemTree(null);
    setExplorerSelectedPaths(new Set());
    setExplorerLastClickedPath(null);
    setExplorerExpandedPaths(new Set());
    setExplorerExternalAction(null);
    setClipboard(null);
  }, []);

  return {
    // Project root
    projectRootPath,
    setProjectRootPath,

    // File system tree
    fileSystemTree,
    setFileSystemTree,

    // Explorer selection
    explorerSelectedPaths,
    explorerLastClickedPath,
    setExplorerSelectedPaths,
    setExplorerLastClickedPath,

    // Explorer expansion
    explorerExpandedPaths,
    setExplorerExpandedPaths,

    // Explorer external actions
    explorerExternalAction,
    setExplorerExternalAction,

    // Clipboard
    clipboard,
    setClipboard,

    // High-level operations
    selectPath,
    selectPaths,
    clearExplorerSelection,
    expandPath,
    collapsePath,
    toggleExpansion,
    expandAll,
    collapseAll,
    triggerNewFile,
    triggerNewFolder,
    triggerRename,
    copyToClipboard,
    cutToClipboard,
    clearClipboard,
    closeProject,
  };
}
