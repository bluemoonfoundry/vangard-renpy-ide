
import React, { useState } from 'react';
import type { RenpyScreen } from '../types';

interface ScreenManagerProps {
    screens: Map<string, RenpyScreen>;
    onAddScreen: (screenName: string) => void;
    onFindDefinition: (screenName: string) => void;
}

const ScreenEditor: React.FC<{
    onSave: (screenName: string) => void;
    onCancel: () => void;
    existingNames: string[];
}> = ({ onSave, onCancel, existingNames }) => {
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState('');

    const handleSave = () => {
        const isNameUnique = !existingNames.includes(name);
        const isNameValid = /^[a-zA-Z0-9_]+$/.test(name) && name.length > 0;

        if (!isNameValid) {
            setNameError('Name must be a valid Ren\'Py name (letters, numbers, underscores).');
            return;
        }
        if (!isNameUnique) {
            setNameError('This screen name is already in use.');
            return;
        }

        onSave(name);
    };
    
    React.useEffect(() => {
        setNameError('');
    }, [name]);

    return (
        <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg space-y-3">
            <h3 className="font-semibold text-lg">Add New Screen</h3>
            <div>
                <label className="text-sm font-medium">Screen Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., main_menu" className={`w-full mt-1 p-2 rounded bg-white dark:bg-gray-800 border ${nameError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} focus:ring-indigo-500 focus:border-indigo-500`} />
                {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
            </div>
            <div className="flex justify-end space-x-2 pt-2">
                <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-bold">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">Create Screen</button>
            </div>
        </div>
    );
};


const ScreenManager: React.FC<ScreenManagerProps> = ({ screens, onAddScreen, onFindDefinition }) => {
    const [mode, setMode] = useState<'list' | 'add'>('list');
    
    // FIX: Add explicit types for `a` and `b` in sort to resolve `unknown` type error.
    const screenList = Array.from(screens.values()).sort((a: RenpyScreen, b: RenpyScreen) => a.name.localeCompare(b.name));

    const handleSave = (screenName: string) => {
        onAddScreen(screenName);
        setMode('list');
    };
    
    return (
        <>
            {mode === 'list' && (
                <>
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold">Screens ({screenList.length})</h3>
                        <button onClick={() => setMode('add')} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">+ Add</button>
                    </div>
                    
                    <ul className="space-y-2 mt-4">
                        {/* Fix: Add explicit type for 'screen' to resolve 'unknown' type error. */}
                        {screenList.map((screen: RenpyScreen) => (
                            <li key={screen.name} className="p-2 rounded-md bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                                <div className="flex-grow min-w-0">
                                    <p className="font-semibold font-mono text-sm truncate" title={screen.name}>{screen.name}</p>
                                    {screen.parameters && <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{screen.parameters}</p>}
                                </div>
                                <div className="flex items-center space-x-1 flex-shrink-0 pl-2">
                                    <button onClick={() => onFindDefinition(screen.name)} title="Go to definition" className="p-1 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded">
                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </button>
                                </div>
                            </li>
                        ))}
                        {screenList.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No screens defined yet.</p>}
                    </ul>
                </>
            )}

            {mode === 'add' && (
                <ScreenEditor
                    onSave={handleSave}
                    onCancel={() => setMode('list')}
                    existingNames={Array.from(screens.keys())}
                />
            )}
        </>
    );
};

export default ScreenManager;
