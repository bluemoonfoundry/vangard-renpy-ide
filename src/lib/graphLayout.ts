import DirectedGraph from 'graphology';
import { connectedComponents } from 'graphology-components';
import { topologicalGenerations } from 'graphology-dag';
import type { LabelNode, Position, RouteLink, StoryCanvasGroupingMode } from '@/types';

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
  position: Position;
}

export interface LayoutEdge {
  sourceId: string;
  targetId: string;
}

export interface LayoutCluster {
  id: string;
  nodeIds: string[];
}

export interface LayoutConfig {
  paddingX: number;
  paddingY: number;
  componentSpacing: number;
  clusterSpacingX: number;
  clusterSpacingY: number;
  defaultWidth: number;
  defaultHeight: number;
  /** Y-offset for cross-axis normalisation. Story canvas uses 100, route canvas uses 100. */
  crossAxisBase: number;
}

/**
 * Builds a directed graphology graph from nodes and edges.
 *
 * Filters out edges that reference non-existent nodes and prevents duplicate
 * edges between the same node pair (graphology throws on duplicates).
 *
 * @param nodes - Array of layout nodes to add to the graph
 * @param edges - Array of directed edges connecting nodes
 * @returns A directed graph with all valid nodes and edges
 *
 * @complexity O(V + E) time, O(V) space where V = nodes, E = edges
 */
export function buildGraph<N extends LayoutNode, E extends LayoutEdge>(
  nodes: N[],
  edges: E[],
): DirectedGraph {
  const graph = new DirectedGraph();
  const nodeIds = new Set<string>();

  nodes.forEach(node => {
    graph.addNode(node.id);
    nodeIds.add(node.id);
  });

  edges.forEach(edge => {
    if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) return;
    // Avoid duplicate edges (graphology throws on duplicate directed edge between same pair)
    if (!graph.hasDirectedEdge(edge.sourceId, edge.targetId)) {
      graph.addDirectedEdge(edge.sourceId, edge.targetId);
    }
  });

  return graph;
}

/**
 * Gets connected components using graphology-components.
 *
 * Returns arrays of node ID arrays, preserving the order of input nodes.
 * Each inner array represents a disconnected subgraph in the layout.
 *
 * @param nodes - Array of layout nodes
 * @param edges - Array of directed edges
 * @returns Array of node ID arrays, one per connected component
 *
 * @complexity O(V + E) time, O(V) space
 * @see buildGraph for graph construction
 */
export function getConnectedComponents<N extends LayoutNode, E extends LayoutEdge>(
  nodes: N[],
  edges: E[],
): string[][] {
  const graph = buildGraph(nodes, edges);
  return connectedComponents(graph);
}

/**
 * Computes a Sugiyama-style layered layout for a set of nodes and edges.
 *
 * Implements a hierarchical graph layout algorithm that arranges nodes in layers,
 * with edges flowing in a consistent direction. Handles disconnected components
 * (each gets its own layout space) and cyclic graphs (falls back to BFS layering
 * when topological sort fails). Nodes are centered within their layers and
 * cross-axis positions are normalized to `config.crossAxisBase`.
 *
 * @param nodes - Array of layout nodes to position
 * @param edges - Array of directed edges defining the graph structure
 * @param direction - Layout direction: 'lr' (left-to-right) or 'td' (top-down)
 * @param config - Layout configuration (spacing, padding, dimensions)
 * @returns Array of nodes with updated positions
 *
 * @example
 * ```typescript
 * const laid = computeLayeredLayoutGeneric(
 *   blocks,
 *   links,
 *   'lr',
 *   { paddingX: 200, paddingY: 50, componentSpacing: 400, ... }
 * );
 * ```
 *
 * @complexity O(V² + E) worst case (cyclic graphs), O(V + E) typical case
 * @see bfsLayers for cycle-breaking heuristic
 */
