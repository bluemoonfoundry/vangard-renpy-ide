/**
 * @file hooks/useRenpyAnalysis.test.ts
 * @description Tests for the Ren'Py analysis engine.
 * Tests performRenpyAnalysis() and performRouteAnalysis() — the pure functions
 * that parse .rpy content and produce the full analysis result.
 */

import { performRenpyAnalysis, performRouteAnalysis } from './useRenpyAnalysis';
import type { Block } from '../types';
import { createBlock } from '../test/mocks/sampleData';

/** Helper: create a block with just content (and optionally other overrides). */
function block(content: string, overrides: Partial<Block> = {}): Block {
  return createBlock({ content, ...overrides });
}

// ===========================================================================
// Label Extraction
// ===========================================================================

describe('performRenpyAnalysis — Labels', () => {
  it('extracts a simple label', () => {
    const result = performRenpyAnalysis([block('label start:\n    "Hello"\n')]);
    expect(result.labels['start']).toBeDefined();
    expect(result.labels['start'].blockId).toBe('block-1');
    expect(result.labels['start'].line).toBe(1);
    expect(result.labels['start'].type).toBe('label');
  });

  it('extracts multiple labels from one block', () => {
    const result = performRenpyAnalysis([block('label start:\n    "Hello"\nlabel chapter1:\n    "World"\n')]);
    expect(result.labels['start']).toBeDefined();
    expect(result.labels['chapter1']).toBeDefined();
    expect(result.labels['chapter1'].line).toBe(3);
  });

  it('sets firstLabels to the first label in each block', () => {
    const result = performRenpyAnalysis([
      block('label start:\n    "Hi"\nlabel after_start:\n    "Bye"\n'),
    ]);
    expect(result.firstLabels['block-1']).toBe('start');
  });

  it('extracts labels with underscores and numbers', () => {
    const result = performRenpyAnalysis([block('label chapter1_scene2:\n    pass\n')]);
    expect(result.labels['chapter1_scene2']).toBeDefined();
  });

  it('extracts a named menu label', () => {
    const result = performRenpyAnalysis([block('menu choice1:\n    "Option A":\n        pass\n')]);
    expect(result.labels['choice1']).toBeDefined();
    expect(result.labels['choice1'].type).toBe('menu');
  });

  it('does not overwrite a regular label with a menu label of the same name', () => {
    const result = performRenpyAnalysis([block('label mypoint:\n    pass\nmenu mypoint:\n    "x":\n        pass\n')]);
    expect(result.labels['mypoint'].type).toBe('label');
  });

  it('handles indented labels', () => {
    const result = performRenpyAnalysis([block('    label indented:\n        "Hello"\n')]);
    expect(result.labels['indented']).toBeDefined();
  });
});

// ===========================================================================
// Jump / Call Resolution
// ===========================================================================

