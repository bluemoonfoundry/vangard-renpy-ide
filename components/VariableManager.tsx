import React, { useState, useMemo } from 'react';
import type { Variable, RenpyAnalysisResult } from '../types';
import { useVirtualList } from '../hooks/useVirtualList';

// p-2 (16px) + name line (20px) + value line (16px) + badges line (20px) + space-y-2 gap (8px)
const VAR_ITEM_HEIGHT = 76;

interface VariableManagerProps {
    analysisResult: RenpyAnalysisResult;
    onAddVariable: (variable: Omit<Variable, 'definedInBlockId' | 'line'>) => void;
    onFindUsages: (variableName: string) => void;
    onHoverHighlightStart: (key: string, type: 'character' | 'variable') => void;
    onHoverHighlightEnd: () => void;
}

const PERSISTENCE_INFO: Record<'persistent' | 'default' | 'define', { label: string; color: string; tooltip: string }> = {
    persistent: {
        label: 'persistent',
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        tooltip: 'Stored in renpy.persistent — survives new game and quit. Not rolled back.',
    },
    default: {
        label: 'default',
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        tooltip: 'Saved to save files. Participates in rollback. Resets to initial value only if not in the save.',
    },
    define: {
        label: 'define',
        color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
        tooltip: 'Constant — not saved, not rolled back. Value set once at game start and never changes during play.',
    },
};

function getPersistenceKind(variable: Variable): 'persistent' | 'default' | 'define' {
    if (variable.name.startsWith('persistent.')) return 'persistent';
    if (variable.type === 'define') return 'define';
    return 'default';
}

