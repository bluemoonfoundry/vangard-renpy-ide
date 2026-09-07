import { useCallback } from 'react';
import type { Block, ClipboardState, FileSystemTreeNode, Position } from '@/types';
import { produce } from 'immer';
import { logger } from '@/lib/logger';

// Helper to add a node to the file tree immutably, creating parent directories if needed.
export const addNodeToFileTree = (tree: FileSystemTreeNode, path: string, type: 'file' | 'folder' = 'file'): FileSystemTreeNode => {
    const checkIfExists = (node: FileSystemTreeNode, path: string): boolean => {
        if (node.path === path) return true;
        return !!node.children?.some(child => checkIfExists(child, path));
    };
    if (checkIfExists(tree, path)) return tree;

    return produce(tree, draft => {
        let currentNode = draft;
        const parts = path.split('/');
        parts.forEach((part, index) => {
            if (!currentNode.children) currentNode.children = [];
            let childNode = currentNode.children.find(child => child.name === part);
            if (!childNode) {
                const isLastPart = index === parts.length - 1;
                const isDir = !isLastPart || (isLastPart && type === 'folder');
                childNode = { name: part, path: parts.slice(0, index + 1).join('/'), ...(isDir && { children: [] }) };
                currentNode.children.push(childNode);
                currentNode.children.sort((a, b) => {
                    if (a.children && !b.children) return -1;
                    if (!a.children && b.children) return 1;
                    return a.name.localeCompare(b.name);
                });
            }
            currentNode = childNode;
        });
    });
};

// Helper to remove a node from the file tree immutably.
export const removeNodeFromFileTree = (tree: FileSystemTreeNode | null, path: string): FileSystemTreeNode | null => {
    if (!tree) return null;
    return produce(tree, draft => {
        const parts = path.split('/');
        let currentNode = draft;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!currentNode.children) return;
            const nextNode = currentNode.children.find(child => child.name === parts[i]);
            if (!nextNode) return;
            currentNode = nextNode;
        }
        if (currentNode.children) {
            const index = currentNode.children.findIndex(child => child.name === parts[parts.length - 1]);
            if (index > -1) currentNode.children.splice(index, 1);
        }
    });
};

type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface UseFileSystemManagerParams {
  projectRootPath: string | null;
  setFileSystemTree: React.Dispatch<React.SetStateAction<FileSystemTreeNode | null>>;
  blocks: Block[];
  addBlock: (filePath: string, content: string, initialPosition?: Position, options?: { markDirty?: boolean }) => string;
  updateBlock: (id: string, data: Partial<Block>) => void;
  clipboard: ClipboardState;
  setClipboard: React.Dispatch<React.SetStateAction<ClipboardState>>;
  openDeleteConfirmModal: (paths: string[], onConfirm: () => void) => void;
  addToast: (message: string, type?: ToastType) => void;
  handleRefreshProject: () => Promise<void>;
}

export interface UseFileSystemManagerReturn {
  handleCreateNode: (parentPath: string, name: string, type: 'file' | 'folder') => Promise<{ blockId: string | null; relativePath: string } | null>;
  handleRenameNode: (oldPath: string, newName: string) => Promise<void>;
  handleDeleteNode: (paths: string[]) => void;
  handleMoveNode: (sourcePaths: string[], targetPath: string) => Promise<void>;
  handleCut: (paths: string[]) => void;
  handleCopy: (paths: string[]) => void;
  handlePaste: (targetPath: string) => Promise<void>;
}

/**
 * Hook for file explorer tree CRUD operations (create/rename/delete/move/cut/copy/paste).
 * Performs the IPC calls and reconciles both the file system tree and `.rpy` blocks.
 */