describe('performRenpyAnalysis — Jumps & Calls', () => {
  it('detects a static jump', () => {
    const blocks = [
      block('label start:\n    jump chapter1\n', { id: 'b1' }),
      block('label chapter1:\n    "Hi"\n', { id: 'b2' }),
    ];
    const result = performRenpyAnalysis(blocks);
    expect(result.jumps['b1']).toHaveLength(1);
    expect(result.jumps['b1'][0].target).toBe('chapter1');
    expect(result.jumps['b1'][0].type).toBe('jump');
    expect(result.jumps['b1'][0].isDynamic).toBeFalsy();
  });

  it('detects a static call', () => {
    const blocks = [
      block('label start:\n    call helper\n', { id: 'b1' }),
      block('label helper:\n    return\n', { id: 'b2' }),
    ];
    const result = performRenpyAnalysis(blocks);
    expect(result.jumps['b1'][0].type).toBe('call');
  });

  it('creates a link between blocks for a resolved jump', () => {
    const blocks = [
      block('label start:\n    jump chapter1\n', { id: 'b1' }),
      block('label chapter1:\n    "Hi"\n', { id: 'b2' }),
    ];
    const result = performRenpyAnalysis(blocks);
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toEqual({ sourceId: 'b1', targetId: 'b2', targetLabel: 'chapter1' });
  });

  it('does not create a link for a jump within the same block', () => {
    const result = performRenpyAnalysis([
      block('label start:\n    jump local\nlabel local:\n    pass\n', { id: 'b1' }),
    ]);
    expect(result.links).toHaveLength(0);
  });

  it('records invalid jumps for unresolved targets', () => {
    const result = performRenpyAnalysis([
      block('label start:\n    jump nonexistent\n', { id: 'b1' }),
    ]);
    expect(result.invalidJumps['b1']).toContain('nonexistent');
  });

  it('does not duplicate links for multiple jumps to the same block', () => {
    const blocks = [
      block('label start:\n    jump ch1\n    jump ch1\n', { id: 'b1' }),
      block('label ch1:\n    pass\n', { id: 'b2' }),
    ];
    const result = performRenpyAnalysis(blocks);
    expect(result.links).toHaveLength(1);
  });

  it('detects jump expression with a variable', () => {
    const blocks = [
      block('label start:\n    jump expression next_label\n', { id: 'b1' }),
      block('label chapter1:\n    pass\n', { id: 'b2' }),
    ];
    const result = performRenpyAnalysis(blocks);
    // Note: string-literal expressions are sanitized before regex matching,
    // so we test with a variable expression instead.
    expect(result.jumps['b1']).toHaveLength(1);
    expect(result.jumps['b1'][0].isDynamic).toBe(true);
  });

  it('ignores jumps inside comments', () => {
    const result = performRenpyAnalysis([
      block('label start:\n    # jump nowhere\n    pass\n', { id: 'b1' }),
    ]);
    expect(result.jumps['b1']).toHaveLength(0);
  });

  it('ignores jump targets inside string literals', () => {
    const result = performRenpyAnalysis([
      block('label start:\n    "You should jump over the log"\n', { id: 'b1' }),
    ]);
    // The word "jump" is inside quotes, so it should not be parsed as a jump statement
    expect(result.jumps['b1']).toHaveLength(0);
  });
});

// ===========================================================================
// Character Parsing
// ===========================================================================

describe('performRenpyAnalysis — Characters', () => {
  it('extracts a basic character definition', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen")\n'),
    ]);
    const char = result.characters.get('e');
    expect(char).toBeDefined();
    expect(char!.name).toBe('Eileen');
    expect(char!.tag).toBe('e');
    expect(char!.definedInBlockId).toBe('block-1');
  });

  it('extracts character color', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen", color="#cc6600")\n'),
    ]);
    expect(result.characters.get('e')!.color).toBe('#cc6600');
  });

  it('assigns a palette color when no color is specified', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen")\n'),
    ]);
    expect(result.characters.get('e')!.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('extracts multiple kwargs', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen", color="#cc6600", image="eileen", who_style="say_label")\n'),
    ]);
    const char = result.characters.get('e')!;
    expect(char.image).toBe('eileen');
    expect(char.who_style).toBe('say_label');
  });

  it('parses boolean kwargs', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen", slow=True, afm=False)\n'),
    ]);
    const char = result.characters.get('e')!;
    expect(char.slow).toBe(true);
    expect(char.afm).toBe(false);
  });

  it('extracts profile from preceding comment', () => {
    const result = performRenpyAnalysis([
      block('# profile: A bright and friendly girl\ndefine e = Character("Eileen")\n'),
    ]);
    expect(result.characters.get('e')!.profile).toBe('A bright and friendly girl');
  });

  it('uses tag as name when name is None', () => {
    const result = performRenpyAnalysis([
      block('define narrator = Character(None)\n'),
    ]);
    expect(result.characters.get('narrator')!.name).toBe('narrator');
  });

  it('extracts multiple characters from one block', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen")\ndefine l = Character("Lucy")\n'),
    ]);
    expect(result.characters.size).toBe(2);
    expect(result.characters.get('e')!.name).toBe('Eileen');
    expect(result.characters.get('l')!.name).toBe('Lucy');
  });

  it('removes character tags from variables map', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen")\n'),
    ]);
    // Character definitions use "define" which also matches the variable regex,
    // but the character should be removed from variables
    expect(result.variables.has('e')).toBe(false);
    expect(result.characters.has('e')).toBe(true);
  });
});

// ===========================================================================
// Variable Parsing
// ===========================================================================

