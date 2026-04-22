import { describe, it, expect } from 'vitest';
import {
  isTranslationFile,
  extractLanguageFromPath,
  extractTranslatableStrings,
  extractTranslatedStrings,
  deriveSourceFilePath,
  buildStringTranslationMap,
  computeLanguageCoverages,
  performTranslationAnalysis,
} from '../lib/renpyTranslationParser';
import type { AnalysisBlock } from '../lib/renpyTranslationParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlock(overrides: Partial<AnalysisBlock> & { content: string }): AnalysisBlock {
  return {
    id: overrides.id ?? 'block-1',
    filePath: overrides.filePath ?? 'game/script.rpy',
    content: overrides.content,
  };
}

// ---------------------------------------------------------------------------
// isTranslationFile / extractLanguageFromPath
// ---------------------------------------------------------------------------

describe('isTranslationFile', () => {
  it('returns true for paths under /tl/<lang>/', () => {
    expect(isTranslationFile('game/tl/french/script.rpy')).toBe(true);
    expect(isTranslationFile('game/tl/japanese/common.rpy')).toBe(true);
  });

  it('returns false for source paths', () => {
    expect(isTranslationFile('game/script.rpy')).toBe(false);
    expect(isTranslationFile('game/screens.rpy')).toBe(false);
  });

  it('handles backslash paths (Windows)', () => {
    expect(isTranslationFile('game\\tl\\french\\script.rpy')).toBe(true);
  });
});

