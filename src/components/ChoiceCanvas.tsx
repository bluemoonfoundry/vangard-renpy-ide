/**
 * @file ChoiceCanvas.tsx
 * @description Choice-tree visualization for Ren'Py visual novels.
 *
 * Renders label nodes with an optional first-dialogue snippet and draws choice
 * edges (indigo) with the player-visible choice text and any `if` condition as
 * a badge along the arrow.  Non-choice jumps/calls are shown as gray arrows;
 * implicit fall-through edges can be toggled on.
 *
 * Writers see the player experience (choices → destinations) rather than the
 * code-structure view that Route Canvas provides.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import StickyNoteComponent from './StickyNote';
import CanvasContextMenu from './CanvasContextMenu';
import CanvasLayoutControls from './CanvasLayoutControls';
import CanvasToolbox from './CanvasToolbox';
import CanvasNavControls from './CanvasNavControls';
import Minimap from './Minimap';
import CanvasNodeContextMenu from './CanvasNodeContextMenu';
import type { MinimapItem } from './Minimap';
import type { LabelNode, RouteLink, MouseGestureSettings, RenpyAnalysisResult, StickyNote, StoryCanvasLayoutMode, StoryCanvasGroupingMode } from '@/types';
import { computeRouteCanvasLayout } from '@/lib/routeCanvasLayout';

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_W = 210;
const NODE_H = 58;
const SNIPPET_MAX = 44;
const LABEL_MAX = 26;
const FAN_STEP = 36; // horizontal spread between sibling choice edges (non-menu sources)

// Choice pill layout constants
const CHOICE_PILL_W = NODE_W;
const CHOICE_PILL_H = NODE_H;
const CHOICE_PILL_GAP = 8;        // vertical gap between pills in the same column
const CHOICE_PILL_OFFSET = 22;    // gap between menu node bottom and first pill row
const CHOICE_COLUMN_GAP = 40;     // horizontal breathing room between choice columns
const PILL_WRAP_CHARS = 28;
const LAYOUT_PILL_MARGIN = 34;    // extra breathing room below pill stack in layout
const TRUNK_TO_BRANCH = 10;       // vertical segment before the horizontal branch bar
const MENU_CORRIDOR_PAD_X = 34;

// Menu node shape
const NODE_BEVEL = 8;

/**
 * One colour entry per distinct destination route. Applied to pill borders,
 * text, and outgoing arrows so writers can immediately trace which choice
 * leads where, even when arrows cross.
 *
 * All strings are static Tailwind class literals so JIT includes them.
 */
const PILL_COLORS = [
  { border: 'stroke-indigo-400 dark:stroke-indigo-500',  fill: 'fill-indigo-50  dark:fill-indigo-950',  text: 'fill-indigo-700  dark:fill-indigo-300',  htmlText: 'text-indigo-700 dark:text-indigo-300',  arrow: 'stroke-indigo-400  dark:stroke-indigo-500'  },
  { border: 'stroke-violet-400 dark:stroke-violet-500',  fill: 'fill-violet-50  dark:fill-violet-950',  text: 'fill-violet-700  dark:fill-violet-300',  htmlText: 'text-violet-700 dark:text-violet-300',  arrow: 'stroke-violet-400  dark:stroke-violet-500'  },
  { border: 'stroke-sky-400    dark:stroke-sky-500',     fill: 'fill-sky-50     dark:fill-sky-950',     text: 'fill-sky-700     dark:fill-sky-300',     htmlText: 'text-sky-700 dark:text-sky-300',     arrow: 'stroke-sky-400     dark:stroke-sky-500'     },
  { border: 'stroke-emerald-400 dark:stroke-emerald-500',fill: 'fill-emerald-50 dark:fill-emerald-950', text: 'fill-emerald-700 dark:fill-emerald-300',  htmlText: 'text-emerald-700 dark:text-emerald-300', arrow: 'stroke-emerald-400 dark:stroke-emerald-500' },
  { border: 'stroke-orange-400 dark:stroke-orange-500',  fill: 'fill-orange-50  dark:fill-orange-950',  text: 'fill-orange-700  dark:fill-orange-300',  htmlText: 'text-orange-700 dark:text-orange-300',  arrow: 'stroke-orange-400  dark:stroke-orange-500'  },
  { border: 'stroke-pink-400   dark:stroke-pink-500',    fill: 'fill-pink-50    dark:fill-pink-950',    text: 'fill-pink-700    dark:fill-pink-300',    htmlText: 'text-pink-700 dark:text-pink-300',    arrow: 'stroke-pink-400    dark:stroke-pink-500'    },
] as const;

