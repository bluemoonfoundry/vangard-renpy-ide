/**
 * @file renpyTranslationParser.ts
 * @description Pure functions for parsing Ren'Py translation blocks and computing
 * per-language translation coverage. Works with the existing block/analysis data
 * produced by useRenpyAnalysis.
 */

import type {
  TranslatableString,
  TranslatedString,
  LanguageCoverage,
  TranslationFileBreakdown,
  TranslationAnalysisResult,
  DialogueLine,
} from '../types';

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/** Matches `translate <lang> <id>:` blocks */
const TRANSLATE_BLOCK_REGEX = /^\s*translate\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s*:/;

/** Matches `translate <lang> strings:` string-table blocks */
const TRANSLATE_STRINGS_REGEX = /^\s*translate\s+([a-zA-Z0-9_]+)\s+strings\s*:/;

/** Matches `old "..."` and `new "..."` lines inside a string-table block */
const OLD_NEW_REGEX = /^\s*(old|new)\s+"((?:\\.|[^"\\])*)"/;

/** Extracts language from a `/tl/<lang>/` path segment */
const TL_PATH_REGEX = /[/\\]tl[/\\]([a-zA-Z0-9_]+)[/\\]/;

/** Dialogue: `character "text"` */
const DIALOGUE_REGEX = /^\s*([a-zA-Z0-9_]+)\s+"((?:\\.|[^"\\])*)"/;

/** Narration: `"text"` (not starting with colon) */
const NARRATION_REGEX = /^\s*"((?:\\.|[^"\\])*)"/;

/** Menu choice: `"text"` followed by optional condition, ending with `:` */
const MENU_CHOICE_REGEX = /^\s*"((?:\\.|[^"\\])*)"(?:\s+if\s+.+)?\s*:/;

/** Label definition */
const LABEL_REGEX = /^\s*label\s+([a-zA-Z0-9_]+):/;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AnalysisBlock {
  id: string;
  content: string;
  filePath: string;
}

/**
 * Returns true if the file path looks like a Ren'Py translation file
 * (i.e. it lives under a `/tl/<language>/` directory).
 */
export function isTranslationFile(filePath: string): boolean {
  return TL_PATH_REGEX.test(filePath);
}

/**
 * Extract the language code from a translation file path.
 * Returns null if the path doesn't match the tl pattern.
 */
export function extractLanguageFromPath(filePath: string): string | null {
  const m = filePath.match(TL_PATH_REGEX);
  return m ? m[1] : null;
}

/**
 * Extract translatable strings (dialogue, narration, menu choices) from source blocks.
 */
export function extractTranslatableStrings(
  blocks: AnalysisBlock[],
  dialogueLines: Map<string, DialogueLine[]>,
  labels: Record<string, { blockId: string }>,
): TranslatableString[] {
  const strings: TranslatableString[] = [];
  // Build a reverse map: blockId -> label names defined in it
  const blockLabels = new Map<string, string[]>();
  for (const [labelName, loc] of Object.entries(labels)) {
    const existing = blockLabels.get(loc.blockId) || [];
    existing.push(labelName);
    blockLabels.set(loc.blockId, existing);
  }

  for (const block of blocks) {
    // Skip translation files — we only want source strings
    if (isTranslationFile(block.filePath)) continue;

    const lines = block.content.split('\n');
    let currentLabel: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Track label scope
      const labelMatch = line.match(LABEL_REGEX);
      if (labelMatch) {
        currentLabel = labelMatch[1];
        continue;
      }

      // Menu choice
      const menuMatch = line.match(MENU_CHOICE_REGEX);
      if (menuMatch) {
        const text = menuMatch[1];
        if (text.trim()) {
          strings.push({
            id: `${block.id}:${lineNum}`,
            sourceText: text,
            blockId: block.id,
            filePath: block.filePath,
            line: lineNum,
            labelScope: currentLabel,
            characterTag: null,
            type: 'menu-choice',
          });
        }
        continue;
      }

      // Dialogue: character "text"
      const diaMatch = line.match(DIALOGUE_REGEX);
      if (diaMatch) {
        const tag = diaMatch[1];
        const text = diaMatch[2];
        // Only count as dialogue if the tag is known or looks like a character
        // (exclude Ren'Py keywords that might match the pattern)
        const KEYWORDS = new Set([
          'label', 'jump', 'call', 'return', 'menu', 'if', 'elif', 'else',
          'while', 'for', 'pass', 'python', 'init', 'define', 'default',
          'screen', 'show', 'hide', 'scene', 'with', 'play', 'stop', 'queue',
          'pause', 'image', 'transform', 'translate', 'style', 'window',
        ]);
        if (!KEYWORDS.has(tag) && text.trim()) {
          strings.push({
            id: `${block.id}:${lineNum}`,
            sourceText: text,
            blockId: block.id,
            filePath: block.filePath,
            line: lineNum,
            labelScope: currentLabel,
            characterTag: tag,
            type: 'dialogue',
          });
        }
        continue;
      }

      // Narration: "text"
      const narMatch = line.match(NARRATION_REGEX);
      if (narMatch) {
        const text = narMatch[1];
        if (text.trim()) {
          strings.push({
            id: `${block.id}:${lineNum}`,
            sourceText: text,
            blockId: block.id,
            filePath: block.filePath,
            line: lineNum,
            labelScope: currentLabel,
            characterTag: null,
            type: 'narration',
          });
        }
      }
    }
  }

  return strings;
}

