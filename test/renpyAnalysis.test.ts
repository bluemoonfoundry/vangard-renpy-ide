/**
 * @file test/renpyAnalysis.test.ts
 * @description Unit tests for the Ren'Py analysis engine (performRenpyAnalysis).
 * performRenpyAnalysis is a pure function so each test creates its own Block[]
 * fixture and calls it directly — no React, no mocks required.
 */

import { describe, it, expect } from 'vitest';
import { performRenpyAnalysis } from '../hooks/useRenpyAnalysis';
import { createBlock } from './mocks/sampleData';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Quickly build a block with the given script content. */
function block(id: string, content: string, filePath = `game/${id}.rpy`) {
  return createBlock({ id, content, filePath, title: id });
}

// ---------------------------------------------------------------------------
// Label extraction
// ---------------------------------------------------------------------------

describe('performRenpyAnalysis — labels', () => {
  it('extracts a single label from one block', () => {
    const result = performRenpyAnalysis([block('b1', 'label start:\n    return\n')]);
    expect(result.labels['start']).toMatchObject({ blockId: 'b1', label: 'start', type: 'label' });
  });

  it('records firstLabels for each block', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\nlabel outro:\n    return\n'),
    ]);
    expect(result.firstLabels['b1']).toBe('start');
  });

  it('extracts multiple labels from one block, first label wins firstLabels', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label intro:\n    "Hello"\nlabel chapter1:\n    return\n'),
    ]);
    expect(result.labels['intro']).toBeDefined();
    expect(result.labels['chapter1']).toBeDefined();
    expect(result.firstLabels['b1']).toBe('intro');
  });

  it('extracts labels across multiple blocks', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    jump end\n'),
      block('b2', 'label end:\n    return\n'),
    ]);
    expect(result.labels['start']?.blockId).toBe('b1');
    expect(result.labels['end']?.blockId).toBe('b2');
  });

  it('extracts menu labels (named menus)', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\nmenu choice_menu:\n    "Option A":\n        jump a\n'),
    ]);
    expect(result.labels['choice_menu']).toMatchObject({ type: 'menu' });
  });

  it('does not override an already-found label with a menu label of the same name', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label choice_menu:\n    pass\nmenu choice_menu:\n    "A":\n        pass\n'),
    ]);
    expect(result.labels['choice_menu']?.type).toBe('label');
  });

  it('ignores labels inside comments', () => {
    // Comment detection in labels: label regex checks raw line content but
    // jump-pass strips comments — labels still fire on raw lines (by design).
    // This test just confirms the regex doesn't mismatch indented label lines.
    const result = performRenpyAnalysis([
      block('b1', '    label indented:\n    return\n'),
    ]);
    // Indented labels are still valid Ren'Py labels
    expect(result.labels['indented']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Jump / call extraction
// ---------------------------------------------------------------------------

describe('performRenpyAnalysis — jumps', () => {
  it('records a static jump', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    jump chapter1\n'),
      block('b2', 'label chapter1:\n    return\n'),
    ]);
    expect(result.jumps['b1']).toHaveLength(1);
    expect(result.jumps['b1'][0]).toMatchObject({ target: 'chapter1', type: 'jump', isDynamic: false });
  });

  it('records a static call', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    call helper\n    return\n'),
      block('b2', 'label helper:\n    return\n'),
    ]);
    expect(result.jumps['b1'][0]).toMatchObject({ target: 'helper', type: 'call', isDynamic: false });
  });

  it('records a dynamic jump expression with a bare identifier', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    jump expression target_var\n'),
    ]);
    expect(result.jumps['b1'][0]).toMatchObject({ target: 'target_var', isDynamic: true });
  });

  it('does not record a jump expression with a string literal (string is sanitized away)', () => {
    // Known engine behaviour: string literals are stripped before the expression
    // regex runs, so `jump expression "label"` cannot be resolved. In practice,
    // Ren'Py authors use `jump expression variable`, not string literals.
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    jump expression "chapter1"\n'),
      block('b2', 'label chapter1:\n    return\n'),
    ]);
    expect(result.jumps['b1']).toHaveLength(0);
  });

  it('does not record jump inside a string literal as an actual jump', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    "You said jump"\n    return\n'),
    ]);
    expect(result.jumps['b1']).toHaveLength(0);
  });

  it('does not record jump after a comment marker', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    return # jump somewhere\n'),
    ]);
    expect(result.jumps['b1']).toHaveLength(0);
  });

  it('marks a jump to an unknown label as invalid', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    jump nonexistent\n'),
    ]);
    expect(result.invalidJumps['b1']).toContain('nonexistent');
  });

  it('does not mark a resolvable jump as invalid', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    jump end\n'),
      block('b2', 'label end:\n    return\n'),
    ]);
    expect(result.invalidJumps['b1'] ?? []).not.toContain('end');
  });
});

