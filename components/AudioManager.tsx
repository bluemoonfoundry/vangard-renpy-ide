
import React, { useState, useMemo } from 'react';
import type { RenpyAudio, AudioMetadata } from '../types';
import AudioContextMenu from './AudioContextMenu';

interface AudioManagerProps {
  audios: RenpyAudio[];
  metadata: Map<string, AudioMetadata>;
  scanDirectories: string[];
  onAddScanDirectory: () => void;
  onCopyAudiosToProject: (sourceFilePaths: string[]) => void;
  onOpenAudioEditor: (filePath: string) => void;
  isFileSystemApiSupported: boolean;
}

const AudioItem: React.FC<{
  audio: RenpyAudio;
  isSelected: boolean;
  onSelect: (filePath: string, isSelected: boolean) => void;
  onDoubleClick: (filePath: string) => void;
  onContextMenu: (event: React.MouseEvent, audio: RenpyAudio) => void;
}> = ({ audio, isSelected, onSelect, onDoubleClick, onContextMenu }) => {
  const borderClass = audio.isInProject ? 'border-red-500 dark:border-red-400' : 'border-transparent';
  const selectionClass = isSelected ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-gray-50 dark:ring-offset-gray-900' : '';

  return (
    <div
      className={`relative p-2 bg-gray-200 dark:bg-gray-700 rounded-md cursor-pointer group transition-all duration-150 border-2 ${borderClass} ${selectionClass} flex items-center space-x-2`}
      title={audio.filePath}
      onClick={() => onSelect(audio.filePath, isSelected)}
      onDoubleClick={() => onDoubleClick(audio.filePath)}
      onContextMenu={(e) => onContextMenu(e, audio)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" /></svg>
      <p className="text-sm font-mono truncate">{audio.fileName}</p>
    </div>
  );
};

const AudioManager: React.FC<AudioManagerProps> = ({ audios, metadata, scanDirectories, onAddScanDirectory, onCopyAudiosToProject, onOpenAudioEditor, isFileSystemApiSupported }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedAudioPaths, setSelectedAudioPaths] = useState(new Set<string>());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; audio: RenpyAudio } | null>(null);

  const sources = useMemo(() => {
    return ['Project (game/audio)', ...scanDirectories];
  }, [scanDirectories]);

  const filteredAudios = useMemo(() => {
    let visibleAudios = audios;

    if (selectedSource !== 'all') {
      if (selectedSource === 'Project (game/audio)') {
        visibleAudios = visibleAudios.filter(aud => aud.isInProject);
      } else {
        visibleAudios = visibleAudios.filter(aud => aud.filePath.startsWith(`${selectedSource}/`));
      }
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      visibleAudios = visibleAudios.filter(aud =>
        aud.fileName.toLowerCase().includes(lowerSearch) ||
        (metadata.get(aud.projectFilePath || '')?.renpyName || '').toLowerCase().includes(lowerSearch) ||
        (metadata.get(aud.projectFilePath || '')?.tags || []).some(tag => tag.toLowerCase().includes(lowerSearch))
      );
    }
    return visibleAudios;
  }, [audios, metadata, searchTerm, selectedSource]);

  const handleSelectAudio = (filePath: string, isCurrentlySelected: boolean) => {
    setSelectedAudioPaths(prev => {
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
    onCopyAudiosToProject(Array.from(selectedAudioPaths));
    setSelectedAudioPaths(new Set());
  };

  const handleContextMenu = (event: React.MouseEvent, audio: RenpyAudio) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      audio,
    });
  };

  const getRenpyAudioTag = (audio: RenpyAudio): string => {
    const meta = metadata.get(audio.projectFilePath || audio.filePath);
    const name = meta?.renpyName || audio.fileName.split('.').slice(0, -1).join('.');
    const tags = (meta?.tags || []).join(' ');
    return `${name}${tags ? ` ${tags}` : ''}`.trim().replace(/\s+/g, ' ');
  };

  const handleContextMenuSelect = (type: 'play' | 'queue') => {
    if (!contextMenu) return;
    const filePath = contextMenu.audio.projectFilePath || contextMenu.audio.filePath;
    const command = `${type} audio "${filePath}"`;
    navigator.clipboard.writeText(command);
    setContextMenu(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Audio Sources</h3>
          <div className="space-y-2">
            <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)} className="w-full p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="all">All Sources</option>
              {sources.map(source => <option key={source} value={source}>{source}</option>)}
            </select>
            <button
              onClick={onAddScanDirectory}
              disabled={!isFileSystemApiSupported}
              title={isFileSystemApiSupported ? "Add external folder to scan for audio" : "Open a project folder to enable this feature"}
              className="w-full px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              <span>Add Directory to Scan</span>
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search audio by name or tag..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-grow p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={handleCopySelected}
            disabled={selectedAudioPaths.size === 0}
            className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Copy to Project ({selectedAudioPaths.size})
          </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto -mr-4 pr-4 pt-4">
        <div className="space-y-2">
          {filteredAudios.map(audio => (
            <AudioItem
              key={audio.filePath}
              audio={audio}
              isSelected={selectedAudioPaths.has(audio.filePath)}
              onSelect={handleSelectAudio}
              onDoubleClick={onOpenAudioEditor}
              onContextMenu={handleContextMenu}
            />
          ))}
        </div>
        {audios.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No audio found. Add a source directory to get started.</p>}
        {audios.length > 0 && filteredAudios.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No audio files match your filter.</p>}
      </div>
      {contextMenu && (
        <AudioContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          filePath={contextMenu.audio.projectFilePath || contextMenu.audio.filePath}
          onSelect={handleContextMenuSelect}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default AudioManager;
