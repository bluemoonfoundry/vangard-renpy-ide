import React, { useState, useMemo } from 'react';
import type { Character, Variable, ProjectImage, ImageMetadata, RenpyAudio, AudioMetadata, RenpyScreen, RenpyAnalysisResult } from '../types';
import VariableManager from './VariableManager';
import ImageManager from './ImageManager';
import AudioManager from './AudioManager';
import SnippetManager from './SnippetManager';
import ScreenManager from './ScreenManager';

interface StoryElementsPanelProps {
    analysisResult: RenpyAnalysisResult;
    // Character callbacks
    onOpenCharacterEditor: (tag: string) => void;
    onFindCharacterUsages: (tag: string) => void;
    // Variable callbacks
    onAddVariable: (variable: Omit<Variable, 'definedInBlockId' | 'line'>) => void;
    onFindVariableUsages: (variableName: string) => void;
    // Screen callbacks
    onAddScreen: (screenName: string) => void;
    onFindScreenDefinition: (screenName: string) => void;
    // Image props & callbacks
    projectImages: Map<string, ProjectImage>;
    imageMetadata: Map<string, ImageMetadata>;
    imageScanDirectories: Map<string, FileSystemDirectoryHandle>;
    onAddImageScanDirectory: () => void;
    onRemoveImageScanDirectory: (dirName: string) => void;
    onCopyImagesToProject: (sourceFilePaths: string[]) => void;
    onUpdateImageMetadata: (filePath: string, newMetadata: ImageMetadata) => void;
    onOpenImageEditor: (filePath: string) => void;
    imagesLastScanned: number | null;
    isRefreshingImages: boolean;
    onRefreshImages: () => void;
    // Audio props & callbacks
    projectAudios: Map<string, RenpyAudio>;
    audioMetadata: Map<string, AudioMetadata>;
    audioScanDirectories: Map<string, FileSystemDirectoryHandle>;
    onAddAudioScanDirectory: () => void;
    onRemoveAudioScanDirectory: (dirName: string) => void;
    onCopyAudiosToProject: (sourceFilePaths: string[]) => void;
    onUpdateAudioMetadata: (filePath: string, newMetadata: AudioMetadata) => void;
    onOpenAudioEditor: (filePath: string) => void;
    audiosLastScanned: number | null;
    isRefreshingAudios: boolean;
    onRefreshAudios: () => void;
    isFileSystemApiSupported: boolean;
    // Hover highlight callbacks
    onHoverHighlightStart: (key: string, type: 'character' | 'variable') => void;
    onHoverHighlightEnd: () => void;
}

type Tab = 'characters' | 'variables' | 'images' | 'audio' | 'screens' | 'snippets';

