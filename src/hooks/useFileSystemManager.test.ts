/**
 * @file hooks/useFileSystemManager.test.ts
 * @description Tests for the pure utility functions exported from useFileSystemManager:
 * addNodeToFileTree and removeNodeFromFileTree.
 *
 * Also tests the hook's CRUD operations (handleCreateNode, handleRenameNode,
 * handleDeleteNode, handleCut, handleCopy, handlePaste, handleMoveNode) via renderHook.
 *
 * Note: Both functions start at the root node and traverse children by name
 * for each path segment. Paths should NOT include the root node name.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { addNodeToFileTree, removeNodeFromFileTree, useFileSystemManager } from './useFileSystemManager';
import type { FileSystemTreeNode } from '@/types';
import type { UseFileSystemManagerParams } from './useFileSystemManager';
import { createMockElectronAPI, installElectronAPI, uninstallElectronAPI } from '@/test/mocks/electronAPI';
import { createBlock } from '@/test/mocks/sampleData';

/** Helper: create a minimal tree for testing. */
function makeTree(): FileSystemTreeNode {
  return {
    name: 'game',
    path: 'game',
    children: [
      {
        name: 'images',
        path: 'images',
        children: [
          { name: 'bg.png', path: 'images/bg.png' },
        ],
      },
      { name: 'script.rpy', path: 'script.rpy' },
    ],
  };
}

// ===========================================================================
// addNodeToFileTree
// ===========================================================================

describe('addNodeToFileTree', () => {
  it('adds a file to an existing directory', () => {
    const tree = makeTree();
    const result = addNodeToFileTree(tree, 'chapter1.rpy');

    const gameChildren = result.children!;
    expect(gameChildren.some(c => c.name === 'chapter1.rpy')).toBe(true);
  });

  it('adds a folder node when type is folder', () => {
    const tree = makeTree();
    const result = addNodeToFileTree(tree, 'audio', 'folder');

    const audioNode = result.children!.find(c => c.name === 'audio');
    expect(audioNode).toBeDefined();
    expect(audioNode!.children).toEqual([]);
  });

  it('creates intermediate parent directories', () => {
    const tree = makeTree();
    const result = addNodeToFileTree(tree, 'characters/eileen/sprite.png');

    const characters = result.children!.find(c => c.name === 'characters');
    expect(characters).toBeDefined();
    expect(characters!.children).toBeDefined();

    const eileen = characters!.children!.find(c => c.name === 'eileen');
    expect(eileen).toBeDefined();
    expect(eileen!.children).toBeDefined();

    const sprite = eileen!.children!.find(c => c.name === 'sprite.png');
    expect(sprite).toBeDefined();
    // Leaf file should not have children
    expect(sprite!.children).toBeUndefined();
  });

  it('returns the same tree if the path already exists', () => {
    const tree = makeTree();
    const result = addNodeToFileTree(tree, 'script.rpy');
    // Should return original since node exists (checkIfExists matches node.path)
    expect(result).toBe(tree);
  });

  it('sorts children: folders first, then alphabetically', () => {
    const tree = makeTree();
    // Add files that would sort before and after existing entries
    let result = addNodeToFileTree(tree, 'aaa.rpy');
    result = addNodeToFileTree(result, 'zzz.rpy');
    result = addNodeToFileTree(result, 'audio', 'folder');

    const names = result.children!.map(c => c.name);
    // Folders should come first (audio, images), then files alphabetically
    const folderNames = result.children!.filter(c => c.children).map(c => c.name);
    const fileNames = result.children!.filter(c => !c.children).map(c => c.name);

    // All folders before all files
    const lastFolderIndex = names.lastIndexOf(folderNames[folderNames.length - 1]);
    const firstFileIndex = names.indexOf(fileNames[0]);
    expect(lastFolderIndex).toBeLessThan(firstFileIndex);

    // Folders sorted alphabetically
    expect(folderNames).toEqual([...folderNames].sort());
    // Files sorted alphabetically
    expect(fileNames).toEqual([...fileNames].sort());
  });

  it('does not mutate the original tree (immutable)', () => {
    const tree = makeTree();
    const originalChildCount = tree.children!.length;

    addNodeToFileTree(tree, 'new_file.rpy');

    expect(tree.children!.length).toBe(originalChildCount);
  });
});

// ===========================================================================
// removeNodeFromFileTree
// ===========================================================================

