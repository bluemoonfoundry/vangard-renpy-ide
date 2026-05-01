import { useMemo } from 'react';
import type {
  Block,
  RenpyAnalysisResult,
  ProjectImage,
  RenpyAudio,
  ImageMetadata,
  AudioMetadata,
  DiagnosticIssue,
  DiagnosticsResult,
  DiagnosticsTask,
  IgnoredDiagnosticRule,
  PunchlistMetadata,
} from '@/types';
import { validateRenpyCode } from '@/lib/renpyValidator';
import { matchesIgnoredDiagnostic } from '@/lib/diagnosticIgnores';

// ---------------------------------------------------------------------------
// Ren'Py statement keywords — these should not be treated as character names
// ---------------------------------------------------------------------------
const STATEMENT_KEYWORDS = new Set([
  'show', 'hide', 'scene', 'play', 'queue', 'stop', 'pause', 'with', 'window',
  'define', 'default', 'init', 'label', 'jump', 'call', 'return', 'if', 'elif',
  'else', 'for', 'while', 'pass', 'menu', 'image', 'transform', 'style', 'screen',
  'python', 'translate', 'nvl', 'voice', 'renpy', 'config', 'gui', 'at', 'as',
  'behind', 'onlayer', 'zorder', 'expression', 'extend', 'camera',
]);

