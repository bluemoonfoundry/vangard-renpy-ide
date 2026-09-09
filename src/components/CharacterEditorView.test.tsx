/**
 * @file CharacterEditorView.test.tsx
 * @description Tests for CharacterEditorView's initialTag/initialName prefill behavior
 * and its Usage Locations table.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import CharacterEditorView from '@/components/CharacterEditorView';
import { createEmptyAnalysisResult, createBlock, createCharacter, createLabelNode } from '@/test/mocks/sampleData';
import { installElectronAPI, uninstallElectronAPI } from '@/test/mocks/electronAPI';
import type { ProjectImage } from '@/types';

describe('CharacterEditorView — initialTag/initialName prefill', () => {
  it('pre-fills tag and name from initialTag/initialName when character is undefined', () => {
    render(
      <CharacterEditorView
        character={undefined}
        onSave={vi.fn()}
        existingTags={[]}
        projectImages={[]}
        imageMetadata={new Map()}
        initialTag="captain_rex"
        initialName="Captain Rex"
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={vi.fn()}
      />
    );
    expect((screen.getByLabelText(/tag/i) as HTMLInputElement).value).toBe('captain_rex');
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Captain Rex');
  });

  it('leaves tag/name blank when neither character nor initial props are given (existing + Add flow)', () => {
    render(
      <CharacterEditorView
        character={undefined}
        onSave={vi.fn()}
        existingTags={[]}
        projectImages={[]}
        imageMetadata={new Map()}
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={vi.fn()}
      />
    );
    expect((screen.getByLabelText(/tag/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('');
  });
});

describe('CharacterEditorView — Usage Locations', () => {
  const eileen = createCharacter({ tag: 'e', name: 'Eileen' });

  function usageLocationsSection() {
    return screen.getByText('Usage Locations').closest('div') as HTMLElement;
  }

  it('renders a usage row grouped by file and label', () => {
    const block = createBlock({ id: 'block-1', filePath: 'game/script.rpy' });
    const analysisResult = createEmptyAnalysisResult({
      dialogueLines: new Map([['block-1', [{ line: 2, tag: 'e' }, { line: 4, tag: 'e' }]]]),
      labelNodes: [createLabelNode({ blockId: 'block-1', label: 'start', startLine: 1 })],
    });

    render(
      <CharacterEditorView
        character={eileen}
        onSave={vi.fn()}
        existingTags={['e']}
        projectImages={[]}
        imageMetadata={new Map()}
        analysisResult={analysisResult}
        blocks={[block]}
        onOpenEditor={vi.fn()}
        onImportPortrait={vi.fn()}
      />
    );

    expect(screen.getByText('Usage Locations')).toBeInTheDocument();
    const section = within(usageLocationsSection());
    expect(section.getByText('script.rpy')).toBeInTheDocument();
    expect(section.getByText('start')).toBeInTheDocument();
    expect(section.getByText('2')).toBeInTheDocument(); // Lines count column
  });

  it('shows an empty state when the character has no dialogue lines', () => {
    render(
      <CharacterEditorView
        character={eileen}
        onSave={vi.fn()}
        existingTags={['e']}
        projectImages={[]}
        imageMetadata={new Map()}
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={vi.fn()}
      />
    );

    expect(screen.getByText('No dialogue found for this character yet.')).toBeInTheDocument();
  });

  it('calls onOpenEditor with the block id and first occurrence line when a row is clicked', () => {
    const block = createBlock({ id: 'block-1', filePath: 'game/script.rpy' });
    const analysisResult = createEmptyAnalysisResult({
      dialogueLines: new Map([['block-1', [{ line: 2, tag: 'e' }]]]),
      labelNodes: [createLabelNode({ blockId: 'block-1', label: 'start', startLine: 1 })],
    });
    const onOpenEditor = vi.fn();

    render(
      <CharacterEditorView
        character={eileen}
        onSave={vi.fn()}
        existingTags={['e']}
        projectImages={[]}
        imageMetadata={new Map()}
        analysisResult={analysisResult}
        blocks={[block]}
        onOpenEditor={onOpenEditor}
        onImportPortrait={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('script.rpy'));
    expect(onOpenEditor).toHaveBeenCalledWith('block-1', 2);
  });

  it('does not render a Usage Locations section for a new (unsaved) character', () => {
    render(
      <CharacterEditorView
        character={undefined}
        onSave={vi.fn()}
        existingTags={[]}
        projectImages={[]}
        imageMetadata={new Map()}
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={vi.fn()}
      />
    );

    expect(screen.queryByText('Usage Locations')).not.toBeInTheDocument();
  });
});

describe('CharacterEditorView — Portrait box', () => {
  afterEach(() => {
    uninstallElectronAPI();
  });

  function makeImage(overrides: Partial<ProjectImage> = {}): ProjectImage {
    return {
      // filePath (relative) and projectFilePath (absolute) deliberately differ, matching
      // real ProjectImage data -- a test that used the same value for both would mask a
      // bug where the wrong one gets persisted (it did, once).
      filePath: 'game/images/portraits/eileen.png',
      fileName: 'eileen.png',
      dataUrl: 'media://eileen.png',
      fileHandle: null,
      isInProject: true,
      projectFilePath: '/project/game/images/portraits/eileen.png',
      ...overrides,
    };
  }

  it('shows a placeholder when the character has no portrait', () => {
    render(
      <CharacterEditorView
        character={createCharacter()}
        onSave={vi.fn()}
        existingTags={['e']}
        projectImages={[]}
        imageMetadata={new Map()}
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/character portrait/i)).toBeInTheDocument();
    expect(screen.queryByAltText('Character portrait')).not.toBeInTheDocument();
  });

  it('renders the resolved image when the character has a portraitPath matching a project image', () => {
    const image = makeImage();
    render(
      <CharacterEditorView
        character={createCharacter({ portraitPath: image.filePath })}
        onSave={vi.fn()}
        existingTags={['e']}
        projectImages={[image]}
        imageMetadata={new Map()}
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={vi.fn()}
      />
    );
    expect(screen.getByAltText('Character portrait')).toHaveAttribute('src', image.dataUrl);
  });

  it('resolves the portrait using only the relative filePath, as after an app restart (projectFilePath absent)', () => {
    // Regression test: after a restart, a freshly project-load-scanned ProjectImage only
    // has `filePath` (relative) set -- `projectFilePath` (absolute) is not populated the
    // same way. Storing the absolute path in portraitPath would fail to match here.
    const image = makeImage({ projectFilePath: undefined });
    render(
      <CharacterEditorView
        character={createCharacter({ portraitPath: image.filePath })}
        onSave={vi.fn()}
        existingTags={['e']}
        projectImages={[image]}
        imageMetadata={new Map()}
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={vi.fn()}
      />
    );
    expect(screen.getByAltText('Character portrait')).toHaveAttribute('src', image.dataUrl);
  });

  it('dropping an in-project image from the Images pane sets the portrait without importing, and saves the relative path', () => {
    const image = makeImage();
    const onImportPortrait = vi.fn();
    const onSave = vi.fn();
    render(
      <CharacterEditorView
        character={createCharacter()}
        onSave={onSave}
        existingTags={['e']}
        projectImages={[image]}
        imageMetadata={new Map()}
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={onImportPortrait}
      />
    );

    const box = screen.getByLabelText(/character portrait/i);
    fireEvent.drop(box, {
      dataTransfer: { getData: (type: string) => (type === 'application/renpy-image-path' ? image.filePath : ''), files: [] },
    });

    expect(onImportPortrait).not.toHaveBeenCalled();
    expect(screen.getByAltText('Character portrait')).toHaveAttribute('src', image.dataUrl);

    fireEvent.click(screen.getByText('Save Changes'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ portraitPath: image.filePath }),
      'e',
    );
  });

  it('dropping a scanned-but-not-yet-imported image imports it first', async () => {
    const scanned = makeImage({ isInProject: false, projectFilePath: undefined, filePath: '/external/scan/eileen.png' });
    const imported = makeImage();
    const onImportPortrait = vi.fn().mockResolvedValue(imported);
    const character = createCharacter();
    const { rerender } = render(
      <CharacterEditorView
        character={character}
        onSave={vi.fn()}
        existingTags={['e']}
        projectImages={[scanned]}
        imageMetadata={new Map()}
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={onImportPortrait}
      />
    );

    const box = screen.getByLabelText(/character portrait/i);
    fireEvent.drop(box, {
      dataTransfer: { getData: (type: string) => (type === 'application/renpy-image-path' ? scanned.filePath : ''), files: [] },
    });

    expect(onImportPortrait).toHaveBeenCalledWith(scanned.filePath);

    // Simulate the parent re-rendering with the freshly imported image now in projectImages
    // (in the real app this happens because handleImportPortraitImage adds it to the images map).
    // Reuse the same `character` reference — a new object would re-trigger the
    // character-sync effect and reset the just-set portraitPath state.
    await waitFor(() => {
      rerender(
        <CharacterEditorView
          character={character}
          onSave={vi.fn()}
          existingTags={['e']}
          projectImages={[scanned, imported]}
          imageMetadata={new Map()}
          analysisResult={createEmptyAnalysisResult()}
          blocks={[]}
          onOpenEditor={vi.fn()}
          onImportPortrait={onImportPortrait}
        />
      );
      expect(screen.getByAltText('Character portrait')).toBeInTheDocument();
    });
  });

  it('double-clicking opens the native file dialog, imports the chosen file, and saves its relative path', async () => {
    const api = installElectronAPI();
    const imported = makeImage();
    api.selectImage.mockResolvedValue('/external/eileen.png');
    const onImportPortrait = vi.fn().mockResolvedValue(imported);
    const onSave = vi.fn();
    const character = createCharacter();

    const { rerender } = render(
      <CharacterEditorView
        character={character}
        onSave={onSave}
        existingTags={['e']}
        projectImages={[]}
        imageMetadata={new Map()}
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={onImportPortrait}
      />
    );

    fireEvent.doubleClick(screen.getByLabelText(/character portrait/i));

    await waitFor(() => expect(onImportPortrait).toHaveBeenCalledWith('/external/eileen.png'));

    // Reuse the same `character` reference on rerender — a new object would re-trigger the
    // character-sync effect and reset the just-set portraitPath state.
    rerender(
      <CharacterEditorView
        character={character}
        onSave={onSave}
        existingTags={['e']}
        projectImages={[imported]}
        imageMetadata={new Map()}
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={onImportPortrait}
      />
    );

    fireEvent.click(screen.getByText('Save Changes'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ portraitPath: imported.filePath }),
      'e',
    );
  });

  it('clicking the remove button clears the portrait', () => {
    const image = makeImage();
    render(
      <CharacterEditorView
        character={createCharacter({ portraitPath: image.filePath })}
        onSave={vi.fn()}
        existingTags={['e']}
        projectImages={[image]}
        imageMetadata={new Map()}
        analysisResult={createEmptyAnalysisResult()}
        blocks={[]}
        onOpenEditor={vi.fn()}
        onImportPortrait={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText(/remove portrait/i));
    expect(screen.queryByAltText('Character portrait')).not.toBeInTheDocument();
  });
});
