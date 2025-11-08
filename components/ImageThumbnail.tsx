import React from 'react';
import type { ProjectImage } from '../types';

// Helper function to convert a file to a data URL
const fileToDataUrl = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface ImageThumbnailProps {
  image: ProjectImage;
  isSelected: boolean;
  onSelect: (filePath: string, isSelected: boolean) => void;
  onDoubleClick: (filePath: string) => void;
  onContextMenu: (event: React.MouseEvent, image: ProjectImage) => void;
}

const ImageThumbnail: React.FC<ImageThumbnailProps> = ({ image, isSelected, onSelect, onDoubleClick, onContextMenu }) => {
  const [imageUrl, setImageUrl] = React.useState<string | undefined>(image.dataUrl);
  const [isLoading, setIsLoading] = React.useState(!image.dataUrl);

  React.useEffect(() => {
    let isMounted = true;
    if (!image.dataUrl && image.fileHandle) {
      setIsLoading(true);
      const loadImage = async () => {
        try {
          const file = await image.fileHandle!.getFile();
          const dataUrl = await fileToDataUrl(file);
          if (isMounted) {
            setImageUrl(dataUrl);
            // Cache the loaded dataUrl on the object to prevent re-fetching.
            // This is a controlled mutation for performance optimization.
            image.dataUrl = dataUrl;
            setIsLoading(false);
          }
        } catch (error) {
          console.error(`Failed to load image data for ${image.fileName}`, error);
          if (isMounted) setIsLoading(false);
        }
      };
      loadImage();
    } else {
        setIsLoading(false);
    }
    return () => { isMounted = false; };
  }, [image.filePath, image.dataUrl, image.fileHandle]);

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
    >
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
      ) : imageUrl ? (
        <img src={imageUrl} alt={image.fileName} className="w-full h-full object-cover" loading="lazy" />
      ) : (
         <div className="w-full h-full flex items-center justify-center text-red-500" title="Failed to load image">
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
