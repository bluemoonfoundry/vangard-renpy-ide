import React, { useState, useMemo } from 'react';
import type { RenpyImage } from '../types';

interface ImageManagerProps {
  images: RenpyImage[];
  onImportImages: () => void;
  isImportEnabled: boolean;
}

const ImageThumbnail: React.FC<{ image: RenpyImage }> = ({ image }) => {
  return (
    <div
      className="relative aspect-square bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden cursor-pointer group transition-transform hover:scale-105"
      title={`Click to preview image: ${image.tag}`}
    >
      <img src={image.dataUrl} alt={image.tag} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
        <p className="text-white text-xs font-mono break-all">{image.tag}</p>
      </div>
    </div>
  );
};

const ImageManager: React.FC<ImageManagerProps> = ({ images, onImportImages, isImportEnabled }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<RenpyImage | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<{ [key: string]: boolean }>({});

  const filteredImages = useMemo(() => {
    if (!searchTerm) return images;
    return images.filter(img => img.tag.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [images, searchTerm]);

  const imagesByFolder = useMemo(() => {
    const folders = new Map<string, RenpyImage[]>();
    filteredImages.forEach(image => {
      const pathParts = image.filePath.split('/');
      const folderPath = pathParts.slice(1, -1).join('/'); // remove "images/" and filename
      if (!folders.has(folderPath)) {
        folders.set(folderPath, []);
      }
      folders.get(folderPath)!.push(image);
    });
    return Array.from(folders.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredImages]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };
  
  // Initially expand all folders
  React.useEffect(() => {
    const initialExpansionState: { [key: string]: boolean } = {};
    imagesByFolder.forEach(([folderPath]) => {
      initialExpansionState[folderPath] = true;
    });
    setExpandedFolders(initialExpansionState);
  }, [images]); // Re-run only when the base images change, not on filter

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Image Gallery ({images.length})</h3>
        <button 
          onClick={onImportImages}
          disabled={!isImportEnabled}
          title={isImportEnabled ? "Import new images" : "Open a project folder to enable image imports"}
          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          + Import
        </button>
      </div>
      <input
        type="text"
        placeholder="Search images..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full mb-4 p-2 rounded bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <div className="flex-grow overflow-y-auto -mr-4 pr-4 space-y-4">
        {imagesByFolder.map(([folderPath, folderImages]) => {
          const isExpanded = expandedFolders[folderPath] ?? false;
          return (
            <div key={folderPath}>
              <button onClick={() => toggleFolder(folderPath)} className="w-full text-left font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                {folderPath || '(root)'}
              </button>
              {isExpanded && (
                <div className="grid grid-cols-3 gap-2">
                  {folderImages.map(image => (
                    <div key={image.filePath} onClick={() => setSelectedImage(image)}>
                       <ImageThumbnail image={image} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {images.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No images found in project.</p>}
        {images.length > 0 && filteredImages.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No images match your search.</p>}
      </div>
      {selectedImage && (
        <div className="mt-4 p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-md -mx-4 -mb-4">
          <h4 className="font-semibold mb-2">Preview</h4>
          <img src={selectedImage.dataUrl} alt={selectedImage.tag} className="w-full rounded-md mb-2 border dark:border-gray-700" />
          <p className="text-sm font-semibold">{selectedImage.tag}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{selectedImage.filePath}</p>
        </div>
      )}
    </div>
  );
};

export default ImageManager;