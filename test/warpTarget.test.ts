import { getLabelAtLine, resolveWarpTarget } from '../lib/warpTarget';
import { createBlock, createEmptyAnalysisResult } from './mocks/sampleData';

describe('resolveWarpTarget', () => {
  it('maps a label to a game-relative warp target', () => {
    const blocks = [
      createBlock({ id: 'b1', filePath: 'game/script.rpy' }),
    ];
    const analysis = createEmptyAnalysisResult({
      labels: {
        start: { blockId: 'b1', label: 'start', line: 12, column: 7, type: 'label' },
      },
    });

    expect(resolveWarpTarget(blocks, analysis.labels, 'start')).toBe('script.rpy:12');
  });

  it('returns null when the label cannot be resolved', () => {
    const analysis = createEmptyAnalysisResult();
    expect(resolveWarpTarget([], analysis.labels, 'missing')).toBeNull();
  });

  it('finds a label defined on a specific line', () => {
    const analysis = createEmptyAnalysisResult({
      labels: {
        start: { blockId: 'b1', label: 'start', line: 12, column: 7, type: 'label' },
      },
    });

    expect(getLabelAtLine(analysis.labels, 'b1', 12)?.label).toBe('start');
    expect(getLabelAtLine(analysis.labels, 'b1', 99)).toBeNull();
  });
});