describe('removeNodeFromFileTree', () => {
  it('removes an existing file', () => {
    const tree = makeTree();
    const result = removeNodeFromFileTree(tree, 'script.rpy');

    expect(result!.children!.some(c => c.name === 'script.rpy')).toBe(false);
  });

  it('removes a nested file', () => {
    const tree = makeTree();
    const result = removeNodeFromFileTree(tree, 'images/bg.png');

    const images = result!.children!.find(c => c.name === 'images');
    expect(images!.children!.some(c => c.name === 'bg.png')).toBe(false);
  });

  it('does nothing when path does not exist', () => {
    const tree = makeTree();
    const result = removeNodeFromFileTree(tree, 'nonexistent.rpy');

    // Tree should be structurally unchanged
    expect(result!.children!.length).toBe(tree.children!.length);
  });

  it('returns null for null input', () => {
    const result = removeNodeFromFileTree(null, 'some/path');
    expect(result).toBeNull();
  });

  it('does not mutate the original tree (immutable)', () => {
    const tree = makeTree();
    const originalChildCount = tree.children!.length;

    removeNodeFromFileTree(tree, 'script.rpy');

    expect(tree.children!.length).toBe(originalChildCount);
  });

  it('removes a directory node', () => {
    const tree = makeTree();
    const result = removeNodeFromFileTree(tree, 'images');

    expect(result!.children!.some(c => c.name === 'images')).toBe(false);
  });
});

// ===========================================================================
// useFileSystemManager hook — CRUD operations via renderHook
// ===========================================================================

function makeHookParams(overrides: Partial<UseFileSystemManagerParams> = {}): UseFileSystemManagerParams {
  return {
    projectRootPath: '/project',
    setFileSystemTree: vi.fn(),
    blocks: [],
    addBlock: vi.fn(),
    updateBlock: vi.fn(),
    clipboard: null,
    setClipboard: vi.fn(),
    openDeleteConfirmModal: vi.fn(),
    addToast: vi.fn(),
    handleRefreshProject: vi.fn(),
    ...overrides,
  };
}

describe('useFileSystemManager — handleCreateNode', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    api = createMockElectronAPI();
    installElectronAPI(api);
  });

  afterEach(() => {
    uninstallElectronAPI();
  });

  it('creates a folder via createDirectory IPC and refreshes tree', async () => {
    const setFileSystemTree = vi.fn();
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ setFileSystemTree }))
    );
    await act(async () => {
      await result.current.handleCreateNode('game', 'audio', 'folder');
    });
    expect(api.createDirectory).toHaveBeenCalled();
    expect(api.loadProject).toHaveBeenCalled();
    expect(setFileSystemTree).toHaveBeenCalled();
  });

  it('creates a non-rpy file via writeFile IPC', async () => {
    const { result } = renderHook(() => useFileSystemManager(makeHookParams()));
    await act(async () => {
      await result.current.handleCreateNode('game', 'notes.txt', 'file');
    });
    expect(api.writeFile).toHaveBeenCalled();
  });

  it('creates a block when creating an .rpy file', async () => {
    const addBlock = vi.fn();
    const addToast = vi.fn();
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ addBlock, addToast }))
    );
    await act(async () => {
      await result.current.handleCreateNode('game', 'chapter2.rpy', 'file');
    });
    expect(addBlock).toHaveBeenCalledWith('game/chapter2.rpy', '', undefined, { markDirty: false });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('chapter2.rpy'), 'success');
  });

  it('shows error toast and does not throw when IPC fails', async () => {
    const addToast = vi.fn();
    api.writeFile.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ addToast }))
    );
    await act(async () => {
      await result.current.handleCreateNode('game', 'fail.rpy', 'file');
    });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('Failed'), 'error');
  });

  it('is a no-op when projectRootPath is null', async () => {
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ projectRootPath: null }))
    );
    await act(async () => {
      await result.current.handleCreateNode('game', 'new.rpy', 'file');
    });
    expect(api.writeFile).not.toHaveBeenCalled();
  });

  it('returns the new block id and relative path when creating an .rpy file', async () => {
    const addBlock = vi.fn(() => 'new-block-id');
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ addBlock }))
    );

    let created;
    await act(async () => {
      created = await result.current.handleCreateNode('game', 'chapter_two.rpy', 'file');
    });

    expect(created).toEqual({ blockId: 'new-block-id', relativePath: 'game/chapter_two.rpy' });
  });

  it('returns a null blockId when creating a non-.rpy file', async () => {
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams())
    );

    let created;
    await act(async () => {
      created = await result.current.handleCreateNode('game', 'notes.txt', 'file');
    });

    expect(created).toEqual({ blockId: null, relativePath: 'game/notes.txt' });
  });
});

