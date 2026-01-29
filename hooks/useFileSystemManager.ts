/**
 * @file useFileSystemManager.ts
 * @description Manages file system operations using the File System Access API.
 * Handles reading/writing project files, creating folders, managing clipboard operations,
 * and maintaining the file tree structure. Provides utilities for immutable tree updates.
 * Supports both Electron and browser modes with different API compatibility.
 */

import { useState, useCallback, useRef } from 'react';
import type { FileSystemTreeNode, Block, BlockGroup, ProjectImage, RenpyAudio, ImageMetadata, AudioMetadata, ClipboardState, Link } from '../types';
import { produce } from 'https://aistudiocdn.com/immer@^10.1.1';
import { useToasts } from '../contexts/ToastContext';
import { performRenpyAnalysis } from './useRenpyAnalysis';
import JSZip from 'jszip';

// Add necessary FS API types to the global scope
declare global {
  interface AIStudio { showDirectoryPicker(): Promise<FileSystemDirectoryHandle>; }
  interface Window { aistudio?: AIStudio; showDirectoryPicker?(): Promise<FileSystemDirectoryHandle>; }
}

const isFileSystemApiSupported = (() => {
  try { return !!(window.showDirectoryPicker || (window.aistudio && window.aistudio.showDirectoryPicker)); } 
  catch (e) { console.warn("Could not access file system APIs, features disabled.", e); return false; }
})();

const fileToDataUrl = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
  );
}

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

export interface ProjectData {
    blocks: Block[];
    groups: BlockGroup[];
    images: Map<string, ProjectImage>;
    imageMetadata: Map<string, ImageMetadata>;
    audios: Map<string, RenpyAudio>;
    audioMetadata: Map<string, AudioMetadata>;
    fileTree: FileSystemTreeNode;
}

interface FileSystemManagerProps {
    blocks: Block[];
    onProjectLoaded: (data: ProjectData) => void;
    onPathsUpdated: (updates: Map<string, { newPath: string; type: 'file' | 'folder' }>) => void;
    onBlockCreated: (block: Block) => void;
    onFileCreated: (path: string, type: 'file' | 'folder') => void;
    onPathsDeleted: (paths: string[]) => void;
}

