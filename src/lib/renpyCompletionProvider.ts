/**
 * @file renpyCompletionProvider.ts
 * @description Context-aware completion provider for Ren'Py language in Monaco editor.
 * Analyzes cursor position to suggest labels, characters, variables, screens,
 * images, keywords, user snippets, and ATL animation presets.
 */
import { ATL_PRESETS, presetToMonacoSnippet } from './atlPresetLibrary';

// Monaco CompletionItemKind values (avoid importing monaco in this pure module)
export const CompletionItemKind = {
  Function: 1,
  Variable: 4,
  Class: 5,
  Module: 8,
  File: 16,
  Keyword: 17,
  Snippet: 27,
} as const;

export const InsertTextRule = {
  InsertAsSnippet: 4,
} as const;

export type CompletionContext =
  | 'jump'
  | 'call'
  | 'call-screen'
  | 'show'
  | 'hide'
  | 'scene'
  | 'character'
  | 'variable'
  | 'screen'
  | 'general'
  | 'string';

export interface CompletionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface CompletionItem {
  label: string;
  kind: number;
  detail?: string;
  documentation?: string;
  insertText: string;
  insertTextRules?: number;
  range: CompletionRange;
  sortText?: string;
}

export interface RenpyCompletionData {
  labels: { [label: string]: { blockId: string; line: number; type?: string } };
  characters: Map<string, { name: string; tag: string; color?: string }>;
  variables: Map<string, { name: string; type?: string; initialValue?: string }>;
  screens: Map<string, { name: string; parameters?: string | string[] }>;
  definedImages: Set<string>;
  userSnippets?: { id: string; title: string; prefix: string; description: string; code: string; monacoBody?: string }[];
}

/**
 * Returns true when `column` (1-based) sits inside an open quoted string on `lineContent`,
 * e.g. dialogue text like `e "Hello, how are|` (cursor at `|`). Tracks escape sequences so
 * `\"` doesn't prematurely close the string. Only single-line strings are considered — Ren'Py
 * dialogue is effectively always single-line, and triple-quoted blocks are rare enough here
 * that a whole-document scan isn't worth doing on every keystroke.
 */
export function isInsideStringLiteral(lineContent: string, column: number): boolean {
  const textBefore = lineContent.substring(0, column - 1);
  let inString = false;
  let quoteChar = '';
  for (let i = 0; i < textBefore.length; i++) {
    const ch = textBefore[i];
    if (ch === '\\' && inString) {
      i++; // skip escaped character
      continue;
    }
    if (inString) {
      if (ch === quoteChar) inString = false;
    } else if (ch === '"' || ch === "'") {
      inString = true;
      quoteChar = ch;
    }
  }
  return inString;
}

/**
 * Detects the completion context based on the current line content and cursor position.
 * Strips leading whitespace and checks for Ren'Py keyword prefixes.
 */
export function detectContext(lineContent: string, column: number): CompletionContext {
  // Typing inside a quoted string (dialogue text, filenames, etc.) shouldn't surface the
  // full keyword/character/label/variable dump — it interrupts writing actual prose.
  if (isInsideStringLiteral(lineContent, column)) return 'string';

  const textBefore = lineContent.substring(0, column - 1).trimStart();

  // Check for specific keyword prefixes (order matters: call screen before call)
  if (/^call\s+screen\s+/i.test(textBefore)) return 'call-screen';
  if (/^call\s+/i.test(textBefore)) return 'call';
  if (/^jump\s+/i.test(textBefore)) return 'jump';
  if (/^show\s+/i.test(textBefore)) return 'show';
  if (/^hide\s+/i.test(textBefore)) return 'hide';
  if (/^scene\s+/i.test(textBefore)) return 'scene';

  // Variable context: after $ or python block
  if (textBefore.startsWith('$') || textBefore.startsWith('python')) return 'variable';

  // Character speaking: line starts with a word followed by space+quote (e.g., `e "Hello"`)
  // Only suggest characters if we're at the very start of an indented line (typical dialogue position)
  if (/^\s*$/.test(lineContent.substring(0, column - 1)) && column <= 5) return 'general';

  // If the line is indented and the cursor is at the start of a word (likely a character tag or statement)
  if (/^\w*$/.test(textBefore) && textBefore.length > 0 && textBefore.length < 20) {
    // Could be a character tag or a keyword — return 'general' to include both
    return 'general';
  }

  return 'general';
}

