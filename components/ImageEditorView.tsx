
import React, { useState, useEffect } from 'react';
import type { ProjectImage, ImageMetadata } from '../types';

interface ImageEditorViewProps {
  image: ProjectImage;
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

const ImageEditorView: React.FC<ImageEditorViewProps> = ({ image, metadata, onUpdateMetadata, onCopyToProject }) => {
  const [renpyName, setRenpyName] = useState('');
  const [tags, setTags] = useState('');
  const [subfolder, setSubfolder] = useState('');

  const [dimensions, setDimensions] = useState<{ w: number, h: number } | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);

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
    img.src = image.dataUrl;

    if (image.fileHandle) {
        image.fileHandle.getFile().then(file => {
            setFileSize(file.size);
            setMimeType(file.type);
        });
    } else {
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

  return (
    <div className="w-full h-full flex bg-gray-100 dark:bg-gray-900">
      <div className="flex-grow min-w-0 relative">
        <div className="absolute inset-0 overflow-auto flex items-center justify-center p-4">
          <img src={image.dataUrl} alt={image.fileName} className="max-w-full max-h-full object-contain" />
        </div>
      </div>
      <aside className="w-80 flex-shrink-0 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col space-y-4 overflow-y-auto">
        <h2 className="text-lg font-bold border-b pb-2 border-gray-200 dark:border-gray-700">Image Properties</h2>
        
        <div className="space-y-3">
            <MetadataRow label="File Path" value={image.filePath} />
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