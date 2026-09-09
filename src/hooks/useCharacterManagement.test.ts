/**
 * @file hooks/useCharacterManagement.test.ts
 * @description Tests for useCharacterManagement — tab opening and character update/rename.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCharacterManagement } from '@/hooks/useCharacterManagement';
import type { UseCharacterManagementProps } from '@/hooks/useCharacterManagement';
import { createMockElectronAPI, installElectronAPI, uninstallElectronAPI } from '@/test/mocks/electronAPI';
import { createBlock, createCharacter, createEmptyAnalysisResult } from '@/test/mocks/sampleData';
import type { Character } from '@/types';

function makeProps(overrides: Partial<UseCharacterManagementProps> = {}): UseCharacterManagementProps {
  const block = createBlock({ content: 'define e = Character("Eileen")\n' });
  const eileen = createCharacter({ tag: 'e', name: 'Eileen', definedInBlockId: block.id });
  const analysisResult = createEmptyAnalysisResult({
    characters: new Map([['e', eileen]]),
  });

  return {
    blocks: [block],
    analysisResult,
    projectRootPath: '/project',
    updateBlock: vi.fn(),
    addBlock: vi.fn(),
    setFileSystemTree: vi.fn(),
    setCharacterProfiles: vi.fn(),
    setCharacterPortraits: vi.fn(),
    setHasUnsavedSettings: vi.fn(),
    addToast: vi.fn(),
    pendingTagRenameRef: { current: null },
    openTabs: [],
    secondaryOpenTabs: [],
    activePaneId: 'primary',
    splitLayout: 'none',
    setOpenTabs: vi.fn(),
    setActiveTabId: vi.fn(),
    setSecondaryOpenTabs: vi.fn(),
    setSecondaryActiveTabId: vi.fn(),
    setActivePaneId: vi.fn(),
    ...overrides,
  };
}

// ============================================================================
// handleOpenCharacterEditor
// ============================================================================

describe('useCharacterManagement — handleOpenCharacterEditor', () => {
  it('opens a new primary tab when the tab does not exist', () => {
    const setOpenTabs = vi.fn();
    const setActiveTabId = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagement(makeProps({ setOpenTabs, setActiveTabId }))
    );
    act(() => result.current.handleOpenCharacterEditor('e'));
    expect(setOpenTabs).toHaveBeenCalled();
    expect(setActiveTabId).toHaveBeenCalledWith('char-e');
  });

  it('activates existing primary tab without adding duplicates', () => {
    const existingTab = { id: 'char-e', type: 'character' as const, characterTag: 'e' };
    const setOpenTabs = vi.fn();
    const setActiveTabId = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagement(
        makeProps({ openTabs: [existingTab], setOpenTabs, setActiveTabId })
      )
    );
    act(() => result.current.handleOpenCharacterEditor('e'));
    expect(setActiveTabId).toHaveBeenCalledWith('char-e');
    expect(setOpenTabs).not.toHaveBeenCalled();
  });

  it('activates existing secondary tab and switches active pane', () => {
    const existingTab = { id: 'char-e', type: 'character' as const, characterTag: 'e' };
    const setSecondaryActiveTabId = vi.fn();
    const setActivePaneId = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagement(
        makeProps({
          secondaryOpenTabs: [existingTab],
          setSecondaryActiveTabId,
          setActivePaneId,
        })
      )
    );
    act(() => result.current.handleOpenCharacterEditor('e'));
    expect(setSecondaryActiveTabId).toHaveBeenCalledWith('char-e');
    expect(setActivePaneId).toHaveBeenCalledWith('secondary');
  });

  it('opens in secondary pane when activePaneId is secondary and splitLayout is set', () => {
    const setSecondaryOpenTabs = vi.fn();
    const setSecondaryActiveTabId = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagement(
        makeProps({
          activePaneId: 'secondary',
          splitLayout: 'right',
          setSecondaryOpenTabs,
          setSecondaryActiveTabId,
        })
      )
    );
    act(() => result.current.handleOpenCharacterEditor('e'));
    expect(setSecondaryOpenTabs).toHaveBeenCalled();
    expect(setSecondaryActiveTabId).toHaveBeenCalledWith('char-e');
  });

  it('opens a new tab with no prefill fields when called without a prefill argument', () => {
    const setOpenTabs = vi.fn();
    const { result } = renderHook(() => useCharacterManagement(makeProps({ setOpenTabs })));
    act(() => { result.current.handleOpenCharacterEditor('new_character'); });
    const updater = setOpenTabs.mock.calls[0][0] as (prev: unknown[]) => unknown[];
    const tabs = updater([]);
    expect(tabs[0]).toEqual({ id: 'char-new_character', type: 'character', characterTag: 'new_character' });
  });

  it('opens a new tab with initialCharacterTag/initialCharacterName when a prefill is given', () => {
    const setOpenTabs = vi.fn();
    const { result } = renderHook(() => useCharacterManagement(makeProps({ setOpenTabs })));
    act(() => {
      result.current.handleOpenCharacterEditor('captain_rex', { initialTag: 'captain_rex', initialName: 'Captain Rex' });
    });
    const updater = setOpenTabs.mock.calls[0][0] as (prev: unknown[]) => unknown[];
    const tabs = updater([]);
    expect(tabs[0]).toEqual({
      id: 'char-captain_rex',
      type: 'character',
      characterTag: 'captain_rex',
      initialCharacterTag: 'captain_rex',
      initialCharacterName: 'Captain Rex',
    });
  });

  // Regression test for a fully-symbolic/non-Latin selection (e.g. 'エレン'), where
  // sanitizeIdentifier(rawName) returns ''. The caller (App.tsx's
  // handleCreateCharacterFromSelection) must substitute a non-empty placeholder tag
  // ('new') for the tab id/characterTag so useTabContentRenderer's
  // `tab.type === 'character' && tab.characterTag` truthiness guard still renders the
  // tab, while keeping initialTag as the real (empty) sanitized value so the form field
  // opens empty and existing tag-required validation catches it. This test exercises the
  // hook at the boundary the caller actually hits: a non-empty tag with an empty
  // initialTag prefill.
  it('opens a usable (truthy-tag) tab when the prefill initialTag is empty (non-Latin/symbolic selection)', () => {
    const setOpenTabs = vi.fn();
    const { result } = renderHook(() => useCharacterManagement(makeProps({ setOpenTabs })));
    act(() => {
      result.current.handleOpenCharacterEditor('new', { initialTag: '', initialName: 'エレン' });
    });
    const updater = setOpenTabs.mock.calls[0][0] as (prev: unknown[]) => unknown[];
    const tabs = updater([]) as Array<{ characterTag: string; initialCharacterTag: string; initialCharacterName: string }>;
    expect(tabs[0].characterTag).toBeTruthy();
    expect(tabs[0].characterTag).toBe('new');
    expect(tabs[0].initialCharacterTag).toBe('');
    expect(tabs[0].initialCharacterName).toBe('エレン');
  });
});

// ============================================================================
// handleUpdateCharacter — new character (no oldTag)
// ============================================================================

describe('useCharacterManagement — handleUpdateCharacter (new character)', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    api = createMockElectronAPI();
    installElectronAPI(api);
  });

  afterEach(() => {
    uninstallElectronAPI();
  });

  it('appends to existing characters.rpy block when it exists', async () => {
    const charsBlock = createBlock({ id: 'chars-block', filePath: 'game/characters.rpy', content: '# chars\n' });
    const updateBlock = vi.fn();
    const setHasUnsavedSettings = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagement(makeProps({ blocks: [charsBlock], updateBlock, setHasUnsavedSettings }))
    );
    const newChar: Character = { tag: 'k', name: 'Kira', color: '#cc6600', definedInBlockId: '' };
    await act(async () => {
      await result.current.handleUpdateCharacter(newChar);
    });
    expect(updateBlock).toHaveBeenCalledWith('chars-block', expect.objectContaining({ content: expect.stringContaining('define k') }));
  });

  it('updates characterProfiles when profile is provided', async () => {
    const charsBlock = createBlock({ id: 'chars-block', filePath: 'game/characters.rpy', content: '# chars\n' });
    const setCharacterProfiles = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagement(makeProps({ blocks: [charsBlock], setCharacterProfiles }))
    );
    const newChar: Character = { tag: 'k', name: 'Kira', color: '#cc6600', definedInBlockId: '', profile: 'Kira profile text' };
    await act(async () => {
      await result.current.handleUpdateCharacter(newChar);
    });
    expect(setCharacterProfiles).toHaveBeenCalled();
  });

  it('shows success toast after saving', async () => {
    const charsBlock = createBlock({ id: 'chars-block', filePath: 'game/characters.rpy', content: '# chars\n' });
    const addToast = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagement(makeProps({ blocks: [charsBlock], addToast }))
    );
    const newChar: Character = { tag: 'k', name: 'Kira', color: '#cc6600', definedInBlockId: '' };
    await act(async () => {
      await result.current.handleUpdateCharacter(newChar);
    });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('Kira'), 'success');
  });
});

// ============================================================================
// handleUpdateCharacter — updating existing character (with oldTag)
// ============================================================================

describe('useCharacterManagement — handleUpdateCharacter (update existing)', () => {
  it('updates block content with new character definition', async () => {
    const block = createBlock({
      id: 'block-1',
      content: 'define e = Character("Eileen")\n',
    });
    const eileen = createCharacter({ tag: 'e', name: 'Eileen', definedInBlockId: 'block-1' });
    const analysisResult = createEmptyAnalysisResult({
      characters: new Map([['e', eileen]]),
    });
    const updateBlock = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagement(makeProps({ blocks: [block], analysisResult, updateBlock }))
    );
    const updatedChar: Character = { tag: 'e', name: 'Eileen Updated', color: '#ff0000', definedInBlockId: 'block-1' };
    await act(async () => {
      await result.current.handleUpdateCharacter(updatedChar, 'e');
    });
    expect(updateBlock).toHaveBeenCalledWith('block-1', expect.objectContaining({ content: expect.stringContaining('define e') }));
  });

  it('shows error toast when original character definition cannot be found', async () => {
    const addToast = vi.fn();
    const analysisResult = createEmptyAnalysisResult({
      characters: new Map(), // 'e' not in the map
    });
    const { result } = renderHook(() =>
      useCharacterManagement(makeProps({ analysisResult, addToast }))
    );
    const char: Character = { tag: 'e', name: 'Eileen', color: '#cc6600', definedInBlockId: 'block-1' };
    await act(async () => {
      await result.current.handleUpdateCharacter(char, 'e');
    });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('Cannot find'), 'error');
  });

  it('shows error toast when block cannot be found for the character', async () => {
    const addToast = vi.fn();
    const eileen = createCharacter({ tag: 'e', name: 'Eileen', definedInBlockId: 'missing-block' });
    const analysisResult = createEmptyAnalysisResult({
      characters: new Map([['e', eileen]]),
    });
    const { result } = renderHook(() =>
      useCharacterManagement(makeProps({
        blocks: [], // empty blocks — 'missing-block' not found
        analysisResult,
        addToast,
      }))
    );
    const char: Character = { tag: 'e', name: 'Eileen', color: '#cc6600', definedInBlockId: 'missing-block' };
    await act(async () => {
      await result.current.handleUpdateCharacter(char, 'e');
    });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('Cannot find file'), 'error');
  });
});

// ============================================================================
// handleUpdateCharacter — source fidelity (preserve unrelated content, idempotence)
// ============================================================================

describe('useCharacterManagement — handleUpdateCharacter (source fidelity)', () => {
  it('preserves unrelated content surrounding the define line when updating a character', async () => {
    const block = createBlock({
      id: 'block-1',
      content: '# header comment\ndefine e = Character("Eileen")\ndefine narrator = Character(None)\n# trailing comment\n',
    });
    const eileen = createCharacter({ tag: 'e', name: 'Eileen', definedInBlockId: 'block-1' });
    const analysisResult = createEmptyAnalysisResult({
      characters: new Map([['e', eileen]]),
    });
    const updateBlock = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagement(makeProps({ blocks: [block], analysisResult, updateBlock }))
    );
    const updatedChar: Character = { tag: 'e', name: 'Eileen Updated', color: '#ff0000', definedInBlockId: 'block-1' };
    await act(async () => {
      await result.current.handleUpdateCharacter(updatedChar, 'e');
    });
    const newContent = updateBlock.mock.calls[0][1].content as string;
    expect(newContent).toContain('# header comment');
    expect(newContent).toContain('define narrator = Character(None)');
    expect(newContent).toContain('# trailing comment');
    expect(newContent).toContain('define e = Character("Eileen Updated", color="#ff0000")');
  });

  it('produces a stable define line when saving the same character twice in a row (idempotence)', async () => {
    const block = createBlock({
      id: 'block-1',
      content: 'define e = Character("Eileen")\n',
    });
    const eileen = createCharacter({ tag: 'e', name: 'Eileen', definedInBlockId: 'block-1' });
    const analysisResult = createEmptyAnalysisResult({
      characters: new Map([['e', eileen]]),
    });
    const updateBlock = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagement(makeProps({ blocks: [block], analysisResult, updateBlock }))
    );
    const char: Character = { tag: 'e', name: 'Eileen', color: '#cc6600', definedInBlockId: 'block-1' };
    await act(async () => {
      await result.current.handleUpdateCharacter(char, 'e');
    });
    const firstContent = updateBlock.mock.calls[0][1].content as string;

    updateBlock.mockClear();
    const { result: result2 } = renderHook(() =>
      useCharacterManagement(makeProps({
        blocks: [{ ...block, content: firstContent }],
        analysisResult,
        updateBlock,
      }))
    );
    await act(async () => {
      await result2.current.handleUpdateCharacter(char, 'e');
    });
    const secondContent = updateBlock.mock.calls[0][1].content as string;
    expect(secondContent).toBe(firstContent);
  });

  it('does not touch unrelated dialogue lines that merely start with a similar-looking prefix on rename', async () => {
    const defineBlock = createBlock({
      id: 'block-1',
      content: 'define e = Character("Eileen")\n',
    });
    const dialogueBlock = createBlock({
      id: 'block-2',
      content: 'label start:\n    e "Hello!"\n    eve "Not the same character!"\n    return\n',
    });
    const eileen = createCharacter({ tag: 'e', name: 'Eileen', definedInBlockId: 'block-1' });
    const analysisResult = createEmptyAnalysisResult({
      characters: new Map([['e', eileen]]),
    });
    const updateBlock = vi.fn();
    const { result } = renderHook(() =>
      useCharacterManagement(makeProps({
        blocks: [defineBlock, dialogueBlock],
        analysisResult,
        updateBlock,
      }))
    );
    const renamedChar: Character = { tag: 'eileen', name: 'Eileen', color: '#cc6600', definedInBlockId: 'block-1' };
    await act(async () => {
      await result.current.handleUpdateCharacter(renamedChar, 'e');
    });
    const dialogueUpdateCall = updateBlock.mock.calls.find(call => call[0] === 'block-2');
    expect(dialogueUpdateCall).toBeDefined();
    const newDialogueContent = dialogueUpdateCall![1].content as string;
    expect(newDialogueContent).toContain('eileen "Hello!"');
    expect(newDialogueContent).toContain('eve "Not the same character!"');
  });
});

// ============================================================================
// handleUpdateCharacter — rename (oldTag !== newTag)
// ============================================================================

describe('useCharacterManagement — handleUpdateCharacter (rename tag)', () => {
  it('renames tag in the define block and dialogue blocks', async () => {
    const defineBlock = createBlock({
      id: 'block-1',
      content: 'define e = Character("Eileen")\n',
    });
    const dialogueBlock = createBlock({
      id: 'block-2',
      content: 'label start:\n    e "Hello!"\n    return\n',
    });
    const eileen = createCharacter({ tag: 'e', name: 'Eileen', definedInBlockId: 'block-1' });
    const analysisResult = createEmptyAnalysisResult({
      characters: new Map([['e', eileen]]),
    });
    const updateBlock = vi.fn();
    const pendingTagRenameRef = { current: null as { oldTag: string; newTag: string } | null };
    const { result } = renderHook(() =>
      useCharacterManagement(makeProps({
        blocks: [defineBlock, dialogueBlock],
        analysisResult,
        updateBlock,
        pendingTagRenameRef,
      }))
    );
    const renamedChar: Character = { tag: 'eileen', name: 'Eileen', color: '#cc6600', definedInBlockId: 'block-1' };
    await act(async () => {
      await result.current.handleUpdateCharacter(renamedChar, 'e');
    });
    // pendingTagRenameRef should be set
    expect(pendingTagRenameRef.current).toEqual({ oldTag: 'e', newTag: 'eileen' });
    // updateBlock should have been called for files that had matches
    expect(updateBlock).toHaveBeenCalled();
  });
});
