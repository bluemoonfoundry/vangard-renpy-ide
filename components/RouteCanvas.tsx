/**
 * @file RouteCanvas.tsx
 * @description Label-by-label narrative flow visualization (521 lines).
 * Shows each label as a node and traces execution paths through the story.
 * Displays different routes in different colors for visual analysis of story paths.
 * Supports pan, zoom, drag labels, and navigation to editor.
 * Uses graph layout algorithm to arrange nodes without overlap.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import LabelBlock from './LabelBlock';
import FileBlock from './FileBlock';
import ViewRoutesPanel from './ViewRoutesPanel';
import Minimap from './Minimap';
import CanvasLayoutControls from './CanvasLayoutControls';
import CanvasToolbox from './CanvasToolbox';
import CanvasNavControls from './CanvasNavControls';
import MenuInspectorPanel from './MenuInspectorPanel';
import type { SelectedMenu, MenuPopoverChoice } from './MenuInspectorPanel';
import StickyNoteComponent from './StickyNote';
import CanvasContextMenu from './CanvasContextMenu';
import type { MinimapItem } from './Minimap';
import type { LabelNode, RouteLink, Position, IdentifiedRoute, MouseGestureSettings, StoryCanvasGroupingMode, StoryCanvasLayoutMode, StickyNote } from '../types';
import { computeRouteCanvasLayout } from '../lib/routeCanvasLayout';

interface RouteCanvasProps {
  labelNodes: LabelNode[];
  routeLinks: RouteLink[];
  identifiedRoutes: IdentifiedRoute[];
  routesTruncated?: boolean;
  stickyNotes: StickyNote[];
  updateLabelNodePositions: (updates: { id: string, position: Position }[]) => void;
  onAddStickyNote: (position: Position) => void;
  updateStickyNote: (id: string, data: Partial<StickyNote>) => void;
  deleteStickyNote: (id: string) => void;
  onOpenEditor: (blockId: string, line: number) => void;
  transform: { x: number, y: number, scale: number };
  onTransformChange: React.Dispatch<React.SetStateAction<{ x: number, y: number, scale: number }>>;
  mouseGestures?: MouseGestureSettings;
  layoutMode: StoryCanvasLayoutMode;
  groupingMode: StoryCanvasGroupingMode;
  onChangeLayoutMode: (mode: StoryCanvasLayoutMode) => void;
  onChangeGroupingMode: (mode: StoryCanvasGroupingMode) => void;
  centerOnStartRequest?: { key: number } | null;
  centerOnNodeRequest?: { nodeId: string; key: number } | null;
}

interface Rect { x: number; y: number; width: number; height: number; }

interface RouteNavigationEntry {
  nodeId: string | null;
  transform: { x: number; y: number; scale: number };
}

interface EdgeContextMenuState {
  x: number;
  y: number;
  link: RouteLink;
}

const getAttachmentPoint = (node: LabelNode, side: 'left' | 'right' | 'top' | 'bottom'): Position => {
    switch(side) {
        case 'left': return { x: node.position.x, y: node.position.y + node.height / 2 };
        case 'right': return { x: node.position.x + node.width, y: node.position.y + node.height / 2 };
        case 'top': return { x: node.position.x + node.width / 2, y: node.position.y };
        case 'bottom': return { x: node.position.x + node.width / 2, y: node.position.y + node.height };
    }
}

const getOptimalPath = (sourceNode: LabelNode, targetNode: LabelNode): [Position, Position] => {
    // If predominantly vertical alignment, prefer top/bottom connections
    const isVertical = Math.abs(targetNode.position.y - sourceNode.position.y) > Math.abs(targetNode.position.x - sourceNode.position.x);

    let sourcePoints, targetPoints;

    if (isVertical) {
        sourcePoints = {
            bottom: getAttachmentPoint(sourceNode, 'bottom'),
            top: getAttachmentPoint(sourceNode, 'top'),
        };
        targetPoints = {
            top: getAttachmentPoint(targetNode, 'top'),
            bottom: getAttachmentPoint(targetNode, 'bottom'),
        };
    } else {
        sourcePoints = {
            right: getAttachmentPoint(sourceNode, 'right'),
            left: getAttachmentPoint(sourceNode, 'left'),
        };
        targetPoints = {
            left: getAttachmentPoint(targetNode, 'left'),
            right: getAttachmentPoint(targetNode, 'right'),
        };
    }

    let bestPath: [Position, Position] | null = null;
    let minDistance = Infinity;

    for (const sKey of Object.keys(sourcePoints)) {
        for (const tKey of Object.keys(targetPoints)) {
            const p1 = (sourcePoints as Record<string, Position>)[sKey];
            const p2 = (targetPoints as Record<string, Position>)[tKey];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            
            // Penalize "backward" links slightly to encourage flow
            let penalty = 0;
            if (!isVertical && p1.x > p2.x) penalty = 100;
            if (isVertical && p1.y > p2.y) penalty = 100;

            if (dist + penalty < minDistance) {
                minDistance = dist + penalty;
                bestPath = [p1, p2];
            }
        }
    }
    
    // Fallback if something went wrong
    if (!bestPath) {
        return [getAttachmentPoint(sourceNode, 'right'), getAttachmentPoint(targetNode, 'left')];
    }

    return bestPath;
};

const Arrow: React.FC<{
  link: RouteLink;
  sourcePos: Position;
  targetPos: Position;
  sourceNode: LabelNode;
  targetNode: LabelNode;
  type: RouteLink['type'];
  color: string;
  isDimmed: boolean;
  onFollow: (link: RouteLink, target: 'source' | 'target') => void;
  onOpenContextMenu: (event: React.MouseEvent<SVGGElement>, link: RouteLink) => void;
}> = ({ link, sourcePos, targetPos, sourceNode, targetNode, type, color, isDimmed, onFollow, onOpenContextMenu }) => {
    const [isHovered, setIsHovered] = useState(false);
    const isVertical = Math.abs(targetPos.y - sourcePos.y) > Math.abs(targetPos.x - sourcePos.x);

    let pathData: string;

    if (isVertical) {
        const dy = targetPos.y - sourcePos.y;
        const midY = sourcePos.y + dy / 2;
        pathData = `M${sourcePos.x},${sourcePos.y} C${sourcePos.x},${midY} ${targetPos.x},${midY} ${targetPos.x},${targetPos.y}`;
    } else {
        const dx = targetPos.x - sourcePos.x;
        const midX = sourcePos.x + dx / 2;
        pathData = `M${sourcePos.x},${sourcePos.y} C${midX},${sourcePos.y} ${midX},${targetPos.y} ${targetPos.x},${targetPos.y}`;
    }

    return (
        <g
          className={`transition-opacity duration-300 ${isDimmed ? 'opacity-20' : 'opacity-100'}`}
          onPointerDown={event => event.stopPropagation()}
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => setIsHovered(false)}
          onClick={event => {
            event.stopPropagation();
            onFollow(link, event.altKey ? 'source' : 'target');
          }}
          onContextMenu={event => {
            event.preventDefault();
            event.stopPropagation();
            onOpenContextMenu(event, link);
          }}
          style={{ cursor: 'pointer', pointerEvents: 'all', filter: isHovered ? 'brightness(1.5) drop-shadow(0 0 4px currentColor)' : undefined }}
        >
          <title>{`Click to center ${targetNode.label}. Alt+click centers ${sourceNode.label}.`}</title>
          <path
              d={pathData}
              stroke="transparent"
              strokeWidth="18"
              fill="none"
              style={{ pointerEvents: 'all' }}
          />
          <path
              d={pathData}
              stroke={color}
              strokeWidth={isHovered ? 6 : 4}
              fill="none"
              strokeDasharray={type === 'implicit' ? "10, 6" : "none"}
              markerEnd={`url(#arrowhead-${color.replace('#', '')})`}
          />
          {type === 'call' && (
            <circle cx={sourcePos.x} cy={sourcePos.y} r={5} fill="none" stroke={color} strokeWidth={isHovered ? 3.5 : 2.5} />
          )}
        </g>
    );
};

const MenuPill: React.FC<{
  cx: number;
  cy: number;
  count: number;
  color: string;
  isActive: boolean;
  onClick: (e: React.MouseEvent<SVGGElement>) => void;
}> = ({ cx, cy, count, color, isActive, onClick }) => {
  const R = 11;
  return (
    <g
      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
      onPointerDown={e => e.stopPropagation()}
      onClick={onClick}
    >
      <circle cx={cx} cy={cy} r={R + 4} fill="transparent" />
      {isActive && <circle cx={cx} cy={cy} r={R + 3} fill="none" stroke="white" strokeWidth={2.5} opacity={0.85} />}
      <circle cx={cx} cy={cy} r={R} fill={color} opacity={0.95} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="white" strokeWidth={isActive ? 2 : 1.5} opacity={isActive ? 0.9 : 0.4} />
      <text
        x={cx} y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontFamily="sans-serif"
        fontWeight="700"
        fill="white"
      >
        {count > 9 ? '9+' : count}
      </text>
    </g>
  );
};

const RubberBand: React.FC<{ rect: Rect }> = ({ rect }) => {
    if (!rect) return null;
    return (
        <div
            className="absolute border-2 border-indigo-500 bg-indigo-500 bg-opacity-20 pointer-events-none"
            style={{
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
            }}
        />
    );
};

// Container for grouping labels visually
const BlockContainer: React.FC<{ 
    id: string; 
    title: string; 
    rect: Rect; 
    isDimmed: boolean; 
}> = ({ id: _id, title, rect, isDimmed }) => {
    // Add padding to the visual box
    const padding = 20;
    const x = rect.x - padding;
    const y = rect.y - padding - 30; // Extra top space for title
    const width = rect.width + padding * 2;
    const height = rect.height + padding * 2 + 30;

    return (
        <div 
            className={`absolute rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 transition-opacity duration-300 pointer-events-none ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
            style={{
                left: x,
                top: y,
                width: width,
                height: height,
                zIndex: 1, // Behind connections (in SVG) and nodes
            }}
        >
            <div className="absolute top-2 left-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate max-w-[90%]">
                {title}
            </div>
        </div>
    );
};

type InteractionState =
  | { type: 'idle' }
  | { type: 'panning'; }
  | { type: 'rubber-band'; start: Position; }
  | { type: 'dragging-nodes'; dragStartPositions: Map<string, Position>; };

const RouteCanvas: React.FC<RouteCanvasProps> = ({
  labelNodes: rawLabelNodes,
  routeLinks: rawRouteLinks,
  identifiedRoutes,
  routesTruncated,
  stickyNotes,
  updateLabelNodePositions,
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
  centerOnStartRequest,
  centerOnNodeRequest,
}) => {
  const [rubberBandRect, setRubberBandRect] = useState<Rect | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [checkedRoutes, setCheckedRoutes] = useState(new Set<number>());
  const [selectedMenu, setSelectedMenu] = useState<SelectedMenu | null>(null);
  const [isMenuPanelOpen, setIsMenuPanelOpen] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenuState | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number; worldPos: Position } | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [routeSearchQuery, setRouteSearchQuery] = useState('');
  const [showRouteSearchResults, setShowRouteSearchResults] = useState(false);
  const [navHistory, setNavHistory] = useState<RouteNavigationEntry[]>([]);
  const [navHistoryIndex, setNavHistoryIndex] = useState(-1);
  const [chooserMode, setChooserMode] = useState<'incoming' | 'outgoing' | null>(null);
  const [focusMode, setFocusMode] = useState<'none' | 'downstream' | 'upstream' | 'connected'>('none');
  const [traceMode, setTraceMode] = useState(false);
  const [tracePath, setTracePath] = useState<string[]>([]);
  const [traceIndex, setTraceIndex] = useState(0);
  const [traceChooserLinks, setTraceChooserLinks] = useState<RouteLink[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<RouteLink | null>(null);
  const [viewLevel, setViewLevel] = useState<'label' | 'file'>('label');

  // ── Phase 4: Narrative risk overlays + edge filters ──
  const [overlayMode, setOverlayMode] = useState<'none' | 'hubs' | 'branch-points' | 'menu-heavy' | 'call-heavy'>('none');
  const [hideImplicit, setHideImplicit] = useState(false);
  const [showOnlyCalls, setShowOnlyCalls] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const pendingDrillDownRef = useRef<string | null>(null);
  const interactionState = useRef<InteractionState>({ type: 'idle' });
  const pointerStartPos = useRef<Position>({ x: 0, y: 0 });
  // ── Filter: exclude underscore-prefixed reserved Ren'Py labels ──
  const labelNodes = useMemo(
    () => rawLabelNodes.filter(n => !n.label.startsWith('_')),
    [rawLabelNodes],
  );
  const routeLinks = useMemo(() => {
    const validIds = new Set(labelNodes.map(n => n.id));
    return rawRouteLinks.filter(l => validIds.has(l.sourceId) && validIds.has(l.targetId));
  }, [rawRouteLinks, labelNodes]);

  const labelNodeMap = useMemo(() => new Map(labelNodes.map(n => [n.id, n])), [labelNodes]);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // File-view graph: one node per file, one edge per cross-file transition
  const fileGraph = useMemo(() => {
    if (viewLevel === 'label') return null;
    const fileGroups = new Map<string, LabelNode[]>();
    labelNodes.forEach(node => {
      const group = fileGroups.get(node.blockId) ?? [];
      group.push(node);
      fileGroups.set(node.blockId, group);
    });
    const fileNodes: LabelNode[] = Array.from(fileGroups.entries()).map(([blockId, groupNodes]) => ({
      id: blockId,
      label: (groupNodes[0].containerName ?? blockId).replace(/\.[^.]+$/, ''),
      blockId,
      containerName: groupNodes[0].containerName,
      startLine: 1,
      position: { x: 0, y: 0 },
      width: 240,
      height: 80,
    }));
    const fileLinkMap = new Map<string, RouteLink>();
    routeLinks.forEach(link => {
      const src = labelNodeMap.get(link.sourceId);
      const tgt = labelNodeMap.get(link.targetId);
      if (!src || !tgt || src.blockId === tgt.blockId) return;
      const key = `${src.blockId}->${tgt.blockId}`;
      if (!fileLinkMap.has(key)) {
        fileLinkMap.set(key, { id: key, sourceId: src.blockId, targetId: tgt.blockId, type: link.type });
      }
    });
    const fileLinks = Array.from(fileLinkMap.values());
    const layoutedNodes = computeRouteCanvasLayout(fileNodes, fileLinks, layoutMode, groupingMode);
    const labelCountByFile = new Map<string, number>(
      Array.from(fileGroups.entries()).map(([id, g]) => [id, g.length])
    );
    return { nodes: layoutedNodes, links: fileLinks, labelCountByFile };
  }, [viewLevel, labelNodes, routeLinks, labelNodeMap, layoutMode, groupingMode]);

  // View-aware node map: label IDs in label view, blockIds in file view
  const nodeMap = useMemo(() =>
    viewLevel === 'file' && fileGraph
      ? new Map(fileGraph.nodes.map(n => [n.id, n]))
      : labelNodeMap,
    [viewLevel, fileGraph, labelNodeMap],
  );

  const closeTransientUi = useCallback(() => {
    setEdgeContextMenu(null);
    setCanvasContextMenu(null);
    setShowRouteSearchResults(false);
    setChooserMode(null);
    setTraceChooserLinks([]);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if ((e.target as HTMLElement).closest('.sticky-note-wrapper') || (e.target as HTMLElement).closest('.label-block-wrapper') || (e.target as HTMLElement).closest('.route-nav-panel') || (e.target as HTMLElement).closest('.view-routes-panel')) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (e.clientX - rect.left - transform.x) / transform.scale;
    const worldY = (e.clientY - rect.top - transform.y) / transform.scale;
    setCanvasContextMenu({ x: e.clientX, y: e.clientY, worldPos: { x: worldX, y: worldY } });
  }, [transform]);

  // Derive start→end label names for each identified route
  const routeLabels = useMemo(() => {
    const map = new Map<number, { startLabel: string; endLabel: string }>();
    const toLabel = (id: string) => nodeMap.get(id)?.label ?? id.split(':').slice(1).join(':');
    identifiedRoutes.forEach(route => {
      const links = routeLinks.filter(l => route.linkIds.has(l.id));
      if (links.length === 0) return;
      const sourceIds = new Set(links.map(l => l.sourceId));
      const targetIds = new Set(links.map(l => l.targetId));
      const startCandidates = [...sourceIds].filter(id => !targetIds.has(id));
      const endCandidates = [...targetIds].filter(id => !sourceIds.has(id));
      const startLabel = startCandidates.length > 0 ? toLabel(startCandidates[0]) : toLabel(links[0].sourceId);
      const endLabel = endCandidates.length > 0 ? toLabel(endCandidates[endCandidates.length - 1]) : toLabel(links[links.length - 1].targetId);
      map.set(route.id, { startLabel, endLabel });
    });
    return map;
  }, [identifiedRoutes, routeLinks, nodeMap]);

  // Entry node: the canonical 'start' label (Ren'Py convention)
  const entryNodeId = useMemo(() =>
    labelNodes.find(n => n.label === 'start')?.id ?? null,
  [labelNodes]);

  // Unreachable nodes: no incoming links and not the story entry point
  const unreachableNodeIds = useMemo(() => {
    const activeNodes = viewLevel === 'file' ? (fileGraph?.nodes ?? []) : labelNodes;
    const activeLinks = viewLevel === 'file' ? (fileGraph?.links ?? []) : routeLinks;
    const targeted = new Set(activeLinks.map(l => l.targetId));
    return new Set(activeNodes.filter(n => !targeted.has(n.id) && n.id !== entryNodeId).map(n => n.id));
  }, [viewLevel, fileGraph, routeLinks, labelNodes, entryNodeId]);

  // Dead-end nodes: no outgoing jumps from them
  const deadEndNodeIds = useMemo(() => {
    const activeNodes = viewLevel === 'file' ? (fileGraph?.nodes ?? []) : labelNodes;
    const activeLinks = viewLevel === 'file' ? (fileGraph?.links ?? []) : routeLinks;
    const sourced = new Set(activeLinks.map(l => l.sourceId));
    return new Set(activeNodes.filter(n => !sourced.has(n.id)).map(n => n.id));
  }, [viewLevel, fileGraph, routeLinks, labelNodes]);

  // ── Phase 4: Overlay node sets + counts ──

  /** Hub nodes: ≥3 incoming links (many paths converge) */
  const hubData = useMemo(() => {
    const activeLinks = viewLevel === 'file' ? (fileGraph?.links ?? []) : routeLinks;
    const counts = new Map<string, number>();
    activeLinks.forEach(link => counts.set(link.targetId, (counts.get(link.targetId) ?? 0) + 1));
    const set = new Set<string>();
    (viewLevel === 'file' ? (fileGraph?.nodes ?? []) : labelNodes).forEach(n => {
      if ((counts.get(n.id) ?? 0) >= 3) set.add(n.id);
    });
    return { set, counts };
  }, [viewLevel, fileGraph, labelNodes, routeLinks]);

  /** Branch-point nodes: ≥3 outgoing non-implicit links */
  const branchData = useMemo(() => {
    const activeLinks = viewLevel === 'file' ? (fileGraph?.links ?? []) : routeLinks;
    const counts = new Map<string, number>();
    activeLinks.filter(l => l.type !== 'implicit').forEach(link =>
      counts.set(link.sourceId, (counts.get(link.sourceId) ?? 0) + 1)
    );
    const set = new Set<string>();
    (viewLevel === 'file' ? (fileGraph?.nodes ?? []) : labelNodes).forEach(n => {
      if ((counts.get(n.id) ?? 0) >= 3) set.add(n.id);
    });
    return { set, counts };
  }, [viewLevel, fileGraph, labelNodes, routeLinks]);

  /** Menu-heavy nodes: ≥2 distinct menu groups as source (label view only) */
  const menuHeavyData = useMemo(() => {
    // Count distinct menus per node by iterating links grouped by sourceId+menuLine
    const distinctMenusByNode = new Map<string, Set<number>>();
    routeLinks.forEach(link => {
      if (link.menuLine === undefined) return;
      const s = distinctMenusByNode.get(link.sourceId) ?? new Set<number>();
      s.add(link.menuLine);
      distinctMenusByNode.set(link.sourceId, s);
    });
    const set = new Set<string>();
    const counts = new Map<string, number>();
    distinctMenusByNode.forEach((menus, nodeId) => {
      counts.set(nodeId, menus.size);
      if (menus.size >= 2) set.add(nodeId);
    });
    return { set, counts };
  }, [routeLinks]);

  /** Call-heavy nodes: ≥2 incoming call-type links */
  const callHeavyData = useMemo(() => {
    const activeLinks = viewLevel === 'file' ? (fileGraph?.links ?? []) : routeLinks;
    const counts = new Map<string, number>();
    activeLinks.filter(l => l.type === 'call').forEach(link =>
      counts.set(link.targetId, (counts.get(link.targetId) ?? 0) + 1)
    );
    const set = new Set<string>();
    (viewLevel === 'file' ? (fileGraph?.nodes ?? []) : labelNodes).forEach(n => {
      if ((counts.get(n.id) ?? 0) >= 2) set.add(n.id);
    });
    return { set, counts };
  }, [viewLevel, fileGraph, labelNodes, routeLinks]);

  /** Links to render after applying edge-type filters */
  const renderedLinks = useMemo(() => {
    const activeLinks = viewLevel === 'file' ? (fileGraph?.links ?? []) : routeLinks;
    if (!hideImplicit && !showOnlyCalls) return activeLinks;
    return activeLinks.filter(link => {
      if (showOnlyCalls) return link.type === 'call';
      if (hideImplicit) return link.type !== 'implicit';
      return true;
    });
  }, [viewLevel, fileGraph, routeLinks, hideImplicit, showOnlyCalls]);

  const outgoingLinksByNode = useMemo(() => {
    const activeLinks = viewLevel === 'file' ? (fileGraph?.links ?? []) : routeLinks;
    const map = new Map<string, RouteLink[]>();
    activeLinks.forEach(link => {
      const entries = map.get(link.sourceId) ?? [];
      entries.push(link);
      map.set(link.sourceId, entries);
    });
    return map;
  }, [viewLevel, fileGraph, routeLinks]);

  const incomingLinksByNode = useMemo(() => {
    const activeLinks = viewLevel === 'file' ? (fileGraph?.links ?? []) : routeLinks;
    const map = new Map<string, RouteLink[]>();
    activeLinks.forEach(link => {
      const entries = map.get(link.targetId) ?? [];
      entries.push(link);
      map.set(link.targetId, entries);
    });
    return map;
  }, [viewLevel, fileGraph, routeLinks]);

  const selectedNode = selectedNodeIds.length === 1 ? nodeMap.get(selectedNodeIds[0]) ?? null : null;
  const selectedOutgoingLinks = selectedNode ? (outgoingLinksByNode.get(selectedNode.id) ?? []) : [];
  const selectedIncomingLinks = selectedNode ? (incomingLinksByNode.get(selectedNode.id) ?? []) : [];

  // Focus mode: BFS from selected nodes in the chosen direction
  const focusedNodeIds = useMemo<Set<string> | null>(() => {
    if (focusMode === 'none' || traceMode || selectedNodeIds.length === 0) return null;
    const result = new Set<string>(selectedNodeIds);
    if (focusMode === 'downstream' || focusMode === 'connected') {
      const queue = [...selectedNodeIds];
      const visited = new Set<string>(selectedNodeIds);
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const link of outgoingLinksByNode.get(current) ?? []) {
          if (!visited.has(link.targetId)) {
            visited.add(link.targetId);
            result.add(link.targetId);
            queue.push(link.targetId);
          }
        }
      }
    }
    if (focusMode === 'upstream' || focusMode === 'connected') {
      const queue = [...selectedNodeIds];
      const visited = new Set<string>(selectedNodeIds);
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const link of incomingLinksByNode.get(current) ?? []) {
          if (!visited.has(link.sourceId)) {
            visited.add(link.sourceId);
            result.add(link.sourceId);
            queue.push(link.sourceId);
          }
        }
      }
    }
    return result;
  }, [focusMode, traceMode, selectedNodeIds, outgoingLinksByNode, incomingLinksByNode]);

  // Trace mode: set of nodes visited so far, and the edge IDs connecting them in order
  const traceNodeIds = useMemo<Set<string> | null>(() => {
    if (!traceMode || tracePath.length === 0) return null;
    return new Set(tracePath.slice(0, traceIndex + 1));
  }, [traceMode, tracePath, traceIndex]);

  const traceEdgeIds = useMemo<Set<string> | null>(() => {
    if (!traceMode || tracePath.length < 2) return null;
    const edgeSet = new Set<string>();
    const path = tracePath.slice(0, traceIndex + 1);
    for (let i = 0; i < path.length - 1; i++) {
      for (const link of outgoingLinksByNode.get(path[i]) ?? []) {
        if (link.targetId === path[i + 1]) edgeSet.add(link.id);
      }
    }
    return edgeSet;
  }, [traceMode, tracePath, traceIndex, outgoingLinksByNode]);

  const routeSearchResults = useMemo(() => {
    const query = routeSearchQuery.trim().toLowerCase();
    if (!query) return [];
    const searchSource = viewLevel === 'file' ? (fileGraph?.nodes ?? labelNodes) : labelNodes;
    return searchSource
      .filter(node =>
        node.label.toLowerCase().includes(query) ||
        (node.containerName ?? '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [viewLevel, fileGraph, labelNodes, routeSearchQuery]);

  const fitToScreen = useCallback(() => {
    const activeNodes = viewLevel === 'file' && fileGraph ? fileGraph.nodes : labelNodes;
    if (activeNodes.length === 0 || !canvasRef.current) return;
    const { width: cw, height: ch } = canvasRef.current.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    activeNodes.forEach(n => {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + n.width);
      maxY = Math.max(maxY, n.position.y + n.height);
    });
    const PAD = 80;
    const scale = Math.min((cw - PAD * 2) / (maxX - minX), (ch - PAD * 2) / (maxY - minY), 2);
    const tx = (cw - (maxX - minX) * scale) / 2 - minX * scale;
    const ty = (ch - (maxY - minY) * scale) / 2 - minY * scale;
    onTransformChange({ x: tx, y: ty, scale });
  }, [viewLevel, fileGraph, labelNodes, onTransformChange]);

  const centerOnNode = useCallback((nodeId: string, options?: { recordHistory?: boolean }) => {
    const node = nodeMap.get(nodeId);
    if (!node || !canvasRef.current) return;

    const { width, height } = canvasRef.current.getBoundingClientRect();
    const nextTransform = {
      x: (width / 2) - ((node.position.x + node.width / 2) * transform.scale),
      y: (height / 2) - ((node.position.y + node.height / 2) * transform.scale),
      scale: transform.scale,
    };

    if (options?.recordHistory ?? true) {
      setNavHistory(prev => {
        const currentEntry: RouteNavigationEntry = {
          nodeId: selectedNodeIds[0] ?? null,
          transform,
        };
        const base = prev.slice(0, navHistoryIndex + 1);
        return [...base, currentEntry, { nodeId, transform: nextTransform }];
      });
      setNavHistoryIndex(prev => prev + 2);
    }

    onTransformChange(nextTransform);
    setSelectedNodeIds([nodeId]);
    closeTransientUi();
  }, [nodeMap, selectedNodeIds, transform, navHistoryIndex, onTransformChange, closeTransientUi]);

  const lastHandledAutoCenterKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (!centerOnStartRequest) return;
    if (centerOnStartRequest.key === lastHandledAutoCenterKeyRef.current) return;
    lastHandledAutoCenterKeyRef.current = centerOnStartRequest.key;
    const startNode = labelNodes.find(n => n.label === 'start');
    if (startNode) centerOnNode(startNode.id, { recordHistory: false });
  }, [centerOnStartRequest, labelNodes, centerOnNode]);

  const lastHandledNodeRequestKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (!centerOnNodeRequest) return;
    if (centerOnNodeRequest.key === lastHandledNodeRequestKeyRef.current) return;
    lastHandledNodeRequestKeyRef.current = centerOnNodeRequest.key;
    centerOnNode(centerOnNodeRequest.nodeId, { recordHistory: true });
  }, [centerOnNodeRequest, centerOnNode]);

  const applyHistoryEntry = useCallback((index: number) => {
    const entry = navHistory[index];
    if (!entry) return;
    setNavHistoryIndex(index);
    onTransformChange(entry.transform);
    if (entry.nodeId) {
      setSelectedNodeIds([entry.nodeId]);
    }
    closeTransientUi();
  }, [navHistory, onTransformChange, closeTransientUi]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(entries => {
        if (entries[0]) {
            const { width, height } = entries[0].contentRect;
            setCanvasDimensions({ width, height });
        }
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'f' || e.key === 'F') fitToScreen();
      if (e.key === '[' && navHistoryIndex > 0) applyHistoryEntry(navHistoryIndex - 1);
      if (e.key === ']' && navHistoryIndex >= 0 && navHistoryIndex < navHistory.length - 1) applyHistoryEntry(navHistoryIndex + 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitToScreen, navHistory, navHistoryIndex, applyHistoryEntry]);

  const handleToggleRoute = (routeId: number) => {
    closeTransientUi();
    setCheckedRoutes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(routeId)) {
            newSet.delete(routeId);
        } else {
            newSet.add(routeId);
        }
        return newSet;
    });
  };

  const linkColors = useMemo(() => {
    if (checkedRoutes.size === 0) return null;

    const colorMap = new Map<string, string>();
    identifiedRoutes.forEach(route => {
        if (checkedRoutes.has(route.id)) {
            route.linkIds.forEach(linkId => {
                if (!colorMap.has(linkId)) { // First checked route containing the link wins
                    colorMap.set(linkId, route.color);
                }
            });
        }
    });
    return colorMap;
  }, [checkedRoutes, identifiedRoutes]);

  // Group visible choice links by (sourceId, menuLine) for per-menu pills (label view only)
  const menuGroups = useMemo(() => {
    if (viewLevel !== 'label') return new Map<string, { links: RouteLink[] }[]>();
    const groups = new Map<string, { links: RouteLink[] }[]>();
    routeLinks.forEach(link => {
      if (!link.choiceText || link.menuLine === undefined) return;
      if (linkColors && !linkColors.has(link.id)) return; // only show when route is highlighted
      const sourceNode = nodeMap.get(link.sourceId);
      if (!sourceNode) return;
      const key = `${link.sourceId}::${link.menuLine}`;
      const existing = groups.get(key);
      if (existing) {
        existing[0].links.push(link);
      } else {
        groups.set(key, [{ links: [link] }]);
      }
    });
    return groups;
  }, [viewLevel, routeLinks, linkColors, nodeMap]);

  const handleMenuPillClick = useCallback((e: React.MouseEvent<SVGGElement>, groupKey: string) => {
    e.stopPropagation();
    const group = menuGroups.get(groupKey);
    if (!group) return;
    const { links } = group[0];
    const firstLink = links[0];

    // Always show ALL choices for this menu block, not just those in the active route
    const allMenuLinks = routeLinks.filter(l =>
      l.sourceId === firstLink.sourceId &&
      l.menuLine === firstLink.menuLine &&
      l.choiceText !== undefined
    );

    const sourceLabel = nodeMap.get(firstLink.sourceId)?.label ?? firstLink.sourceId.split(':').slice(1).join(':');
    const choices: MenuPopoverChoice[] = allMenuLinks.map(link => {
      const routeColors: string[] = [];
      if (checkedRoutes.size > 0) {
        identifiedRoutes.forEach(route => {
          if (checkedRoutes.has(route.id) && route.linkIds.has(link.id)) {
            routeColors.push(route.color);
          }
        });
      }
      return {
        choiceText: link.choiceText!,
        choiceCondition: link.choiceCondition,
        targetLabel: nodeMap.get(link.targetId)?.label ?? link.targetId.split(':').slice(1).join(':'),
        sourceLine: link.sourceLine,
        blockId: link.sourceId.split(':')[0],
        routeColors,
      };
    });

    setSelectedMenu({ groupKey, sourceLabel, menuLine: firstLink.menuLine!, choices });
    setIsMenuPanelOpen(true);
    closeTransientUi();
  }, [menuGroups, nodeMap, routeLinks, checkedRoutes, identifiedRoutes, closeTransientUi]);

  const handleFollowLink = useCallback((link: RouteLink, target: 'source' | 'target') => {
    setSelectedEdge(link);
    centerOnNode(target === 'source' ? link.sourceId : link.targetId);
  }, [centerOnNode]);

  const handleStartTrace = useCallback(() => {
    const startId = selectedNodeIds[0];
    if (!startId) return;
    setTraceMode(true);
    setTracePath([startId]);
    setTraceIndex(0);
    setFocusMode('none');
    setTraceChooserLinks([]);
    centerOnNode(startId, { recordHistory: false });
  }, [selectedNodeIds, centerOnNode]);

  const handleExitTrace = useCallback(() => {
    setTraceMode(false);
    setTracePath([]);
    setTraceIndex(0);
    setTraceChooserLinks([]);
  }, []);

  const handleTraceStep = useCallback((direction: 'next' | 'prev') => {
    if (direction === 'prev') {
      if (traceIndex <= 0) return;
      const prevId = tracePath[traceIndex - 1];
      setTraceIndex(i => i - 1);
      setTraceChooserLinks([]);
      setSelectedNodeIds([prevId]);
      centerOnNode(prevId, { recordHistory: false });
      return;
    }
    // Advance along existing recorded path
    if (traceIndex < tracePath.length - 1) {
      const nextId = tracePath[traceIndex + 1];
      setTraceIndex(i => i + 1);
      setTraceChooserLinks([]);
      setSelectedNodeIds([nextId]);
      centerOnNode(nextId, { recordHistory: false });
      return;
    }
    // At end of path — try to extend
    const currentId = tracePath[traceIndex];
    const outgoing = outgoingLinksByNode.get(currentId) ?? [];
    if (outgoing.length === 0) return;
    if (outgoing.length === 1) {
      const nextId = outgoing[0].targetId;
      setTracePath(p => [...p, nextId]);
      setTraceIndex(i => i + 1);
      setTraceChooserLinks([]);
      setSelectedNodeIds([nextId]);
      centerOnNode(nextId, { recordHistory: false });
    } else {
      setTraceChooserLinks(outgoing);
    }
  }, [traceIndex, tracePath, outgoingLinksByNode, centerOnNode]);

  const handleTraceChoiceSelect = useCallback((nodeId: string) => {
    setTracePath(p => [...p, nodeId]);
    setTraceIndex(i => i + 1);
    setTraceChooserLinks([]);
    setSelectedNodeIds([nodeId]);
    centerOnNode(nodeId, { recordHistory: false });
  }, [centerOnNode]);

  const handleOpenEdgeContextMenu = useCallback((event: React.MouseEvent<SVGGElement>, link: RouteLink) => {
    setEdgeContextMenu({ x: event.clientX, y: event.clientY, link });
    setShowRouteSearchResults(false);
    setChooserMode(null);
  }, []);

  const handleChangeViewLevel = useCallback((level: 'label' | 'file') => {
    if (level === 'file' && traceMode) handleExitTrace();
    setViewLevel(level);
    setSelectedNodeIds([]);
    setSelectedEdge(null);
    closeTransientUi();
  }, [traceMode, handleExitTrace, closeTransientUi]);

  const handleDrillDown = useCallback((blockId: string) => {
    pendingDrillDownRef.current = blockId;
    setViewLevel('label');
    setSelectedNodeIds([]);
    closeTransientUi();
  }, [closeTransientUi]);

  // When returning to label view via drill-down, fit to the labels in that file
  useEffect(() => {
    if (viewLevel !== 'label') return;
    const targetBlockId = pendingDrillDownRef.current;
    if (!targetBlockId) return;
    pendingDrillDownRef.current = null;
    const blockLabels = labelNodes.filter(n => n.blockId === targetBlockId);
    if (blockLabels.length === 0 || !canvasRef.current) return;
    const { width: cw, height: ch } = canvasRef.current.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    blockLabels.forEach(n => {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + n.width);
      maxY = Math.max(maxY, n.position.y + n.height);
    });
    const PAD = 80;
    const dw = maxX - minX || 1;
    const dh = maxY - minY || 1;
    const scale = Math.min((cw - PAD * 2) / dw, (ch - PAD * 2) / dh, 2);
    const tx = (cw - dw * scale) / 2 - minX * scale;
    const ty = (ch - dh * scale) / 2 - minY * scale;
    onTransformChange({ x: tx, y: ty, scale });
  }, [viewLevel, labelNodes, onTransformChange]);

  // Compute Group Bounding Boxes (label view only)
  const blockGroups = useMemo(() => {
      if (viewLevel !== 'label') return [];
      const groups = new Map<string, { id: string, title: string, rect: Rect }>();

      labelNodes.forEach(node => {
          if (!groups.has(node.blockId)) {
              groups.set(node.blockId, {
                  id: node.blockId,
                  title: node.containerName || 'Block',
                  rect: { x: node.position.x, y: node.position.y, width: node.width, height: node.height }
              });
          } else {
              const group = groups.get(node.blockId)!;
              const minX = Math.min(group.rect.x, node.position.x);
              const minY = Math.min(group.rect.y, node.position.y);
              const maxX = Math.max(group.rect.x + group.rect.width, node.position.x + node.width);
              const maxY = Math.max(group.rect.y + group.rect.height, node.position.y + node.height);

              group.rect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          }
      });
      return Array.from(groups.values());
  }, [viewLevel, labelNodes]);

  const getPointInWorldSpace = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale,
    };
  }, [transform.x, transform.y, transform.scale]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const gestures = mouseGestures ?? { canvasPanGesture: 'shift-drag' as const, middleMouseAlwaysPans: false, zoomScrollDirection: 'normal' as const, zoomScrollSensitivity: 1.0 };
    const isMiddlePan = (gestures.canvasPanGesture === 'middle-drag' || gestures.middleMouseAlwaysPans) && e.button === 1;
    if (e.button !== 0 && !isMiddlePan) return;
    const targetEl = e.target as HTMLElement;

    // Prevent canvas interactions when interacting with the panel
    if (targetEl.closest('.view-routes-panel') || targetEl.closest('.layout-panel') || targetEl.closest('.route-nav-panel') || targetEl.closest('.route-edge-menu')) {
        return;
    }
    closeTransientUi();
    
    pointerStartPos.current = getPointInWorldSpace(e.clientX, e.clientY);
    
    const nodeWrapper = (e.target as HTMLElement).closest('.label-block-wrapper');
    const nodeId = nodeWrapper?.getAttribute('data-label-node-id');
    const canvasEl = e.currentTarget;

    if (nodeId && nodeMap.has(nodeId)) {
        const currentSelection = selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId];
        const dragStartPositions = new Map<string, Position>();
        currentSelection.forEach(id => {
            const node = nodeMap.get(id);
            if (node) dragStartPositions.set(id, node.position);
        });
        interactionState.current = { type: 'dragging-nodes', dragStartPositions };
        setIsDraggingSelection(true);

        if (e.shiftKey) {
            setSelectedNodeIds(prev => prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]);
        } else if (!selectedNodeIds.includes(nodeId)) {
            setSelectedNodeIds([nodeId]);
        }
    } else {
        const isPan =
            (gestures.canvasPanGesture === 'shift-drag' && e.shiftKey && e.button === 0) ||
            (gestures.canvasPanGesture === 'drag' && !e.shiftKey && e.button === 0) ||
            (gestures.canvasPanGesture === 'middle-drag' && e.button === 1) ||
            (gestures.middleMouseAlwaysPans && e.button === 1);
        if (isPan) {
            interactionState.current = { type: 'panning' };
        } else {
            interactionState.current = { type: 'rubber-band', start: pointerStartPos.current };
        }
        canvasEl.setPointerCapture(e.pointerId);
    }

    const handlePointerMove = (moveEvent: PointerEvent) => {
        const currentPos = getPointInWorldSpace(moveEvent.clientX, moveEvent.clientY);
        const dx = currentPos.x - pointerStartPos.current.x;
        const dy = currentPos.y - pointerStartPos.current.y;

        switch(interactionState.current.type) {
            case 'dragging-nodes': {
                const updates = Array.from(interactionState.current.dragStartPositions.entries()).map(([id, startPos]) => ({
                    id,
                    position: { x: startPos.x + dx, y: startPos.y + dy }
                }));
                updateLabelNodePositions(updates);
                break;
            }
            case 'panning': {
                onTransformChange(t => ({...t, x: t.x + moveEvent.movementX, y: t.y + moveEvent.movementY }));
                break;
            }
            case 'rubber-band': {
                const start = interactionState.current.start;
                const x = Math.min(start.x, currentPos.x);
                const y = Math.min(start.y, currentPos.y);
                const width = Math.abs(start.x - currentPos.x);
                const height = Math.abs(start.y - currentPos.y);
                setRubberBandRect({ x, y, width, height });
                break;
            }
        }
    };
    
    const handlePointerUp = (upEvent: PointerEvent) => {
        const state = interactionState.current;
        const pointerEndPos = getPointInWorldSpace(upEvent.clientX, upEvent.clientY);
        const startPos = pointerStartPos.current;

        const dx = pointerEndPos.x - startPos.x;
        const dy = pointerEndPos.y - startPos.y;
        const distance = Math.hypot(dx, dy);

        if (state.type === 'rubber-band') {
            if (distance > 5) {
                const finalRect: Rect = {
                    x: Math.min(startPos.x, pointerEndPos.x),
                    y: Math.min(startPos.y, pointerEndPos.y),
                    width: Math.abs(dx),
                    height: Math.abs(dy),
                };

                 const selectedInRect = labelNodes.filter(n => 
                    n.position.x < finalRect.x + finalRect.width &&
                    n.position.x + n.width > finalRect.x &&
                    n.position.y < finalRect.y + finalRect.height &&
                    n.position.y + n.height > finalRect.y
                ).map(n => n.id);
                
                if (upEvent.shiftKey) {
                    setSelectedNodeIds(prev => [...new Set([...prev, ...selectedInRect])]);
                } else {
                    setSelectedNodeIds(selectedInRect);
                }
            } else { // Click on canvas
                setSelectedNodeIds([]);
            }
        }
        
        setIsDraggingSelection(false);
        interactionState.current = { type: 'idle' };
        setRubberBandRect(null);
        if (canvasRef.current) canvasEl.releasePointerCapture(e.pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };
  
  // Setup manual wheel listener for non-passive behavior
  useEffect(() => {
      const el = canvasRef.current;
      if (!el) return;

      const onWheel = (e: WheelEvent) => {
          if ((e.target as HTMLElement).closest('.view-routes-panel') || (e.target as HTMLElement).closest('.layout-panel')) return;
          e.preventDefault(); // Stop browser native zoom/scroll
          const rect = el.getBoundingClientRect();
          const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          const gestures = mouseGestures ?? { canvasPanGesture: 'shift-drag' as const, middleMouseAlwaysPans: false, zoomScrollDirection: 'normal' as const, zoomScrollSensitivity: 1.0 };
          const sensitivity = gestures.zoomScrollSensitivity ?? 1.0;
          const direction = gestures.zoomScrollDirection === 'inverted' ? -1 : 1;

          onTransformChange(t => {
              const zoom = 1 - e.deltaY * 0.002 * sensitivity * direction;
              const newScale = Math.max(0.2, Math.min(3, t.scale * zoom));
              const worldX = (pointer.x - t.x) / t.scale;
              const worldY = (pointer.y - t.y) / t.scale;
              const newX = pointer.x - worldX * newScale;
              const newY = pointer.y - worldY * newScale;
              return { x: newX, y: newY, scale: newScale };
          });
      };

      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
  }, [onTransformChange, mouseGestures]);

  // Sticky-note drag: self-contained pointer capture so canvas pan doesn't interfere
  const handleNoteDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>, noteId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    // Don't capture for interactive elements — lets color picker, delete button, textarea work
    if ((e.target as HTMLElement).closest('button, textarea, input')) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const note = stickyNotes.find(n => n.id === noteId);
    if (!note) return;
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

  const backgroundStyle = {
    backgroundSize: `${32 * transform.scale}px ${32 * transform.scale}px`,
    backgroundPosition: `${transform.x}px ${transform.y}px`,
  };
  
  const svgBounds = useMemo(() => {
    const activeNodes = viewLevel === 'file' && fileGraph ? fileGraph.nodes : labelNodes;
    if (activeNodes.length === 0) return { top: 0, left: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    activeNodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.width);
      maxY = Math.max(maxY, node.position.y + node.height);
    });
    // Extra padding for block containers
    const PADDING = 300;
    return {
      left: minX - PADDING, top: minY - PADDING,
      width: (maxX - minX) + PADDING * 2, height: (maxY - minY) + PADDING * 2,
    };
  }, [viewLevel, fileGraph, labelNodes]);

  const minimapItems = useMemo((): MinimapItem[] => {
    const activeNodes = viewLevel === 'file' && fileGraph ? fileGraph.nodes : labelNodes;
    return activeNodes.map(n => ({ ...n, type: 'label' }));
  }, [viewLevel, fileGraph, labelNodes]);

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing bg-gray-100 dark:bg-gray-900 bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] dark:bg-[radial-gradient(#4b5563_1px,transparent_1px)]"
      style={backgroundStyle}
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
    >
      {/* ── Canvas Toolbox (top-left) — section order: Layout → Nav → Routes → Menu Inspector ── */}
      <CanvasToolbox label="Route Canvas">
        <CanvasLayoutControls
          canvasLabel="Route Canvas"
          layoutMode={layoutMode}
          groupingMode={groupingMode}
          onChangeLayoutMode={onChangeLayoutMode}
          onChangeGroupingMode={onChangeGroupingMode}
          viewLevel={viewLevel}
          onChangeViewLevel={handleChangeViewLevel}
          embedded
        />
        {/* ── Navigation: back/forward, go-to-label, focus, overlays, edge filters, trace, inspectors ── */}
        <div className="flex flex-col gap-2 p-2">

        {/* ── Row 1: Back / Forward / Go-to-label ── */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => applyHistoryEntry(navHistoryIndex - 1)}
            disabled={navHistoryIndex <= 0}
            title="Back ([)"
            aria-label="Back"
            className="h-8 w-8 shrink-0 rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 9H16a1 1 0 110 2H8.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
          </button>
          <button
            onClick={() => applyHistoryEntry(navHistoryIndex + 1)}
            disabled={navHistoryIndex < 0 || navHistoryIndex >= navHistory.length - 1}
            title="Forward (])"
            aria-label="Forward"
            className="h-8 w-8 shrink-0 rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 11H4a1 1 0 110-2h7.586L7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
          <input
            value={routeSearchQuery}
            onChange={event => {
              setRouteSearchQuery(event.target.value);
              setShowRouteSearchResults(true);
              setChooserMode(null);
              setEdgeContextMenu(null);
            }}
            onFocus={() => setShowRouteSearchResults(true)}
            placeholder="Go to label..."
            className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </div>
        {showRouteSearchResults && routeSearchQuery.trim() && (
          <div className="max-h-44 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
            {routeSearchResults.length > 0 ? routeSearchResults.map(node => (
              <button
                key={node.id}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => centerOnNode(node.id)}
              >
                <div className="font-mono text-gray-900 dark:text-gray-100">{node.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{node.containerName ?? 'Unknown file'}</div>
              </button>
            )) : (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No matching labels.</div>
            )}
          </div>
        )}

        {/* ── Focus mode controls ── */}
        {!traceMode && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Focus</span>
              {focusMode !== 'none' && selectedNodeIds.length > 0 && (
                <span className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400">active</span>
              )}
            </div>
            <div className="flex gap-1">
              {(['downstream', 'upstream', 'connected'] as const).map(mode => {
                const labels: Record<typeof mode, string> = { downstream: 'Down ↓', upstream: 'Up ↑', connected: 'Both ↕' };
                const titles: Record<typeof mode, string> = {
                  downstream: 'Show only nodes reachable from selection',
                  upstream: 'Show only nodes that lead to selection',
                  connected: 'Show all nodes connected to selection',
                };
                const active = focusMode === mode;
                return (
                  <button
                    key={mode}
                    title={titles[mode]}
                    onClick={() => setFocusMode(prev => prev === mode ? 'none' : mode)}
                    className={`flex-1 rounded-md border px-1.5 py-1 text-xs transition-colors ${
                      active
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {labels[mode]}
                  </button>
                );
              })}
              {focusMode !== 'none' && (
                <button
                  title="Clear focus"
                  aria-label="Clear focus"
                  onClick={() => setFocusMode('none')}
                  className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  ✕
                </button>
              )}
            </div>
            {focusMode !== 'none' && selectedNodeIds.length === 0 && (
              <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">Select a node to activate focus.</p>
            )}
          </div>
        )}

        {/* ── Overlays (narrative risk lenses) ── */}
        {viewLevel === 'label' && !traceMode && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Overlays</span>
              {overlayMode !== 'none' && (
                <button
                  onClick={() => setOverlayMode('none')}
                  className="text-[10px] text-red-400 hover:text-red-500 dark:hover:text-red-300"
                >
                  ✕ Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {([
                ['hubs',          'Hubs ↘',   'sky',    'Nodes with ≥3 incoming links — convergence points'],
                ['branch-points', 'Branches ↗','violet', 'Nodes with ≥3 outgoing links — heavy branch points'],
                ['menu-heavy',    'Menus ☰',  'rose',   'Nodes with multiple choice menus'],
                ['call-heavy',    'Calls ⇝',  'teal',   'Nodes called from many places'],
              ] as const).map(([mode, label, _color, title]) => {
                const active = overlayMode === mode;
                const activeClass: Record<string, string> = {
                  hubs:            'border-sky-500 bg-sky-600 text-white',
                  'branch-points': 'border-violet-500 bg-violet-600 text-white',
                  'menu-heavy':    'border-rose-500 bg-rose-600 text-white',
                  'call-heavy':    'border-teal-500 bg-teal-600 text-white',
                };
                return (
                  <button
                    key={mode}
                    title={title}
                    onClick={() => setOverlayMode(prev => prev === mode ? 'none' : mode)}
                    className={`rounded-md border px-1.5 py-1 text-xs transition-colors ${
                      active
                        ? activeClass[mode]
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Edge filters ── */}
        {!traceMode && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
            <div className="mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Edge Filters</span>
            </div>
            <div className="flex gap-1">
              <button
                title="Show only call edges — highlights reusable subflow structure"
                onClick={() => {
                  setShowOnlyCalls(v => {
                    if (!v) setHideImplicit(false); // mutually exclusive
                    return !v;
                  });
                }}
                className={`flex-1 rounded-md border px-1.5 py-1 text-xs transition-colors ${
                  showOnlyCalls
                    ? 'border-purple-500 bg-purple-600 text-white'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Calls only
              </button>
              <button
                title="Hide implicit fall-through edges"
                disabled={showOnlyCalls}
                onClick={() => setHideImplicit(v => !v)}
                className={`flex-1 rounded-md border px-1.5 py-1 text-xs transition-colors ${
                  hideImplicit && !showOnlyCalls
                    ? 'border-gray-500 bg-gray-600 text-white'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40'
                }`}
              >
                Hide implicit
              </button>
            </div>
          </div>
        )}

        {/* ── Trace mode / selected-node section (label view only) ── */}
        {viewLevel === 'label' && (traceMode ? (
          <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Trace Mode</span>
              <button
                onClick={handleExitTrace}
                title="Exit trace mode"
                aria-label="Exit trace mode"
                className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕ Exit
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTraceStep('prev')}
                disabled={traceIndex <= 0}
                title="Previous step"
                aria-label="Previous step"
                className="h-8 w-8 shrink-0 rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 9H16a1 1 0 110 2H8.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
              </button>
              <span className="flex-1 text-center text-xs text-gray-500 dark:text-gray-400">
                step {traceIndex + 1} / {tracePath.length}
              </span>
              <button
                onClick={() => handleTraceStep('next')}
                disabled={
                  traceIndex >= tracePath.length - 1 &&
                  (outgoingLinksByNode.get(tracePath[traceIndex])?.length ?? 0) === 0
                }
                title="Next step"
                aria-label="Next step"
                className="h-8 w-8 shrink-0 rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 11H4a1 1 0 110-2h7.586L7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <p className="truncate text-center text-xs font-mono text-gray-700 dark:text-gray-300">
              {nodeMap.get(tracePath[traceIndex])?.label ?? tracePath[traceIndex]}
            </p>
            {traceChooserLinks.length > 0 && (
              <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">
                  Choose next step
                </p>
                {traceChooserLinks.map(link => {
                  const node = nodeMap.get(link.targetId);
                  if (!node) return null;
                  return (
                    <button
                      key={link.id}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={() => handleTraceChoiceSelect(link.targetId)}
                    >
                      <div className="font-mono text-gray-900 dark:text-gray-100">{node.label}</div>
                      {link.choiceText && (
                        <div className="text-xs text-indigo-500 dark:text-indigo-400 truncate">&ldquo;{link.choiceText}&rdquo;</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : selectedNode ? (
          <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Selected: <span className="font-mono normal-case text-gray-900 dark:text-gray-100">{selectedNode.label}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => {
                  if (selectedIncomingLinks.length === 1) centerOnNode(selectedIncomingLinks[0].sourceId);
                  else if (selectedIncomingLinks.length > 1) setChooserMode(prev => prev === 'incoming' ? null : 'incoming');
                }}
                disabled={selectedIncomingLinks.length === 0}
                className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Prev ({selectedIncomingLinks.length})
              </button>
              <button
                onClick={() => {
                  if (selectedOutgoingLinks.length === 1) centerOnNode(selectedOutgoingLinks[0].targetId);
                  else if (selectedOutgoingLinks.length > 1) setChooserMode(prev => prev === 'outgoing' ? null : 'outgoing');
                }}
                disabled={selectedOutgoingLinks.length === 0}
                className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Next ({selectedOutgoingLinks.length})
              </button>
              <button
                onClick={handleStartTrace}
                title="Walk this graph one step at a time"
                className="rounded-md border border-indigo-200 dark:border-indigo-700 px-2 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
              >
                Trace ⇝
              </button>
            </div>
            {chooserMode && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
                {(chooserMode === 'incoming' ? selectedIncomingLinks : selectedOutgoingLinks).map(link => {
                  const node = nodeMap.get(chooserMode === 'incoming' ? link.sourceId : link.targetId);
                  if (!node) return null;
                  return (
                    <button
                      key={`${chooserMode}-${link.id}`}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={() => centerOnNode(node.id)}
                    >
                      <div className="font-mono text-gray-900 dark:text-gray-100">{node.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{node.containerName ?? 'Unknown file'}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null)}

        {/* ── Edge inspector ── */}
        {selectedEdge && (() => {
          const src = nodeMap.get(selectedEdge.sourceId);
          const tgt = nodeMap.get(selectedEdge.targetId);
          const typeColors: Record<string, string> = {
            jump: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
            call: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
            implicit: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
          };
          return (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Edge</span>
                <button
                  onClick={() => setSelectedEdge(null)}
                  title="Dismiss"
                  aria-label="Dismiss edge inspector"
                  className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-mono text-gray-700 dark:text-gray-300 truncate">{src?.label ?? selectedEdge.sourceId}</span>
                <span className="shrink-0 text-gray-400">→</span>
                <span className="font-mono text-gray-700 dark:text-gray-300 truncate">{tgt?.label ?? selectedEdge.targetId}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${typeColors[selectedEdge.type] ?? typeColors.implicit}`}>
                  {selectedEdge.type}
                </span>
                {selectedEdge.sourceLine !== undefined && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">line {selectedEdge.sourceLine}</span>
                )}
              </div>
              {selectedEdge.choiceText && (
                <p className="text-xs italic text-gray-600 dark:text-gray-400 truncate">&ldquo;{selectedEdge.choiceText}&rdquo;</p>
              )}
              {selectedEdge.choiceCondition && (
                <p className="font-mono text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-1.5 py-0.5 truncate">
                  if {selectedEdge.choiceCondition}
                </p>
              )}
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => centerOnNode(selectedEdge.sourceId)}
                  className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Center source
                </button>
                <button
                  onClick={() => centerOnNode(selectedEdge.targetId)}
                  className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Center target
                </button>
                {src && (
                  <button
                    onClick={() => onOpenEditor(src.blockId, src.startLine)}
                    className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Open source ↗
                  </button>
                )}
                {tgt && (
                  <button
                    onClick={() => onOpenEditor(tgt.blockId, tgt.startLine)}
                    className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Open target ↗
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        </div>
        <ViewRoutesPanel
          routes={identifiedRoutes}
          routesTruncated={routesTruncated}
          checkedRoutes={checkedRoutes}
          onToggleRoute={handleToggleRoute}
          routeLabels={routeLabels}
          embedded
        />
        <MenuInspectorPanel
          selectedMenu={selectedMenu}
          isOpen={isMenuPanelOpen}
          onToggle={() => setIsMenuPanelOpen(v => !v)}
          onOpenEditor={onOpenEditor}
          embedded
        />
      </CanvasToolbox>

      {/* ── Legend (top-right) ── */}
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
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-gray-400 ml-auto transition-transform ${showLegend ? '' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        {showLegend && (
          <div className="px-3 pb-3 pt-1 space-y-2 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Edges</p>
            <div className="flex items-center gap-2">
              <svg width="28" height="10" className="shrink-0">
                <path d="M0,5 L20,5" stroke="#4f46e5" strokeWidth="2.5" fill="none" />
                <polygon points="18,2 26,5 18,8" fill="#4f46e5" />
              </svg>
              Jump
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="10" className="shrink-0">
                <circle cx="4" cy="5" r="3.5" fill="none" stroke="#7c3aed" strokeWidth="2" />
                <path d="M8,5 L20,5" stroke="#7c3aed" strokeWidth="2.5" fill="none" />
                <polygon points="18,2 26,5 18,8" fill="#7c3aed" />
              </svg>
              Call <span className="text-gray-400 dark:text-gray-500">(circle = returns)</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="10" className="shrink-0">
                <path d="M0,5 L20,5" stroke="#94a3b8" strokeWidth="2.5" fill="none" strokeDasharray="4,2" />
                <polygon points="18,2 26,5 18,8" fill="#94a3b8" />
              </svg>
              Implicit flow
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" className="shrink-0">
                <circle cx="8" cy="8" r="7" fill="#4f46e5" opacity="0.9" />
                <text x="8" y="8" textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="bold" fill="white">2</text>
              </svg>
              Menu choices
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 pt-1">Nodes</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 shrink-0 rounded-full bg-green-500 border-2 border-white dark:border-gray-800 inline-block" />
              Entry (start)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 shrink-0 rounded-full bg-orange-400 border-2 border-white dark:border-gray-800 inline-block" />
              Unreachable
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 shrink-0 rounded-full bg-amber-500 border-2 border-white dark:border-gray-800 inline-block" />
              Dead end
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 pt-1">Overlays</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 shrink-0 rounded-full bg-sky-500 border-2 border-white dark:border-gray-800 inline-block" />
              Hub (≥3 incoming)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 shrink-0 rounded-full bg-violet-500 border-2 border-white dark:border-gray-800 inline-block" />
              Branch (≥3 outgoing)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 shrink-0 rounded-full bg-rose-500 border-2 border-white dark:border-gray-800 inline-block" />
              Menu-heavy (≥2 menus)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 shrink-0 rounded-full bg-teal-500 border-2 border-white dark:border-gray-800 inline-block" />
              Call-heavy (≥2 calls in)
            </div>
          </div>
        )}
      </div>
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Layer 0: Block Group Containers */}
        {blockGroups.map(group => (
            <BlockContainer 
                key={group.id} 
                id={group.id} 
                title={group.title} 
                rect={group.rect} 
                isDimmed={linkColors !== null} // Dim background containers if a route is selected
            />
        ))}

        <svg
          className="absolute pointer-events-none"
          style={{ left: svgBounds.left, top: svgBounds.top, width: svgBounds.width, height: svgBounds.height, zIndex: 5, overflow: 'visible' }}
        >
          <defs>
            {/* Markers: viewBox="0 0 10 10", triangle shape M0,0 L10,5 L0,10 z, bigger size 12x12 */}
            <marker id="arrowhead-4f46e5" viewBox="0 0 10 10" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L10,5 L0,10 z" fill="#4f46e5" />
            </marker>
            <marker id="arrowhead-7c3aed" viewBox="0 0 10 10" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L10,5 L0,10 z" fill="#7c3aed" />
            </marker>
            <marker id="arrowhead-94a3b8" viewBox="0 0 10 10" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
            </marker>
            {identifiedRoutes.map(route => (
                <marker key={route.id} id={`arrowhead-${route.color.replace('#', '')}`} viewBox="0 0 10 10" markerWidth="12" markerHeight="12" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0 L10,5 L0,10 z" fill={route.color} />
                </marker>
            ))}
          </defs>
          <g transform={`translate(${-svgBounds.left}, ${-svgBounds.top})`}>
            {renderedLinks.map((link) => {
              const sourceNode = nodeMap.get(link.sourceId);
              const targetNode = nodeMap.get(link.targetId);
              if (!sourceNode || !targetNode) return null;

              const [sourcePos, targetPos] = getOptimalPath(sourceNode, targetNode);

              let color = link.type === 'implicit' ? "#94a3b8" : link.type === 'call' ? "#7c3aed" : "#4f46e5";
              let isDimmed = false;

              if (viewLevel === 'file') {
                // In file view: only apply focus/trace dimming, no route coloring
                if (traceNodeIds && traceEdgeIds) {
                  isDimmed = !traceEdgeIds.has(link.id);
                } else if (focusedNodeIds) {
                  isDimmed = !focusedNodeIds.has(link.sourceId) || !focusedNodeIds.has(link.targetId);
                }
              } else {
                if (traceNodeIds && traceEdgeIds) {
                  isDimmed = !traceEdgeIds.has(link.id);
                  if (!isDimmed) color = linkColors?.get(link.id) ?? '#4f46e5';
                } else if (focusedNodeIds) {
                  isDimmed = !focusedNodeIds.has(link.sourceId) || !focusedNodeIds.has(link.targetId);
                  if (!isDimmed && linkColors?.has(link.id)) color = linkColors.get(link.id)!;
                } else if (linkColors) {
                  if (linkColors.has(link.id)) {
                    color = linkColors.get(link.id)!;
                  } else {
                    isDimmed = true;
                    color = '#9ca3af'; // gray
                  }
                }
              }

              return (
                <Arrow
                  key={link.id}
                  link={link}
                  sourcePos={sourcePos}
                  targetPos={targetPos}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                  type={link.type}
                  color={color}
                  isDimmed={isDimmed}
                  onFollow={handleFollowLink}
                  onOpenContextMenu={handleOpenEdgeContextMenu}
                />
              );
            })}
          </g>
        </svg>

        {rubberBandRect && <RubberBand rect={rubberBandRect} />}

        {/* Sticky notes */}
        {stickyNotes.map(note => (
          <div
            key={note.id}
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

        {viewLevel === 'file' && fileGraph
          ? fileGraph.nodes.map(node => {
              const isSelected = selectedNodeIds.includes(node.id);
              let isNodeDimmed = false;
              if (traceNodeIds) isNodeDimmed = !traceNodeIds.has(node.id);
              else if (focusedNodeIds) isNodeDimmed = !focusedNodeIds.has(node.id);
              return (
                <FileBlock
                  key={node.id}
                  node={node}
                  labelCount={fileGraph.labelCountByFile.get(node.id) ?? 0}
                  onDrillDown={handleDrillDown}
                  onOpenEditor={onOpenEditor}
                  isSelected={isSelected}
                  isDimmed={isNodeDimmed && !isSelected}
                />
              );
            })
          : labelNodes.map((node) => {
              const isSelected = selectedNodeIds.includes(node.id);
              let isNodeDimmed = false;
              if (traceNodeIds) isNodeDimmed = !traceNodeIds.has(node.id);
              else if (focusedNodeIds) isNodeDimmed = !focusedNodeIds.has(node.id);

              // Overlay: only active when overlayMode is set and the node matches
              let overlayHighlight: 'hub' | 'branch' | 'menu-heavy' | 'call-heavy' | null = null;
              let overlayCount: number | undefined;
              if (overlayMode === 'hubs' && hubData.set.has(node.id)) {
                overlayHighlight = 'hub';
                overlayCount = hubData.counts.get(node.id);
              } else if (overlayMode === 'branch-points' && branchData.set.has(node.id)) {
                overlayHighlight = 'branch';
                overlayCount = branchData.counts.get(node.id);
              } else if (overlayMode === 'menu-heavy' && menuHeavyData.set.has(node.id)) {
                overlayHighlight = 'menu-heavy';
                overlayCount = menuHeavyData.counts.get(node.id);
              } else if (overlayMode === 'call-heavy' && callHeavyData.set.has(node.id)) {
                overlayHighlight = 'call-heavy';
                overlayCount = callHeavyData.counts.get(node.id);
              }

              return (
                <LabelBlock
                  key={node.id}
                  node={node}
                  onOpenEditor={onOpenEditor}
                  isSelected={isSelected}
                  isDragging={isDraggingSelection && isSelected}
                  isEntry={node.id === entryNodeId}
                  isUnreachable={unreachableNodeIds.has(node.id)}
                  isDeadEnd={deadEndNodeIds.has(node.id)}
                  isDimmed={isNodeDimmed && !isSelected}
                  overlayHighlight={overlayHighlight}
                  overlayCount={overlayCount}
                />
              );
            })
        }

        {/* Menu pill overlay — rendered after node elements so pills are always on top */}
        {viewLevel === 'label' && (
          <svg
            className="absolute pointer-events-none"
            style={{ left: svgBounds.left, top: svgBounds.top, width: svgBounds.width, height: svgBounds.height, zIndex: 20, overflow: 'visible' }}
          >
            <g transform={`translate(${-svgBounds.left}, ${-svgBounds.top})`}>
              {Array.from(menuGroups.entries()).map(([key, group]) => {
                const { links } = group[0];
                const firstLink = links[0];
                const color = linkColors?.get(firstLink.id) ?? '#4f46e5';

                // Place the pill on the node's primary exit face for the current layout.
                // Using a fixed face (not averaged link endpoints) avoids the pill drifting
                // to the wrong side when backward links or mixed-direction links are present.
                const sourceNode = nodeMap.get(firstLink.sourceId);
                let cx = 0;
                let cy = 0;
                if (sourceNode) {
                  const side = layoutMode === 'flow-td' ? 'bottom' : 'right';
                  const anchor = getAttachmentPoint(sourceNode, side);
                  const ncx = sourceNode.position.x + sourceNode.width / 2;
                  const ncy = sourceNode.position.y + sourceNode.height / 2;
                  const dx = anchor.x - ncx;
                  const dy = anchor.y - ncy;
                  const dist = Math.hypot(dx, dy) || 1;
                  const offset = 11 + 10; // pill radius + gap
                  cx = anchor.x + (dx / dist) * offset;
                  cy = anchor.y + (dy / dist) * offset;
                }

                return (
                  <MenuPill
                    key={key}
                    cx={cx}
                    cy={cy}
                    count={links.length}
                    color={color}
                    isActive={selectedMenu?.groupKey === key}
                    onClick={(e) => handleMenuPillClick(e, key)}
                  />
                );
              })}
            </g>
          </svg>
        )}
      </div>
      {edgeContextMenu && (
        <div
          className="route-edge-menu fixed z-30 w-52 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
          style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
          onPointerDown={event => event.stopPropagation()}
        >
          <button className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => handleFollowLink(edgeContextMenu.link, 'target')}>
            Center target
          </button>
          <button className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => handleFollowLink(edgeContextMenu.link, 'source')}>
            Center source
          </button>
          <button className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => {
            const node = nodeMap.get(edgeContextMenu.link.targetId);
            if (node) onOpenEditor(node.blockId, node.startLine);
            closeTransientUi();
          }}>
            Open target in editor
          </button>
          <button className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700" onClick={() => {
            const node = nodeMap.get(edgeContextMenu.link.sourceId);
            if (node) onOpenEditor(node.blockId, node.startLine);
            closeTransientUi();
          }}>
            Open source in editor
          </button>
        </div>
      )}
      {/* ── Bottom-right cluster: Nav controls + Minimap ── */}
      <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-1.5" onPointerDown={e => e.stopPropagation()}>
        <CanvasNavControls
          onFit={fitToScreen}
          fitTitle="Fit all nodes to screen (F)"
          onGoToStart={() => {
            const startNode = labelNodes.find(n => n.label === 'start');
            if (startNode) centerOnNode(startNode.id, { recordHistory: true });
          }}
          hasStart={labelNodes.some(n => n.label === 'start')}
        />
        <Minimap
          items={minimapItems}
          transform={transform}
          canvasDimensions={canvasDimensions}
          onTransformChange={onTransformChange}
        />
      </div>
      {canvasContextMenu && (
        <CanvasContextMenu
          x={canvasContextMenu.x}
          y={canvasContextMenu.y}
          onClose={() => setCanvasContextMenu(null)}
          onAddStickyNote={() => onAddStickyNote(canvasContextMenu.worldPos)}
        />
      )}
    </div>
  );
};

export default RouteCanvas;
