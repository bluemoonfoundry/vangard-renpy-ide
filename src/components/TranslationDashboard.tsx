/**
 * @file TranslationDashboard.tsx
 * @description Read-only dashboard that displays translation coverage across
 * detected languages. Three sections: language overview cards, file breakdown
 * table, and a virtual string-level view.
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationAnalysisResult, LanguageCoverage, TranslationFileBreakdown, Block } from '@/types';
import { useVirtualList } from '@/hooks/useVirtualList';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TranslationDashboardProps {
  translationData: TranslationAnalysisResult;
  blocks: Block[];
  onOpenBlock: (blockId: string, line?: number) => void;
  onGenerateTranslations: (language: string) => Promise<void>;
  isGenerating: boolean;
  isRenpyPathValid: boolean;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">{children}</h2>
);

const ProgressBar: React.FC<{ percent: number }> = ({ percent }) => {
  const color = percent > 80 ? 'bg-green-500' : percent >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type FileSortKey = 'file' | 'total' | 'translated' | 'untranslated' | 'stale' | 'completion';
type SortDir = 'asc' | 'desc';

function sortFileBreakdown(rows: TranslationFileBreakdown[], key: FileSortKey, dir: SortDir): TranslationFileBreakdown[] {
  const sorted = [...rows];
  const mult = dir === 'asc' ? 1 : -1;
  const getEffectiveTranslated = (row: TranslationFileBreakdown) => row.translatedCount - row.staleCount;
  const getEffectiveUntranslated = (row: TranslationFileBreakdown) => row.totalStrings - getEffectiveTranslated(row);
  sorted.sort((a, b) => {
    switch (key) {
      case 'file': return mult * a.sourceFilePath.localeCompare(b.sourceFilePath);
      case 'total': return mult * (a.totalStrings - b.totalStrings);
      case 'translated': return mult * (getEffectiveTranslated(a) - getEffectiveTranslated(b));
      case 'untranslated': return mult * (getEffectiveUntranslated(a) - getEffectiveUntranslated(b));
      case 'stale': return mult * (a.staleCount - b.staleCount);
      case 'completion': return mult * (a.completionPercent - b.completionPercent);
    }
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// Status filter type
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'translated' | 'untranslated' | 'stale';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const LANGUAGE_PATTERN = /^[a-z][a-z0-9_]*$/;

const TranslationDashboard: React.FC<TranslationDashboardProps> = ({ translationData, blocks: _blocks, onOpenBlock, onGenerateTranslations, isGenerating, isRenpyPathValid }) => {
  // --- State ---
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [textFilter, setTextFilter] = useState('');
  const [fileSortKey, setFileSortKey] = useState<FileSortKey>('file');
  const [fileSortDir, setFileSortDir] = useState<SortDir>('asc');
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [languageInput, setLanguageInput] = useState('');
  const generateModalRef = useRef<HTMLDivElement>(null);

  const isLanguageValid = LANGUAGE_PATTERN.test(languageInput);

  // Accessibility: focus trap and ESC handling for generate modal
  const generateModalAccessibilityProps = useModalAccessibility({
    isOpen: showGenerateForm,
    onClose: () => {
      setShowGenerateForm(false);
      setLanguageInput('');
    },
    contentRef: generateModalRef,
    titleId: 'generate-translation-title',
  });

  useEffect(() => {
    if (!showGenerateForm || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowGenerateForm(false);
        setLanguageInput('');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showGenerateForm]);

  const handleGenerate = useCallback(async () => {
    if (!isLanguageValid) return;
    await onGenerateTranslations(languageInput);
    setLanguageInput('');
    setShowGenerateForm(false);
  }, [languageInput, isLanguageValid, onGenerateTranslations]);

  const generateButton = (
    <button
      onClick={() => setShowGenerateForm(true)}
      disabled={!isRenpyPathValid || isGenerating}
      title={!isRenpyPathValid ? 'Configure Ren\'Py SDK path in settings first' : undefined}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      data-testid="generate-translations-btn"
    >
      {isGenerating ? (
        <>
          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Generating...
        </>
      ) : 'Generate Translations'}
    </button>
  );

  const generateModal = showGenerateForm && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/50 backdrop-blur-sm"
          onMouseDown={() => {
            setShowGenerateForm(false);
            setLanguageInput('');
          }}
          data-testid="generate-modal"
          {...generateModalAccessibilityProps}
        >
          <div
            ref={generateModalRef}
            className="w-full max-w-md rounded-xl border border-primary bg-secondary shadow-2xl p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="generate-translation-title"
            data-testid="generate-form"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 id="generate-translation-title" className="text-base font-semibold text-primary">
                  Generate Translations
                </h3>
                <p className="text-xs text-secondary mt-1">
                  Enter the language code Ren'Py should generate under <code className="px-1 py-0.5 bg-tertiary rounded">game/tl/</code>.
                </p>
              </div>
              <button
                onClick={() => { setShowGenerateForm(false); setLanguageInput(''); }}
                className="text-secondary hover:text-primary text-lg leading-none"
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder='e.g. "french", "japanese"'
                value={languageInput}
                onChange={e => setLanguageInput(e.target.value.toLowerCase())}
                onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
                className="px-3 py-2 text-sm bg-primary border border-primary rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 text-primary placeholder:text-secondary"
                data-testid="language-input"
                autoFocus
              />
              {languageInput && !isLanguageValid && (
                <span className="text-xs text-red-500" data-testid="language-validation-error">Lowercase letters, numbers, underscores only. Must start with a letter.</span>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { setShowGenerateForm(false); setLanguageInput(''); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary hover:bg-tertiary border border-primary transition-colors"
                  data-testid="cancel-generate-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!isLanguageValid || isGenerating}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  data-testid="confirm-generate-btn"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  const { languageCoverages, detectedLanguages, translatableStrings, stringTranslations } = translationData;

  // Auto-select first language if none selected
  const activeLang = selectedLanguage && detectedLanguages.includes(selectedLanguage) ? selectedLanguage : detectedLanguages[0] ?? null;

  const getTranslationForLanguage = useCallback((stringId: string, language: string) => {
    return stringTranslations.get(stringId)?.get(language) ?? null;
  }, [stringTranslations]);

  const openTranslationForString = useCallback((stringId: string, sourceBlockId: string, sourceLine: number, preferredLanguage?: string | null) => {
    const preferredTranslation = preferredLanguage ? getTranslationForLanguage(stringId, preferredLanguage) : null;
    if (preferredTranslation) {
      setSelectedLanguage(preferredLanguage);
      onOpenBlock(preferredTranslation.blockId, preferredTranslation.line);
      return;
    }

    for (const language of detectedLanguages) {
      const translation = getTranslationForLanguage(stringId, language);
      if (translation) {
        setSelectedLanguage(language);
        onOpenBlock(translation.blockId, translation.line);
        return;
      }
    }

    onOpenBlock(sourceBlockId, sourceLine);
  }, [detectedLanguages, getTranslationForLanguage, onOpenBlock]);

  const activeCoverage: LanguageCoverage | null = useMemo(
    () => languageCoverages.find(c => c.language === activeLang) ?? null,
    [languageCoverages, activeLang],
  );

  // --- File breakdown (filtered + sorted) ---
  const fileRows = useMemo(() => {
    if (!activeCoverage) return [];
    let rows = activeCoverage.fileBreakdown;
    const getEffectiveTranslated = (row: TranslationFileBreakdown) => row.translatedCount - row.staleCount;

    // Status filter
    if (statusFilter === 'translated') rows = rows.filter(r => getEffectiveTranslated(r) > 0);
    else if (statusFilter === 'untranslated') rows = rows.filter(r => getEffectiveTranslated(r) < r.totalStrings);
    else if (statusFilter === 'stale') rows = rows.filter(r => r.staleCount > 0);

    // Text filter
    if (textFilter) {
      const q = textFilter.toLowerCase();
      rows = rows.filter(r => r.sourceFilePath.toLowerCase().includes(q));
    }

    return sortFileBreakdown(rows, fileSortKey, fileSortDir);
  }, [activeCoverage, statusFilter, textFilter, fileSortKey, fileSortDir]);

  // --- String-level items ---
  const stringItems = useMemo(() => {
    if (!activeLang) return translatableStrings;
    const q = textFilter.toLowerCase();
    return translatableStrings.filter(s => {
      if (q && !s.sourceText.toLowerCase().includes(q) && !s.filePath.toLowerCase().includes(q)) return false;
      if (statusFilter === 'all') return true;
      const translations = stringTranslations.get(s.id);
      const hasTranslation = translations?.has(activeLang);
      const isStale = hasTranslation && translations!.get(activeLang)!.translatedText === s.sourceText;
      if (statusFilter === 'translated') return hasTranslation && !isStale;
      if (statusFilter === 'untranslated') return !hasTranslation;
      if (statusFilter === 'stale') return isStale;
      return true;
    });
  }, [translatableStrings, activeLang, textFilter, statusFilter, stringTranslations]);

  const { containerRef, handleScroll, virtualItems, totalHeight } = useVirtualList(stringItems, 56);

  const toggleSort = useCallback((key: FileSortKey) => {
    setFileSortKey(prev => {
      if (prev === key) {
        setFileSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setFileSortDir('asc');
      return key;
    });
  }, []);

  const SortIcon: React.FC<{ col: FileSortKey }> = ({ col }) => {
    if (fileSortKey !== col) return null;
    return <span className="ml-0.5">{fileSortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>;
  };

  // --- Empty state ---
  if (detectedLanguages.length === 0 && translatableStrings.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full text-secondary gap-4 px-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <h3 className="text-lg font-semibold text-primary">No Translations Detected</h3>
          <p className="text-sm text-center max-w-md">
            Ren'Py stores translations under <code className="px-1 py-0.5 bg-secondary rounded text-xs">game/tl/&lt;language&gt;/</code> directories.
            Generate translations with Ren'Py's built-in tool or create translation files manually to see coverage here.
          </p>
          {!showGenerateForm && generateButton}
        </div>
        {generateModal}
      </>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Section 1: Language Overview Cards (sticky) ── */}
      <section className="flex-none px-6 pt-6 pb-4 border-b border-primary">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Language Coverage</SectionLabel>
          {!showGenerateForm && generateButton}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {languageCoverages.map(cov => (
            <button
              key={cov.language}
              onClick={() => setSelectedLanguage(cov.language)}
              className={`bg-secondary rounded-lg p-4 flex flex-col gap-2 text-left transition-shadow ${
                activeLang === cov.language ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-indigo-400'
              }`}
            >
              <span className="text-xs font-semibold text-secondary uppercase tracking-wide">{cov.language}</span>
              <span className="text-2xl font-bold text-primary">{cov.completionPercent}%</span>
              <ProgressBar percent={cov.completionPercent} />
              <div className="flex justify-between text-xs text-secondary">
                <span>{cov.translatedCount - cov.staleCount}/{cov.totalStrings}</span>
                {cov.staleCount > 0 && <span className="text-amber-500">{cov.staleCount} stale</span>}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Filters (shared between both tables) ── */}
      {activeCoverage && (
        <div className="flex-none px-6 pt-4 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Language pills */}
            <div className="flex rounded-md border border-primary overflow-hidden text-xs flex-none">
              {detectedLanguages.map(lang => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-2.5 py-1 capitalize border-r border-primary last:border-0 transition-colors ${
                    activeLang === lang ? 'bg-indigo-500 text-white' : 'bg-secondary text-secondary hover:bg-tertiary'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Status pills */}
            <div className="flex rounded-md border border-primary overflow-hidden text-xs flex-none">
              {(['all', 'translated', 'untranslated', 'stale'] as StatusFilter[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 capitalize border-r border-primary last:border-0 transition-colors ${
                    statusFilter === s ? 'bg-indigo-500 text-white' : 'bg-secondary text-secondary hover:bg-tertiary'
                  }`}
                >
                  {s === 'all' ? 'All Status' : s}
                </button>
              ))}
            </div>

            {/* Text search */}
            <div className="relative flex-1 min-w-[140px]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Filter files or strings..."
                value={textFilter}
                onChange={e => setTextFilter(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs bg-secondary border border-primary rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 text-primary placeholder:text-secondary"
              />
            </div>
            <span className="text-xs text-secondary flex-none">{fileRows.length} file{fileRows.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* ── Bottom half: two tables split 50/50 ── */}
      <div className="flex-1 min-h-0 flex flex-col px-6 pb-6 gap-4">
        {/* ── Section 2: File Breakdown Table ── */}
        {activeCoverage && (
          <section className="flex-1 min-h-0 flex flex-col">
            <SectionLabel>File Breakdown — {activeLang}</SectionLabel>
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-primary">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-tertiary text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                    {([
                      ['file', 'File'],
                      ['total', 'Total'],
                      ['translated', 'Translated'],
                      ['untranslated', 'Untranslated'],
                      ['stale', 'Stale'],
                      ['completion', 'Completion'],
                    ] as [FileSortKey, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        className="px-3 py-2 cursor-pointer select-none hover:text-primary"
                        onClick={() => toggleSort(key)}
                      >
                        {label}<SortIcon col={key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary">
                  {fileRows.map(row => {
                    const effectiveTranslated = row.translatedCount - row.staleCount;
                    const effectiveUntranslated = row.totalStrings - effectiveTranslated;

                    return (
                      <tr key={row.sourceFilePath} className="hover:bg-tertiary-hover">
                        <td className="px-3 py-2 font-mono text-xs text-primary">{row.sourceFilePath}</td>
                        <td className="px-3 py-2 text-center">{row.totalStrings}</td>
                        <td className="px-3 py-2 text-center text-green-600 dark:text-green-400">{effectiveTranslated}</td>
                        <td className="px-3 py-2 text-center text-red-600 dark:text-red-400">{effectiveUntranslated}</td>
                        <td className="px-3 py-2 text-center text-amber-600 dark:text-amber-400">{row.staleCount}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <ProgressBar percent={row.completionPercent} />
                            <span className="text-xs text-secondary w-8 text-right">{row.completionPercent}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {fileRows.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-secondary text-xs">No matching files</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Section 3: String-Level View (Virtual) ── */}
        <section className="flex-1 min-h-0 flex flex-col">
          <SectionLabel>Translatable Strings ({stringItems.length})</SectionLabel>
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto border border-primary rounded-lg"
          >
            <div style={{ height: totalHeight, position: 'relative' }}>
              {virtualItems.map(({ item: s, index, offsetTop }) => {
                const translations = stringTranslations.get(s.id);

                return (
                  <div
                    key={s.id}
                    className="absolute left-0 right-0 flex items-center gap-3 px-3 border-b border-primary hover:bg-tertiary-hover cursor-pointer"
                    style={{ top: offsetTop, height: 56 }}
                    onClick={() => openTranslationForString(s.id, s.blockId, s.line, activeLang)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') openTranslationForString(s.id, s.blockId, s.line, activeLang); }}
                    data-testid={`string-row-${index}`}
                  >
                    {/* Type badge */}
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded flex-none ${
                      s.type === 'dialogue' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                      s.type === 'narration' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                    }`}>
                      {s.type === 'menu-choice' ? 'choice' : s.type}
                    </span>

                    {/* Source text */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-primary truncate">
                        {s.characterTag && <span className="font-semibold text-indigo-500 mr-1">{s.characterTag}:</span>}
                        {s.sourceText}
                      </div>
                      <div className="text-[10px] text-secondary truncate">{s.filePath}:{s.line}</div>
                    </div>

                    {/* Language status badges */}
                    <div className="flex gap-1 flex-none">
                      {detectedLanguages.map(lang => {
                        const t = translations?.get(lang);
                        const isStale = t && t.translatedText === s.sourceText;
                        const color = t
                          ? isStale
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
                        return (
                          <button
                            key={lang}
                            type="button"
                            disabled={!t}
                            className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-400 ${color} ${t ? 'cursor-pointer hover:brightness-95' : 'cursor-not-allowed opacity-60'}`}
                            title={t ? (isStale ? `${lang}: stale` : `${lang}: ${t.translatedText}`) : `${lang}: missing`}
                            aria-label={t ? `Open ${lang} translation` : `${lang} translation missing`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (t) {
                                setSelectedLanguage(lang);
                                onOpenBlock(t.blockId, t.line);
                              }
                            }}
                          >
                            {lang.slice(0, 2)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
      {generateModal}
    </div>
  );
};

export default TranslationDashboard;
