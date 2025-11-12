import React, { useState, useEffect } from 'react';
import type { RenpyAudio, AudioMetadata } from '../types';

interface AudioEditorViewProps {
  audio: RenpyAudio;
  metadata?: AudioMetadata;
  onUpdateMetadata: (projectFilePath: string, newMetadata: AudioMetadata) => void;
  onCopyToProject: (sourceFilePath: string, metadata: AudioMetadata) => void;
}

const AudioEditorView: React.FC<AudioEditorViewProps> = ({ audio, metadata, onUpdateMetadata, onCopyToProject }) => {
  const [renpyName, setRenpyName] = useState('');
  const [tags, setTags] = useState('');
  const [subfolder, setSubfolder] = useState('');

  useEffect(() => {
    setRenpyName(metadata?.renpyName || audio.fileName.split('.').slice(0, -1).join('.'));
    setTags((metadata?.tags || []).join(', '));
    setSubfolder(metadata?.projectSubfolder || '');
  }, [audio, metadata]);

  const handleSaveMetadata = () => {
    if (!audio.projectFilePath) return;
    const newMetadata: AudioMetadata = {
        renpyName: renpyName.trim().replace(/\s+/g, '_'),
        tags: tags.split(',').map(t => t.trim().replace(/\s+/g, '_')).filter(Boolean),
        projectSubfolder: subfolder.trim(),
    };
    onUpdateMetadata(audio.projectFilePath, newMetadata);
  };
  
  const handleCopyToProject = () => {
    const newMetadata: AudioMetadata = {
        renpyName: renpyName.trim().replace(/\s+/g, '_'),
        tags: tags.split(',').map(t => t.trim().replace(/\s+/g, '_')).filter(Boolean),
        projectSubfolder: subfolder.trim(),
    };
    onCopyToProject(audio.filePath, newMetadata);
  }

  const renpyTag = `play audio "game/audio/${subfolder ? `${subfolder}/` : ''}${audio.fileName}"`;

  return (
    <div className="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900">
      <div className="flex-grow p-4 flex flex-col items-center justify-center">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">{audio.fileName}</h2>
          <audio controls src={audio.dataUrl} className="w-full max-w-lg">
            Your browser does not support the audio element.
          </audio>
      </div>
      <aside className="w-full h-80 flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex flex-row space-x-8 overflow-y-auto">
        <div className="flex-1 space-y-4 max-w-md">
            <h3 className="text-lg font-bold border-b pb-2 border-gray-200 dark:border-gray-700">File Info</h3>
            <div className="space-y-2 text-sm">
                <p><strong className="font-semibold text-gray-500 dark:text-gray-400">Path:</strong> <code className="break-all">{audio.filePath}</code></p>
                {audio.lastModified && <p><strong className="font-semibold text-gray-500 dark:text-gray-400">Last Modified:</strong> {new Date(audio.lastModified).toLocaleString()}</p>}
            </div>
            <div className="pt-4">
                <h3 className="text-lg font-bold border-b pb-2 border-gray-200 dark:border-gray-700">Ren'Py Definition</h3>
            </div>
            <div>
                <label htmlFor="renpyName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Ren'Py Name</label>
                <input
                    id="renpyName"
                    type="text"
                    value={renpyName}
                    onChange={e => setRenpyName(e.target.value)}
                    placeholder="e.g., town_theme"
                    className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                />
                 <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The short name for the audio in code (optional).</p>
            </div>

            <div>
                <label htmlFor="tags" className="text-sm font-medium text-gray-700 dark:text-gray-300">Tags</label>
                <input
                    id="tags"
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="e.g., happy, upbeat"
                    className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                />
                 <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Comma-separated list of searchable tags.</p>
            </div>
             <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-md">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Example Usage:</p>
                <code className="text-sm font-mono">{renpyTag}</code>
            </div>
        </div>

        <div className="flex-1 space-y-4 border-l border-gray-200 dark:border-gray-700 pl-8 max-w-md">
            <h3 className="text-lg font-bold border-b pb-2 border-gray-200 dark:border-gray-700">Project Settings</h3>
             <div>
                <label htmlFor="subfolder" className="text-sm font-medium text-gray-700 dark:text-gray-300">Project Subfolder</label>
                <div className="flex items-center mt-1">
                    <span className="text-sm text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-2 rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600">game/audio/</span>
                    <input
                        id="subfolder"
                        type="text"
                        value={subfolder}
                        onChange={e => setSubfolder(e.target.value)}
                        placeholder="e.g., sfx/footsteps"
                        className="flex-grow p-2 rounded-r-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                 <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Optional subfolder to copy this audio file into.</p>
            </div>
            {audio.isInProject ? (
                 <button 
                    onClick={handleSaveMetadata}
                    className="w-full py-2 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors"
                >
                    Save Metadata & Move File
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

export default AudioEditorView;