const SemanticBadge: React.FC<{ kind: 'persistent' | 'default' | 'define' }> = ({ kind }) => {
    const info = PERSISTENCE_INFO[kind];
    return (
        <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold leading-none ${info.color}`}
            title={info.tooltip}
        >
            {info.label}
        </span>
    );
};

const VariableEditor: React.FC<{
    onSave: (variable: Omit<Variable, 'definedInBlockId' | 'line'>) => void;
    onCancel: () => void;
    existingNames: string[];
}> = ({ onSave, onCancel, existingNames }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'define' | 'default'>('default');
    const [initialValue, setInitialValue] = useState('False');
    const [nameError, setNameError] = useState('');

    const handleSave = () => {
        const isNameUnique = !existingNames.includes(name);
        const isNameValid = /^[a-zA-Z0-9_.]+$/.test(name) && name.length > 0;

        if (!isNameValid) {
            setNameError('Name must be a valid variable name (letters, numbers, underscores, dots).');
            return;
        }
        if (!isNameUnique) {
            setNameError('This variable name is already in use.');
            return;
        }

        onSave({ name, type, initialValue });
    };

    React.useEffect(() => {
        setNameError('');
    }, [name]);

    return (
        <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg space-y-3">
            <h3 className="font-semibold text-lg">Add New Variable</h3>
            <div>
                <label className="text-sm font-medium">Type</label>
                <select value={type} onChange={e => setType(e.target.value as 'define' | 'default')} className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="default">default — saved to save files, rolls back</option>
                    <option value="define">define — constant, not saved</option>
                </select>
            </div>
            <div>
                <label className="text-sm font-medium">Variable Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., player_score or persistent.seen_ending" className={`w-full mt-1 p-2 rounded bg-white dark:bg-gray-800 border ${nameError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} focus:ring-indigo-500 focus:border-indigo-500`} />
                {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Use <code className="font-mono">persistent.</code> prefix for cross-save persistent variables.</p>
            </div>
            <div>
                <label className="text-sm font-medium">Initial Value</label>
                <input type="text" value={initialValue} onChange={e => setInitialValue(e.target.value)} placeholder={`e.g., 0 or "initial_state"`} className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
                <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-bold">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">Save</button>
            </div>
        </div>
    );
};


const VariableManager: React.FC<VariableManagerProps> = ({ analysisResult, onAddVariable, onFindUsages, onHoverHighlightStart, onHoverHighlightEnd }) => {
    const { variables, variableUsages, storyBlockIds } = analysisResult;
    const [mode, setMode] = useState<'list' | 'add'>('list');
    const [filterStoryVars, setFilterStoryVars] = useState(true);

    const filteredVariables = useMemo(() => {
        const allVars = Array.from(variables.values());
        if (!filterStoryVars) return allVars;
        return allVars.filter((v: Variable) => storyBlockIds.has(v.definedInBlockId));
    }, [variables, filterStoryVars, storyBlockIds]);

    const { persistent, defaulted, defined } = useMemo(() => {
        const grouped = { persistent: [] as Variable[], defaulted: [] as Variable[], defined: [] as Variable[] };
        for (const variable of filteredVariables) {
            const kind = getPersistenceKind(variable);
            if (kind === 'persistent') grouped.persistent.push(variable);
            else if (kind === 'define') grouped.defined.push(variable);
            else grouped.defaulted.push(variable);
        }
        const sort = (a: Variable, b: Variable) => a.name.localeCompare(b.name);
        grouped.persistent.sort(sort);
        grouped.defaulted.sort(sort);
        grouped.defined.sort(sort);
        return grouped;
    }, [filteredVariables]);

    const handleSave = (variable: Omit<Variable, 'definedInBlockId' | 'line'>) => {
        onAddVariable(variable);
        setMode('list');
    };

    const VariableList: React.FC<{ title: string; kind: 'persistent' | 'default' | 'define'; vars: Variable[] }> = ({ title, kind, vars }) => {
        const [collapsed, setCollapsed] = useState(false);
        const { containerRef, handleScroll, virtualItems, totalHeight } = useVirtualList(
            collapsed ? [] : vars,
            VAR_ITEM_HEIGHT,
        );
        const listHeight = Math.min(vars.length * VAR_ITEM_HEIGHT, 400);
        return (
            <div className="mt-4">
                <button
                    onClick={() => setCollapsed(c => !c)}
                    className="flex items-center gap-2 w-full font-semibold text-gray-500 dark:text-gray-400 text-sm mb-2 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    <svg className={`w-3 h-3 flex-none transition-transform ${collapsed ? '-rotate-90' : ''}`} viewBox="0 0 12 12" fill="none">
                        <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <SemanticBadge kind={kind} />
                    <span>{title} ({vars.length})</span>
                </button>
                {!collapsed && (
                    vars.length === 0
                        ? <p className="text-xs text-gray-400 dark:text-gray-500 pl-1">None found.</p>
                        : (
                            <div
                                ref={containerRef}
                                className="overflow-y-auto overscroll-contain"
                                style={{ height: listHeight }}
                                onScroll={handleScroll}
                            >
                                <div style={{ height: totalHeight, position: 'relative' }}>
                                    {virtualItems.map(({ item: variable, offsetTop }) => {
                                        const usageCount = variableUsages.get(variable.name)?.length ?? 0;
                                        const isUnused = usageCount === 0;
                                        return (
                                            <div
                                                key={variable.name}
                                                style={{ position: 'absolute', top: offsetTop, left: 0, right: 0, height: VAR_ITEM_HEIGHT - 8 }}
                                                className="p-2 rounded-md bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between"
                                                onMouseEnter={() => onHoverHighlightStart(variable.name, 'variable')}
                                                onMouseLeave={onHoverHighlightEnd}
                                            >
                                                <div className="flex-grow min-w-0">
                                                    <p className="font-semibold font-mono text-sm truncate" title={variable.name}>{variable.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={`= ${variable.initialValue}`}>
                                                        = {variable.initialValue}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span
                                                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded leading-none ${
                                                                isUnused
                                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                                            }`}
                                                            title={isUnused ? 'This variable is never referenced in code' : `Referenced ${usageCount} time${usageCount !== 1 ? 's' : ''} in code`}
                                                        >
                                                            {isUnused ? 'unused' : `${usageCount} use${usageCount !== 1 ? 's' : ''}`}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-1 flex-shrink-0 pl-2">
                                                    <button
                                                        onClick={() => onFindUsages(variable.name)}
                                                        title="Find Usages"
                                                        className="p-1 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                )}
            </div>
        );
    };

    return (
        <>
            {mode === 'list' && (
                <>
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold">Variables ({filteredVariables.length})</h3>
                        <button onClick={() => setMode('add')} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">+ Add</button>
                    </div>

                    <label htmlFor="variable-filter-toggle" className="flex items-center justify-between mt-4 cursor-pointer">
                        <span className="text-sm text-gray-600 dark:text-gray-400 select-none">
                            Show story variables only
                        </span>
                        <div className="relative inline-flex items-center">
                            <input
                                type="checkbox"
                                id="variable-filter-toggle"
                                className="sr-only peer"
                                checked={filterStoryVars}
                                onChange={() => setFilterStoryVars(!filterStoryVars)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        </div>
                    </label>

                    <div>
                        <VariableList title="Persistent" kind="persistent" vars={persistent} />
                        <VariableList title="Default" kind="default" vars={defaulted} />
                        <VariableList title="Defined" kind="define" vars={defined} />
                    </div>
                    {filteredVariables.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                            {filterStoryVars ? 'No story variables found.' : 'No variables defined yet.'}
                        </p>
                    )}
                </>
            )}

            {mode === 'add' && (
                <VariableEditor
                    onSave={handleSave}
                    onCancel={() => setMode('list')}
                    existingNames={Array.from(variables.keys())}
                />
            )}
        </>
    );
};

export default VariableManager;
