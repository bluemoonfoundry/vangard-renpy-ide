/**
 * @file test/smoke.test.ts
 * @description Smoke test to verify the test infrastructure works:
 * - Vitest runs and globals (describe/it/expect) are available
 * - jest-dom matchers are loaded
 * - electronAPI mock can be created and installed
 * - Sample data fixtures produce valid objects
 */

import { createMockElectronAPI, installElectronAPI, uninstallElectronAPI } from './mocks/electronAPI';
import {
  createBlock,
  createBlockGroup,
  createLink,
  createCharacter,
  createVariable,
  createScreen,
  createStickyNote,
  createEmptyAnalysisResult,
  createSampleAnalysisResult,
  createAppSettings,
  createProjectSettings,
  createFileTree,
  createEditorTab,
} from './mocks/sampleData';

describe('Test Infrastructure', () => {
  describe('Vitest globals', () => {
    it('has describe, it, and expect available', () => {
      expect(true).toBe(true);
    });

    it('supports vi.fn()', () => {
      const fn = vi.fn().mockReturnValue(42);
      expect(fn()).toBe(42);
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  describe('jest-dom matchers', () => {
    it('toBeInTheDocument is available', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      expect(div).toBeInTheDocument();
      document.body.removeChild(div);
    });
  });

  describe('electronAPI mock', () => {
    afterEach(() => {
      uninstallElectronAPI();
    });

    it('starts as undefined on window', () => {
      expect((window as any).electronAPI).toBeUndefined();
    });

    it('can be created with all expected methods', () => {
      const api = createMockElectronAPI();

      // Spot-check a few methods from different categories
      expect(api.openDirectory).toBeDefined();
      expect(api.writeFile).toBeDefined();
      expect(api.runGame).toBeDefined();
      expect(api.onMenuCommand).toBeDefined();
      expect(api.getAppSettings).toBeDefined();
      expect(api.searchInProject).toBeDefined();
      expect(api.path.join).toBeDefined();
    });

    it('can be installed on window and returns sensible defaults', async () => {
      const api = installElectronAPI();

      expect((window as any).electronAPI).toBe(api);
      expect(await api.openDirectory()).toBeNull();
      expect(await api.writeFile('/test', 'content')).toEqual({ success: true });
      expect(await api.scanDirectory('/dir')).toEqual({ images: [], audios: [] });
      expect(await api.path.join('a', 'b', 'c')).toBe('a/b/c');
    });

    it('mock methods can be configured with custom return values', async () => {
      const api = installElectronAPI();
      api.openDirectory.mockResolvedValueOnce('/my/project');
      api.checkRenpyPath.mockResolvedValueOnce(true);

      expect(await api.openDirectory()).toBe('/my/project');
      expect(await api.checkRenpyPath('/usr/bin/renpy')).toBe(true);
    });

    it('event listeners return unsubscribe functions', () => {
      const api = createMockElectronAPI();
      const unsub = api.onMenuCommand(() => {});
      expect(typeof unsub).toBe('function');
    });
  });

  describe('Sample data fixtures', () => {
    it('creates a valid Block', () => {
      const block = createBlock();
      expect(block.id).toBe('block-1');
      expect(block.content).toContain('label start:');
      expect(block.position.x).toBe(100);
      expect(block.filePath).toBe('game/script.rpy');
    });

    it('creates a Block with overrides', () => {
      const block = createBlock({ id: 'custom', title: 'my-label' });
      expect(block.id).toBe('custom');
      expect(block.title).toBe('my-label');
      // Non-overridden fields keep defaults
      expect(block.content).toContain('label start:');
    });

    it('creates a valid BlockGroup', () => {
      const group = createBlockGroup();
      expect(group.blockIds).toContain('block-1');
      expect(group.blockIds).toContain('block-2');
    });

    it('creates a valid Link', () => {
      const link = createLink();
      expect(link.sourceId).toBe('block-1');
      expect(link.targetId).toBe('block-2');
    });

    it('creates a valid Character', () => {
      const char = createCharacter();
      expect(char.name).toBe('Eileen');
      expect(char.tag).toBe('e');
      expect(char.color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('creates a valid Variable', () => {
      const v = createVariable();
      expect(v.name).toBe('player_name');
      expect(v.type).toBe('default');
    });

    it('creates a valid RenpyScreen', () => {
      const screen = createScreen();
      expect(screen.name).toBe('main_menu');
    });

    it('creates a valid StickyNote', () => {
      const note = createStickyNote();
      expect(note.color).toBe('yellow');
      expect(note.content).toContain('TODO');
    });

    it('creates an empty analysis result with correct collection types', () => {
      const result = createEmptyAnalysisResult();
      expect(result.links).toEqual([]);
      expect(result.characters).toBeInstanceOf(Map);
      expect(result.rootBlockIds).toBeInstanceOf(Set);
      expect(result.variables).toBeInstanceOf(Map);
      expect(result.definedImages).toBeInstanceOf(Set);
    });

    it('creates a populated sample analysis result', () => {
      const result = createSampleAnalysisResult();
      expect(result.links).toHaveLength(1);
      expect(result.characters.get('e')?.name).toBe('Eileen');
      expect(result.variables.get('player_name')?.type).toBe('default');
      expect(result.rootBlockIds.has('block-1')).toBe(true);
      expect(result.leafBlockIds.has('block-2')).toBe(true);
      expect(result.labels['start'].blockId).toBe('block-1');
      expect(result.jumps['block-1']).toHaveLength(1);
    });

    it('creates valid AppSettings', () => {
      const settings = createAppSettings();
      expect(settings.theme).toBe('dark');
      expect(settings.editorFontSize).toBe(14);
      expect(settings.recentProjects).toHaveLength(1);
    });

    it('creates valid ProjectSettings', () => {
      const settings = createProjectSettings();
      expect(settings.enableAiFeatures).toBe(false);
      expect(settings.openTabs).toHaveLength(1);
      expect(settings.activeTabId).toBe('canvas');
    });

    it('creates a valid FileSystemTreeNode', () => {
      const tree = createFileTree();
      expect(tree.name).toBe('game');
      expect(tree.children).toHaveLength(3);
      expect(tree.children![2].name).toBe('images');
      expect(tree.children![2].children).toHaveLength(1);
    });

    it('creates a valid EditorTab', () => {
      const tab = createEditorTab({ id: 'block-1', type: 'editor', blockId: 'block-1' });
      expect(tab.type).toBe('editor');
      expect(tab.blockId).toBe('block-1');
    });

    it('returns fresh objects each call (no cross-test mutation)', () => {
      const a = createBlock();
      const b = createBlock();
      a.id = 'mutated';
      expect(b.id).toBe('block-1');

      const r1 = createEmptyAnalysisResult();
      const r2 = createEmptyAnalysisResult();
      r1.characters.set('x', createCharacter({ tag: 'x' }));
      expect(r2.characters.size).toBe(0);
    });
  });
});
