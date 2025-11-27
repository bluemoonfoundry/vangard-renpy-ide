import React, { useState, useRef, useEffect, useMemo, forwardRef } from 'react';
import type { Block, RenpyAnalysisResult, LabelLocation } from '../types';

interface CodeBlockProps {
  block: Block;
  analysisResult: RenpyAnalysisResult;
  updateBlock: (id: string, newBlockData: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  onOpenEditor: (id: string) => void;
  isSelected: boolean;
  isDragging: boolean;
  isRoot: boolean;
  isLeaf: boolean;
  isBranching: boolean;
  isDimmed: boolean;
  isUsageHighlighted: boolean;
  isHoverHighlighted: boolean;
  isDirty: boolean;
  isScreenBlock: boolean;
  isConfigBlock: boolean;
  isFlashing: boolean;
}

const LabelIcon: React.FC = () => <div title="Contains Labels"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A1 1 0 012 10V5a1 1 0 011-1h5a1 1 0 01.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg></div>;
const DialogueIcon: React.FC = () => <div title="Contains Dialogue/Narration"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15h14a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg></div>;
const MenuIcon: React.FC = () => <div title="Contains Menus/Choices"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg></div>;
const JumpIcon: React.FC = () => <div title="Contains Jumps/Calls"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg></div>;
const PythonIcon: React.FC = () => <div title="Contains Python code"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.28 5.22a.75.75 0 010 1.06L3.56 9l2.72 2.72a.75.75 0 01-1.06 1.06L1.47 9.53a.75.75 0 010-1.06l3.75-3.75a.75.75 0 011.06 0zm7.44 0a.75.75 0 011.06 0l3.75 3.75a.75.75 0 010 1.06L14.78 14l-2.72-2.72a.75.75 0 011.06-1.06L16.44 9l-2.72-2.72a.75.75 0 010-1.06z" clipRule="evenodd" /></svg></div>;

// Full color palette for blocks
const BLOCK_COLORS: Record<string, { bg: string, header: string, border: string, dot: string }> = {
    default: { bg: 'bg-white dark:bg-gray-800', header: 'bg-gray-100 dark:bg-gray-700', border: 'border-gray-200 dark:border-gray-700', dot: '#e5e7eb' },
    slate: { bg: 'bg-slate-50 dark:bg-slate-900/20', header: 'bg-slate-100 dark:bg-slate-900/50', border: 'border-slate-200 dark:border-slate-800', dot: '#cbd5e1' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', header: 'bg-red-100 dark:bg-red-900/50', border: 'border-red-200 dark:border-red-800', dot: '#fca5a5' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', header: 'bg-orange-100 dark:bg-orange-900/50', border: 'border-orange-200 dark:border-orange-800', dot: '#fdba74' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', header: 'bg-amber-100 dark:bg-amber-900/50', border: 'border-amber-200 dark:border-amber-800', dot: '#fcd34d' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', header: 'bg-yellow-100 dark:bg-yellow-900/50', border: 'border-yellow-200 dark:border-yellow-800', dot: '#fde047' },
    lime: { bg: 'bg-lime-50 dark:bg-lime-900/20', header: 'bg-lime-100 dark:bg-lime-900/50', border: 'border-lime-200 dark:border-lime-800', dot: '#bef264' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', header: 'bg-green-100 dark:bg-green-900/50', border: 'border-green-200 dark:border-green-800', dot: '#86efac' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', header: 'bg-emerald-100 dark:bg-emerald-900/50', border: 'border-emerald-200 dark:border-emerald-800', dot: '#6ee7b7' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', header: 'bg-teal-100 dark:bg-teal-900/50', border: 'border-teal-200 dark:border-teal-800', dot: '#5eead4' },
    cyan: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', header: 'bg-cyan-100 dark:bg-cyan-900/50', border: 'border-cyan-200 dark:border-cyan-800', dot: '#67e8f9' },
    sky: { bg: 'bg-sky-50 dark:bg-sky-900/20', header: 'bg-sky-100 dark:bg-sky-900/50', border: 'border-sky-200 dark:border-sky-800', dot: '#7dd3fc' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', header: 'bg-blue-100 dark:bg-blue-900/50', border: 'border-blue-200 dark:border-blue-800', dot: '#93c5fd' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', header: 'bg-indigo-100 dark:bg-indigo-900/50', border: 'border-indigo-200 dark:border-indigo-800', dot: '#a5b4fc' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-900/20', header: 'bg-violet-100 dark:bg-violet-900/50', border: 'border-violet-200 dark:border-violet-800', dot: '#c4b5fd' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', header: 'bg-purple-100 dark:bg-purple-900/50', border: 'border-purple-200 dark:border-purple-800', dot: '#d8b4fe' },
    fuchsia: { bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', header: 'bg-fuchsia-100 dark:bg-fuchsia-900/50', border: 'border-fuchsia-200 dark:border-fuchsia-800', dot: '#f0abfc' },
    pink: { bg: 'bg-pink-50 dark:bg-pink-900/20', header: 'bg-pink-100 dark:bg-pink-900/50', border: 'border-pink-200 dark:border-pink-800', dot: '#f9a8d4' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-900/20', header: 'bg-rose-100 dark:bg-rose-900/50', border: 'border-rose-200 dark:border-rose-800', dot: '#fda4af' },
};

const CodeBlock = forwardRef<HTMLDivElement, CodeBlockProps>(({ 
  block, 
  analysisResult, 
  updateBlock, 
  deleteBlock, 
  onOpenEditor,
  isSelected,
  isDragging,
  isRoot,
  isLeaf,
  isBranching,
  isDimmed,
  isUsageHighlighted,
  isHoverHighlighted,
  isDirty,
  isScreenBlock,
  isConfigBlock,
  isFlashing,
}, ref) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  
  const { firstLabels, invalidJumps, labels, dialogueLines, characters, blockTypes } = analysisResult;
  
  const getFilename = (path?: string) => path?.split('/').pop()?.replace(/\.rpy$/, '');
  const displayedTitle = block.title ?? getFilename(block.filePath) ?? firstLabels[block.id] ?? "Ren'Py Block";
  const blockInvalidJumps = invalidJumps[block.id] || [];

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
            setIsColorPickerOpen(false);
        }
    };
    if (isColorPickerOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColorPickerOpen]);

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
  
  const blockContentSummary = useMemo(() => {
    return blockTypes.get(block.id) || new Set<string>();
  }, [blockTypes, block.id]);

  const hasInvalidJumps = blockInvalidJumps.length > 0;

  // Resolve Styles
  const customColor = block.color && BLOCK_COLORS[block.color] ? BLOCK_COLORS[block.color] : null;
  const defaultColor = BLOCK_COLORS.default;

  let borderClass = '';
  if (isSelected) {
      if (isConfigBlock) borderClass = 'border-red-500 dark:border-red-400';
      else if (isScreenBlock) borderClass = 'border-teal-500 dark:border-teal-400';
      else borderClass = 'border-indigo-500 dark:border-indigo-400';
  } else if (isUsageHighlighted) {
      borderClass = 'border-sky-500 dark:border-sky-400';
  } else if (hasInvalidJumps) {
      borderClass = 'border-red-500';
  } else if (customColor) {
      borderClass = customColor.border;
  } else if (isConfigBlock) {
      borderClass = 'border-red-500/50 dark:border-red-400/50';
  } else if (isScreenBlock) {
      borderClass = 'border-teal-500/50 dark:border-teal-400/50';
  } else {
      borderClass = defaultColor.border;
  }
  
  const shadowClass = isDragging
    ? isConfigBlock ? 'shadow-red-500/50'
    : isScreenBlock ? 'shadow-teal-500/50' 
    : 'shadow-indigo-500/50'
    : isUsageHighlighted
    ? 'shadow-sky-500/50'
    : '';

  let headerClass = '';
  if (customColor) {
      headerClass = customColor.header;
  } else if (isConfigBlock) {
      headerClass = 'bg-red-100 dark:bg-red-900/50';
  } else if (isScreenBlock) {
      headerClass = 'bg-teal-100 dark:bg-teal-900/50';
  } else {
      headerClass = defaultColor.header;
  }

  const bgClass = customColor ? customColor.bg : defaultColor.bg;

  const handleColorSelect = (colorKey: string) => {
      updateBlock(block.id, { color: colorKey === 'default' ? undefined : colorKey });
      setIsColorPickerOpen(false);
  };

  return (
    <div
      ref={ref}
      data-block-id={block.id}
      className={`code-block-wrapper absolute ${bgClass} rounded-lg shadow-2xl border-2 ${borderClass} ${shadowClass} flex flex-col transition-colors duration-200 ${isDimmed ? 'opacity-30' : ''} ${isFlashing ? 'flash-block' : isHoverHighlighted ? 'pulse-block heatmap-highlight' : ''}`}
      style={{
        left: block.position.x,
        top: block.position.y,
        width: block.width,
        height: block.height,
        zIndex: isSelected ? 10 : 5,
        // Remove transition on left/top during drag to prevent fighting with JS updates
        transitionProperty: isDragging ? 'none' : 'box-shadow, border-color, opacity, transform',
      }}
      onDoubleClick={() => onOpenEditor(block.id)}
    >
      <div className={`drag-handle h-8 ${headerClass} rounded-t-md flex items-center px-3 justify-between cursor-grab transition-colors duration-200`}>
        <div className="flex items-center space-x-2 flex-grow min-w-0">
          <div className="flex items-center space-x-1 flex-shrink-0">
            {isConfigBlock && <div title="Config Block"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734-2.106-2.106a1.532 1.532 0 01-.947-2.287c1.561-.379-1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg></div>}
            {isScreenBlock && <div title="Screen Block"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-teal-500" viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 2A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0012.5 2h-9zM4 4.5a.5.5 0 01.5-.5h7a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-2zM4.5 9a.5.5 0 00-.5.5v2a.5.5 0 00.5.5h7a.5.5 0 00.5-.5v-2a.5.5 0 00-.5-.5h-7z" /></svg></div>}
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
        <div className="flex items-center space-x-1 pl-2 flex-shrink-0">
           <div className="relative">
               <button 
                   onClick={(e) => { e.stopPropagation(); setIsColorPickerOpen(!isColorPickerOpen); }}
                   className="p-1 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white opacity-50 hover:opacity-100"
                   title="Change Color"
               >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" /></svg>
               </button>
               {isColorPickerOpen && (
                   <div 
                       ref={colorPickerRef}
                       className="absolute top-6 right-0 bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded p-2 z-50 w-40"
                       onMouseDown={e => e.stopPropagation()}
                   >
                       <div className="grid grid-cols-5 gap-1.5">
                           {Object.entries(BLOCK_COLORS).map(([key, style]) => (
                               <button
                                   key={key}
                                   onClick={() => handleColorSelect(key)}
                                   className={`w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform ${block.color === key || (!block.color && key === 'default') ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}`}
                                   style={{ backgroundColor: style.dot }}
                                   title={key.charAt(0).toUpperCase() + key.slice(1)}
                               />
                           ))}
                       </div>
                   </div>
               )}
           </div>
           <button onClick={() => onOpenEditor(block.id)} className="p-1 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white" title="Open in Tab"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3.586L3.293 6.707A1 1 0 013 6V3zm3.146 2.146a.5.5 0 01.708 0l2.5 2.5a.5.5 0 010 .708l-2.5 2.5a.5.5 0 01-.708-.708L7.793 8 6.146 6.354a.5.5 0 010-.708z" clipRule="evenodd" /></svg></button>
           <button onClick={() => deleteBlock(block.id)} className="p-1 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white" title="Delete Block"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
      </div>
      <div
        className="flex-grow p-3 text-sm text-gray-700 dark:text-gray-300 space-y-2 overflow-y-auto cursor-pointer"
        title="Double-click to open in a new tab"
      >
        {blockLabels.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong className="font-semibold text-gray-500 dark:text-gray-400 text-xs flex-shrink-0">LABELS</strong>
                <div className="flex flex-wrap gap-1">
                    {blockLabels.map(label => (
                        <span key={label} className="font-mono bg-gray-100 dark:bg-gray-700/50 rounded px-1.5 py-0.5 text-xs">{label}</span>
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
        
        {blockContentSummary.size > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 border-t border-gray-200 dark:border-gray-700/50 mt-2">
              <strong className="font-semibold text-gray-500 dark:text-gray-400 text-xs flex-shrink-0">CONTAINS</strong>
              <div className="flex flex-wrap items-center gap-2 text-gray-500 dark:text-gray-400">
                  {blockContentSummary.has('label') && <LabelIcon />}
                  {blockContentSummary.has('dialogue') && <DialogueIcon />}
                  {blockContentSummary.has('menu') && <MenuIcon />}
                  {blockContentSummary.has('jump') && <JumpIcon />}
                  {blockContentSummary.has('python') && <PythonIcon />}
              </div>
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
});

// Use React.memo for performance optimization of non-drag re-renders
export default React.memo(CodeBlock);
