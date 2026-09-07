/**
 * Tests for EditorView and FileExplorerPanel.
 *
 * Both components have heavy external dependencies (Monaco editor,
 * IPC, virtual list). Strategy: mock everything external, then test
 * visible UI rendering and critical user interactions.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Monaco: vite.config.ts already aliases monaco-editor → src/test/mocks/monaco.ts
// We only need to mock the @monaco-editor/react wrapper component.
// Capture onMount / beforeMount so tests can trigger editor setup paths.
// ---------------------------------------------------------------------------

let capturedOnMount: ((editor: unknown, monaco: unknown) => void) | undefined;
let capturedBeforeMount: ((monaco: unknown) => void) | undefined;

vi.mock('@monaco-editor/react', () => ({
  default: (props: Record<string, unknown>) => {
    capturedBeforeMount = props.beforeMount as (monaco: unknown) => void;
    capturedOnMount = props.onMount as (editor: unknown, monaco: unknown) => void;
    return React.createElement('div', { 'data-testid': 'monaco-editor' });
  },
  __esModule: true,
}));

// ---------------------------------------------------------------------------
// Lib mocks — textmate, completions, validator, semantic tokens
// ---------------------------------------------------------------------------

vi.mock('@/lib/textmateGrammar', () => ({
  initTextMate: vi.fn(() => Promise.resolve()),
  createTextMateTokensProvider: vi.fn(() => ({})),
}));

vi.mock('@/lib/renpyCompletionProvider', () => ({
  detectContext: vi.fn(() => 'root'),
  getRenpyCompletions: vi.fn(() => []),
  isInsideScreenBlock: vi.fn(() => false),
}));

vi.mock('@/lib/renpyValidator', () => ({
  validateRenpyCode: vi.fn(() => []),
}));

vi.mock('@/lib/renpySemanticTokens', () => ({
  getSemanticTokensLegend: vi.fn(() => ({ tokenTypes: [], tokenModifiers: [] })),
  computeSemanticTokens: vi.fn(() => ({ data: new Uint32Array() })),
  SEMANTIC_DARK_RULES: [],
  SEMANTIC_LIGHT_RULES: [],
}));

vi.mock('@/lib/renpyLabelGuards', () => ({
  collectRenpyHasLabelGuards: vi.fn(() => new Set()),
  isJumpGuardedByHasLabel: vi.fn(() => false),
}));

vi.mock('@/lib/warpTarget', () => ({
  getLabelAtLine: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Heavy sub-component mocks
// ---------------------------------------------------------------------------

vi.mock('@/components/DialoguePreview', () => ({
  default: () => <div data-testid="dialogue-preview" />,
}));

vi.mock('@/components/MenuConstructorModal', () => ({
  MenuConstructorModal: () => null,
}));

vi.mock('@/components/MenuTemplatePickerModal', () => ({
  MenuTemplatePickerModal: () => null,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import EditorView from '@/components/EditorView';
import FileExplorerPanel from '@/components/FileExplorerPanel';
import { createBlock, createEmptyAnalysisResult } from '@/test/mocks/sampleData';
import type { FileSystemTreeNode, ClipboardState } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileNode(
  name: string,
  path: string,
  children?: FileSystemTreeNode[]
): FileSystemTreeNode {
  return children !== undefined ? { name, path, children } : { name, path };
}

function makeTree(): FileSystemTreeNode {
  return makeFileNode('game', '/project/game', [
    makeFileNode('script.rpy', '/project/game/script.rpy'),
    makeFileNode('chapter1.rpy', '/project/game/chapter1.rpy'),
    makeFileNode('images', '/project/game/images', [
      makeFileNode('bg_forest.png', '/project/game/images/bg_forest.png'),
    ]),
  ]);
}

// ============================================================================
// FileExplorerPanel
// ============================================================================

describe('FileExplorerPanel', () => {
  const baseProps = {
    tree: makeTree(),
    onFileOpen: vi.fn(),
    onCreateNode: vi.fn(),
    onRenameNode: vi.fn(),
    onDeleteNode: vi.fn(),
    onMoveNode: vi.fn(),
    clipboard: null as ClipboardState,
    onCut: vi.fn(),
    onCopy: vi.fn(),
    onPaste: vi.fn(),
    onCenterOnBlock: vi.fn(),
    onRefresh: vi.fn(),
    onRevealInFileManager: vi.fn(),
    onCopyPath: vi.fn(),
    selectedPaths: new Set<string>(),
    setSelectedPaths: vi.fn(),
    lastClickedPath: null,
    setLastClickedPath: vi.fn(),
    expandedPaths: new Set<string>(),
    onToggleExpand: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<FileExplorerPanel {...baseProps} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('shows "Project Explorer" heading', () => {
    render(<FileExplorerPanel {...baseProps} />);
    expect(screen.getByText('Project Explorer')).toBeTruthy();
  });

  it('shows "Open a project folder" message when tree is null', () => {
    render(<FileExplorerPanel {...baseProps} tree={null} />);
    expect(screen.getByText(/Open a project folder/i)).toBeTruthy();
  });

  it('renders top-level file names when tree has children', () => {
    render(<FileExplorerPanel {...baseProps} />);
    expect(screen.getByText('script.rpy')).toBeTruthy();
    expect(screen.getByText('chapter1.rpy')).toBeTruthy();
  });

  it('renders top-level directory names', () => {
    render(<FileExplorerPanel {...baseProps} />);
    expect(screen.getByText('images')).toBeTruthy();
  });

  it('does not render children of collapsed folders', () => {
    render(<FileExplorerPanel {...baseProps} />);
    expect(screen.queryByText('bg_forest.png')).toBeNull();
  });

  it('renders children of expanded folders', () => {
    const expandedPaths = new Set(['/project/game/images']);
    render(<FileExplorerPanel {...baseProps} expandedPaths={expandedPaths} />);
    expect(screen.getByText('bg_forest.png')).toBeTruthy();
  });

  it('calls onFileOpen when double-clicking a file node', () => {
    const onFileOpen = vi.fn();
    render(<FileExplorerPanel {...baseProps} onFileOpen={onFileOpen} />);
    const fileEl = screen.getByText('script.rpy');
    fireEvent.doubleClick(fileEl.closest('[title]') || fileEl);
    expect(onFileOpen).toHaveBeenCalledWith('/project/game/script.rpy');
  });

  it('calls onToggleExpand when double-clicking a folder node', () => {
    const onToggleExpand = vi.fn();
    render(<FileExplorerPanel {...baseProps} onToggleExpand={onToggleExpand} />);
    const folderEl = screen.getByText('images');
    fireEvent.doubleClick(folderEl.closest('[title]') || folderEl);
    expect(onToggleExpand).toHaveBeenCalledWith('/project/game/images');
  });

  it('calls setSelectedPaths when clicking a file row', () => {
    const setSelectedPaths = vi.fn();
    render(<FileExplorerPanel {...baseProps} setSelectedPaths={setSelectedPaths} />);
    const fileEl = screen.getByText('script.rpy');
    fireEvent.click(fileEl.closest('[title]') || fileEl);
    expect(setSelectedPaths).toHaveBeenCalled();
  });

  it('applies selected highlight class when path is selected', () => {
    const selectedPaths = new Set(['/project/game/script.rpy']);
    const { container } = render(<FileExplorerPanel {...baseProps} selectedPaths={selectedPaths} />);
    // The selected row should have bg-accent-light class
    const selectedRow = container.querySelector('.bg-accent-light');
    expect(selectedRow).toBeTruthy();
  });

  it('shows context menu when right-clicking a file node', () => {
    render(<FileExplorerPanel {...baseProps} />);
    const fileEl = screen.getByText('script.rpy');
    const row = fileEl.closest('[title]') || fileEl;
    fireEvent.contextMenu(row);
    // Context menu should appear (rendered via portal)
    expect(screen.getByText('Refresh')).toBeTruthy();
  });

  it('clicking the panel outside rows clears selection', () => {
    const setSelectedPaths = vi.fn();
    render(<FileExplorerPanel {...baseProps} setSelectedPaths={setSelectedPaths} />);
    // Click the aside element (top-level container)
    const aside = document.querySelector('aside');
    if (aside) fireEvent.click(aside);
    expect(setSelectedPaths).toHaveBeenCalledWith(new Set());
  });

  it('context menu closes after New File action is triggered', () => {
    render(<FileExplorerPanel {...baseProps} />);
    const fileEl = screen.getByText('script.rpy');
    fireEvent.contextMenu(fileEl.closest('[title]') || fileEl);
    expect(screen.getByText('New File...')).toBeTruthy();
    const newFileBtn = screen.getByText('New File...');
    fireEvent.click(newFileBtn);
    // Context menu should close
    expect(screen.queryByText('New File...')).toBeNull();
  });

  it('shows new-node input inside expanded subfolder after "New File" on folder', () => {
    // Build a tree where the subfolder IS a visible node (child of root)
    const tree: FileSystemTreeNode = makeFileNode('game', '/project/game', [
      makeFileNode('subdir', '/project/game/subdir', [
        makeFileNode('scene.rpy', '/project/game/subdir/scene.rpy'),
      ]),
    ]);
    const expandedPaths = new Set(['/project/game/subdir']);
    render(<FileExplorerPanel {...baseProps} tree={tree} expandedPaths={expandedPaths} />);
    // Right-click the subdir folder (which IS a visible tree node)
    const folderEl = screen.getByText('subdir');
    fireEvent.contextMenu(folderEl.closest('[title]') || folderEl);
    fireEvent.click(screen.getByText('New File...'));
    // After triggering, the input placeholder for new file should appear
    const input = document.querySelector('input[placeholder="new_file.rpy"]');
    expect(input).toBeTruthy();
  });

  it('handles externalAction new-file on a selected node', async () => {
    const setSelectedPaths = vi.fn();
    const onToggleExpand = vi.fn();
    const tree = makeTree();
    const selectedPaths = new Set(['/project/game']);
    render(
      <FileExplorerPanel
        {...baseProps}
        tree={tree}
        selectedPaths={selectedPaths}
        setSelectedPaths={setSelectedPaths}
        onToggleExpand={onToggleExpand}
        externalAction={{ type: 'new-file', key: 1 }}
      />
    );
    // Should attempt to expand the selected dir
    expect(onToggleExpand).toHaveBeenCalled();
  });
});

// ============================================================================
// EditorView helpers
// ============================================================================

function createMockEditorInstance(content = '', selectedText = '') {
  const mockSelection = selectedText ? { isEmpty: () => false } : null;
  const mockModel = {
    getValue: vi.fn(() => content),
    setValue: vi.fn(),
    updateOptions: vi.fn(),
    detectIndentation: vi.fn(),
    getLanguageId: vi.fn(() => 'renpy'),
    getValueInRange: vi.fn(() => selectedText),
  };
  const mockEd = {
    getValue: vi.fn(() => content),
    getModel: vi.fn(() => mockModel),
    focus: vi.fn(),
    addAction: vi.fn(),
    createContextKey: vi.fn((_key: string, _defaultValue: boolean) => ({ set: vi.fn(), get: vi.fn(() => false) })),
    getDomNode: vi.fn(() => null),
    getPosition: vi.fn(() => null),
    getSelection: vi.fn(() => mockSelection),
    setPosition: vi.fn(),
    setSelection: vi.fn(),
    revealLineInCenter: vi.fn(),
    deltaDecorations: vi.fn(() => []),
    onDidChangeModelContent: vi.fn((_listener: (e: unknown) => void) => ({ dispose: vi.fn() })),
    onDidChangeCursorPosition: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeCursorSelection: vi.fn(() => ({ dispose: vi.fn() })),
    onMouseDown: vi.fn((_listener: (e: unknown) => void) => ({ dispose: vi.fn() })),
    onContextMenu: vi.fn((_listener: (e: unknown) => void) => ({ dispose: vi.fn() })),
    pushUndoStop: vi.fn(),
    executeEdits: vi.fn(),
  };
  return { mockEd, mockModel };
}

function createMockMonacoInstance() {
  return {
    languages: {
      getLanguages: vi.fn(() => []),
      register: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      setTokensProvider: vi.fn(),
      registerDocumentSemanticTokensProvider: vi.fn(() => ({ dispose: vi.fn() })),
      registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
    },
    editor: {
      setModelLanguage: vi.fn(),
      setModelMarkers: vi.fn(),
      getModels: vi.fn(() => []),
      defineTheme: vi.fn(),
      ScrollType: { Smooth: 0 },
      MouseTargetType: { CONTENT_TEXT: 6 },
    },
    KeyMod: { CtrlCmd: 2048, Shift: 1024 },
    KeyCode: { KeyS: 49, KeyB: 32, KeyI: 41, KeyU: 52 },
    MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
    Range: class {
      constructor(
        public startLineNumber: number,
        public startColumn: number,
        public endLineNumber: number,
        public endColumn: number
      ) {}
    },
  };
}

async function renderAndMount(props: ReturnType<typeof makeEditorViewProps>) {
  const result = render(<EditorView {...props} />);
  const { mockEd, mockModel } = createMockEditorInstance(props.block.content);
  const mockMonaco = createMockMonacoInstance();
  await act(async () => {
    capturedBeforeMount?.(mockMonaco);
    capturedOnMount?.(mockEd, mockMonaco);
  });
  return { ...result, mockEd, mockModel, mockMonaco };
}

// ============================================================================
// EditorView
// ============================================================================

function makeEditorViewProps(overrides = {}) {
  const block = createBlock({ filePath: 'game/script.rpy', content: 'label start:\n    "Hello"\n    return\n' });
  const analysisResult = createEmptyAnalysisResult();
  return {
    block,
    blocks: [block],
    analysisResult,
    onSwitchFocusBlock: vi.fn(),
    onSave: vi.fn(),
    onDirtyChange: vi.fn(),
    editorTheme: 'dark' as const,
    editorFontFamily: 'monospace',
    editorFontSize: 14,
    addToast: vi.fn(),
    onEditorMount: vi.fn(),
    onEditorUnmount: vi.fn(),
    onWarpToLabel: vi.fn(),
    onCreateFileFromSelection: vi.fn(),
    onCreateVariableFromSelection: vi.fn(),
    onCreateCharacterFromSelection: vi.fn(),
    draftingMode: false,
    existingImageTags: new Set<string>(),
    existingAudioPaths: new Set<string>(),
    ...overrides,
  };
}

describe('EditorView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const props = makeEditorViewProps();
    const { container } = render(<EditorView {...props} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the Monaco editor stub', () => {
    const props = makeEditorViewProps();
    render(<EditorView {...props} />);
    expect(screen.getByTestId('monaco-editor')).toBeTruthy();
  });

  it('renders the DialoguePreview stub', () => {
    const props = makeEditorViewProps();
    render(<EditorView {...props} />);
    expect(screen.getByTestId('dialogue-preview')).toBeTruthy();
  });

  it('renders breadcrumbs showing the file path', () => {
    const props = makeEditorViewProps();
    render(<EditorView {...props} />);
    // Breadcrumbs split on "/" — last part "script.rpy" should appear
    expect(screen.getByText('script.rpy')).toBeTruthy();
  });

  it('renders breadcrumbs with each path segment', () => {
    const props = makeEditorViewProps();
    render(<EditorView {...props} />);
    expect(screen.getByText('game')).toBeTruthy();
    expect(screen.getByText('script.rpy')).toBeTruthy();
  });

  it('renders with light theme without crashing', () => {
    const props = makeEditorViewProps({ editorTheme: 'light' });
    const { container } = render(<EditorView {...props} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with draftingMode enabled without crashing', () => {
    const props = makeEditorViewProps({ draftingMode: true });
    const { container } = render(<EditorView {...props} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('calls onEditorUnmount when unmounted', () => {
    const onEditorUnmount = vi.fn();
    const props = makeEditorViewProps({ onEditorUnmount });
    const { unmount } = render(<EditorView {...props} />);
    unmount();
    expect(onEditorUnmount).toHaveBeenCalledWith('block-1');
  });

  it('renders without filePath (no breadcrumbs shown)', () => {
    const block = createBlock({ filePath: undefined });
    const props = makeEditorViewProps({ block });
    const { container } = render(<EditorView {...props} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with optional callbacks unset without crashing', () => {
    const props = makeEditorViewProps({
      onTriggerSave: undefined,
      onContentChange: undefined,
      onCursorPositionChange: undefined,
    });
    const { container } = render(<EditorView {...props} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('re-renders cleanly when block content changes', () => {
    const props = makeEditorViewProps();
    const { rerender } = render(<EditorView {...props} />);
    const updated = { ...props, block: { ...props.block, content: 'label updated:\n    return\n' } };
    expect(() => rerender(<EditorView {...updated} />)).not.toThrow();
  });

  // ---- post-mount tests (require renderAndMount) ----

  it('calls onEditorMount with blockId and editor instance on mount', async () => {
    const onEditorMount = vi.fn();
    const props = makeEditorViewProps({ onEditorMount });
    await renderAndMount(props);
    expect(onEditorMount).toHaveBeenCalledTimes(1);
    expect(onEditorMount).toHaveBeenCalledWith('block-1', expect.anything());
  });

  it('registers the save-block action on editor mount', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    const actionIds = mockEd.addAction.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id);
    expect(actionIds).toContain('save-block');
  });

  it('registers all five editor actions on mount', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    const actionIds = mockEd.addAction.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id);
    expect(actionIds).toContain('save-block');
    expect(actionIds).toContain('create-menu');
    expect(actionIds).toContain('insert-menu-template');
    expect(actionIds).toContain('warp-to-here');
    expect(actionIds).toContain('insert-copied-code');
  });

  it('calls editor.focus() on mount', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    expect(mockEd.focus).toHaveBeenCalled();
  });

  it('registers onDidChangeModelContent listener on mount', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    expect(mockEd.onDidChangeModelContent).toHaveBeenCalled();
  });

  it('registers onDidChangeCursorPosition listener on mount', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    expect(mockEd.onDidChangeCursorPosition).toHaveBeenCalled();
  });

  it('calls beforeMount and registers renpy language (getLanguages returns empty)', async () => {
    const props = makeEditorViewProps();
    const { mockMonaco } = await renderAndMount(props);
    expect(mockMonaco.languages.register).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'renpy' })
    );
  });

  it('calls setModelMarkers after mount (initial validation)', async () => {
    const props = makeEditorViewProps();
    const { mockMonaco } = await renderAndMount(props);
    expect(mockMonaco.editor.setModelMarkers).toHaveBeenCalled();
  });

  it('sets model language to renpy on mount when model is available', async () => {
    const props = makeEditorViewProps();
    const { mockMonaco } = await renderAndMount(props);
    expect(mockMonaco.editor.setModelLanguage).toHaveBeenCalledWith(
      expect.anything(),
      'renpy'
    );
  });

  it('creates warp context key on mount', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    expect(mockEd.createContextKey).toHaveBeenCalledWith('renpyCanWarpHere', false);
  });

  it('creates the has-selection context key on mount', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    expect(mockEd.createContextKey).toHaveBeenCalledWith('renpyHasSelection', false);
  });

  it('registers the three create-from-selection actions on mount', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    const actionIds = mockEd.addAction.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id);
    expect(actionIds).toContain('create-file-from-selection');
    expect(actionIds).toContain('create-variable-from-selection');
    expect(actionIds).toContain('create-character-from-selection');
  });

  it('gates the three create-from-selection actions on renpyHasSelection', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    const actions = mockEd.addAction.mock.calls.map((c: unknown[]) => c[0] as { id: string; precondition?: string });
    const gated = actions.filter(a => ['create-file-from-selection', 'create-variable-from-selection', 'create-character-from-selection'].includes(a.id));
    expect(gated).toHaveLength(3);
    gated.forEach(a => expect(a.precondition).toBe('renpyHasSelection'));
  });

  it('calls onCreateFileFromSelection with blockId and selected text when the action runs', async () => {
    const onCreateFileFromSelection = vi.fn();
    const props = makeEditorViewProps({ onCreateFileFromSelection });
    const { mockEd } = await renderAndMount({ ...props, block: { ...props.block, content: 'label start:\n    "the golden sword"\n    return\n' } });
    // Re-render/mount already happened; simulate a selection on this editor instance.
    (mockEd.getModel() as { getValueInRange: ReturnType<typeof vi.fn> }).getValueInRange.mockReturnValue('the golden sword');
    (mockEd.getSelection as ReturnType<typeof vi.fn>).mockReturnValue({ isEmpty: () => false });
    const action = mockEd.addAction.mock.calls.find((c: unknown[]) => (c[0] as { id: string }).id === 'create-file-from-selection')?.[0] as { run: (ed: unknown) => void };
    action.run(mockEd);
    expect(onCreateFileFromSelection).toHaveBeenCalledWith('block-1', 'the golden sword');
  });

  it('calls onCreateVariableFromSelection with selected text when the action runs', async () => {
    const onCreateVariableFromSelection = vi.fn();
    const props = makeEditorViewProps({ onCreateVariableFromSelection });
    const { mockEd } = await renderAndMount(props);
    (mockEd.getModel() as { getValueInRange: ReturnType<typeof vi.fn> }).getValueInRange.mockReturnValue('player_score');
    (mockEd.getSelection as ReturnType<typeof vi.fn>).mockReturnValue({ isEmpty: () => false });
    const action = mockEd.addAction.mock.calls.find((c: unknown[]) => (c[0] as { id: string }).id === 'create-variable-from-selection')?.[0] as { run: (ed: unknown) => void };
    action.run(mockEd);
    expect(onCreateVariableFromSelection).toHaveBeenCalledWith('player_score');
  });

  it('calls onCreateCharacterFromSelection with selected text when the action runs', async () => {
    const onCreateCharacterFromSelection = vi.fn();
    const props = makeEditorViewProps({ onCreateCharacterFromSelection });
    const { mockEd } = await renderAndMount(props);
    (mockEd.getModel() as { getValueInRange: ReturnType<typeof vi.fn> }).getValueInRange.mockReturnValue('Captain Rex');
    (mockEd.getSelection as ReturnType<typeof vi.fn>).mockReturnValue({ isEmpty: () => false });
    const action = mockEd.addAction.mock.calls.find((c: unknown[]) => (c[0] as { id: string }).id === 'create-character-from-selection')?.[0] as { run: (ed: unknown) => void };
    action.run(mockEd);
    expect(onCreateCharacterFromSelection).toHaveBeenCalledWith('Captain Rex');
  });

  it('does not call the callback when selection is empty', async () => {
    const onCreateVariableFromSelection = vi.fn();
    const props = makeEditorViewProps({ onCreateVariableFromSelection });
    const { mockEd } = await renderAndMount(props);
    (mockEd.getSelection as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const action = mockEd.addAction.mock.calls.find((c: unknown[]) => (c[0] as { id: string }).id === 'create-variable-from-selection')?.[0] as { run: (ed: unknown) => void };
    action.run(mockEd);
    expect(onCreateVariableFromSelection).not.toHaveBeenCalled();
  });

  it('registers the four formatting actions on mount', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    const actionIds = mockEd.addAction.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id);
    expect(actionIds).toContain('format-bold');
    expect(actionIds).toContain('format-italic');
    expect(actionIds).toContain('format-underline');
    expect(actionIds).toContain('format-strikethrough');
  });

  it('wraps selected text with {b}{/b} when the bold action runs', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    (mockEd.getModel() as { getValueInRange: ReturnType<typeof vi.fn> }).getValueInRange.mockReturnValue('hello');
    (mockEd.getSelection as ReturnType<typeof vi.fn>).mockReturnValue({
      isEmpty: () => false,
      startLineNumber: 1,
      startColumn: 5,
      endLineNumber: 1,
      endColumn: 10,
    });
    const action = mockEd.addAction.mock.calls.find((c: unknown[]) => (c[0] as { id: string }).id === 'format-bold')?.[0] as { run: (ed: unknown) => void };
    action.run(mockEd);
    expect(mockEd.executeEdits).toHaveBeenCalledWith('format-selection', [
      expect.objectContaining({ text: '{b}hello{/b}' }),
    ]);
    expect(mockEd.setSelection).toHaveBeenCalled();
    expect(mockEd.focus).toHaveBeenCalled();
  });

  it('inserts an empty {i}{/i} pair and places the cursor between the tags when there is no selection', async () => {
    const props = makeEditorViewProps();
    const { mockEd } = await renderAndMount(props);
    (mockEd.getModel() as { getValueInRange: ReturnType<typeof vi.fn> }).getValueInRange.mockReturnValue('');
    (mockEd.getSelection as ReturnType<typeof vi.fn>).mockReturnValue({
      isEmpty: () => true,
      startLineNumber: 3,
      startColumn: 7,
      endLineNumber: 3,
      endColumn: 7,
    });
    const action = mockEd.addAction.mock.calls.find((c: unknown[]) => (c[0] as { id: string }).id === 'format-italic')?.[0] as { run: (ed: unknown) => void };
    action.run(mockEd);
    expect(mockEd.executeEdits).toHaveBeenCalledWith('format-selection', [
      expect.objectContaining({ text: '{i}{/i}' }),
    ]);
    expect(mockEd.setPosition).toHaveBeenCalledWith({ lineNumber: 3, column: 10 });
  });

  it('syncs renpyHasSelection context key on context menu open', async () => {
    const props = makeEditorViewProps();
    const { mockEd, mockMonaco } = await renderAndMount(props);
    const hasSelectionKey = mockEd.createContextKey.mock.results.find(
      (r: { value: unknown }, i: number) => mockEd.createContextKey.mock.calls[i][0] === 'renpyHasSelection'
    )?.value as { set: ReturnType<typeof vi.fn> };
    const contextMenuListener = mockEd.onContextMenu.mock.calls[0][0] as (e: unknown) => void;
    (mockEd.getSelection as ReturnType<typeof vi.fn>).mockReturnValue({ isEmpty: () => false });
    (mockEd.getModel() as { getValueInRange: ReturnType<typeof vi.fn> }).getValueInRange.mockReturnValue('selected text');
    act(() => { contextMenuListener({ target: { position: null } }); });
    expect(hasSelectionKey.set).toHaveBeenCalledWith(true);
    void mockMonaco;
  });

  it('still shows the selection actions when Monaco collapses the selection on right-click before onContextMenu fires', async () => {
    // Real Monaco collapses the selection to a cursor at the click point on right-click
    // mousedown (before the contextmenu event), so editor.getSelection() is already empty
    // by the time onContextMenu and action.run() read it. The fix stashes the pre-collapse
    // selection in onMouseDown and falls back to it in both places.
    const onCreateVariableFromSelection = vi.fn();
    const props = makeEditorViewProps({ onCreateVariableFromSelection });
    const { mockEd } = await renderAndMount(props);
    const hasSelectionKey = mockEd.createContextKey.mock.results.find(
      (r: { value: unknown }, i: number) => mockEd.createContextKey.mock.calls[i][0] === 'renpyHasSelection'
    )?.value as { set: ReturnType<typeof vi.fn> };
    const mouseDownListener = mockEd.onMouseDown.mock.calls[0][0] as (e: unknown) => void;
    const contextMenuListener = mockEd.onContextMenu.mock.calls[0][0] as (e: unknown) => void;

    // Right-click mousedown while text is genuinely selected.
    (mockEd.getSelection as ReturnType<typeof vi.fn>).mockReturnValue({ isEmpty: () => false });
    (mockEd.getModel() as { getValueInRange: ReturnType<typeof vi.fn> }).getValueInRange.mockReturnValue('player_score');
    act(() => { mouseDownListener({ event: { rightButton: true } }); });

    // Monaco then collapses the selection before contextmenu fires.
    (mockEd.getSelection as ReturnType<typeof vi.fn>).mockReturnValue({ isEmpty: () => true });
    act(() => { contextMenuListener({ target: { position: null } }); });
    expect(hasSelectionKey.set).toHaveBeenCalledWith(true);

    const action = mockEd.addAction.mock.calls.find((c: unknown[]) => (c[0] as { id: string }).id === 'create-variable-from-selection')?.[0] as { run: (ed: unknown) => void };
    action.run(mockEd);
    expect(onCreateVariableFromSelection).toHaveBeenCalledWith('player_score');
  });

  it('calls onEditorUnmount after mount + unmount', async () => {
    const onEditorUnmount = vi.fn();
    const props = makeEditorViewProps({ onEditorUnmount });
    const { unmount } = await renderAndMount(props);
    unmount();
    expect(onEditorUnmount).toHaveBeenCalledWith('block-1');
  });

  it('handles onDidChangeModelContent firing dirty state change', async () => {
    const onDirtyChange = vi.fn();
    const block = createBlock({ content: 'label start:\n    return\n' });
    const props = makeEditorViewProps({ onDirtyChange, block });
    const { mockEd } = await renderAndMount(props);

    // Get the registered content-change listener
    const contentListener = mockEd.onDidChangeModelContent.mock.calls[0][0] as () => void;
    // Simulate editor content diverging from saved content
    mockEd.getValue.mockReturnValue('label start:\n    "new"\n    return\n');
    act(() => { contentListener(); });

    expect(onDirtyChange).toHaveBeenCalledWith('block-1', true);
  });

  it('defines renpy-dark and renpy-light themes in beforeMount', async () => {
    const props = makeEditorViewProps();
    const { mockMonaco } = await renderAndMount(props);
    const themeNames = mockMonaco.editor.defineTheme.mock.calls.map((c: unknown[]) => c[0]);
    expect(themeNames).toContain('renpy-dark');
    expect(themeNames).toContain('renpy-light');
  });

  it('skips language registration when renpy is already registered', async () => {
    const props = makeEditorViewProps();
    const { mockEd: _ed, mockMonaco: firstMonaco } = await renderAndMount(props);

    // Simulate already-registered language for second mount
    firstMonaco.languages.getLanguages.mockReturnValue([{ id: 'renpy' }]);

    vi.clearAllMocks();
    const { mockEd: ed2 } = createMockEditorInstance(props.block.content);
    await act(async () => {
      capturedBeforeMount?.(firstMonaco);
      capturedOnMount?.(ed2, firstMonaco);
    });

    // register should NOT have been called again (language already present)
    expect(firstMonaco.languages.register).not.toHaveBeenCalled();
  });

  it('re-renders cleanly when analysisResult changes after mount', async () => {
    const props = makeEditorViewProps();
    const { rerender } = await renderAndMount(props);
    const newAnalysis = createEmptyAnalysisResult({
      labels: { myLabel: { blockId: 'block-1', label: 'myLabel', line: 1, column: 7, type: 'label' } },
    });
    expect(() => rerender(<EditorView {...props} analysisResult={newAnalysis} />)).not.toThrow();
  });

  it('scrolls to initialScrollRequest line after mount', async () => {
    const props = makeEditorViewProps({ initialScrollRequest: { line: 5, key: 1 } });
    const { mockEd } = await renderAndMount(props);
    // revealLineInCenter should be scheduled (via setTimeout)
    await waitFor(() => {
      expect(mockEd.revealLineInCenter).toHaveBeenCalledWith(5, expect.anything());
    });
  });
});