describe('performRenpyAnalysis — Variables', () => {
  it('extracts a default variable', () => {
    const result = performRenpyAnalysis([
      block('default player_name = "Player"\n'),
    ]);
    const v = result.variables.get('player_name');
    expect(v).toBeDefined();
    expect(v!.type).toBe('default');
    expect(v!.initialValue).toBe('"Player"');
    expect(v!.line).toBe(1);
  });

  it('extracts a define constant', () => {
    const result = performRenpyAnalysis([
      block('define config.name = "My Game"\n'),
    ]);
    const v = result.variables.get('config.name');
    expect(v).toBeDefined();
    expect(v!.type).toBe('define');
  });

  it('extracts numeric initial values', () => {
    const result = performRenpyAnalysis([
      block('default score = 0\n'),
    ]);
    expect(result.variables.get('score')!.initialValue).toBe('0');
  });

  it('extracts boolean initial values', () => {
    const result = performRenpyAnalysis([
      block('default met_eileen = False\n'),
    ]);
    expect(result.variables.get('met_eileen')!.initialValue).toBe('False');
  });

  it('does not confuse Character defines with variables', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen")\ndefine max_hp = 100\n'),
    ]);
    expect(result.variables.has('e')).toBe(false);
    expect(result.variables.has('max_hp')).toBe(true);
  });

  it('tracks variable usages across blocks', () => {
    const blocks = [
      block('default score = 0\n', { id: 'b1' }),
      block('label start:\n    $ score += 10\n', { id: 'b2' }),
    ];
    const result = performRenpyAnalysis(blocks);
    const usages = result.variableUsages.get('score');
    expect(usages).toBeDefined();
    expect(usages!.some(u => u.blockId === 'b2')).toBe(true);
  });

  it('does not count variable definition line as a usage', () => {
    const result = performRenpyAnalysis([
      block('default score = 0\n', { id: 'b1' }),
    ]);
    const usages = result.variableUsages.get('score') || [];
    expect(usages.some(u => u.blockId === 'b1' && u.line === 1)).toBe(false);
  });
});

// ===========================================================================
// Screen Parsing
// ===========================================================================

describe('performRenpyAnalysis — Screens', () => {
  it('extracts a simple screen', () => {
    const result = performRenpyAnalysis([
      block('screen main_menu():\n    text "Hello"\n'),
    ]);
    const screen = result.screens.get('main_menu');
    expect(screen).toBeDefined();
    expect(screen!.line).toBe(1);
  });

  it('extracts screen parameters', () => {
    const result = performRenpyAnalysis([
      block('screen my_screen(msg="Hello"):\n    text msg\n'),
    ]);
    expect(result.screens.get('my_screen')!.parameters).toBe('(msg="Hello")');
  });

  it('extracts a screen without parentheses', () => {
    const result = performRenpyAnalysis([
      block('screen simple_screen:\n    text "Simple"\n'),
    ]);
    expect(result.screens.get('simple_screen')).toBeDefined();
    expect(result.screens.get('simple_screen')!.parameters).toBe('');
  });

  it('extracts multiple screens', () => {
    const result = performRenpyAnalysis([
      block('screen menu_a():\n    pass\nscreen menu_b():\n    pass\n'),
    ]);
    expect(result.screens.size).toBe(2);
  });
});

// ===========================================================================
// Image Definitions
// ===========================================================================

describe('performRenpyAnalysis — Images', () => {
  it('extracts a simple image definition', () => {
    const result = performRenpyAnalysis([
      block('image eileen happy = "eileen_happy.png"\n'),
    ]);
    expect(result.definedImages.has('eileen happy')).toBe(true);
  });

  it('extracts multiple image definitions', () => {
    const result = performRenpyAnalysis([
      block('image eileen happy = "eileen_happy.png"\nimage bg park = "bg_park.jpg"\n'),
    ]);
    expect(result.definedImages.size).toBe(2);
    expect(result.definedImages.has('bg park')).toBe(true);
  });
});

// ===========================================================================
// Dialogue Detection
// ===========================================================================

describe('performRenpyAnalysis — Dialogue', () => {
  it('detects character dialogue lines', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen")\nlabel start:\n    e "Hello there!"\n'),
    ]);
    const lines = result.dialogueLines.get('block-1');
    expect(lines).toBeDefined();
    expect(lines!.some(d => d.tag === 'e')).toBe(true);
  });

  it('counts character usage correctly', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen")\nlabel start:\n    e "Line 1"\n    e "Line 2"\n    e "Line 3"\n'),
    ]);
    expect(result.characterUsage.get('e')).toBe(3);
  });

  it('initializes character usage to 0 for characters with no dialogue', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen")\nlabel start:\n    "Narrator speaks"\n'),
    ]);
    expect(result.characterUsage.get('e')).toBe(0);
  });
});