const KEYWORD_SNIPPETS: { label: string; insertText: string; detail: string }[] = [
  { label: 'label', insertText: 'label ${1:name}:\n    $0', detail: 'Define a label' },
  { label: 'jump', insertText: 'jump ${1:label_name}', detail: 'Jump to a label' },
  { label: 'call', insertText: 'call ${1:label_name}', detail: 'Call a label' },
  { label: 'menu', insertText: 'menu:\n    "${1:What do you do?}":\n        "${2:Choice 1}":\n            $0', detail: 'Create a choice menu' },
  { label: 'define', insertText: 'define ${1:name} = ${2:value}', detail: 'Define a constant variable' },
  { label: 'default', insertText: 'default ${1:name} = ${2:value}', detail: 'Define a saveable variable' },
  { label: 'if', insertText: 'if ${1:condition}:\n    $0', detail: 'Conditional branch' },
  { label: 'elif', insertText: 'elif ${1:condition}:\n    $0', detail: 'Else-if branch' },
  { label: 'else', insertText: 'else:\n    $0', detail: 'Else branch' },
  { label: 'while', insertText: 'while ${1:condition}:\n    $0', detail: 'While loop' },
  { label: 'for', insertText: 'for ${1:item} in ${2:iterable}:\n    $0', detail: 'For loop' },
  { label: 'screen', insertText: 'screen ${1:name}():\n    $0', detail: 'Define a screen' },
  { label: 'show', insertText: 'show ${1:image}', detail: 'Show an image' },
  { label: 'scene', insertText: 'scene ${1:background}', detail: 'Set background scene' },
  { label: 'hide', insertText: 'hide ${1:image}', detail: 'Hide an image' },
  { label: 'with', insertText: 'with ${1:transition}', detail: 'Apply a transition' },
  { label: 'play', insertText: 'play ${1:channel} "${2:filename}"', detail: 'Play audio' },
  { label: 'stop', insertText: 'stop ${1:channel}', detail: 'Stop audio' },
  { label: 'queue', insertText: 'queue ${1:channel} "${2:filename}"', detail: 'Queue audio' },
  { label: 'pause', insertText: 'pause ${1:duration}', detail: 'Pause execution' },
  { label: 'return', insertText: 'return', detail: 'Return from call/end game' },
  { label: 'pass', insertText: 'pass', detail: 'Do nothing (placeholder)' },
  { label: 'python', insertText: 'python:\n    $0', detail: 'Python block' },
  { label: 'init', insertText: 'init ${1:priority} python:\n    $0', detail: 'Init python block' },
  { label: 'image', insertText: 'image ${1:name} = "${2:filename}"', detail: 'Define an image' },
  { label: 'transform', insertText: 'transform ${1:name}:\n    $0', detail: 'Define a transform' },
  { label: 'nvl', insertText: 'nvl clear', detail: 'Clear NVL-mode text' },
  { label: 'window', insertText: 'window ${1|show,hide,auto|}', detail: 'Window command' },
];

/**
 * Returns true when the cursor (0-based lineIndex) is nested inside a `screen` block.
 * Scans backwards to find the first containing block header and checks whether it
 * is a `screen` definition.
 */
export function isInsideScreenBlock(lines: string[], lineIndex: number): boolean {
  if (lineIndex <= 0) return false;
  let targetIndent = lines[lineIndex].match(/^(\s*)/)?.[1].length ?? 0;
  if (targetIndent === 0) return false;
  for (let i = lineIndex - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent < targetIndent) {
      if (/^\s*screen\s+\w/.test(line)) return true;
      if (indent === 0) return false;
      targetIndent = indent;
    }
  }
  return false;
}

