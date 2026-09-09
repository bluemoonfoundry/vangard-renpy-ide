/**
 * @file CharacterEditorView.tsx
 * @description Form-based editor for creating and modifying Ren'Py characters (~250 lines).
 * Key features: tag/name/color/image assignment, dialogue color overrides, image search picker.
 * Integration: used inside a character manager panel; persists via `onSave`; reads available
 * images from `AssetContext` passed as props.
 */
import React, { useState, useEffect, useMemo, memo } from 'react';
import type { Character, ProjectImage, ImageMetadata, RenpyAnalysisResult, Block } from '@/types';
import { groupUsageLocations } from '@/lib/usageLocations';
import ColorDropTarget from './ColorDropTarget';

interface CharacterEditorViewProps {
  character?: Character;
  onSave: (char: Character, oldTag?: string) => void;
  existingTags: string[];
  projectImages: ProjectImage[];
  imageMetadata: Map<string, ImageMetadata>;
  initialTag?: string;
  initialName?: string;
  analysisResult: RenpyAnalysisResult;
  blocks: Block[];
  onOpenEditor: (blockId: string, line?: number) => void;
  /** Copies an external file (OS drag, file dialog) into the project and registers it as a `ProjectImage`. */
  onImportPortrait: (sourcePath: string) => Promise<ProjectImage | null>;
}

const HelpText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{children}</p>
);

