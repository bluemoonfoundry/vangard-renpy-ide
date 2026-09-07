import { detectContext, getRenpyCompletions, isInsideScreenBlock, isInsideStringLiteral, CompletionItemKind, InsertTextRule } from './renpyCompletionProvider';
import type { RenpyCompletionData, CompletionRange } from './renpyCompletionProvider';

const range: CompletionRange = {
  startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1,
};

const sampleData: RenpyCompletionData = {
  labels: {
    start: { blockId: 'b1', line: 1, type: 'label' },
    chapter1: { blockId: 'b2', line: 5, type: 'label' },
  },
  characters: new Map([
    ['e', { name: 'Eileen', tag: 'e', color: '#ff0000' }],
    ['mc', { name: 'Main Character', tag: 'mc' }],
  ]),
  variables: new Map([
    ['score', { name: 'score', type: 'default', initialValue: '0' }],
    ['player_name', { name: 'player_name', type: 'define', initialValue: '"Player"' }],
  ]),
  screens: new Map([
    ['main_menu', { name: 'main_menu', parameters: [] }],
    ['inventory', { name: 'inventory', parameters: ['items'] }],
  ]),
  definedImages: new Set(['eileen happy', 'eileen sad', 'bg park']),
  userSnippets: [
    { id: 's1', title: 'Quick Choice', prefix: 'qchoice', description: 'A fast choice menu', code: 'menu:\n    "Yes":\n        pass', monacoBody: 'menu:\n    "${1:prompt}":\n        $0' },
  ],
};

describe('detectContext', () => {
  it('detects jump context', () => {
    expect(detectContext('    jump ', 10)).toBe('jump');
    expect(detectContext('    jump start', 10)).toBe('jump');
  });

  it('detects call context', () => {
    expect(detectContext('    call ', 10)).toBe('call');
    expect(detectContext('    call chapter1', 14)).toBe('call');
  });

  it('detects call screen context', () => {
    expect(detectContext('    call screen ', 17)).toBe('call-screen');
    expect(detectContext('    call screen main_menu', 25)).toBe('call-screen');
  });

  it('detects show context', () => {
    expect(detectContext('    show ', 10)).toBe('show');
  });

  it('detects hide context', () => {
    expect(detectContext('    hide ', 10)).toBe('hide');
  });

  it('detects scene context', () => {
    expect(detectContext('    scene ', 11)).toBe('scene');
  });

  it('detects variable context after $', () => {
    expect(detectContext('    $ ', 7)).toBe('variable');
  });

  it('returns general for empty or generic lines', () => {
    expect(detectContext('    ', 5)).toBe('general');
    expect(detectContext('lab', 4)).toBe('general');
  });

  it('returns string context while typing inside a quoted dialogue string', () => {
    // cursor right after "how " in    e "Hello, how |
    const line = '    e "Hello, how ';
    expect(detectContext(line, line.length + 1)).toBe('string');
  });

  it('does not treat a closed string as still open', () => {
    const line = '    e "Hello" ';
    expect(detectContext(line, line.length + 1)).toBe('general');
  });

  it('respects escaped quotes when detecting string context', () => {
    const line = '    e "She said \\"hi\\" and ';
    expect(detectContext(line, line.length + 1)).toBe('string');
  });
});

describe('isInsideStringLiteral', () => {
  it('is false before any quote is opened', () => {
    expect(isInsideStringLiteral('    jump ', 10)).toBe(false);
  });

  it('is true immediately after an opening quote', () => {
    const line = '    e "Hello';
    expect(isInsideStringLiteral(line, line.length + 1)).toBe(true);
  });

  it('is false once the string is closed', () => {
    const line = '    e "Hello" and more';
    expect(isInsideStringLiteral(line, line.length + 1)).toBe(false);
  });
});

