import type { Block, LabelLocation } from '../types';

/**
 * Resolves a Ren'Py label to the `--warp` target format Ren'Py expects.
 * The project stores file paths under `game/`, while `--warp` wants a path
 * relative to the game directory, so we strip that prefix and normalize slashes.
 */
export function resolveWarpTarget(
  blocks: Block[],
  labels: Record<string, LabelLocation>,
  labelName: string,
): string | null {
  const labelLocation = labels[labelName];
  if (!labelLocation) return null;

  const block = blocks.find(candidate => candidate.id === labelLocation.blockId);
  if (!block?.filePath) return null;

  const relativePath = block.filePath
    .replace(/\\/g, '/')
    .replace(/^game\/+/, '');

  if (!relativePath) return null;

  return `${relativePath}:${labelLocation.line}`;
}

/**
 * Finds the label defined on a given block line, if any.
 */
export function getLabelAtLine(
  labels: Record<string, LabelLocation>,
  blockId: string,
  line: number,
): LabelLocation | null {
  return Object.values(labels).find(label => label.blockId === blockId && label.line === line) ?? null;
}
