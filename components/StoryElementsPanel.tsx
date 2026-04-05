import React, { useState, useMemo } from 'react';
import type { Character, Variable, ProjectImage, ImageMetadata, RenpyAudio, AudioMetadata, RenpyAnalysisResult, UserSnippet } from '../types';
import { useVirtualList } from '../hooks/useVirtualList';

// p-2 (16px) + color dot/name/tag rows (~36px) + space-y-2 gap (8px)
const CHAR_ITEM_HEIGHT = 60;
import VariableManager from './VariableManager';
import ImageManager from './ImageManager';
import AudioManager from './AudioManager';
import SnippetManager from './SnippetManager';
import ScreenManager from './ScreenManager';
import MenuConstructor from './MenuConstructor';

interface StoryElementsPanelProps {
    analysisResult: RenpyAnalysisResult;
    // Character callbacks
    onOpenCharacterEditor: (tag: string) => void;
    onFindCharacterUsages: (tag: string) => void;
    // Variable callbacks
    onAddVariable: (variable: Omit<Variable, 'definedInBlockId' | 'line'>) => void;
    onFindVariableUsages: (variableName: string) => void;
    // Screen callbacks
    onFindScreenDefinition: (screenName: string) => void;
    // Image props & callbacks
    projectImages: Map<string, ProjectImage>;
    imageMetadata: Map<string, ImageMetadata>;
    imageScanDirectories: Map<string, FileSystemDirectoryHandle>;
    onAddImageScanDirectory: () => void;
    onRemoveImageScanDirectory: (dirName: string) => void;
    onCopyImagesToProject: (sourceFilePaths: string[]) => void;
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
    onOpenAudioEditor: (filePath: string) => void;
    audiosLastScanned: number | null;
    isRefreshingAudios: boolean;
    onRefreshAudios: () => void;
    isFileSystemApiSupported: boolean;
    // Hover highlight callbacks
    onHoverHighlightStart: (key: string, type: 'character' | 'variable') => void;
    onHoverHighlightEnd: () => void;
    
    // Scene Props
    scenes: { id: string, name: string }[];
    onOpenScene: (sceneId: string) => void;
    onCreateScene: (name?: string) => void;
    onDeleteScene: (sceneId: string) => void;

    // ImageMap Props
    imagemaps: { id: string, name: string }[];
    onOpenImageMap: (imagemapId: string) => void;
    onCreateImageMap: (name?: string) => void;
    onDeleteImageMap: (imagemapId: string) => void;

    // Screen Layout Props
    screenLayouts: { id: string, name: string }[];
    onOpenScreenLayout: (layoutId: string) => void;
    onCreateScreenLayout: (name?: string) => void;
    onDeleteScreenLayout: (layoutId: string) => void;
    onDuplicateScreenLayout: (layoutId: string) => void;

    // Snippet Props
    snippetCategoriesState: Record<string, boolean>;
    onToggleSnippetCategory: (name: string, isOpen: boolean) => void;
    userSnippets?: UserSnippet[];
    onCreateSnippet?: () => void;
    onEditSnippet?: (snippet: UserSnippet) => void;
    onDeleteSnippet?: (snippetId: string) => void;
}

type Tab = 'characters' | 'variables' | 'images' | 'audio' | 'screens' | 'snippets' | 'composers' | 'menus';

const TabButton: React.FC<{
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}> = ({ label, count, isActive, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`flex-none py-2 px-2 text-sm font-semibold border-b-2 transition-colors duration-200 flex items-center justify-center ${
      isActive
        ? 'border-accent text-accent bg-secondary'
        : 'border-transparent text-secondary hover:text-primary hover:bg-tertiary-hover'
    } ${className}`}
  >
    <span>{label}</span>
    {typeof count !== 'undefined' && <span className="ml-1.5 text-xs opacity-70">({count})</span>}
  </button>
);

