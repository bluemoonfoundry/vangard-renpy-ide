import type {
  LabelNode,
  RouteLink,
  StoryCanvasGroupingMode,
  StoryCanvasLayoutMode,
} from '@/types';
import {
  buildClustersGeneric,
  computeLayeredLayoutGeneric,
  type LayoutConfig,
} from './graphLayout';

const LAYOUT_VERSION = 2;

const ROUTE_CONFIG: LayoutConfig = {
  paddingX: 140,
  paddingY: 70,
  componentSpacing: 220,
  clusterSpacingX: 220,
  clusterSpacingY: 180,
  defaultWidth: 220,
  defaultHeight: 110,
  crossAxisBase: 100,
};

/**
 * Infers a container prefix for clustering label nodes by container filename patterns.
 *
 * Similar to `inferFilenamePrefix` but operates on `LabelNode.containerName` (the file
 * containing the label). Supports the same five prefix extraction modes as storyCanvasLayout.
 * If no pattern matches, returns the full container name (unlike storyCanvasLayout, which
 * returns null for singletons).
 *
 * @param node - Label node to extract prefix from
 * @returns Extracted prefix string, or the full container name if no pattern matches
 *
 * @example
 * ```typescript
 * inferContainerPrefix({ containerName: 'ch1_intro', ... }) // → 'ch1'
 * inferContainerPrefix({ containerName: 'route_luna', ... }) // → 'route_luna'
 * inferContainerPrefix({ containerName: 'standalone', ... }) // → 'standalone'
 * ```
 *
 * @complexity O(n) time where n = container name length, O(1) space
 * @see inferFilenamePrefix in storyCanvasLayout.ts for similar logic
 */
function inferContainerPrefix(node: LabelNode): string | null {
  const container = (node.containerName ?? '').replace(/\.[^.]+$/, '').trim();
  if (!container) return null;

  const base = container.toLowerCase();

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

  return base;
}

/**
 * Computes a two-level hierarchical clustered layout for label nodes.
 *
 * Identical algorithm to storyCanvasLayout's `computeClusteredLayout`, but operates on
 * label nodes instead of blocks. Performs layout in two stages:
 * 1. **Intra-cluster layout**: Each cluster laid out independently
 * 2. **Inter-cluster layout**: Clusters treated as meta-nodes
 *
 * Final node positions = cluster position + local position + padding offset (40, 50).
 *
 * @param nodes - Array of label nodes to layout
 * @param edges - Array of route links between labels
 * @param groupingMode - Clustering strategy (connected-component or filename-prefix)
 * @returns Array of label nodes with updated positions
 *
 * @complexity O(n²) worst case (nested layout calls), O(n log n) typical case
 * @see computeLayeredLayoutGeneric for the underlying layout algorithm
 * @see buildClustersGeneric for clustering logic
 * @see computeClusteredLayout in storyCanvasLayout.ts for block-level equivalent
 */
function computeClusteredLayout(
  nodes: LabelNode[],
  edges: RouteLink[],
  groupingMode: StoryCanvasGroupingMode,
): LabelNode[] {
  const clusters = buildClustersGeneric(nodes, edges, groupingMode, inferContainerPrefix);
  if (clusters.every(cluster => cluster.nodeIds.length === 1)) {
    return computeLayeredLayoutGeneric(nodes, edges, 'lr', ROUTE_CONFIG);
  }

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const positionedNodes = new Map<string, LabelNode>();
  const clusterNodes: LabelNode[] = [];
  const clusterEdges = new Set<string>();

  clusters.forEach(cluster => {
    const clusterMembers = cluster.nodeIds.map(id => nodeById.get(id)).filter((node): node is LabelNode => !!node);
    const internalEdges = edges.filter(edge => cluster.nodeIds.includes(edge.sourceId) && cluster.nodeIds.includes(edge.targetId));
    const laidOut = computeLayeredLayoutGeneric(clusterMembers, internalEdges, 'lr', ROUTE_CONFIG);

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
      width: Math.max(220, maxX - minX + ROUTE_CONFIG.clusterSpacingX),
      height: Math.max(180, maxY - minY + ROUTE_CONFIG.clusterSpacingY),
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

  const laidOutClusters = computeLayeredLayoutGeneric(
    clusterNodes,
    Array.from(clusterEdges).map(id => {
      const [sourceId, targetId] = id.split('->');
      return { id, sourceId, targetId, type: 'jump' as const };
    }),
    'lr',
    ROUTE_CONFIG,
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

/**
 * Computes Flow Canvas (route canvas) layout with the specified mode and grouping strategy.
 *
 * This is the main entry point for Flow Canvas layout. Identical algorithm to
 * `computeStoryLayout` but operates on label nodes instead of blocks. Supports four layout modes:
 * - `'flow-lr'`: Left-to-right Sugiyama layout (default)
 * - `'flow-td'`: Top-down Sugiyama layout
 * - `'connected-components'`: Left-to-right with disconnected components spaced apart
 * - `'clustered-flow'`: Two-level hierarchical layout with clustering
 *
 * @param nodes - Array of label nodes to layout
 * @param edges - Array of route links between labels
 * @param layoutMode - Layout algorithm to use
 * @param groupingMode - Clustering strategy (only used for clustered-flow mode)
 * @returns Array of label nodes with updated positions
 *
 * @complexity O(n²) worst case (clustered-flow), O(n log n) typical case
 * @see computeStoryLayout in storyCanvasLayout.ts for block-level equivalent
 */
export function computeRouteCanvasLayout(
  nodes: LabelNode[],
  edges: RouteLink[],
  layoutMode: StoryCanvasLayoutMode,
  groupingMode: StoryCanvasGroupingMode,
): LabelNode[] {
  switch (layoutMode) {
    case 'flow-td':
      return computeLayeredLayoutGeneric(nodes, edges, 'td', ROUTE_CONFIG);
    case 'connected-components':
      return computeLayeredLayoutGeneric(nodes, edges, 'lr', ROUTE_CONFIG);
    case 'clustered-flow':
      return computeClusteredLayout(nodes, edges, groupingMode === 'none' ? 'connected-component' : groupingMode);
    case 'flow-lr':
    default:
      return computeLayeredLayoutGeneric(nodes, edges, 'lr', ROUTE_CONFIG);
  }
}

/**
 * Computes a fingerprint string for route canvas layout cache invalidation.
 *
 * Identical to `computeStoryLayoutFingerprint` but for label nodes instead of blocks.
 * Includes node ID, container name, dimensions, and edge types in the fingerprint.
 *
 * @param nodes - Array of label nodes
 * @param edges - Array of route links
 * @param layoutMode - Current layout mode
 * @param groupingMode - Current grouping mode
 * @returns Fingerprint string
 *
 * @complexity O(n log n) time (due to sorting), O(n) space
 * @see computeStoryLayoutFingerprint in storyCanvasLayout.ts for block-level equivalent
 */
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