/**
 * Derive the source file path from a translation file path by stripping the
 * `tl/<lang>/` segment. For example:
 *   `game/tl/french/script.rpy` → `game/script.rpy`
 *   `game/tl/japanese/chapter1.rpy` → `game/chapter1.rpy`
 */
export function deriveSourceFilePath(translationFilePath: string, language: string): string {
  // Normalize to forward slashes for matching
  const normalized = translationFilePath.replace(/\\/g, '/');
  const tlSegment = `tl/${language}/`;
  const idx = normalized.indexOf(tlSegment);
  if (idx === -1) return translationFilePath;
  return normalized.slice(0, idx) + normalized.slice(idx + tlSegment.length);
}

/**
 * Extract translated strings from translation blocks (files under `/tl/<lang>/`).
 * Parses both `translate <lang> <id>:` blocks and `translate <lang> strings:` tables.
 */
export function extractTranslatedStrings(
  blocks: AnalysisBlock[],
): { translatedStrings: Map<string, TranslatedString[]>; detectedLanguages: Set<string> } {
  const translatedStrings = new Map<string, TranslatedString[]>();
  const detectedLanguages = new Set<string>();

  for (const block of blocks) {
    if (!isTranslationFile(block.filePath)) continue;

    const langFromPath = extractLanguageFromPath(block.filePath);
    if (langFromPath) detectedLanguages.add(langFromPath);

    const lines = block.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // translate <lang> strings: (check BEFORE translate <lang> <id>: since "strings" matches both)
      const stringsMatch = line.match(TRANSLATE_STRINGS_REGEX);
      if (stringsMatch) {
        const lang = stringsMatch[1];
        detectedLanguages.add(lang);

        let currentOld: string | null = null;
        for (let j = i + 1; j < lines.length; j++) {
          const innerLine = lines[j];
          if (innerLine.trim() === '') continue;
          if (!/^\s/.test(innerLine)) break;

          const oldNewMatch = innerLine.match(OLD_NEW_REGEX);
          if (oldNewMatch) {
            if (oldNewMatch[1] === 'old') {
              currentOld = oldNewMatch[2];
            } else if (oldNewMatch[1] === 'new' && currentOld !== null) {
              const entryId = `strings:${currentOld}`;
              const entry: TranslatedString = {
                id: entryId,
                translatedText: oldNewMatch[2],
                blockId: block.id,
                filePath: block.filePath,
                line: j + 1,
                language: lang,
                characterTag: null,
                sourceText: currentOld,
              };
              if (!translatedStrings.has(lang)) translatedStrings.set(lang, []);
              translatedStrings.get(lang)!.push(entry);
              currentOld = null;
            }
          }
        }
        continue;
      }

      // translate <lang> <id>:
      const blockMatch = line.match(TRANSLATE_BLOCK_REGEX);
      if (blockMatch) {
        const lang = blockMatch[1];
        const id = blockMatch[2];
        detectedLanguages.add(lang);

        // Look for the translated text in subsequent lines
        for (let j = i + 1; j < lines.length; j++) {
          const innerLine = lines[j];
          if (innerLine.trim() === '') continue;
          if (!/^\s/.test(innerLine)) break;

          // Look for dialogue or narration in the translated block
          const diaMatch = innerLine.match(DIALOGUE_REGEX);
          if (diaMatch) {
            const entry: TranslatedString = {
              id,
              translatedText: diaMatch[2],
              blockId: block.id,
              filePath: block.filePath,
              line: j + 1,
              language: lang,
              characterTag: diaMatch[1],
              sourceText: null,
            };
            if (!translatedStrings.has(lang)) translatedStrings.set(lang, []);
            translatedStrings.get(lang)!.push(entry);
            break;
          }

          const narMatch = innerLine.match(NARRATION_REGEX);
          if (narMatch) {
            const entry: TranslatedString = {
              id,
              translatedText: narMatch[1],
              blockId: block.id,
              filePath: block.filePath,
              line: j + 1,
              language: lang,
              characterTag: null,
              sourceText: null,
            };
            if (!translatedStrings.has(lang)) translatedStrings.set(lang, []);
            translatedStrings.get(lang)!.push(entry);
            break;
          }
        }
        continue;
      }
    }
  }

  return { translatedStrings, detectedLanguages };
}

