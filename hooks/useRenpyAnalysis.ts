import { useMemo } from 'react';
import type { Block, Link, RenpyAnalysisResult, LabelLocation, JumpLocation, Character, DialogueLine, Variable, VariableUsage, RenpyScreen, LabelNode, RouteLink, IdentifiedRoute } from '../types';

const LABEL_REGEX = /^\s*label\s+([a-zA-Z0-9_]+):/;
const JUMP_CALL_REGEX = /\b(jump|call)\s+([a-zA-Z0-9_]+)/g;
const MENU_REGEX = /^\s*menu:/;
const DIALOGUE_REGEX = /^\s*([a-zA-Z0-9_]+)\s+"/;
const NARRATION_REGEX = /^\s*"(?!:)/; // Matches "narration" but not "choice": or e "dialogue"
const SCREEN_REGEX = /^\s*screen\s+([a-zA-Z0-9_]+)\s*(\(.*\))?:/;
// This regex now uses a negative lookahead `(?!Character\s*\()` to specifically exclude lines that are Character definitions.
const DEFINE_DEFAULT_REGEX = /^\s*(define|default)\s+([a-zA-Z0-9_.]+)\s*=\s*(?!Character\s*\()(.+)/;


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

// Helper to remove quotes from a string value
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

export const performRenpyAnalysis = (blocks: Block[]): RenpyAnalysisResult => {
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
    blockTypes: new Map(),
    labelNodes: new Map(),
    routeLinks: [],
    identifiedRoutes: [],
  };

  const blockLabelInfo = new Map<string, { label: string; startLine: number; endLine: number; hasTerminal: boolean; hasReturn: boolean; }[]>();

  // First pass: find all labels, characters, and variable definitions
  blocks.forEach(block => {
    // Find Characters first from the whole content to support multiline definitions
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
            tag,
            name,
            color: color || stringToColor(tag),
            profile,
            definedInBlockId: block.id,
            image: unquote(kwargs.image),
            who_style: unquote(kwargs.who_style),
            who_prefix: unquote(kwargs.who_prefix),
            who_suffix: unquote(kwargs.who_suffix),
            what_color: unquote(kwargs.what_color),
            what_style: unquote(kwargs.what_style),
            what_prefix: unquote(kwargs.what_prefix),
            what_suffix: unquote(kwargs.what_suffix),
            slow: kwargs.slow === 'True' ? true : kwargs.slow === 'False' ? false : undefined,
            slow_speed: kwargs.slow_speed ? parseInt(kwargs.slow_speed, 10) : undefined,
            slow_abortable: kwargs.slow_abortable === 'True' ? true : kwargs.slow_abortable === 'False' ? false : undefined,
            all_at_once: kwargs.all_at_once === 'True' ? true : kwargs.all_at_once === 'False' ? false : undefined,
            window_style: unquote(kwargs.window_style),
            ctc: unquote(kwargs.ctc),
            ctc_position: unquote(kwargs.ctc_position) as 'nestled' | 'fixed' | undefined,
            interact: kwargs.interact === 'True' ? true : kwargs.interact === 'False' ? false : undefined,
            afm: kwargs.afm === 'True' ? true : kwargs.afm === 'False' ? false : undefined,
            what_properties: kwargs.what_properties,
            window_properties: kwargs.window_properties,
        };
        result.characters.set(character.tag, character);
    }
    
    // Then process line-by-line for labels and variables
    let isFirstLabelInBlock = true;
    const lines = block.content.split('\n');
    lines.forEach((line, index) => {
      // Find Labels
      const labelMatch = line.match(LABEL_REGEX);
      if (labelMatch && labelMatch[1]) {
        const labelName = labelMatch[1];
        const labelLocation: LabelLocation = {
          blockId: block.id,
          label: labelName,
          line: index + 1,
          column: labelMatch[0].indexOf(labelName) + 1,
        };
        result.labels[labelName] = labelLocation;
        
        if (isFirstLabelInBlock) {
          result.firstLabels[block.id] = labelName;
          isFirstLabelInBlock = false;
        }
      }

      // Find Screens
      const screenMatch = line.match(SCREEN_REGEX);
      if (screenMatch) {
          const screen: RenpyScreen = {
              name: screenMatch[1],
              parameters: screenMatch[2] ? screenMatch[2].trim() : '',
              definedInBlockId: block.id,
              line: index + 1,
          };
          result.screens.set(screen.name, screen);
      }
      
      // Find Variables (which now correctly ignores Character definitions)
      const varMatch = line.match(DEFINE_DEFAULT_REGEX);
      if (varMatch) {
        const variable: Variable = {
          type: varMatch[1] as 'define' | 'default',
          name: varMatch[2],
          initialValue: varMatch[3].trim(),
          definedInBlockId: block.id,
          line: index + 1,
        };
        result.variables.set(variable.name, variable);
      }
    });
  });

  // Filter out variables that are character definitions
  result.characters.forEach((char) => {
    if (result.variables.has(char.tag)) {
      result.variables.delete(char.tag);
    }
  });

  // Second pass: find jumps, dialogue, and variable usages
  const variableNames = Array.from(result.variables.keys());
  blocks.forEach(block => {
    result.jumps[block.id] = [];
    const blockTypes = new Set<string>();
    if (block.content.includes('python:')) {
        blockTypes.add('python');
    }

    const lines = block.content.split('\n');
    lines.forEach((line, index) => {
      // Find Jumps/Calls
      for (const match of line.matchAll(JUMP_CALL_REGEX)) {
        blockTypes.add('jump');
        const jumpType = match[1] as 'jump' | 'call';
        const targetLabel = match[2];
        if (!targetLabel || match.index === undefined) continue;

        const jumpLocation: JumpLocation = {
          blockId: block.id,
          target: targetLabel,
          type: jumpType,
          line: index + 1,
          columnStart: match.index + match[1].length + 2,
          columnEnd: match.index + match[1].length + 2 + targetLabel.length,
        };
        result.jumps[block.id].push(jumpLocation);

        const targetLabelLocation = result.labels[targetLabel];

        if (targetLabelLocation) {
          if (block.id !== targetLabelLocation.blockId) {
            if (!result.links.some(l => l.sourceId === block.id && l.targetId === targetLabelLocation.blockId)) {
              result.links.push({
                sourceId: block.id,
                targetId: targetLabelLocation.blockId,
                targetLabel: targetLabel,
              });
            }
          }
        } else {
          if (!result.invalidJumps[block.id]) result.invalidJumps[block.id] = [];
          if (!result.invalidJumps[block.id].includes(targetLabel)) {
            result.invalidJumps[block.id].push(targetLabel);
          }
        }
      }
      
      // Find Labels (for blockTypes)
      if (LABEL_REGEX.test(line)) {
        blockTypes.add('label');
      }

      // Find Menus (for blockTypes)
      if (MENU_REGEX.test(line)) {
        blockTypes.add('menu');
      }

      // Find Dialogue & Narration
      const dialogueMatch = line.match(DIALOGUE_REGEX);
      if (dialogueMatch && result.characters.has(dialogueMatch[1])) {
        blockTypes.add('dialogue');
        const tag = dialogueMatch[1];
        if (!result.dialogueLines.has(block.id)) {
          result.dialogueLines.set(block.id, []);
        }
        result.dialogueLines.get(block.id)!.push({ line: index + 1, tag });
      } else if (NARRATION_REGEX.test(line)) {
        // It's narration, just mark the block type, don't add to character analysis
        blockTypes.add('dialogue');
      }

      // Find Variable Usages
      variableNames.forEach(varName => {
        const usageRegex = new RegExp(`\\b${varName.replace('.', '\\.')}\\b`);
        if (usageRegex.test(line)) {
          const defOnThisLine = result.variables.get(varName)?.definedInBlockId === block.id && result.variables.get(varName)?.line === index + 1;
          
          if (!defOnThisLine) {
              if (!result.variableUsages.has(varName)) {
                  result.variableUsages.set(varName, []);
              }
              const usages = result.variableUsages.get(varName)!;
              if (!usages.some(u => u.blockId === block.id && u.line === index + 1)) {
                   usages.push({ blockId: block.id, line: index + 1 });
              }
          }
        }
      });
    });

    if (blockTypes.size > 0) {
      result.blockTypes.set(block.id, blockTypes);
    }
  });

  // Third pass: Calculate character usage
  result.characters.forEach(char => {
    result.characterUsage.set(char.tag, 0); // Initialize all defined chars with 0
  });
  result.dialogueLines.forEach((lines) => {
    lines.forEach(dialogue => {
      const currentCount = result.characterUsage.get(dialogue.tag) || 0;
      result.characterUsage.set(dialogue.tag, currentCount + 1);
    });
  });

  // Fourth pass: Classify blocks
  const allTargetIds = new Set(result.links.map(link => link.targetId));

  blocks.forEach(block => {
    const blockJumps = result.jumps[block.id] || [];
    const hasMenu = block.content.split('\n').some(line => MENU_REGEX.test(line));

    if (!allTargetIds.has(block.id)) {
      result.rootBlockIds.add(block.id);
    }
    if (blockJumps.length === 0) {
      result.leafBlockIds.add(block.id);
    }
    const distinctTargets = new Set(blockJumps.map(j => (result.labels[j.target] || {}).blockId).filter(Boolean));
    if (hasMenu || distinctTargets.size > 1) {
      result.branchingBlockIds.add(block.id);
    }
  });

  // Fifth pass: Generate data for Route Canvas
  // 1. Identify all labels and their line ranges to create nodes.
  blocks.forEach(block => {
    const lines = block.content.split('\n');
    const labelsInBlock: { label: string; startLine: number }[] = [];
    Object.values(result.labels).forEach(labelLoc => {
        if (labelLoc.blockId === block.id) {
            labelsInBlock.push({ label: labelLoc.label, startLine: labelLoc.line });
        }
    });
    labelsInBlock.sort((a, b) => a.startLine - b.startLine);

    const labelInfoForBlock: { label: string; startLine: number; endLine: number; hasTerminal: boolean; hasReturn: boolean; }[] = [];
    labelsInBlock.forEach(({ label, startLine }, i) => {
        const endLine = (i + 1 < labelsInBlock.length) ? labelsInBlock[i + 1].startLine - 1 : lines.length;
        const contentSlice = lines.slice(startLine, endLine).join('\n');
        const hasTerminal = /\b(jump|call|return)\b/.test(contentSlice);
        const hasReturn = /\breturn\b/.test(contentSlice);

        labelInfoForBlock.push({ label, startLine, endLine, hasTerminal, hasReturn });

        const nodeId = `${block.id}:${label}`;
        
        const node: LabelNode = {
            id: nodeId,
            label: label,
            blockId: block.id,
            startLine: startLine,
            position: { x: 0, y: 0 },
            width: 180,
            height: 40
        };
        result.labelNodes.set(nodeId, node);
    });
    blockLabelInfo.set(block.id, labelInfoForBlock);
  });

  // 2. Create links based on jumps and implicit flow.
  let routeLinkIdCounter = 0;
  blocks.forEach(block => {
    const labelsInBlock = blockLabelInfo.get(block.id) || [];
    const jumpsInBlock = result.jumps[block.id] || [];

    // Explicit jumps/calls
    jumpsInBlock.forEach(jump => {
        const sourceLabel = labelsInBlock.slice().reverse().find(l => l.startLine <= jump.line);
        if (!sourceLabel) return;

        const targetLabelDef = result.labels[jump.target];
        if (targetLabelDef) {
            const sourceNodeId = `${block.id}:${sourceLabel.label}`;
            const targetNodeId = `${targetLabelDef.blockId}:${targetLabelDef.label}`;
            result.routeLinks.push({
                id: `rlink-${routeLinkIdCounter++}`,
                sourceId: sourceNodeId,
                targetId: targetNodeId,
                type: jump.type,
            });
        }
    });

    // Implicit fall-through links
    for (let i = 0; i < labelsInBlock.length - 1; i++) {
        const current = labelsInBlock[i];
        const next = labelsInBlock[i + 1];
        if (!current.hasTerminal) {
            const sourceNodeId = `${block.id}:${current.label}`;
            const targetNodeId = `${block.id}:${next.label}`;
            result.routeLinks.push({
                id: `rlink-${routeLinkIdCounter++}`,
                sourceId: sourceNodeId,
                targetId: targetNodeId,
                type: 'implicit'
            });
        }
    }
  });

  // Sixth pass: Identify all unique routes with improved algorithm
  const adj = new Map<string, { targetId: string; linkId: string }[]>();
  const reverseAdj = new Map<string, string[]>();
  result.labelNodes.forEach(node => {
    adj.set(node.id, []);
    reverseAdj.set(node.id, []);
  });

  result.routeLinks.forEach(link => {
    adj.get(link.sourceId)?.push({ targetId: link.targetId, linkId: link.id });
    reverseAdj.get(link.targetId)?.push(link.sourceId);
  });
  
  // 1. Identify Start Nodes: Prioritize the 'start' label.
  let startNodes: string[] = [];
  const startLabelLocation = result.labels['start'];
  if (startLabelLocation) {
      const startNodeId = `${startLabelLocation.blockId}:start`;
      if (result.labelNodes.has(startNodeId)) {
          startNodes.push(startNodeId);
      }
  }
  // Fallback if 'start' label doesn't exist.
  if (startNodes.length === 0) {
      startNodes = Array.from(result.labelNodes.keys()).filter(nodeId => (reverseAdj.get(nodeId) || []).length === 0);
  }

  // 2. Identify End Nodes: A route ends on 'return' or if it's a leaf node.
  const endNodes = new Set<string>();
  blockLabelInfo.forEach((labels, blockId) => {
    labels.forEach(labelInfo => {
      const nodeId = `${blockId}:${labelInfo.label}`;
      const isLeafNode = (adj.get(nodeId) || []).length === 0;
      // A route ends if it's a leaf OR if it contains 'return' but has no other outgoing connections
      if (isLeafNode || (labelInfo.hasReturn && !labelInfo.hasTerminal)) {
        endNodes.add(nodeId);
      }
    });
  });
  
  const uniqueLabelPaths = new Map<string, string[]>(); // Key: 'node1->node2', Value: [linkId1, linkId2]

  function findPaths(currentNodeId: string, currentLinks: string[], currentNodes: string[], visited: Set<string>) {
    currentNodes.push(currentNodeId);

    // Cycle detection
    if (visited.has(currentNodeId)) {
      currentNodes.pop(); // backtrack
      return;
    }
    visited.add(currentNodeId);

    const isEndpoint = endNodes.has(currentNodeId);
    const neighbors = adj.get(currentNodeId) || [];

    if (isEndpoint || neighbors.length === 0) {
        if (currentLinks.length > 0) {
            const pathKey = currentNodes.join('->');
            if (!uniqueLabelPaths.has(pathKey)) {
                uniqueLabelPaths.set(pathKey, [...currentLinks]);
            }
        }
    } else {
      for (const { targetId, linkId } of neighbors) {
          currentLinks.push(linkId);
          findPaths(targetId, currentLinks, currentNodes, visited);
          currentLinks.pop(); // backtrack link
      }
    }
    
    visited.delete(currentNodeId);
    currentNodes.pop(); // backtrack node
  }

  startNodes.forEach(startNode => {
    findPaths(startNode, [], [], new Set());
  });
  
  const allPaths = Array.from(uniqueLabelPaths.values());
  
  result.identifiedRoutes = allPaths
    .filter(path => path.length > 0)
    .map((path, index) => ({
      id: index,
      color: PALETTE[index % PALETTE.length],
      linkIds: new Set(path),
    }));


  // Final pass: Identify screen-only, story, and config blocks
  const screenDefiningBlockIds = new Set(Array.from(result.screens.values()).map(s => s.definedInBlockId));
  const labelDefiningBlockIds = new Set(Object.values(result.labels).map(l => l.blockId));
  
  const storyBlockIds = new Set(labelDefiningBlockIds);
  // Explicitly mark dedicated files as story blocks so they don't get filtered as config
  const specialStoryFileNames = ['game/variables.rpy', 'game/characters.rpy'];
  blocks.forEach(block => {
      if (block.filePath && specialStoryFileNames.includes(block.filePath)) {
          storyBlockIds.add(block.id);
      }
  });

  result.storyBlockIds = storyBlockIds;
  result.screenOnlyBlockIds = new Set([...screenDefiningBlockIds].filter(id => !storyBlockIds.has(id)));

  const configBlockIds = new Set<string>();
  blocks.forEach(block => {
    if (!result.storyBlockIds.has(block.id) && !screenDefiningBlockIds.has(block.id)) {
        configBlockIds.add(block.id);
    }
  });
  result.configBlockIds = configBlockIds;

  return result;
};


export const useRenpyAnalysis = (blocks: Block[], trigger: number): RenpyAnalysisResult => {
  const analysisResult = useMemo(() => performRenpyAnalysis(blocks), [blocks, trigger]);
  return analysisResult;
};