describe('getRenpyCompletions', () => {
  it('returns labels for jump context', () => {
    const items = getRenpyCompletions('jump', sampleData, range);
    const labels = items.map(i => i.label);
    expect(labels).toContain('start');
    expect(labels).toContain('chapter1');
    expect(items.every(i => i.kind === CompletionItemKind.Function)).toBe(true);
  });

  it('returns labels for call context', () => {
    const items = getRenpyCompletions('call', sampleData, range);
    expect(items.map(i => i.label)).toContain('start');
  });

  it('returns screens for call-screen context', () => {
    const items = getRenpyCompletions('call-screen', sampleData, range);
    const labels = items.map(i => i.label);
    expect(labels).toContain('main_menu');
    expect(labels).toContain('inventory');
    expect(items.every(i => i.kind === CompletionItemKind.Module)).toBe(true);
    const inv = items.find(i => i.label === 'inventory');
    expect(inv?.detail).toContain('items');
  });

  it('returns no suggestions for string context', () => {
    expect(getRenpyCompletions('string', sampleData, range)).toEqual([]);
  });

  it('returns images for show context', () => {
    const items = getRenpyCompletions('show', sampleData, range);
    const labels = items.map(i => i.label);
    expect(labels).toContain('eileen happy');
    expect(labels).toContain('bg park');
    expect(items.every(i => i.kind === CompletionItemKind.File)).toBe(true);
  });

  it('returns images for hide and scene contexts', () => {
    expect(getRenpyCompletions('hide', sampleData, range).length).toBe(3);
    expect(getRenpyCompletions('scene', sampleData, range).length).toBe(3);
  });

  it('returns variables for variable context', () => {
    const items = getRenpyCompletions('variable', sampleData, range);
    const labels = items.map(i => i.label);
    expect(labels).toContain('score');
    expect(labels).toContain('player_name');
    expect(items.every(i => i.kind === CompletionItemKind.Variable)).toBe(true);
  });

  it('returns keywords, characters, labels, variables, screens, and snippets for general context', () => {
    const items = getRenpyCompletions('general', sampleData, range);

    // Should include keywords
    expect(items.some(i => i.label === 'label' && i.kind === CompletionItemKind.Keyword)).toBe(true);
    expect(items.some(i => i.label === 'jump' && i.kind === CompletionItemKind.Keyword)).toBe(true);

    // Should include characters
    expect(items.some(i => i.label === 'e' && i.kind === CompletionItemKind.Class)).toBe(true);
    expect(items.some(i => i.label === 'mc' && i.kind === CompletionItemKind.Class)).toBe(true);

    // Should include labels
    expect(items.some(i => i.label === 'start' && i.kind === CompletionItemKind.Function)).toBe(true);

    // Should include variables
    expect(items.some(i => i.label === 'score' && i.kind === CompletionItemKind.Variable)).toBe(true);

    // Should include screens
    expect(items.some(i => i.label === 'main_menu' && i.kind === CompletionItemKind.Module)).toBe(true);

    // Should include user snippets
    expect(items.some(i => i.label === 'Quick Choice' && i.kind === CompletionItemKind.Snippet)).toBe(true);
  });

  it('keyword completions use InsertAsSnippet rule', () => {
    const items = getRenpyCompletions('general', sampleData, range);
    const labelItem = items.find(i => i.label === 'label');
    expect(labelItem?.insertTextRules).toBe(InsertTextRule.InsertAsSnippet);
    expect(labelItem?.insertText).toContain('${1:name}');
  });

  it('user snippets with monacoBody use InsertAsSnippet rule', () => {
    const items = getRenpyCompletions('general', sampleData, range);
    const snippet = items.find(i => i.label === 'Quick Choice');
    expect(snippet?.insertTextRules).toBe(InsertTextRule.InsertAsSnippet);
    expect(snippet?.insertText).toContain('${1:prompt}');
  });

  it('includes ATL animation presets as snippet completions in general context', () => {
    const items = getRenpyCompletions('general', sampleData, range);
    const shake = items.find(i => i.label === 'atl_shake');
    expect(shake).toBeDefined();
    expect(shake?.kind).toBe(CompletionItemKind.Snippet);
    expect(shake?.detail).toBe('ATL Preset: Shake');
    expect(shake?.insertTextRules).toBe(InsertTextRule.InsertAsSnippet);
    expect(shake?.insertText).toContain('${1:0.1}');
  });

  it('returns widget names and properties for screen context', () => {
    const items = getRenpyCompletions('screen', sampleData, range);
    const labels = items.map(i => i.label);
    expect(labels).toContain('vbox');
    expect(labels).toContain('textbutton');
    expect(labels).toContain('xpos');
    expect(labels).toContain('yalign');
    expect(items.some(i => i.label === 'vbox' && i.kind === CompletionItemKind.Keyword)).toBe(true);
    expect(items.some(i => i.label === 'xpos' && i.kind === CompletionItemKind.Variable)).toBe(true);
  });

  it('widget completions in screen context use InsertAsSnippet for container widgets', () => {
    const items = getRenpyCompletions('screen', sampleData, range);
    const vboxItem = items.find(i => i.label === 'vbox');
    expect(vboxItem?.insertTextRules).toBe(InsertTextRule.InsertAsSnippet);
    expect(vboxItem?.insertText).toContain('$0');
  });

  it('returns empty array for jump context with no labels', () => {
    const emptyData: RenpyCompletionData = {
      labels: {}, characters: new Map(), variables: new Map(),
      screens: new Map(), definedImages: new Set(),
    };
    expect(getRenpyCompletions('jump', emptyData, range)).toEqual([]);
  });

  it('sorts characters before keywords in general context', () => {
    const items = getRenpyCompletions('general', sampleData, range);
    const charItem = items.find(i => i.label === 'e');
    const kwItem = items.find(i => i.label === 'label');
    // Characters sortText starts with 1_, keywords with 2_
    expect(charItem!.sortText! < kwItem!.sortText!).toBe(true);
  });
});

describe('isInsideScreenBlock', () => {
  it('returns true when cursor is inside a screen definition', () => {
    const lines = [
      'screen my_screen():',
      '    vbox:',
      '        ',
    ];
    expect(isInsideScreenBlock(lines, 2)).toBe(true);
  });

  it('returns true at the first indent level inside a screen', () => {
    const lines = [
      'screen my_screen():',
      '    ',
    ];
    expect(isInsideScreenBlock(lines, 1)).toBe(true);
  });

  it('returns false when cursor is inside a label block', () => {
    const lines = [
      'label start:',
      '    ',
    ];
    expect(isInsideScreenBlock(lines, 1)).toBe(false);
  });

  it('returns false at the top level (no indent)', () => {
    const lines = [
      'screen my_screen():',
      '    vbox:',
      '',
    ];
    expect(isInsideScreenBlock(lines, 2)).toBe(false);
  });

  it('returns false when lineIndex is 0', () => {
    expect(isInsideScreenBlock(['screen foo():'], 0)).toBe(false);
  });

  it('skips blank and comment lines when scanning backwards', () => {
    const lines = [
      'screen my_screen():',
      '',
      '    # a comment',
      '    ',
    ];
    expect(isInsideScreenBlock(lines, 3)).toBe(true);
  });
});
