import type {
  Block,
  Link,
  SavedStoryBlockLayout,
  StoryCanvasGroupingMode,
  StoryCanvasLayoutMode,
} from '@/types';
import {
  buildClustersGeneric,
  computeLayeredLayoutGeneric,
  type LayoutConfig,
  type LayoutNode,
} from './graphLayout';

const LAYOUT_VERSION = 2;

const STORY_CONFIG: LayoutConfig = {
  paddingX: 150,
  paddingY: 50,
  componentSpacing: 200,
  clusterSpacingX: 220,
  clusterSpacingY: 180,
  defaultWidth: 120,
  defaultHeight: 120,
  crossAxisBase: 100,
};

/**
 * Infers a filename prefix for clustering blocks by filename patterns.
 *
 * Supports five prefix extraction modes:
 * 1. **Named episode/chapter patterns**: `ep1`, `chapter_02`, `act3`, `day_1`, `part4`, `scene5`, `vol2`, `section1`, `arc3`
 * 2. **Route patterns**: `route_luna`, `route_bad`, `route_<name>`
 * 3. **Numeric leading prefix**: `01_intro`, `02_main` → `n_01`, `n_02`
 * 4. **Generic word+number prefix**: `prologue1_scene`, `intro2_text` → `prologue1`, `intro2`
 * 5. **No match**: returns null (block becomes singleton)
 *
 * All prefixes are normalized to lowercase with underscores (e.g., `ch-1` → `ch_1`).
 * Numeric prefixes are zero-padded to 2 digits for consistent sorting.
 *
 * @param filePath - File path of the block (e.g., "game/ch1_intro.rpy")
 * @returns Extracted prefix string, or null if no pattern matches
 *
 * @example
 * ```typescript
 * inferFilenamePrefix('game/ch1_intro.rpy')    // → 'ch1'
 * inferFilenamePrefix('game/route_luna.rpy')   // → 'route_luna'
 * inferFilenamePrefix('game/01_start.rpy')     // → 'n_01'
 * inferFilenamePrefix('game/standalone.rpy')   // → null
 * ```
 *
 * @complexity O(n) time where n = filename length, O(1) space
 */
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

/**
 * Computes a two-level hierarchical clustered layout for blocks.
 *
 * This algorithm performs layout in two stages:
 * 1. **Intra-cluster layout**: Each cluster is laid out independently using the Sugiyama
 *    algorithm, producing local positions for all blocks within that cluster.
 * 2. **Inter-cluster layout**: Clusters are treated as meta-nodes and laid out using
 *    the same algorithm, producing global positions for each cluster bounding box.
 *
 * Final block positions are computed by adding the cluster's global position to each
 * block's local position within that cluster.
 *
 * If all clusters are singletons (one block each), falls back to flat layered layout.
 * Cluster dimensions are computed from their block bounding boxes plus spacing padding.
 *
 * @param blocks - Array of blocks to layout
 * @param links - Array of directed links between blocks
 * @param groupingMode - Clustering strategy (connected-component or filename-prefix)
 * @returns Array of blocks with updated positions
 *
 * @example
 * ```typescript
 * // Lays out blocks grouped by filename prefix (ch1_*, ch2_*, etc.)
 * const laid = computeClusteredLayout(blocks, links, 'filename-prefix');
 * ```
 *
 * @complexity O(n²) worst case (nested layout calls), O(n log n) typical case
 * @see computeLayeredLayoutGeneric for the underlying layout algorithm
 * @see buildClustersGeneric for clustering logic
 */