// Regex for character dialogue lines: indented <tag> "<text>"
const RE_CHAR_DIALOGUE = /^\s+([a-zA-Z_]\w*)\s+"/;
// Regex for show/scene statement + screen reference
const RE_SCREEN_REF = /^\s*(?:call|show|hide)\s+screen\s+([a-zA-Z_]\w*)/;

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useDiagnostics(
  blocks: Block[],
  analysisResult: RenpyAnalysisResult,
  projectImages: Map<string, ProjectImage>,
  imageMetadata: Map<string, ImageMetadata>,
  projectAudios: Map<string, RenpyAudio>,
  _audioMetadata: Map<string, AudioMetadata>,
  ignoredDiagnostics: IgnoredDiagnosticRule[] = [],
): DiagnosticsResult {
  // Build image and audio lookup sets (same logic as PunchlistManager)
  const existingImageTags = useMemo(() => {
    const tags = new Set<string>();
    analysisResult.definedImages.forEach(t => tags.add(t));
    projectImages.forEach(img => {
      const meta = imageMetadata.get(img.projectFilePath || img.filePath);
      const name = meta?.renpyName || img.fileName.split('.').slice(0, -1).join('.');
      const t = (meta?.tags || []).join(' ');
      const fullTag = `${name} ${t}`.trim().replace(/\s+/g, ' ');
      tags.add(fullTag);
      tags.add(name);
    });
    return tags;
  }, [analysisResult.definedImages, projectImages, imageMetadata]);

  const existingAudioPaths = useMemo(() => {
    const paths = new Set<string>();
    projectAudios.forEach(aud => {
      paths.add(aud.fileName);
      if (aud.projectFilePath) paths.add(aud.projectFilePath.replace(/\\/g, '/'));
      if (aud.filePath) paths.add(aud.filePath.replace(/\\/g, '/'));
      paths.add(aud.fileName.split('.').slice(0, -1).join('.'));
    });
    return paths;
  }, [projectAudios]);

  return useMemo(() => {
    const issues: DiagnosticIssue[] = [];

    // -----------------------------------------------------------------------
    // Source 1: Invalid jump/call targets
    // -----------------------------------------------------------------------
    for (const [blockId, targets] of Object.entries(analysisResult.invalidJumps)) {
      const block = blocks.find(b => b.id === blockId);
      for (const target of targets) {
        // Find line number from analysisResult.jumps
        const jump = analysisResult.jumps[blockId]?.find(j => j.target === target);
        issues.push({
          id: `invalid-jump:${blockId}:${target}`,
          severity: 'error',
          category: 'invalid-jump',
          message: `Undefined label "${target}"`,
          blockId,
          filePath: block?.filePath,
          line: jump?.line,
          column: jump?.columnStart,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Source 2: Syntax validation on ALL blocks
    // -----------------------------------------------------------------------
    for (const block of blocks) {
      if (!block.content) continue;
      const diags = validateRenpyCode(block.content);
      for (const d of diags) {
        issues.push({
          id: `syntax:${block.id}:${d.startLineNumber}:${d.startColumn}`,
          severity: d.severity,
          category: 'syntax',
          message: d.message,
          blockId: block.id,
          filePath: block.filePath,
          line: d.startLineNumber,
          column: d.startColumn,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Source 3 & 4: Missing images and audio (ported from PunchlistManager)
    // We track by asset name so each unique missing asset appears once
    // -----------------------------------------------------------------------
    const seenImages = new Set<string>();
    const seenAudio = new Set<string>();

    for (const block of blocks) {
      if (!block.content) continue;
      const lines = block.content.split('\n');
      lines.forEach((line, index) => {
        // Missing images
        const showMatch = line.match(/^\s*(?:show|scene)\s+([a-zA-Z0-9_ ]+)/);
        if (showMatch) {
          const rawTag = showMatch[1].trim();
          if (!['expression', 'layer', 'screen'].includes(rawTag.split(' ')[0])) {
            let isDefined = existingImageTags.has(rawTag);
            if (!isDefined) {
              const parts = rawTag.split(' ');
              for (let i = 1; i <= parts.length; i++) {
                if (existingImageTags.has(parts.slice(0, i).join(' '))) {
                  isDefined = true;
                  break;
                }
              }
            }
            if (!isDefined && !seenImages.has(rawTag)) {
              seenImages.add(rawTag);
              issues.push({
                id: `missing-image:${rawTag}`,
                severity: 'warning',
                category: 'missing-image',
                message: `Image "${rawTag}" not found in assets or definitions`,
                blockId: block.id,
                filePath: block.filePath,
                line: index + 1,
              });
            }
          }
        }

        // Missing audio
        const audioMatch = line.match(/^\s*(?:play|queue)\s+\w+\s+(.+)/);
        if (audioMatch) {
          const content = audioMatch[1].trim();
          const quotedMatch = content.match(/^["']([^"']+)["']/);
          let targetName = '';
          let isDefined = false;

          if (quotedMatch) {
            targetName = quotedMatch[1];
            for (const path of existingAudioPaths) {
              if (path.endsWith(targetName) || targetName.endsWith(path)) {
                isDefined = true;
                break;
              }
            }
          } else {
            const firstToken = content.split(/\s+/)[0];
            if (firstToken !== 'expression') {
              targetName = firstToken;
              if (existingAudioPaths.has(targetName) || analysisResult.variables.has(targetName)) {
                isDefined = true;
              }
            }
          }

          if (targetName && !isDefined && !seenAudio.has(targetName)) {
            seenAudio.add(targetName);
            issues.push({
              id: `missing-audio:${targetName}`,
              severity: 'warning',
              category: 'missing-audio',
              message: `Audio "${targetName}" not found in assets or variables`,
              blockId: block.id,
              filePath: block.filePath,
              line: index + 1,
            });
          }
        }
      });
    }

    // -----------------------------------------------------------------------
    // Source 5: Undefined characters in dialogue
    // -----------------------------------------------------------------------
    const seenUndefinedChars = new Set<string>();
    for (const block of blocks) {
      if (!block.content) continue;
      const lines = block.content.split('\n');
      lines.forEach((line, index) => {
        const m = RE_CHAR_DIALOGUE.exec(line);
        if (m) {
          const tag = m[1];
          if (!STATEMENT_KEYWORDS.has(tag) && !analysisResult.characters.has(tag) && !seenUndefinedChars.has(tag)) {
            seenUndefinedChars.add(tag);
            issues.push({
              id: `undefined-character:${tag}`,
              severity: 'warning',
              category: 'undefined-character',
              message: `Character "${tag}" used in dialogue but never defined`,
              blockId: block.id,
              filePath: block.filePath,
              line: index + 1,
            });
          }
        }
      });
    }

    // -----------------------------------------------------------------------
    // Source 6: Undefined screens
    // -----------------------------------------------------------------------
    const seenUndefinedScreens = new Set<string>();
    for (const block of blocks) {
      if (!block.content) continue;
      const lines = block.content.split('\n');
      lines.forEach((line, index) => {
        const m = RE_SCREEN_REF.exec(line);
        if (m) {
          const name = m[1];
          if (!analysisResult.screens.has(name) && !seenUndefinedScreens.has(name)) {
            seenUndefinedScreens.add(name);
            issues.push({
              id: `undefined-screen:${name}`,
              severity: 'warning',
              category: 'undefined-screen',
              message: `Screen "${name}" referenced but never defined`,
              blockId: block.id,
              filePath: block.filePath,
              line: index + 1,
            });
          }
        }
      });
    }

    // -----------------------------------------------------------------------
    // Source 7: Unused characters (defined but zero dialogue usage)
    // -----------------------------------------------------------------------
    analysisResult.characters.forEach((char) => {
      const count = analysisResult.characterUsage.get(char.tag) ?? 0;
      if (count === 0) {
        const block = blocks.find(b => b.id === char.definedInBlockId);
        issues.push({
          id: `unused-character:${char.tag}`,
          severity: 'info',
          category: 'unused-character',
          message: `Character "${char.tag}" (${char.name}) is defined but never used in dialogue`,
          blockId: char.definedInBlockId,
          filePath: block?.filePath,
        });
      }
    });

    // -----------------------------------------------------------------------
    // Source 9: Unused variables (defined but never referenced in code)
    // Limit to story blocks to avoid false positives on GUI/config variables
    // that Ren'Py may consume internally without explicit code references.
    // -----------------------------------------------------------------------
    analysisResult.variables.forEach((variable) => {
      if (!analysisResult.storyBlockIds.has(variable.definedInBlockId)) return;
      const usages = analysisResult.variableUsages.get(variable.name) ?? [];
      if (usages.length === 0) {
        const block = blocks.find(b => b.id === variable.definedInBlockId);
        issues.push({
          id: `unused-variable:${variable.name}`,
          severity: 'info',
          category: 'unused-variable',
          message: `Variable "${variable.name}" is defined but never referenced`,
          blockId: variable.definedInBlockId,
          filePath: block?.filePath,
          line: variable.line,
        });
      }
    });

    // -----------------------------------------------------------------------
    // Source 13: Implicit variable definitions
    // -----------------------------------------------------------------------
    const implicitVariables = Array.from(analysisResult.variables.values())
      .filter(v => v.type === 'implicit' && analysisResult.storyBlockIds.has(v.definedInBlockId));

    implicitVariables.forEach(variable => {
      const block = blocks.find(b => b.id === variable.definedInBlockId);
      if (block) {
        issues.push({
          id: `implicit-variable:${variable.definedInBlockId}:${variable.line}`,
          severity: 'info',
          category: 'implicit-variable',
          message: `[IMPLICIT_VAR] Variable '${variable.name}' uses implicit definition. Consider using 'default ${variable.name} = ...' for better compatibility.`,
          blockId: variable.definedInBlockId,
          filePath: block.filePath,
          line: variable.line
        });
      }
    });

    // -----------------------------------------------------------------------
    // Source 10: Pickle-unsafe default variables
    // Ren'Py save files use Python's pickle. Lambdas and instances of locally-
    // defined classes cannot be pickled reliably, so storing them in a
    // `default` variable will corrupt saves at runtime.
    // Only `default` is affected — `define` variables are not saved.
    // -----------------------------------------------------------------------
    const RE_CLASS_INSTANCE = /^[A-Z][a-zA-Z0-9_.]*\s*\(/;
    const SAFE_CAPITALS = new Set(['True', 'False', 'None']);
    analysisResult.variables.forEach((variable) => {
      if (variable.type !== 'default') return;
      const val = variable.initialValue.trim();
      const isLambda = /\blambda\b/.test(val);
      const capitalWord = val.split('(')[0].trim();
      const isClassInstance = RE_CLASS_INSTANCE.test(val) && !SAFE_CAPITALS.has(capitalWord);
      if (isLambda || isClassInstance) {
        const block = blocks.find(b => b.id === variable.definedInBlockId);
        issues.push({
          id: `pickle-unsafe:${variable.name}`,
          severity: 'warning',
          category: 'pickle-unsafe-variable',
          message: `"${variable.name}" stores a ${isLambda ? 'lambda' : 'class instance'} which may not be pickle-safe — save files could break`,
          blockId: variable.definedInBlockId,
          filePath: block?.filePath,
          line: variable.line,
        });
      }
    });

    // -----------------------------------------------------------------------
    // Source 11: Define variables mutated in script
    // `define` declares a constant evaluated once at startup and not saved.
    // Assigning to it at runtime (e.g. `$ x = 5`) is almost certainly a bug;
    // the developer likely meant `default`. Each mutation site is reported
    // separately so the user can navigate directly to it.
    // -----------------------------------------------------------------------
    const defineVarNames = new Set<string>();
    analysisResult.variables.forEach((variable) => {
      if (variable.type === 'define') defineVarNames.add(variable.name);
    });
    if (defineVarNames.size > 0) {
      // Matches inline Python assignment: `$ varname =` / `$ varname +=` etc.
      // The `=(?!=)` negative lookahead excludes `==` (equality comparisons).
      const RE_INLINE_ASSIGN = /^\s*\$\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:[+\-*/%]=|=(?!=))/;
      for (const block of blocks) {
        if (!block.content) continue;
        const lines = block.content.split('\n');
        lines.forEach((line, index) => {
          const m = RE_INLINE_ASSIGN.exec(line);
          if (m && defineVarNames.has(m[1])) {
            issues.push({
              id: `define-mutated:${m[1]}:${block.id}:${index + 1}`,
              severity: 'warning',
              category: 'define-mutated',
              message: `"${m[1]}" is declared with define (constant) but assigned in script — use default instead`,
              blockId: block.id,
              filePath: block.filePath,
              line: index + 1,
            });
          }
        });
      }
    }

    // -----------------------------------------------------------------------
    // Source 8: Unreachable labels
    // A label is unreachable if it is never the target of any jump/call and
    // it is not "start" or any conventional entry point.
    // -----------------------------------------------------------------------
    const allJumpTargets = new Set<string>();
    for (const jumpList of Object.values(analysisResult.jumps)) {
      for (const jump of jumpList) {
        allJumpTargets.add(jump.target);
      }
    }

    for (const [labelName, labelLoc] of Object.entries(analysisResult.labels)) {
      // Skip conventional entry points
      if (labelName === 'start' || labelName === 'quit' || labelName === 'after_load' ||
          labelName === 'splashscreen' || labelName === 'main_menu' ||
          labelName.startsWith('_')) continue;

      if (!allJumpTargets.has(labelName)) {
        const block = blocks.find(b => b.id === (labelLoc as { blockId?: string }).blockId);
        issues.push({
          id: `unreachable-label:${labelName}`,
          severity: 'info',
          category: 'unreachable-label',
          message: `Label "${labelName}" is never reached by any jump or call`,
          blockId: (labelLoc as { blockId?: string }).blockId,
          filePath: block?.filePath,
          line: (labelLoc as { line?: number }).line,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Source 12: Dead-end labels
    // A label is a dead-end if it has no outgoing jump/call links and its
    // block does not contain a standalone `return` statement (which would make
    // it a valid callable subroutine).  Dead-ends are either intentional story
    // endings or missing jumps — surfaced as info so writers can verify.
    // -----------------------------------------------------------------------
    const RE_RETURN = /^\s+return\b/m;
    // Build set of label node IDs that have at least one outgoing routeLink
    const sourcedLabelNodeIds = new Set(analysisResult.routeLinks.map(l => l.sourceId));
    const DEAD_END_SKIP = new Set(['start', 'quit', 'after_load', 'splashscreen', 'main_menu']);

    for (const node of analysisResult.labelNodes) {
      if (DEAD_END_SKIP.has(node.label) || node.label.startsWith('_')) continue;
      if (sourcedLabelNodeIds.has(node.id)) continue;

      // Skip if the owning block contains a `return` statement — the label is
      // likely a subroutine and the return is its intended exit.
      const block = blocks.find(b => b.id === node.blockId);
      if (block?.content && RE_RETURN.test(block.content)) continue;

      issues.push({
        id: `dead-end-label:${node.label}`,
        severity: 'info',
        category: 'dead-end-label',
        message: `Label "${node.label}" has no jump, call, or return exit — verify this is an intentional ending`,
        blockId: node.blockId,
        filePath: block?.filePath,
        line: node.startLine,
      });
    }

    const visibleIssues = ignoredDiagnostics.length > 0
      ? issues.filter(issue => !ignoredDiagnostics.some(rule => matchesIgnoredDiagnostic(issue, rule)))
      : issues;

    // -----------------------------------------------------------------------
    // Compute counts
    // -----------------------------------------------------------------------
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    for (const issue of visibleIssues) {
      if (issue.severity === 'error') errorCount++;
      else if (issue.severity === 'warning') warningCount++;
      else infoCount++;
    }

    return { issues: visibleIssues, errorCount, warningCount, infoCount };
  }, [
    blocks,
    analysisResult,
    existingImageTags,
    existingAudioPaths,
    ignoredDiagnostics,
  ]);
}

// ---------------------------------------------------------------------------
// Migration: punchlistMetadata → DiagnosticsTask[]
// Only sticky note entries are migrated as tasks; image/audio entries become
// auto-detected Issues and are intentionally dropped.
// ---------------------------------------------------------------------------
export function migratePunchlistToTasks(
  metadata: Record<string, PunchlistMetadata>,
): DiagnosticsTask[] {
  const tasks: DiagnosticsTask[] = [];
  for (const [id, meta] of Object.entries(metadata)) {
    if (id.startsWith('note:')) {
      const stickyNoteId = id.substring(5);
      tasks.push({
        id: crypto.randomUUID(),
        title: `Canvas note: ${stickyNoteId}`,
        description: meta.notes || '',
        status: meta.status === 'completed' ? 'completed' : 'open',
        stickyNoteId,
        createdAt: Date.now(),
      });
    }
  }
  return tasks;
}