const SCREEN_WIDGET_SNIPPETS: { label: string; insertText: string; detail: string }[] = [
  { label: 'text', insertText: 'text "${1:Hello}"', detail: 'Display text' },
  { label: 'textbutton', insertText: 'textbutton "${1:Label}" action ${2:Return()}', detail: 'Button with text label' },
  { label: 'button', insertText: 'button action ${1:Return()}:\n    $0', detail: 'Clickable button container' },
  { label: 'imagebutton', insertText: 'imagebutton idle "${1:idle.png}" action ${2:Return()}', detail: 'Image button' },
  { label: 'vbox', insertText: 'vbox:\n    $0', detail: 'Vertical box layout' },
  { label: 'hbox', insertText: 'hbox:\n    $0', detail: 'Horizontal box layout' },
  { label: 'fixed', insertText: 'fixed:\n    $0', detail: 'Fixed-position container' },
  { label: 'frame', insertText: 'frame:\n    $0', detail: 'Framed container' },
  { label: 'window', insertText: 'window:\n    $0', detail: 'Window container' },
  { label: 'side', insertText: 'side "${1:c}":\n    $0', detail: 'Side layout container' },
  { label: 'viewport', insertText: 'viewport:\n    $0', detail: 'Scrollable viewport' },
  { label: 'vpgrid', insertText: 'vpgrid cols ${1:2}:\n    $0', detail: 'Scrollable grid' },
  { label: 'grid', insertText: 'grid ${1:2} ${2:2}:\n    $0', detail: 'Grid layout' },
  { label: 'use', insertText: 'use ${1:screen_name}', detail: 'Include another screen' },
  { label: 'transclude', insertText: 'transclude', detail: 'Transclude child content' },
  { label: 'key', insertText: 'key "${1:K_RETURN}" action ${2:Return()}', detail: 'Keyboard shortcut binding' },
  { label: 'timer', insertText: 'timer ${1:1.0} action ${2:Return()}', detail: 'Timed action trigger' },
  { label: 'bar', insertText: 'bar value ${1:VariableValue("var", 0, 100)}', detail: 'Horizontal bar' },
  { label: 'vbar', insertText: 'vbar value ${1:VariableValue("var", 0, 100)}', detail: 'Vertical bar' },
  { label: 'input', insertText: 'input default "${1:}" length ${2:100}', detail: 'Text input field' },
  { label: 'null', insertText: 'null', detail: 'Empty placeholder widget' },
  { label: 'mousearea', insertText: 'mousearea hovered ${1:None} unhovered ${2:None}', detail: 'Mouse hover area' },
  { label: 'drag', insertText: 'drag drag_name "${1:name}":\n    $0', detail: 'Draggable widget' },
  { label: 'draggroup', insertText: 'draggroup:\n    $0', detail: 'Container for draggable widgets' },
  { label: 'transform', insertText: 'transform ${1:name}:\n    $0', detail: 'Inline transform' },
  { label: 'imagemap', insertText: 'imagemap:\n    ground "${1:ground.png}"\n    $0', detail: 'Image map widget' },
  { label: 'hotspot', insertText: 'hotspot (${1:0}, ${2:0}, ${3:100}, ${4:100}) action ${5:Return()}', detail: 'Clickable hotspot on imagemap' },
  { label: 'hotbar', insertText: 'hotbar (${1:0}, ${2:0}, ${3:100}, ${4:20}) value ${5:VariableValue("var", 0, 100)}', detail: 'Bar-style hotspot' },
  { label: 'default', insertText: 'default ${1:var} = ${2:value}', detail: 'Screen-local variable' },
  { label: 'on', insertText: 'on "${1:show}" action ${2:None}', detail: 'Screen event handler' },
  { label: 'dismiss', insertText: 'dismiss action ${1:Return()}', detail: 'Dismissable overlay area' },
  { label: 'nearrect', insertText: 'nearrect focus "${1:id}":\n    $0', detail: 'Positioned near another widget' },
  { label: 'showif', insertText: 'showif ${1:condition}:\n    $0', detail: 'Conditionally shown content' },
];

const SCREEN_PROPERTY_COMPLETIONS: { label: string; detail: string }[] = [
  { label: 'xpos', detail: 'Horizontal position' },
  { label: 'ypos', detail: 'Vertical position' },
  { label: 'xalign', detail: 'Horizontal alignment (0.0–1.0)' },
  { label: 'yalign', detail: 'Vertical alignment (0.0–1.0)' },
  { label: 'xsize', detail: 'Width' },
  { label: 'ysize', detail: 'Height' },
  { label: 'style', detail: 'Style name' },
  { label: 'action', detail: 'Action on activation' },
  { label: 'hovered', detail: 'Action/transform when hovered' },
  { label: 'unhovered', detail: 'Action/transform when unhovered' },
  { label: 'sensitive', detail: 'Whether widget is interactive' },
  { label: 'selected', detail: 'Whether widget is selected' },
  { label: 'text', detail: 'Text property' },
  { label: 'spacing', detail: 'Spacing between children' },
  { label: 'scrollbars', detail: 'Scrollbar visibility ("horizontal"/"vertical"/"both")' },
  { label: 'cols', detail: 'Number of columns' },
  { label: 'rows', detail: 'Number of rows' },
];

/**
 * Generates completion items for the given context and analysis data.
 */
