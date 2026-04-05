import { renderHook } from '@testing-library/react';
import { useDiagnostics } from './useDiagnostics';
import { createBlock, createEmptyAnalysisResult } from '../test/mocks/sampleData';
import type { IgnoredDiagnosticRule } from '../types';

describe('useDiagnostics', () => {
  it('filters ignored diagnostics out of issues and counts', () => {
    const blocks = [createBlock({ id: 'b1', content: 'label start:\n    jump missing_label\n' })];
    const analysis = createEmptyAnalysisResult({
      invalidJumps: { b1: ['missing_label'] },
      jumps: {
        b1: [{
          blockId: 'b1',
          target: 'missing_label',
          type: 'jump',
          isDynamic: false,
          line: 2,
          columnStart: 9,
          columnEnd: 22,
        }],
      },
    });
    const ignored: IgnoredDiagnosticRule[] = [{
      category: 'invalid-jump',
      filePath: 'game/script.rpy',
      line: 2,
      message: 'Undefined label "missing_label"',
    }];

    const { result } = renderHook(() =>
      useDiagnostics(blocks, analysis, new Map(), new Map(), new Map(), new Map(), ignored)
    );

    expect(result.current.issues).toHaveLength(0);
    expect(result.current.errorCount).toBe(0);
    expect(result.current.warningCount).toBe(0);
    expect(result.current.infoCount).toBe(0);
  });
});
