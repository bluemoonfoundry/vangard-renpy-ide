import type {
  LabelNode,
  Position,
  RouteLink,
  StoryCanvasGroupingMode,
  StoryCanvasLayoutMode,
} from '../types';

const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 110;
const PADDING_X = 140;
const PADDING_Y = 70;
const COMPONENT_SPACING = 220;
const CLUSTER_SPACING_X = 220;
const CLUSTER_SPACING_Y = 180;
const LAYOUT_VERSION = 1;

interface LayoutCluster {
  id: string;
  nodeIds: string[];
}

function buildAdjacency(nodes: LabelNode[], edges: RouteLink[]) {
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

function computeConnectedComponents(nodes: LabelNode[], edges: RouteLink[]): string[][] {
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

function computeLayeredLayout(
  nodes: LabelNode[],
  edges: RouteLink[],
  direction: 'lr' | 'td',
): LabelNode[] {
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const { outgoing, incoming } = buildAdjacency(nodes, edges);
  const components = computeConnectedComponents(nodes, edges);
  const finalPositions = new Map<string, Position>();
  let currentOffsetPrimary = 0;

  components.forEach(componentNodeIds => {
    const componentNodeSet = new Set(componentNodeIds);
    const queue: string[] = [];
    const inDegree = new Map<string, number>();

    componentNodeIds.forEach(id => {
      const degree = (incoming.get(id) ?? []).filter(sourceId => componentNodeSet.has(sourceId)).length;
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
          .filter(targetId => componentNodeSet.has(targetId))
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

  if (finalPositions.size > 0) {
    let minCross = Infinity;
    finalPositions.forEach(position => {
      const cross = direction === 'lr' ? position.y : position.x;
      minCross = Math.min(minCross, cross);
    });
    const shift = 100 - minCross;
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

function inferContainerPrefix(node: LabelNode): string | null {
  const container = (node.containerName ?? '').replace(/\.[^.]+$/, '').trim();
  if (!container) return null;

  const base = container.toLowerCase();

  // Named episode/chapter/act/day/part/scene/vol/section/arc variants
  // e.g. ep1, ep_1, ep-1, episode1, episode_1, ch1, ch_1, chapter_1, act1, act_1,
  //      day1, day_1, part1, scene1, vol1, section1, arc1, arc_1
  const namedPrefixMatch = base.match(
    /^((?:ep|episode|ch|chapter|act|day|part|scene|vol|section|arc)(?:[_\- ]?\d+))/
  );
  if (namedPrefixMatch) {
    // Normalize separators to underscore
    return namedPrefixMatch[1].replace(/[_\- ]/g, '_');
  }

  // route_luna, route_bad, route_<name> — group by route prefix
  const routePrefixMatch = base.match(/^(route[_\- ][a-z0-9]+)/);
  if (routePrefixMatch) {
    return routePrefixMatch[1].replace(/[_\- ]/g, '_');
  }

  // Numeric leading prefix: 01_intro, 02_main — group as n_01, n_02
  const numericLeadMatch = base.match(/^(\d{1,3})[_\- ]/);
  if (numericLeadMatch) {
    return `n_${numericLeadMatch[1].padStart(2, '0')}`;
  }

  // Generic word+number prefix before a separator: word1_, word_1_
  const genericMatch = base.match(/^([a-z]+[_\- ]?\d+)[_\- ]/);
  if (genericMatch) {
    return genericMatch[1].replace(/[_\- ]/g, '_');
  }

  return base;
}

function buildClusters(nodes: LabelNode[], edges: RouteLink[], groupingMode: StoryCanvasGroupingMode): LayoutCluster[] {
  if (groupingMode === 'connected-component') {
    return computeConnectedComponents(nodes, edges).map((nodeIds, index) => ({ id: `component-${index}`, nodeIds }));
  }

  if (groupingMode === 'filename-prefix') {
    const clusters = new Map<string, string[]>();
    const singletons: string[] = [];

    nodes.forEach(node => {
      const prefix = inferContainerPrefix(node);
      if (!prefix) {
        singletons.push(node.id);
        return;
      }
      const entries = clusters.get(prefix) ?? [];
      entries.push(node.id);
      clusters.set(prefix, entries);
    });

    const result: LayoutCluster[] = [];
    clusters.forEach((nodeIds, id) => {
      if (nodeIds.length > 1) result.push({ id, nodeIds });
      else singletons.push(nodeIds[0]);
    });
    singletons.forEach((id, index) => result.push({ id: `single-${index}-${id}`, nodeIds: [id] }));
    return result;
  }

  return nodes.map(node => ({ id: node.id, nodeIds: [node.id] }));
}

function computeClusteredLayout(
  nodes: LabelNode[],
  edges: RouteLink[],
  groupingMode: StoryCanvasGroupingMode,
): LabelNode[] {
  const clusters = buildClusters(nodes, edges, groupingMode);
  if (clusters.every(cluster => cluster.nodeIds.length === 1)) {
    return computeLayeredLayout(nodes, edges, 'lr');
  }

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const positionedNodes = new Map<string, LabelNode>();
  const clusterNodes: LabelNode[] = [];
  const clusterEdges = new Set<string>();

  clusters.forEach(cluster => {
    const clusterMembers = cluster.nodeIds.map(id => nodeById.get(id)).filter((node): node is LabelNode => !!node);
    const internalEdges = edges.filter(edge => cluster.nodeIds.includes(edge.sourceId) && cluster.nodeIds.includes(edge.targetId));
    const laidOut = computeLayeredLayout(clusterMembers, internalEdges, 'lr');

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    laidOut.forEach(node => {
      positionedNodes.set(node.id, node);
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.width);
      maxY = Math.max(maxY, node.position.y + node.height);
    });

    clusterNodes.push({
      id: cluster.id,
      label: cluster.id,
      blockId: cluster.id,
      startLine: 1,
      width: Math.max(220, maxX - minX + CLUSTER_SPACING_X),
      height: Math.max(180, maxY - minY + CLUSTER_SPACING_Y),
      position: { x: 0, y: 0 },
    });
  });

  const clusterByNodeId = new Map<string, string>();
  clusters.forEach(cluster => cluster.nodeIds.forEach(nodeId => clusterByNodeId.set(nodeId, cluster.id)));

  edges.forEach(edge => {
    const sourceCluster = clusterByNodeId.get(edge.sourceId);
    const targetCluster = clusterByNodeId.get(edge.targetId);
    if (!sourceCluster || !targetCluster || sourceCluster === targetCluster) return;
    clusterEdges.add(`${sourceCluster}->${targetCluster}`);
  });

  const laidOutClusters = computeLayeredLayout(
    clusterNodes,
    Array.from(clusterEdges).map(id => {
      const [sourceId, targetId] = id.split('->');
      return { id, sourceId, targetId, type: 'jump' as const };
    }),
    'lr',
  );

  const clusterLayoutMap = new Map(laidOutClusters.map(node => [node.id, node]));

  return clusters.flatMap(cluster => {
    const clusterLayout = clusterLayoutMap.get(cluster.id);
    const clusterMembers = cluster.nodeIds.map(id => positionedNodes.get(id)).filter((node): node is LabelNode => !!node);
    if (!clusterLayout || clusterMembers.length === 0) return clusterMembers;

    const minX = Math.min(...clusterMembers.map(node => node.position.x));
    const minY = Math.min(...clusterMembers.map(node => node.position.y));

    return clusterMembers.map(node => ({
      ...node,
      position: {
        x: clusterLayout.position.x + (node.position.x - minX) + 40,
        y: clusterLayout.position.y + (node.position.y - minY) + 50,
      },
    }));
  });
}

export function computeRouteCanvasLayout(
  nodes: LabelNode[],
  edges: RouteLink[],
  layoutMode: StoryCanvasLayoutMode,
  groupingMode: StoryCanvasGroupingMode,
): LabelNode[] {
  switch (layoutMode) {
    case 'flow-td':
      return computeLayeredLayout(nodes, edges, 'td');
    case 'connected-components':
      return computeLayeredLayout(nodes, edges, 'lr');
    case 'clustered-flow':
      return computeClusteredLayout(nodes, edges, groupingMode === 'none' ? 'connected-component' : groupingMode);
    case 'flow-lr':
    default:
      return computeLayeredLayout(nodes, edges, 'lr');
  }
}

export function computeRouteCanvasLayoutFingerprint(
  nodes: LabelNode[],
  edges: RouteLink[],
  layoutMode: StoryCanvasLayoutMode,
  groupingMode: StoryCanvasGroupingMode,
): string {
  const nodePart = nodes
    .map(node => `${node.id}:${node.containerName ?? ''}:${node.width}x${node.height}`)
    .sort()
    .join('|');
  const edgePart = edges
    .map(edge => `${edge.sourceId}->${edge.targetId}:${edge.type}`)
    .sort()
    .join('|');
  return `v${LAYOUT_VERSION};mode=${layoutMode};group=${groupingMode};nodes=${nodePart};edges=${edgePart}`;
}

export function getRouteCanvasLayoutVersion(): number {
  return LAYOUT_VERSION;
}
