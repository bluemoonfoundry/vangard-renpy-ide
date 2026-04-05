import { computeRouteCanvasLayout, computeRouteCanvasLayoutFingerprint } from './routeCanvasLayout';
import type { LabelNode, RouteLink } from '../types';

const createNode = (id: string, containerName: string): LabelNode => ({
  id,
  label: id,
  blockId: containerName,
  containerName,
  startLine: 1,
  position: { x: 0, y: 0 },
  width: 220,
  height: 110,
});

describe('routeCanvasLayout', () => {
  it('changes orientation between left-right and top-down', () => {
    const nodes = [createNode('a', 'ep01_a.rpy'), createNode('b', 'ep01_b.rpy')];
    const links: RouteLink[] = [{ id: 'ab', sourceId: 'a', targetId: 'b', type: 'jump' }];

    const leftRight = computeRouteCanvasLayout(nodes, links, 'flow-lr', 'none');
    const topDown = computeRouteCanvasLayout(nodes, links, 'flow-td', 'none');

    expect(leftRight[1].position.x).toBeGreaterThan(leftRight[0].position.x);
    expect(topDown[1].position.y).toBeGreaterThan(topDown[0].position.y);
  });

  it('changes fingerprint when route layout settings change', () => {
    const nodes = [createNode('a', 'ep01_a.rpy'), createNode('b', 'ep01_b.rpy')];
    const links: RouteLink[] = [{ id: 'ab', sourceId: 'a', targetId: 'b', type: 'jump' }];

    const base = computeRouteCanvasLayoutFingerprint(nodes, links, 'flow-lr', 'none');
    const changedGrouping = computeRouteCanvasLayoutFingerprint(nodes, links, 'clustered-flow', 'filename-prefix');

    expect(changedGrouping).not.toBe(base);
  });
});