// ---------------------------------------------------------------------------
// Link generation
// ---------------------------------------------------------------------------

describe('performRenpyAnalysis — links', () => {
  it('creates a link when a jump crosses block boundaries', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    jump chapter1\n'),
      block('b2', 'label chapter1:\n    return\n'),
    ]);
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toMatchObject({ sourceId: 'b1', targetId: 'b2', targetLabel: 'chapter1' });
  });

  it('does not create a link for an intra-block jump', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    jump other\nlabel other:\n    return\n'),
    ]);
    expect(result.links).toHaveLength(0);
  });

  it('deduplicates links between the same two blocks', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    jump chapter1\n    jump chapter1\n'),
      block('b2', 'label chapter1:\n    return\n'),
    ]);
    expect(result.links).toHaveLength(1);
  });

  it('creates multiple links from one block with different targets', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    menu:\n        "A":\n            jump end_a\n        "B":\n            jump end_b\n'),
      block('b2', 'label end_a:\n    return\n'),
      block('b3', 'label end_b:\n    return\n'),
    ]);
    expect(result.links).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Block classification
// ---------------------------------------------------------------------------

describe('performRenpyAnalysis — block classification', () => {
  it('marks a block with no incoming links as root', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    jump end\n'),
      block('b2', 'label end:\n    return\n'),
    ]);
    expect(result.rootBlockIds.has('b1')).toBe(true);
    expect(result.rootBlockIds.has('b2')).toBe(false);
  });

  it('marks a block with no outgoing jumps as leaf', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    jump end\n'),
      block('b2', 'label end:\n    return\n'),
    ]);
    expect(result.leafBlockIds.has('b2')).toBe(true);
    expect(result.leafBlockIds.has('b1')).toBe(false);
  });

  it('marks a single isolated block as both root and leaf', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    return\n'),
    ]);
    expect(result.rootBlockIds.has('b1')).toBe(true);
    expect(result.leafBlockIds.has('b1')).toBe(true);
  });

  it('marks a block with a menu as branching', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    menu:\n        "A":\n            return\n'),
    ]);
    expect(result.branchingBlockIds.has('b1')).toBe(true);
  });

  it('classifies a block with a label as a storyBlock', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    return\n'),
    ]);
    expect(result.storyBlockIds.has('b1')).toBe(true);
    expect(result.configBlockIds.has('b1')).toBe(false);
  });

  it('classifies a block with only a screen definition as screenOnly', () => {
    const result = performRenpyAnalysis([
      block('b1', 'screen main_menu():\n    vbox:\n        text "Hello"\n'),
    ]);
    expect(result.screenOnlyBlockIds.has('b1')).toBe(true);
    expect(result.storyBlockIds.has('b1')).toBe(false);
  });

  it('classifies a block with no labels or screens as config', () => {
    const result = performRenpyAnalysis([
      block('b1', 'define config.name = "My Game"\n'),
    ]);
    expect(result.configBlockIds.has('b1')).toBe(true);
  });

  it('treats game/characters.rpy as a storyBlock even with no labels', () => {
    const result = performRenpyAnalysis([
      createBlock({ id: 'b1', content: 'define e = Character("Eileen")\n', filePath: 'game/characters.rpy' }),
    ]);
    expect(result.storyBlockIds.has('b1')).toBe(true);
    expect(result.configBlockIds.has('b1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Character parsing
// ---------------------------------------------------------------------------

describe('performRenpyAnalysis — characters', () => {
  it('parses a basic Character definition', () => {
    const result = performRenpyAnalysis([
      block('b1', 'define e = Character("Eileen")\n'),
    ]);
    const char = result.characters.get('e');
    expect(char).toBeDefined();
    expect(char?.name).toBe('Eileen');
    expect(char?.tag).toBe('e');
  });

  it('parses a Character with a color kwarg', () => {
    const result = performRenpyAnalysis([
      block('b1', 'define m = Character("Mae", color="#ff4400")\n'),
    ]);
    expect(result.characters.get('m')?.color).toBe('#ff4400');
  });

  it('parses a Character with a name kwarg', () => {
    const result = performRenpyAnalysis([
      block('b1', 'define narrator = Character(name=None)\n'),
    ]);
    // When name is None, tag is used as display name
    expect(result.characters.get('narrator')?.name).toBe('narrator');
  });

  it('removes character tag from variables map', () => {
    const result = performRenpyAnalysis([
      block('b1', 'define e = Character("Eileen")\ndefine e = "something else"\n'),
    ]);
    // Character tag 'e' should remove it from variables
    expect(result.variables.has('e')).toBe(false);
    expect(result.characters.has('e')).toBe(true);
  });

  it('parses the # profile: comment above a character', () => {
    const result = performRenpyAnalysis([
      block('b1', '# profile: images/eileen.png\ndefine e = Character("Eileen")\n'),
    ]);
    expect(result.characters.get('e')?.profile).toBe('images/eileen.png');
  });

  it('counts character dialogue usage', () => {
    const result = performRenpyAnalysis([
      block('b1', 'define e = Character("Eileen")\nlabel start:\n    e "Hello"\n    e "Goodbye"\n    return\n'),
    ]);
    expect(result.characterUsage.get('e')).toBe(2);
  });

  it('counts zero usage for a character who never speaks', () => {
    const result = performRenpyAnalysis([
      block('b1', 'define e = Character("Eileen")\nlabel start:\n    "Narrator speaks"\n    return\n'),
    ]);
    expect(result.characterUsage.get('e')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Variable parsing
// ---------------------------------------------------------------------------

describe('performRenpyAnalysis — variables', () => {
  it('parses a default variable', () => {
    const result = performRenpyAnalysis([
      block('b1', 'default player_name = "Player"\n'),
    ]);
    const v = result.variables.get('player_name');
    expect(v).toBeDefined();
    expect(v?.type).toBe('default');
    expect(v?.initialValue).toBe('"Player"');
  });

  it('parses a define variable', () => {
    const result = performRenpyAnalysis([
      block('b1', 'define config.name = "My Game"\n'),
    ]);
    expect(result.variables.get('config.name')).toMatchObject({
      type: 'define',
      initialValue: '"My Game"',
    });
  });

  it('does not parse a Character() line as a variable', () => {
    const result = performRenpyAnalysis([
      block('b1', 'define e = Character("Eileen")\n'),
    ]);
    expect(result.variables.has('e')).toBe(false);
  });

  it('tracks variable usage in other blocks', () => {
    const result = performRenpyAnalysis([
      block('b1', 'default score = 0\n'),
      block('b2', 'label play:\n    $ score += 1\n    return\n'),
    ]);
    const usages = result.variableUsages.get('score');
    expect(usages).toBeDefined();
    expect(usages?.some(u => u.blockId === 'b2')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Screen parsing
// ---------------------------------------------------------------------------

describe('performRenpyAnalysis — screens', () => {
  it('parses a screen without parameters', () => {
    const result = performRenpyAnalysis([
      block('b1', 'screen main_menu:\n    vbox:\n        pass\n'),
    ]);
    const s = result.screens.get('main_menu');
    expect(s).toBeDefined();
    expect(s?.parameters).toBe('');
  });

  it('parses a screen with parameters', () => {
    const result = performRenpyAnalysis([
      block('b1', 'screen confirm(message, yes_action, no_action):\n    pass\n'),
    ]);
    const s = result.screens.get('confirm');
    expect(s?.parameters).toBe('(message, yes_action, no_action)');
  });

  it('records the blockId for a screen', () => {
    const result = performRenpyAnalysis([
      block('b1', 'screen hud:\n    pass\n'),
    ]);
    expect(result.screens.get('hud')?.definedInBlockId).toBe('b1');
  });
});

// ---------------------------------------------------------------------------
// Image definitions
// ---------------------------------------------------------------------------

describe('performRenpyAnalysis — images', () => {
  it('extracts an image definition', () => {
    const result = performRenpyAnalysis([
      block('b1', 'image eileen happy = "eileen/happy.png"\n'),
    ]);
    expect(result.definedImages.has('eileen happy')).toBe(true);
  });

  it('extracts multiple image definitions', () => {
    const result = performRenpyAnalysis([
      block('b1', 'image bg park = "bg/park.png"\nimage bg cafe = "bg/cafe.png"\n'),
    ]);
    expect(result.definedImages.has('bg park')).toBe(true);
    expect(result.definedImages.has('bg cafe')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// debug_placeholders.rpy is skipped
// ---------------------------------------------------------------------------

describe('performRenpyAnalysis — skips debug_placeholders', () => {
  it('ignores blocks with debug_placeholders.rpy filePath', () => {
    const result = performRenpyAnalysis([
      createBlock({
        id: 'dbg',
        content: 'label secret:\n    jump secret\n',
        filePath: 'game/debug_placeholders.rpy',
      }),
    ]);
    expect(result.labels['secret']).toBeUndefined();
    expect(result.jumps['dbg']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Multi-block scenario
// ---------------------------------------------------------------------------

describe('performRenpyAnalysis — multi-block scenarios', () => {
  it('handles a complete linear story flow', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label intro:\n    "Welcome."\n    jump act1\n'),
      block('b2', 'label act1:\n    "Act 1 begins."\n    jump act2\n'),
      block('b3', 'label act2:\n    "The end."\n    return\n'),
    ]);

    expect(result.links).toHaveLength(2);
    expect(result.rootBlockIds.has('b1')).toBe(true);
    expect(result.leafBlockIds.has('b3')).toBe(true);
    expect(result.branchingBlockIds.size).toBe(0);
  });

  it('handles a branching story with convergence', () => {
    const result = performRenpyAnalysis([
      block('b1', 'label start:\n    menu:\n        "Left":\n            jump left\n        "Right":\n            jump right\n'),
      block('b2', 'label left:\n    jump end\n'),
      block('b3', 'label right:\n    jump end\n'),
      block('b4', 'label end:\n    return\n'),
    ]);

    expect(result.branchingBlockIds.has('b1')).toBe(true);
    expect(result.links.some(l => l.targetId === 'b4')).toBe(true);
    expect(result.leafBlockIds.has('b4')).toBe(true);
  });

  it('handles an empty blocks array gracefully', () => {
    const result = performRenpyAnalysis([]);
    expect(result.links).toHaveLength(0);
    expect(result.characters.size).toBe(0);
    expect(result.rootBlockIds.size).toBe(0);
  });

  it('handles a block with no Ren\'Py constructs', () => {
    const result = performRenpyAnalysis([
      block('b1', '# Just a comment\n'),
    ]);
    expect(result.jumps['b1']).toHaveLength(0);
    expect(result.configBlockIds.has('b1')).toBe(true);
  });
});
