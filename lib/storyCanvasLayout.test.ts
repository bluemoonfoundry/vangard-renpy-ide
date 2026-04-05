import { buildSavedStoryBlockLayouts, computeStoryLayout, computeStoryLayoutFingerprint } from './storyCanvasLayout';
import type { Block, Link } from '../types';

const createBlock = (id: string, filePath: string): Block => ({
  id,
  filePath,
  content: '',
  position: { x: 0, y: 0 },
  width: 320,
  height: 180,
  title: filePath,
});

describe('storyCanvasLayout', () => {
  it('changes the primary flow direction between left-right and top-down', () => {
    const blocks = [
      createBlock('a', 'game/ep01_start.rpy'),
      createBlock('b', 'game/ep01_branch.rpy'),
      createBlock('c', 'game/ep01_end.rpy'),
    ];
    const links: Link[] = [
      { sourceId: 'a', targetId: 'b', targetLabel: 'b', type: 'jump' },
      { sourceId: 'b', targetId: 'c', targetLabel: 'c', type: 'jump' },
    ];

    const leftRight = computeStoryLayout(blocks, links, 'flow-lr', 'none');
    const topDown = computeStoryLayout(blocks, links, 'flow-td', 'none');

    expect(leftRight[1].position.x).toBeGreaterThan(leftRight[0].position.x);
    expect(topDown[1].position.y).toBeGreaterThan(topDown[0].position.y);
  });

  it('uses filename-prefix grouping when clustered flow is selected', () => {
    const blocks = [
      createBlock('a', 'game/ep01_intro.rpy'),
      createBlock('b', 'game/ep01_route.rpy'),
      createBlock('c', 'game/ep02_intro.rpy'),
    ];
    const links: Link[] = [
      { sourceId: 'a', targetId: 'b', targetLabel: 'b', type: 'jump' },
      { sourceId: 'b', targetId: 'c', targetLabel: 'c', type: 'jump' },
    ];

    const clustered = computeStoryLayout(blocks, links, 'clustered-flow', 'filename-prefix');
    const ep01A = clustered.find(block => block.id === 'a')!;
    const ep01B = clustered.find(block => block.id === 'b')!;
    const ep02 = clustered.find(block => block.id === 'c')!;

    expect(Math.abs(ep01A.position.y - ep01B.position.y)).toBeLessThan(250);
    expect(ep02.position.x).toBeGreaterThan(ep01A.position.x);
  });

  it('changes the fingerprint when graph structure or layout mode changes', () => {
    const blocks = [createBlock('a', 'game/script.rpy'), createBlock('b', 'game/scene.rpy')];
    const noLinks: Link[] = [];
    const oneLink: Link[] = [{ sourceId: 'a', targetId: 'b', targetLabel: 'b', type: 'jump' }];

    const base = computeStoryLayoutFingerprint(blocks, noLinks, 'flow-lr', 'none');
    const changedLinks = computeStoryLayoutFingerprint(blocks, oneLink, 'flow-lr', 'none');
    const changedMode = computeStoryLayoutFingerprint(blocks, noLinks, 'flow-td', 'none');

    expect(changedLinks).not.toBe(base);
    expect(changedMode).not.toBe(base);
  });

  it('builds saved layouts only for file-backed blocks', () => {
    const blocks = [createBlock('a', 'game/script.rpy'), { ...createBlock('b', 'game/temp.rpy'), filePath: undefined }];

    const savedLayouts = buildSavedStoryBlockLayouts(blocks);

    expect(Object.keys(savedLayouts)).toEqual(['game/script.rpy']);
    expect(savedLayouts['game/script.rpy']?.position).toEqual({ x: 0, y: 0 });
  });
});
