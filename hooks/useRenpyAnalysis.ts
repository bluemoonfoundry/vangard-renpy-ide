import { useMemo } from 'react';
import type { Block, Link, RenpyAnalysisResult, LabelLocation, JumpLocation, Character, DialogueLine, Variable, VariableUsage } from '../types';

const LABEL_REGEX = /^\s*label\s+([a-zA-Z0-9_]+):/;
const JUMP_CALL_REGEX = /\b(jump|call)\s+([a-zA-Z0-9_]+)/g;
const MENU_REGEX = /^\s*menu:/;
const COLOR_REGEX = /color\s*=\s*['"](#?[a-zA-Z0-9]+)['"]/;
const DIALOGUE_REGEX = /^\s*([a-zA-Z0-9_]+)\s+"/;
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
    characters: new Map(),
    dialogueLines: new Map(),
    characterUsage: new Map(),
    variables: new Map(),
    variableUsages: new Map(),
  };

  // First pass: find all labels, characters, and variable definitions
  blocks.forEach(block => {
    // Find Characters first from the whole content to support multiline definitions
    const CHARACTER_REGEX_G = /^\s*define\s+([a-zA-Z0-9_]+)\s*=\s*Character\s*\(\s*['"](.+?)['"]([\s\S]*?)\)/gm;
    for (const match of block.content.matchAll(CHARACTER_REGEX_G)) {
      const args = match[3];
      const colorMatch = args.match(COLOR_REGEX);
      const character: Character = {
        tag: match[1],
        name: match[2],
        color: colorMatch ? colorMatch[1] : stringToColor(match[1]),
        definedInBlockId: block.id,
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

  // Second pass: find jumps, dialogue, and variable usages
  const variableNames = Array.from(result.variables.keys());
  blocks.forEach(block => {
    result.jumps[block.id] = [];
    const lines = block.content.split('\n');
    lines.forEach((line, index) => {
      // Find Jumps/Calls
      for (const match of line.matchAll(JUMP_CALL_REGEX)) {
        const targetLabel = match[2];
        if (!targetLabel || match.index === undefined) continue;

        const jumpLocation: JumpLocation = {
          blockId: block.id,
          target: targetLabel,
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
      
      // Find Dialogue
      const dialogueMatch = line.match(DIALOGUE_REGEX);
      if (dialogueMatch && result.characters.has(dialogueMatch[1])) {
        const tag = dialogueMatch[1];
        if (!result.dialogueLines.has(block.id)) {
          result.dialogueLines.set(block.id, []);
        }
        result.dialogueLines.get(block.id)!.push({ line: index + 1, tag });
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

  return result;
};


export const useRenpyAnalysis = (blocks: Block[], trigger: number): RenpyAnalysisResult => {
  const analysisResult = useMemo(() => performRenpyAnalysis(blocks), [blocks, trigger]);
  return analysisResult;
};