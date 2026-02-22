/**
 * @file test/mocks/sampleData.ts
 * @description Reusable test fixtures for the core data model.
 * Import these in tests instead of constructing objects from scratch.
 * All factory functions return fresh objects to avoid cross-test mutation.
 */

import type {
  Block,
  BlockGroup,
  Link,
  Character,
  Variable,
  RenpyScreen,
  RenpyAnalysisResult,
  LabelLocation,
  JumpLocation,
  AppSettings,
  ProjectSettings,
  StickyNote,
  EditorTab,
  FileSystemTreeNode,
} from '../../types';

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export function createBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: 'block-1',
    content: 'label start:\n    "Hello, world!"\n    return\n',
    position: { x: 100, y: 100 },
    width: 200,
    height: 150,
    title: 'start',
    filePath: 'game/script.rpy',
    ...overrides,
  };
}

export function createBlockGroup(overrides: Partial<BlockGroup> = {}): BlockGroup {
  return {
    id: 'group-1',
    title: 'Chapter 1',
    position: { x: 50, y: 50 },
    width: 500,
    height: 400,
    blockIds: ['block-1', 'block-2'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export function createLink(overrides: Partial<Link> = {}): Link {
  return {
    sourceId: 'block-1',
    targetId: 'block-2',
    targetLabel: 'chapter1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

export function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    name: 'Eileen',
    tag: 'e',
    color: '#cc6600',
    definedInBlockId: 'block-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

export function createVariable(overrides: Partial<Variable> = {}): Variable {
  return {
    name: 'player_name',
    type: 'default',
    initialValue: '"Player"',
    definedInBlockId: 'block-1',
    line: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export function createScreen(overrides: Partial<RenpyScreen> = {}): RenpyScreen {
  return {
    name: 'main_menu',
    parameters: '',
    definedInBlockId: 'block-1',
    line: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Sticky Notes
// ---------------------------------------------------------------------------

export function createStickyNote(overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id: 'note-1',
    content: 'TODO: Add branching here',
    position: { x: 300, y: 200 },
    width: 200,
    height: 150,
    color: 'yellow',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Analysis Result
// ---------------------------------------------------------------------------

export function createEmptyAnalysisResult(overrides: Partial<RenpyAnalysisResult> = {}): RenpyAnalysisResult {
  return {
    links: [],
    invalidJumps: {},
    firstLabels: {},
    labels: {},
    jumps: {},
    rootBlockIds: new Set<string>(),
    leafBlockIds: new Set<string>(),
    branchingBlockIds: new Set<string>(),
    screenOnlyBlockIds: new Set<string>(),
    storyBlockIds: new Set<string>(),
    configBlockIds: new Set<string>(),
    characters: new Map<string, Character>(),
    dialogueLines: new Map(),
    characterUsage: new Map<string, number>(),
    variables: new Map<string, Variable>(),
    variableUsages: new Map(),
    screens: new Map<string, RenpyScreen>(),
    definedImages: new Set<string>(),
    blockTypes: new Map(),
    labelNodes: [],
    routeLinks: [],
    identifiedRoutes: [],
    ...overrides,
  };
}

/**
 * A populated analysis result with two blocks, one label, one jump,
 * one character, and one variable. Good baseline for integration-style tests.
 */
export function createSampleAnalysisResult(): RenpyAnalysisResult {
  const block1 = createBlock();
  const block2 = createBlock({
    id: 'block-2',
    content: 'label chapter1:\n    e "Welcome to chapter 1."\n    return\n',
    title: 'chapter1',
    filePath: 'game/chapter1.rpy',
    position: { x: 400, y: 100 },
  });

  const eileen = createCharacter();
  const playerName = createVariable();

  const labels: Record<string, LabelLocation> = {
    start: { blockId: 'block-1', label: 'start', line: 1, column: 7, type: 'label' },
    chapter1: { blockId: 'block-2', label: 'chapter1', line: 1, column: 7, type: 'label' },
  };

  const jumps: Record<string, JumpLocation[]> = {
    'block-1': [
      { blockId: 'block-1', target: 'chapter1', type: 'jump', line: 3, columnStart: 10, columnEnd: 18 },
    ],
  };

  return createEmptyAnalysisResult({
    links: [createLink()],
    firstLabels: { 'block-1': 'start', 'block-2': 'chapter1' },
    labels,
    jumps,
    rootBlockIds: new Set(['block-1']),
    leafBlockIds: new Set(['block-2']),
    storyBlockIds: new Set(['block-1', 'block-2']),
    characters: new Map([['e', eileen]]),
    characterUsage: new Map([['e', 3]]),
    variables: new Map([['player_name', playerName]]),
    dialogueLines: new Map([
      ['block-1', [{ line: 2, tag: 'narrator' }]],
      ['block-2', [{ line: 2, tag: 'e' }]],
    ]),
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function createAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    theme: 'dark',
    isLeftSidebarOpen: true,
    leftSidebarWidth: 250,
    isRightSidebarOpen: true,
    rightSidebarWidth: 300,
    renpyPath: '/usr/local/bin/renpy',
    recentProjects: ['/projects/my-vn'],
    editorFontFamily: 'Fira Code',
    editorFontSize: 14,
    ...overrides,
  };
}

export function createProjectSettings(overrides: Partial<ProjectSettings> = {}): ProjectSettings {
  return {
    enableAiFeatures: false,
    selectedModel: 'gemini-2.0-flash',
    draftingMode: false,
    openTabs: [{ id: 'canvas', type: 'canvas' }],
    activeTabId: 'canvas',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// File System Tree
// ---------------------------------------------------------------------------

export function createFileTree(): FileSystemTreeNode {
  return {
    name: 'game',
    path: '/project/game',
    children: [
      {
        name: 'script.rpy',
        path: '/project/game/script.rpy',
      },
      {
        name: 'chapter1.rpy',
        path: '/project/game/chapter1.rpy',
      },
      {
        name: 'images',
        path: '/project/game/images',
        children: [
          { name: 'eileen.png', path: '/project/game/images/eileen.png' },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Editor Tabs
// ---------------------------------------------------------------------------

export function createEditorTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    id: 'canvas',
    type: 'canvas',
    ...overrides,
  };
}
