/**
 * @file useRenpyAnalysis.ts
 * @description Ren'Py code analysis engine that parses .rpy files to extract story structure.
 * Analyzes labels, jumps, characters, variables, screens, and generates route graph data.
 * Exports performRenpyAnalysis() for synchronous analysis and useRenpyAnalysis() hook for memoized results.
 * Uses regex patterns to parse Ren'Py syntax and build connection maps between story blocks.
 */

import { useState, useEffect, useRef } from 'react';
import type { RenpyAnalysisResult, LabelLocation, JumpLocation, Character, Variable, RenpyScreen, LabelNode, RouteLink, IdentifiedRoute } from '@/types';
import { getTripleQuotedLineMask } from '@/lib/renpyTripleQuotes';
import { isReservedRenpyName } from '@/lib/renpyNames';
import { collectRenpyHasLabelGuards, isJumpGuardedByHasLabel } from '@/lib/renpyLabelGuards';
import { buildRouteGraph, computeLayeredLayoutGeneric, type LayoutConfig } from '@/lib/graphLayout';
import { logger } from '@/lib/logger';

/**
 * Minimal block shape used by the analysis engine — only the fields it actually reads.
 * Passing this instead of full Block[] to the worker avoids sending position/size/etc.
 * over the postMessage boundary on every canvas drag or resize.
 */
export interface AnalysisBlock {
  id: string;
  content: string;
  filePath?: string;
  title?: string;
}

const LABEL_REGEX = /^\s*label\s+([a-zA-Z0-9_]+):/;
const JUMP_CALL_EXPRESSION_REGEX = /\b(jump|call)\s+expression\s+(?:"([a-zA-Z0-9_]+)"|'([a-zA-Z0-9_]+)'|([a-zA-Z0-9_.]+))/g;
const JUMP_CALL_STATIC_REGEX = /\b(jump|call)\s+([a-zA-Z0-9_]+)/g;
const MENU_REGEX = /^\s*menu:/;
const MENU_LABEL_REGEX = /^\s*menu\s+([a-zA-Z0-9_]+):/;
const DIALOGUE_REGEX = /^\s*([a-zA-Z0-9_]+)\s+"/;
const NARRATION_REGEX = /^\s*"(?!:)/; 
const SCREEN_REGEX = /^\s*screen\s+([a-zA-Z0-9_]+)\s*(\(.*\))?:/;
const DEFINE_DEFAULT_REGEX = /^\s*(define|default)\s+([a-zA-Z0-9_.]+)\s*=\s*(?!\s*Character\s*\()(.+)/;
const IMAGE_DEF_REGEX = /^\s*image\s+([a-zA-Z0-9_ ]+?)\s*=/;
const SCENE_STATEMENT_REGEX = /^\s*scene\s+((?!expression\b)[a-zA-Z0-9_][a-zA-Z0-9_ ]*?)(?:\s+with\b|\s*(?:#|$))/;

const PALETTE = [
  '#E57373', '#F06292', '#BA68C8', '#9575CD', '#7986CB', '#64B5F6',
  '#4FC3F7', '#4DD0E1', '#4DB6AC', '#81C784', '#AED581', '#DCE775',
  '#FFF176', '#FFD54F', '#FFB74D', '#FF8A65', '#A1887F', '#90A4AE'
];

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

const unquote = (s: string | undefined): string | undefined => {
    if (!s) return undefined;
    const trimmed = s.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
};

function parseCharacterArgs(argsString: string): { positional: string[]; kwargs: Record<string, string> } {
  const args: string[] = [];
  let parenLevel = 0;
  let inString: false | '"' | "'" = false;
  let currentArg = '';
  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];
    if (inString) {
      if (char === inString && argsString[i-1] !== '\\') {
        inString = false;
      }
    } else {
      if (char === '"' || char === "'") inString = char;
      if (char === '(') parenLevel++;
      if (char === ')') parenLevel--;
    }
    
    if (char === ',' && parenLevel === 0 && !inString) {
      args.push(currentArg.trim());
      currentArg = '';
    } else {
      currentArg += char;
    }
  }
  args.push(currentArg.trim());

  const positional: string[] = [];
  const kwargs: Record<string, string> = {};

  for (const arg of args.filter(a => a)) {
    const match = arg.match(/^\s*([a-zA-Z0-9_]+)\s*=\s*([\s\S]+)\s*$/);
    if (match) {
      kwargs[match[1]] = match[2];
    } else {
      positional.push(arg);
    }
  }

  return { positional, kwargs };
}

interface ChoiceContext { text: string; condition?: string; menuLine: number; }

/**
 * Builds a map from 1-based line number → { text, condition } for all lines
 * that fall inside a menu choice block in the given Ren'Py content. Used to
 * annotate jumps/calls with the choice text (and optional guard condition) that
 * triggered them.
 */
function buildMenuChoiceContextMap(content: string): Map<number, ChoiceContext> {
  const map = new Map<number, ChoiceContext>();
  const lines = content.split('\n').map(l => l.endsWith('\r') ? l.slice(0, -1) : l);

  let menuIndent = -1;
  let menuLine = 0;
  let choiceIndent = -1;
  let currentCtx: ChoiceContext | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue; // blank lines don't reset state

    const indent = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    const commentIdx = trimmed.indexOf('#');
    const code = commentIdx >= 0 ? trimmed.slice(0, commentIdx).trimEnd() : trimmed;

    // Detect "menu:" or "menu label:" line
    if (/^menu(\s+\w+)?\s*:/.test(code)) {
      menuIndent = indent;
      menuLine = i + 1; // 1-based line of the menu: keyword
      choiceIndent = -1;
      currentCtx = null;
      continue;
    }

    if (menuIndent >= 0) {
      if (indent <= menuIndent) {
        // Unindented back to or past menu level — menu ended
        menuIndent = -1;
        choiceIndent = -1;
        currentCtx = null;
        if (/^menu(\s+\w+)?\s*:/.test(code)) {
          menuIndent = indent;
          menuLine = i + 1;
        }
      } else if (choiceIndent < 0) {
        // First indented line establishes choice indent level
        const m = code.match(/^"([^"]*)"\s*(?:if\s+([^:]+?))?\s*:/);
        if (m) {
          choiceIndent = indent;
          currentCtx = { text: m[1], condition: m[2]?.trim(), menuLine };
        }
      } else if (indent === choiceIndent) {
        // Another choice at the same level
        const m = code.match(/^"([^"]*)"\s*(?:if\s+([^:]+?))?\s*:/);
        if (m) {
          currentCtx = { text: m[1], condition: m[2]?.trim(), menuLine };
        } else {
          currentCtx = null;
        }
      } else if (currentCtx && indent > choiceIndent) {
        // Inside a choice's body
        map.set(i + 1, currentCtx);
      }
    }
  }

  return map;
}