export function computeLayeredLayoutGeneric<N extends LayoutNode>(
  nodes: N[],
  edges: LayoutEdge[],
  direction: 'lr' | 'td',
  config: LayoutConfig,
): N[] {
  if (nodes.length === 0) return [];

  const { paddingX, paddingY, componentSpacing, defaultWidth, defaultHeight, crossAxisBase } = config;
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const graph = buildGraph(nodes, edges);

  // Get connected components using graphology
  const components = connectedComponents(graph);
  const finalPositions = new Map<string, Position>();
  let currentOffsetPrimary = 0;

  components.forEach(componentNodeIds => {
    const componentNodeSet = new Set(componentNodeIds);

    // Try topological generations first; fall back to BFS on cycles
    let layers: string[][];
    try {
      // Build a subgraph for this component for topologicalGenerations
      const subgraph = new DirectedGraph();
      componentNodeIds.forEach(id => subgraph.addNode(id));
      graph.forEachEdge((_edge, _attrs, source, target) => {
        if (componentNodeSet.has(source) && componentNodeSet.has(target)) {
          if (!subgraph.hasDirectedEdge(source, target)) {
            subgraph.addDirectedEdge(source, target);
          }
        }
      });

      layers = topologicalGenerations(subgraph);
    } catch {
      // Cyclic component — fall back to BFS layer assignment
      layers = bfsLayers(componentNodeIds, graph, componentNodeSet);
    }

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

      totalCrossSize += (layer.length - 1) * paddingY;
      let currentCross = -totalCrossSize / 2;

      layer.forEach(id => {
        const node = nodeMap.get(id);
        if (!node) return;

        const primarySize = direction === 'lr' ? node.width : node.height;
        const crossSize = direction === 'lr' ? node.height : node.width;
        const primary = currentOffsetPrimary + layerPrimary + (maxCrossSize - primarySize) / 2;
        const cross = currentCross + crossAxisBase;

        finalPositions.set(id, direction === 'lr'
          ? { x: primary, y: cross }
          : { x: cross, y: primary });

        currentCross += crossSize + paddingY;
      });

      layerPrimary += maxCrossSize + paddingX;
    });

    const componentPrimary = Math.max(layerPrimary - paddingX, direction === 'lr' ? defaultWidth : defaultHeight);
    currentOffsetPrimary += componentPrimary + componentSpacing;
  });

  // Normalise cross-axis positions
  if (finalPositions.size > 0) {
    let minCross = Infinity;
    finalPositions.forEach(position => {
      const cross = direction === 'lr' ? position.y : position.x;
      minCross = Math.min(minCross, cross);
    });
    const shift = crossAxisBase - minCross;
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

/**
 * Computes BFS-based layer assignment for cyclic components.
 *
 * Uses progressive cycle-breaking: when the BFS queue empties but unvisited nodes
 * remain (a cycle has stalled progress), we re-seed from the unvisited node with the
 * minimum accumulated in-degree. That node is the best cycle-break point because it
 * has the fewest unprocessed predecessors, so it violates the fewest ordering
 * constraints. This repeats until every node is placed, producing a layout where
 * back-edges are rendered as left-pointing arrows rather than dumping all cycle
 * participants into a single crowded column.
 *
 * @param componentNodeIds - Array of node IDs in this connected component
 * @param graph - The full graphology graph
 * @param componentNodeSet - Set of node IDs in this component (for fast lookup)
 * @returns Array of layers, each layer is an array of node IDs
 *
 * @example
 * ```typescript
 * // For a cycle A→B→C→A, produces layers like [[A], [B], [C]]
 * // where the C→A edge becomes a back-edge
 * const layers = bfsLayers(['A', 'B', 'C'], graph, new Set(['A', 'B', 'C']));
 * ```
 *
 * @complexity O(V² + E) worst case (rare deep nesting of cycles);
 *             O(V + E) for typical story graphs with a small number of back-edges.
 */
function bfsLayers(
  componentNodeIds: string[],
  graph: DirectedGraph,
  componentNodeSet: Set<string>,
): string[][] {
  const inDegree = new Map<string, number>();

  componentNodeIds.forEach(id => {
    let degree = 0;
    graph.forEachInEdge(id, (_edge, _attrs, source) => {
      if (componentNodeSet.has(source)) degree++;
    });
    inDegree.set(id, degree);
  });

  const visited = new Set<string>();
  const layers: string[][] = [];
  const queue: string[] = [];

  // Seed with zero in-degree nodes; fall back to first node for pure cycles.
  componentNodeIds.forEach(id => { if ((inDegree.get(id) ?? 0) === 0) queue.push(id); });
  if (queue.length === 0 && componentNodeIds.length > 0) queue.push(componentNodeIds[0]);

  while (visited.size < componentNodeIds.length) {
    // Queue exhausted but unvisited nodes remain — a cycle has stalled the BFS.
    // Break it by seeding from the unvisited node with the minimum in-degree:
    // that node has the most predecessors already placed, so it is the least
    // disruptive cut point in the cycle.
    if (queue.length === 0) {
      let minDeg = Infinity;
      let seed = '';
      for (const id of componentNodeIds) {
        if (visited.has(id)) continue;
        const deg = inDegree.get(id) ?? 0;
        if (deg < minDeg) { minDeg = deg; seed = id; }
      }
      if (seed) queue.push(seed);
    }

    if (queue.length === 0) break; // Defensive: all nodes already visited.

    const layerSize = queue.length;
    const currentLayer: string[] = [];

    for (let i = 0; i < layerSize; i++) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      currentLayer.push(current);

      graph.forEachOutEdge(current, (_edge, _attrs, _source, target) => {
        // Skip edges that leave the component or point back to already-placed nodes
        // (back-edges in the cycle); they are still drawn as arrows but ignored for
        // layer assignment.
        if (!componentNodeSet.has(target) || visited.has(target)) return;
        inDegree.set(target, (inDegree.get(target) ?? 1) - 1);
        if ((inDegree.get(target) ?? 0) <= 0) {
          queue.push(target);
        }
      });
    }

    if (currentLayer.length > 0) {
      layers.push(currentLayer);
    }
  }

  return layers;
}

