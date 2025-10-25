import React, { useState, useMemo } from 'react';
import type { RenpyAudio } from '../types';

interface AudioManagerProps {
  audios: RenpyAudio[];
  onImportAudios: () => void;
  isImportEnabled: boolean;
}

const AudioManager: React.FC<AudioManagerProps> = ({ audios, onImportAudios, isImportEnabled }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAudio, setSelectedAudio] = useState<RenpyAudio | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<{ [key: string]: boolean }>({});
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const filteredAudios = useMemo(() => {
    if (!searchTerm) return audios;
    return audios.filter(aud => aud.fileName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [audios, searchTerm]);

  const audiosByFolder = useMemo(() => {
    const folders = new Map<string, RenpyAudio[]>();
    filteredAudios.forEach(audio => {
      const pathParts = audio.filePath.split('/');
      const folderPath = pathParts.slice(1, -1).join('/'); // remove "audio/" and filename
      if (!folders.has(folderPath)) {
        folders.set(folderPath, []);
      }
      folders.get(folderPath)!.push(audio);
    });
    return Array.from(folders.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredAudios]);
  
  // Initially expand all folders
  React.useEffect(() => {
    const initialExpansionState: { [key: string]: boolean } = {};
    audiosByFolder.forEach(([folderPath]) => {
      initialExpansionState[folderPath] = true;
    });
    setExpandedFolders(initialExpansionState);
  }, [audios]); // Re-run only when the base audios change

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };
  
  const handleCopyCommand = (filePath: string) => {
    const command = `play audio "${filePath}"`;
    navigator.clipboard.writeText(command);
    setCopiedPath(filePath);
    setTimeout(() => setCopiedPath(null), 1500);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Audio Gallery ({audios.length})</h3>
        <button 
          onClick={onImportAudios}
          disabled={!isImportEnabled}
          title={isImportEnabled ? "Import new audio files" : "Open a project folder to enable audio imports"}
          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          + Import
        </button>
      </div>
      <input
        type="text"
        placeholder="Search audio files..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full mb-4 p-2 rounded bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <div className="flex-grow overflow-y-auto -mr-4 pr-4 space-y-4">
        {audiosByFolder.map(([folderPath, folderAudios]) => {
          const isExpanded = expandedFolders[folderPath] ?? false;
          return (
            <div key={folderPath}>
              <button onClick={() => toggleFolder(folderPath)} className="w-full text-left font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                {folderPath || '(root)'}
              </button>
              {isExpanded && (
                <ul className="space-y-1 pl-2">
                    {folderAudios.map(audio => (
                        <li key={audio.filePath} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between cursor-pointer" onClick={() => setSelectedAudio(audio)}>
                            <div className="flex items-center space-x-2 min-w-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" /></svg>
                                <span className="text-sm font-mono truncate">{audio.fileName}</span>
                            </div>
                             <button 
                                onClick={(e) => { e.stopPropagation(); handleCopyCommand(audio.filePath); }}
                                title="Copy 'play' command" 
                                className="px-2 py-1 text-xs font-semibold rounded bg-gray-200 dark:bg-gray-600 hover:bg-indigo-100 dark:hover:bg-indigo-800"
                            >
                                {copiedPath === audio.filePath ? 'Copied!' : 'Copy'}
                            </button>
                        </li>
                    ))}
                </ul>
              )}
            </div>
          );
        })}
        {audios.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No audio files found in project.</p>}
        {audios.length > 0 && filteredAudios.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No audio files match your search.</p>}
      </div>
      {selectedAudio && (
        <div className="mt-4 p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-md -mx-4 -mb-4">
          <h4 className="font-semibold mb-2">Preview</h4>
          <p className="text-sm font-semibold font-mono mb-2">{selectedAudio.fileName}</p>
          <audio controls src={selectedAudio.dataUrl} className="w-full">
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
    </div>
  );
};

export default AudioManager;