export const performRenpyAnalysis = (blocks: AnalysisBlock[]): RenpyAnalysisResult => {
  const result: RenpyAnalysisResult = {
    labels: {},
    jumps: {},
    links: [],
    invalidJumps: {},
    firstLabels: {},
    rootBlockIds: new Set(),
    leafBlockIds: new Set(),
    branchingBlockIds: new Set(),
    screenOnlyBlockIds: new Set(),
    storyBlockIds: new Set(),
    configBlockIds: new Set(),
    characters: new Map(),
    dialogueLines: new Map(),
    characterUsage: new Map(),
    variables: new Map(),
    variableUsages: new Map(),
    screens: new Map(),
    definedImages: new Set(),
    blockTypes: new Map(),
    labelNodes: [],
    routeLinks: [],
    identifiedRoutes: [],
    routesTruncated: false,
    translationData: {
      translatableStrings: [],
      translatedStrings: new Map(),
      languageCoverages: [],
      detectedLanguages: [],
      stringTranslations: new Map(),
    },
  };

  blocks.forEach(block => {
    if (block.filePath && (block.filePath.endsWith('debug_placeholders.rpy') || block.filePath === 'game/debug_placeholders.rpy')) return;

    const CHARACTER_REGEX_G = /^\s*define\s+([a-zA-Z0-9_]+)\s*=\s*Character\s*\(([\s\S]*?)\)/gm;
    for (const match of block.content.matchAll(CHARACTER_REGEX_G)) {
        const tag = match[1];
        const argsString = match[2];
        const { positional, kwargs } = parseCharacterArgs(argsString);

        const rawName = kwargs.name || (positional.length > 0 ? positional[0] : null);
        const name = (rawName && rawName.toLowerCase() !== 'none') ? unquote(rawName) || tag : tag;
        const color = unquote(kwargs.color);
        
        let profile: string | undefined;
        if (match.index > 0) {
            const precedingContent = block.content.substring(0, match.index);
            const precedingLines = precedingContent.split('\n');
            let lastLine = precedingLines.pop()?.trim();
            while (lastLine === '' && precedingLines.length > 0) {
              lastLine = precedingLines.pop()?.trim();
            }
            if (lastLine && lastLine.startsWith('# profile:')) {
              profile = lastLine.substring('# profile:'.length).trim();
            }
        }

        const character: Character = {
            tag, name, color: color || stringToColor(tag), profile, definedInBlockId: block.id,
            image: unquote(kwargs.image), who_style: unquote(kwargs.who_style), who_prefix: unquote(kwargs.who_prefix), who_suffix: unquote(kwargs.who_suffix),
            what_color: unquote(kwargs.what_color), what_style: unquote(kwargs.what_style), what_prefix: unquote(kwargs.what_prefix), what_suffix: unquote(kwargs.what_suffix),
            slow: kwargs.slow === 'True' ? true : kwargs.slow === 'False' ? false : undefined,
            slow_speed: kwargs.slow_speed ? parseInt(kwargs.slow_speed, 10) : undefined,
            slow_abortable: kwargs.slow_abortable === 'True' ? true : kwargs.slow_abortable === 'False' ? false : undefined,
            all_at_once: kwargs.all_at_once === 'True' ? true : kwargs.all_at_once === 'False' ? false : undefined,
            window_style: unquote(kwargs.window_style), ctc: unquote(kwargs.ctc), ctc_position: unquote(kwargs.ctc_position) as 'nestled' | 'fixed' | undefined,
            interact: kwargs.interact === 'True' ? true : kwargs.interact === 'False' ? false : undefined,
            afm: kwargs.afm === 'True' ? true : kwargs.afm === 'False' ? false : undefined,
            what_properties: kwargs.what_properties, window_properties: kwargs.window_properties,
        };
        result.characters.set(character.tag, character);
    }
    
    let isFirstLabelInBlock = true;
    const lines = block.content.split('\n');
    const tripleQuotedLineMask = getTripleQuotedLineMask(block.content);
    lines.forEach((line, index) => {
      if (tripleQuotedLineMask[index]) return;

      const labelMatch = line.match(LABEL_REGEX);
      if (labelMatch && labelMatch[1]) {
        const labelName = labelMatch[1];
        const labelLocation: LabelLocation = {
          blockId: block.id, label: labelName, line: index + 1, column: labelMatch[0].indexOf(labelName) + 1, type: 'label',
        };
        result.labels[labelName] = labelLocation;
        if (isFirstLabelInBlock) {
          result.firstLabels[block.id] = labelName;
          isFirstLabelInBlock = false;
        }
      }

      const menuLabelMatch = line.match(MENU_LABEL_REGEX);
      if (menuLabelMatch && menuLabelMatch[1]) {
        const menuLabelName = menuLabelMatch[1];
        if (!result.labels[menuLabelName]) {
            const labelLocation: LabelLocation = {
                blockId: block.id, label: menuLabelName, line: index + 1, column: menuLabelMatch[0].indexOf(menuLabelName) + 1, type: 'menu',
            };
            result.labels[menuLabelName] = labelLocation;
        }
      }

      const screenMatch = line.match(SCREEN_REGEX);
      if (screenMatch) {
          const screen: RenpyScreen = {
              name: screenMatch[1], parameters: screenMatch[2] ? screenMatch[2].trim() : '', definedInBlockId: block.id, line: index + 1,
          };
          result.screens.set(screen.name, screen);
      }
      
      const varMatch = line.match(DEFINE_DEFAULT_REGEX);
      if (varMatch) {
        const variable: Variable = {
          type: varMatch[1] as 'define' | 'default', name: varMatch[2], initialValue: varMatch[3].trim(), definedInBlockId: block.id, line: index + 1,
        };
        result.variables.set(variable.name, variable);
      }

      const imageMatch = line.match(IMAGE_DEF_REGEX);
      if (imageMatch) {
          result.definedImages.add(imageMatch[1].trim());
      }
    });
  });

  result.characters.forEach((char) => {
    if (result.variables.has(char.tag)) result.variables.delete(char.tag);
  });

  // Detect implicit variable assignments ($ statements)
  blocks.forEach(block => {
    const lines = block.content.split('\n');
    const tripleQuotedMask = getTripleQuotedLineMask(block.content);

    lines.forEach((line, index) => {
      // Skip lines inside triple-quoted strings
      if (tripleQuotedMask[index]) return;

      // Remove comments
      const commentIndex = line.indexOf('#');
      const cleanLine = commentIndex >= 0 ? line.substring(0, commentIndex) : line;

      // Match $ variable_name = ... (excluding augmented assignments like +=, -=)
      const dollarMatch = cleanLine.match(/^\s*\$\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*=(?!=)\s*(.+)/);
      if (dollarMatch) {
        const varName = dollarMatch[1];
        const value = dollarMatch[2].trim();

        // Skip if already defined explicitly or as implicit
        if (!result.variables.has(varName)) {
          result.variables.set(varName, {
            name: varName,
            type: 'implicit',
            initialValue: value,
            definedInBlockId: block.id,
            line: index + 1
          });
        }
      }
    });
  });

  const variableNames = Array.from(result.variables.keys());
  // Build a single combined regex for all variable names instead of constructing
  // one RegExp per variable per line. This reduces O(vars × lines) regex constructions
  // to a single O(lines) pass with one regex.
  const combinedVarRegex = variableNames.length > 0
    ? new RegExp(`\\b(${variableNames.map(v => v.replace(/\./g, '\\.')).join('|')})\\b`, 'g')
    : null;

  blocks.forEach(block => {
    if (block.filePath && (block.filePath.endsWith('debug_placeholders.rpy') || block.filePath === 'game/debug_placeholders.rpy')) return;

    result.jumps[block.id] = [];
    const blockTypes = new Set<string>();
    if (block.content.includes('python:')) blockTypes.add('python');
    const hasLabelGuards = collectRenpyHasLabelGuards(block.content);

    const lines = block.content.split('\n');
    const tripleQuotedLineMask = getTripleQuotedLineMask(block.content);
    const choiceCtxMap = buildMenuChoiceContextMap(block.content);
    lines.forEach((line, index) => {
      if (tripleQuotedLineMask[index]) return;

      let sanitizedLine = line.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""').replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''");
      const commentIndex = sanitizedLine.indexOf('#');
      if (commentIndex !== -1) sanitizedLine = sanitizedLine.substring(0, commentIndex);

      let processedJumpOnLine = false;

      for (const match of sanitizedLine.matchAll(JUMP_CALL_EXPRESSION_REGEX)) {
        processedJumpOnLine = true;
        blockTypes.add('jump');
        const jumpType = match[1] as 'jump' | 'call';
        const targetLabel = match[2] || match[3] || match[4];
        if (!targetLabel || match.index === undefined) continue;
        const isResolvable = !!(match[2] || match[3]);

        const jumpLocation: JumpLocation = {
            blockId: block.id, target: targetLabel, type: jumpType, isDynamic: true, line: index + 1,
            columnStart: match.index + match[0].indexOf(targetLabel), columnEnd: match.index + match[0].indexOf(targetLabel) + targetLabel.length,
            choiceText: choiceCtxMap.get(index + 1)?.text,
            choiceCondition: choiceCtxMap.get(index + 1)?.condition,
            menuLine: choiceCtxMap.get(index + 1)?.menuLine,
        };
        result.jumps[block.id].push(jumpLocation);

        if (isResolvable) {
            const targetLabelLocation = result.labels[targetLabel];
            if (targetLabelLocation) {
                if (block.id !== targetLabelLocation.blockId) {
                    const existingIdx = result.links.findIndex(l => l.sourceId === block.id && l.targetId === targetLabelLocation.blockId);
                    if (existingIdx === -1) {
                        result.links.push({ sourceId: block.id, targetId: targetLabelLocation.blockId, targetLabel: targetLabel, type: jumpType });
                    } else if (jumpType === 'call') {
                        result.links[existingIdx] = { ...result.links[existingIdx], type: 'call' };
                    }
                }
            }
        }
      }

      if (!processedJumpOnLine) {
        for (const match of sanitizedLine.matchAll(JUMP_CALL_STATIC_REGEX)) {
          blockTypes.add('jump');
          const jumpType = match[1] as 'jump' | 'call';
          const targetLabel = match[2];
          if (targetLabel === 'expression') continue;
          if (!targetLabel || match.index === undefined) continue;

          const jumpLocation: JumpLocation = {
            blockId: block.id, target: targetLabel, type: jumpType, isDynamic: false, line: index + 1,
            columnStart: match.index + match[1].length + 1, columnEnd: match.index + match[1].length + 1 + targetLabel.length,
            choiceText: choiceCtxMap.get(index + 1)?.text,
            choiceCondition: choiceCtxMap.get(index + 1)?.condition,
            menuLine: choiceCtxMap.get(index + 1)?.menuLine,
          };
          result.jumps[block.id].push(jumpLocation);

          const targetLabelLocation = result.labels[targetLabel];
          if (targetLabelLocation) {
            if (block.id !== targetLabelLocation.blockId) {
              const existingIdx = result.links.findIndex(l => l.sourceId === block.id && l.targetId === targetLabelLocation.blockId);
              if (existingIdx === -1) {
                result.links.push({ sourceId: block.id, targetId: targetLabelLocation.blockId, targetLabel: targetLabel, type: jumpType });
              } else if (jumpType === 'call') {
                result.links[existingIdx] = { ...result.links[existingIdx], type: 'call' };
              }
            }
          } else if (!isReservedRenpyName(targetLabel) && !isJumpGuardedByHasLabel(hasLabelGuards, index + 1, targetLabel)) {
            if (!result.invalidJumps[block.id]) result.invalidJumps[block.id] = [];
            if (!result.invalidJumps[block.id].includes(targetLabel)) {
              result.invalidJumps[block.id].push(targetLabel);
            }
          }
        }
      }
      
      if (LABEL_REGEX.test(line)) blockTypes.add('label');
      if (MENU_REGEX.test(line)) blockTypes.add('menu');

      const dialogueMatch = line.match(DIALOGUE_REGEX);
      if (dialogueMatch && result.characters.has(dialogueMatch[1])) {
        blockTypes.add('dialogue');
        const tag = dialogueMatch[1];
        if (!result.dialogueLines.has(block.id)) result.dialogueLines.set(block.id, []);
        result.dialogueLines.get(block.id)!.push({ line: index + 1, tag });
      } else if (NARRATION_REGEX.test(line)) {
        blockTypes.add('dialogue');
      }

      if (combinedVarRegex) {
        combinedVarRegex.lastIndex = 0;
        let varMatch: RegExpExecArray | null;
        while ((varMatch = combinedVarRegex.exec(sanitizedLine)) !== null) {
          const varName = varMatch[1];
          const defOnThisLine = result.variables.get(varName)?.definedInBlockId === block.id && result.variables.get(varName)?.line === index + 1;
          if (!defOnThisLine) {
              if (!result.variableUsages.has(varName)) result.variableUsages.set(varName, []);
              const usages = result.variableUsages.get(varName)!;
              if (!usages.some(u => u.blockId === block.id && u.line === index + 1)) {
                   usages.push({ blockId: block.id, line: index + 1 });
              }
          }
        }
      }
    });

    if (blockTypes.size > 0) result.blockTypes.set(block.id, blockTypes);
  });

  result.characters.forEach(char => result.characterUsage.set(char.tag, 0));
  result.dialogueLines.forEach((lines) => {
    lines.forEach(dialogue => {
      const currentCount = result.characterUsage.get(dialogue.tag) || 0;
      result.characterUsage.set(dialogue.tag, currentCount + 1);
    });
  });

  const allTargetIds = new Set(result.links.map(link => link.targetId));
  blocks.forEach(block => {
    const blockJumps = result.jumps[block.id] || [];
    const hasMenu = block.content.split('\n').some(line => MENU_REGEX.test(line));
    if (!allTargetIds.has(block.id)) result.rootBlockIds.add(block.id);
    if (blockJumps.length === 0) result.leafBlockIds.add(block.id);
    const distinctTargets = new Set(blockJumps.map(j => (result.labels[j.target] || {}).blockId).filter(Boolean));
    if (hasMenu || distinctTargets.size > 1) result.branchingBlockIds.add(block.id);
  });

  const screenDefiningBlockIds = new Set(Array.from(result.screens.values()).map(s => s.definedInBlockId));
  const labelDefiningBlockIds = new Set(Object.values(result.labels).map(l => l.blockId));
  const storyBlockIds = new Set(labelDefiningBlockIds);
  const specialStoryFileNames = ['game/variables.rpy', 'game/characters.rpy'];
  blocks.forEach(block => {
      if (block.filePath && specialStoryFileNames.includes(block.filePath)) storyBlockIds.add(block.id);
  });

  result.storyBlockIds = storyBlockIds;
  result.screenOnlyBlockIds = new Set([...screenDefiningBlockIds].filter(id => !storyBlockIds.has(id)));
  const configBlockIds = new Set<string>();
  blocks.forEach(block => {
    if (!result.storyBlockIds.has(block.id) && !screenDefiningBlockIds.has(block.id)) configBlockIds.add(block.id);
  });
  result.configBlockIds = configBlockIds;

  return result;
};