/**
 * Builds clusters from nodes and edges based on grouping mode.
 *
 * Supports three grouping modes:
 * 1. `'connected-component'` - Groups nodes by graph connectivity
 * 2. `'filename-prefix'` - Groups nodes sharing a common prefix (e.g., "ch1_")
 * 3. `'none'` - Each node becomes its own singleton cluster
 *
 * For filename-prefix mode, nodes with no extractable prefix become singletons.
 * Only prefixes with 2+ nodes form clusters; single-prefix nodes remain singletons.
 *
 * @param nodes - Array of layout nodes to cluster
 * @param edges - Array of directed edges (used for connected-component mode)
 * @param groupingMode - Clustering strategy
 * @param prefixExtractor - Function that extracts a prefix from a node, or null if unclustered
 * @returns Array of clusters, each containing node IDs
 *
 * @example
 * ```typescript
 * const clusters = buildClustersGeneric(
 *   blocks,
 *   links,
 *   'filename-prefix',
 *   (block) => inferFilenamePrefix(block.filePath)
 * );
 * ```
 *
 * @complexity O(V + E) time, O(V) space
 * @see getConnectedComponents for connected-component mode
 */
export function buildClustersGeneric<N extends LayoutNode>(
  nodes: N[],
  edges: LayoutEdge[],
  groupingMode: StoryCanvasGroupingMode,
  prefixExtractor: (node: N) => string | null,
): LayoutCluster[] {
  if (groupingMode === 'connected-component') {
    return getConnectedComponents(nodes, edges).map((nodeIds, index) => ({
      id: `component-${index}`,
      nodeIds,
    }));
  }

  if (groupingMode === 'filename-prefix') {
    const clusters = new Map<string, string[]>();
    const singletons: string[] = [];

    nodes.forEach(node => {
      const prefix = prefixExtractor(node);
      if (!prefix) {
        singletons.push(node.id);
        return;
      }
      const list = clusters.get(prefix) ?? [];
      list.push(node.id);
      clusters.set(prefix, list);
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

export interface RouteGraph {
  graph: DirectedGraph;
  startNodes: string[];
  endNodes: Set<string>;
}

interface LabelInfo {
  label: string;
  startLine: number;
  endLine: number;
  hasTerminal: boolean;
  hasReturn: boolean;
}

interface LabelLocation {
  blockId: string;
  label: string;
  line: number;
  type: string;
}

/**
 * Builds a graphology DirectedGraph from route analysis data with start/end node sets.
 *
 * Constructs a directed graph from label nodes and route links, then identifies:
 * - Start nodes: the "start" label if it exists and is not a menu, else all nodes with in-degree 0
 * - End nodes: leaf nodes (out-degree 0) and labels with return statements but no terminal statements
 *
 * Provides a clean extension point for future graph analyses (cycle detection, SCC,
 * centrality, etc.). Used by Flow Canvas and Choices Canvas for route visualization.
 *
 * @param labelNodes - Map of label node IDs to LabelNode objects
 * @param routeLinks - Array of route links (jumps/calls between labels)
 * @param labels - Record of label names to their location metadata
 * @param blockLabelInfo - Map of block IDs to their label info (for terminal/return detection)
 * @returns RouteGraph containing the graph, start nodes array, and end nodes set
 *
 * @complexity O(V + E) time, O(V) space
 * @see buildGraph for low-level graph construction
 */
export function buildRouteGraph(
  labelNodes: Map<string, LabelNode>,
  routeLinks: RouteLink[],
  labels: Record<string, LabelLocation>,
  blockLabelInfo: Map<string, LabelInfo[]>,
): RouteGraph {
  const graph = new DirectedGraph();
  labelNodes.forEach(node => graph.addNode(node.id));
  routeLinks.forEach(link => {
    if (graph.hasNode(link.sourceId) && graph.hasNode(link.targetId)) {
      if (!graph.hasDirectedEdge(link.sourceId, link.targetId)) {
        graph.addDirectedEdge(link.sourceId, link.targetId);
      }
    }
  });

  let startNodes: string[] = [];
  const startLabelLocation = labels['start'];
  if (startLabelLocation && startLabelLocation.type !== 'menu') {
    const startNodeId = `${startLabelLocation.blockId}:start`;
    if (labelNodes.has(startNodeId)) startNodes.push(startNodeId);
  }
  if (startNodes.length === 0) {
    startNodes = Array.from(labelNodes.keys()).filter(nodeId => graph.inDegree(nodeId) === 0);
  }

  const endNodes = new Set<string>();
  blockLabelInfo.forEach((blockLabels, blockId) => {
    blockLabels.forEach(labelInfo => {
      const nodeId = `${blockId}:${labelInfo.label}`;
      const isLeafNode = graph.hasNode(nodeId) && graph.outDegree(nodeId) === 0;
      if (isLeafNode || (labelInfo.hasReturn && !labelInfo.hasTerminal)) endNodes.add(nodeId);
    });
  });

  return { graph, startNodes, endNodes };
}
