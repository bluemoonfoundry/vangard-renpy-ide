
import React from 'react';
import type { ProjectImage } from '../types';

interface ImageThumbnailProps {
  image: ProjectImage;
  isSelected: boolean;
  onSelect: (filePath: string, isSelected: boolean) => void;
  onDoubleClick: (filePath: string) => void;
  onContextMenu: (event: React.MouseEvent, image: ProjectImage) => void;
  onDragStart: (event: React.DragEvent) => void;
}

const ImageThumbnail: React.FC<ImageThumbnailProps> = ({ image, isSelected, onSelect, onDoubleClick, onContextMenu, onDragStart }) => {
  // Use a green border to indicate the image is part of the project.
  const borderClass = image.isInProject ? 'border-green-500 dark:border-green-400' : 'border-transparent';
  const selectionClass = isSelected ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-gray-50 dark:ring-offset-gray-900' : '';

  return (
    <div
      className={`relative w-full h-full bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden cursor-pointer group transition-all duration-150 border-2 ${borderClass} ${selectionClass}`}
      title={image.filePath}
      onClick={() => onSelect(image.filePath, isSelected)}
      onDoubleClick={() => onDoubleClick(image.filePath)}
      onContextMenu={(e) => onContextMenu(e, image)}
      draggable
      onDragStart={onDragStart}
    >
      {image.dataUrl ? (
        <img src={image.dataUrl} alt={image.fileName} className="w-full h-full object-cover" loading="lazy" />
      ) : (
         <div className="w-full h-full flex items-center justify-center text-red-500" title="Image URL not available">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
        </div>
      )}
      <div className="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
        <p className="text-white text-xs font-mono break-all">{image.fileName}</p>
      </div>
    </div>
  );
};

export default ImageThumbnail;