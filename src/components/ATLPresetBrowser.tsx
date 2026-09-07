/**
 * @file ATLPresetBrowser.tsx
 * @description Grid browser for the built-in ATL animation preset library (`atlPresetLibrary.ts`).
 * Key features: search (title/description/tags), tag filter chips, favorite/star toggle
 * (via `useSnippetStats`, same localStorage store as the generic Snippet Library), and a
 * parameter editor modal with sliders/dropdowns per preset parameter, a live ATL code
 * preview, copy-to-clipboard, and "Insert to Editor".
 * Modeled on `SnippetGridView`'s search/filter/card patterns but not a wrapper around it,
 * since presets need a parameter editor the generic snippet card has no concept of.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ATLPreset, ATLPresetParameter } from '@/types';
import { ATL_PRESETS, instantiatePreset } from '@/lib/atlPresetLibrary';
import { useSnippetStats, getSnippetStatId } from '@/hooks/useSnippetStats';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import CopyButton from './CopyButton';

const STAT_CATEGORY = 'ATL Animations';

interface ATLPresetBrowserProps {
  onInsertAtCursor?: (code: string) => void;
}

const ATLPresetBrowser: React.FC<ATLPresetBrowserProps> = ({ onInsertAtCursor }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [activePreset, setActivePreset] = useState<ATLPreset | null>(null);
  const { getStat, toggleFavorite } = useSnippetStats();

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const preset of ATL_PRESETS) {
      for (const tag of preset.tags ?? []) tags.add(tag);
    }
    return [...tags].sort();
  }, []);

  const filteredPresets = useMemo(() => {
    let filtered = ATL_PRESETS;

    if (selectedTags.size > 0) {
      filtered = filtered.filter(preset => preset.tags?.some(tag => selectedTags.has(tag)));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(preset =>
        preset.title.toLowerCase().includes(query) ||
        preset.description.toLowerCase().includes(query) ||
        (preset.tags?.some(tag => tag.toLowerCase().includes(query)) ?? false)
      );
    }

    return filtered;
  }, [selectedTags, searchQuery]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search animations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 pl-9 rounded-md border border-primary bg-secondary text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Tag Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {allTags.map(tag => {
          const isSelected = selectedTags.has(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-accent text-white'
                  : 'bg-tertiary text-secondary hover:bg-primary hover:text-primary border border-primary'
              }`}
            >
              {tag}
            </button>
          );
        })}
        {(selectedTags.size > 0 || searchQuery) && (
          <button
            onClick={() => { setSelectedTags(new Set()); setSearchQuery(''); }}
            className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="text-xs text-secondary">
        {filteredPresets.length} {filteredPresets.length === 1 ? 'animation' : 'animations'}
        {(selectedTags.size > 0 || searchQuery) && ` (filtered from ${ATL_PRESETS.length})`}
      </div>

      {/* Preset Grid */}
      {filteredPresets.length === 0 ? (
        <div className="text-center py-12 text-secondary">
          <p className="text-sm">No animations found</p>
          <p className="text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredPresets.map(preset => {
            const statId = getSnippetStatId(STAT_CATEGORY, preset.title);
            const stat = getStat(statId);
            return (
              <div
                key={preset.title}
                role="button"
                tabIndex={0}
                onClick={() => setActivePreset(preset)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActivePreset(preset); } }}
                className="text-left p-3 rounded-md bg-secondary border border-primary hover:shadow-md hover:border-accent transition-all flex flex-col cursor-pointer"
              >
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-sm text-primary">{preset.title}</h3>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(statId); }}
                    aria-label={stat.favorite ? `Unfavorite ${preset.title}` : `Favorite ${preset.title}`}
                    className={`p-0.5 rounded transition-colors flex-shrink-0 ${stat.favorite ? 'text-amber-500' : 'text-secondary hover:text-amber-500'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill={stat.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 2.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 14.6l-4.7 2.35.9-5.23-3.8-3.7 5.25-.76z" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-secondary mb-2">{preset.description}</p>
                {preset.tags && preset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {preset.tags.map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-tertiary text-secondary">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activePreset && (
        <ATLPresetParameterModal
          preset={activePreset}
          onClose={() => setActivePreset(null)}
          onInsertAtCursor={onInsertAtCursor}
        />
      )}
    </div>
  );
};

interface ATLPresetParameterModalProps {
  preset: ATLPreset;
  onClose: () => void;
  onInsertAtCursor?: (code: string) => void;
}

function initialValuesFor(preset: ATLPreset): Record<string, number | string> {
  const values: Record<string, number | string> = {};
  for (const param of preset.parameters) values[param.name] = param.defaultValue;
  return values;
}

const ATLPresetParameterModal: React.FC<ATLPresetParameterModalProps> = ({ preset, onClose, onInsertAtCursor }) => {
  const [values, setValues] = useState<Record<string, number | string>>(() => initialValuesFor(preset));
  const { modalProps, contentRef } = useModalAccessibility({ isOpen: true, onClose, titleId: 'atl-preset-modal-title' });
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setValues(initialValuesFor(preset));
    setTimeout(() => closeButtonRef.current?.focus(), 50);
  }, [preset]);

  const code = useMemo(() => instantiatePreset(preset, values), [preset, values]);

  const setParamValue = (param: ATLPresetParameter, raw: number | string) => {
    setValues(prev => ({ ...prev, [param.name]: raw }));
  };

  const handleInsert = () => {
    onInsertAtCursor?.(code);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div
        ref={contentRef}
        {...modalProps}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg m-4 flex flex-col border border-gray-200 dark:border-gray-700 max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
          <div>
            <h2 id="atl-preset-modal-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">{preset.title}</h2>
            <p className="text-xs text-secondary mt-0.5">{preset.description}</p>
          </div>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close" className="text-secondary hover:text-primary p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <main className="p-4 space-y-4 overflow-y-auto">
          {preset.parameters.map(param => (
            <div key={param.name}>
              <label htmlFor={`atl-param-${param.name}`} className="flex items-center justify-between text-xs font-medium text-secondary mb-1">
                <span className="capitalize">{param.name.replace(/_/g, ' ')}</span>
                {param.type !== 'easing' && <span className="font-mono text-primary">{values[param.name]}</span>}
              </label>
              {param.type === 'easing' ? (
                <select
                  id={`atl-param-${param.name}`}
                  value={values[param.name] as string}
                  onChange={e => setParamValue(param, e.target.value)}
                  className="w-full text-sm rounded-md border border-primary bg-secondary text-primary px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {(param.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  id={`atl-param-${param.name}`}
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step ?? 1}
                  value={values[param.name] as number}
                  onChange={e => setParamValue(param, Number(e.target.value))}
                  className="w-full"
                />
              )}
            </div>
          ))}

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-secondary">Preview</span>
              <CopyButton text={code} label="Copy" size="xs" />
            </div>
            <pre className="bg-gray-800 dark:bg-gray-900 text-white p-2 rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
              <code>{code}</code>
            </pre>
          </div>
        </main>

        <footer className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-lg flex justify-end items-center space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
            Cancel
          </button>
          {onInsertAtCursor && (
            <button onClick={handleInsert} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm">
              Insert to Editor
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default ATLPresetBrowser;