// ===========================================================================
// Block Classification
// ===========================================================================

describe('performRenpyAnalysis — Block Classification', () => {
  it('identifies root blocks (no incoming jumps)', () => {
    const blocks = [
      block('label start:\n    jump chapter1\n', { id: 'b1' }),
      block('label chapter1:\n    pass\n', { id: 'b2' }),
    ];
    const result = performRenpyAnalysis(blocks);
    expect(result.rootBlockIds.has('b1')).toBe(true);
    expect(result.rootBlockIds.has('b2')).toBe(false);
  });

  it('identifies leaf blocks (no outgoing jumps)', () => {
    const blocks = [
      block('label start:\n    jump chapter1\n', { id: 'b1' }),
      block('label chapter1:\n    return\n', { id: 'b2' }),
    ];
    const result = performRenpyAnalysis(blocks);
    expect(result.leafBlockIds.has('b2')).toBe(true);
    expect(result.leafBlockIds.has('b1')).toBe(false);
  });

  it('identifies branching blocks (menu)', () => {
    const result = performRenpyAnalysis([
      block('label start:\n    menu:\n        "Option A":\n            pass\n', { id: 'b1' }),
    ]);
    expect(result.branchingBlockIds.has('b1')).toBe(true);
  });

  it('identifies screen-only blocks', () => {
    const result = performRenpyAnalysis([
      block('screen my_overlay():\n    text "Overlay"\n', { id: 'b1' }),
      block('label start:\n    pass\n', { id: 'b2' }),
    ]);
    expect(result.screenOnlyBlockIds.has('b1')).toBe(true);
    expect(result.screenOnlyBlockIds.has('b2')).toBe(false);
  });

  it('identifies story blocks (blocks containing labels)', () => {
    const blocks = [
      block('label start:\n    pass\n', { id: 'b1' }),
      block('screen overlay():\n    pass\n', { id: 'b2' }),
    ];
    const result = performRenpyAnalysis(blocks);
    expect(result.storyBlockIds.has('b1')).toBe(true);
    expect(result.storyBlockIds.has('b2')).toBe(false);
  });

  it('classifies special story files (variables.rpy, characters.rpy) as story blocks', () => {
    const result = performRenpyAnalysis([
      block('default score = 0\n', { id: 'b1', filePath: 'game/variables.rpy' }),
    ]);
    expect(result.storyBlockIds.has('b1')).toBe(true);
  });

  it('classifies blocks with no labels and no screens as config blocks', () => {
    const result = performRenpyAnalysis([
      block('init python:\n    config.something = True\n', { id: 'b1', filePath: 'game/options.rpy' }),
    ]);
    expect(result.configBlockIds.has('b1')).toBe(true);
  });

  it('skips debug_placeholders.rpy files', () => {
    const result = performRenpyAnalysis([
      block('label debug_label:\n    pass\n', { id: 'b1', filePath: 'game/debug_placeholders.rpy' }),
    ]);
    expect(result.labels['debug_label']).toBeUndefined();
  });

  it('detects block types (python, jump, label, menu, dialogue)', () => {
    const result = performRenpyAnalysis([
      block('define e = Character("Eileen")\nlabel start:\n    e "Hello"\n    python:\n        x = 1\n    menu:\n        "A":\n            jump end\nlabel end:\n    return\n'),
    ]);
    const types = result.blockTypes.get('block-1');
    expect(types).toBeDefined();
    expect(types!.has('label')).toBe(true);
    expect(types!.has('dialogue')).toBe(true);
    expect(types!.has('python')).toBe(true);
    expect(types!.has('menu')).toBe(true);
    expect(types!.has('jump')).toBe(true);
  });
});

// ===========================================================================
// Empty / Edge Cases
// ===========================================================================