export function getRenpyCompletions(
  context: CompletionContext,
  data: RenpyCompletionData,
  range: CompletionRange
): CompletionItem[] {
  const items: CompletionItem[] = [];

  switch (context) {
    case 'string':
      // Inside a quoted string literal — no suggestions (see isInsideStringLiteral).
      break;

    case 'jump':
    case 'call':
      // Suggest labels
      for (const [label, info] of Object.entries(data.labels)) {
        items.push({
          label,
          kind: CompletionItemKind.Function,
          detail: `Label (${info.type || 'label'})`,
          insertText: label,
          range,
          sortText: `0_${label}`,
        });
      }
      break;

    case 'call-screen':
      // Suggest screens
      for (const [name, info] of data.screens) {
        const paramStr = Array.isArray(info.parameters) ? info.parameters.join(', ') : (info.parameters || '');
        const params = paramStr ? `(${paramStr})` : '';
        items.push({
          label: name,
          kind: CompletionItemKind.Module,
          detail: `Screen${params}`,
          insertText: name,
          range,
          sortText: `0_${name}`,
        });
      }
      break;

    case 'show':
    case 'hide':
    case 'scene':
      // Suggest defined images
      for (const imageName of data.definedImages) {
        items.push({
          label: imageName,
          kind: CompletionItemKind.File,
          detail: 'Image',
          insertText: imageName,
          range,
          sortText: `0_${imageName}`,
        });
      }
      break;

    case 'variable':
      // Suggest variables
      for (const [name, info] of data.variables) {
        items.push({
          label: name,
          kind: CompletionItemKind.Variable,
          detail: `${info.type || 'variable'}: ${info.initialValue || ''}`,
          insertText: name,
          range,
          sortText: `0_${name}`,
        });
      }
      break;

    case 'screen':
      // Widget names
      for (const widget of SCREEN_WIDGET_SNIPPETS) {
        items.push({
          label: widget.label,
          kind: CompletionItemKind.Keyword,
          detail: widget.detail,
          insertText: widget.insertText,
          insertTextRules: InsertTextRule.InsertAsSnippet,
          range,
          sortText: `0_${widget.label}`,
        });
      }
      // Widget properties
      for (const prop of SCREEN_PROPERTY_COMPLETIONS) {
        items.push({
          label: prop.label,
          kind: CompletionItemKind.Variable,
          detail: prop.detail,
          insertText: prop.label,
          range,
          sortText: `1_${prop.label}`,
        });
      }
      break;

    case 'character':
    case 'general':
      // Keyword snippets
      for (const kw of KEYWORD_SNIPPETS) {
        items.push({
          label: kw.label,
          kind: CompletionItemKind.Keyword,
          detail: kw.detail,
          insertText: kw.insertText,
          insertTextRules: InsertTextRule.InsertAsSnippet,
          range,
          sortText: `2_${kw.label}`,
        });
      }

      // Character tags
      for (const [tag, char] of data.characters) {
        items.push({
          label: tag,
          kind: CompletionItemKind.Class,
          detail: `Character: ${char.name}`,
          insertText: tag,
          range,
          sortText: `1_${tag}`,
        });
      }

      // Labels
      for (const [label, info] of Object.entries(data.labels)) {
        items.push({
          label,
          kind: CompletionItemKind.Function,
          detail: `Label (${info.type || 'label'})`,
          insertText: label,
          range,
          sortText: `3_${label}`,
        });
      }

      // Variables
      for (const [name, info] of data.variables) {
        items.push({
          label: name,
          kind: CompletionItemKind.Variable,
          detail: `${info.type || 'variable'}: ${info.initialValue || ''}`,
          insertText: name,
          range,
          sortText: `3_${name}`,
        });
      }

      // Screens
      for (const [name] of data.screens) {
        items.push({
          label: name,
          kind: CompletionItemKind.Module,
          detail: 'Screen',
          insertText: name,
          range,
          sortText: `3_${name}`,
        });
      }

      // ATL animation presets (e.g. "atl_shake"), for use inside a `transform` block
      for (const preset of ATL_PRESETS) {
        const prefix = `atl_${preset.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
        items.push({
          label: prefix,
          kind: CompletionItemKind.Snippet,
          detail: `ATL Preset: ${preset.title}`,
          documentation: preset.description,
          insertText: presetToMonacoSnippet(preset),
          insertTextRules: InsertTextRule.InsertAsSnippet,
          range,
          sortText: `1_${prefix}`,
        });
      }

      // User snippets
      if (data.userSnippets) {
        for (const snippet of data.userSnippets) {
          items.push({
            label: snippet.title,
            kind: CompletionItemKind.Snippet,
            detail: 'User Snippet',
            documentation: snippet.description,
            insertText: snippet.monacoBody || snippet.code,
            insertTextRules: snippet.monacoBody ? InsertTextRule.InsertAsSnippet : undefined,
            range,
            sortText: `1_${snippet.prefix}`,
          });
        }
      }
      break;
  }

  return items;
}
