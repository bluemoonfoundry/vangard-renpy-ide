import type { FileSystemTreeNode } from '../types';
import { produce } from 'immer';

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