const TabButton: React.FC<{
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, count, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 text-center py-2 px-1 text-sm font-semibold border-b-2 transition-colors duration-200 ${
      isActive
        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
        : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100'
    }`}
  >
    {label} {typeof count !== 'undefined' && `(${count})`}
  </button>
);

const StoryElementsPanel: React.FC<StoryElementsPanelProps> = ({
    analysisResult,
    onOpenCharacterEditor, onFindCharacterUsages,
    onAddVariable, onFindVariableUsages,
    onAddScreen, onFindScreenDefinition,
    projectImages, imageMetadata, onAddImageScanDirectory, onRemoveImageScanDirectory, imageScanDirectories, onCopyImagesToProject, onUpdateImageMetadata, onOpenImageEditor, imagesLastScanned, isRefreshingImages, onRefreshImages,
    projectAudios, audioMetadata, onAddAudioScanDirectory, onRemoveAudioScanDirectory, audioScanDirectories, onCopyAudiosToProject, onUpdateAudioMetadata, onOpenAudioEditor, audiosLastScanned, isRefreshingAudios, onRefreshAudios,
    isFileSystemApiSupported,
    onHoverHighlightStart, onHoverHighlightEnd
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('characters');

    const { characters, characterUsage } = analysisResult;
    const characterList = Array.from(characters.values()).sort((a: Character, b: Character) => a.name.localeCompare(b.name));

    return (
        <div className="h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
            <header className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold">Story Elements</h2>
            </header>
            <nav className="flex-shrink-0 flex border-b border-gray-200 dark:border-gray-700">
                <TabButton label="Characters" count={characterList.length} isActive={activeTab === 'characters'} onClick={() => setActiveTab('characters')} />
                <TabButton label="Variables" count={analysisResult.variables.size} isActive={activeTab === 'variables'} onClick={() => setActiveTab('variables')} />
                <TabButton label="Images" count={projectImages.size} isActive={activeTab === 'images'} onClick={() => setActiveTab('images')} />
                <TabButton label="Audio" count={projectAudios.size} isActive={activeTab === 'audio'} onClick={() => setActiveTab('audio')} />
                <TabButton label="Screens" count={analysisResult.screens.size} isActive={activeTab === 'screens'} onClick={() => setActiveTab('screens')} />
                <TabButton label="Snippets" isActive={activeTab === 'snippets'} onClick={() => setActiveTab('snippets')} />
            </nav>
            <main className="flex-grow p-4 overflow-y-auto">
                {activeTab === 'characters' && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">Characters ({characterList.length})</h3>
                            <button onClick={() => onOpenCharacterEditor('new_character')} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">+ Add</button>
                        </div>
                        <ul className="space-y-2">
                            {characterList.map((char: Character) => (
                                <li
                                  key={char.tag}
                                  className="p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                                  onMouseEnter={() => onHoverHighlightStart(char.tag, 'character')}
                                  onMouseLeave={onHoverHighlightEnd}
                                >
                                    <div className="flex items-center space-x-3 min-w-0">
                                        <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: char.color }}></div>
                                        <div className="min-w-0">
                                            <p className="font-semibold truncate">{char.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{char.tag}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1 flex-shrink-0 pl-2">
                                        <span className="text-xs text-gray-400 dark:text-gray-500 mr-2">({characterUsage.get(char.tag) || 0} lines)</span>
                                        <button onClick={() => onFindCharacterUsages(char.tag)} title="Find Usages" className="p-1 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </button>
                                        <button onClick={() => onOpenCharacterEditor(char.tag)} title="Edit Character" className="p-1 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                        </button>
                                    </div>
                                </li>
                            ))}
                            {characterList.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No characters defined yet.</p>}
                        </ul>
                    </div>
                )}
                {activeTab === 'variables' && (
                    <VariableManager
                        analysisResult={analysisResult}
                        onAddVariable={onAddVariable}
                        onFindUsages={onFindVariableUsages}
                        onHoverHighlightStart={onHoverHighlightStart}
                        onHoverHighlightEnd={onHoverHighlightEnd}
                    />
                )}
                {activeTab === 'images' && (
                    <ImageManager
                        images={Array.from(projectImages.values())}
                        metadata={imageMetadata}
                        scanDirectories={Array.from(imageScanDirectories.keys())}
                        onAddScanDirectory={onAddImageScanDirectory}
                        onRemoveScanDirectory={onRemoveImageScanDirectory}
                        onCopyImagesToProject={onCopyImagesToProject}
                        onOpenImageEditor={onOpenImageEditor}
                        isFileSystemApiSupported={isFileSystemApiSupported}
                        lastScanned={imagesLastScanned}
                        isRefreshing={isRefreshingImages}
                        onRefresh={onRefreshImages}
                    />
                )}
                {activeTab === 'audio' && (
                    <AudioManager
                        audios={Array.from(projectAudios.values())}
                        metadata={audioMetadata}
                        scanDirectories={Array.from(audioScanDirectories.keys())}
                        onAddScanDirectory={onAddAudioScanDirectory}
                        onRemoveScanDirectory={onRemoveAudioScanDirectory}
                        onCopyAudiosToProject={onCopyAudiosToProject}
                        onOpenAudioEditor={onOpenAudioEditor}
                        isFileSystemApiSupported={isFileSystemApiSupported}
                        lastScanned={audiosLastScanned}
                        isRefreshing={isRefreshingAudios}
                        onRefresh={onRefreshAudios}
                    />
                )}
                {activeTab === 'screens' && (
                    <ScreenManager
                        screens={analysisResult.screens}
                        onAddScreen={onAddScreen}
                        onFindDefinition={onFindScreenDefinition}
                    />
                )}
                {activeTab === 'snippets' && (
                    <SnippetManager />
                )}
            </main>
        </div>
    );
};

export default StoryElementsPanel;