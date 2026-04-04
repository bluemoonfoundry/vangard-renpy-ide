/**
 * @file FileExplorerPanel.tsx
 * @description Left sidebar panel showing the project file tree structure (452 lines).
 * Displays files and folders hierarchically with expand/collapse navigation.
 * Supports drag-and-drop, context menus (create/rename/delete/cut/copy/paste),
 * file type icons, and visual highlighting of .rpy files.
 * Integrates with file system context for all operations.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useVirtualList } from '../hooks/useVirtualList';

// py-1 (4+4) + h-5 icon (20px) = 28px per row
const TREE_ROW_HEIGHT = 28;
import { createPortal } from 'react-dom';
import type { FileSystemTreeNode } from '../types';
import FileExplorerContextMenu from './FileExplorerContextMenu';
// FIX: Corrected import path for ClipboardState
import type { ClipboardState } from '../types';

const FolderIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
    {isOpen ? (
      <>
        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
        <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
      </>
    ) : (
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    )}
  </svg>
);

const RpyFileIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
);


const FileIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
  </svg>
);



const NewNodeInput: React.FC<{
    type: 'file' | 'folder';
    parentPath: string;
    onCreate: (parentPath: string, name: string, type: 'file' | 'folder') => void;
}> = ({ type, parentPath, onCreate }) => {
    const [name, setName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const submittedRef = useRef(false);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleCreate = () => {
        if (submittedRef.current) return;
        submittedRef.current = true;

        if (name.trim()) {
            onCreate(parentPath, name.trim(), type);
        } else {
             onCreate(parentPath, '', type); // Signal cancellation
        }
    };

    return (
        <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleCreate}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder={type === 'file' ? 'new_file.rpy' : 'new_folder'}
            className="text-sm bg-tertiary border border-accent rounded px-1 h-6 w-full text-primary"
        />
    );
};

interface FlatTreeRowProps {
  node: FileSystemTreeNode;
  depth: number;
  isDirectory: boolean;
  isRpyFile: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  isDragOver: boolean;
  isRenaming: boolean;
  offsetTop: number;
  rowHeight: number;
  onToggleExpand: (path: string) => void;
  onClick: (e: React.MouseEvent, node: FileSystemTreeNode) => void;
  onDoubleClick: (node: FileSystemTreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileSystemTreeNode) => void;
  onDragStart: (e: React.DragEvent, node: FileSystemTreeNode) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRename: (oldPath: string, newName: string) => void;
  onCancelRename: () => void;
}

const FlatTreeRow: React.FC<FlatTreeRowProps> = ({
  node, depth, isDirectory, isRpyFile, isExpanded, isSelected, isDragOver, isRenaming,
  offsetTop, rowHeight,
  onToggleExpand, onClick, onDoubleClick, onContextMenu,
  onDragStart, onDragOver, onDragLeave, onDrop,
  onRename, onCancelRename,
}) => {
  const [inputValue, setInputValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setInputValue(node.name);
    }
  }, [isRenaming, node.name]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const commitRename = () => onRename(node.path, inputValue);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    else if (e.key === 'Escape') { e.preventDefault(); onCancelRename(); }
  };

  return (
    <div
      style={{ position: 'absolute', top: offsetTop, left: 0, right: 0, height: rowHeight, paddingLeft: `${depth * 16}px` }}
      onClick={(e) => onClick(e, node)}
      onDoubleClick={() => onDoubleClick(node)}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, node); }}
      className={`group flex items-center space-x-2 py-1 px-2 rounded cursor-pointer relative text-primary ${
          isDragOver ? 'bg-indigo-200 dark:bg-indigo-900/50' :
          isSelected ? 'bg-accent-light' :
          'hover:bg-tertiary-hover'
      }`}
      draggable={!isRenaming}
      onDragStart={(e) => onDragStart(e, node)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      title={node.path}
    >
      {isDirectory
        ? <FolderIcon isOpen={isExpanded} />
        : (isRpyFile ? <RpyFileIcon /> : <FileIcon />)}
      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          className="text-sm bg-tertiary border border-accent rounded px-1 -ml-1 h-6 w-full text-primary"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="text-sm select-none truncate">{node.name}</span>
      )}
      {isDirectory && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(node.path); }}
          className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-tertiary-hover flex-shrink-0"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg className={`w-3 h-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`} viewBox="0 0 12 12" fill="none">
            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
};

interface FileExplorerPanelProps {
  tree: FileSystemTreeNode | null;
  onFileOpen: (path: string) => void;
  // File Ops
  onCreateNode: (parentPath: string, name: string, type: 'file' | 'folder') => void;
  onRenameNode: (oldPath: string, newName: string) => void;
  onDeleteNode: (paths: string[]) => void;
  onMoveNode: (sourcePaths: string[], targetFolderPath: string) => void;
  // Clipboard
  clipboard: ClipboardState;
  onCut: (paths: string[]) => void;
  onCopy: (paths: string[]) => void;
  onPaste: (targetPath: string) => void;
  onCenterOnBlock: (filePath: string) => void;
  // Selection
  selectedPaths: Set<string>;
  setSelectedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  lastClickedPath: string | null;
  setLastClickedPath: React.Dispatch<React.SetStateAction<string | null>>;
  // Expansion (Lifted State)
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
}

const FileExplorerPanel: React.FC<FileExplorerPanelProps> = ({ 
    tree, onFileOpen, onCreateNode, onRenameNode, onDeleteNode, onMoveNode, 
    clipboard, onCut, onCopy, onPaste, onCenterOnBlock,
    selectedPaths, setSelectedPaths, lastClickedPath, setLastClickedPath,
    expandedPaths, onToggleExpand
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileSystemTreeNode } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<{ path: string, type: 'file' | 'folder' } | null>(null);

  interface FlatNode { node: FileSystemTreeNode; depth: number; }

  const flatVisibleNodes = useMemo((): FlatNode[] => {
      if (!tree) return [];
      const flatList: FlatNode[] = [];
      const traverse = (node: FileSystemTreeNode, depth: number) => {
          flatList.push({ node, depth });
          if (node.children && expandedPaths.has(node.path)) {
              node.children.forEach(child => traverse(child, depth + 1));
          }
      };
      tree.children?.forEach(child => traverse(child, 0));
      return flatList;
  }, [tree, expandedPaths]);

  // Used by shift-click range selection — plain node list without depth
  const flatVisibleNodesForSelection = useMemo(() => flatVisibleNodes.map(fn => fn.node), [flatVisibleNodes]);

  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const handleContextMenu = (event: React.MouseEvent, node: FileSystemTreeNode) => {
    if (!selectedPaths.has(node.path)) {
        setSelectedPaths(new Set([node.path]));
        setLastClickedPath(node.path);
    }
    setContextMenu({ x: event.clientX, y: event.clientY, node });
  };
  
  const handleStartRename = (path: string) => {
    setRenamingPath(path);
    setContextMenu(null);
  };
  
  const handleRename = (oldPath: string, newName: string) => {
    if (renamingPath === oldPath && oldPath.split('/').pop() !== newName) {
        onRenameNode(oldPath, newName);
    }
    setRenamingPath(null);
  };
  
  const handleCreate = (parentPath: string, name: string, type: 'file' | 'folder') => {
      if (name) {
          onCreateNode(parentPath, name, type);
      }
      setCreatingIn(null);
  };

  const handleStartCreate = (parentPath: string, type: 'file' | 'folder') => {
      setCreatingIn({ path: parentPath, type });
      setContextMenu(null);
      // Force expand parent
      if(!expandedPaths.has(parentPath)) {
          onToggleExpand(parentPath);
      }
  };

  // Flat list with optional "new node" input entry injected after its parent
  type FlatEntry = FlatNode | { type: 'new-node-input'; depth: number; parentPath: string; nodeType: 'file' | 'folder' };

  const flatEntries = useMemo((): FlatEntry[] => {
      if (!creatingIn) return flatVisibleNodes;
      const result: FlatEntry[] = [];
      for (const fn of flatVisibleNodes) {
          result.push(fn);
          // Insert input after the last visible child of the creating parent
          if (fn.node.path === creatingIn.path) {
              result.push({ type: 'new-node-input', depth: fn.depth + 1, parentPath: creatingIn.path, nodeType: creatingIn.type });
          }
      }
      return result;
  }, [flatVisibleNodes, creatingIn]);

  const { containerRef: treeContainerRef, handleScroll: treeHandleScroll, virtualItems: treeVirtualItems, totalHeight: treeTotalHeight } = useVirtualList(flatEntries, TREE_ROW_HEIGHT);

  const handleRowClick = useCallback((e: React.MouseEvent, node: FileSystemTreeNode) => {
      e.stopPropagation();
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (e.shiftKey && lastClickedPath && lastClickedPath !== node.path) {
          const lastIndex = flatVisibleNodesForSelection.findIndex(n => n.path === lastClickedPath);
          const currentIndex = flatVisibleNodesForSelection.findIndex(n => n.path === node.path);
          if (lastIndex !== -1 && currentIndex !== -1) {
              const start = Math.min(lastIndex, currentIndex);
              const end = Math.max(lastIndex, currentIndex);
              const rangePaths = flatVisibleNodesForSelection.slice(start, end + 1).map(n => n.path);
              if (isCtrlOrCmd) {
                  setSelectedPaths(prev => new Set([...prev, ...rangePaths]));
              } else {
                  setSelectedPaths(new Set(rangePaths));
              }
          }
      } else if (isCtrlOrCmd) {
          setSelectedPaths(prev => {
              const newSet = new Set(prev);
              if (newSet.has(node.path)) newSet.delete(node.path);
              else newSet.add(node.path);
              return newSet;
          });
          setLastClickedPath(node.path);
      } else {
          setSelectedPaths(new Set([node.path]));
          setLastClickedPath(node.path);
      }
  }, [lastClickedPath, flatVisibleNodesForSelection, setSelectedPaths, setLastClickedPath]);

  const handleRowDoubleClick = useCallback((node: FileSystemTreeNode) => {
      if (node.children) onToggleExpand(node.path);
      else onFileOpen(node.path);
  }, [onToggleExpand, onFileOpen]);

  const handleDragStart = useCallback((e: React.DragEvent, node: FileSystemTreeNode) => {
      e.stopPropagation();
      let pathsToDrag: string[];
      if (selectedPaths.has(node.path)) {
          pathsToDrag = Array.from(selectedPaths);
      } else {
          pathsToDrag = [node.path];
          setSelectedPaths(new Set(pathsToDrag));
          setLastClickedPath(node.path);
      }
      e.dataTransfer.setData('application/renpy-visual-editor-paths', JSON.stringify(pathsToDrag));
      e.dataTransfer.effectAllowed = 'move';
  }, [selectedPaths, setSelectedPaths, setLastClickedPath]);

  const handleDrop = useCallback((e: React.DragEvent, node: FileSystemTreeNode) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverPath(null);
      if (!node.children) return;
      try {
          const sourcePaths = JSON.parse(e.dataTransfer.getData('application/renpy-visual-editor-paths'));
          if (Array.isArray(sourcePaths) && sourcePaths.length > 0) {
              if (sourcePaths.some(p => node.path.startsWith(p) && node.path.length > p.length)) return;
              onMoveNode(sourcePaths, node.path);
          }
      } catch { /* ignore */ }
  }, [onMoveNode]);

  return (
    <aside className="w-full h-full bg-secondary flex flex-col z-10 text-primary" onClick={() => { setContextMenu(null); setSelectedPaths(new Set()); }}>
      <div className="flex-none p-4 border-b border-primary">
        <h2 className="text-xl font-bold">Project Explorer</h2>
      </div>
      <div
        ref={treeContainerRef}
        className="flex-1 min-h-0 p-2 overflow-y-auto overscroll-contain"
        onScroll={treeHandleScroll}
        onContextMenu={(e) => {
            e.preventDefault();
            if(tree) handleContextMenu(e, tree);
        }}
      >
        {tree && tree.children ? (
            <div style={{ height: treeTotalHeight, position: 'relative' }}>
                {treeVirtualItems.map(({ item: entry, offsetTop }) => {
                    // New-node input row
                    if ('type' in entry && entry.type === 'new-node-input') {
                        return (
                            <div
                                key="new-node-input"
                                style={{ position: 'absolute', top: offsetTop, left: 0, right: 0, height: TREE_ROW_HEIGHT, paddingLeft: `${(entry.depth * 16) + 8}px` }}
                                className="py-1 px-2"
                            >
                                <NewNodeInput
                                    type={entry.nodeType}
                                    parentPath={entry.parentPath}
                                    onCreate={handleCreate}
                                />
                            </div>
                        );
                    }
                    // Regular tree row
                    const { node, depth } = entry as FlatNode;
                    const isDirectory = !!node.children;
                    const isRpyFile = node.name.endsWith('.rpy');
                    const isExpanded = expandedPaths.has(node.path);
                    const isSelected = selectedPaths.has(node.path);
                    const isDragOver = dragOverPath === node.path;
                    const isRenaming = renamingPath === node.path;
                    return (
                        <FlatTreeRow
                            key={node.path}
                            node={node}
                            depth={depth}
                            isDirectory={isDirectory}
                            isRpyFile={isRpyFile}
                            isExpanded={isExpanded}
                            isSelected={isSelected}
                            isDragOver={isDragOver}
                            isRenaming={isRenaming}
                            offsetTop={offsetTop}
                            rowHeight={TREE_ROW_HEIGHT}
                            onToggleExpand={onToggleExpand}
                            onClick={handleRowClick}
                            onDoubleClick={handleRowDoubleClick}
                            onContextMenu={handleContextMenu}
                            onDragStart={handleDragStart}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (isDirectory) setDragOverPath(node.path); }}
                            onDragLeave={(e) => { e.stopPropagation(); setDragOverPath(null); }}
                            onDrop={(e) => handleDrop(e, node)}
                            onRename={handleRename}
                            onCancelRename={() => setRenamingPath(null)}
                        />
                    );
                })}
            </div>
        ) : (
          <p className="text-sm text-secondary text-center py-4 px-2">
            Open a project folder to see files here.
          </p>
        )}
      </div>
      {contextMenu && createPortal(
        <FileExplorerContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={contextMenu.node}
            clipboard={clipboard}
            selectionSize={selectedPaths.size}
            onClose={() => setContextMenu(null)}
            onNewFile={(path) => handleStartCreate(path, 'file')}
            onNewFolder={(path) => handleStartCreate(path, 'folder')}
            onRename={handleStartRename}
            onDelete={() => onDeleteNode(Array.from(selectedPaths))}
            onCut={() => onCut(Array.from(selectedPaths))}
            onCopy={() => onCopy(Array.from(selectedPaths))}
            onPaste={onPaste}
            onCenterOnBlock={onCenterOnBlock}
        />,
        document.body
      )}
    </aside>
  );
};

export default FileExplorerPanel;
