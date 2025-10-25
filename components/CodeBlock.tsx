import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Block, RenpyAnalysisResult, LabelLocation } from '../types';

interface CodeBlockProps {
  block: Block;
  analysisResult: RenpyAnalysisResult;
  flashingBlockId: string | null;
  onNavigateToBlock: (target: LabelLocation) => void;
  updateBlock: (id: string, newBlockData: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  onOpenEditor: (id: string) => void;
  onImageDrop: (blockId: string, imageTag: string, clientX: number, clientY: number) => void;
  isSelected: boolean;
  isDragging: boolean;
  isRoot: boolean;
  isLeaf: boolean;
  isBranching: boolean;
  isDimmed: boolean;
  isUsageHighlighted: boolean;
  isDirty: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ 
  block, 
  analysisResult, 
  flashingBlockId,
  onNavigateToBlock,
  updateBlock, 
  deleteBlock, 
  onOpenEditor,
  onImageDrop,
  isSelected,
  isDragging,
  isRoot,
  isLeaf,
  isBranching,
  isDimmed,
  isUsageHighlighted,
  isDirty,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const { firstLabels, invalidJumps, labels, dialogueLines, characters } = analysisResult;
  
  const getFilename = (path?: string) => path?.split('/').pop()?.replace(/\.rpy$/, '');
  const displayedTitle = block.title ?? getFilename(block.filePath) ?? firstLabels[block.id] ?? "Ren'Py Block";
  const blockInvalidJumps = invalidJumps[block.id] || [];

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleDoubleClick = () => {
    setTitleValue(displayedTitle);
    setIsEditingTitle(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitleValue(e.target.value);
  };

  const handleTitleSave = () => {
    if (titleValue.trim() === '') {
       updateBlock(block.id, { title: undefined });
    } else {
       updateBlock(block.id, { title: titleValue });
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };
  
  const blockLabels = useMemo(() => {
    return Object.values(labels)
        .filter((label: LabelLocation) => label.blockId === block.id)
        .map((label: LabelLocation) => label.label);
  }, [labels, block.id]);

  const blockCharacters = useMemo(() => {
      const dialogue = dialogueLines.get(block.id) || [];
      const charTags = new Set(dialogue.map(d => d.tag));
      return Array.from(charTags).map(tag => characters.get(tag)?.name || tag);
  }, [dialogueLines, characters, block.id]);

  const lineCount = useMemo(() => block.content.split('\n').length, [block.content]);
  
  const hasInvalidJumps = blockInvalidJumps.length > 0;
  const isFlashing = flashingBlockId === block.id;

  const borderClass = isSelected 
    ? 'border-indigo-500 dark:border-indigo-400' 
    : isUsageHighlighted
    ? 'border-sky-500 dark:border-sky-400'
    : isDragOver
    ? 'border-emerald-500 dark:border-emerald-400'
    : hasInvalidJumps 
    ? 'border-red-500' 
    : 'border-gray-200 dark:border-gray-700';
  
  const shadowClass = isDragging
    ? 'shadow-indigo-500/50'
    : isUsageHighlighted
    ? 'shadow-sky-500/50'
    : isDragOver
    ? 'shadow-emerald-500/50'
    : '';
    
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  
  const handleDragEnter = (e: React.DragEvent) => {
    if(e.dataTransfer.types.includes('renpy/image-tag')) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const imageTag = e.dataTransfer.getData('renpy/image-tag');
    if (imageTag) {
      onImageDrop(block.id, imageTag, e.clientX, e.clientY);
    }
  };


  return (
    <div
      data-block-id={block.id}
      className={`code-block-wrapper absolute bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 ${borderClass} ${shadowClass} flex flex-col transition-all duration-200 ${isFlashing ? 'flash-block' : ''} ${isDimmed ? 'opacity-30' : ''}`}
      style={{
        left: block.position.x,
        top: block.position.y,
        width: block.width,
        height: block.height,
        zIndex: isSelected ? 10 : 5,
      }}
      onDoubleClick={() => onOpenEditor(block.id)}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="drag-handle h-8 bg-gray-100 dark:bg-gray-700 rounded-t-md flex items-center px-3 justify-between cursor-grab">
        <div className="flex items-center space-x-2 flex-grow min-w-0">
          <div className="flex items-center space-x-1 flex-shrink-0">
            {isRoot && <div title="Root Block (Story Start)"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg></div>}
            {isBranching && <div title="Branching Block (Menu/Multiple Jumps)"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path d="M15 4a1 1 0 00-1.447-.894l-5 2.5a1 1 0 000 1.789l5 2.5A1 1 0 0015 9V4zM5 4a1 1 0 00-1.447-.894l-5 2.5a1 1 0 000 1.789l5 2.5A1 1 0 005 9V4z" opacity=".5"/><path d="M15 11a1 1 0 00-1.447-.894l-5 2.5a1 1 0 000 1.789l5 2.5A1 1 0 0015 16v-5z" /></svg></div>}
            {isLeaf && <div title="Leaf Block (Story End)"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg></div>}
          </div>
          <div className="flex-grow min-w-0 flex items-center space-x-2">
            {isDirty && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" title="Unsaved changes"></div>}
            {isEditingTitle ? (
              <input ref={titleInputRef} type="text" value={titleValue} onChange={handleTitleChange} onBlur={handleTitleSave} onKeyDown={handleTitleKeyDown} className="bg-white dark:bg-gray-600 text-sm font-semibold text-gray-800 dark:text-gray-100 w-full rounded px-1 -ml-1 h-6" onClick={e => e.stopPropagation()} />
            ) : (
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 truncate block" onDoubleClick={handleTitleDoubleClick} title={block.filePath || displayedTitle + " (Double-click to edit)"}>{displayedTitle}</span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 pl-2 flex-shrink-0">
           <button onClick={() => onOpenEditor(block.id)} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white" title="Focus Mode"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" /></svg></button>
           <button onClick={() => deleteBlock(block.id)} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white" title="Delete Block"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
      </div>
      <div
        className="flex-grow p-3 text-sm text-gray-700 dark:text-gray-300 space-y-2 overflow-y-auto cursor-pointer"
        title="Double-click to edit"
      >
        {blockLabels.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong className="font-semibold text-gray-500 dark:text-gray-400 text-xs flex-shrink-0">LABELS</strong>
                <div className="flex flex-wrap gap-1">
                    {blockLabels.map(label => (
                        <span key={label} className="font-mono bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5 text-xs">{label}</span>
                    ))}
                </div>
            </div>
        )}
        {blockCharacters.length > 0 && (
            <div>
                <strong className="font-semibold text-gray-500 dark:text-gray-400 text-xs">CHARACTERS</strong>
                <p className="text-xs italic truncate">{blockCharacters.join(', ')}</p>
            </div>
        )}
        <div className="text-xs text-gray-400 dark:text-gray-500 pt-1 absolute bottom-2 left-3">
            {lineCount} lines
        </div>
      </div>

       {hasInvalidJumps && (
        <div className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs px-3 py-1 rounded-b-md">
          Invalid jumps: {blockInvalidJumps.join(', ')}
        </div>
      )}
      <div className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize" style={{ zIndex: 2 }} />
    </div>
  );
};

export default CodeBlock;