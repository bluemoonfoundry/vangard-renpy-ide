import React, { useState, useEffect, useMemo } from 'react';
import type { Character, ProjectImage, ImageMetadata } from '../types';

interface CharacterEditorViewProps {
  character?: Character;
  onSave: (char: Character, oldTag?: string) => void;
  existingTags: string[];
  projectImages: ProjectImage[];
  imageMetadata: Map<string, ImageMetadata>;
}

const CharacterEditorView: React.FC<CharacterEditorViewProps> = ({ character, onSave, existingTags, projectImages, imageMetadata }) => {
    const isNew = !character;
    const [tag, setTag] = useState(character?.tag || '');
    const [name, setName] = useState(character?.name || '');
    const [color, setColor] = useState(character?.color || '#E57373');
    const [image, setImage] = useState(character?.image || '');
    const [profile, setProfile] = useState(character?.profile || '');
    
    // Advanced properties
    const [who_prefix, setWhoPrefix] = useState(character?.who_prefix || '');
    const [who_suffix, setWhoSuffix] = useState(character?.who_suffix || '');
    const [what_prefix, setWhatPrefix] = useState(character?.what_prefix || '');
    const [what_suffix, setWhatSuffix] = useState(character?.what_suffix || '');
    const [what_color, setWhatColor] = useState(character?.what_color || '');
    const [slow, setSlow] = useState(character?.slow ?? false);
    const [ctc, setCtc] = useState(character?.ctc || '');
    const [ctc_position, setCtcPosition] = useState(character?.ctc_position || 'nestled');

    const [tagError, setTagError] = useState('');

    useEffect(() => {
        if (character) {
            setTag(character.tag);
            setName(character.name);
            setColor(character.color);
            setImage(character.image || '');
            setProfile(character.profile || '');
            setWhoPrefix(character.who_prefix || '');
            setWhoSuffix(character.who_suffix || '');
            setWhatPrefix(character.what_prefix || '');
            setWhatSuffix(character.what_suffix || '');
            setWhatColor(character.what_color || '');
            setSlow(character.slow ?? false);
            setCtc(character.ctc || '');
            setCtcPosition(character.ctc_position || 'nestled');
        }
    }, [character]);
    
    const imageOptions = useMemo(() => {
      const options = new Map<string, string>();
      projectImages.forEach(img => {
          if(img.isInProject) {
            const meta = imageMetadata.get(img.projectFilePath || '');
            const renpyName = meta?.renpyName || img.fileName.split('.').slice(0,-1).join('.');
            options.set(renpyName, renpyName);
          }
      });
      return Array.from(options.keys()).sort();
    }, [projectImages, imageMetadata]);

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

        const finalChar: Character = {
            ...(character || { definedInBlockId: '' }),
            tag: tag.trim(),
            name: name.trim() || 'Unnamed',
            color,
            image: image || undefined,
            profile: profile.trim() || undefined,
            who_prefix: who_prefix.trim() || undefined,
            who_suffix: who_suffix.trim() || undefined,
            what_prefix: what_prefix.trim() || undefined,
            what_suffix: what_suffix.trim() || undefined,
            what_color: what_color.trim() || undefined,
            slow,
            ctc: ctc.trim() || undefined,
            ctc_position: ctc_position as 'nestled' | 'fixed',
        };

        onSave(finalChar, character?.tag);
    };

    useEffect(() => { setTagError('') }, [tag]);

    const renderTextInput = (label: string, value: string, setter: (val: string) => void, placeholder?: string) => (
        <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
            <input type="text" value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
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
        {/* Left Column */}
        <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 border-gray-300 dark:border-gray-700">Primary Attributes</h3>
            <div>
                <label className="text-sm font-medium">Display Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Eileen" className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
                <label className="text-sm font-medium">Code Tag</label>
                <input type="text" value={tag} onChange={e => setTag(e.target.value)} placeholder="e.g., e" className={`w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border ${tagError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} focus:ring-indigo-500 focus:border-indigo-500`} />
                {tagError && <p className="text-red-500 text-xs mt-1">{tagError}</p>}
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex-grow">
                <label className="text-sm font-medium">Name Color</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full mt-1 h-10 p-1 rounded border border-gray-300 dark:border-gray-600" />
              </div>
               <div className="flex-grow">
                <label className="text-sm font-medium">Dialogue Color</label>
                <input type="color" value={what_color} onChange={e => setWhatColor(e.target.value)} className="w-full mt-1 h-10 p-1 rounded border border-gray-300 dark:border-gray-600" />
              </div>
            </div>
            <div>
                <label className="text-sm font-medium">Image Tag</label>
                <select value={image} onChange={e => setImage(e.target.value)} className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="">None</option>
                    {imageOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Associates this character with an image tag for side images.</p>
            </div>
            <div>
                <label className="text-sm font-medium">Profile / Notes</label>
                <textarea value={profile} onChange={e => setProfile(e.target.value)} placeholder="A cheerful and optimistic young artist..." rows={8} className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
             <h3 className="text-lg font-semibold border-b pb-2 border-gray-300 dark:border-gray-700">Detailed Properties</h3>
             {renderTextInput("Name Prefix (who_prefix)", who_prefix, setWhoPrefix, "e.g., \"")}
             {renderTextInput("Name Suffix (who_suffix)", who_suffix, setWhoSuffix, "e.g., \":")}
             {renderTextInput("Dialogue Prefix (what_prefix)", what_prefix, setWhatPrefix, "e.g., «")}
             {renderTextInput("Dialogue Suffix (what_suffix)", what_suffix, setWhatSuffix, "e.g., »")}
             
             <div className="pt-2">
                 <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={slow} onChange={e => setSlow(e.target.checked)} className="h-5 w-5 rounded focus:ring-indigo-500" style={{ accentColor: 'rgb(79 70 229)' }}/>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Use Slow Text</span>
                 </label>
             </div>

             {renderTextInput("Click-to-Continue (ctc)", ctc, setCtc, "e.g., ctc_arrow")}
            <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">CTC Position</label>
{/* Fix: Cast select value to the expected type to resolve TypeScript error. */}
                 <select value={ctc_position} onChange={e => setCtcPosition(e.target.value as 'nestled' | 'fixed')} className="w-full mt-1 p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="nestled">nestled</option>
                    <option value="fixed">fixed</option>
                </select>
            </div>
        </div>
      </main>
    </div>
  );
};

export default CharacterEditorView;