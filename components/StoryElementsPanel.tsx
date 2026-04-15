/**
 * @file StoryElementsPanel.tsx
 * @description Tabbed sidebar panel aggregating all story element managers (~700 lines).
 * Key features: tabs for Characters, Variables, Images, Audio, Screens, Snippets, and Menu
 * Templates; each tab hosts the corresponding manager component with virtualised lists.
 * Integration: rendered in the right sidebar of `App.tsx`; receives all asset and analysis data
 * as props; actions (add/edit/delete/import) propagate back to `App.tsx` `useImmer` state.
 */
import React, { useState, useMemo, useEffect } from 'react';
import type { Character, Variable, ProjectImage, ImageMetadata, RenpyAudio, AudioMetadata, RenpyAnalysisResult, UserSnippet, MenuTemplate, ProjectSettings } from '../types';
import { useVirtualList } from '../hooks/useVirtualList';

// p-2 (16px) + color dot/name/tag rows (~36px) + space-y-2 gap (8px)
const CHAR_ITEM_HEIGHT = 60;
import VariableManager from './VariableManager';
import ImageManager from './ImageManager';
import AudioManager from './AudioManager';
import SnippetManager from './SnippetManager';
import ScreenManager from './ScreenManager';
import { MenuTemplateManager } from './MenuTemplateManager';

type CategoryId = 'storyData' | 'assets' | 'composers' | 'tools';
type SubTabId =
    | 'characters' | 'variables' | 'screens'  // storyData
    | 'images' | 'audio'                       // assets
    | 'scenes' | 'imagemaps' | 'screenLayouts' // composers
    | 'snippets' | 'menuTemplates';            // tools

interface TabCategory {
    id: CategoryId;
    label: string;
    subTabs: { id: SubTabId; label: string }[];
}

