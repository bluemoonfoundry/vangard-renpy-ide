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
import type { PaletteColor } from '../lib/colorPalettes';
import { useVirtualList } from '../hooks/useVirtualList';

// p-2 (16px) + color dot/name/tag rows (~36px) + space-y-2 gap (8px)
const CHAR_ITEM_HEIGHT = 60;
import VariableManager from './VariableManager';
import ImageManager from './ImageManager';
import AudioManager from './AudioManager';
import SnippetManager from './SnippetManager';
import ScreenManager from './ScreenManager';
import { MenuTemplateManager } from './MenuTemplateManager';
import ColorPickerPane from './ColorPickerPane';

type SubTabId =
    | 'characters' | 'variables' | 'screens'
    | 'images' | 'audio'
    | 'scenes' | 'imagemaps' | 'screenLayouts'
    | 'snippets' | 'menuTemplates' | 'colorPalette';

interface SubPane {
    id: SubTabId;
    tooltip: string;
    icon: React.ReactNode;
}

const SUB_PANES: SubPane[] = [
    {
        id: 'characters',
        tooltip: 'Characters',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
    },
    {
        id: 'variables',
        tooltip: 'Variables',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.745 3A23.933 23.933 0 003 12c0 3.183.62 6.22 1.745 9M19.5 3c.967 2.782 1.5 5.771 1.5 9s-.533 6.218-1.5 9M8.25 8.885l1.444-.89a.75.75 0 011.105.402l2.402 7.206a.75.75 0 001.104.401l1.445-.889m-8.25.75l.213.09a1.687 1.687 0 002.062-.617l4.45-6.676a1.688 1.688 0 012.062-.618l.213.09" /></svg>,
    },
    {
        id: 'screens',
        tooltip: 'Screens',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" /></svg>,
    },
    {
        id: 'images',
        tooltip: 'Images',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>,
    },
    {
        id: 'audio',
        tooltip: 'Audio',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>,
    },
    {
        id: 'scenes',
        tooltip: 'Scene Compositions',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-1.5-3.75h-6" /></svg>,
    },
    {
        id: 'imagemaps',
        tooltip: 'Image Maps',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
    },
    {
        id: 'screenLayouts',
        tooltip: 'Screen Layouts',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" /></svg>,
    },
    {
        id: 'snippets',
        tooltip: 'Code Snippets',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875c-1.243 0-2.25.84-2.25 1.875 0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.036 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.369 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" /></svg>,
    },
    {
        id: 'menuTemplates',
        tooltip: 'Menu Templates',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>,
    },
    {
        id: 'colorPalette',
        tooltip: 'Color Palette',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" /></svg>,
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
    userSnippets?: UserSnippet[];
    onCreateSnippet?: () => void;
    onEditSnippet?: (snippet: UserSnippet) => void;
    onDeleteSnippet?: (snippetId: string) => void;
    projectRootPath?: string | null;

    // Menu Template Props
    menuTemplates: MenuTemplate[];
    onCreateMenuTemplate: () => void;
    onEditMenuTemplate: (template: MenuTemplate) => void;
    onDeleteMenuTemplate: (templateId: string) => void;

    // Color Picker
    onInsertColorAtCursor: (hex: string) => void;
    onWrapColorSelection: (hex: string) => void;
    onCopyColorHex: (hex: string) => void;
    projectColors?: PaletteColor[];

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
    userSnippets, onCreateSnippet, onEditSnippet, onDeleteSnippet, projectRootPath,
    menuTemplates, onCreateMenuTemplate, onEditMenuTemplate, onDeleteMenuTemplate,
    onInsertColorAtCursor,
    onWrapColorSelection,
    onCopyColorHex,
    projectColors,
    projectSettings, onUpdateProjectSettings, hasProject,
}) => {
    const [activeSubTab, setActiveSubTab] = useState<SubTabId>(
        projectSettings.storyElementsTabState?.activeSubTab ?? 'characters'
    );

    useEffect(() => {
        onUpdateProjectSettings(draft => {
            if (!draft.storyElementsTabState) draft.storyElementsTabState = {} as typeof draft.storyElementsTabState;
            draft.storyElementsTabState.activeSubTab = activeSubTab;
        });
    }, [activeSubTab, onUpdateProjectSettings]);

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

    return (
        <div className="h-full bg-secondary text-primary flex flex-row min-h-0" data-tutorial="story-elements">
            {/* Vertical icon nav */}
            <nav className="flex-none w-12 border-r border-primary flex flex-col overflow-y-auto" role="tablist" aria-label="Story Elements">
                <div className="flex flex-col mx-auto mt-14 mb-4">
                    {SUB_PANES.map(pane => (
                        <button
                            key={pane.id}
                            role="tab"
                            aria-selected={activeSubTab === pane.id}
                            disabled={!hasProject}
                            onClick={() => hasProject && setActiveSubTab(pane.id)}
                            title={pane.tooltip}
                            aria-label={pane.tooltip}
                            className={`flex-none w-full h-12 flex items-center justify-center transition-colors border-l-2 ${
                                !hasProject
                                    ? 'opacity-40 cursor-not-allowed border-transparent text-secondary'
                                    : activeSubTab === pane.id
                                        ? 'border-accent text-accent bg-accent/10'
                                        : 'border-transparent text-secondary hover:text-primary hover:bg-primary/5'
                            }`}
                        >
                            <span className="[&>svg]:h-8 [&>svg]:w-8">{pane.icon}</span>
                        </button>
                    ))}
                </div>
            </nav>

            {/* Pane content — full remaining height. Colors pane manages its own scroll internally. */}
            <div className={`flex-1 min-h-0 ${activeSubTab === 'colorPalette' ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain p-4'}`}>
                {/* Characters */}
                {activeSubTab === 'characters' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Characters ({characterList.length})</h2>
                            <button onClick={() => onOpenCharacterEditor('new_character')} className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">+ Add</button>
                        </div>
                        {characterList.length === 0 ? (
                            <p className="text-sm text-secondary italic">Characters bring your story to life. Click 'Add' to create your first one!</p>
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
                                            onDoubleClick={() => onOpenCharacterEditor(char.tag)}
                                            title="Drag to insert dialogue · Double-click to edit"
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
                        <h2 className="text-lg font-semibold mb-4">Code Snippets</h2>
                        <SnippetManager
                            userSnippets={userSnippets}
                            onCreateSnippet={onCreateSnippet}
                            onEditSnippet={onEditSnippet}
                            onDeleteSnippet={onDeleteSnippet}
                            projectRootPath={projectRootPath}
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

                {/* Color Picker — fills the bounded container, manages its own internal layout */}
                {activeSubTab === 'colorPalette' && (
                    <ColorPickerPane
                        onInsertAtCursor={onInsertColorAtCursor}
                        onWrapSelection={onWrapColorSelection}
                        onCopyHex={onCopyColorHex}
                        projectColors={projectColors}
                    />
                )}
            </div>
        </div>
    );
};

export default StoryElementsPanel;
