import type {
  Block,
  Link,
  Position,
  SavedStoryBlockLayout,
  StoryCanvasGroupingMode,
  StoryCanvasLayoutMode,
} from '../types';

interface LayoutNode {
  id: string;
  width: number;
  height: number;
  position: Position;
}

interface LayoutEdge {
  sourceId: string;
  targetId: string;
}

interface LayoutCluster {
  id: string;
  nodeIds: string[];
}

const DEFAULT_WIDTH = 120;
const DEFAULT_HEIGHT = 120;
const PADDING_X = 150;
const PADDING_Y = 50;
const COMPONENT_SPACING = 200;
const CLUSTER_SPACING_X = 220;
const CLUSTER_SPACING_Y = 180;
const LAYOUT_VERSION = 1;

function buildAdjacency(nodes: LayoutNode[], edges: LayoutEdge[]) {
  const nodeIds = new Set(nodes.map(node => node.id));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  nodes.forEach(node => {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  });

  edges.forEach(edge => {
    if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) return;
    outgoing.get(edge.sourceId)!.push(edge.targetId);
    incoming.get(edge.targetId)!.push(edge.sourceId);
  });

  return { outgoing, incoming };
}

function computeConnectedComponents(nodes: LayoutNode[], edges: LayoutEdge[]): string[][] {
  const nodeIds = new Set(nodes.map(node => node.id));
  const undirected = new Map<string, Set<string>>();
  nodes.forEach(node => undirected.set(node.id, new Set()));

  edges.forEach(edge => {
    if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) return;
    undirected.get(edge.sourceId)!.add(edge.targetId);
    undirected.get(edge.targetId)!.add(edge.sourceId);
  });

  const visited = new Set<string>();
  const components: string[][] = [];

  nodes.forEach(node => {
    if (visited.has(node.id)) return;

    const queue = [node.id];
    const component: string[] = [];
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      undirected.get(current)?.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }

    components.push(component);
  });

  return components;
}

function computeLayeredLayout<T extends LayoutNode>(
  nodes: T[],
  edges: LayoutEdge[],
  direction: 'lr' | 'td',
): T[] {
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const { outgoing, incoming } = buildAdjacency(nodes, edges);
  const components = computeConnectedComponents(nodes, edges);
  const finalPositions = new Map<string, Position>();
  let currentOffsetPrimary = 0;

  components.forEach(componentNodeIds => {
    const queue: string[] = [];
    const inDegree = new Map<string, number>();

    componentNodeIds.forEach(id => {
      const degree = (incoming.get(id) ?? []).filter(sourceId => componentNodeIds.includes(sourceId)).length;
      inDegree.set(id, degree);
      if (degree === 0) queue.push(id);
    });

    if (queue.length === 0 && componentNodeIds.length > 0) {
      queue.push(componentNodeIds[0]);
    }

    const visited = new Set<string>();
    const layers: string[][] = [];

    while (queue.length > 0) {
      const layerSize = queue.length;
      const currentLayer: string[] = [];

      for (let i = 0; i < layerSize; i++) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        currentLayer.push(current);

        (outgoing.get(current) ?? [])
          .filter(targetId => componentNodeIds.includes(targetId))
          .forEach(targetId => {
            inDegree.set(targetId, (inDegree.get(targetId) ?? 1) - 1);
            if ((inDegree.get(targetId) ?? 0) <= 0) {
              queue.push(targetId);
            }
          });
      }

      if (currentLayer.length > 0) {
        layers.push(currentLayer);
      }
    }

    const leftovers = componentNodeIds.filter(id => !visited.has(id));
    if (leftovers.length > 0) layers.push(leftovers);

    let layerPrimary = 0;
    layers.forEach(layer => {
      let maxCrossSize = 0;
      let totalCrossSize = 0;

      layer.forEach(id => {
        const node = nodeMap.get(id);
        if (!node) return;
        const primarySize = direction === 'lr' ? node.width : node.height;
        const crossSize = direction === 'lr' ? node.height : node.width;
        maxCrossSize = Math.max(maxCrossSize, primarySize);
        totalCrossSize += crossSize;
      });

      totalCrossSize += (layer.length - 1) * PADDING_Y;
      let currentCross = -totalCrossSize / 2;

      layer.forEach(id => {
        const node = nodeMap.get(id);
        if (!node) return;

        const primarySize = direction === 'lr' ? node.width : node.height;
        const crossSize = direction === 'lr' ? node.height : node.width;
        const primary = currentOffsetPrimary + layerPrimary + (maxCrossSize - primarySize) / 2;
        const cross = currentCross + 100;

        finalPositions.set(id, direction === 'lr'
          ? { x: primary, y: cross }
          : { x: cross, y: primary });

        currentCross += crossSize + PADDING_Y;
      });

      layerPrimary += maxCrossSize + PADDING_X;
    });

    const componentPrimary = Math.max(layerPrimary - PADDING_X, direction === 'lr' ? DEFAULT_WIDTH : DEFAULT_HEIGHT);
    currentOffsetPrimary += componentPrimary + COMPONENT_SPACING;
  });

  const fallbackY = 100;
  if (finalPositions.size === 0) {
    let currentX = 50;
    nodes.forEach(node => {
      finalPositions.set(node.id, { x: currentX, y: fallbackY });
      currentX += node.width + 50;
    });
  } else {
    let minCross = Infinity;
    finalPositions.forEach(position => {
      const cross = direction === 'lr' ? position.y : position.x;
      minCross = Math.min(minCross, cross);
    });
    const shift = fallbackY - minCross;
    finalPositions.forEach(position => {
      if (direction === 'lr') position.y += shift;
      else position.x += shift;
    });
  }

  return nodes.map(node => ({
    ...node,
    position: finalPositions.get(node.id) ?? node.position,
  }));
}

