import { getTripleQuotedLineMask } from './renpyTripleQuotes';

export interface RenpyLabelGuardScope {
  targetLabel: string;
  startLine: number;
  endLine: number;
  indent: number;
}

const HAS_LABEL_GUARD_RE = /^\s*if\s+renpy\.has_label\(\s*(["'])([A-Za-z0-9_]+)\1\s*\)\s*:\s*$/;

function indentOf(line: string): number {
  return line.match(/^(\s*)/)?.[1].length ?? 0;
}

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