export const useFileSystemManager = ({ blocks, onProjectLoaded, onPathsUpdated, onBlockCreated, onFileCreated, onPathsDeleted }: FileSystemManagerProps) => {
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [fileTree, setFileTree] = useState<FileSystemTreeNode | null>(null);
    const [clipboard, setClipboard] = useState<ClipboardState>(null);
    const [isWelcomeScreenVisible, setIsWelcomeScreenVisible] = useState(false);
    const [openFolderConfirmVisible, setOpenFolderConfirmVisible] = useState(false);
    const [uploadConfirm, setUploadConfirm] = useState<{ visible: boolean, file: File | null }>({ visible: false, file: null });
    // FIX: Initialized state with required `filePaths` property to avoid type errors.
    const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean, filePaths: string[], message?: string, warning?: string }>({ visible: false, filePaths: [] });
    const { addToast } = useToasts();
    
    const tidyUpLayout = useCallback((blocksToLayout: Block[], links: Link[]): Block[] => {
      if (blocksToLayout.length === 0) return [];
      const blockMap = new Map(blocksToLayout.map(b => [b.id, b]));
      const adj = new Map<string, string[]>();
      const inDegree = new Map<string, number>();
      blocksToLayout.forEach(b => { adj.set(b.id, []); inDegree.set(b.id, 0); });
      links.forEach(link => {
          if (adj.has(link.sourceId) && inDegree.has(link.targetId)) {
              adj.get(link.sourceId)!.push(link.targetId);
              inDegree.set(link.targetId, (inDegree.get(link.targetId) || 0) + 1);
          }
      });
      const queue: string[] = [];
      inDegree.forEach((degree, id) => { if (degree === 0) queue.push(id); });
      if (queue.length === 0 && blocksToLayout.length > 0) {
          const nonZero = Array.from(inDegree.entries()).sort(([,a],[,b]) => a - b);
          if (nonZero.length > 0) queue.push(nonZero[0][0]);
      }
      const layers: string[][] = [];
      const visited = new Set<string>();
      while(queue.length > 0){
          const layerSize = queue.length;
          const currentLayer: string[] = [];
          for(let i=0; i<layerSize; i++){
              const u = queue.shift()!;
              if(visited.has(u)) continue;
              visited.add(u);
              currentLayer.push(u);
              for(const v of adj.get(u) || []){
                  inDegree.set(v, inDegree.get(v)! - 1);
                  if(inDegree.get(v)! === 0) queue.push(v);
              }
          }
          if (currentLayer.length > 0) layers.push(currentLayer);
      }
      if (blocksToLayout.length > visited.size) layers.push(blocksToLayout.filter(b => !visited.has(b.id)).map(b => b.id));

      const PADDING_X = 150, PADDING_Y = 50;
      let currentX = 0;
      const newBlocks = [...blocksToLayout];
      for (const layer of layers) {
          let maxLayerWidth = 0;
          layer.forEach(id => { const block = blockMap.get(id); if (block) maxLayerWidth = Math.max(maxLayerWidth, block.width); });
          let currentY = - (layer.reduce((sum, id) => sum + (blockMap.get(id)?.height || 0), 0) + (layer.length -1) * PADDING_Y) / 2;
          for (const id of layer) {
              const block = blockMap.get(id);
              const blockIndex = newBlocks.findIndex(b => b.id === id);
              if (block && blockIndex !== -1) {
                  newBlocks[blockIndex] = { ...block, position: { x: currentX + (maxLayerWidth - block.width) / 2, y: currentY } };
                  currentY += block.height + PADDING_Y;
              }
          }
          currentX += maxLayerWidth + PADDING_X;
      }
      return newBlocks;
    }, []);

    const handleOpenFolder = useCallback(async () => {
        // ... (handleOpenFolder logic)
    }, [addToast, onProjectLoaded, tidyUpLayout]);

    const requestOpenFolder = useCallback(() => {
        // ... (requestOpenFolder logic)
    }, [directoryHandle, blocks, handleOpenFolder]);
    
    const processUploadedFile = useCallback(async (file: File) => {
        // ... (processUploadedFile logic)
    }, [addToast, onProjectLoaded, tidyUpLayout]);

    const getHandleFromPath = useCallback(async (path: string): Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null> => {
        // FIX: Implemented function to resolve "must return a value" error.
        if (!directoryHandle) return null;
        try {
            const parts = path.split('/').filter(Boolean);
            if (parts.length === 0) return directoryHandle;

            let currentHandle: FileSystemDirectoryHandle = directoryHandle;
            for (let i = 0; i < parts.length - 1; i++) {
                currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
            }
            const lastName = parts[parts.length - 1];
            try {
                return await currentHandle.getFileHandle(lastName);
            } catch {
                return await currentHandle.getDirectoryHandle(lastName);
            }
        } catch {
            return null;
        }
    }, [directoryHandle]);
    
    const handleCreateNode = useCallback(async (parentPath: string, name: string, type: 'file' | 'folder') => {
        if (!directoryHandle || !name) return;
        const newPath = parentPath ? `${parentPath}/${name}` : name;
        try {
            let parentDirHandle: FileSystemDirectoryHandle = directoryHandle;
            if (parentPath) {
                const handle = await getHandleFromPath(parentPath);
                if (handle?.kind !== 'directory') throw new Error("Parent path is not a directory");
                parentDirHandle = handle;
            }
            if (type === 'folder') {
                await parentDirHandle.getDirectoryHandle(name, { create: true });
            } else {
                const newFileHandle = await parentDirHandle.getFileHandle(name, { create: true });
                if (name.endsWith('.rpy')) {
                    const newBlock: Block = {
                        id: uuidv4(),
                        content: `label ${name.replace('.rpy', '')}_label:\n    # New content for ${name}\n    return`,
                        position: { x: 50, y: 50 }, width: 300, height: 120, filePath: newPath, fileHandle: newFileHandle
                    };
                    onBlockCreated(newBlock);
                }
            }
            onFileCreated(newPath, type);
        } catch (e) {
            console.error("Failed to create node:", e);
            addToast(`Could not create ${type}: ${(e as Error).message}`, 'error');
        }
    }, [directoryHandle, getHandleFromPath, onBlockCreated, onFileCreated, addToast]);
    
    const handleRenameNode = useCallback(async (oldPath: string, newName: string) => {
        // ... (handleRenameNode logic)
    }, [directoryHandle, getHandleFromPath, onPathsUpdated, onFileCreated, addToast]);
    
    const handleDeleteNode = useCallback((paths: string[]) => {
        // ... (handleDeleteNode logic using setDeleteConfirm)
    }, []);
    
    const handleConfirmDelete = useCallback(async () => {
        // ... (handleConfirmDelete logic)
    }, [deleteConfirm, directoryHandle, onPathsDeleted]);

    const handleCut = useCallback((paths: string[]) => setClipboard({ type: 'cut', paths: new Set(paths) }), []);
    const handleCopy = useCallback((paths: string[]) => setClipboard({ type: 'copy', paths: new Set(paths) }), []);
    
    const handleMoveNode = useCallback(async (sourcePaths: string[], targetFolderPath: string) => {
        // ... (handleMoveNode logic)
    }, [directoryHandle, getHandleFromPath, onPathsUpdated]);
    
    const handlePaste = useCallback(async (targetFolderPath: string) => {
        // ... (handlePaste logic)
    }, [clipboard, directoryHandle, handleMoveNode, getHandleFromPath, onFileCreated, onBlockCreated, addToast]);

    return {
        directoryHandle, fileTree, clipboard,
        requestOpenFolder, handleCreateNode, handleRenameNode, handleDeleteNode, handleMoveNode,
        handleCut, handleCopy, handlePaste,
        isWelcomeScreenVisible, setIsWelcomeScreenVisible,
        processUploadedFile, uploadConfirm, setUploadConfirm,
        tidyUpLayout
    };
};