function inferFilenamePrefix(filePath?: string): string | null {
  if (!filePath) return null;
  const rawBase = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? '';
  if (!rawBase) return null;

  const base = rawBase.toLowerCase();

  // Named episode/chapter/act/day/part/scene/vol/section/arc variants
  const namedPrefixMatch = base.match(
    /^((?:ep|episode|ch|chapter|act|day|part|scene|vol|section|arc)(?:[_\- ]?\d+))/
  );
  if (namedPrefixMatch) {
    return namedPrefixMatch[1].replace(/[_\- ]/g, '_');
  }

  // route_luna, route_bad, route_<name>
  const routePrefixMatch = base.match(/^(route[_\- ][a-z0-9]+)/);
  if (routePrefixMatch) {
    return routePrefixMatch[1].replace(/[_\- ]/g, '_');
  }

  // Numeric leading prefix: 01_intro, 02_main
  const numericLeadMatch = base.match(/^(\d{1,3})[_\- ]/);
  if (numericLeadMatch) {
    return `n_${numericLeadMatch[1].padStart(2, '0')}`;
  }

  // Generic word+number prefix before a separator
  const genericMatch = base.match(/^([a-z]+[_\- ]?\d+)[_\- ]/);
  if (genericMatch) {
    return genericMatch[1].replace(/[_\- ]/g, '_');
  }

  return null;
}

function buildClusters(blocks: Block[], links: Link[], groupingMode: StoryCanvasGroupingMode): LayoutCluster[] {
  if (groupingMode === 'connected-component') {
    return computeConnectedComponents(blocks, links).map((nodeIds, index) => ({
      id: `component-${index}`,
      nodeIds,
    }));
  }

  if (groupingMode === 'filename-prefix') {
    const clusters = new Map<string, string[]>();
    const singletonIds: string[] = [];

    blocks.forEach(block => {
      const prefix = inferFilenamePrefix(block.filePath);
      if (!prefix) {
        singletonIds.push(block.id);
        return;
      }
      const list = clusters.get(prefix) ?? [];
      list.push(block.id);
      clusters.set(prefix, list);
    });

    const result: LayoutCluster[] = [];
    clusters.forEach((nodeIds, id) => {
      if (nodeIds.length > 1) result.push({ id, nodeIds });
      else singletonIds.push(nodeIds[0]);
    });
    singletonIds.forEach((id, index) => result.push({ id: `single-${index}-${id}`, nodeIds: [id] }));
    return result;
  }

  return blocks.map(block => ({ id: block.id, nodeIds: [block.id] }));
}

