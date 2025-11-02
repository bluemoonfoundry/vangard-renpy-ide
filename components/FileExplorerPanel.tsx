import React, { useState, useEffect } from 'react';
import type { FileSystemTreeNode } from '../types';

const FolderIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
    {isOpen ? (
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
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
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, onFileOpen, expandedPaths, toggleExpand, level }) => {
  const isDirectory = !!node.children;
  const isExpanded = expandedPaths.has(node.path);
  const isRpyFile = node.name.endsWith('.rpy');

  const handleDoubleClick = () => {
    if (!isDirectory && isRpyFile) {
      onFileOpen(node.path);
    }
  };

  const handleToggle = () => {
    if (isDirectory) {
      toggleExpand(node.path);
    }
  };

  return (
    <div>
      <div
        onClick={handleToggle}
        onDoubleClick={handleDoubleClick}
        style={{ paddingLeft: `${level * 16}px` }}
        className={`flex items-center space-x-2 py-1 px-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${!isRpyFile && !isDirectory ? 'opacity-60' : ''}`}
        title={node.path}
      >
        {isDirectory ? <FolderIcon isOpen={isExpanded} /> : (isRpyFile ? <RpyFileIcon /> : <FileIcon />)}
        <span className="text-sm select-none truncate">{node.name}</span>
      </div>
      {isDirectory && isExpanded && (
        <div>
          {node.children!.map(child => (
            <TreeNode key={child.path} node={child} onFileOpen={onFileOpen} expandedPaths={expandedPaths} toggleExpand={toggleExpand} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

interface FileExplorerPanelProps {
  tree: FileSystemTreeNode | null;
  onFileOpen: (path: string) => void;
}

const FileExplorerPanel: React.FC<FileExplorerPanelProps> = ({ tree, onFileOpen }) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Automatically expand the root directory when a new tree is loaded
    if (tree) {
        setExpandedPaths(new Set([tree.path]));
    }
  }, [tree]);

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  return (
    <aside className="w-full h-full bg-white dark:bg-gray-800 flex flex-col z-10">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold">Project Explorer</h2>
      </div>
      <div className="flex-grow p-2 overflow-y-auto">
        {tree ? (
            <TreeNode node={tree} onFileOpen={onFileOpen} expandedPaths={expandedPaths} toggleExpand={toggleExpand} level={0} />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 px-2">
            Open a project folder to see files here.
          </p>
        )}
      </div>
    </aside>
  );
};

export default FileExplorerPanel;