describe('useFileSystemManager — handleRenameNode', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    api = createMockElectronAPI();
    installElectronAPI(api);
  });

  afterEach(() => {
    uninstallElectronAPI();
  });

  it('calls moveFile IPC and refreshes tree', async () => {
    const setFileSystemTree = vi.fn();
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ setFileSystemTree }))
    );
    await act(async () => {
      await result.current.handleRenameNode('game/script.rpy', 'chapter1.rpy');
    });
    expect(api.moveFile).toHaveBeenCalled();
    expect(setFileSystemTree).toHaveBeenCalled();
  });

  it('shows error toast when moveFile fails', async () => {
    const addToast = vi.fn();
    api.moveFile.mockRejectedValue(new Error('locked'));
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ addToast }))
    );
    await act(async () => {
      await result.current.handleRenameNode('game/script.rpy', 'newname.rpy');
    });
    expect(addToast).toHaveBeenCalledWith('Failed to rename file', 'error');
  });

  it('updates the filePath/title of the block matching the renamed file', async () => {
    const updateBlock = vi.fn();
    const block = createBlock({ id: 'block-1', filePath: 'game/script.rpy', title: 'script.rpy' });
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ blocks: [block], updateBlock }))
    );
    await act(async () => {
      await result.current.handleRenameNode('game/script.rpy', 'chapter1.rpy');
    });
    expect(updateBlock).toHaveBeenCalledWith('block-1', { filePath: 'game/chapter1.rpy', title: 'chapter1.rpy' });
  });

  it('updates filePaths of descendant blocks when a folder is renamed', async () => {
    const updateBlock = vi.fn();
    const blockA = createBlock({ id: 'block-a', filePath: 'game/chapter1/scene1.rpy', title: 'scene1.rpy' });
    const blockB = createBlock({ id: 'block-b', filePath: 'game/chapter1/scene2.rpy', title: 'scene2.rpy' });
    const unrelated = createBlock({ id: 'block-c', filePath: 'game/other.rpy', title: 'other.rpy' });
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ blocks: [blockA, blockB, unrelated], updateBlock }))
    );
    await act(async () => {
      await result.current.handleRenameNode('game/chapter1', 'chapter1-renamed');
    });
    expect(updateBlock).toHaveBeenCalledWith('block-a', { filePath: 'game/chapter1-renamed/scene1.rpy', title: 'scene1.rpy' });
    expect(updateBlock).toHaveBeenCalledWith('block-b', { filePath: 'game/chapter1-renamed/scene2.rpy', title: 'scene2.rpy' });
    expect(updateBlock).not.toHaveBeenCalledWith('block-c', expect.anything());
  });

  it('does not call updateBlock when no block matches the renamed path', async () => {
    const updateBlock = vi.fn();
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ blocks: [], updateBlock }))
    );
    await act(async () => {
      await result.current.handleRenameNode('game/untracked.txt', 'renamed.txt');
    });
    expect(updateBlock).not.toHaveBeenCalled();
  });
});

describe('useFileSystemManager — handleDeleteNode', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    api = createMockElectronAPI();
    installElectronAPI(api);
  });

  afterEach(() => {
    uninstallElectronAPI();
  });

  it('calls openDeleteConfirmModal with the paths', () => {
    const openDeleteConfirmModal = vi.fn();
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ openDeleteConfirmModal }))
    );
    act(() => result.current.handleDeleteNode(['game/script.rpy']));
    expect(openDeleteConfirmModal).toHaveBeenCalledWith(
      ['game/script.rpy'],
      expect.any(Function)
    );
  });

  it('removes the file via IPC and reconciles project state on confirm', async () => {
    const handleRefreshProject = vi.fn();
    const openDeleteConfirmModal = vi.fn((_paths: string[], onConfirm: () => void) => {
      onConfirm(); // simulate user confirming
    });
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ handleRefreshProject, openDeleteConfirmModal }))
    );
    await act(async () => {
      result.current.handleDeleteNode(['game/script.rpy']);
    });
    expect(api.removeEntry).toHaveBeenCalled();
    // Reconciliation (blocks/tabs/images/audios) is delegated to a single
    // full refresh so deleted images/audios also disappear from the Story
    // Elements pane, not just deleted .rpy blocks.
    expect(handleRefreshProject).toHaveBeenCalled();
  });

  it('shows an error toast when the delete IPC call fails', async () => {
    const addToast = vi.fn();
    api.removeEntry.mockRejectedValue(new Error('locked'));
    const openDeleteConfirmModal = vi.fn((_paths: string[], onConfirm: () => void) => {
      onConfirm();
    });
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ addToast, openDeleteConfirmModal }))
    );
    await act(async () => {
      result.current.handleDeleteNode(['game/script.rpy']);
    });
    expect(addToast).toHaveBeenCalledWith('Failed to delete file(s)', 'error');
  });
});

describe('useFileSystemManager — handleCut / handleCopy', () => {
  beforeEach(() => {
    installElectronAPI(createMockElectronAPI());
  });

  afterEach(() => {
    uninstallElectronAPI();
  });

  it('handleCut sets clipboard with cut type', () => {
    const setClipboard = vi.fn();
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ setClipboard }))
    );
    act(() => result.current.handleCut(['game/a.rpy']));
    expect(setClipboard).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cut' })
    );
  });

  it('handleCopy sets clipboard with copy type', () => {
    const setClipboard = vi.fn();
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ setClipboard }))
    );
    act(() => result.current.handleCopy(['game/a.rpy', 'game/b.rpy']));
    expect(setClipboard).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'copy' })
    );
  });
});