const TAB_CATEGORIES: TabCategory[] = [
    {
        id: 'storyData',
        label: 'Story',
        subTabs: [
            { id: 'characters', label: 'Characters' },
            { id: 'variables', label: 'Variables' },
            { id: 'screens', label: 'Screens' },
        ],
    },
    {
        id: 'assets',
        label: 'Assets',
        subTabs: [
            { id: 'images', label: 'Images' },
            { id: 'audio', label: 'Audio' },
        ],
    },
    {
        id: 'composers',
        label: 'Compose',
        subTabs: [
            { id: 'scenes', label: 'Scenes' },
            { id: 'imagemaps', label: 'ImageMaps' },
            { id: 'screenLayouts', label: 'Screen Layouts' },
        ],
    },
    {
        id: 'tools',
        label: 'Tools',
        subTabs: [
            { id: 'snippets', label: 'Snippets' },
            { id: 'menuTemplates', label: 'Menus' },
        ],
    },
];

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

    // Menu Template Props
    menuTemplates: MenuTemplate[];
    onCreateMenuTemplate: () => void;
    onEditMenuTemplate: (template: MenuTemplate) => void;
    onDeleteMenuTemplate: (templateId: string) => void;

    // Tab/Subsection State Props
    projectSettings: ProjectSettings;
    onUpdateProjectSettings: (updater: (draft: ProjectSettings) => void) => void;
    hasProject: boolean;
}

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
    menuTemplates, onCreateMenuTemplate, onEditMenuTemplate, onDeleteMenuTemplate,
    projectSettings, onUpdateProjectSettings, hasProject,
}) => {
    const [activeCategory, setActiveCategory] = useState<CategoryId>(
        projectSettings.storyElementsTabState?.activeTab ?? 'storyData'
    );
    const [activeSubTab, setActiveSubTab] = useState<SubTabId>(
        projectSettings.storyElementsTabState?.activeSubTab ?? 'characters'
    );

    useEffect(() => {
        onUpdateProjectSettings(draft => {
            draft.storyElementsTabState = { activeTab: activeCategory, activeSubTab };
        });
    }, [activeCategory, activeSubTab, onUpdateProjectSettings]);

    // When category changes, switch to first sub-tab of that category
    const handleCategoryChange = (categoryId: CategoryId) => {
        setActiveCategory(categoryId);
        const category = TAB_CATEGORIES.find(c => c.id === categoryId);
        if (category && category.subTabs.length > 0) {
            setActiveSubTab(category.subTabs[0].id);
        }
    };

    const imagesArray = useMemo(() => Array.from(projectImages.values()), [projectImages]);
    const audiosArray = useMemo(() => Array.from(projectAudios.values()), [projectAudios]);

    const { characters, characterUsage } = analysisResult;
    const characterList = useMemo(
        () => Array.from(characters.values()).sort((a: Character, b: Character) => a.name.localeCompare(b.name)),
        [characters],
    );
    const { containerRef: charContainerRef, handleScroll: charHandleScroll, virtualItems: charVirtualItems, totalHeight: charTotalHeight } = useVirtualList(characterList, CHAR_ITEM_HEIGHT);

    const handleCharacterDragStart = (e: React.DragEvent, char: Character) => {
        e.dataTransfer.setData('application/renpy-dnd', JSON.stringify({ text: `${char.tag} "..."` }));
        e.dataTransfer.setData('text/plain', `${char.tag} "..."`);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const activeTabCategory = TAB_CATEGORIES.find(c => c.id === activeCategory);

    return (
        <div className="h-full bg-secondary text-primary flex flex-col min-h-0">
            {/* Category bar */}
            <div className="flex-none border-b border-primary flex" role="tablist" aria-label="Story Elements categories">
                {TAB_CATEGORIES.map(category => (
                    <button
                        key={category.id}
                        role="tab"
                        aria-selected={activeCategory === category.id}
                        disabled={!hasProject}
                        onClick={() => hasProject && handleCategoryChange(category.id)}
                        className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                            !hasProject
                                ? 'opacity-40 cursor-not-allowed border-transparent text-secondary'
                                : activeCategory === category.id
                                    ? 'border-accent text-accent'
                                    : 'border-transparent text-secondary hover:text-primary hover:border-primary'
                        }`}
                    >
                        {category.label}
                    </button>
                ))}
            </div>

            {/* Sub-tab bar */}
            {activeTabCategory && (
                <div className="flex-none border-b border-primary flex bg-tertiary" role="tablist" aria-label={`${activeTabCategory.label} sections`}>
                    {activeTabCategory.subTabs.map(subTab => (
                        <button
                            key={subTab.id}
                            role="tab"
                            aria-selected={activeSubTab === subTab.id}
                            onClick={() => setActiveSubTab(subTab.id)}
                            className={`flex-1 py-2 text-xs transition-colors ${
                                activeSubTab === subTab.id
                                    ? 'bg-secondary text-primary font-semibold'
                                    : 'text-secondary hover:text-primary hover:bg-secondary/50'
                            }`}
                        >
                            {subTab.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Tab content — full remaining height, scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
                {/* Characters */}
                {activeSubTab === 'characters' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Characters ({characterList.length})</h2>
                            <button onClick={() => onOpenCharacterEditor('new_character')} className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">+ Add</button>
                        </div>
                        {characterList.length === 0 ? (
                            <p className="text-sm text-secondary italic">No characters defined yet.</p>
                        ) : (
                            <div
                                ref={charContainerRef}
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
                                                    <p className="font-semibold truncate text-primary text-sm">{char.name}</p>
                                                    <p className="text-xs text-secondary font-mono truncate">{char.tag}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-1 flex-shrink-0 pl-2">
                                                <span className="text-xs text-secondary mr-2">({characterUsage.get(char.tag) || 0})</span>
                                                <button onClick={() => onFindCharacterUsages(char.tag)} title="Find Usages" className="p-1 text-secondary hover:text-accent rounded" aria-label="Find usages">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                </button>
                                                <button onClick={() => onOpenCharacterEditor(char.tag)} title="Edit Character" className="p-1 text-secondary hover:text-accent rounded" aria-label="Edit character">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* Variables */}
                {activeSubTab === 'variables' && (
                    <div>
                        <h2 className="text-lg font-semibold mb-4">Variables ({analysisResult.variables.size})</h2>
                        <VariableManager
                            analysisResult={analysisResult}
                            onAddVariable={onAddVariable}
                            onFindUsages={onFindVariableUsages}
                            onHoverHighlightStart={onHoverHighlightStart}
                            onHoverHighlightEnd={onHoverHighlightEnd}
                        />
                    </div>
                )}

                {/* Screens */}
                {activeSubTab === 'screens' && (
                    <div>
                        <h2 className="text-lg font-semibold mb-4">Screens ({analysisResult.screens.size})</h2>
                        <ScreenManager
                            screens={analysisResult.screens}
                            onFindDefinition={onFindScreenDefinition}
                        />
                    </div>
                )}


                {/* Images */}
                {activeSubTab === 'images' && (
                    <div>
                        <h2 className="text-lg font-semibold mb-4">Images ({projectImages.size})</h2>
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
                )}

                {/* Audio */}
                {activeSubTab === 'audio' && (
                    <div>
                        <h2 className="text-lg font-semibold mb-4">Audio ({projectAudios.size})</h2>
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
                )}


                {/* Scenes */}
                {activeSubTab === 'scenes' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Scene Compositions ({scenes.length})</h2>
                            <button onClick={() => onCreateScene()} className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">+ New</button>
                        </div>
                        {scenes.length === 0 ? (
                            <p className="text-sm text-secondary italic">No scenes created yet.</p>
                        ) : (
                            <ul className="space-y-2">
                                {scenes.map(scene => (
                                    <li key={scene.id} className="p-3 rounded-md bg-secondary border border-primary flex items-center justify-between group hover:shadow-md transition-shadow">
                                        <div className="flex-grow cursor-pointer" onClick={() => onOpenScene(scene.id)}>
                                            <p className="font-semibold text-sm">{scene.name}</p>
                                        </div>
                                        <button
                                            onClick={() => onDeleteScene(scene.id)}
                                            className="p-1.5 text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete Scene"
                                            aria-label="Delete scene"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* ImageMaps */}
                {activeSubTab === 'imagemaps' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">ImageMaps ({imagemaps.length})</h2>
                            <button onClick={() => onCreateImageMap()} className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">+ New</button>
                        </div>
                        {imagemaps.length === 0 ? (
                            <p className="text-sm text-secondary italic">No imagemaps created yet.</p>
                        ) : (
                            <ul className="space-y-2">
                                {imagemaps.map(imagemap => (
                                    <li key={imagemap.id} className="p-3 rounded-md bg-secondary border border-primary flex items-center justify-between group hover:shadow-md transition-shadow">
                                        <div className="flex-grow cursor-pointer" onClick={() => onOpenImageMap(imagemap.id)}>
                                            <p className="font-semibold text-sm">{imagemap.name}</p>
                                        </div>
                                        <button
                                            onClick={() => onDeleteImageMap(imagemap.id)}
                                            className="p-1.5 text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete ImageMap"
                                            aria-label="Delete imagemap"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* Screen Layouts */}
                {activeSubTab === 'screenLayouts' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Screen Layouts ({screenLayouts.length})</h2>
                            <button onClick={() => onCreateScreenLayout()} className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">+ New</button>
                        </div>
                        {screenLayouts.length === 0 ? (
                            <p className="text-sm text-secondary italic">No screen layouts created yet.</p>
                        ) : (
                            <ul className="space-y-2">
                                {screenLayouts.map(layout => {
                                    const isInCode = analysisResult.screens.has(layout.name);
                                    return (
                                        <li key={layout.id} className="p-3 rounded-md bg-secondary border border-primary flex items-center justify-between group hover:shadow-md transition-shadow">
                                            <div className="flex-grow cursor-pointer min-w-0" onClick={() => onOpenScreenLayout(layout.id)}>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-sm truncate">{layout.name}</p>
                                                    {isInCode && (
                                                        <span className="flex-shrink-0 text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded">
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
                                                        className="p-1.5 text-secondary hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                                        aria-label="Go to definition"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => onDuplicateScreenLayout(layout.id)}
                                                    title="Duplicate"
                                                    className="p-1.5 text-secondary hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                                    aria-label="Duplicate screen layout"
                                                >
                                                    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="5" y="1" width="9" height="11" rx="1.5"/><rect x="1" y="4" width="9" height="11" rx="1.5"/>
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => onDeleteScreenLayout(layout.id)}
                                                    className="p-1.5 text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                                    title="Delete Screen Layout"
                                                    aria-label="Delete screen layout"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}


                {/* Snippets */}
                {activeSubTab === 'snippets' && (
                    <div>
                        <h2 className="text-lg font-semibold mb-4">Code Snippets ({userSnippets?.length ?? 0})</h2>
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

                {/* Menu Templates */}
                {activeSubTab === 'menuTemplates' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Menu Templates ({menuTemplates.length})</h2>
                            <button onClick={onCreateMenuTemplate} className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">+ New</button>
                        </div>
                        <MenuTemplateManager
                            templates={menuTemplates}
                            onCreateTemplate={onCreateMenuTemplate}
                            onEditTemplate={onEditMenuTemplate}
                            onDeleteTemplate={onDeleteMenuTemplate}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StoryElementsPanel;
