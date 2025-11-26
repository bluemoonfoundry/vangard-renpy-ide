
import React, { useState, useRef, useEffect, forwardRef } from 'react';
import type { StickyNote as StickyNoteType, NoteColor } from '../types';

interface StickyNoteProps {
  note: StickyNoteType;
  updateNote: (id: string, data: Partial<StickyNoteType>) => void;
  deleteNote: (id: string) => void;
  isSelected: boolean;
  isDragging: boolean;
}

const COLORS: Record<NoteColor, { bg: string, header: string, border: string }> = {
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/80', header: 'bg-yellow-200 dark:bg-yellow-800/80', border: 'border-yellow-300 dark:border-yellow-700' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/80', header: 'bg-blue-200 dark:bg-blue-800/80', border: 'border-blue-300 dark:border-blue-700' },
  green: { bg: 'bg-green-100 dark:bg-green-900/80', header: 'bg-green-200 dark:bg-green-800/80', border: 'border-green-300 dark:border-green-700' },
  pink: { bg: 'bg-pink-100 dark:bg-pink-900/80', header: 'bg-pink-200 dark:bg-pink-800/80', border: 'border-pink-300 dark:border-pink-700' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/80', header: 'bg-purple-200 dark:bg-purple-800/80', border: 'border-purple-300 dark:border-purple-700' },
  red: { bg: 'bg-red-100 dark:bg-red-900/80', header: 'bg-red-200 dark:bg-red-800/80', border: 'border-red-300 dark:border-red-700' },
};

const StickyNote = React.memo(forwardRef<HTMLDivElement, StickyNoteProps>(({ note, updateNote, deleteNote, isSelected, isDragging }, ref) => {
  const styles = COLORS[note.color];
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const handleColorChange = (color: NoteColor) => {
    updateNote(note.id, { color });
    setIsColorPickerOpen(false);
  };

  return (
    <div
      ref={ref}
      data-note-id={note.id}
      className={`sticky-note-wrapper absolute rounded-lg shadow-lg border-2 flex flex-col transition-shadow duration-200 ${styles.bg} ${styles.border} ${isSelected ? 'ring-2 ring-indigo-500 z-30' : 'z-20'} ${isDragging ? 'shadow-xl opacity-90' : ''}`}
      style={{
        left: note.position.x,
        top: note.position.y,
        width: note.width,
        height: note.height,
      }}
    >
      <div className={`drag-handle h-7 ${styles.header} rounded-t-md flex items-center justify-between px-2 cursor-grab flex-shrink-0 group`}>
        <div className="relative">
            <button 
                className="w-3 h-3 rounded-full border border-black/10 hover:scale-125 transition-transform" 
                style={{ backgroundColor: 'currentColor', opacity: 0.5 }}
                onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                title="Change Color"
            ></button>
            {isColorPickerOpen && (
                <div className="absolute top-5 left-0 bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded p-1 flex gap-1 z-50">
                    {(Object.keys(COLORS) as NoteColor[]).map(c => (
                        <button
                            key={c}
                            className={`w-4 h-4 rounded-full border border-gray-300 ${c === note.color ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                            style={{ backgroundColor: c === 'yellow' ? '#fef3c7' : c === 'blue' ? '#dbeafe' : c === 'green' ? '#dcfce7' : c === 'pink' ? '#fce7f3' : c === 'purple' ? '#f3e8ff' : '#fee2e2' }} // Approximate tailwind 100 colors for preview
                            onClick={(e) => { e.stopPropagation(); handleColorChange(c); }}
                        />
                    ))}
                </div>
            )}
        </div>
        <button 
            onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
            className="text-black/30 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete Note"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        </button>
      </div>
      <textarea
        className="w-full h-full bg-transparent p-2 resize-none focus:outline-none text-gray-800 dark:text-gray-100 text-sm font-medium leading-relaxed"
        value={note.content}
        onChange={(e) => updateNote(note.id, { content: e.target.value })}
        placeholder="Type a note..."
        onPointerDown={(e) => e.stopPropagation()} // Prevent dragging when clicking textarea
      />
      <div className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize" style={{ zIndex: 2 }} />
    </div>
  );
}));

export default StickyNote;