describe('useFileSystemManager — handlePaste', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    api = createMockElectronAPI();
    installElectronAPI(api);
  });

  afterEach(() => {
    uninstallElectronAPI();
  });

  it('is a no-op when clipboard is null', async () => {
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ clipboard: null }))
    );
    await act(async () => {
      await result.current.handlePaste('game/audio');
    });
    expect(api.moveFile).not.toHaveBeenCalled();
    expect(api.copyEntry).not.toHaveBeenCalled();
  });

  it('calls copyEntry for copy-type clipboard', async () => {
    const setFileSystemTree = vi.fn();
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({
        setFileSystemTree,
        clipboard: { type: 'copy', paths: new Set(['game/a.rpy']) },
      }))
    );
    await act(async () => {
      await result.current.handlePaste('game/backup');
    });
    expect(api.copyEntry).toHaveBeenCalled();
    expect(setFileSystemTree).toHaveBeenCalled();
  });

  it('calls moveFile and clears clipboard for cut-type clipboard', async () => {
    const setClipboard = vi.fn();
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({
        setClipboard,
        clipboard: { type: 'cut', paths: new Set(['game/a.rpy']) },
      }))
    );
    await act(async () => {
      await result.current.handlePaste('game/backup');
    });
    expect(api.moveFile).toHaveBeenCalled();
    expect(setClipboard).toHaveBeenCalledWith(null);
  });

  it('shows error toast when paste fails', async () => {
    const addToast = vi.fn();
    api.copyEntry.mockRejectedValue(new Error('permission denied'));
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({
        addToast,
        clipboard: { type: 'copy', paths: new Set(['game/a.rpy']) },
      }))
    );
    await act(async () => {
      await result.current.handlePaste('game/backup');
    });
    expect(addToast).toHaveBeenCalledWith('Failed to paste file(s)', 'error');
  });
});

describe('useFileSystemManager — handleMoveNode', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    api = createMockElectronAPI();
    installElectronAPI(api);
  });

  afterEach(() => {
    uninstallElectronAPI();
  });

  it('calls moveFile for each source path', async () => {
    const setFileSystemTree = vi.fn();
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ setFileSystemTree }))
    );
    await act(async () => {
      await result.current.handleMoveNode(['game/a.rpy', 'game/b.rpy'], 'game/archive');
    });
    expect(api.moveFile).toHaveBeenCalledTimes(2);
    expect(setFileSystemTree).toHaveBeenCalled();
  });

  it('shows error toast when move fails', async () => {
    const addToast = vi.fn();
    api.moveFile.mockRejectedValue(new Error('io error'));
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ addToast }))
    );
    await act(async () => {
      await result.current.handleMoveNode(['game/a.rpy'], 'game/archive');
    });
    expect(addToast).toHaveBeenCalledWith('Failed to move file(s)', 'error');
  });

  it('updates the filePath/title of the block matching the moved file', async () => {
    const updateBlock = vi.fn();
    const block = createBlock({ id: 'block-1', filePath: 'game/a.rpy', title: 'a.rpy' });
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ blocks: [block], updateBlock }))
    );
    await act(async () => {
      await result.current.handleMoveNode(['game/a.rpy'], 'game/archive');
    });
    expect(updateBlock).toHaveBeenCalledWith('block-1', { filePath: 'game/archive/a.rpy', title: 'a.rpy' });
  });

  it('updates filePaths of descendant blocks when a folder is moved', async () => {
    const updateBlock = vi.fn();
    const blockA = createBlock({ id: 'block-a', filePath: 'game/chapter1/scene1.rpy', title: 'scene1.rpy' });
    const unrelated = createBlock({ id: 'block-c', filePath: 'game/other.rpy', title: 'other.rpy' });
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ blocks: [blockA, unrelated], updateBlock }))
    );
    await act(async () => {
      await result.current.handleMoveNode(['game/chapter1'], 'game/archive');
    });
    expect(updateBlock).toHaveBeenCalledWith('block-a', { filePath: 'game/archive/chapter1/scene1.rpy', title: 'scene1.rpy' });
    expect(updateBlock).not.toHaveBeenCalledWith('block-c', expect.anything());
  });

  it('does not call updateBlock when no block matches the moved path', async () => {
    const updateBlock = vi.fn();
    const { result } = renderHook(() =>
      useFileSystemManager(makeHookParams({ blocks: [], updateBlock }))
    );
    await act(async () => {
      await result.current.handleMoveNode(['game/untracked.txt'], 'game/archive');
    });
    expect(updateBlock).not.toHaveBeenCalled();
  });
});