// ─── Utilities ────────────────────────────────────────────────────────────────

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current) lines.push(current);
    current = '';
  };

  words.forEach(word => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      return;
    }

    if (current) pushCurrent();

    if (word.length <= maxChars) {
      current = word;
      return;
    }

    let remaining = word;
    while (remaining.length > maxChars && lines.length < maxLines - 1) {
      lines.push(`${remaining.slice(0, maxChars - 1)}…`);
      remaining = remaining.slice(maxChars - 1);
    }
    current = remaining.length > maxChars ? `${remaining.slice(0, maxChars - 1)}…` : remaining;
  });

  pushCurrent();
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].slice(0, Math.max(1, maxChars - 1))}…`];
}

const RE_CHAR_DLG = /^([a-zA-Z0-9_]+)\s+"([^"]+)"/;
const RE_NARR_DLG = /^"([^"]+)"/;
const RE_SKIP = /^(label|menu|jump|call|return|scene|show|hide|play|stop|pause|window|with|extend|voice|\s*#|$)/;

/**
 * For each `blockId:labelName` node ID, finds the first dialogue or narration
 * line in that label's body and returns the raw text (without quotes).
 */
function buildSnippetMap(
  blocks: { id: string; content: string }[],
  labels: RenpyAnalysisResult['labels'],
  characterTags: Set<string>,
): Map<string, string> {
  const map = new Map<string, string>();

  // Group label locations by block
  const byBlock = new Map<string, { label: string; line: number }[]>();
  Object.values(labels).forEach(loc => {
    if (loc.type === 'menu') return;
    const arr = byBlock.get(loc.blockId) ?? [];
    arr.push({ label: loc.label, line: loc.line });
    byBlock.set(loc.blockId, arr);
  });

  blocks.forEach(blk => {
    const sorted = (byBlock.get(blk.id) ?? []).sort((a, b) => a.line - b.line);
    const lines = blk.content.split('\n');
    sorted.forEach((lbl, i) => {
      // lbl.line is 1-based; start scanning from the line *after* the label:
      const start = lbl.line;
      const end = i + 1 < sorted.length ? sorted[i + 1].line - 1 : lines.length;
      for (let j = start; j < end && j < lines.length; j++) {
        const t = (lines[j] ?? '').trim();
        if (RE_SKIP.test(t)) continue;
        const cm = t.match(RE_CHAR_DLG);
        if (cm && characterTags.has(cm[1])) { map.set(`${blk.id}:${lbl.label}`, cm[2]); break; }
        const nm = t.match(RE_NARR_DLG);
        if (nm) { map.set(`${blk.id}:${lbl.label}`, nm[1]); break; }
      }
    });
  });
  return map;
}

/**
 * Returns the SVG cubic-bezier path string and the visual midpoint (for badge
 * placement) for an edge from (srcX, srcY) to (tgtX, tgtY) with a horizontal
 * fan offset applied to the source attachment.
 *
 * Control points are placed vertically to produce a smooth S-curve.
 */
function edgePath(
  srcX: number, srcY: number,
  tgtX: number, tgtY: number,
  fanOff: number,
  straight = false,
): { d: string; mx: number; my: number } {
  const ox = srcX + fanOff;
  const d = straight
    ? `M ${ox} ${srcY} L ${tgtX} ${tgtY}`
    : (() => {
        const dy = tgtY - srcY;
        const cp = Math.max(Math.abs(dy) * 0.42, 52);
        const c1y = srcY + (dy >= 0 ? cp : -cp);
        const c2y = tgtY - (dy >= 0 ? cp : -cp);
        return `M ${ox} ${srcY} C ${ox} ${c1y}, ${tgtX} ${c2y}, ${tgtX} ${tgtY}`;
      })();
  // Midpoint is used for the edge badge placement.
  const mx = (ox + tgtX) / 2;
  const my = (srcY + tgtY) / 2;
  return { d, mx, my };
}

/**
 * Returns SVG path data for an octagonal (beveled-corner) rectangle.
 * Used to visually distinguish menu choice blocks from regular label nodes.
 */
function beveledRect(x: number, y: number, w: number, h: number, b: number): string {
  return (
    `M ${x + b} ${y} L ${x + w - b} ${y} ` +
    `L ${x + w} ${y + b} L ${x + w} ${y + h - b} ` +
    `L ${x + w - b} ${y + h} L ${x + b} ${y + h} ` +
    `L ${x} ${y + h - b} L ${x} ${y + b} Z`
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChoicePill {
  id: string;
  choiceText: string;
  condition: string | null;
  targetId: string;
  targetLabel: string;
  sourceBlockId: string;
  sourceLine: number | null;
  menuLine: number | null;
  linkId: string;
  x: number;
  y: number;
  h: number;        // fixed block height shared by menu nodes and choice blocks
  colorIdx: number; // index into PILL_COLORS — shared by all pills targeting the same node
}

interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxesOverlap(a: LayoutBox, b: LayoutBox, padX = 0, padY = 0): boolean {
  const aLeft = a.x - padX;
  const aTop = a.y - padY;
  const aRight = a.x + a.width + padX;
  const aBottom = a.y + a.height + padY;
  const bLeft = b.x - padX;
  const bTop = b.y - padY;
  const bRight = b.x + b.width + padX;
  const bBottom = b.y + b.height + padY;
  return !(aRight < bLeft || aLeft > bRight || aBottom < bTop || aTop > bBottom);
}

function nodeToBox(node: { position: { x: number; y: number }; width: number; height: number }): LayoutBox {
  return { x: node.position.x, y: node.position.y, width: node.width, height: node.height };
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ChoiceCanvasProps {
  labelNodes: LabelNode[];
  routeLinks: RouteLink[];
  blocks: { id: string; content: string }[];
  analysisResult: RenpyAnalysisResult;
  stickyNotes: StickyNote[];
  onAddStickyNote: (position: { x: number; y: number }) => void;
  updateStickyNote: (id: string, data: Partial<StickyNote>) => void;
  deleteStickyNote: (id: string) => void;
  onOpenEditor: (blockId: string, line: number) => void;
  transform: { x: number; y: number; scale: number };
  onTransformChange: React.Dispatch<React.SetStateAction<{ x: number; y: number; scale: number }>>;
  mouseGestures?: MouseGestureSettings;
  layoutMode: StoryCanvasLayoutMode;
  groupingMode: StoryCanvasGroupingMode;
  onChangeLayoutMode: (mode: StoryCanvasLayoutMode) => void;
  onChangeGroupingMode: (mode: StoryCanvasGroupingMode) => void;
  onWarpToLabel: (labelName: string) => void;
  centerOnStartRequest?: { key: number } | null;
  centerOnNodeRequest?: { nodeId: string; key: number } | null;
}

const ChoiceCanvas: React.FC<ChoiceCanvasProps> = ({
  labelNodes: rawLabelNodes,
  routeLinks: rawRouteLinks,
  blocks,
  analysisResult,
  stickyNotes,
  onAddStickyNote,
  updateStickyNote,
  deleteStickyNote,
  onOpenEditor,
  transform,
  onTransformChange,
  mouseGestures,
  layoutMode,
  groupingMode,
  onChangeLayoutMode,
  onChangeGroupingMode,
  onWarpToLabel,
  centerOnStartRequest,
  centerOnNodeRequest,
}) => {
  const [showSnippets, setShowSnippets] = useState(true);
  const [showImplicit, setShowImplicit] = useState(false);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number; worldPos: { x: number; y: number } } | null>(null);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');
  const [showLabelSearchResults, setShowLabelSearchResults] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  // Node selection for depth-1 highlight (single click)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedChoiceLinkId, setSelectedChoiceLinkId] = useState<string | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; node: LabelNode } | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [showLegend, setShowLegend] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const announceLiveRef = useRef<HTMLDivElement>(null);
  // Interaction state: idle | panning | node-press
  const istate = useRef<{ type: 'idle' | 'panning' | 'node'; nodeId?: string }>({ type: 'idle' });
  const startClient = useRef({ x: 0, y: 0 });
  const didMove = useRef(false);
  // Keep nodeMap in a ref so pointer-up handler always reads fresh data
  const nodeMapRef = useRef(new Map<string, LabelNode>());
  // Auto-fit runs once on first populated layout
  const hasFitted = useRef(false);
  // Click counting for single vs double click distinction
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef(0);

  // ── Filter: exclude underscore-prefixed reserved Ren'Py labels ──
  const labelNodes = useMemo(
    () => rawLabelNodes.filter(n => !n.label.startsWith('_')),
    [rawLabelNodes],
  );
  const routeLinks = useMemo(() => {
    const validIds = new Set(labelNodes.map(n => n.id));
    return rawRouteLinks.filter(l => validIds.has(l.sourceId) && validIds.has(l.targetId));
  }, [rawRouteLinks, labelNodes]);

  // ── Derived: character tags for dialogue detection ──
  const characterTags = useMemo(
    () => new Set(analysisResult.characters.keys()),
    [analysisResult.characters],
  );

  // ── Derived: first-dialogue snippet per node ──
  const snippetMap = useMemo(
    () => buildSnippetMap(blocks, analysisResult.labels, characterTags),
    [blocks, analysisResult.labels, characterTags],
  );

  // ── Derived: layout ──
  // Exclude implicit fall-through edges from layout so consecutive labels that
  // are also menu targets land in the same layer (side-by-side) rather than
  // in a sequential chain that stacks them vertically.
  const explicitLinks = useMemo(
    () => routeLinks.filter(l => l.type !== 'implicit'),
    [routeLinks],
  );

  // ── Derived: visible links ──
  const visibleLinks = useMemo(
    () => (showImplicit ? routeLinks : explicitLinks),
    [routeLinks, explicitLinks, showImplicit],
  );

  // ── Derived: which node IDs are "menu choice blocks" ──
  // A node is a menu choice block if it has any outgoing choice edges. We
  // derive this from the links rather than from `labels[x].type === 'menu'`
  // because choice jumps inside a plain `menu:` (no explicit label name) are
  // sourced from the containing label node, which has type 'label' — so the
  // type field in the labels map is not a reliable indicator here.
  const menuNodeIds = useMemo(() => {
    const ids = new Set<string>();
    visibleLinks.forEach(link => {
      if (link.choiceText) ids.add(link.sourceId);
    });
    return ids;
  }, [visibleLinks]);

  const menuLineByNodeId = useMemo(() => {
    const map = new Map<string, number>();
    visibleLinks.forEach(link => {
      if (!link.choiceText || link.menuLine === undefined) return;
      if (!map.has(link.sourceId)) map.set(link.sourceId, link.menuLine);
    });
    return map;
  }, [visibleLinks]);

  // ── Derived: fan info for sibling choice edges from non-menu sources ──
  const fanMap = useMemo(() => {
    const groups = new Map<string, string[]>(); // "srcId::menuLine" → [linkIds]
    routeLinks.forEach(l => {
      if (!l.choiceText || l.menuLine === undefined) return;
      if (menuNodeIds.has(l.sourceId)) return; // pills handle these
      const k = `${l.sourceId}::${l.menuLine}`;
      const arr = groups.get(k) ?? [];
      arr.push(l.id);
      groups.set(k, arr);
    });
    const info = new Map<string, { idx: number; total: number }>();
    groups.forEach(ids => ids.forEach((id, i) => info.set(id, { idx: i, total: ids.length })));
    return info;
  }, [routeLinks, menuNodeIds]);

  const nodeH = NODE_H;

  const baseLayoutNodes = useMemo(() => {
    const src = labelNodes.map(n => ({
      ...n,
      width: NODE_W,
      height: nodeH,
      position: { x: 0, y: 0 },
    }));
    return computeRouteCanvasLayout(src, explicitLinks, layoutMode, groupingMode);
  }, [labelNodes, explicitLinks, nodeH, layoutMode, groupingMode]);

  const buildChoicePillsForNodeMap = useCallback((srcNodeMap: Map<string, LabelNode>) => {
    const map = new Map<string, ChoicePill[]>();

    visibleLinks.forEach(link => {
      if (!link.choiceText || !menuNodeIds.has(link.sourceId)) return;
      if (!srcNodeMap.get(link.sourceId)) return;
      const arr = map.get(link.sourceId) ?? [];
      arr.push({
        id: `pill-${link.id}`,
        choiceText: link.choiceText,
        condition: link.choiceCondition ?? null,
        targetId: link.targetId,
        targetLabel: srcNodeMap.get(link.targetId)?.label ?? link.targetId.split(':').slice(1).join(':'),
        sourceBlockId: link.sourceId.split(':')[0],
        sourceLine: link.sourceLine ?? null,
        menuLine: link.menuLine ?? null,
        linkId: link.id,
        x: 0,
        y: 0,
        h: CHOICE_PILL_H,
        colorIdx: 0,
      });
      map.set(link.sourceId, arr);
    });

    map.forEach((pills, srcId) => {
      const src = srcNodeMap.get(srcId)!;
      const menuCX = src.position.x + src.width / 2;
      const baseY = src.position.y + nodeH + CHOICE_PILL_OFFSET;

      const uniqueTargets = [...new Set(pills.map(p => p.targetId))];
      const colorByTarget = new Map(uniqueTargets.map((tid, i) => [tid, i % PILL_COLORS.length]));
      pills.forEach(p => { p.colorIdx = colorByTarget.get(p.targetId) ?? 0; });

      if (uniqueTargets.length <= 1) {
        const startX = menuCX - CHOICE_PILL_W / 2;
        let y = baseY;
        pills.forEach(pill => {
          pill.x = startX;
          pill.y = y;
          y += pill.h + CHOICE_PILL_GAP;
        });
        return;
      }

      const grouped = new Map<string, ChoicePill[]>();
      pills.forEach(pill => {
        const arr = grouped.get(pill.targetId) ?? [];
        arr.push(pill);
        grouped.set(pill.targetId, arr);
      });

      const sortedGroups = [...grouped.entries()].sort((a, b) => {
        const ax = srcNodeMap.get(a[0])?.position.x ?? 0;
        const bx = srcNodeMap.get(b[0])?.position.x ?? 0;
        return ax - bx;
      });

      const colXs = sortedGroups.map(([targetId, _groupPills]) => {
        const targetNode = srcNodeMap.get(targetId);
        if (!targetNode) return menuCX - CHOICE_PILL_W / 2;
        const targetCX = targetNode.position.x + targetNode.width / 2;
        return targetCX - CHOICE_PILL_W / 2;
      });

      for (let i = 1; i < colXs.length; i++) {
        const minX = colXs[i - 1] + CHOICE_PILL_W + CHOICE_COLUMN_GAP;
        if (colXs[i] < minX) colXs[i] = minX;
      }

      sortedGroups.forEach(([_targetId, groupPills], gi) => {
        let y = baseY;
        groupPills.forEach(pill => {
          pill.x = colXs[gi];
          pill.y = y;
          y += pill.h + CHOICE_PILL_GAP;
        });
      });
    });

    return map;
  }, [visibleLinks, menuNodeIds, nodeH]);

  const baseNodeMap = useMemo(
    () => new Map(baseLayoutNodes.map(n => [n.id, n])),
    [baseLayoutNodes],
  );

  const baseChoicePillsByMenu = useMemo(
    () => buildChoicePillsForNodeMap(baseNodeMap),
    [buildChoicePillsForNodeMap, baseNodeMap],
  );

  const menuReserveBoxes = useMemo(() => {
    const boxes: LayoutBox[] = [];
    baseChoicePillsByMenu.forEach((pills, menuId) => {
      const src = baseNodeMap.get(menuId);
      if (!src || pills.length === 0) return;

      const minX = Math.min(src.position.x, ...pills.map(p => p.x));
      const maxX = Math.max(src.position.x + src.width, ...pills.map(p => p.x + CHOICE_PILL_W));
      const maxY = Math.max(src.position.y + nodeH, ...pills.map(p => p.y + p.h));

      boxes.push({
        x: minX - MENU_CORRIDOR_PAD_X,
        y: src.position.y + nodeH,
        width: (maxX - minX) + MENU_CORRIDOR_PAD_X * 2,
        height: (maxY - (src.position.y + nodeH)) + LAYOUT_PILL_MARGIN,
      });
    });
    return boxes;
  }, [baseChoicePillsByMenu, baseNodeMap, nodeH]);

  const layoutedNodes = useMemo(() => {
    const primaryAxis = layoutMode === 'flow-lr' ? 'x' : 'y';
    const crossAxis = layoutMode === 'flow-lr' ? 'y' : 'x';
    const primaryPad = 68;
    const crossPad = 76;
    const sorted = [...baseLayoutNodes].sort((a, b) => {
      const aMenu = menuNodeIds.has(a.id) ? 0 : 1;
      const bMenu = menuNodeIds.has(b.id) ? 0 : 1;
      if (aMenu !== bMenu) return aMenu - bMenu;
      const aPrimary = a.position[primaryAxis];
      const bPrimary = b.position[primaryAxis];
      if (aPrimary !== bPrimary) return aPrimary - bPrimary;
      return a.position[crossAxis] - b.position[crossAxis];
    });

    const resolved: typeof baseLayoutNodes = [];
    const fixedObstacles: LayoutBox[] = [
      ...menuReserveBoxes,
    ];

    const nodeBoxes = (node: typeof baseLayoutNodes[number]): LayoutBox => nodeToBox(node);
    const overlapCandidates = (box: LayoutBox) => [
      ...fixedObstacles,
      ...resolved.map(nodeBoxes),
    ].filter(candidate => boxesOverlap(box, candidate));

    sorted.forEach(node => {
      const next = { ...node };
      const isMenuNode = menuNodeIds.has(node.id);
      if (!isMenuNode) {
        let moved = true;
        while (moved) {
          moved = false;
          const overlaps = overlapCandidates(nodeBoxes(next));
          for (const obstacle of overlaps) {
            const primaryDelta = Math.abs((next.position as Record<string, number>)[primaryAxis] - obstacle[primaryAxis as keyof LayoutBox]);
            const primarySpan = ((next[primaryAxis === 'x' ? 'width' : 'height'] ?? 0) + obstacle[primaryAxis === 'x' ? 'width' : 'height']) / 2 + primaryPad;
            if (primaryDelta > primarySpan) continue;
            const obstacleCrossEnd = obstacle[crossAxis as keyof LayoutBox] + obstacle[crossAxis === 'x' ? 'width' : 'height'];
            const currentCross = (next.position as Record<string, number>)[crossAxis];
            const requiredCross = obstacleCrossEnd + crossPad;
            if (currentCross < requiredCross) {
              (next.position as Record<string, number>)[crossAxis] = requiredCross;
              moved = true;
            }
          }
        }
      }
      resolved.push(next);
    });

    return resolved;
  }, [baseLayoutNodes, layoutMode, menuNodeIds, menuReserveBoxes]);

  const nodeMap = useMemo(
    () => new Map(layoutedNodes.map(n => [n.id, n])),
    [layoutedNodes],
  );
  nodeMapRef.current = nodeMap;

  const choicePillsByMenu = useMemo(
    () => buildChoicePillsForNodeMap(nodeMap),
    [buildChoicePillsForNodeMap, nodeMap],
  );

  const openNodeEditor = useCallback((nodeId: string) => {
    const node = nodeMapRef.current.get(nodeId);
    if (!node) return;
    const line = menuLineByNodeId.get(nodeId) ?? node.startLine;
    onOpenEditor(node.blockId, line);
  }, [menuLineByNodeId, onOpenEditor]);

  const openChoiceEditor = useCallback((pill: ChoicePill) => {
    const line = pill.sourceLine ?? pill.menuLine;
    if (line !== null && line !== undefined) {
      onOpenEditor(pill.sourceBlockId, line);
    }
  }, [onOpenEditor]);

  // ── Derived: depth-1 highlight sets (null = no selection) ──
  const { highlightedNodeIds, highlightedLinkIds } = useMemo(() => {
    if (!selectedNodeId) return { highlightedNodeIds: null, highlightedLinkIds: null };
    const nodeIds = new Set<string>([selectedNodeId]);
    const linkIds = new Set<string>();
    visibleLinks.forEach(link => {
      if (link.sourceId === selectedNodeId || link.targetId === selectedNodeId) {
        linkIds.add(link.id);
        nodeIds.add(link.sourceId);
        nodeIds.add(link.targetId);
      }
    });
    return { highlightedNodeIds: nodeIds, highlightedLinkIds: linkIds };
  }, [selectedNodeId, visibleLinks]);

  // ── Derived: target node IDs connected to a selected menu node ──
  // Used to apply a gradient overlay on those nodes when a menu block is selected.
  const connectedTargetIds = useMemo(() => {
    if (!selectedNodeId || !menuNodeIds.has(selectedNodeId)) return null;
    const ids = new Set<string>();
    visibleLinks.forEach(link => {
      if (link.sourceId === selectedNodeId) ids.add(link.targetId);
    });
    return ids;
  }, [selectedNodeId, menuNodeIds, visibleLinks]);

  const selectedMenuChoices = useMemo(() => {
    if (!selectedNodeId || !menuNodeIds.has(selectedNodeId)) return [];
    return visibleLinks
      .filter(link => link.sourceId === selectedNodeId && !!link.choiceText)
      .map(link => ({
        ...link,
        targetLabel: nodeMap.get(link.targetId)?.label ?? link.targetId.split(':').slice(1).join(':'),
        sourceBlockId: link.sourceId.split(':')[0],
      }));
  }, [selectedNodeId, menuNodeIds, visibleLinks, nodeMap]);

  const selectedMenuSummary = useMemo(() => {
    if (!selectedNodeId || !menuNodeIds.has(selectedNodeId)) return null;
    const selectedNode = nodeMap.get(selectedNodeId);
    if (!selectedNode) return null;
    const uniqueTargets = new Set(selectedMenuChoices.map(choice => choice.targetId));
    const conditionalCount = selectedMenuChoices.filter(choice => !!choice.choiceCondition).length;
    return {
      node: selectedNode,
      menuLine: menuLineByNodeId.get(selectedNodeId) ?? selectedNode.startLine,
      choiceCount: selectedMenuChoices.length,
      uniqueTargetCount: uniqueTargets.size,
      conditionalCount,
      reconverges: uniqueTargets.size > 0 && uniqueTargets.size < selectedMenuChoices.length,
    };
  }, [selectedNodeId, menuNodeIds, nodeMap, selectedMenuChoices, menuLineByNodeId]);

  // ── Derived: minimap items ──
  const minimapItems = useMemo((): MinimapItem[] =>
    layoutedNodes.map(n => ({ ...n, type: 'label' as const })),
    [layoutedNodes],
  );

  // ── Fit to screen ──
  const fitToScreen = useCallback(() => {
    if (!svgRef.current || layoutedNodes.length === 0) return;
    const vp = svgRef.current.getBoundingClientRect();
    const pad = 52;
    const minX = Math.min(...layoutedNodes.map(n => n.position.x));
    const minY = Math.min(...layoutedNodes.map(n => n.position.y));
    const maxX = Math.max(...layoutedNodes.map(n => n.position.x + n.width));
    const maxY = Math.max(...layoutedNodes.map(n => n.position.y + n.height));
    const cw = maxX - minX || 1;
    const ch = maxY - minY || 1;
    const scale = Math.min((vp.width - pad * 2) / cw, (vp.height - pad * 2) / ch, 2);
    onTransformChange({
      x: (vp.width - cw * scale) / 2 - minX * scale,
      y: (vp.height - ch * scale) / 2 - minY * scale,
      scale,
    });
  }, [layoutedNodes, onTransformChange]);

  // ── Track canvas dimensions for minimap ──
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setCanvasDimensions({ width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Center on the 'start' label node ──
  const centerOnStart = useCallback(() => {
    const startNode = layoutedNodes.find(n => n.label === 'start');
    if (!startNode || !canvasAreaRef.current) return;
    const { width, height } = canvasAreaRef.current.getBoundingClientRect();
    onTransformChange(t => {
      const scale = Math.max(t.scale, 1.0);
      return {
        x: (width / 2) - ((startNode.position.x + startNode.width / 2) * scale),
        y: (height / 2) - ((startNode.position.y + startNode.height / 2) * scale),
        scale,
      };
    });
  }, [layoutedNodes, onTransformChange]);

  const hasStartNode = useMemo(() => layoutedNodes.some(n => n.label === 'start'), [layoutedNodes]);

  // Auto-fit once when layout is first populated.
  // If an auto-center-on-start request is already pending (e.g. initial project
  // open), skip fitToScreen so the centerOnStartRequest handler owns the viewport
  // and isn't overwritten 60 ms later by the fit.
  useEffect(() => {
    if (!hasFitted.current && layoutedNodes.length > 0) {
      hasFitted.current = true;
      if (centerOnStartRequest) {
        // Give the DOM the same 60 ms head-start it needs to be fully sized,
        // matching the delay used by fitToScreen below.
        setTimeout(centerOnStart, 60);
      } else {
        setTimeout(fitToScreen, 60);
      }
    }
  }, [layoutedNodes, fitToScreen, centerOnStart, centerOnStartRequest]);

  const lastHandledAutoCenterKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (!centerOnStartRequest) return;
    if (centerOnStartRequest.key === lastHandledAutoCenterKeyRef.current) return;
    lastHandledAutoCenterKeyRef.current = centerOnStartRequest.key;
    centerOnStart();
  }, [centerOnStartRequest, centerOnStart]);

  const labelSearchResults = useMemo(() => {
    const query = labelSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return layoutedNodes
      .filter(n =>
        n.label.toLowerCase().includes(query) ||
        (n.containerName ?? '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [layoutedNodes, labelSearchQuery]);

  const centerOnChoiceNode = useCallback((nodeId: string) => {
    const node = layoutedNodes.find(n => n.id === nodeId);
    if (!node || !canvasAreaRef.current) return;
    const { width, height } = canvasAreaRef.current.getBoundingClientRect();
    onTransformChange(t => {
      // Snap up to a readable zoom level if the canvas is very zoomed out,
      // but never zoom out from a zoom the user has already set.
      const scale = Math.max(t.scale, 1.0);
      return {
        x: (width / 2) - ((node.position.x + node.width / 2) * scale),
        y: (height / 2) - ((node.position.y + node.height / 2) * scale),
        scale,
      };
    });
    setShowLabelSearchResults(false);
    setLabelSearchQuery('');
  }, [layoutedNodes, onTransformChange]);

  const lastHandledNodeRequestKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (!centerOnNodeRequest) return;
    if (centerOnNodeRequest.key === lastHandledNodeRequestKeyRef.current) return;
    lastHandledNodeRequestKeyRef.current = centerOnNodeRequest.key;
    centerOnChoiceNode(centerOnNodeRequest.nodeId);
  }, [centerOnNodeRequest, centerOnChoiceNode]);

  // ── Wheel zoom ──
  // Attach to the always-rendered container div, not the SVG, so the listener
  // is registered regardless of whether the SVG is currently mounted (empty state).
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const sens = mouseGestures?.zoomScrollSensitivity ?? 1.0;
      const dir = mouseGestures?.zoomScrollDirection === 'inverted' ? -1 : 1;
      const delta = -e.deltaY * 0.001 * sens * dir;
      onTransformChange(t => {
        const ns = Math.max(0.05, Math.min(4, t.scale * (1 + delta)));
        const f = ns / t.scale;
        return { x: mx - f * (mx - t.x), y: my - f * (my - t.y), scale: ns };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onTransformChange, mouseGestures]);

  // ── Pointer: pan + node click ──
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const g = mouseGestures ?? {
      canvasPanGesture: 'shift-drag' as const,
      middleMouseAlwaysPans: false,
      zoomScrollDirection: 'normal' as const,
      zoomScrollSensitivity: 1,
    };
    const isMid = (g.canvasPanGesture === 'middle-drag' || g.middleMouseAlwaysPans) && e.button === 1;
    if (e.button !== 0 && !isMid) return;
    if ((e.target as Element).closest('.cc-controls')) return;

    didMove.current = false;
    startClient.current = { x: e.clientX, y: e.clientY };

    const nodeEl = (e.target as Element).closest('[data-ccnid]');
    if (nodeEl) {
      istate.current = { type: 'node', nodeId: nodeEl.getAttribute('data-ccnid') ?? '' };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const isPan =
      (g.canvasPanGesture === 'shift-drag' && e.shiftKey && e.button === 0) ||
      (g.canvasPanGesture === 'drag' && !e.shiftKey && e.button === 0) ||
      isMid;
    if (!isPan) return;
    istate.current = { type: 'panning' };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [mouseGestures]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (istate.current.type === 'idle') return;
    if (Math.hypot(e.clientX - startClient.current.x, e.clientY - startClient.current.y) > 4) {
      didMove.current = true;
    }
    if (istate.current.type === 'panning') {
      onTransformChange(t => ({ ...t, x: t.x + e.movementX, y: t.y + e.movementY }));
    }
  }, [onTransformChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const choiceEl = (e.target as Element).closest('[data-ccchoiceid]');
    if (choiceEl) {
      istate.current = { type: 'idle' };
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      return;
    }
    const s = istate.current;
    if (s.type === 'node' && !didMove.current && s.nodeId) {
      const nodeId = s.nodeId;
      clickCountRef.current += 1;
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        const count = clickCountRef.current;
        clickCountRef.current = 0;
        if (count >= 2) {
          // Double click: open editor
          openNodeEditor(nodeId);
        } else {
          // Single click: toggle selection highlight
          setSelectedNodeId(prev => (prev === nodeId ? null : nodeId));
          setSelectedChoiceLinkId(null);
        }
      }, 250);
    } else if (s.type === 'idle' || (s.type === 'panning' && !didMove.current)) {
      // Click on empty canvas: deselect
      setSelectedNodeId(null);
      setSelectedChoiceLinkId(null);
    }
    istate.current = { type: 'idle' };
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, [openNodeEditor]);

  const handleContextMenu = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    if ((e.target as Element).closest('.sticky-note-wrapper') || (e.target as Element).closest('.cc-controls')) return;
    if ((e.target as Element).closest('[data-ccnid]')) return;
    setSelectedNodeId(null);
    setSelectedChoiceLinkId(null);
    setNodeContextMenu(null);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (e.clientX - rect.left - transform.x) / transform.scale;
    const worldY = (e.clientY - rect.top - transform.y) / transform.scale;
    setCanvasContextMenu({ x: e.clientX, y: e.clientY, worldPos: { x: worldX, y: worldY } });
  }, [transform]);

  const handleNoteDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>, noteId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    // Don't capture for interactive elements — lets color picker, delete button, textarea work
    if ((e.target as HTMLElement).closest('button, textarea, input')) return;
    const note = stickyNotes.find(n => n.id === noteId);
    if (!note) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startWorldX = note.position.x;
    const startWorldY = note.position.y;
    setSelectedNoteIds([noteId]);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const onMove = (me: PointerEvent) => {
      const dx = (me.clientX - startClientX) / transform.scale;
      const dy = (me.clientY - startClientY) / transform.scale;
      updateStickyNote(noteId, { position: { x: startWorldX + dx, y: startWorldY + dy } });
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, [stickyNotes, transform.scale, updateStickyNote]);

  // ─────────────────────────────────────────────────────────────────────────────

  const isEmpty = layoutedNodes.length === 0;

  const announce = useCallback((msg: string) => {
    if (!announceLiveRef.current) return;
    announceLiveRef.current.textContent = '';
    requestAnimationFrame(() => {
      if (announceLiveRef.current) announceLiveRef.current.textContent = msg;
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const focusedEl = document.activeElement;
    const nodeId = focusedEl?.getAttribute?.('data-ccnid') ?? null;
    const node = nodeId ? layoutedNodes.find(n => n.id === nodeId) : null;

    if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedNodeId(null);
      announce('Selection cleared');
      return;
    }

    if (!node) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      openNodeEditor(node.id);
      return;
    }

    const dirMap: Record<string, [number, number]> = {
      ArrowRight: [1, 0], ArrowLeft: [-1, 0],
      ArrowDown: [0, 1], ArrowUp: [0, -1],
    };
    if (!(e.key in dirMap)) return;
    e.preventDefault();

    const [dx, dy] = dirMap[e.key];
    const cx = node.position.x + node.width / 2;
    const cy = node.position.y + node.height / 2;

    let best: typeof node | null = null;
    let bestScore = Infinity;
    for (const n of layoutedNodes) {
      if (n.id === node.id) continue;
      const nx = n.position.x + n.width / 2;
      const ny = n.position.y + n.height / 2;
      const dot = (nx - cx) * dx + (ny - cy) * dy;
      if (dot <= 0) continue;
      const perp = Math.abs((nx - cx) * dy - (ny - cy) * dx);
      const dist = Math.hypot(nx - cx, ny - cy);
      if (dist + perp * 1.5 < bestScore) { bestScore = dist + perp * 1.5; best = n; }
    }

    if (best) {
      const el = svgRef.current?.querySelector(`[data-ccnid="${best.id}"]`) as SVGGElement | null;
      el?.focus();
      setSelectedNodeId(best.id);
      announce(`${best.label} focused`);
    }
  }, [layoutedNodes, openNodeEditor, setSelectedNodeId, announce]);

  return (
    <div className="relative w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden select-none">

      {/* ── Toolbar ── */}
      <div className="cc-controls flex-none flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs z-10">
        <span className="font-semibold text-gray-600 dark:text-gray-300">Choices Canvas</span>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 shrink-0" />

        <button
          onClick={() => setShowSnippets(v => !v)}
          className={`px-2 py-0.5 rounded border transition-colors ${
            showSnippets
              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="Show first dialogue line on each label node"
        >
          Dialogue snippets
        </button>

        <button
          onClick={() => setShowImplicit(v => !v)}
          className={`px-2 py-0.5 rounded border transition-colors ${
            showImplicit
              ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="Show implicit fall-through edges between consecutive labels"
        >
          Fall-through edges
        </button>

      </div>

      {/* ── Canvas ── */}
      <div ref={canvasAreaRef} role="application" aria-label="Choice canvas" className="flex-1 relative overflow-hidden" onKeyDown={handleKeyDown}>
        <div ref={announceLiveRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
        {/* ── Canvas Toolbox (top-left) ── */}
        <CanvasToolbox label="Choices Canvas">
          <CanvasLayoutControls
            canvasLabel="Choices Canvas"
            layoutMode={layoutMode}
            groupingMode={groupingMode}
            onChangeLayoutMode={onChangeLayoutMode}
            onChangeGroupingMode={onChangeGroupingMode}
            allowedLayoutModes={['flow-td', 'flow-lr', 'connected-components']}
            showGrouping={false}
            embedded
          />
          {/* ── Go to Label ── */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-1.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Go to Label</h4>
            <input
              value={labelSearchQuery}
              onChange={e => {
                setLabelSearchQuery(e.target.value);
                setShowLabelSearchResults(true);
              }}
              onFocus={() => setShowLabelSearchResults(true)}
              placeholder="Search labels…"
              className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-sm"
            />
            {showLabelSearchResults && labelSearchQuery.trim() && (
              <div className="max-h-44 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
                {labelSearchResults.length > 0 ? labelSearchResults.map(node => (
                  <button
                    key={node.id}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => centerOnChoiceNode(node.id)}
                  >
                    <div className="font-mono text-gray-900 dark:text-gray-100">{node.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{node.containerName ?? 'Unknown file'}</div>
                  </button>
                )) : (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No matching labels.</div>
                )}
              </div>
            )}
          </div>

          {/* Choice Inspector */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Choice Inspector</h4>
              {selectedMenuSummary && (
                <button
                  className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
                  onClick={() => openNodeEditor(selectedMenuSummary.node.id)}
                >
                  Open menu source
                </button>
              )}
            </div>

            {!selectedMenuSummary ? (
              <div className="rounded-md border border-dashed border-gray-200 dark:border-gray-700 px-3 py-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Select a menu node to inspect its choices, destinations, and source lines.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate">{selectedMenuSummary.node.label}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        line {selectedMenuSummary.menuLine} · {selectedMenuSummary.choiceCount} choice{selectedMenuSummary.choiceCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[10px]">
                      {selectedMenuSummary.conditionalCount > 0 && (
                        <span className="rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5">
                          {selectedMenuSummary.conditionalCount} conditional
                        </span>
                      )}
                      {selectedMenuSummary.reconverges && (
                        <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5">
                          {selectedMenuSummary.uniqueTargetCount} destinations
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  {selectedMenuChoices.map((choice, idx) => (
                    <div
                      key={choice.id}
                      className={`px-3 py-2 space-y-1.5 transition-colors ${selectedChoiceLinkId === choice.id ? 'bg-amber-50/70 dark:bg-amber-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
                      onClick={() => {
                        setSelectedNodeId(choice.sourceId);
                        setSelectedChoiceLinkId(choice.id);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`text-xs break-words ${selectedChoiceLinkId === choice.id ? 'text-amber-900 dark:text-amber-100' : 'text-gray-900 dark:text-gray-100'}`}>
                            {idx + 1}. &ldquo;{choice.choiceText}&rdquo;
                          </div>
                          {choice.choiceCondition && (
                            <div className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-mono break-words ${selectedChoiceLinkId === choice.id ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                              if {choice.choiceCondition}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">line {choice.sourceLine ?? choice.menuLine ?? selectedMenuSummary.menuLine}</div>
                          <div className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 truncate max-w-[7rem]">
                            {choice.targetLabel}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <button
                          className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] hover:bg-gray-50 dark:hover:bg-gray-700"
                          onClick={() => {
                            const line = choice.sourceLine ?? choice.menuLine;
                            if (line !== undefined && line !== null) {
                              onOpenEditor(choice.sourceId.split(':')[0], line);
                            }
                          }}
                        >
                          Open source
                        </button>
                        <button
                          className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] hover:bg-gray-50 dark:hover:bg-gray-700"
                          onClick={() => onWarpToLabel(choice.targetLabel)}
                        >
                          Warp target
                        </button>
                        <button
                          className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] hover:bg-gray-50 dark:hover:bg-gray-700"
                          onClick={() => openNodeEditor(choice.targetId)}
                        >
                          Open target source
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CanvasToolbox>

        {/* ── Legend (top-right) ── */}
        {!isEmpty && (
          <div
            className="absolute top-4 right-4 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
            onPointerDown={e => e.stopPropagation()}
            onContextMenu={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowLegend(v => !v)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span>Legend</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-3.5 w-3.5 text-gray-400 ml-auto transition-transform ${showLegend ? '' : '-rotate-90'}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {showLegend && (
              <div className="px-3 pb-3 pt-1 space-y-1.5 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <svg width="22" height="8" className="shrink-0" aria-hidden="true">
                    <line x1="1" y1="4" x2="15" y2="4" stroke="rgb(129 140 248)" strokeWidth="2" />
                    <polygon points="13,1.5 21,4 13,6.5" fill="rgb(129 140 248)" />
                  </svg>
                  Choice
                </div>
                <div className="flex items-center gap-2">
                  <svg width="22" height="8" className="shrink-0" aria-hidden="true">
                    <line x1="1" y1="4" x2="15" y2="4" stroke="rgb(156 163 175)" strokeWidth="1.5" />
                    <polygon points="13,1.5 21,4 13,6.5" fill="rgb(156 163 175)" />
                  </svg>
                  Jump / Call
                </div>
                {showImplicit && (
                  <div className="flex items-center gap-2">
                    <svg width="22" height="8" className="shrink-0" aria-hidden="true">
                      <line x1="1" y1="4" x2="15" y2="4" stroke="rgb(209 213 219)" strokeWidth="1.5" strokeDasharray="4 3" />
                      <polygon points="13,1.5 21,4 13,6.5" fill="rgb(209 213 219)" />
                    </svg>
                    Fall-through
                  </div>
                )}
                <div className="pt-1 text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
                  Click a node to highlight · double-click to open the source
                </div>
              </div>
            )}
          </div>
        )}

        {isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            No labels found. Open a project to see the choice tree.
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="w-full h-full"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onContextMenu={handleContextMenu}
            onClick={e => { if (!(e.target as Element).closest('[data-ccnid]')) setSelectedNodeId(null); }}
          >
    <defs>
              {/*
                Single arrowhead marker that inherits the stroke color of the
                element using it via `context-stroke` (Chromium 99+).
              */}
              <marker
                id="cc-arr"
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M 0 0 L 7 3.5 L 0 7 z" fill="context-stroke" />
              </marker>

              {/*
                Gradient overlay applied to destination nodes when a menu
                choice block is selected — a subtle indigo wash from top to
                bottom signals the connection without hiding the label text.
              */}
              <linearGradient id="cc-conn-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.06" />
              </linearGradient>

              <filter id="cc-choice-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="
                    1 0 0 0 0.96
                    0 1 0 0 0.72
                    0 0 1 0 0.18
                    0 0 0 0.95 0"
                />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>

              {/* ── Edges (behind nodes) ── */}
              {visibleLinks.map(link => {
                const src = nodeMap.get(link.sourceId);
                const tgt = nodeMap.get(link.targetId);
                if (!src || !tgt) return null;

                const isChoice = !!link.choiceText;
                const isImplicit = link.type === 'implicit';

                // Choice edges from menu nodes are rendered via pills below — skip here
                if (isChoice && menuNodeIds.has(link.sourceId)) return null;

                const isHighlighted = !highlightedLinkIds || highlightedLinkIds.has(link.id);
                const fan = fanMap.get(link.id) ?? { idx: 0, total: 1 };
                const fanOff = fan.total > 1 ? (fan.idx - (fan.total - 1) / 2) * FAN_STEP : 0;

                const sx = src.position.x + src.width / 2;
                const sy = src.position.y + src.height;
                const tx = tgt.position.x + tgt.width / 2;
                const ty = tgt.position.y;
                const { d, mx, my } = edgePath(sx, sy, tx, ty, fanOff);

                const strokeClass = isChoice
                  ? 'stroke-indigo-400 dark:stroke-indigo-500'
                  : isImplicit
                  ? 'stroke-gray-300 dark:stroke-gray-500'
                  : 'stroke-gray-400 dark:stroke-gray-500';
                const sw = isChoice ? 2 : 1.5;
                const dash = isImplicit ? '5 4' : undefined;

                // Badge sizing (for non-menu choice edges)
                const cText = link.choiceText ? trunc(link.choiceText, 26) : null;
                const condText = link.choiceCondition ? trunc(link.choiceCondition, 22) : null;
                const badgeW = cText ? Math.max(cText.length * 5.8 + 18, 48) : 0;
                const badgeH = condText ? 30 : 16;

                return (
                  <g key={link.id} opacity={isHighlighted ? 1 : 0.12} style={{ transition: 'opacity 0.15s' }}>
                    <path
                      d={d}
                      className={`fill-none ${strokeClass}`}
                      strokeWidth={isHighlighted && highlightedLinkIds ? sw + 0.5 : sw}
                      strokeDasharray={dash}
                      markerEnd="url(#cc-arr)"
                    />

                    {/* Choice text badge (non-menu source fallback) */}
                    {cText && (
                      <g transform={`translate(${mx},${my})`}>
                        <rect
                          x={-badgeW / 2}
                          y={-badgeH / 2}
                          width={badgeW}
                          height={badgeH}
                          rx={4}
                          className="fill-white dark:fill-gray-800 stroke-indigo-100 dark:stroke-indigo-900"
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={condText ? -5 : 0}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={9}
                          fontStyle="italic"
                          className="fill-indigo-700 dark:fill-indigo-300"
                        >
                          {`"${cText}"`}
                        </text>
                        {condText && (
                          <text
                            x={0}
                            y={9}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={8}
                            className="fill-amber-700 dark:fill-amber-400"
                          >
                            {`if ${condText}`}
                          </text>
                        )}
                      </g>
                    )}
                  </g>
                );
              })}

              {/* ── Choice pills (above edges, below nodes) ── */}
              {/*
                For each menu node:
                  • Single destination  → vertical stack centred on the menu node
                  • Multiple destinations → pill columns spread horizontally toward
                    each target with a T-junction trunk; each destination group gets
                    a distinct colour (pill border + text + outgoing arrow) so writers
                    can trace any choice to its destination at a glance.
              */}
              {Array.from(choicePillsByMenu.entries()).map(([menuId, pills]) => {
                const src = nodeMap.get(menuId);
                if (!src || pills.length === 0) return null;

                const isHighlighted = !highlightedNodeIds || highlightedNodeIds.has(menuId);
                const menuCX = src.position.x + src.width / 2;
                // Use the visual node height, not the extended layout height
                const menuBottom = src.position.y + nodeH;
                const firstPillY = Math.min(...pills.map(p => p.y));

                // Unique X-centres of pill columns (sorted left→right)
                const colCXs = [...new Set(pills.map(p => p.x + CHOICE_PILL_W / 2))].sort((a, b) => a - b);
                const isMultiCol = colCXs.length > 1;
                const branchY = menuBottom + TRUNK_TO_BRANCH;

                return (
                  <g key={`pills-${menuId}`} opacity={isHighlighted ? 1 : 0.12} style={{ transition: 'opacity 0.15s' }}>

                    {/* ── Trunk / branch connector ── */}
                    {isMultiCol ? (
                      <>
                        {/* Vertical segment from menu bottom to horizontal bar */}
                        <line x1={menuCX} y1={menuBottom} x2={menuCX} y2={branchY}
                          className="stroke-gray-300 dark:stroke-gray-600"
                          strokeWidth={1.5} />
                        {/* Horizontal bar spanning all column centres */}
                        <line x1={colCXs[0]} y1={branchY} x2={colCXs[colCXs.length - 1]} y2={branchY}
                          className="stroke-gray-300 dark:stroke-gray-600"
                          strokeWidth={1.5} />
                        {/* Vertical drops from bar down to each column's first pill */}
                        {colCXs.map(cx => (
                          <line key={cx} x1={cx} y1={branchY} x2={cx} y2={firstPillY}
                            className="stroke-gray-300 dark:stroke-gray-600"
                            strokeWidth={1.5} />
                        ))}
                      </>
                    ) : (
                      /* Single column: plain vertical trunk */
                      <line x1={menuCX} y1={menuBottom} x2={colCXs[0] ?? menuCX} y2={firstPillY}
                        className="stroke-indigo-300 dark:stroke-indigo-600"
                        strokeWidth={1.5} />
                    )}

                    {pills.map(pill => {
                      const tgt = nodeMap.get(pill.targetId);
                      const pillCX = pill.x + CHOICE_PILL_W / 2;
                      const pillBottom = pill.y + pill.h;
                      const colors = PILL_COLORS[pill.colorIdx];
                      const wrappedChoice = wrapText(pill.choiceText, PILL_WRAP_CHARS, 2);
                      const wrappedCondition = pill.condition ? wrapText(`if ${pill.condition}`, PILL_WRAP_CHARS, 1) : [];
                      const isSelectedChoice = selectedChoiceLinkId === pill.linkId;
                      const sourceGlowPath = isSelectedChoice
                        ? edgePath(menuCX, menuBottom, pillCX, pill.y, 0)
                        : null;

                      // Arrow from pill bottom-center to target node top-center
                      const pillEdge = tgt
                        ? edgePath(pillCX, pillBottom, tgt.position.x + tgt.width / 2, tgt.position.y, 0)
                        : null;

                      const isLinkHighlighted = !highlightedLinkIds || highlightedLinkIds.has(pill.linkId);

                      return (
                        <g
                          key={pill.id}
                          data-ccchoiceid={pill.linkId}
                          role="button"
                          tabIndex={0}
                          aria-label={`Choice: ${pill.choiceText}${pill.condition ? `, if ${pill.condition}` : ''}`}
                          style={{ cursor: 'pointer' }}
                          aria-pressed={isSelectedChoice}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNodeId(menuId);
                            setSelectedChoiceLinkId(pill.linkId);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            openChoiceEditor(pill);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            e.stopPropagation();
                            openChoiceEditor(pill);
                          }}
                        >
                          {sourceGlowPath && (
                            <path
                              d={sourceGlowPath.d}
                              className="fill-none stroke-amber-400 dark:stroke-amber-300"
                              strokeWidth={2.5}
                              markerEnd="url(#cc-arr)"
                              filter="url(#cc-choice-glow)"
                            />
                          )}

                          {/* Pill → target arrow (colour-matched to pill) */}
                          {pillEdge && (
                            <path
                              d={pillEdge.d}
                              className={`fill-none ${colors.arrow}`}
                              strokeWidth={isSelectedChoice ? 3 : isLinkHighlighted && highlightedLinkIds ? 2 : 1.5}
                              markerEnd="url(#cc-arr)"
                              filter={isSelectedChoice ? 'url(#cc-choice-glow)' : undefined}
                            />
                          )}

                          {/* Pill body — rounded rectangle, no bevel, no shadow */}
                          <rect
                            x={pill.x}
                            y={pill.y}
                            width={CHOICE_PILL_W}
                            height={pill.h}
                            rx={10}
                            className={`${colors.fill} ${isSelectedChoice ? 'stroke-amber-400 dark:stroke-amber-300' : colors.border}`}
                            strokeWidth={isSelectedChoice ? 2 : 1}
                          />

                          <foreignObject
                            x={pill.x + 7}
                            y={pill.y + 4}
                            width={CHOICE_PILL_W - 14}
                            height={pill.h - 8}
                            pointerEvents="none"
                          >
                            <div
                              xmlns="http://www.w3.org/1999/xhtml"
                              className="h-full w-full flex flex-col items-center justify-center text-center overflow-hidden select-none"
                              title={pill.condition ? `"${pill.choiceText}" if ${pill.condition}` : `"${pill.choiceText}"`}
                            >
                              <div
                                className={`font-medium italic break-words ${colors.htmlText}`}
                                style={{
                                  fontSize: '9px',
                                  lineHeight: '1.12',
                                  display: '-webkit-box',
                                  WebkitBoxOrient: 'vertical',
                                  WebkitLineClamp: 2,
                                  overflow: 'hidden',
                                  maxWidth: '100%',
                                }}
                              >
                                {wrappedChoice.map((line, idx) => (
                                  <span key={idx} className="block">
                                    {idx === 0 ? `“${line}` : line}{idx === wrappedChoice.length - 1 ? '”' : ''}
                                  </span>
                                ))}
                              </div>
                              {wrappedCondition.length > 0 && (
                                <div
                                  className="mt-0.5 font-mono text-[8px] leading-tight text-amber-700 dark:text-amber-400 break-words"
                                  style={{
                                    display: '-webkit-box',
                                    WebkitBoxOrient: 'vertical',
                                    WebkitLineClamp: 1,
                                    overflow: 'hidden',
                                    maxWidth: '100%',
                                  }}
                                >
                                  {wrappedCondition[0]}
                                </div>
                              )}
                            </div>
                          </foreignObject>
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* ── Nodes (in front of edges and pills) ── */}
              {layoutedNodes.map(node => {
                const { id, label, position: { x, y } } = node;
                const snippet = snippetMap.get(id);
                const showSnip = showSnippets && !!snippet;
                const h = NODE_H;
                const snipDisplay = snippet ? `"${trunc(snippet, SNIPPET_MAX)}"` : null;
                const isSelected = id === selectedNodeId;
                const isNodeHighlighted = !highlightedNodeIds || highlightedNodeIds.has(id);
                const isMenuNode = menuNodeIds.has(id);
                const isConnectedTarget = !!connectedTargetIds?.has(id);
                const bodyFillClass = isSelected
                  ? 'fill-indigo-50 dark:fill-indigo-950 stroke-indigo-500 dark:stroke-indigo-400'
                  : 'fill-white dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600';
                const strokeW = isSelected ? 2 : 1.5;

                return (
                  <g
                    key={id}
                    data-ccnid={id}
                    tabIndex={0}
                    role="button"
                    aria-label={[isMenuNode ? `Menu node: ${label}` : `Label node: ${label}`, isSelected ? 'selected' : null].filter(Boolean).join(', ')}
                    aria-pressed={isSelected}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s', outline: 'none' }}
                    opacity={isNodeHighlighted ? 1 : 0.2}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedNodeId(id);
                      setNodeContextMenu({ x: e.clientX, y: e.clientY, node });
                    }}
                  >
                    {isMenuNode ? (
                      <>
                        {/*
                          Menu choice block: beveled (octagonal) rectangle with a
                          soft offset shadow — visually distinct from plain label nodes.
                        */}
                        <path
                          d={beveledRect(x + 1, y + 2, NODE_W, h, NODE_BEVEL)}
                          className="fill-black/[.06] dark:fill-black/25"
                        />
                        <path
                          d={beveledRect(x, y, NODE_W, h, NODE_BEVEL)}
                          className={bodyFillClass}
                          strokeWidth={strokeW}
                        />
                      </>
                    ) : (
                      <>
                        {/* Regular label node: rounded rectangle with drop shadow */}
                        <rect
                          x={x + 1} y={y + 2}
                          width={NODE_W} height={h}
                          rx={6}
                          className="fill-black/[.05] dark:fill-black/20"
                        />
                        <rect
                          x={x} y={y}
                          width={NODE_W} height={h}
                          rx={6}
                          className={bodyFillClass}
                          strokeWidth={strokeW}
                        />
                      </>
                    )}

                    {/*
                      Gradient overlay for destination nodes when the connected
                      menu choice block is selected. Reverts to normal when
                      the menu block is deselected (connectedTargetIds becomes null).
                    */}
                    {isConnectedTarget && (
                      isMenuNode ? (
                        <path
                          d={beveledRect(x, y, NODE_W, h, NODE_BEVEL)}
                          fill="url(#cc-conn-grad)"
                          style={{ pointerEvents: 'none' }}
                        />
                      ) : (
                        <rect
                          x={x} y={y}
                          width={NODE_W} height={h}
                          rx={6}
                          fill="url(#cc-conn-grad)"
                          style={{ pointerEvents: 'none' }}
                        />
                      )
                    )}

                    {/* Label name */}
                    <text
                      x={x + NODE_W / 2}
                      y={y + (showSnip ? 18 : h / 2 + 1)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={11}
                      fontWeight={600}
                      fontFamily="ui-monospace, monospace"
                      className="fill-gray-900 dark:fill-gray-100"
                    >
                      {trunc(label, LABEL_MAX)}
                    </text>

                    {/* Dialogue snippet */}
                    {showSnip && snipDisplay && (
                      <text
                        x={x + NODE_W / 2}
                        y={y + h - 13}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={9}
                        fontStyle="italic"
                        className="fill-gray-400 dark:fill-gray-500"
                      >
                        {snipDisplay}
                      </text>
                    )}

                    <title>
                      {isMenuNode
                        ? `Menu: ${label}\nDouble-click to open the menu source`
                        : `Label: ${label}\nDouble-click to open in editor`}
                    </title>
                  </g>
                );
              })}

            </g>
          </svg>
        )}

        {/* ── Sticky notes overlay ── */}
        {stickyNotes.length > 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: '0 0',
              }}
            >
              {stickyNotes.map(note => (
                <div
                  key={note.id}
                  style={{ pointerEvents: 'auto' }}
                  onPointerDown={e => handleNoteDragStart(e, note.id)}
                >
                  <StickyNoteComponent
                    note={note}
                    updateNote={updateStickyNote}
                    deleteNote={deleteStickyNote}
                    isSelected={selectedNoteIds.includes(note.id)}
                    isDragging={false}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Context menu ── */}
        {canvasContextMenu && (
          <CanvasContextMenu
            x={canvasContextMenu.x}
            y={canvasContextMenu.y}
            onClose={() => setCanvasContextMenu(null)}
            onAddStickyNote={() => onAddStickyNote(canvasContextMenu.worldPos)}
          />
        )}
        {nodeContextMenu && (
          <CanvasNodeContextMenu
            x={nodeContextMenu.x}
            y={nodeContextMenu.y}
            label={nodeContextMenu.node.label}
            onClose={() => setNodeContextMenu(null)}
            onOpenEditor={() => openNodeEditor(nodeContextMenu.node.id)}
            onWarpToHere={() => onWarpToLabel(nodeContextMenu.node.label)}
          />
        )}

        {/* ── Bottom-right cluster: Nav controls + Minimap ── */}
        {!isEmpty && (
          <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-1.5" onPointerDown={e => e.stopPropagation()}>
            <CanvasNavControls
              onFit={fitToScreen}
              fitTitle="Fit all nodes to screen"
              onGoToStart={centerOnStart}
              hasStart={hasStartNode}
            />
            <Minimap
              items={minimapItems}
              transform={transform}
              canvasDimensions={canvasDimensions}
              onTransformChange={onTransformChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChoiceCanvas;