/**
 * Build a map from source string ID to Map<language, TranslatedString> by matching
 * translations to source strings using file path derivation and text/structure matching.
 *
 * This is the core matching logic. Ren'Py translation block IDs (`label_md5hash`)
 * don't match our source string IDs (`blockId:lineNumber`), so we match by:
 * 1. Deriving the source file path from the translation file path
 * 2. Grouping source strings by file, character tag, and type
 * 3. Matching translations to sources by file + character tag + text content
 * 4. For string tables (menu choices): matching by the `old` text stored in sourceText
 */
export function buildStringTranslationMap(
  translatableStrings: TranslatableString[],
  translatedStrings: Map<string, TranslatedString[]>,
  detectedLanguages: Set<string>,
): Map<string, Map<string, TranslatedString>> {
  const stringTranslations = new Map<string, Map<string, TranslatedString>>();

  // Group source strings by file path for efficient lookup
  const sourceByFile = new Map<string, TranslatableString[]>();
  for (const s of translatableStrings) {
    const normalized = s.filePath.replace(/\\/g, '/');
    if (!sourceByFile.has(normalized)) sourceByFile.set(normalized, []);
    sourceByFile.get(normalized)!.push(s);
  }

  for (const lang of detectedLanguages) {
    const langTranslations = translatedStrings.get(lang) || [];
    const claimed = new Set<string>(); // source string IDs already matched

    for (const ts of langTranslations) {
      // String table entries (menu choices) — match by old text
      if (ts.id.startsWith('strings:') && ts.sourceText) {
        // Find a source string whose text matches the old text
        for (const sources of sourceByFile.values()) {
          for (const src of sources) {
            if (!claimed.has(src.id) && src.sourceText === ts.sourceText) {
              claimed.add(src.id);
              if (!stringTranslations.has(src.id)) stringTranslations.set(src.id, new Map());
              stringTranslations.get(src.id)!.set(lang, ts);
              break;
            }
          }
        }
        continue;
      }

      // Block translations — derive source file from translation file path
      const derivedSourcePath = deriveSourceFilePath(ts.filePath, lang);
      const fileSourceStrings = sourceByFile.get(derivedSourcePath);
      if (!fileSourceStrings) continue;

      // Find a matching source string in the same file
      let matched = false;
      for (const src of fileSourceStrings) {
        if (claimed.has(src.id)) continue;

        // Match by character tag + text for stale translations (text is identical to source)
        const isStale = ts.translatedText === src.sourceText;

        // Match by character tag alignment
        const tagMatches = ts.characterTag === src.characterTag;
        // For narration, both should have null character tag
        const isNarrationMatch = ts.characterTag === null && src.characterTag === null && src.type === 'narration';

        if (isStale && (tagMatches || isNarrationMatch)) {
          claimed.add(src.id);
          if (!stringTranslations.has(src.id)) stringTranslations.set(src.id, new Map());
          stringTranslations.get(src.id)!.set(lang, ts);
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // Non-stale: match by character tag + type within the same file
      // Ren'Py translation blocks appear in the same order as source strings,
      // so matching the first unclaimed source string with the right tag works.
      for (const src of fileSourceStrings) {
        if (claimed.has(src.id)) continue;

        const tagMatches = ts.characterTag === src.characterTag;
        const isNarrationMatch = ts.characterTag === null && src.characterTag === null && src.type === 'narration';

        if (tagMatches || isNarrationMatch) {
          claimed.add(src.id);
          if (!stringTranslations.has(src.id)) stringTranslations.set(src.id, new Map());
          stringTranslations.get(src.id)!.set(lang, ts);
          break;
        }
      }
    }
  }

  return stringTranslations;
}

/**
 * Compute per-language coverage statistics from the matched string translation map.
 */
export function computeLanguageCoverages(
  translatableStrings: TranslatableString[],
  stringTranslations: Map<string, Map<string, TranslatedString>>,
  detectedLanguages: Set<string>,
): LanguageCoverage[] {
  const totalStrings = translatableStrings.length;

  // Group source strings by file for file breakdown
  const stringsByFile = new Map<string, TranslatableString[]>();
  for (const s of translatableStrings) {
    if (!stringsByFile.has(s.filePath)) stringsByFile.set(s.filePath, []);
    stringsByFile.get(s.filePath)!.push(s);
  }

  const coverages: LanguageCoverage[] = [];

  for (const lang of detectedLanguages) {
    let translatedCount = 0;
    let staleCount = 0;

    for (const src of translatableStrings) {
      const translations = stringTranslations.get(src.id);
      const t = translations?.get(lang);
      if (t) {
        translatedCount++;
        if (t.translatedText === src.sourceText) {
          staleCount++;
        }
      }
    }

    const effectiveTranslated = translatedCount - staleCount;
    const untranslatedCount = totalStrings - translatedCount;
    const completionPercent = totalStrings > 0 ? Math.round((effectiveTranslated / totalStrings) * 100) : 0;

    // File breakdown
    const fileBreakdown: TranslationFileBreakdown[] = [];
    for (const [filePath, fileStrings] of stringsByFile) {
      const fileTotal = fileStrings.length;
      let fileTranslated = 0;
      let fileStale = 0;
      for (const s of fileStrings) {
        const translations = stringTranslations.get(s.id);
        const t = translations?.get(lang);
        if (t) {
          fileTranslated++;
          if (t.translatedText === s.sourceText) {
            fileStale++;
          }
        }
      }
      fileBreakdown.push({
        sourceFilePath: filePath,
        totalStrings: fileTotal,
        translatedCount: fileTranslated,
        staleCount: fileStale,
        completionPercent: fileTotal > 0 ? Math.round(((fileTranslated - fileStale) / fileTotal) * 100) : 0,
      });
    }

    coverages.push({
      language: lang,
      totalStrings,
      translatedCount,
      staleCount,
      untranslatedCount,
      completionPercent,
      fileBreakdown,
    });
  }

  coverages.sort((a, b) => a.language.localeCompare(b.language));

  return coverages;
}

/**
 * Main entry point: run a full translation analysis over the given blocks.
 */
export function performTranslationAnalysis(
  blocks: AnalysisBlock[],
  dialogueLines: Map<string, DialogueLine[]>,
  labels: Record<string, { blockId: string }>,
): TranslationAnalysisResult {
  const translatableStrings = extractTranslatableStrings(blocks, dialogueLines, labels);
  const { translatedStrings, detectedLanguages } = extractTranslatedStrings(blocks);

  // Build the matched source→translation map FIRST, then derive coverages from it
  const stringTranslations = buildStringTranslationMap(translatableStrings, translatedStrings, detectedLanguages);
  const languageCoverages = computeLanguageCoverages(translatableStrings, stringTranslations, detectedLanguages);

  return {
    translatableStrings,
    translatedStrings,
    languageCoverages,
    detectedLanguages: Array.from(detectedLanguages).sort(),
    stringTranslations,
  };
}
