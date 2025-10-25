import React, { useState } from 'react';
import type { Character, Variable, RenpyImage, RenpyAudio } from '../types';
import VariableManager from './VariableManager';
import ImageManager from './ImageManager';
import AudioManager from './AudioManager';

interface StoryElementsPanelProps {
    isOpen: boolean;
    // Character props
    characters: Map<string, Character>;
    characterUsage: Map<string, number>;
    onAddCharacter: (char: Omit<Character, 'definedInBlockId'>) => void;
    onUpdateCharacter: (oldTag: string, newChar: Character) => void;
    onFindCharacterUsages: (tag: string) => void;
    // Variable props
    variables: Map<string, Variable>;
    onAddVariable: (variable: Omit<Variable, 'definedInBlockId' | 'line'>) => void;
    onFindVariableUsages: (variableName: string) => void;
    // Image props
    images: RenpyImage[];
    onImportImages: () => void;
    // Audio props
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
    const [tagError, setTagError] = useState('');

    const isEditing = !!character;

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

        onSave({ 
            name: name.trim() || 'Unnamed', 
            tag, 
            color, 
            definedInBlockId: character?.definedInBlockId || ''
        }, character?.tag);
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
            <div className="flex justify-end space-x-2 pt-2">
                <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-bold">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">Save</button>
            </div>
        </div>
    );
};

const StoryElementsPanel: React.FC<StoryElementsPanelProps> = ({ 
    isOpen, 
    characters, characterUsage, onAddCharacter, onUpdateCharacter, onFindCharacterUsages, 
    variables, onAddVariable, onFindVariableUsages,
    images, onImportImages,
    audios, onImportAudios,
    isFileSystemApiSupported
}) => {
    const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
    const [editingChar, setEditingChar] = useState<Character | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<'characters' | 'variables' | 'images' | 'audio'>('characters');
    
    const characterList = Array.from(characters.values());

    const handleSave = (char: Character, oldTag?: string) => {
        if (mode === 'edit' && oldTag) {
            onUpdateCharacter(oldTag, char);
        } else {
            onAddCharacter(char);
        }
        setMode('list');
        setEditingChar(undefined);
    };

    if (!isOpen) return null;

    type TabName = 'characters' | 'variables' | 'images' | 'audio';
    const TabButton: React.FC<{ tabName: TabName; label: string }> = ({ tabName, label }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === tabName ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );

    return (
        <aside className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col z-10">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold">Story Elements</h2>
            </div>

            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 flex-wrap">
                    <TabButton tabName="characters" label="Characters" />
                    <TabButton tabName="variables" label="Variables" />
                    <TabButton tabName="images" label="Images" />
                    <TabButton tabName="audio" label="Audio" />
                </div>
            </div>

            <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                {activeTab === 'characters' && (
                     <>
                        {mode === 'list' && (
                            <>
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold">Characters ({characterList.length})</h3>
                                    <button onClick={() => setMode('add')} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">+ Add</button>
                                </div>
                                <ul className="space-y-2">
                                    {characterList.map((char: Character) => {
                                        const usage = characterUsage.get(char.tag) || 0;
                                        return (
                                            <li key={char.tag} className="p-2 rounded-md bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                                                <div className="flex items-center space-x-3 min-w-0">
                                                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: char.color }} />
                                                    <div className="flex-grow min-w-0">
                                                        <div className="flex items-center space-x-2">
                                                            <p className="font-semibold truncate" title={char.name}>{char.name}</p>
                                                            <span className="flex-shrink-0 text-xs font-mono bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5">
                                                                {usage}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{char.tag}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-1 flex-shrink-0">
                                                    <button onClick={() => onFindCharacterUsages(char.tag)} title="Find Usages" className="p-1 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                    </button>
                                                    <button onClick={() => { setEditingChar(char); setMode('edit'); }} title="Edit" className="p-1 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                                    </button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                    {characterList.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No characters defined yet.</p>}
                                </ul>
                            </>
                        )}
                        {(mode === 'add' || mode === 'edit') && (
                            <CharacterEditor
                                character={editingChar}
                                onSave={handleSave}
                                onCancel={() => { setMode('list'); setEditingChar(undefined); }}
                                existingTags={characterList.map((c: Character) => c.tag)}
                            />
                        )}
                    </>
                )}

                {activeTab === 'variables' && (
                    <VariableManager
                        variables={variables}
                        onAddVariable={onAddVariable}
                        onFindUsages={onFindVariableUsages}
                    />
                )}
                {activeTab === 'images' && (
                    <ImageManager 
                        images={images}
                        onImportImages={onImportImages}
                        isImportEnabled={isFileSystemApiSupported}
                    />
                )}
                {activeTab === 'audio' && (
                    <AudioManager 
                        audios={audios}
                        onImportAudios={onImportAudios}
                        isImportEnabled={isFileSystemApiSupported}
                    />
                )}
            </div>
        </aside>
    );
};

export default StoryElementsPanel;