const CharacterEditorView: React.FC<CharacterEditorViewProps> = ({ character, onSave, existingTags, projectImages, imageMetadata, initialTag, initialName, analysisResult, blocks, onOpenEditor, onImportPortrait }) => {
    const isNew = !character;

    // Core
    const [tag, setTag] = useState(character?.tag || initialTag || '');
    const [name, setName] = useState(character?.name || initialName || '');
    const [color, setColor] = useState(character?.color || '#E57373');
    const [image, setImage] = useState(character?.image || '');
    const [imageSearch, setImageSearch] = useState('');
    const [profile, setProfile] = useState(character?.profile || '');
    const [portraitPath, setPortraitPath] = useState(character?.portraitPath || '');
    const [isPortraitDragOver, setIsPortraitDragOver] = useState(false);

    // Dialogue color — tracked separately so empty = "no override"
    const [overrideWhatColor, setOverrideWhatColor] = useState(!!character?.what_color);
    const [what_color, setWhatColor] = useState(character?.what_color || '#ffffff');

    // Text formatting (advanced)
    const [who_prefix, setWhoPrefix] = useState(character?.who_prefix || '');
    const [who_suffix, setWhoSuffix] = useState(character?.who_suffix || '');
    const [what_prefix, setWhatPrefix] = useState(character?.what_prefix || '');
    const [what_suffix, setWhatSuffix] = useState(character?.what_suffix || '');

    // Slow text
    const [slow, setSlow] = useState(character?.slow ?? false);
    const [slow_speed, setSlowSpeed] = useState<number | ''>(character?.slow_speed ?? '');
    const [slow_abortable, setSlowAbortable] = useState(character?.slow_abortable ?? false);

    // CTC
    const [ctc, setCtc] = useState(character?.ctc || '');
    const [ctc_position, setCtcPosition] = useState<'nestled' | 'fixed'>(character?.ctc_position || 'nestled');

    // UI state
    const [tagError, setTagError] = useState('');
    const [advancedExpanded, setAdvancedExpanded] = useState(false);

    useEffect(() => {
        if (character) {
            setTag(character.tag);
            setName(character.name);
            setColor(character.color);
            setImage(character.image || '');
            setProfile(character.profile || '');
            setPortraitPath(character.portraitPath || '');
            setOverrideWhatColor(!!character.what_color);
            setWhatColor(character.what_color || '#ffffff');
            setWhoPrefix(character.who_prefix || '');
            setWhoSuffix(character.who_suffix || '');
            setWhatPrefix(character.what_prefix || '');
            setWhatSuffix(character.what_suffix || '');
            setSlow(character.slow ?? false);
            setSlowSpeed(character.slow_speed ?? '');
            setSlowAbortable(character.slow_abortable ?? false);
            setCtc(character.ctc || '');
            setCtcPosition(character.ctc_position || 'nestled');
        } else {
            setTag(initialTag || '');
            setName(initialName || '');
            setColor('#E57373');
            setImage('');
            setProfile('');
            setPortraitPath('');
            setOverrideWhatColor(false);
            setWhatColor('#ffffff');
            setWhoPrefix('');
            setWhoSuffix('');
            setWhatPrefix('');
            setWhatSuffix('');
            setSlow(false);
            setSlowSpeed('');
            setSlowAbortable(false);
            setCtc('');
            setCtcPosition('nestled');
        }
    }, [character, initialTag, initialName]);

    // Only compute + render options matching the search term (capped at 100) to avoid
    // creating thousands of <option> DOM nodes for large image libraries.
    const imageOptions = useMemo(() => {
        const lowerSearch = imageSearch.toLowerCase().trim();
        if (!lowerSearch) return [];
        const options = new Map<string, string>();
        projectImages.forEach(img => {
            if (!img.isInProject) return;
            const normalizedPath = (img.projectFilePath || img.filePath).replace(/\\/g, '/');
            if (normalizedPath.includes('/gui/')) return;
            const meta = imageMetadata.get(img.projectFilePath || '');
            const renpyName = meta?.renpyName || img.fileName.split('.').slice(0, -1).join('.');
            if (renpyName.toLowerCase().includes(lowerSearch)) options.set(renpyName, renpyName);
        });
        return Array.from(options.keys()).sort().slice(0, 100);
    }, [projectImages, imageMetadata, imageSearch]);

    const portraitDataUrl = useMemo(() => {
        if (!portraitPath) return undefined;
        const match = projectImages.find(img => img.projectFilePath === portraitPath || img.filePath === portraitPath);
        return match?.dataUrl;
    }, [portraitPath, projectImages]);

    const importPortraitFromSource = async (sourcePath: string) => {
        const imported = await onImportPortrait(sourcePath);
        // Always store the stable, project-relative path -- projectFilePath is an
        // absolute path that isn't populated the same way after a fresh project-load
        // scan, so storing it would resolve fine this session but fail to match any
        // scanned image (and thus render blank) after a restart.
        if (imported) setPortraitPath(imported.filePath);
    };

    const handlePortraitDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsPortraitDragOver(false);

        const imagePanePath = e.dataTransfer.getData('application/renpy-image-path');
        if (imagePanePath) {
            const dropped = projectImages.find(img => img.filePath === imagePanePath);
            if (dropped) {
                if (dropped.isInProject) {
                    setPortraitPath(dropped.filePath);
                } else {
                    void importPortraitFromSource(dropped.filePath);
                }
            }
            return;
        }

        const file = e.dataTransfer.files?.[0];
        if (file && window.electronAPI?.webUtils) {
            const sourcePath = window.electronAPI.webUtils.getPathForFile(file);
            if (sourcePath) void importPortraitFromSource(sourcePath);
        }
    };

    const handlePortraitDoubleClick = async () => {
        if (!window.electronAPI) return;
        const selected = await window.electronAPI.selectImage();
        if (selected) void importPortraitFromSource(selected);
    };

    const usageLocations = useMemo(() => {
        if (!character) return [];
        const occurrences: { blockId: string; line: number }[] = [];
        analysisResult.dialogueLines.forEach((dialogues, blockId) => {
            dialogues.forEach(d => {
                if (d.tag === character.tag) occurrences.push({ blockId, line: d.line });
            });
        });
        return groupUsageLocations(occurrences, blocks, analysisResult.labelNodes);
    }, [character, analysisResult.dialogueLines, analysisResult.labelNodes, blocks]);

    const handleSave = () => {
        const isTagUnique = !existingTags.some(t => t === tag && t !== character?.tag);
        const isTagValid = /^[a-zA-Z0-9_]+$/.test(tag) && tag.length > 0;

        if (!isTagValid) { setTagError('Tag must be a valid variable name (letters, numbers, underscores).'); return; }
        if (!isTagUnique) { setTagError('This tag is already in use.'); return; }

        const finalChar: Character = {
            ...(character || { definedInBlockId: '' }),
            tag: tag.trim(),
            name: name.trim() || 'Unnamed',
            color,
            image: image || undefined,
            profile: profile.trim() || undefined,
            portraitPath: portraitPath || undefined,
            what_color: overrideWhatColor ? what_color : undefined,
            who_prefix: who_prefix.trim() || undefined,
            who_suffix: who_suffix.trim() || undefined,
            what_prefix: what_prefix.trim() || undefined,
            what_suffix: what_suffix.trim() || undefined,
            slow,
            slow_speed: slow && slow_speed !== '' ? Number(slow_speed) : undefined,
            slow_abortable: slow ? slow_abortable : undefined,
            ctc: ctc.trim() || undefined,
            ctc_position,
        };

        onSave(finalChar, character?.tag);
    };

    useEffect(() => { setTagError(''); }, [tag]);

    const renderTextInput = (label: string, value: string, setter: (val: string) => void, placeholder?: string, helpText?: string) => (
        <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
            <input
                type="text"
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {helpText && <HelpText>{helpText}</HelpText>}
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900 overflow-hidden">
            <header className="flex-none h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
                <h2 className="text-xl font-bold">{isNew ? 'New Character' : `Editing: ${character.name}`}</h2>
                <button onClick={handleSave} className="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors">
                    Save Changes
                </button>
            </header>
            <main className="flex-grow p-6 overflow-y-auto overscroll-contain grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

                {/* Left Column — Primary Attributes */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2 border-gray-300 dark:border-gray-700">Primary Attributes</h3>

                    <div>
                        <label className="text-sm font-medium">Portrait</label>
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label="Character portrait — drop an image or double-click to choose one"
                            onDragOver={(e) => { e.preventDefault(); setIsPortraitDragOver(true); }}
                            onDragLeave={() => setIsPortraitDragOver(false)}
                            onDrop={handlePortraitDrop}
                            onDoubleClick={handlePortraitDoubleClick}
                            className={`relative mt-1 w-[512px] max-w-full aspect-square rounded bg-white dark:bg-gray-700 border-2 border-dashed flex items-center justify-center overflow-hidden ${isPortraitDragOver ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-gray-300 dark:border-gray-600'}`}
                        >
                            {portraitDataUrl ? (
                                <img src={portraitDataUrl} alt="Character portrait" className="w-full h-full object-contain object-center" />
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 select-none px-4 text-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
                                        <path d="M4 20c0-4.418 3.582-7 8-7s8 2.582 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                    </svg>
                                    <span className="text-sm">Drag an image here or double-click to choose one</span>
                                </div>
                            )}
                            {portraitPath && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setPortraitPath(''); }}
                                    title="Remove portrait"
                                    aria-label="Remove portrait"
                                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-sm leading-none"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <HelpText>Reference image shown in the editor only — not used in generated Ren&apos;Py code.</HelpText>
                    </div>

                    <div>
                        <label htmlFor="character-editor-name" className="text-sm font-medium">Display Name</label>
                        <input id="character-editor-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Eileen"
                            className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>

                    <div>
                        <label htmlFor="character-editor-tag" className="text-sm font-medium">Code Tag</label>
                        <input
                            id="character-editor-tag"
                            type="text"
                            value={tag}
                            onChange={e => setTag(e.target.value)}
                            placeholder="e.g., e"
                            className={`w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border ${tagError ? 'border-red-500' : (!isNew && tag !== character?.tag) ? 'border-amber-400 dark:border-amber-500' : 'border-gray-300 dark:border-gray-600'} focus:ring-indigo-500 focus:border-indigo-500`}
                        />
                        {tagError && <p className="text-red-500 text-xs mt-1">{tagError}</p>}
                        {!isNew && tag === character?.tag && <HelpText>Changing this tag will rename it across all script files when you save.</HelpText>}
                        {!isNew && tag !== character?.tag && (
                            <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                                Saving will rename &ldquo;{character?.tag}&rdquo; to &ldquo;{tag}&rdquo; in all script files.
                            </p>
                        )}
                    </div>

                    {/* Colors */}
                    <div className="flex items-start gap-4">
                        <div className="flex-1">
                            <label className="text-sm font-medium">Name Color</label>
                            <ColorDropTarget value={color} onChange={setColor}
                                className="w-full mt-1 h-10 p-1 rounded border border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="flex-1">
                            <label className="text-sm font-medium flex items-center justify-between">
                                <span>Dialogue Color</span>
                                <label className="flex items-center gap-1 text-xs font-normal text-gray-500 dark:text-gray-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={overrideWhatColor}
                                        onChange={e => setOverrideWhatColor(e.target.checked)}
                                        className="h-3 w-3 rounded"
                                    />
                                    Override
                                </label>
                            </label>
                            {overrideWhatColor ? (
                                <ColorDropTarget value={what_color} onChange={setWhatColor}
                                    className="w-full mt-1 h-10 p-1 rounded border border-gray-300 dark:border-gray-600" />
                            ) : (
                                <div className="w-full mt-1 h-10 rounded border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 select-none">
                                    Theme default
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Image Tag</label>
                        <input
                            type="text"
                            value={imageSearch}
                            onChange={e => setImageSearch(e.target.value)}
                            placeholder="Search image tags…"
                            className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                        <select value={image} onChange={e => setImage(e.target.value)}
                            className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                            size={imageOptions.length > 0 ? Math.min(imageOptions.length + 1, 6) : 2}
                        >
                            <option value="">{imageSearch ? `${imageOptions.length} result${imageOptions.length !== 1 ? 's' : ''}` : '— type to search —'}</option>
                            {imageOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <HelpText>Associates this character with an image tag for side images.</HelpText>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Profile / Notes</label>
                        <textarea value={profile} onChange={e => setProfile(e.target.value)}
                            placeholder="A cheerful and optimistic young artist..." rows={8}
                            className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                </div>

                {/* Right Column — Advanced Properties (collapsible) */}
                <div className="space-y-4">
                    <button
                        onClick={() => setAdvancedExpanded(e => !e)}
                        className="w-full flex items-center gap-2 text-lg font-semibold border-b pb-2 border-gray-300 dark:border-gray-700 text-left hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                        <svg className={`w-4 h-4 flex-none transition-transform ${advancedExpanded ? '' : '-rotate-90'}`} viewBox="0 0 12 12" fill="none">
                            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Advanced Properties
                    </button>

                    {advancedExpanded && (
                        <div className="space-y-5">
                            {/* Name label formatting */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Name Label</p>
                                {renderTextInput('Name Prefix', who_prefix, setWhoPrefix, 'e.g., "',
                                    'Text inserted before the character name in dialogue. Example: setting this to " produces "Eileen says…')}
                                {renderTextInput('Name Suffix', who_suffix, setWhoSuffix, 'e.g., :',
                                    'Text appended after the character name. Example: : produces Eileen:.')}
                            </div>

                            {/* Dialogue text formatting */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Dialogue Text</p>
                                {renderTextInput('Dialogue Prefix', what_prefix, setWhatPrefix, 'e.g., «',
                                    'Text inserted before every line this character speaks.')}
                                {renderTextInput('Dialogue Suffix', what_suffix, setWhatSuffix, 'e.g., »',
                                    'Text appended after every line this character speaks.')}
                            </div>

                            {/* Slow text */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Text Speed</p>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={slow} onChange={e => setSlow(e.target.checked)}
                                        className="h-4 w-4 rounded focus:ring-indigo-500" style={{ accentColor: 'rgb(79 70 229)' }} />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Use Slow Text</span>
                                </label>
                                {slow && (
                                    <div className="pl-7 space-y-3">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Text Speed (chars/sec)</label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={slow_speed}
                                                onChange={e => setSlowSpeed(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="Leave empty for Ren'Py default"
                                                className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                            <HelpText>Characters revealed per second. Leave empty to use the project default.</HelpText>
                                        </div>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input type="checkbox" checked={slow_abortable} onChange={e => setSlowAbortable(e.target.checked)}
                                                className="h-4 w-4 rounded focus:ring-indigo-500" style={{ accentColor: 'rgb(79 70 229)' }} />
                                            <div>
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Player can skip slow text</span>
                                                <HelpText>When checked, clicking during slow text reveals the full line immediately.</HelpText>
                                            </div>
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Click-to-continue */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Click-to-Continue</p>
                                {renderTextInput('CTC Displayable', ctc, setCtc, 'e.g., ctc_arrow',
                                    'Name of a Ren\'Py displayable shown at the end of dialogue while waiting for the player to click.')}
                                <div>
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">CTC Position</label>
                                    <select value={ctc_position} onChange={e => setCtcPosition(e.target.value as 'nestled' | 'fixed')}
                                        className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500">
                                        <option value="nestled">nestled — inline after the last word</option>
                                        <option value="fixed">fixed — at a fixed screen position</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Usage Locations */}
                    {character && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold border-b pb-2 border-gray-300 dark:border-gray-700">Usage Locations</h3>
                            {usageLocations.length === 0 ? (
                                <p className="text-sm text-gray-400 dark:text-gray-500">No dialogue found for this character yet.</p>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs">
                                                <th className="px-3 py-2 text-left font-semibold">File</th>
                                                <th className="px-3 py-2 text-left font-semibold">Label</th>
                                                <th className="px-3 py-2 text-right font-semibold w-16">Lines</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {usageLocations.map((loc, i) => (
                                                <tr
                                                    key={`${loc.blockId}:${loc.label ?? ''}`}
                                                    className={`border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30 ${i % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}
                                                    onClick={() => onOpenEditor(loc.blockId, loc.firstLine)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            onOpenEditor(loc.blockId, loc.firstLine);
                                                        }
                                                    }}
                                                    tabIndex={0}
                                                    role="button"
                                                    title="Open in editor"
                                                >
                                                    <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 truncate max-w-[160px]" title={loc.filePath}>{loc.fileName}</td>
                                                    <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{loc.label ?? '—'}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-500 dark:text-gray-400">{loc.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
};

export default memo(CharacterEditorView);