export function useFileSystemManager({
  projectRootPath, setFileSystemTree, blocks, addBlock, updateBlock,
  clipboard, setClipboard, openDeleteConfirmModal, addToast, handleRefreshProject,
}: UseFileSystemManagerParams): UseFileSystemManagerReturn {
  const handleCreateNode = useCallback(async (parentPath: string, name: string, type: 'file' | 'folder') => {
    if (!window.electronAPI || !projectRootPath) return null;
    try {
        const fullPath = await window.electronAPI.path.join(projectRootPath, parentPath, name);
        const relativePath = parentPath ? `${parentPath}/${name}` : name;
        let blockId: string | null = null;
        if (type === 'folder') {
            await window.electronAPI.createDirectory(fullPath);
        } else {
            await window.electronAPI.writeFile(fullPath, '');

            // If it's an .rpy file, create a corresponding block
            if (name.toLowerCase().endsWith('.rpy')) {
                const content = ''; // Empty content for newly created files
                blockId = addBlock(relativePath, content, undefined, { markDirty: false });
                addToast(`Created block for ${name}`, 'success');
            }
        }
        const projData = await window.electronAPI.loadProject(projectRootPath);
        setFileSystemTree(projData.tree);
        return { blockId, relativePath };
    } catch (err) {
        logger.error('Failed to create file/folder:', err);
        addToast(`Failed to create ${type}: ${name}`, 'error');
        return null;
    }
  }, [projectRootPath, addBlock, addToast, setFileSystemTree]);

  const handleRenameNode = useCallback(async (oldPath: string, newName: string) => {
      if (!window.electronAPI || !projectRootPath) return;
      try {
          const fullOldPath = await window.electronAPI.path.join(projectRootPath, oldPath) as string;
          const parentDir = oldPath.split('/').slice(0, -1).join('/');
          const newPath = parentDir ? `${parentDir}/${newName}` : newName;
          const fullNewPath = await window.electronAPI.path.join(projectRootPath, parentDir, newName) as string;
          await window.electronAPI.moveFile(fullOldPath, fullNewPath);

          // Reconcile blocks under the renamed path — the renamed node itself (a file)
          // or any descendant blocks if a folder was renamed — so already-loaded blocks
          // (and any tabs open on them) reflect the new path/name without needing a
          // manual Refresh, and the renamed file can be reopened under its new name.
          blocks.forEach(block => {
              if (!block.filePath) return;
              let newFilePath: string | null = null;
              if (block.filePath === oldPath) {
                  newFilePath = newPath;
              } else if (block.filePath.startsWith(`${oldPath}/`)) {
                  newFilePath = newPath + block.filePath.slice(oldPath.length);
              }
              if (newFilePath) {
                  updateBlock(block.id, { filePath: newFilePath, title: newFilePath.split('/').pop() });
              }
          });

          const projData = await window.electronAPI.loadProject(projectRootPath);
          setFileSystemTree(projData.tree);
      } catch (err) {
          logger.error('Failed to rename:', err);
          addToast('Failed to rename file', 'error');
      }
  }, [projectRootPath, blocks, updateBlock, addToast, setFileSystemTree]);

  const handleDeleteNode = useCallback((paths: string[]) => {
      if (!window.electronAPI || !projectRootPath) return;

      // Show confirmation modal
      openDeleteConfirmModal(paths, async () => {
              try {
                  // Delete the files
                  for (const p of paths) {
                      const fullPath = await window.electronAPI!.path.join(projectRootPath, p) as string;
                      await window.electronAPI!.removeEntry(fullPath);
                  }

                  // Reconcile everything derived from disk state in one pass -- file tree,
                  // .rpy blocks (closing any open tabs for deleted files), and the
                  // project images/audios shown in the Story Elements pane. A manual,
                  // rpy-only reconciliation here previously left deleted images/audios
                  // stuck in the pane until the user hit "Refresh" themselves.
                  await handleRefreshProject();
              } catch (err) {
                  logger.error('Failed to delete:', err);
                  addToast('Failed to delete file(s)', 'error');
              }
      });
  }, [projectRootPath, addToast, openDeleteConfirmModal, handleRefreshProject]);

  const handleMoveNode = useCallback(async (sourcePaths: string[], targetPath: string) => {
      if (!window.electronAPI || !projectRootPath) return;
      try {
          const fullTargetDir = await window.electronAPI.path.join(projectRootPath, targetPath);
          for (const p of sourcePaths) {
              const fullSource = await window.electronAPI.path.join(projectRootPath, p);
              const fileName = p.split('/').pop() || '';
              const fullDest = await window.electronAPI.path.join(fullTargetDir, fileName);
              await window.electronAPI.moveFile(fullSource, fullDest);

              // Reconcile blocks under the moved path — same reasoning as handleRenameNode:
              // keep already-loaded blocks (and any tabs open on them) pointed at the new
              // location instead of desyncing from disk.
              const newPath = targetPath ? `${targetPath}/${fileName}` : fileName;
              blocks.forEach(block => {
                  if (!block.filePath) return;
                  let newFilePath: string | null = null;
                  if (block.filePath === p) {
                      newFilePath = newPath;
                  } else if (block.filePath.startsWith(`${p}/`)) {
                      newFilePath = newPath + block.filePath.slice(p.length);
                  }
                  if (newFilePath) {
                      updateBlock(block.id, { filePath: newFilePath, title: newFilePath.split('/').pop() });
                  }
              });
          }
          const projData = await window.electronAPI.loadProject(projectRootPath);
          setFileSystemTree(projData.tree);
      } catch (err) {
          logger.error('Failed to move file(s):', err);
          addToast('Failed to move file(s)', 'error');
      }
  }, [projectRootPath, blocks, updateBlock, addToast, setFileSystemTree]);

  const handleCut = useCallback((paths: string[]) => setClipboard({ type: 'cut', paths: new Set(paths) }), [setClipboard]);
  const handleCopy = useCallback((paths: string[]) => setClipboard({ type: 'copy', paths: new Set(paths) }), [setClipboard]);
  const handlePaste = useCallback(async (targetPath: string) => {
      if (!clipboard || !window.electronAPI || !projectRootPath) return;
      try {
          const fullTargetDir = await window.electronAPI.path.join(projectRootPath, targetPath);

          for (const p of clipboard.paths) {
              const fullSource = await window.electronAPI.path.join(projectRootPath, p);
              const fileName = p.split('/').pop() || '';
              const fullDest = await window.electronAPI.path.join(fullTargetDir, fileName);

              if (clipboard.type === 'cut') {
                  await window.electronAPI.moveFile(fullSource, fullDest);
              } else {
                  await window.electronAPI.copyEntry(fullSource, fullDest);
              }
          }

          if (clipboard.type === 'cut') setClipboard(null);
          const projData = await window.electronAPI.loadProject(projectRootPath);
          setFileSystemTree(projData.tree);
      } catch (err) {
          logger.error('Failed to paste:', err);
          addToast('Failed to paste file(s)', 'error');
      }
  }, [clipboard, projectRootPath, addToast, setClipboard, setFileSystemTree]);

  return { handleCreateNode, handleRenameNode, handleDeleteNode, handleMoveNode, handleCut, handleCopy, handlePaste };
}