const StoryElementsPanel: React.FC<StoryElementsPanelProps> = ({
    analysisResult,
    onOpenCharacterEditor, onFindCharacterUsages,
    onAddVariable, onFindVariableUsages,
    onFindScreenDefinition,
    projectImages, imageMetadata, onAddImageScanDirectory, onRemoveImageScanDirectory, imageScanDirectories, onCopyImagesToProject, onOpenImageEditor, imagesLastScanned, isRefreshingImages, onRefreshImages,
    projectAudios, audioMetadata, onAddAudioScanDirectory, onRemoveAudioScanDirectory, audioScanDirectories, onCopyAudiosToProject, onOpenAudioEditor, audiosLastScanned, isRefreshingAudios, onRefreshAudios,
    isFileSystemApiSupported,
    onHoverHighlightStart, onHoverHighlightEnd,
    scenes, onOpenScene, onCreateScene, onDeleteScene,
    imagemaps, onOpenImageMap, onCreateImageMap, onDeleteImageMap,
    screenLayouts, onOpenScreenLayout, onCreateScreenLayout, onDeleteScreenLayout, onDuplicateScreenLayout,
    snippetCategoriesState, onToggleSnippetCategory,
    userSnippets, onCreateSnippet, onEditSnippet, onDeleteSnippet,
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('characters');

    // Memoize Map→Array conversions so child components don't see a new reference
    // on every parent re-render (which would blow their own useMemo caches).
    const imagesArray = useMemo(() => Array.from(projectImages.values()), [projectImages]);
    const audiosArray = useMemo(() => Array.from(projectAudios.values()), [projectAudios]);

    const { characters, characterUsage } = analysisResult;
    const characterList = useMemo(
        () => Array.from(characters.values()).sort((a: Character, b: Character) => a.name.localeCompare(b.name)),
        [characters],
    );
    const { containerRef: charContainerRef, handleScroll: charHandleScroll, virtualItems: charVirtualItems, totalHeight: charTotalHeight } = useVirtualList(characterList, CHAR_ITEM_HEIGHT);

    const handleCharacterDragStart = (e: React.DragEvent, char: Character) => {
        e.dataTransfer.setData('application/renpy-dnd', JSON.stringify({
            text: `${char.tag} "..."`
        }));
        e.dataTransfer.setData('text/plain', `${char.tag} "..."`);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="h-full bg-secondary text-primary flex flex-col min-h-0">
            <header className="flex-none p-4 border-b border-primary">
                <h2 className="text-xl font-bold">Story Elements</h2>
            </header>
            <nav className="flex-none flex flex-wrap border-b border-primary bg-header">
                <TabButton className="flex-grow" label="Chars" count={characterList.length} isActive={activeTab === 'characters'} onClick={() => setActiveTab('characters')} />
                <TabButton className="flex-grow" label="Vars" count={analysisResult.variables.size} isActive={activeTab === 'variables'} onClick={() => setActiveTab('variables')} />
                <TabButton className="flex-grow" label="Img" count={projectImages.size} isActive={activeTab === 'images'} onClick={() => setActiveTab('images')} />
                <TabButton className="flex-grow" label="Snd" count={projectAudios.size} isActive={activeTab === 'audio'} onClick={() => setActiveTab('audio')} />
                <TabButton className="flex-grow" label="Scrn" count={analysisResult.screens.size} isActive={activeTab === 'screens'} onClick={() => setActiveTab('screens')} />
                <TabButton className="flex-grow" label="Composers" count={scenes.length + imagemaps.length + screenLayouts.length} isActive={activeTab === 'composers'} onClick={() => setActiveTab('composers')} />
                <TabButton className="flex-grow" label="Menus" isActive={activeTab === 'menus'} onClick={() => setActiveTab('menus')} />
                <TabButton className="flex-grow" label="Code" isActive={activeTab === 'snippets'} onClick={() => setActiveTab('snippets')} />
            </nav>
            <main className="flex-grow flex flex-col min-h-0 overflow-hidden relative">
                {activeTab === 'characters' && (
                    <div className="flex-grow flex flex-col min-h-0 p-4 gap-3">
                        <div className="flex justify-between items-center flex-none">
                            <h3 className="font-semibold">Characters ({characterList.length})</h3>
                            <button onClick={() => onOpenCharacterEditor('new_character')} className="px-3 py-1 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">+ Add</button>
                        </div>
                        {characterList.length === 0
                            ? <p className="text-sm text-secondary text-center py-4">No characters defined yet.</p>
                            : (
                                <div
                                    ref={charContainerRef}
                                    className="flex-grow overflow-y-auto overscroll-contain"
                                    onScroll={charHandleScroll}
                                >
                                    <div style={{ height: charTotalHeight, position: 'relative' }}>
                                        {charVirtualItems.map(({ item: char, offsetTop }) => (
                                            <div
                                                key={char.tag}
                                                style={{ position: 'absolute', top: offsetTop, left: 0, right: 0, height: CHAR_ITEM_HEIGHT - 8 }}
                                                draggable
                                                onDragStart={(e) => handleCharacterDragStart(e, char)}
                                                className="p-2 rounded-md bg-secondary border border-primary flex items-center justify-between cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                                                onMouseEnter={() => onHoverHighlightStart(char.tag, 'character')}
                                                onMouseLeave={onHoverHighlightEnd}
                                                title="Drag to editor to insert dialogue"
                                            >
                                                <div className="flex items-center space-x-3 min-w-0 pointer-events-none">
                                                    <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: char.color }}></div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold truncate text-primary">{char.name}</p>
                                                        <p className="text-xs text-secondary font-mono truncate">{char.tag}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-1 flex-shrink-0 pl-2">
                                                    <span className="text-xs text-secondary mr-2">({characterUsage.get(char.tag) || 0} lines)</span>
                                                    <button onClick={() => onFindCharacterUsages(char.tag)} title="Find Usages" className="p-1 text-secondary hover:text-accent rounded">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                    </button>
                                                    <button onClick={() => onOpenCharacterEditor(char.tag)} title="Edit Character" className="p-1 text-secondary hover:text-accent rounded">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        }
                    </div>
                )}
                {activeTab === 'variables' && (
                    <div className="flex-grow overflow-y-auto p-4 overscroll-contain min-h-0">
                        <VariableManager
                            analysisResult={analysisResult}
                            onAddVariable={onAddVariable}
                            onFindUsages={onFindVariableUsages}
                            onHoverHighlightStart={onHoverHighlightStart}
                            onHoverHighlightEnd={onHoverHighlightEnd}
                        />
                    </div>
                )}
                {activeTab === 'images' && (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-hidden">
                            <ImageManager
                                images={imagesArray}
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
                        </div>
                    </div>
                )}
                {activeTab === 'audio' && (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-hidden">
                            <AudioManager
                                audios={audiosArray}
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
                        </div>
                    </div>
                )}
                {activeTab === 'screens' && (
                    <div className="flex-grow flex flex-col min-h-0">
                        <ScreenManager
                            screens={analysisResult.screens}
                            onFindDefinition={onFindScreenDefinition}
                        />
                    </div>
                )}
                {activeTab === 'composers' && (
                    <div className="flex-grow overflow-y-auto p-4 overscroll-contain space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">Scene Compositions ({scenes.length})</h3>
                            <button onClick={() => onCreateScene()} className="px-3 py-1 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">+ New Scene</button>
                        </div>
                        <ul className="space-y-2">
                            {scenes.map(scene => (
                                <li key={scene.id} className="p-3 rounded-md bg-tertiary border border-primary flex items-center justify-between group hover:shadow-md transition-shadow">
                                    <div className="flex-grow cursor-pointer" onClick={() => onOpenScene(scene.id)}>
                                        <p className="font-semibold text-sm">{scene.name}</p>
                                    </div>
                                    <button 
                                        onClick={() => onDeleteScene(scene.id)} 
                                        className="p-1 text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete Scene"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </li>
                            ))}
                            {scenes.length === 0 && <p className="text-sm text-secondary text-center py-4">No scenes created yet.</p>}
                        </ul>

                        {/* ImageMaps Section */}
                        <div className="flex justify-between items-center mt-6">
                            <h3 className="font-semibold">ImageMaps ({imagemaps.length})</h3>
                            <button onClick={() => onCreateImageMap()} className="px-3 py-1 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">+ New ImageMap</button>
                        </div>
                        <ul className="space-y-2">
                            {imagemaps.map(imagemap => (
                                <li key={imagemap.id} className="p-3 rounded-md bg-tertiary border border-primary flex items-center justify-between group hover:shadow-md transition-shadow">
                                    <div className="flex-grow cursor-pointer" onClick={() => onOpenImageMap(imagemap.id)}>
                                        <p className="font-semibold text-sm">{imagemap.name}</p>
                                    </div>
                                    <button
                                        onClick={() => onDeleteImageMap(imagemap.id)}
                                        className="p-1 text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete ImageMap"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </li>
                            ))}
                            {imagemaps.length === 0 && <p className="text-sm text-secondary text-center py-4">No imagemaps created yet.</p>}
                        </ul>

                        {/* Screen Layouts Section */}
                        <div className="flex justify-between items-center mt-6">
                            <h3 className="font-semibold">Screen Layouts ({screenLayouts.length})</h3>
                            <button onClick={() => onCreateScreenLayout()} className="px-3 py-1 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">+ New Screen</button>
                        </div>
                        <ul className="space-y-2">
                            {screenLayouts.map(layout => {
                                const isInCode = analysisResult.screens.has(layout.name);
                                return (
                                <li key={layout.id} className="p-3 rounded-md bg-tertiary border border-primary flex items-center justify-between group hover:shadow-md transition-shadow">
                                    <div className="flex-grow cursor-pointer min-w-0" onClick={() => onOpenScreenLayout(layout.id)}>
                                        <div className="flex items-center gap-1.5">
                                            <p className="font-semibold text-sm truncate">{layout.name}</p>
                                            {isInCode && (
                                                <span className="flex-shrink-0 text-[9px] font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-1 py-0.5 rounded">
                                                    in code
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1 flex-shrink-0 pl-2">
                                        {isInCode && (
                                            <button
                                                onClick={() => onFindScreenDefinition(layout.name)}
                                                title="Go to definition"
                                                className="p-1 text-secondary hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onDuplicateScreenLayout(layout.id)}
                                            title="Duplicate"
                                            className="p-1 text-secondary hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                        >
                                            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="5" y="1" width="9" height="11" rx="1.5"/><rect x="1" y="4" width="9" height="11" rx="1.5"/>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => onDeleteScreenLayout(layout.id)}
                                            className="p-1 text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                            title="Delete Screen Layout"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </li>
                                );
                            })}
                            {screenLayouts.length === 0 && <p className="text-sm text-secondary text-center py-4">No screen layouts created yet.</p>}
                        </ul>
                    </div>
                )}
                {activeTab === 'menus' && (
                    <div className="flex-grow h-full overflow-hidden">
                        <MenuConstructor analysisResult={analysisResult} />
                    </div>
                )}
                {activeTab === 'snippets' && (
                    <div className="flex-grow overflow-y-auto p-4 overscroll-contain">
                        <SnippetManager
                            categoriesState={snippetCategoriesState}
                            onToggleCategory={onToggleSnippetCategory}
                            userSnippets={userSnippets}
                            onCreateSnippet={onCreateSnippet}
                            onEditSnippet={onEditSnippet}
                            onDeleteSnippet={onDeleteSnippet}
                        />
                    </div>
                )}
            </main>
        </div>
    );
};

export default StoryElementsPanel;