const ROUTE_INITIAL_CONFIG: LayoutConfig = {
  paddingX: 250,
  paddingY: 100,
  componentSpacing: 250,
  clusterSpacingX: 220,
  clusterSpacingY: 180,
  defaultWidth: 180,
  defaultHeight: 40,
  crossAxisBase: 50,
};

const NODE_IMAGE_HEIGHT = 40 + Math.round(176 * 9 / 16); // label row + 16:9 image at 180px width

/**
 * Post-processes label nodes to attach scene image names derived from block content.
 * Runs on the main thread so it always uses the latest code, bypassing the worker cache.
 * Labels without their own `scene` statement inherit the last seen scene name from a
 * prior label in the same file (forward propagation within each block).
 */
export function deriveSceneImageNames(nodes: LabelNode[], blocks: AnalysisBlock[]): LabelNode[] {
  const blockContentMap = new Map(blocks.map(b => [b.id, b.content]));

  const nodesByBlock = new Map<string, LabelNode[]>();
  nodes.forEach(node => {
    const arr = nodesByBlock.get(node.blockId) ?? [];
    arr.push(node);
    nodesByBlock.set(node.blockId, arr);
  });

  const updates = new Map<string, Partial<LabelNode>>();

  nodesByBlock.forEach((blockNodes, blockId) => {
    const content = blockContentMap.get(blockId);
    if (!content) return;

    const lines = content.split('\n');
    const sorted = [...blockNodes].sort((a, b) => a.startLine - b.startLine);

    let lastSceneName: string | undefined;
    sorted.forEach((node, i) => {
      const nextNode = sorted[i + 1];
      const endLine = nextNode ? nextNode.startLine - 1 : lines.length;

      let ownScene: string | undefined;
      for (let j = node.startLine; j < endLine; j++) {
        const m = (lines[j] ?? '').match(SCENE_STATEMENT_REGEX);
        if (m) { ownScene = m[1].trim(); break; }
      }

      if (ownScene !== undefined) lastSceneName = ownScene;
      const effective = ownScene ?? lastSceneName;

      if (effective !== undefined) {
        updates.set(node.id, { sceneImageName: effective, height: NODE_IMAGE_HEIGHT });
      }
    });
  });

  if (updates.size === 0) return nodes;
  return nodes.map(n => {
    const patch = updates.get(n.id);
    return patch ? { ...n, ...patch } : n;
  });
}