function computeClusteredLayout(
  blocks: Block[],
  links: Link[],
  groupingMode: StoryCanvasGroupingMode,
): Block[] {
  const clusters = buildClusters(blocks, links, groupingMode);
  if (clusters.every(cluster => cluster.nodeIds.length === 1)) {
    return computeLayeredLayout(blocks, links, 'lr');
  }

  const blockById = new Map(blocks.map(block => [block.id, block]));
  const positionedBlocks = new Map<string, Block>();
  const clusterNodes: LayoutNode[] = [];
  const clusterEdgesSet = new Set<string>();

  clusters.forEach(cluster => {
    const clusterBlocks = cluster.nodeIds.map(id => blockById.get(id)).filter((block): block is Block => !!block);
    const internalLinks = links.filter(link => cluster.nodeIds.includes(link.sourceId) && cluster.nodeIds.includes(link.targetId));
    const laidOut = computeLayeredLayout(clusterBlocks, internalLinks, 'lr');

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    laidOut.forEach(block => {
      positionedBlocks.set(block.id, block);
      minX = Math.min(minX, block.position.x);
      minY = Math.min(minY, block.position.y);
      maxX = Math.max(maxX, block.position.x + block.width);
      maxY = Math.max(maxY, block.position.y + block.height);
    });

    clusterNodes.push({
      id: cluster.id,
      width: Math.max(200, maxX - minX + CLUSTER_SPACING_X),
      height: Math.max(180, maxY - minY + CLUSTER_SPACING_Y),
      position: { x: 0, y: 0 },
    });
  });

  const clusterByBlockId = new Map<string, string>();
  clusters.forEach(cluster => cluster.nodeIds.forEach(nodeId => clusterByBlockId.set(nodeId, cluster.id)));

  links.forEach(link => {
    const sourceCluster = clusterByBlockId.get(link.sourceId);
    const targetCluster = clusterByBlockId.get(link.targetId);
    if (!sourceCluster || !targetCluster || sourceCluster === targetCluster) return;
    clusterEdgesSet.add(`${sourceCluster}->${targetCluster}`);
  });

  const clusterLayout = computeLayeredLayout(
    clusterNodes,
    Array.from(clusterEdgesSet).map(key => {
      const [sourceId, targetId] = key.split('->');
      return { sourceId, targetId };
    }),
    'lr',
  );
  const clusterPositionMap = new Map(clusterLayout.map(cluster => [cluster.id, cluster.position]));

  const result = blocks.map(block => {
    const laidOutBlock = positionedBlocks.get(block.id) ?? block;
    const clusterId = clusterByBlockId.get(block.id);
    const clusterPosition = clusterId ? clusterPositionMap.get(clusterId) : undefined;
    return clusterPosition
      ? {
          ...laidOutBlock,
          position: {
            x: clusterPosition.x + laidOutBlock.position.x,
            y: clusterPosition.y + laidOutBlock.position.y,
          },
        }
      : laidOutBlock;
  });

  return result;
}

export function computeStoryLayout(
  blocks: Block[],
  links: Link[],
  layoutMode: StoryCanvasLayoutMode,
  groupingMode: StoryCanvasGroupingMode,
): Block[] {
  switch (layoutMode) {
    case 'flow-td':
      return computeLayeredLayout(blocks, links, 'td');
    case 'connected-components':
      return computeLayeredLayout(blocks, links, 'lr');
    case 'clustered-flow':
      return computeClusteredLayout(blocks, links, groupingMode === 'none' ? 'connected-component' : groupingMode);
    case 'flow-lr':
    default:
      return computeLayeredLayout(blocks, links, 'lr');
  }
}

export function computeStoryLayoutFingerprint(
  blocks: Block[],
  links: Link[],
  layoutMode: StoryCanvasLayoutMode,
  groupingMode: StoryCanvasGroupingMode,
): string {
  const blockPart = blocks
    .map(block => `${block.filePath ?? block.id}:${block.width}x${block.height}`)
    .sort()
    .join('|');
  const linkPart = links
    .map(link => `${link.sourceId}->${link.targetId}:${link.type ?? 'jump'}`)
    .sort()
    .join('|');
  return `v${LAYOUT_VERSION};mode=${layoutMode};group=${groupingMode};blocks=${blockPart};links=${linkPart}`;
}

export function buildSavedStoryBlockLayouts(blocks: Block[]): Record<string, SavedStoryBlockLayout> {
  const layouts: Record<string, SavedStoryBlockLayout> = {};
  blocks.forEach(block => {
    if (!block.filePath) return;
    layouts[block.filePath] = {
      position: block.position,
      width: block.width,
      height: block.height,
      color: block.color,
    };
  });
  return layouts;
}

export function getStoryLayoutVersion(): number {
  return LAYOUT_VERSION;
}
