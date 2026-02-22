/**
 * @file hooks/useFileSystemManager.test.ts
 * @description Tests for the pure utility functions exported from useFileSystemManager:
 * addNodeToFileTree and removeNodeFromFileTree.
 *
 * Note: Both functions start at the root node and traverse children by name
 * for each path segment. Paths should NOT include the root node name.
 */

import { addNodeToFileTree, removeNodeFromFileTree } from './useFileSystemManager';
import type { FileSystemTreeNode } from '../types';

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