describe('performRenpyAnalysis — Edge Cases', () => {
  it('handles empty block list', () => {
    const result = performRenpyAnalysis([]);
    expect(result.links).toEqual([]);
    expect(result.characters.size).toBe(0);
  });

  it('handles block with empty content', () => {
    const result = performRenpyAnalysis([block('')]);
    expect(result.labels).toEqual({});
    expect(result.links).toEqual([]);
  });

  it('handles block with only comments', () => {
    const result = performRenpyAnalysis([block('# This is a comment\n# Another comment\n')]);
    expect(Object.keys(result.labels)).toHaveLength(0);
  });
});

// ===========================================================================
// Route Analysis
// ===========================================================================

describe('performRouteAnalysis', () => {
  it('creates label nodes for each label', () => {
    const blocks = [
      block('label start:\n    jump chapter1\n', { id: 'b1', title: 'script' }),
      block('label chapter1:\n    return\n', { id: 'b2', title: 'chapter1' }),
    ];
    const analysis = performRenpyAnalysis(blocks);
    const route = performRouteAnalysis(blocks, analysis.labels, analysis.jumps);

    expect(route.labelNodes).toHaveLength(2);
    expect(route.labelNodes.find(n => n.label === 'start')).toBeDefined();
    expect(route.labelNodes.find(n => n.label === 'chapter1')).toBeDefined();
  });

  it('creates route links for jumps between labels', () => {
    const blocks = [
      block('label start:\n    jump chapter1\n', { id: 'b1' }),
      block('label chapter1:\n    return\n', { id: 'b2' }),
    ];
    const analysis = performRenpyAnalysis(blocks);
    const route = performRouteAnalysis(blocks, analysis.labels, analysis.jumps);

    expect(route.routeLinks.length).toBeGreaterThanOrEqual(1);
    const jumpLink = route.routeLinks.find(l => l.type === 'jump');
    expect(jumpLink).toBeDefined();
    expect(jumpLink!.sourceId).toBe('b1:start');
    expect(jumpLink!.targetId).toBe('b2:chapter1');
  });

  it('creates implicit links for sequential labels without terminal statements', () => {
    const blocks = [
      block('label part1:\n    "Hello"\nlabel part2:\n    "World"\n', { id: 'b1' }),
    ];
    const analysis = performRenpyAnalysis(blocks);
    const route = performRouteAnalysis(blocks, analysis.labels, analysis.jumps);

    const implicitLink = route.routeLinks.find(l => l.type === 'implicit');
    expect(implicitLink).toBeDefined();
    expect(implicitLink!.sourceId).toBe('b1:part1');
    expect(implicitLink!.targetId).toBe('b1:part2');
  });

  it('does not create implicit links when label has a terminal statement', () => {
    const blocks = [
      block('label part1:\n    "Hello"\n    return\nlabel part2:\n    "World"\n', { id: 'b1' }),
    ];
    const analysis = performRenpyAnalysis(blocks);
    const route = performRouteAnalysis(blocks, analysis.labels, analysis.jumps);

    const implicitLink = route.routeLinks.find(l => l.type === 'implicit');
    expect(implicitLink).toBeUndefined();
  });

  it('identifies routes from start to end', () => {
    const blocks = [
      block('label start:\n    jump middle\n', { id: 'b1' }),
      block('label middle:\n    jump ending\n', { id: 'b2' }),
      block('label ending:\n    return\n', { id: 'b3' }),
    ];
    const analysis = performRenpyAnalysis(blocks);
    const route = performRouteAnalysis(blocks, analysis.labels, analysis.jumps);

    expect(route.identifiedRoutes.length).toBeGreaterThanOrEqual(1);
    // Each route should have a color and link IDs
    const firstRoute = route.identifiedRoutes[0];
    expect(firstRoute.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(firstRoute.linkIds.size).toBeGreaterThan(0);
  });

  it('handles empty blocks', () => {
    const route = performRouteAnalysis([], {}, {});
    expect(route.labelNodes).toHaveLength(0);
    expect(route.routeLinks).toHaveLength(0);
    expect(route.identifiedRoutes).toHaveLength(0);
  });

  it('skips debug_placeholders.rpy in route analysis', () => {
    const blocks = [
      block('label debug_test:\n    pass\n', { id: 'b1', filePath: 'game/debug_placeholders.rpy' }),
    ];
    const analysis = performRenpyAnalysis(blocks);
    const route = performRouteAnalysis(blocks, analysis.labels, analysis.jumps);
    expect(route.labelNodes).toHaveLength(0);
  });
});
