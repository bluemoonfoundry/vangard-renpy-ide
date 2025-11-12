import React, { useState, useRef, useEffect } from 'react';
import type { BlockGroup } from '../types';

interface GroupContainerProps {
  group: BlockGroup;
  isSelected: boolean;
  isDragging: boolean;
  isDimmed: boolean;
  updateGroup: (id: string, newGroupData: Partial<BlockGroup>) => void;
}

const GroupContainer: React.FC<GroupContainerProps> = React.memo(({ group, isSelected, isDragging, isDimmed, updateGroup }) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleDoubleClick = () => {
    setTitleValue(group.title);
    setIsEditingTitle(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitleValue(e.target.value);
  };
  
  const handleTitleSave = () => {
    updateGroup(group.id, { title: titleValue.trim() || 'Untitled Group' });
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleTitleSave();
    else if (e.key === 'Escape') setIsEditingTitle(false);
  };
  
  return (
    <div
      data-group-id={group.id}
      className={`group-container-wrapper absolute bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl border-2 ${isSelected ? 'border-indigo-600 dark:border-indigo-400' : 'border-indigo-500/30 dark:border-indigo-500/40'} ${isDragging ? 'shadow-xl shadow-indigo-500/50' : ''} transition-colors transition-shadow duration-200 ${isDimmed ? 'opacity-30' : ''}`}
      style={{
        left: group.position.x,
        top: group.position.y,
        width: group.width,
        height: group.height,
        zIndex: isSelected ? 2 : 1,
      }}
    >
      <div className="drag-handle h-8 rounded-t-lg flex items-center px-4 cursor-grab">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={titleValue}
            onChange={handleTitleChange}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            className="bg-white/70 dark:bg-gray-900/70 text-sm font-bold text-gray-800 dark:text-gray-100 w-full rounded px-2 -ml-2 h-6"
            onPointerDown={e => e.stopPropagation()}
          />
        ) : (
          <span 
            className="text-sm font-bold text-indigo-800 dark:text-indigo-200 truncate"
            onDoubleClick={handleTitleDoubleClick}
            title={group.title + " (Double-click to edit)"}
            onPointerDown={e => e.stopPropagation()}
          >
            {group.title}
          </span>
        )}
      </div>
      <div className="resize-handle absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize" style={{ zIndex: 3 }} />
    </div>
  );
});

export default GroupContainer;