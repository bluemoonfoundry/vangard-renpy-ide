import type { DiagnosticIssue, IgnoredDiagnosticRule } from '../types';

export function createIgnoredDiagnosticRule(issue: DiagnosticIssue): IgnoredDiagnosticRule {
  return {
    category: issue.category,
    filePath: issue.filePath,
    blockId: issue.filePath ? undefined : issue.blockId,
    line: issue.line,
    message: issue.message,
  };
}

export function matchesIgnoredDiagnostic(issue: DiagnosticIssue, rule: IgnoredDiagnosticRule): boolean {
  return issue.category === rule.category &&
    issue.filePath === rule.filePath &&
    (issue.filePath ? true : issue.blockId === rule.blockId) &&
    issue.line === rule.line &&
    issue.message === rule.message;
}