/** Hard cap on the number of routes enumerated to prevent exponential blowup. */
const MAX_ROUTES = 500;
/** Maximum recursion depth for path enumeration. */
const MAX_ROUTE_DEPTH = 100;

export const performRouteAnalysis = (
    blocks: AnalysisBlock[],
    labels: RenpyAnalysisResult['labels'],
    jumps: RenpyAnalysisResult['jumps']
): { labelNodes: LabelNode[], routeLinks: RouteLink[], identifiedRoutes: IdentifiedRoute[], routesTruncated: boolean } => {
  const labelNodes = new Map<string, LabelNode>();
  const routeLinks: RouteLink[] = [];
  const identifiedRoutes: IdentifiedRoute[] = [];
  let routesTruncated = false;
  const blockLabelInfo = new Map<string, { label: string; startLine: number; endLine: number; hasTerminal: boolean; hasReturn: boolean; }[]>();

  blocks.forEach(block => {
    if (block.filePath && (block.filePath.endsWith('debug_placeholders.rpy') || block.filePath === 'game/debug_placeholders.rpy')) return;

    const lines = block.content.split('\n');
    const tripleQuotedLineMask = getTripleQuotedLineMask(block.content);
    const labelsInBlock: { label: string; startLine: number }[] = [];
    Object.values(labels).forEach(labelLoc => {
        if (labelLoc.blockId === block.id && labelLoc.type !== 'menu') {
            labelsInBlock.push({ label: labelLoc.label, startLine: labelLoc.line });
        }
    });
    labelsInBlock.sort((a, b) => a.startLine - b.startLine);

    const labelInfoForBlock: { label: string; startLine: number; endLine: number; hasTerminal: boolean; hasReturn: boolean; }[] = [];
    labelsInBlock.forEach(({ label, startLine }, i) => {
        const endLine = (i + 1 < labelsInBlock.length) ? labelsInBlock[i + 1].startLine - 1 : lines.length;
        const contentSlice = lines
          .slice(startLine, endLine)
          .map((line, offset) => (tripleQuotedLineMask[startLine + offset] ? '' : line))
          .join('\n');

        // Determine the direct body indentation — the indent of the first real content
        // line after the label declaration. We only count jump/call/return as a terminal
        // if they appear at this exact indent level. Terminals inside menu: or if: branches
        // (which are at deeper indentation) do NOT prevent fall-through to the next label,
        // because those branches are alternatives, not guaranteed exit paths.
        // startLine is 1-based; use it directly as a 0-based array index to reach
        // the first body line (lines[startLine] = the line immediately after the
        // "label X:" declaration which is at lines[startLine - 1]).
        let directBodyIndent: number | null = null;
        for (let j = startLine; j < endLine; j++) {
          if (tripleQuotedLineMask[j]) continue;
          const trimmed = (lines[j] ?? '').trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          directBodyIndent = (lines[j].match(/^(\s*)/) ?? ['', ''])[1].length;
          break;
        }

        let hasTerminal = false;
        if (directBodyIndent !== null) {
          for (let j = startLine; j < endLine; j++) {
            if (tripleQuotedLineMask[j]) continue;
            const ln = lines[j] ?? '';
            const trimmed = ln.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const indent = (ln.match(/^(\s*)/) ?? ['', ''])[1].length;
            // Only check lines at the direct body level — skip anything deeper (inside menus, ifs, etc.)
            if (indent === directBodyIndent && /\b(jump|call|return)\b/.test(ln)) {
              hasTerminal = true;
              break;
            }
          }
        }

        const hasReturn = /\breturn\b/.test(contentSlice);

        labelInfoForBlock.push({ label, startLine, endLine, hasTerminal, hasReturn });

        const nodeId = `${block.id}:${label}`;
        const node: LabelNode = {
            id: nodeId, label: label, blockId: block.id, containerName: block.title || block.filePath?.split('/').pop() || 'Untitled',
            startLine: startLine, position: { x: 0, y: 0 }, width: 180, height: 40,
        };
        labelNodes.set(nodeId, node);
    });
    blockLabelInfo.set(block.id, labelInfoForBlock);
  });

  let routeLinkIdCounter = 0;
  blocks.forEach(block => {
    if (block.filePath && (block.filePath.endsWith('debug_placeholders.rpy') || block.filePath === 'game/debug_placeholders.rpy')) return;

    const labelsInBlock = blockLabelInfo.get(block.id) || [];
    const jumpsInBlock = jumps[block.id] || [];

    jumpsInBlock.forEach(jump => {
        const sourceLabel = labelsInBlock.slice().reverse().find(l => l.startLine <= jump.line);
        if (!sourceLabel) return;
        if (jump.isDynamic && !labels[jump.target]) return;

        const targetLabelDef = labels[jump.target];
        if (targetLabelDef && targetLabelDef.type !== 'menu') {
            const sourceNodeId = `${block.id}:${sourceLabel.label}`;
            const targetNodeId = `${targetLabelDef.blockId}:${targetLabelDef.label}`;
            routeLinks.push({ id: `rlink-${routeLinkIdCounter++}`, sourceId: sourceNodeId, targetId: targetNodeId, type: jump.type, choiceText: jump.choiceText, choiceCondition: jump.choiceCondition, sourceLine: jump.line, menuLine: jump.menuLine });
        }
    });

    for (let i = 0; i < labelsInBlock.length - 1; i++) {
        const current = labelsInBlock[i];
        const next = labelsInBlock[i + 1];
        if (!current.hasTerminal) {
            const sourceNodeId = `${block.id}:${current.label}`;
            const targetNodeId = `${block.id}:${next.label}`;
            routeLinks.push({ id: `rlink-${routeLinkIdCounter++}`, sourceId: sourceNodeId, targetId: targetNodeId, type: 'implicit' });
        }
    }
  });

  // Build route graph using graphology for degree queries (start/end node detection)
  const { startNodes, endNodes } = buildRouteGraph(labelNodes, routeLinks, labels, blockLabelInfo);

  // Keep a link-level adjacency map for findPaths (needs per-link linkId granularity)
  const adj = new Map<string, { targetId: string; linkId: string }[]>();
  labelNodes.forEach(node => adj.set(node.id, []));
  routeLinks.forEach(link => {
    adj.get(link.sourceId)?.push({ targetId: link.targetId, linkId: link.id });
  });
  
  const uniqueLabelPaths = new Map<string, string[]>();

  function findPaths(currentNodeId: string, currentLinks: string[], currentNodes: string[], visited: Set<string>, depth: number) {
    if (uniqueLabelPaths.size >= MAX_ROUTES || depth > MAX_ROUTE_DEPTH) {
      routesTruncated = true;
      return;
    }
    currentNodes.push(currentNodeId);
    if (visited.has(currentNodeId)) { currentNodes.pop(); return; }
    visited.add(currentNodeId);

    const isEndpoint = endNodes.has(currentNodeId);
    const neighbors = adj.get(currentNodeId) || [];

    if (isEndpoint || neighbors.length === 0) {
        if (currentLinks.length > 0) {
            const pathKey = currentNodes.join('->');
            if (!uniqueLabelPaths.has(pathKey)) uniqueLabelPaths.set(pathKey, [...currentLinks]);
        }
    } else {
      for (const { targetId, linkId } of neighbors) {
          if (uniqueLabelPaths.size >= MAX_ROUTES) { routesTruncated = true; break; }
          currentLinks.push(linkId);
          findPaths(targetId, currentLinks, currentNodes, visited, depth + 1);
          currentLinks.pop();
      }
    }
    visited.delete(currentNodeId);
    currentNodes.pop();
  }

  startNodes.forEach(startNode => {
    if (uniqueLabelPaths.size >= MAX_ROUTES) { routesTruncated = true; return; }
    findPaths(startNode, [], [], new Set(), 0);
  });
  
  const allPaths = Array.from(uniqueLabelPaths.values());
  identifiedRoutes.push(...allPaths.filter(path => path.length > 0).map((path, index) => ({
      id: index, color: PALETTE[index % PALETTE.length], linkIds: new Set(path),
  })));

  const nodesArray = Array.from(labelNodes.values());
  const laidOut = computeLayeredLayoutGeneric(nodesArray, routeLinks, 'lr', ROUTE_INITIAL_CONFIG);
  const posMap = new Map(laidOut.map(n => [n.id, n.position]));
  nodesArray.forEach(n => { const pos = posMap.get(n.id); if (pos) n.position = pos; });

  return { labelNodes: nodesArray, routeLinks, identifiedRoutes, routesTruncated };
}

