


import React, { useState, useMemo, useEffect } from 'react';
import type { ProjectImage, ImageMetadata } from '../types';
import ImageContextMenu from './ImageContextMenu';

interface ImageManagerProps {
  images: ProjectImage[];
  metadata: Map<string, ImageMetadata>;
  scanDirectories: string[];
  onAddScanDirectory: () => void;
  onRemoveScanDirectory: (dirName: string) => void;
  onCopyImagesToProject: (sourceFilePaths: string[]) => void;
  onOpenImageEditor: (filePath: string) => void;
  isFileSystemApiSupported: boolean;
}

const ImageThumbnail: React.FC<{ 
    image: ProjectImage;
    isSelected: boolean;
    onSelect: (filePath: string, isSelected: boolean) => void;
    onDoubleClick: (filePath: string) => void;
    onContextMenu: (event: React.MouseEvent, image: ProjectImage) => void;
}> = ({ image, isSelected, onSelect, onDoubleClick, onContextMenu }) => {
  const borderClass = image.isInProject 
    ? 'border-red-500 dark:border-red-400' 
    : 'border-transparent';
  
  const selectionClass = isSelected ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-gray-50 dark:ring-offset-gray-900' : '';

  return (
    <div
      className={`relative aspect-square bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden cursor-pointer group transition-all duration-150 border-2 ${borderClass} ${selectionClass}`}
      title={image.filePath}
      onClick={() => onSelect(image.filePath, isSelected)}
      onDoubleClick={() => onDoubleClick(image.filePath)}
      onContextMenu={(e) => onContextMenu(e, image)}
    >
      <img src={image.dataUrl} alt={image.fileName} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
        <p className="text-white text-xs font-mono break-all">{image.fileName}</p>
      </div>
    </div>
  );
};

const ImageManager: React.FC<ImageManagerProps> = ({ images, metadata, scanDirectories, onAddScanDirectory, onRemoveScanDirectory, onCopyImagesToProject, onOpenImageEditor, isFileSystemApiSupported }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedImagePaths, setSelectedImagePaths] = useState(new Set<string>());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; image: ProjectImage } | null>(null);

  const sources = useMemo(() => {
    return ['all', 'Project (game/images)', ...scanDirectories];
  }, [scanDirectories]);

  useEffect(() => {
    // If the currently selected source directory is removed, reset the filter to 'all'
    if (!sources.includes(selectedSource)) {
        setSelectedSource('all');
    }
  }, [sources, selectedSource]);
  
  const filteredImages = useMemo(() => {
    let visibleImages = images;
    
    if (selectedSource !== 'all') {
      if (selectedSource === 'Project (game/images)') {
        visibleImages = visibleImages.filter(img => img.isInProject);
      } else {
        visibleImages = visibleImages.filter(img => img.filePath.startsWith(`${selectedSource}/`));
      }
    }
    
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        visibleImages = visibleImages.filter(img => 
            img.fileName.toLowerCase().includes(lowerSearch) || 
            (metadata.get(img.projectFilePath || '')?.renpyName || '').toLowerCase().includes(lowerSearch) ||
            (metadata.get(img.projectFilePath || '')?.tags || []).some(tag => tag.toLowerCase().includes(lowerSearch))
        );
    }
    return visibleImages;
  }, [images, metadata, searchTerm, selectedSource]);

  const handleSelectImage = (filePath: string, isCurrentlySelected: boolean) => {
      setSelectedImagePaths(prev => {
          const newSet = new Set(prev);
          if (isCurrentlySelected) {
              newSet.delete(filePath);
          } else {
              newSet.add(filePath);
          }
          return newSet;
      });
  };

  const handleCopySelected = () => {
    onCopyImagesToProject(Array.from(selectedImagePaths));
    setSelectedImagePaths(new Set());
  };

  const handleContextMenu = (event: React.MouseEvent, image: ProjectImage) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      image,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const getRenpyImageTag = (image: ProjectImage): string => {
    const meta = metadata.get(image.projectFilePath || image.filePath);
    const name = meta?.renpyName || image.fileName.split('.').slice(0, -1).join('.');
    const tags = (meta?.tags || []).join(' ');
    return `${name}${tags ? ` ${tags}` : ''}`.trim().replace(/\s+/g, ' ');
  };

  const handleContextMenuSelect = (type: 'scene' | 'show') => {
    if (!contextMenu) return;
    const imageTag = getRenpyImageTag(contextMenu.image);
    const statement = `${type} ${imageTag}`;
    navigator.clipboard.writeText(statement);
    handleCloseContextMenu();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 space-y-4">
        <div>
            <h3 className="font-semibold mb-2">Image Sources</h3>
            <div className="space-y-1">
                {sources.map(source => (
                    <div
                        key={source}
                        onClick={() => setSelectedSource(source)}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer text-sm ${selectedSource === source ? 'bg-indigo-100 dark:bg-indigo-900/50 font-semibold' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                    >
                        <span className="truncate">{source}</span>
                        {source !== 'all' && source !== 'Project (game/images)' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveScanDirectory(source); }}
                                className="p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800/50 text-gray-500 dark:text-gray-400 hover:text-red-700 dark:hover:text-red-300"
                                title={`Remove ${source}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        )}
                    </div>
                ))}
            </div>
            <button
                onClick={onAddScanDirectory}
                disabled={!isFileSystemApiSupported}
                title={isFileSystemApiSupported ? "Add external folder to scan for images" : "Open a project folder to enable this feature"}
                className="w-full mt-2 px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                <span>Add Directory to Scan</span>
            </button>
        </div>
        <div className="flex items-center space-x-2 mt-4">
            <input
                type="text"
                placeholder="Search images by name or tag..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-grow p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
            />
             <button
                onClick={handleCopySelected}
                disabled={selectedImagePaths.size === 0}
                className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                Copy to Project ({selectedImagePaths.size})
            </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto -mr-4 pr-4 pt-4">
        <div className="grid grid-cols-3 gap-3">
            {filteredImages.map(image => (
                <ImageThumbnail 
                    key={image.filePath} 
                    image={image}
                    isSelected={selectedImagePaths.has(image.filePath)}
                    onSelect={handleSelectImage}
                    onDoubleClick={onOpenImageEditor}
                    onContextMenu={handleContextMenu}
                />
            ))}
        </div>
        {images.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No images found. Add a source directory to get started.</p>}
        {images.length > 0 && filteredImages.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No images match your filter.</p>}
      </div>
      {contextMenu && (
        <ImageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          imageTag={getRenpyImageTag(contextMenu.image)}
          onSelect={handleContextMenuSelect}
          onClose={handleCloseContextMenu}
        />
      )}
    </div>
  );
};

export default ImageManager;