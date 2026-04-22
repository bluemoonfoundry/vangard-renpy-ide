import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TranslationDashboard from '../components/TranslationDashboard';
import type { TranslationAnalysisResult, Block } from '../types';

// ResizeObserver is not available in jsdom — provide a minimal stub.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultGenerateProps = {
  onGenerateTranslations: vi.fn().mockResolvedValue(undefined),
  isGenerating: false,
  isRenpyPathValid: true,
};

function makeEmptyTranslationData(): TranslationAnalysisResult {
  return {
    translatableStrings: [],
    translatedStrings: new Map(),
    languageCoverages: [],
    detectedLanguages: [],
    stringTranslations: new Map(),
  };
}

function makeSampleTranslationData(): TranslationAnalysisResult {
  const stringTranslations = new Map();
  stringTranslations.set('id1', new Map([
    ['french', { id: 'id1', translatedText: 'Bonjour', blockId: 'tl1', filePath: 'game/tl/french/script.rpy', line: 2, language: 'french' }],
  ]));

  return {
    translatableStrings: [
      { id: 'id1', sourceText: 'Hello', blockId: 'b1', filePath: 'game/script.rpy', line: 1, labelScope: 'start', characterTag: 'e', type: 'dialogue' },
      { id: 'id2', sourceText: 'Goodbye', blockId: 'b1', filePath: 'game/script.rpy', line: 2, labelScope: 'start', characterTag: 'e', type: 'dialogue' },
    ],
    translatedStrings: new Map([
      ['french', [{ id: 'id1', translatedText: 'Bonjour', blockId: 'tl1', filePath: 'game/tl/french/script.rpy', line: 2, language: 'french' }]],
    ]),
    languageCoverages: [
      {
        language: 'french',
        totalStrings: 2,
        translatedCount: 1,
        staleCount: 0,
        untranslatedCount: 1,
        completionPercent: 50,
        fileBreakdown: [
          { sourceFilePath: 'game/script.rpy', totalStrings: 2, translatedCount: 1, staleCount: 0, completionPercent: 50 },
        ],
      },
    ],
    detectedLanguages: ['french'],
    stringTranslations,
  };
}

function makeSampleBlocks(): Block[] {
  return [
    {
      id: 'b1',
      content: 'label start:\n    e "Hello"\n    e "Goodbye"\n',
      position: { x: 0, y: 0 },
      width: 200,
      height: 150,
      title: 'start',
      filePath: 'game/script.rpy',
    },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TranslationDashboard', () => {
  it('renders empty state when no languages detected', () => {
    const data = makeEmptyTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={[]} onOpenBlock={vi.fn()} {...defaultGenerateProps} />,
    );
    expect(screen.getByText('No Translations Detected')).toBeInTheDocument();
  });

  it('renders language cards with correct percentages', () => {
    const data = makeSampleTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={makeSampleBlocks()} onOpenBlock={vi.fn()} {...defaultGenerateProps} />,
    );
    expect(screen.getAllByText('french').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('renders file breakdown table', () => {
    const data = makeSampleTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={makeSampleBlocks()} onOpenBlock={vi.fn()} {...defaultGenerateProps} />,
    );
    expect(screen.getByText('game/script.rpy')).toBeInTheDocument();
  });

  it('renders translatable strings section', () => {
    const data = makeSampleTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={makeSampleBlocks()} onOpenBlock={vi.fn()} {...defaultGenerateProps} />,
    );
    expect(screen.getByText(/Translatable Strings/)).toBeInTheDocument();
  });

  it('calls onOpenBlock when clicking a string row', () => {
    const onOpenBlock = vi.fn();
    const data = makeSampleTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={makeSampleBlocks()} onOpenBlock={onOpenBlock} {...defaultGenerateProps} />,
    );
    const row = screen.getByTestId('string-row-0');
    fireEvent.click(row);
    expect(onOpenBlock).toHaveBeenCalledWith('b1', 1);
  });

  it('filters by status pill', () => {
    const data = makeSampleTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={makeSampleBlocks()} onOpenBlock={vi.fn()} {...defaultGenerateProps} />,
    );
    // Click "untranslated" status pill — there are two sets (file breakdown + shared),
    // just click the first occurrence
    const untranslatedButtons = screen.getAllByText('untranslated');
    fireEvent.click(untranslatedButtons[0]);
    // After filtering, the string count should reflect untranslated only
    expect(screen.getByText(/Translatable Strings \(1\)/)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Generate Translations tests
  // ---------------------------------------------------------------------------

  it('renders generate button in empty state when isRenpyPathValid is true', () => {
    const data = makeEmptyTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={[]} onOpenBlock={vi.fn()} {...defaultGenerateProps} />,
    );
    const btn = screen.getByTestId('generate-translations-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('disables generate button when isRenpyPathValid is false', () => {
    const data = makeEmptyTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={[]} onOpenBlock={vi.fn()} {...defaultGenerateProps} isRenpyPathValid={false} />,
    );
    const btn = screen.getByTestId('generate-translations-btn');
    expect(btn).toBeDisabled();
  });

  it('disables generate button when isGenerating is true', () => {
    const data = makeEmptyTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={[]} onOpenBlock={vi.fn()} {...defaultGenerateProps} isGenerating={true} />,
    );
    const btn = screen.getByTestId('generate-translations-btn');
    expect(btn).toBeDisabled();
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('shows language input form when generate button is clicked', () => {
    const data = makeEmptyTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={[]} onOpenBlock={vi.fn()} {...defaultGenerateProps} />,
    );
    fireEvent.click(screen.getByTestId('generate-translations-btn'));
    expect(screen.getByTestId('generate-form')).toBeInTheDocument();
    expect(screen.getByTestId('language-input')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-generate-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-generate-btn')).toBeInTheDocument();
  });

  it('validates language input — rejects invalid, accepts valid', () => {
    const data = makeEmptyTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={[]} onOpenBlock={vi.fn()} {...defaultGenerateProps} />,
    );
    fireEvent.click(screen.getByTestId('generate-translations-btn'));

    const input = screen.getByTestId('language-input');
    const confirmBtn = screen.getByTestId('confirm-generate-btn');

    // Empty input → confirm disabled
    expect(confirmBtn).toBeDisabled();

    // Invalid input (starts with number)
    fireEvent.change(input, { target: { value: '1french' } });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByTestId('language-validation-error')).toBeInTheDocument();

    // Valid input
    fireEvent.change(input, { target: { value: 'french' } });
    expect(confirmBtn).not.toBeDisabled();
    expect(screen.queryByTestId('language-validation-error')).not.toBeInTheDocument();
  });

  it('calls onGenerateTranslations with entered language on confirm', () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    const data = makeEmptyTranslationData();
    render(
      <TranslationDashboard translationData={data} blocks={[]} onOpenBlock={vi.fn()} {...defaultGenerateProps} onGenerateTranslations={onGenerate} />,
    );
    fireEvent.click(screen.getByTestId('generate-translations-btn'));

    const input = screen.getByTestId('language-input');
    fireEvent.change(input, { target: { value: 'japanese' } });
    fireEvent.click(screen.getByTestId('confirm-generate-btn'));

    expect(onGenerate).toHaveBeenCalledWith('japanese');
  });
});