/** Empty result returned on first render before the worker responds. */
export const EMPTY_ANALYSIS_RESULT: RenpyAnalysisResult = {
  links: [],
  invalidJumps: {},
  firstLabels: {},
  labels: {},
  jumps: {},
  rootBlockIds: new Set(),
  leafBlockIds: new Set(),
  branchingBlockIds: new Set(),
  screenOnlyBlockIds: new Set(),
  storyBlockIds: new Set(),
  configBlockIds: new Set(),
  characters: new Map(),
  dialogueLines: new Map(),
  characterUsage: new Map(),
  variables: new Map(),
  variableUsages: new Map(),
  screens: new Map(),
  definedImages: new Set(),
  blockTypes: new Map(),
  labelNodes: [],
  routeLinks: [],
  identifiedRoutes: [],
  routesTruncated: false,
  translationData: {
    translatableStrings: [],
    translatedStrings: new Map(),
    languageCoverages: [],
    detectedLanguages: [],
    stringTranslations: new Map(),
  },
};

/** Module-level worker singleton — created once, reused across re-renders. */
let _analysisWorker: Worker | null = null;

const getAnalysisWorker = (): Worker | null => {
  if (typeof Worker === 'undefined') return null;
  if (!_analysisWorker) {
    try {
      _analysisWorker = new Worker(
        new URL('../workers/renpyAnalysis.worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch (err) {
      logger.warn('Failed to create analysis worker; falling back to synchronous analysis', err);
      return null;
    }
  }
  return _analysisWorker;
};

/** Progress info reported by the analysis worker between phases. */
export interface AnalysisProgress {
  phase: string;
  percent: number;
}

/**
 * Hook that runs Ren'Py analysis asynchronously via a Web Worker.
 * Returns `[result, isPending, progress]` — `isPending` is true while the worker
 * is computing; `progress` carries the latest phase/percent reported by the worker.
 * Falls back to synchronous analysis if Web Workers are unavailable (e.g. test env).
 */
export const useRenpyAnalysis = (blocks: AnalysisBlock[], trigger: number, onComplete?: (ms: number) => void): [RenpyAnalysisResult, boolean, AnalysisProgress | null] => {
  const [result, setResult] = useState<RenpyAnalysisResult>(EMPTY_ANALYSIS_RESULT);
  const [isPending, setIsPending] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const requestIdRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const currentId = ++requestIdRef.current;
    setIsPending(true);
    setProgress(null);

    const worker = getAnalysisWorker();

    if (!worker) {
      // Synchronous fallback — test environment or Worker unavailable
      const r = performRenpyAnalysis(blocks);
      const routeData = performRouteAnalysis(blocks, r.labels, r.jumps);
      r.labelNodes = routeData.labelNodes;
      r.routeLinks = routeData.routeLinks;
      r.identifiedRoutes = routeData.identifiedRoutes;
      r.routesTruncated = routeData.routesTruncated;
      setResult(r);
      setIsPending(false);
      return;
    }

    const startTime = performance.now();

    const handleMessage = (e: MessageEvent) => {
      if (e.data.id !== currentId) return; // stale — a newer request superseded this one

      // Handle intermediate progress messages (no result field)
      if (e.data.type === 'progress') {
        setProgress({ phase: e.data.phase, percent: e.data.percent });
        return;
      }

      worker.removeEventListener('message', handleMessage);
      if (!e.data.error) {
        setResult(e.data.result);
        onCompleteRef.current?.(performance.now() - startTime);
      }
      setProgress(null);
      setIsPending(false);
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ id: currentId, blocks });

    return () => {
      worker.removeEventListener('message', handleMessage);
      // Worker keeps running but its response will be ignored (stale id)
    };
  }, [blocks, trigger]);

  return [result, isPending, progress];
};