describe('extractLanguageFromPath', () => {
  it('extracts the language code', () => {
    expect(extractLanguageFromPath('game/tl/french/script.rpy')).toBe('french');
    expect(extractLanguageFromPath('game/tl/ja_JP/common.rpy')).toBe('ja_JP');
  });

  it('returns null for non-translation paths', () => {
    expect(extractLanguageFromPath('game/script.rpy')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deriveSourceFilePath
// ---------------------------------------------------------------------------

describe('deriveSourceFilePath', () => {
  it('strips the tl/<lang>/ segment', () => {
    expect(deriveSourceFilePath('game/tl/french/script.rpy', 'french')).toBe('game/script.rpy');
    expect(deriveSourceFilePath('game/tl/japanese/chapter1.rpy', 'japanese')).toBe('game/chapter1.rpy');
  });

  it('handles backslash paths', () => {
    expect(deriveSourceFilePath('game\\tl\\french\\script.rpy', 'french')).toBe('game/script.rpy');
  });

  it('returns the original path if tl segment not found', () => {
    expect(deriveSourceFilePath('game/script.rpy', 'french')).toBe('game/script.rpy');
  });
});

// ---------------------------------------------------------------------------
// extractTranslatableStrings
// ---------------------------------------------------------------------------

describe('extractTranslatableStrings', () => {
  it('extracts dialogue lines', () => {
    const block = makeBlock({
      content: 'label start:\n    e "Hello world"\n    return\n',
    });
    const result = extractTranslatableStrings([block], new Map(), {
      start: { blockId: 'block-1' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].sourceText).toBe('Hello world');
    expect(result[0].type).toBe('dialogue');
    expect(result[0].characterTag).toBe('e');
    expect(result[0].labelScope).toBe('start');
  });

  it('extracts narration lines', () => {
    const block = makeBlock({
      content: 'label intro:\n    "Once upon a time..."\n',
    });
    const result = extractTranslatableStrings([block], new Map(), {
      intro: { blockId: 'block-1' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].sourceText).toBe('Once upon a time...');
    expect(result[0].type).toBe('narration');
    expect(result[0].characterTag).toBeNull();
  });

  it('extracts menu choices', () => {
    const block = makeBlock({
      content: 'label choice:\n    menu:\n        "Go left":\n            jump left\n        "Go right":\n            jump right\n',
    });
    const result = extractTranslatableStrings([block], new Map(), {
      choice: { blockId: 'block-1' },
    });
    expect(result).toHaveLength(2);
    expect(result[0].sourceText).toBe('Go left');
    expect(result[0].type).toBe('menu-choice');
    expect(result[1].sourceText).toBe('Go right');
  });

  it('skips translation files', () => {
    const block = makeBlock({
      filePath: 'game/tl/french/script.rpy',
      content: 'label start:\n    e "Bonjour"\n',
    });
    const result = extractTranslatableStrings([block], new Map(), {});
    expect(result).toHaveLength(0);
  });

  it('skips Ren\'Py keyword lines that look like dialogue', () => {
    const block = makeBlock({
      content: 'label start:\n    show eileen happy\n    scene bg room\n    e "Real dialogue"\n',
    });
    const result = extractTranslatableStrings([block], new Map(), {
      start: { blockId: 'block-1' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].sourceText).toBe('Real dialogue');
  });

  it('returns empty for blocks with no translatable content', () => {
    const block = makeBlock({
      content: 'init python:\n    config.screen_width = 1920\n',
    });
    const result = extractTranslatableStrings([block], new Map(), {});
    expect(result).toHaveLength(0);
  });

  it('handles multiple labels in one block', () => {
    const block = makeBlock({
      content: 'label part1:\n    e "Line A"\nlabel part2:\n    e "Line B"\n',
    });
    const result = extractTranslatableStrings([block], new Map(), {
      part1: { blockId: 'block-1' },
      part2: { blockId: 'block-1' },
    });
    expect(result).toHaveLength(2);
    expect(result[0].labelScope).toBe('part1');
    expect(result[1].labelScope).toBe('part2');
  });
});

// ---------------------------------------------------------------------------
// extractTranslatedStrings
// ---------------------------------------------------------------------------

describe('extractTranslatedStrings', () => {
  it('parses translate <lang> <id>: blocks with dialogue', () => {
    const block = makeBlock({
      id: 'tl-block',
      filePath: 'game/tl/french/script.rpy',
      content: 'translate french start_abc123:\n    e "Bonjour le monde"\n',
    });
    const { translatedStrings, detectedLanguages } = extractTranslatedStrings([block]);
    expect(detectedLanguages.has('french')).toBe(true);
    expect(translatedStrings.get('french')).toHaveLength(1);
    expect(translatedStrings.get('french')![0].translatedText).toBe('Bonjour le monde');
    expect(translatedStrings.get('french')![0].id).toBe('start_abc123');
    expect(translatedStrings.get('french')![0].characterTag).toBe('e');
  });

  it('parses translate <lang> <id>: blocks with narration', () => {
    const block = makeBlock({
      id: 'tl-block',
      filePath: 'game/tl/spanish/script.rpy',
      content: 'translate spanish intro_xyz:\n    "Habia una vez..."\n',
    });
    const { translatedStrings } = extractTranslatedStrings([block]);
    expect(translatedStrings.get('spanish')).toHaveLength(1);
    expect(translatedStrings.get('spanish')![0].translatedText).toBe('Habia una vez...');
    expect(translatedStrings.get('spanish')![0].characterTag).toBeNull();
  });

  it('parses translate <lang> strings: old/new tables', () => {
    const block = makeBlock({
      id: 'tl-block',
      filePath: 'game/tl/german/common.rpy',
      content: 'translate german strings:\n    old "Start"\n    new "Anfang"\n    old "Quit"\n    new "Beenden"\n',
    });
    const { translatedStrings } = extractTranslatedStrings([block]);
    expect(translatedStrings.get('german')).toHaveLength(2);
    expect(translatedStrings.get('german')![0].translatedText).toBe('Anfang');
    expect(translatedStrings.get('german')![0].sourceText).toBe('Start');
    expect(translatedStrings.get('german')![1].translatedText).toBe('Beenden');
    expect(translatedStrings.get('german')![1].sourceText).toBe('Quit');
  });

  it('skips non-translation files', () => {
    const block = makeBlock({
      filePath: 'game/script.rpy',
      content: 'label start:\n    e "Hello"\n',
    });
    const { translatedStrings, detectedLanguages } = extractTranslatedStrings([block]);
    expect(translatedStrings.size).toBe(0);
    expect(detectedLanguages.size).toBe(0);
  });

  it('detects multiple languages', () => {
    const blocks = [
      makeBlock({ id: 'fr', filePath: 'game/tl/french/script.rpy', content: 'translate french id1:\n    e "Bonjour"\n' }),
      makeBlock({ id: 'de', filePath: 'game/tl/german/script.rpy', content: 'translate german id1:\n    e "Hallo"\n' }),
    ];
    const { detectedLanguages } = extractTranslatedStrings(blocks);
    expect(detectedLanguages.size).toBe(2);
    expect(detectedLanguages.has('french')).toBe(true);
    expect(detectedLanguages.has('german')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildStringTranslationMap
// ---------------------------------------------------------------------------

describe('buildStringTranslationMap', () => {
  it('matches translated dialogue to source by file path and character tag', () => {
    const source = [
      { id: 'b1:2', sourceText: 'Hello', blockId: 'b1', filePath: 'game/script.rpy', line: 2, labelScope: 'start', characterTag: 'e', type: 'dialogue' as const },
    ];
    const translated = new Map([
      ['french', [{ id: 'start_abc', translatedText: 'Bonjour', blockId: 'tl1', filePath: 'game/tl/french/script.rpy', line: 2, language: 'french', characterTag: 'e', sourceText: null }]],
    ]);
    const map = buildStringTranslationMap(source, translated, new Set(['french']));
    expect(map.has('b1:2')).toBe(true);
    expect(map.get('b1:2')!.get('french')!.translatedText).toBe('Bonjour');
  });

  it('matches stale translations (text identical to source)', () => {
    const source = [
      { id: 'b1:2', sourceText: 'Hello', blockId: 'b1', filePath: 'game/script.rpy', line: 2, labelScope: 'start', characterTag: 'e', type: 'dialogue' as const },
    ];
    const translated = new Map([
      ['french', [{ id: 'start_abc', translatedText: 'Hello', blockId: 'tl1', filePath: 'game/tl/french/script.rpy', line: 2, language: 'french', characterTag: 'e', sourceText: null }]],
    ]);
    const map = buildStringTranslationMap(source, translated, new Set(['french']));
    expect(map.has('b1:2')).toBe(true);
    expect(map.get('b1:2')!.get('french')!.translatedText).toBe('Hello');
  });

  it('matches string table entries by source text', () => {
    const source = [
      { id: 'b1:3', sourceText: 'Start Game', blockId: 'b1', filePath: 'game/screens.rpy', line: 3, labelScope: null, characterTag: null, type: 'menu-choice' as const },
    ];
    const translated = new Map([
      ['french', [{ id: 'strings:Start Game', translatedText: 'Commencer', blockId: 'tl1', filePath: 'game/tl/french/screens.rpy', line: 3, language: 'french', characterTag: null, sourceText: 'Start Game' }]],
    ]);
    const map = buildStringTranslationMap(source, translated, new Set(['french']));
    expect(map.has('b1:3')).toBe(true);
    expect(map.get('b1:3')!.get('french')!.translatedText).toBe('Commencer');
  });

  it('matches narration translations', () => {
    const source = [
      { id: 'b1:2', sourceText: 'Once upon a time', blockId: 'b1', filePath: 'game/script.rpy', line: 2, labelScope: 'start', characterTag: null, type: 'narration' as const },
    ];
    const translated = new Map([
      ['french', [{ id: 'start_xyz', translatedText: 'Il etait une fois', blockId: 'tl1', filePath: 'game/tl/french/script.rpy', line: 2, language: 'french', characterTag: null, sourceText: null }]],
    ]);
    const map = buildStringTranslationMap(source, translated, new Set(['french']));
    expect(map.has('b1:2')).toBe(true);
    expect(map.get('b1:2')!.get('french')!.translatedText).toBe('Il etait une fois');
  });

  it('handles multiple languages for the same source string', () => {
    const source = [
      { id: 'b1:2', sourceText: 'Hello', blockId: 'b1', filePath: 'game/script.rpy', line: 2, labelScope: 'start', characterTag: 'e', type: 'dialogue' as const },
    ];
    const translated = new Map([
      ['french', [{ id: 'start_abc', translatedText: 'Bonjour', blockId: 'tl1', filePath: 'game/tl/french/script.rpy', line: 2, language: 'french', characterTag: 'e', sourceText: null }]],
      ['german', [{ id: 'start_abc', translatedText: 'Hallo', blockId: 'tl2', filePath: 'game/tl/german/script.rpy', line: 2, language: 'german', characterTag: 'e', sourceText: null }]],
    ]);
    const map = buildStringTranslationMap(source, translated, new Set(['french', 'german']));
    expect(map.get('b1:2')!.size).toBe(2);
    expect(map.get('b1:2')!.get('french')!.translatedText).toBe('Bonjour');
    expect(map.get('b1:2')!.get('german')!.translatedText).toBe('Hallo');
  });

  it('returns empty map when no translations', () => {
    const source = [
      { id: 'b1:2', sourceText: 'Hello', blockId: 'b1', filePath: 'game/script.rpy', line: 2, labelScope: 'start', characterTag: 'e', type: 'dialogue' as const },
    ];
    const map = buildStringTranslationMap(source, new Map(), new Set(['french']));
    expect(map.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeLanguageCoverages
// ---------------------------------------------------------------------------

describe('computeLanguageCoverages', () => {
  it('computes 100% coverage', () => {
    const source = [
      { id: 'b1:1', sourceText: 'Hello', blockId: 'b1', filePath: 'game/script.rpy', line: 1, labelScope: null, characterTag: 'e', type: 'dialogue' as const },
    ];
    const stringTranslations = new Map([
      ['b1:1', new Map([['french', { id: 'start_abc', translatedText: 'Bonjour', blockId: 'tl1', filePath: 'game/tl/french/script.rpy', line: 2, language: 'french', characterTag: 'e', sourceText: null }]])],
    ]);
    const coverages = computeLanguageCoverages(source, stringTranslations, new Set(['french']));
    expect(coverages).toHaveLength(1);
    expect(coverages[0].completionPercent).toBe(100);
    expect(coverages[0].untranslatedCount).toBe(0);
  });

  it('computes 0% when no translations exist', () => {
    const source = [
      { id: 'b1:1', sourceText: 'Hello', blockId: 'b1', filePath: 'game/script.rpy', line: 1, labelScope: null, characterTag: 'e', type: 'dialogue' as const },
    ];
    const coverages = computeLanguageCoverages(source, new Map(), new Set(['french']));
    expect(coverages).toHaveLength(1);
    expect(coverages[0].completionPercent).toBe(0);
    expect(coverages[0].untranslatedCount).toBe(1);
  });

  it('computes partial coverage', () => {
    const source = [
      { id: 'b1:1', sourceText: 'Hello', blockId: 'b1', filePath: 'game/script.rpy', line: 1, labelScope: null, characterTag: 'e', type: 'dialogue' as const },
      { id: 'b1:2', sourceText: 'Goodbye', blockId: 'b1', filePath: 'game/script.rpy', line: 2, labelScope: null, characterTag: 'e', type: 'dialogue' as const },
    ];
    const stringTranslations = new Map([
      ['b1:1', new Map([['french', { id: 'start_abc', translatedText: 'Bonjour', blockId: 'tl1', filePath: 'game/tl/french/script.rpy', line: 2, language: 'french', characterTag: 'e', sourceText: null }]])],
    ]);
    const coverages = computeLanguageCoverages(source, stringTranslations, new Set(['french']));
    expect(coverages[0].completionPercent).toBe(50);
    expect(coverages[0].translatedCount).toBe(1);
    expect(coverages[0].untranslatedCount).toBe(1);
  });

  it('returns empty array when no languages detected', () => {
    const coverages = computeLanguageCoverages([], new Map(), new Set());
    expect(coverages).toHaveLength(0);
  });

  it('detects stale translations (text matches source)', () => {
    const source = [
      { id: 'b1:1', sourceText: 'Hello', blockId: 'b1', filePath: 'game/script.rpy', line: 1, labelScope: null, characterTag: 'e', type: 'dialogue' as const },
    ];
    const stringTranslations = new Map([
      ['b1:1', new Map([['french', { id: 'start_abc', translatedText: 'Hello', blockId: 'tl1', filePath: 'game/tl/french/script.rpy', line: 2, language: 'french', characterTag: 'e', sourceText: null }]])],
    ]);
    const coverages = computeLanguageCoverages(source, stringTranslations, new Set(['french']));
    expect(coverages[0].staleCount).toBe(1);
    expect(coverages[0].completionPercent).toBe(0);
  });

  it('includes file breakdown', () => {
    const source = [
      { id: 'b1:1', sourceText: 'Hello', blockId: 'b1', filePath: 'game/script.rpy', line: 1, labelScope: null, characterTag: 'e', type: 'dialogue' as const },
      { id: 'b2:1', sourceText: 'Bye', blockId: 'b2', filePath: 'game/chapter2.rpy', line: 1, labelScope: null, characterTag: 'e', type: 'dialogue' as const },
    ];
    const stringTranslations = new Map([
      ['b1:1', new Map([['french', { id: 'start_abc', translatedText: 'Bonjour', blockId: 'tl1', filePath: 'game/tl/french/script.rpy', line: 2, language: 'french', characterTag: 'e', sourceText: null }]])],
    ]);
    const coverages = computeLanguageCoverages(source, stringTranslations, new Set(['french']));
    expect(coverages[0].fileBreakdown).toHaveLength(2);
    const scriptFile = coverages[0].fileBreakdown.find(f => f.sourceFilePath === 'game/script.rpy');
    expect(scriptFile!.translatedCount).toBe(1);
    const ch2File = coverages[0].fileBreakdown.find(f => f.sourceFilePath === 'game/chapter2.rpy');
    expect(ch2File!.translatedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// performTranslationAnalysis (integration)
// ---------------------------------------------------------------------------

describe('performTranslationAnalysis', () => {
  it('runs end-to-end with source + translation blocks', () => {
    const blocks: AnalysisBlock[] = [
      makeBlock({
        id: 'src',
        filePath: 'game/script.rpy',
        content: 'label start:\n    e "Hello world"\n    "Narration here"\n',
      }),
      makeBlock({
        id: 'tl-fr',
        filePath: 'game/tl/french/script.rpy',
        content: 'translate french start_abc:\n    e "Bonjour le monde"\n\ntranslate french start_def:\n    "Narration ici"\n',
      }),
    ];
    const labels = { start: { blockId: 'src' } };
    const result = performTranslationAnalysis(blocks, new Map(), labels);

    expect(result.translatableStrings).toHaveLength(2);
    expect(result.detectedLanguages).toEqual(['french']);
    expect(result.languageCoverages).toHaveLength(1);
    expect(result.languageCoverages[0].language).toBe('french');
    expect(result.languageCoverages[0].translatedCount).toBe(2);
    expect(result.languageCoverages[0].completionPercent).toBe(100);
  });

  it('returns empty data when there are no translatable strings', () => {
    const blocks: AnalysisBlock[] = [
      makeBlock({
        content: 'init python:\n    config.screen_width = 1920\n',
      }),
    ];
    const result = performTranslationAnalysis(blocks, new Map(), {});
    expect(result.translatableStrings).toHaveLength(0);
    expect(result.detectedLanguages).toHaveLength(0);
    expect(result.languageCoverages).toHaveLength(0);
  });

  it('handles source-only (no translation files)', () => {
    const blocks: AnalysisBlock[] = [
      makeBlock({
        content: 'label start:\n    e "Hello"\n',
      }),
    ];
    const result = performTranslationAnalysis(blocks, new Map(), { start: { blockId: 'block-1' } });
    expect(result.translatableStrings).toHaveLength(1);
    expect(result.detectedLanguages).toHaveLength(0);
    expect(result.languageCoverages).toHaveLength(0);
  });

  it('handles translation-only (no source blocks)', () => {
    const blocks: AnalysisBlock[] = [
      makeBlock({
        id: 'tl-fr',
        filePath: 'game/tl/french/script.rpy',
        content: 'translate french start_abc:\n    e "Bonjour"\n',
      }),
    ];
    const result = performTranslationAnalysis(blocks, new Map(), {});
    expect(result.translatableStrings).toHaveLength(0);
    expect(result.detectedLanguages).toEqual(['french']);
    expect(result.languageCoverages).toHaveLength(1);
    expect(result.languageCoverages[0].completionPercent).toBe(0);
  });

  it('builds stringTranslations lookup keyed by source string IDs', () => {
    const blocks: AnalysisBlock[] = [
      makeBlock({
        id: 'src',
        filePath: 'game/script.rpy',
        content: 'label start:\n    e "Hello"\n',
      }),
      makeBlock({
        id: 'tl-fr',
        filePath: 'game/tl/french/script.rpy',
        content: 'translate french myid:\n    e "Bonjour"\n',
      }),
      makeBlock({
        id: 'tl-de',
        filePath: 'game/tl/german/script.rpy',
        content: 'translate german myid:\n    e "Hallo"\n',
      }),
    ];
    const result = performTranslationAnalysis(blocks, new Map(), { start: { blockId: 'src' } });
    // The key should be the SOURCE string ID (src:2), not the Ren'Py translation ID (myid)
    expect(result.stringTranslations.has('src:2')).toBe(true);
    expect(result.stringTranslations.get('src:2')!.size).toBe(2);
    expect(result.stringTranslations.get('src:2')!.get('french')!.translatedText).toBe('Bonjour');
    expect(result.stringTranslations.get('src:2')!.get('german')!.translatedText).toBe('Hallo');
  });

  it('correctly identifies stale translations in end-to-end analysis', () => {
    const blocks: AnalysisBlock[] = [
      makeBlock({
        id: 'src',
        filePath: 'game/script.rpy',
        content: 'label start:\n    e "Hello"\n',
      }),
      makeBlock({
        id: 'tl-fr',
        filePath: 'game/tl/french/script.rpy',
        content: 'translate french start_abc:\n    e "Hello"\n',
      }),
    ];
    const result = performTranslationAnalysis(blocks, new Map(), { start: { blockId: 'src' } });
    expect(result.languageCoverages[0].staleCount).toBe(1);
    expect(result.languageCoverages[0].translatedCount).toBe(1);
    expect(result.languageCoverages[0].completionPercent).toBe(0);
  });

  it('matches string table entries to menu choices', () => {
    const blocks: AnalysisBlock[] = [
      makeBlock({
        id: 'src',
        filePath: 'game/script.rpy',
        content: 'label start:\n    menu:\n        "Go left":\n            jump left\n',
      }),
      makeBlock({
        id: 'tl-fr',
        filePath: 'game/tl/french/script.rpy',
        content: 'translate french strings:\n    old "Go left"\n    new "Aller a gauche"\n',
      }),
    ];
    const result = performTranslationAnalysis(blocks, new Map(), { start: { blockId: 'src' } });
    expect(result.languageCoverages[0].translatedCount).toBe(1);
    expect(result.languageCoverages[0].completionPercent).toBe(100);
  });
});
