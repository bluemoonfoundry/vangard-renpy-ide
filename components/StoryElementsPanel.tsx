
import React, { useState, useMemo } from 'react';
import type { Character, Variable, ProjectImage, ImageMetadata, RenpyAudio, RenpyScreen, RenpyAnalysisResult } from '../types';
import VariableManager from './VariableManager';
import ImageManager from './ImageManager';
import AudioManager from './AudioManager';
import SnippetManager from './SnippetManager';
import ScreenManager from './ScreenManager';

interface StoryElementsPanelProps {
    analysisResult: RenpyAnalysisResult;
    // Character callbacks
    onAddCharacter: (char: Omit<Character, 'definedInBlockId'>) => void;
    onUpdateCharacter: (oldTag: string, newChar: Character) => void;
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
    scanDirectories: Map<string, FileSystemDirectoryHandle>;
    onAddScanDirectory: () => void;
    onCopyImagesToProject: (sourceFilePaths: string[]) => void;
    onUpdateImageMetadata: (filePath: string, newMetadata: ImageMetadata) => void;
    onOpenImageEditor: (filePath: string) => void;
    // Audio props & callbacks
    audios: RenpyAudio[];
    onImportAudios: () => void;
    isFileSystemApiSupported: boolean;
}

const CharacterEditor: React.FC<{
    character?: Character;
    onSave: (char: Character, oldTag?: string) => void;
    onCancel: () => void;
    existingTags: string[];
}> = ({ character, onSave, onCancel, existingTags }) => {
    const [name, setName] = useState(character?.name || '');
    const [tag, setTag] = useState(character?.tag || '');
    const [color, setColor] = useState(character?.color || '#E57373');
    const [profile, setProfile] = useState(character?.profile || '');
    const [otherArgs, setOtherArgs] = useState<{ key: string; value: string; id: number }[]>([]);
    const [tagError, setTagError] = useState('');

    const isEditing = !!character;

    React.useEffect(() => {
        if (character?.otherArgs) {
            setOtherArgs(Object.entries(character.otherArgs).map(([key, value], index) => ({ key, value, id: index })));
        }
    }, [character]);

    const handleAddArg = () => {
        setOtherArgs([...otherArgs, { key: '', value: '', id: Date.now() }]);
    };

    const handleArgChange = (id: number, field: 'key' | 'value', value: string) => {
        setOtherArgs(otherArgs.map(arg => arg.id === id ? { ...arg, [field]: value } : arg));
    };

    const handleRemoveArg = (id: number) => {
        setOtherArgs(otherArgs.filter(arg => arg.id !== id));
    };

    const handleSave = () => {
        const isTagUnique = !existingTags.some(t => t === tag && t !== character?.tag);
        const isTagValid = /^[a-zA-Z0-9_]+$/.test(tag) && tag.length > 0;

        if (!isTagValid) {
            setTagError('Tag must be a valid variable name (letters, numbers, underscores).');
            return;
        }
        if (!isTagUnique) {
            setTagError('This tag is already in use.');
            return;
        }

        const finalOtherArgs = otherArgs.reduce((acc, arg) => {
            const key = arg.key.trim();
            if (key) {
                acc[key] = arg.value;
            }
            return acc;
        }, {} as Record<string, string>);
        
        const finalCharData = {
            name: name.trim() || 'Unnamed',
            tag: tag,
            color: color,
            profile: profile.trim() ? profile.trim() : undefined,
            otherArgs: Object.keys(finalOtherArgs).length > 0 ? finalOtherArgs : undefined,
        };
        
        if (isEditing && character) {
            onSave({ ...character, ...finalCharData }, character.tag);
        } else {
            onSave({ definedInBlockId: '', ...finalCharData });
        }
    };

    React.useEffect(() => {
        setTagError('');
    }, [tag]);

    return (
        <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg space-y-3">
            <h3 className="font-semibold text-lg">{isEditing ? 'Edit Character' : 'Add New Character'}</h3>
            <div>
                <label className="text-sm font-medium">Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Eileen" className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
                <label className="text-sm font-medium">Code Tag</label>
                <input type="text" value={tag} onChange={e => setTag(e.target.value)} placeholder="e.g., e" className={`w-full mt-1 p-2 rounded bg-white dark:bg-gray-800 border ${tagError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} focus:ring-indigo-500 focus:border-indigo-500`} />
                {tagError && <p className="text-red-500 text-xs mt-1">{tagError}</p>}
            </div>
            <div>
                <label className="text-sm font-medium">Color</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full mt-1 h-10 p-1 rounded border border-gray-300 dark:border-gray-600" />
            </div>
            <div>
                <label className="text-sm font-medium">Profile / Notes</label>
                <textarea value={profile} onChange={e => setProfile(e.target.value)} placeholder="A cheerful and optimistic young artist..." rows={3} className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
                <label className="text-sm font-medium">Other Arguments</label>
                <div className="space-y-2 mt-1">
                    {otherArgs.map((arg) => (
                        <div key={arg.id} className="flex items-center space-x-2">
                            <input type="text" value={arg.key} onChange={e => handleArgChange(arg.id, 'key', e.target.value)} placeholder="key" className="w-1/3 p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm" />
                            <span className="text-gray-500">=</span>
                            <input type="text" value={arg.value} onChange={e => handleArgChange(arg.id, 'value', e.target.value)} placeholder="value" className="flex-grow p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm" />
                            <button onClick={() => handleRemoveArg(arg.id)} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
                <button onClick={handleAddArg} className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">+ Add Argument</button>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
                <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-bold">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">Save</button>
            </div>
        </div>
    );
};

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
    onAddCharacter, onUpdateCharacter, onFindCharacterUsages,
    onAddVariable, onFindVariableUsages,
    onAddScreen, onFindScreenDefinition,
    projectImages, imageMetadata, onAddScanDirectory, scanDirectories, onCopyImagesToProject, onUpdateImageMetadata, onOpenImageEditor,
    audios, onImportAudios, isFileSystemApiSupported,
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('characters');
    const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
    const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');

    const { characters, characterUsage } = analysisResult;
    // FIX: Add explicit types for `a` and `b` in sort to resolve `unknown` type error.
    const characterList = Array.from(characters.values()).sort((a: Character, b: Character) => a.name.localeCompare(b.name));

    const handleEditCharacter = (char: Character) => {
        setEditingCharacter(char);
        setMode('edit');
    };

    const handleCancelEdit = () => {
        setEditingCharacter(null);
        setMode('list');
    };

    const handleSaveCharacter = (charData: Character, oldTag?: string) => {
        if (mode === 'edit' && oldTag) {
            onUpdateCharacter(oldTag, charData);
        } else {
            onAddCharacter(charData);
        }
        setMode('list');
    };

    return (
        <div className="h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
            <header className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold">Story Elements</h2>
            </header>
            <nav className="flex-shrink-0 flex border-b border-gray-200 dark:border-gray-700">
                <TabButton label="Characters" count={characterList.length} isActive={activeTab === 'characters'} onClick={() => setActiveTab('characters')} />
                <TabButton label="Variables" count={analysisResult.variables.size} isActive={activeTab === 'variables'} onClick={() => setActiveTab('variables')} />
                <TabButton label="Images" count={projectImages.size} isActive={activeTab === 'images'} onClick={() => setActiveTab('images')} />
                <TabButton label="Audio" count={audios.length} isActive={activeTab === 'audio'} onClick={() => setActiveTab('audio')} />
                <TabButton label="Screens" count={analysisResult.screens.size} isActive={activeTab === 'screens'} onClick={() => setActiveTab('screens')} />
                <TabButton label="Snippets" isActive={activeTab === 'snippets'} onClick={() => setActiveTab('snippets')} />
            </nav>
            <main className="flex-grow p-4 overflow-y-auto">
                {activeTab === 'characters' && (
                    <>
                        {mode === 'list' && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold">Characters ({characterList.length})</h3>
                                    <button onClick={() => setMode('add')} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">+ Add</button>
                                </div>
                                <ul className="space-y-2">
                                    {/* FIX: Add explicit type for `char` in map to resolve `unknown` type error. */}
                                    {characterList.map((char: Character) => (
                                        <li key={char.tag} className="p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
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
                                                <button onClick={() => handleEditCharacter(char)} title="Edit Character" className="p-1 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                    {characterList.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No characters defined yet.</p>}
                                </ul>
                            </div>
                        )}
                        {(mode === 'add' || mode === 'edit') && (
                            <CharacterEditor
                                character={editingCharacter || undefined}
                                onSave={handleSaveCharacter}
                                onCancel={handleCancelEdit}
                                // FIX: Add explicit type for `c` in map to resolve `unknown` type error.
                                existingTags={characterList.map((c: Character) => c.tag)}
                            />
                        )}
                    </>
                )}
                {activeTab === 'variables' && (
                    <VariableManager
                        analysisResult={analysisResult}
                        onAddVariable={onAddVariable}
                        onFindUsages={onFindVariableUsages}
                    />
                )}
                {activeTab === 'images' && (
                    <ImageManager
                        images={Array.from(projectImages.values())}
                        metadata={imageMetadata}
                        scanDirectories={Array.from(scanDirectories.keys())}
                        onAddScanDirectory={onAddScanDirectory}
                        onCopyImagesToProject={onCopyImagesToProject}
                        onOpenImageEditor={onOpenImageEditor}
                        isFileSystemApiSupported={isFileSystemApiSupported}
                    />
                )}
                {activeTab === 'audio' && (
                    <AudioManager
                        audios={audios}
                        onImportAudios={onImportAudios}
                        isImportEnabled={isFileSystemApiSupported}
                    />
                )}
                {activeTab === 'screens' && (
                    <ScreenManager
                        screens={analysisResult.screens}
                        onAddScreen={onAddScreen}
                        // FIX: Pass the correct prop `onFindScreenDefinition` to `onFindDefinition`.
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
