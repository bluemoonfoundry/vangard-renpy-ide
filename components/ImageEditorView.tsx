

import React, { useState, useEffect, useMemo } from 'react';
import type { ProjectImage, ImageMetadata } from '../types';

interface ImageEditorViewProps {
  image: ProjectImage;
  allImages: ProjectImage[];
  metadata?: ImageMetadata;
  onUpdateMetadata: (projectFilePath: string, newMetadata: ImageMetadata) => void;
  onCopyToProject: (sourceFilePath: string, metadata: ImageMetadata) => void;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const MetadataRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{label}</p>
        <p className="text-sm text-gray-800 dark:text-gray-200 font-mono break-words">{value}</p>
    </div>
);

const ImageEditorView: React.FC<ImageEditorViewProps> = ({ image, allImages, metadata, onUpdateMetadata, onCopyToProject }) => {
  const [renpyName, setRenpyName] = useState('');
  const [tags, setTags] = useState('');
  const [subfolder, setSubfolder] = useState('');

  const [dimensions, setDimensions] = useState<{ w: number, h: number } | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

  // Onion Skin State
  const [onionSkinImageId, setOnionSkinImageId] = useState<string>('');
  const [onionSkinOpacity, setOnionSkinOpacity] = useState(0.5);
  const [showOnionSkin, setShowOnionSkin] = useState(true);

  useEffect(() => {
    setRenpyName(metadata?.renpyName || image.fileName.split('.').slice(0, -1).join('.'));
    setTags((metadata?.tags || []).join(', '));
    setSubfolder(metadata?.projectSubfolder || '');

    // Reset and calculate file metadata
    setDimensions(null);
    setFileSize(null);
    setMimeType(null);

    const img = new Image();
    img.onload = () => {
        setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = image.dataUrl || '';

    // Prefer pre-calculated size if available (Electron or Browser scan)
    if (image.size !== undefined) {
        setFileSize(image.size);
    } else if (image.fileHandle) {
        image.fileHandle.getFile().then(file => {
            setFileSize(file.size);
            setMimeType(file.type);
        });
    } else if (image.dataUrl && image.dataUrl.startsWith('data:')) {
        const match = image.dataUrl.match(/^data:(.+);base64,/);
        if (match) setMimeType(match[1]);
        const base64Data = image.dataUrl.split(',')[1];
        if (base64Data) {
            const size = (base64Data.length * 3 / 4) - (base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0);
            setFileSize(size);
        }
    }
  }, [image, metadata]);

  const handleSaveMetadata = () => {
    if (!image.projectFilePath) return;
    const newMetadata: ImageMetadata = {
        renpyName: renpyName.trim().replace(/\s+/g, '_'),
        tags: tags.split(',').map(t => t.trim().replace(/\s+/g, '_')).filter(Boolean),
        projectSubfolder: subfolder.trim(),
    };
    onUpdateMetadata(image.projectFilePath, newMetadata);
  };
  
  const handleCopyToProject = () => {
    const newMetadata: ImageMetadata = {
        renpyName: renpyName.trim().replace(/\s+/g, '_'),
        tags: tags.split(',').map(t => t.trim().replace(/\s+/g, '_')).filter(Boolean),
        projectSubfolder: subfolder.trim(),
    };
    onCopyToProject(image.filePath, newMetadata);
  }

  const renpyTag = `image ${renpyName} ${tags.split(',').map(t => t.trim()).filter(Boolean).join(' ')}`.trim().replace(/\s+/g, ' ');

  const onionSkinImage = useMemo(() => {
      if (!onionSkinImageId) return null;
      return allImages.find(img => img.filePath === onionSkinImageId);
  }, [onionSkinImageId, allImages]);

  // Filter out the current image from the onion skin options
  const onionSkinOptions = useMemo(() => {
      return allImages
        .filter(img => img.filePath !== image.filePath)
        .sort((a, b) => a.fileName.localeCompare(b.fileName));
  }, [allImages, image.filePath]);

  return (
    <div className="w-full h-full flex bg-gray-100 dark:bg-gray-900 overflow-hidden">
      <div className="flex-grow min-w-0 relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCc+PHJlY3Qgd2lkdGg9JzEwJyBoZWlnaHQ9JzEwJyBmaWxsPSIjZjBmMGYwIiAvPjxyZWN0IHg9JzEwJyB5PScxMCcgd2lkdGg9JzEwJyBoZWlnaHQ9JzEwJyBmaWxsPSIjZjBmMGYwIiAvPjwvc3ZnPg==')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCc+PHJlY3Qgd2lkdGg9JzEwJyBoZWlnaHQ9JzEwJyBmaWxsPSIjMjcyNzJhIiAvPjxyZWN0IHg9JzEwJyB5PScxMCcgd2lkdGg9JzEwJyBoZWlnaHQ9JzEwJyBmaWxsPSIjMjcyNzJhIiAvPjwvc3ZnPg==')]">
        <div className="absolute inset-0 overflow-auto overscroll-contain flex items-center justify-center p-4">
          <div className="relative inline-block">
            {/* Onion Skin Layer */}
            {onionSkinImage && showOnionSkin && (
                <img 
                    src={onionSkinImage.dataUrl} 
                    alt="Onion Skin" 
                    className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none z-10"
                    style={{ opacity: onionSkinOpacity }}
                />
            )}
            {/* Main Image */}
            <img src={image.dataUrl} alt={image.fileName} className="max-w-full max-h-[90vh] object-contain relative z-0 shadow-lg" />
          </div>
        </div>
      </div>
      <aside className="w-80 flex-shrink-0 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col space-y-4 overflow-y-auto overscroll-contain">
        
        {/* Onion Skin Controls */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                    Compare / Alignment
                </h3>
                <button 
                    onClick={() => setShowOnionSkin(!showOnionSkin)} 
                    disabled={!onionSkinImageId}
                    className={`text-xs px-2 py-0.5 rounded border ${showOnionSkin ? 'bg-indigo-200 text-indigo-800 border-indigo-300' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                >
                    {showOnionSkin ? 'ON' : 'OFF'}
                </button>
            </div>
            
            <div className="space-y-2">
                <select 
                    value={onionSkinImageId} 
                    onChange={(e) => setOnionSkinImageId(e.target.value)}
                    className="w-full text-xs p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                >
                    <option value="">-- Select Image to Overlay --</option>
                    {onionSkinOptions.map(img => (
                        <option key={img.filePath} value={img.filePath}>{img.fileName}</option>
                    ))}
                </select>
                
                {onionSkinImageId && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-500">
                            <span>Opacity</span>
                            <span>{Math.round(onionSkinOpacity * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="1" step="0.05" 
                            value={onionSkinOpacity}
                            onChange={(e) => setOnionSkinOpacity(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 accent-indigo-600"
                        />
                    </div>
                )}
            </div>
        </div>

        <h2 className="text-lg font-bold border-b pb-2 border-gray-200 dark:border-gray-700">Image Properties</h2>
        
        <div className="space-y-3">
            <MetadataRow label="File Path" value={image.filePath} />
            {image.lastModified && <MetadataRow label="Last Modified" value={new Date(image.lastModified).toLocaleString()} />}
            <MetadataRow label="Dimensions" value={dimensions ? `${dimensions.w} x ${dimensions.h} px` : 'Loading...'} />
            <MetadataRow label="File Size" value={fileSize !== null ? formatBytes(fileSize) : 'Loading...'} />
            <MetadataRow label="File Type" value={mimeType || 'N/A'} />
            <MetadataRow label="Project Status" value={image.isInProject ? 'In Project' : 'External'} />
        </div>

        <div className="border-t pt-4 border-gray-200 dark:border-gray-700 space-y-4">
             <h3 className="text-md font-semibold">Ren'Py Definition</h3>
            <div>
                <label htmlFor="renpyName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Ren'Py Name</label>
                <input
                    id="renpyName"
                    type="text"
                    value={renpyName}
                    onChange={e => setRenpyName(e.target.value)}
                    placeholder="e.g., eileen"
                    className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                />
                 <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The short name for the image in code.</p>
            </div>

            <div>
                <label htmlFor="tags" className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags</label>
                <input
                    id="tags"
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="e.g., happy, smiling"
                    className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                />
                 <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Comma-separated list of tags.</p>
            </div>

            <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-md">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Generated Tag:</p>
                <code className="text-sm font-mono">{renpyTag}</code>
            </div>
        </div>
        
        <div className="flex-grow"></div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
            <h3 className="font-semibold">Project Settings</h3>
             <div>
                <label htmlFor="subfolder" className="text-sm font-medium text-gray-700 dark:text-gray-300">Project Subfolder</label>
                <div className="flex items-center mt-1">
                    <span className="text-sm text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-2 rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600">game/images/</span>
                    <input
                        id="subfolder"
                        type="text"
                        value={subfolder}
                        onChange={e => setSubfolder(e.target.value)}
                        placeholder="e.g., characters/eileen"
                        className="flex-grow p-2 rounded-r-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                 <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Optional subfolder to copy this image into.</p>
            </div>
            {image.isInProject ? (
                 <button 
                    onClick={handleSaveMetadata}
                    className="w-full py-2 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors"
                >
                    Save Metadata
                </button>
            ) : (
                <button 
                    onClick={handleCopyToProject}
                    className="w-full py-2 px-4 rounded-md bg-green-600 hover:bg-green-700 text-white font-bold transition-colors"
                >
                    Copy to Project
                </button>
            )}
        </div>

      </aside>
    </div>
  );
};

export default ImageEditorView;
