

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { FileSystemTreeNode } from '../types';
import FileExplorerContextMenu from './FileExplorerContextMenu';
// FIX: Corrected import path for ClipboardState
import type { ClipboardState } from '../types';

const FolderIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
    {isOpen ? (
      <path d="M4 8V6a2 2 0 012-2h2l2 2h5a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-2" />
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


interface TreeNodeProps {
  node: FileSystemTreeNode;
  onFileOpen: (path: string) => void;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  level: number;
  onContextMenu: (event: React.MouseEvent, node: FileSystemTreeNode) => void;
  renamingPath: string | null;
  startRename: (path: string) => void;
  onRename: (oldPath: string, newName: string) => void;
  onMove: (sourcePaths: string[], targetFolderPath: string) => void;
  creatingIn: { path: string, type: 'file' | 'folder' } | null;
  onCreate: (parentPath: string, name: string, type: 'file' | 'folder') => void;
  onCenterOnBlock: (filePath: string) => void;
  // Selection props
  selectedPaths: Set<string>;
  setSelectedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  lastClickedPath: string | null;
  setLastClickedPath: React.Dispatch<React.SetStateAction<string | null>>;
  flatVisibleNodes: FileSystemTreeNode[];
}

const TreeNode: React.FC<TreeNodeProps> = ({ 
  node, onFileOpen, expandedPaths, toggleExpand, level, onContextMenu, 
  renamingPath, startRename, onRename, onMove, creatingIn, onCreate, onCenterOnBlock,
  selectedPaths, setSelectedPaths, lastClickedPath, setLastClickedPath, flatVisibleNodes 
}) => {
  const isDirectory = !!node.children;
  const isExpanded = expandedPaths.has(node.path);
  const isRpyFile = node.name.endsWith('.rpy');
  const [isRenaming, setIsRenaming] = useState(false);
  const [inputValue, setInputValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isSelected = selectedPaths.has(node.path);

  useEffect(() => {
    if (renamingPath === node.path) {
      setIsRenaming(true);
      setInputValue(node.name);
    } else {
      setIsRenaming(false);
    }
  }, [renamingPath, node.path, node.name]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleDoubleClick = () => {
    if (!isDirectory && isRpyFile) {
      onFileOpen(node.path);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
  
      if (e.shiftKey && lastClickedPath && lastClickedPath !== node.path) {
          const lastIndex = flatVisibleNodes.findIndex(n => n.path === lastClickedPath);
          const currentIndex = flatVisibleNodes.findIndex(n => n.path === node.path);
          if (lastIndex !== -1 && currentIndex !== -1) {
              const start = Math.min(lastIndex, currentIndex);
              const end = Math.max(lastIndex, currentIndex);
              const rangePaths = flatVisibleNodes.slice(start, end + 1).map(n => n.path);
              
              if (isCtrlOrCmd) {
                  setSelectedPaths(prev => new Set([...prev, ...rangePaths]));
              } else {
                  setSelectedPaths(new Set(rangePaths));
              }
          }
      } else if (isCtrlOrCmd) {
          setSelectedPaths(prev => {
              const newSet = new Set(prev);
              if (newSet.has(node.path)) {
                  newSet.delete(node.path);
              } else {
                  newSet.add(node.path);
              }
              return newSet;
          });
          setLastClickedPath(node.path);
      } else {
          setSelectedPaths(new Set([node.path]));
          setLastClickedPath(node.path);
      }
  
      if (isDirectory) {
          toggleExpand(node.path);
      }
  };

  const handleRenameBlur = () => {
    if (isRenaming) {
      onRename(node.path, inputValue);
      setIsRenaming(false);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameBlur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsRenaming(false);
      startRename(''); // Cancel rename
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
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
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDirectory) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!isDirectory) return;

    try {
        const sourcePaths = JSON.parse(e.dataTransfer.getData('application/renpy-visual-editor-paths'));
        if (Array.isArray(sourcePaths) && sourcePaths.length > 0) {
            // Prevent dropping a folder into itself or its descendants
            if (sourcePaths.some(p => node.path.startsWith(p) && node.path.length > p.length)) {
                return;
            }
            onMove(sourcePaths, node.path);
        }
    } catch (err) {
        console.error("Error handling drop:", err);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, node); }}
        style={{ paddingLeft: `${level * 16}px` }}
        className={`group flex items-center space-x-2 py-1 px-2 rounded cursor-pointer relative ${
            isDragOver ? 'bg-indigo-200 dark:bg-indigo-900/50' : 
            isSelected ? 'bg-indigo-100 dark:bg-indigo-900/50' : 
            'hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title={node.path}
      >
        {isDirectory ? <FolderIcon isOpen={isExpanded} /> : (isRpyFile ? <RpyFileIcon /> : <FileIcon />)}
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onBlur={handleRenameBlur}
            onKeyDown={handleRenameKeyDown}
            className="text-sm bg-white dark:bg-gray-600 border border-indigo-500 rounded px-1 -ml-1 h-6 w-full"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm select-none truncate">{node.name}</span>
        )}
      </div>
      {isDirectory && isExpanded && (
        <div>
          {node.children!.map(child => (
            <TreeNode key={child.path} {...{ 
                node: child, onFileOpen, expandedPaths, toggleExpand, level: level + 1, onContextMenu, 
                renamingPath, startRename, onRename, onMove, creatingIn, onCreate, onCenterOnBlock,
                selectedPaths, setSelectedPaths, lastClickedPath, setLastClickedPath, flatVisibleNodes
            }} />
          ))}
           {creatingIn && creatingIn.path === node.path && (
            <NewNodeInput
                type={creatingIn.type}
                parentPath={node.path}
                level={level + 1}
                onCreate={onCreate}
            />
           )}
        </div>
      )}
    </div>
  );
};

const NewNodeInput: React.FC<{
    type: 'file' | 'folder';
    parentPath: string;
    level: number;
    onCreate: (parentPath: string, name: string, type: 'file' | 'folder') => void;
}> = ({ type, parentPath, level, onCreate }) => {
    const [name, setName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleCreate = () => {
        if (name.trim()) {
            onCreate(parentPath, name.trim(), type);
        } else {
             onCreate(parentPath, '', type); // Signal cancellation
        }
    };

    return (
        <div style={{ paddingLeft: `${(level * 16) + 28}px` }} className="py-1 px-2">
            <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={handleCreate}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder={type === 'file' ? 'new_file.rpy' : 'new_folder'}
                className="text-sm bg-white dark:bg-gray-600 border border-indigo-500 rounded px-1 h-6 w-full"
            />
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
}

const FileExplorerPanel: React.FC<FileExplorerPanelProps> = ({ tree, onFileOpen, onCreateNode, onRenameNode, onDeleteNode, onMoveNode, clipboard, onCut, onCopy, onPaste, onCenterOnBlock }) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileSystemTreeNode } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<{ path: string, type: 'file' | 'folder' } | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastClickedPath, setLastClickedPath] = useState<string | null>(null);

  const flatVisibleNodes = useMemo(() => {
      if (!tree) return [];
      const flatList: FileSystemTreeNode[] = [];
      const traverse = (node: FileSystemTreeNode) => {
          flatList.push(node);
          if (node.children && expandedPaths.has(node.path)) {
              node.children.forEach(traverse);
          }
      };
      tree.children?.forEach(traverse);
      return flatList;
  }, [tree, expandedPaths]);

  useEffect(() => {
    if (tree) {
        const newExpanded = new Set([tree.path]);
        const gameDir = tree.children?.find(c => c.name === 'game');
        if(gameDir) newExpanded.add(gameDir.path);
        setExpandedPaths(newExpanded);
    }
  }, [tree]);

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) newSet.delete(path);
      else newSet.add(path);
      return newSet;
    });
  };

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
      setExpandedPaths(prev => new Set(prev).add(parentPath));
  };

  return (
    <aside className="w-full h-full bg-white dark:bg-gray-800 flex flex-col z-10" onClick={() => { setContextMenu(null); setSelectedPaths(new Set()); }}>
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold">Project Explorer</h2>
      </div>
      <div className="flex-grow p-2 overflow-y-auto" onContextMenu={(e) => {
            e.preventDefault();
            if(tree) handleContextMenu(e, tree);
        }}>
        {tree && tree.children ? (
            tree.children?.map(child => (
              <TreeNode 
                key={child.path} 
                node={child} 
                onFileOpen={onFileOpen}
                expandedPaths={expandedPaths} 
                toggleExpand={toggleExpand} 
                level={0}
                onContextMenu={handleContextMenu}
                renamingPath={renamingPath}
                startRename={handleStartRename}
                onRename={handleRename}
                onMove={onMoveNode}
                creatingIn={creatingIn}
                onCreate={handleCreate}
                onCenterOnBlock={onCenterOnBlock}
                selectedPaths={selectedPaths}
                setSelectedPaths={setSelectedPaths}
                lastClickedPath={lastClickedPath}
                setLastClickedPath={setLastClickedPath}
                flatVisibleNodes={flatVisibleNodes}
               />
            ))
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 px-2">
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
