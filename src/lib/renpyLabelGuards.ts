import { getTripleQuotedLineMask } from './renpyTripleQuotes';

export interface RenpyLabelGuardScope {
  targetLabel: string;
  startLine: number;
  endLine: number;
  indent: number;
}

const HAS_LABEL_GUARD_RE = /^\s*if\s+renpy\.has_label\(\s*(["'])([A-Za-z0-9_]+)\1\s*\)\s*:\s*$/;

/**
 * Computes the indentation level of a line in spaces.
 *
 * @param line - A line of code
 * @returns Number of leading whitespace characters
 *
 * @complexity O(n) time where n = indentation depth (early-exit on first non-space)
 */
function indentOf(line: string): number {
  return line.match(/^(\s*)/)?.[1].length ?? 0;
}

/**
 * Collects all `renpy.has_label()` guard scopes in Ren'Py code.
 *
 * Scans code for conditional blocks like:
 * ```python
 * if renpy.has_label("optional_scene"):
 *     jump optional_scene
 * ```
 *
 * These guards protect jumps to optional labels that may not exist in all builds.
 * The algorithm uses an indent-based scope stack:
 * 1. When a `has_label` guard is found, push it to the stack
 * 2. When indent decreases, pop scopes from the stack and record their end lines
 * 3. After scanning, any remaining scopes extend to end-of-file
 *
 * Triple-quoted strings are masked to avoid false positives from example code.
 *
 * @param content - Multi-line Ren'Py code
 * @returns Array of guard scopes with target label, start/end lines, and indent level
 *
 * @example
 * ```typescript
 * const code = `
 * if renpy.has_label("ending_a"):
 *     jump ending_a
 * label main:
 *     return
 * `;
 * const guards = collectRenpyHasLabelGuards(code);
 * // [{ targetLabel: 'ending_a', startLine: 2, endLine: 3, indent: 0 }]
 * ```
 *
 * @complexity O(n) time where n = number of lines, O(d) space where d = max indent depth
 */
export function collectRenpyHasLabelGuards(content: string): RenpyLabelGuardScope[] {
  const lines = content.split('\n');
  const tripleQuotedLineMask = getTripleQuotedLineMask(content);
  const scopes: RenpyLabelGuardScope[] = [];
  const stack: Array<{ targetLabel: string; startLine: number; indent: number }> = [];

  lines.forEach((line, index) => {
    if (tripleQuotedLineMask[index]) return;

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const indent = indentOf(line);

    while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
      const scope = stack.pop()!;
      scopes.push({
        targetLabel: scope.targetLabel,
        startLine: scope.startLine,
        endLine: index,
        indent: scope.indent,
      });
    }

    const guardMatch = line.match(HAS_LABEL_GUARD_RE);
    if (guardMatch) {
      stack.push({
        targetLabel: guardMatch[2],
        startLine: index + 1,
        indent,
      });
    }
  });

  while (stack.length > 0) {
    const scope = stack.pop()!;
    scopes.push({
      targetLabel: scope.targetLabel,
      startLine: scope.startLine,
      endLine: lines.length,
      indent: scope.indent,
    });
  }

  return scopes;
}

/**
 * Checks if a jump statement is protected by a `renpy.has_label()` guard.
 *
 * Queries whether a given line number is within any guard scope that matches the
 * target label. Used to suppress diagnostics for jumps to optional labels.
 *
 * @param guards - Array of guard scopes from `collectRenpyHasLabelGuards()`
 * @param lineNumber - 1-indexed line number of the jump statement
 * @param targetLabel - Label name being jumped to
 * @returns True if the jump is within a matching guard scope
 *
 * @example
 * ```typescript
 * const guards = collectRenpyHasLabelGuards(code);
 * const isGuarded = isJumpGuardedByHasLabel(guards, 5, 'ending_a');
 * ```
 *
 * @complexity O(g) time where g = number of guard scopes, O(1) space
 */
export function isJumpGuardedByHasLabel(
  guards: RenpyLabelGuardScope[],
  lineNumber: number,
  targetLabel: string,
): boolean {
  return guards.some(
    guard =>
      guard.targetLabel === targetLabel &&
      lineNumber > guard.startLine &&
      lineNumber <= guard.endLine,
  );
}