function computeClusteredLayout(
  blocks: Block[],
  links: Link[],
  groupingMode: StoryCanvasGroupingMode,
): Block[] {
  const clusters = buildClustersGeneric(blocks, links, groupingMode, (block: Block) => inferFilenamePrefix(block.filePath));
  if (clusters.every(cluster => cluster.nodeIds.length === 1)) {
    return computeLayeredLayoutGeneric(blocks, links, 'lr', STORY_CONFIG);
  }

  const blockById = new Map(blocks.map(block => [block.id, block]));
  const positionedBlocks = new Map<string, Block>();
  const clusterNodes: LayoutNode[] = [];
  const clusterEdgesSet = new Set<string>();

  clusters.forEach(cluster => {
    const clusterBlocks = cluster.nodeIds.map(id => blockById.get(id)).filter((block): block is Block => !!block);
    const internalLinks = links.filter(link => cluster.nodeIds.includes(link.sourceId) && cluster.nodeIds.includes(link.targetId));
    const laidOut = computeLayeredLayoutGeneric(clusterBlocks, internalLinks, 'lr', STORY_CONFIG);

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
      width: Math.max(200, maxX - minX + STORY_CONFIG.clusterSpacingX),
      height: Math.max(180, maxY - minY + STORY_CONFIG.clusterSpacingY),
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

  const clusterLayout = computeLayeredLayoutGeneric(
    clusterNodes,
    Array.from(clusterEdgesSet).map(key => {
      const [sourceId, targetId] = key.split('->');
      return { sourceId, targetId };
    }),
    'lr',
    STORY_CONFIG,
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

/**
 * Computes story canvas layout with the specified mode and grouping strategy.
 *
 * This is the main entry point for Project Canvas (formerly Story Canvas) layout.
 * Supports four layout modes:
 * - `'flow-lr'`: Left-to-right Sugiyama layout (default)
 * - `'flow-td'`: Top-down Sugiyama layout
 * - `'connected-components'`: Left-to-right with disconnected components spaced apart
 * - `'clustered-flow'`: Two-level hierarchical layout with clustering
 *
 * The grouping mode only affects `'clustered-flow'` mode; other modes ignore it.
 * In clustered-flow, `'none'` grouping falls back to connected-component clustering.
 *
 * @param blocks - Array of blocks to layout
 * @param links - Array of directed links between blocks
 * @param layoutMode - Layout algorithm to use
 * @param groupingMode - Clustering strategy (only used for clustered-flow mode)
 * @returns Array of blocks with updated positions
 *
 * @complexity O(n²) worst case (clustered-flow), O(n log n) typical case
 * @see computeLayeredLayoutGeneric for flow-lr/flow-td/connected-components
 * @see computeClusteredLayout for clustered-flow
 */
export function computeStoryLayout(
  blocks: Block[],
  links: Link[],
  layoutMode: StoryCanvasLayoutMode,
  groupingMode: StoryCanvasGroupingMode,
): Block[] {
  switch (layoutMode) {
    case 'flow-td':
      return computeLayeredLayoutGeneric(blocks, links, 'td', STORY_CONFIG);
    case 'connected-components':
      return computeLayeredLayoutGeneric(blocks, links, 'lr', STORY_CONFIG);
    case 'clustered-flow':
      return computeClusteredLayout(blocks, links, groupingMode === 'none' ? 'connected-component' : groupingMode);
    case 'flow-lr':
    default:
      return computeLayeredLayoutGeneric(blocks, links, 'lr', STORY_CONFIG);
  }
}

/**
 * Computes a fingerprint string for layout cache invalidation.
 *
 * Generates a deterministic string representation of the layout inputs:
 * - Layout version (incremented when algorithm changes)
 * - Layout mode and grouping mode
 * - Sorted list of blocks (file path, dimensions)
 * - Sorted list of links (source→target, type)
 *
 * If the fingerprint matches the cached fingerprint, the cached layout can be reused.
 * Changing any block dimension, link, or layout mode invalidates the cache.
 *
 * @param blocks - Array of blocks
 * @param links - Array of links
 * @param layoutMode - Current layout mode
 * @param groupingMode - Current grouping mode
 * @returns Fingerprint string
 *
 * @complexity O(n log n) time (due to sorting), O(n) space
 */
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

/**
 * Builds a map of file paths to saved block layout data for persistence.
 *
 * Extracts position, dimensions, and color from each block and indexes by file path.
 * Blocks without a file path are skipped (should never happen for story blocks).
 * This data is saved to `.renide/project.json` and restored on project load.
 *
 * @param blocks - Array of blocks to persist
 * @returns Record mapping file paths to layout data
 *
 * @complexity O(n) time, O(n) space
 */
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
