import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import type { Block, RenpyAnalysisResult, LabelNode, RouteLink, IdentifiedRoute, ProjectImage, ImageMetadata, RenpyAudio } from '../types';

interface StatsViewProps {
  blocks: Block[];
  analysisResult: RenpyAnalysisResult;
  routeAnalysisResult: { labelNodes: LabelNode[]; routeLinks: RouteLink[]; identifiedRoutes: IdentifiedRoute[] };
  projectImages: Map<string, ProjectImage>;
  imageMetadata: Map<string, ImageMetadata>;
  projectAudios: Map<string, RenpyAudio>;
  diagnosticsErrorCount: number;
  onOpenDiagnostics: () => void;
}

// ── Coverage types ────────────────────────────────────────────────────────────

interface CoverageRow {
  id: string;
  name: string;
  type: 'image' | 'audio';
  status: 'referenced' | 'missing' | 'orphaned';
}

type CoverageTypeFilter = 'all' | 'image' | 'audio';
type CoverageStatusFilter = 'all' | 'referenced' | 'missing' | 'orphaned';
type CoverageSortKey = 'name' | 'status' | 'type';
type CoverageSortDir = 'asc' | 'desc';

function countWordsInScript(script: string): number {
  if (!script) return 0;
  const DIALOGUE_NARRATION_REGEX = /(?:[a-zA-Z0-9_]+\s)?"((?:\\.|[^"\\])*)"/g;
  let total = 0;
  let match;
  while ((match = DIALOGUE_NARRATION_REGEX.exec(script)) !== null) {
    const text = match[1];
    if (text) total += text.trim().split(/\s+/).filter(Boolean).length;
  }
  return total;
}

// ── Complexity ────────────────────────────────────────────────────────────────

type ComplexityBucket = 'Linear' | 'Branching' | 'Complex' | 'Non-linear';

function getComplexityBucket(branchingCount: number, totalBlocks: number, routeCount: number): ComplexityBucket {
  const ratio = branchingCount / Math.max(1, totalBlocks);
  if (ratio > 0.5 || routeCount > 30) return 'Non-linear';
  if (ratio > 0.25 || routeCount > 12) return 'Complex';
  if (ratio > 0.08 || routeCount > 3) return 'Branching';
  return 'Linear';
}

const COMPLEXITY_COLORS: Record<ComplexityBucket, string> = {
  Linear: '#22c55e',
  Branching: '#6366f1',
  Complex: '#f59e0b',
  'Non-linear': '#ef4444',
};

const COMPLEXITY_DESCRIPTIONS: Record<ComplexityBucket, string> = {
  Linear: 'Mainly one path through the story',
  Branching: 'Several distinct story paths',
  Complex: 'Many intersecting routes and choices',
  'Non-linear': 'Highly interconnected — large route space',
};

// ── Path stats ────────────────────────────────────────────────────────────────

interface PathStats {
  endingCount: number;
  shortestPath: number | null;
  longestPath: number | null;
}

function computePathStats(
  labelNodes: LabelNode[],
  routeLinks: RouteLink[],
): PathStats {
  if (labelNodes.length === 0) return { endingCount: 0, shortestPath: null, longestPath: null };

  // Outgoing adjacency list keyed by node id
  const outgoing = new Map<string, string[]>();
  labelNodes.forEach(n => outgoing.set(n.id, []));
  routeLinks.forEach(link => {
    outgoing.get(link.sourceId)?.push(link.targetId);
  });

  const deadEndIds = new Set(
    labelNodes.filter(n => (outgoing.get(n.id)?.length ?? 0) === 0).map(n => n.id),
  );

  const entryNode = labelNodes.find(n => n.label === 'start');
  if (!entryNode || deadEndIds.size === 0) {
    return { endingCount: deadEndIds.size, shortestPath: null, longestPath: null };
  }

  // BFS: shortest hop count from start to any dead-end
  let shortestPath: number | null = null;
  const bfsQueue: [string, number][] = [[entryNode.id, 0]];
  const bfsVisited = new Set<string>([entryNode.id]);
  while (bfsQueue.length > 0) {
    const [nodeId, depth] = bfsQueue.shift()!;
    if (deadEndIds.has(nodeId)) { shortestPath = depth; break; }
    for (const nextId of (outgoing.get(nodeId) ?? [])) {
      if (!bfsVisited.has(nextId)) {
        bfsVisited.add(nextId);
        bfsQueue.push([nextId, depth + 1]);
      }
    }
  }

  // DFS: longest simple path from start to any dead-end (cycle-safe via in-stack set)
  let longestPath: number | null = null;
  const inStack = new Set<string>();

  function dfs(nodeId: string, depth: number) {
    if (inStack.has(nodeId)) return;
    if (deadEndIds.has(nodeId)) {
      if (longestPath === null || depth > longestPath) longestPath = depth;
      return;
    }
    inStack.add(nodeId);
    for (const nextId of (outgoing.get(nodeId) ?? [])) {
      dfs(nextId, depth + 1);
    }
    inStack.delete(nodeId);
  }

  dfs(entryNode.id, 0);

  return { endingCount: deadEndIds.size, shortestPath, longestPath };
}

// ── Shared components ─────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">{children}</h2>
);

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: string;
  onClick?: () => void;
}> = ({ label, value, sub, onClick }) => (
  <div
    className={`bg-secondary rounded-lg p-4 flex flex-col gap-1 ${onClick ? 'cursor-pointer hover:ring-1 hover:ring-indigo-400 transition-shadow' : ''}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
  >
    <span className="text-xs font-semibold text-secondary uppercase tracking-wide">{label}</span>
    <span className="text-2xl font-bold text-primary">{value}</span>
    {sub && <span className="text-xs text-secondary">{sub}</span>}
  </div>
);

// ── Character table (used when > 6 characters) ────────────────────────────────

type SortKey = 'name' | 'words';
type SortDir = 'asc' | 'desc';

const CharacterTable: React.FC<{
  data: { name: string; words: number; color: string }[];
}> = ({ data }) => {
  const [sortKey, setSortKey] = useState<SortKey>('words');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const totalDialogue = useMemo(() => data.reduce((s, d) => s + d.words, 0), [data]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') return mul * a.name.localeCompare(b.name);
      return mul * (a.words - b.words);
    });
  }, [data, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon: React.FC<{ col: SortKey }> = ({ col }) => (
    <span className={`ml-1 ${sortKey === col ? 'text-primary' : 'text-secondary opacity-40'}`}>
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-primary">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-tertiary border-b border-primary text-secondary text-xs">
            <th className="px-3 py-2 w-8" />
            <th
              className="px-3 py-2 text-left font-semibold cursor-pointer select-none"
              onClick={() => toggleSort('name')}
            >
              Character <SortIcon col="name" />
            </th>
            <th
              className="px-3 py-2 text-right font-semibold cursor-pointer select-none"
              onClick={() => toggleSort('words')}
            >
              Words <SortIcon col="words" />
            </th>
            <th className="px-3 py-2 pr-4 text-right font-semibold">Share</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const share = totalDialogue > 0 ? (row.words / totalDialogue) * 100 : 0;
            return (
              <tr key={row.name} className={`border-b border-primary last:border-0 ${i % 2 === 1 ? 'bg-secondary/20' : ''}`}>
                <td className="px-3 py-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                </td>
                <td className="px-3 py-2 font-medium text-primary">{row.name}</td>
                <td className="px-3 py-2 text-right tabular-nums text-secondary">
                  {row.words.toLocaleString()}
                </td>
                <td className="px-3 py-2 pr-4">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-20 h-1.5 bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${share}%`, backgroundColor: row.color }}
                      />
                    </div>
                    <span className="tabular-nums text-secondary text-xs w-10 text-right">
                      {share.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── File limit toggle ─────────────────────────────────────────────────────────

const FILE_LIMITS = [15, 30, 'all'] as const;
type FileLimit = typeof FILE_LIMITS[number];

const CHAR_LIMITS = [5, 15, 'all'] as const;
type CharLimit = typeof CHAR_LIMITS[number];

// ── Main component ────────────────────────────────────────────────────────────

const StatsView: React.FC<StatsViewProps> = ({
  blocks,
  analysisResult,
  routeAnalysisResult,
  projectImages,
  imageMetadata,
  projectAudios,
  diagnosticsErrorCount,
  onOpenDiagnostics,
}) => {
  const [fileLimit, setFileLimit] = useState<FileLimit>(15);
  const [charLimit, setCharLimit] = useState<CharLimit>(5);
  const [coverageTypeFilter, setCoverageTypeFilter] = useState<CoverageTypeFilter>('all');
  const [coverageStatusFilter, setCoverageStatusFilter] = useState<CoverageStatusFilter>('all');
  const [coverageTextFilter, setCoverageTextFilter] = useState('');
  const [coverageSortKey, setCoverageSortKey] = useState<CoverageSortKey>('status');
  const [coverageSortDir, setCoverageSortDir] = useState<CoverageSortDir>('asc');

  const { branchingBlockIds, labels, characters, dialogueLines } = analysisResult;
  const { identifiedRoutes, labelNodes, routeLinks } = routeAnalysisResult;

  const totalWords = useMemo(
    () => blocks.reduce((acc, b) => acc + countWordsInScript(b.content), 0),
    [blocks],
  );

  const characterWordCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const DIALOGUE_RE = /(?:[a-zA-Z0-9_]+\s)?"((?:\\.|[^"\\])*)"/;
    dialogueLines.forEach((lines, blockId) => {
      const block = blocks.find(b => b.id === blockId);
      if (!block) return;
      const scriptLines = block.content.split('\n');
      lines.forEach(dl => {
        const rawLine = scriptLines[dl.line] ?? '';
        const m = rawLine.match(DIALOGUE_RE);
        if (!m) return;
        const wordCount = m[1].trim().split(/\s+/).filter(Boolean).length;
        const tag = dl.tag || 'narrator';
        counts.set(tag, (counts.get(tag) ?? 0) + wordCount);
      });
    });
    return counts;
  }, [blocks, dialogueLines]);

  const { dialogueWords, narrationWords } = useMemo(() => {
    let dialogue = 0;
    let narration = 0;
    characterWordCounts.forEach((words, tag) => {
      if (tag === 'narrator') narration += words;
      else dialogue += words;
    });
    return { dialogueWords: dialogue, narrationWords: narration };
  }, [characterWordCounts]);

  const labelCount = useMemo(() => Object.keys(labels).length, [labels]);

  const complexity = useMemo(
    () => getComplexityBucket(branchingBlockIds.size, blocks.length, identifiedRoutes.length),
    [branchingBlockIds.size, blocks.length, identifiedRoutes.length],
  );

  const pathStats = useMemo(
    () => computePathStats(labelNodes, routeLinks),
    [labelNodes, routeLinks],
  );

  const charChartData = useMemo(() => {
    const data: { name: string; words: number; color: string }[] = [];
    characterWordCounts.forEach((words, tag) => {
      const char = characters.get(tag);
      data.push({ name: char?.name || tag, words, color: char?.color || '#6366f1' });
    });
    return data.sort((a, b) => b.words - a.words);
  }, [characterWordCounts, characters]);

  const displayedChars = useMemo(
    () => charLimit === 'all' ? charChartData : charChartData.slice(0, charLimit),
    [charChartData, charLimit],
  );

  const lineChartData = useMemo(() => {
    const all = blocks
      .map(b => ({
        name: b.title || b.filePath?.split('/').pop() || 'Untitled',
        lines: b.content.split('\n').length,
      }))
      .sort((a, b) => b.lines - a.lines);
    return fileLimit === 'all' ? all : all.slice(0, fileLimit);
  }, [blocks, fileLimit]);

  // ── Coverage computation ────────────────────────────────────────────────────

  const coverageData = useMemo(() => {
    // Collect all image tags and audio paths referenced in code
    const referencedImageTags = new Set<string>();
    const referencedAudioPaths = new Set<string>();

    for (const block of blocks) {
      if (!block.content) continue;
      for (const line of block.content.split('\n')) {
        const showMatch = line.match(/^\s*(?:show|scene)\s+([a-zA-Z0-9_ ]+)/);
        if (showMatch) {
          const rawTag = showMatch[1].trim();
          if (!['expression', 'layer', 'screen'].includes(rawTag.split(' ')[0])) {
            referencedImageTags.add(rawTag);
          }
        }
        const audioMatch = line.match(/^\s*(?:play|queue)\s+\w+\s+(.+)/);
        if (audioMatch) {
          const content = audioMatch[1].trim();
          const quotedMatch = content.match(/^["']([^"']+)["']/);
          if (quotedMatch) {
            referencedAudioPaths.add(quotedMatch[1]);
          } else {
            const firstToken = content.split(/\s+/)[0];
            if (firstToken !== 'expression') referencedAudioPaths.add(firstToken);
          }
        }
      }
    }

    // Build canonical image name → ProjectImage map
    const imageByName = new Map<string, ProjectImage>();
    // All known tags (name + fullTag) for prefix-matching
    const knownImageNames = new Set<string>();

    projectImages.forEach(img => {
      const meta = imageMetadata.get(img.projectFilePath || img.filePath);
      const name = meta?.renpyName || img.fileName.split('.').slice(0, -1).join('.');
      imageByName.set(name, img);
      knownImageNames.add(name);
      if (meta?.tags?.length) {
        knownImageNames.add(`${name} ${meta.tags.join(' ')}`.trim());
      }
    });
    // Also include image X definitions from code
    analysisResult.definedImages.forEach(tag => knownImageNames.add(tag));

    // Determine which canonical image names are referenced
    const referencedImageNames = new Set<string>();
    referencedImageTags.forEach(refTag => {
      // A projectImage with `name` is referenced if refTag === name or starts with name + ' '
      imageByName.forEach((_, name) => {
        if (refTag === name || refTag.startsWith(name + ' ')) {
          referencedImageNames.add(name);
        }
      });
      // Also cover `image X Y` defines that aren't projectImages
      knownImageNames.forEach(knownTag => {
        if (refTag === knownTag || refTag.startsWith(knownTag + ' ')) {
          // mark as "covered" so we don't emit a missing row for refTag
        }
      });
    });

    const rows: CoverageRow[] = [];

    // Rows for project images (referenced or orphaned)
    imageByName.forEach((img, name) => {
      rows.push({
        id: `image:${img.filePath}`,
        name,
        type: 'image',
        status: referencedImageNames.has(name) ? 'referenced' : 'orphaned',
      });
    });

    // Rows for missing images (referenced in code but no project file / define)
    referencedImageTags.forEach(refTag => {
      // Check if covered by any known image name (prefix match)
      const parts = refTag.split(' ');
      let covered = false;
      for (let i = 1; i <= parts.length; i++) {
        if (knownImageNames.has(parts.slice(0, i).join(' '))) { covered = true; break; }
      }
      if (!covered) {
        rows.push({ id: `missing-image:${refTag}`, name: refTag, type: 'image', status: 'missing' });
      }
    });

    // Build audio lookup: all path/name variants → RenpyAudio
    const audioByKey = new Map<string, RenpyAudio>();
    projectAudios.forEach(aud => {
      audioByKey.set(aud.fileName, aud);
      const noExt = aud.fileName.split('.').slice(0, -1).join('.');
      if (noExt) audioByKey.set(noExt, aud);
      if (aud.projectFilePath) audioByKey.set(aud.projectFilePath.replace(/\\/g, '/'), aud);
      if (aud.filePath) audioByKey.set(aud.filePath.replace(/\\/g, '/'), aud);
    });

    // Determine which audio files are referenced
    const referencedAudioFileNames = new Set<string>();
    const missingAudioPaths: string[] = [];
    referencedAudioPaths.forEach(refPath => {
      let found = false;
      audioByKey.forEach((aud, key) => {
        if (key.endsWith(refPath) || refPath.endsWith(key)) {
          found = true;
          referencedAudioFileNames.add(aud.fileName);
        }
      });
      if (!found) missingAudioPaths.push(refPath);
    });

    // Rows for project audio
    const seenAudioFiles = new Set<string>();
    projectAudios.forEach(aud => {
      if (seenAudioFiles.has(aud.fileName)) return;
      seenAudioFiles.add(aud.fileName);
      rows.push({
        id: `audio:${aud.filePath}`,
        name: aud.fileName,
        type: 'audio',
        status: referencedAudioFileNames.has(aud.fileName) ? 'referenced' : 'orphaned',
      });
    });

    // Rows for missing audio
    missingAudioPaths.forEach(refPath => {
      rows.push({ id: `missing-audio:${refPath}`, name: refPath, type: 'audio', status: 'missing' });
    });

    const imageRows = rows.filter(r => r.type === 'image');
    const audioRows = rows.filter(r => r.type === 'audio');

    return {
      rows,
      imageTotal: imageRows.length,
      imageReferenced: imageRows.filter(r => r.status === 'referenced').length,
      imageMissing: imageRows.filter(r => r.status === 'missing').length,
      imageOrphaned: imageRows.filter(r => r.status === 'orphaned').length,
      audioTotal: audioRows.length,
      audioReferenced: audioRows.filter(r => r.status === 'referenced').length,
      audioMissing: audioRows.filter(r => r.status === 'missing').length,
      audioOrphaned: audioRows.filter(r => r.status === 'orphaned').length,
    };
  }, [blocks, projectImages, imageMetadata, projectAudios, analysisResult.definedImages]);

  const coverageRows = useMemo(() => {
    let list = coverageData.rows;
    if (coverageTypeFilter !== 'all') list = list.filter(r => r.type === coverageTypeFilter);
    if (coverageStatusFilter !== 'all') list = list.filter(r => r.status === coverageStatusFilter);
    if (coverageTextFilter) {
      const lower = coverageTextFilter.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(lower));
    }
    return [...list].sort((a, b) => {
      const mul = coverageSortDir === 'asc' ? 1 : -1;
      if (coverageSortKey === 'name') return mul * a.name.localeCompare(b.name);
      if (coverageSortKey === 'type') return mul * a.type.localeCompare(b.type);
      // status: referenced < orphaned < missing (most urgent last)
      const statusOrder = { referenced: 0, orphaned: 1, missing: 2 };
      return mul * (statusOrder[a.status] - statusOrder[b.status]);
    });
  }, [coverageData.rows, coverageTypeFilter, coverageStatusFilter, coverageTextFilter, coverageSortKey, coverageSortDir]);

  function toggleCoverageSort(key: CoverageSortKey) {
    if (coverageSortKey === key) setCoverageSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setCoverageSortKey(key); setCoverageSortDir('asc'); }
  }

  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-secondary gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
        <p className="text-lg font-medium">No script loaded yet</p>
        <p className="text-sm">Open a project to see statistics.</p>
      </div>
    );
  }

  const estimatedMinutes = Math.round(totalWords / 200);
  const branchRatioPercent = Math.round((branchingBlockIds.size / Math.max(1, blocks.length)) * 100);

  return (
    <div className="h-full overflow-y-auto p-6 text-primary">
      <h1 className="text-2xl font-bold mb-6">Script Statistics</h1>

      {/* Writing */}
      <SectionLabel>Writing</SectionLabel>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Words"
          value={totalWords.toLocaleString()}
          sub="dialogue & narration"
        />
        <StatCard
          label="Estimated Playtime"
          value={
            estimatedMinutes < 60
              ? `${estimatedMinutes} min`
              : `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`
          }
          sub="at 200 words/min"
        />
        <StatCard
          label="Dialogue Words"
          value={dialogueWords.toLocaleString()}
          sub={totalWords > 0 ? `${Math.round((dialogueWords / totalWords) * 100)}% of total` : 'characters speaking'}
        />
        <StatCard
          label="Narration Words"
          value={narrationWords.toLocaleString()}
          sub={totalWords > 0 ? `${Math.round((narrationWords / totalWords) * 100)}% of total` : 'narrator lines'}
        />
      </div>

      {/* Structure */}
      <SectionLabel>Structure</SectionLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <StatCard
          label="Script Files"
          value={blocks.length.toLocaleString()}
          sub=".rpy files"
        />
        <StatCard
          label="Characters"
          value={characters.size.toLocaleString()}
          sub={`${charChartData.length} speaking`}
        />
        <StatCard
          label="Labels"
          value={labelCount.toLocaleString()}
          sub="named script points"
        />
        <StatCard
          label="Menus / Branches"
          value={branchingBlockIds.size.toLocaleString()}
          sub="files with choices"
        />
        <StatCard
          label="Identified Routes"
          value={identifiedRoutes.length.toLocaleString()}
          sub="unique story paths"
        />
      </div>

      {/* Complexity banner */}
      <div className="mb-8 bg-secondary rounded-lg p-4 flex items-center gap-4">
        <span
          className="text-sm font-bold px-3 py-1.5 rounded-full text-white flex-shrink-0"
          style={{ backgroundColor: COMPLEXITY_COLORS[complexity] }}
        >
          {complexity}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">Story Complexity</p>
          <p className="text-xs text-secondary">{COMPLEXITY_DESCRIPTIONS[complexity]}</p>
        </div>
        <div className="ml-auto text-right text-xs text-secondary flex-shrink-0">
          <p>{branchRatioPercent}% of files branch</p>
          <p>{identifiedRoutes.length} route{identifiedRoutes.length !== 1 ? 's' : ''} identified</p>
        </div>
      </div>

      {/* Endings & Completeness */}
      <SectionLabel>Endings &amp; Completeness</SectionLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Distinct Endings"
          value={pathStats.endingCount.toLocaleString()}
          sub="labels with no exit"
        />
        <StatCard
          label="Shortest Path"
          value={pathStats.shortestPath !== null ? `${pathStats.shortestPath} steps` : '—'}
          sub="from start to first ending"
        />
        <StatCard
          label="Longest Path"
          value={pathStats.longestPath !== null ? `${pathStats.longestPath} steps` : '—'}
          sub="from start to deepest ending"
        />
      </div>

      {/* Assets & Health */}
      <SectionLabel>Assets &amp; Health</SectionLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Image Assets"
          value={projectImages.size.toLocaleString()}
          sub={coverageData.imageReferenced > 0 ? `${coverageData.imageReferenced} referenced` : 'tracked images'}
        />
        <StatCard
          label="Audio Assets"
          value={projectAudios.size.toLocaleString()}
          sub={coverageData.audioReferenced > 0 ? `${coverageData.audioReferenced} referenced` : 'tracked audio files'}
        />
        <StatCard
          label={diagnosticsErrorCount > 0 ? 'Script Errors' : 'No Errors'}
          value={
            diagnosticsErrorCount > 0
              ? <span className="text-red-500">{diagnosticsErrorCount}</span>
              : <span className="text-green-500">✓</span>
          }
          sub={diagnosticsErrorCount > 0 ? 'open Diagnostics tab →' : 'project looks clean'}
          onClick={diagnosticsErrorCount > 0 ? onOpenDiagnostics : undefined}
        />
      </div>

      {/* Word count by character */}
      {charChartData.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold">Word Count by Character</h2>
            <div className="flex items-center gap-1">
              {CHAR_LIMITS.map(l => (
                <button
                  key={String(l)}
                  onClick={() => setCharLimit(l)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    charLimit === l
                      ? 'bg-indigo-600 text-white'
                      : 'bg-tertiary text-secondary hover:bg-tertiary-hover'
                  }`}
                >
                  {l === 'all' ? 'All' : `Top ${l}`}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-secondary mb-3">
            Showing {displayedChars.length} of {charChartData.length} speaking character{charChartData.length !== 1 ? 's' : ''}
            {characters.size > charChartData.length && ` (${characters.size - charChartData.length} defined with no dialogue)`}
          </p>
          {displayedChars.length > 6 ? (
            <CharacterTable data={displayedChars} />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, displayedChars.length * 40)}>
              <BarChart
                data={displayedChars}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-primary opacity-20" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Words']} />
                <Bar dataKey="words" radius={[0, 4, 4, 0]}>
                  {displayedChars.map((entry, index) => (
                    <Cell key={index} fill={entry.color || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      )}

      {/* Lines by file */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Lines of Script by File</h2>
          <div className="flex items-center gap-1">
            {FILE_LIMITS.map(l => (
              <button
                key={String(l)}
                onClick={() => setFileLimit(l)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  fileLimit === l
                    ? 'bg-indigo-600 text-white'
                    : 'bg-tertiary text-secondary hover:bg-tertiary-hover'
                }`}
              >
                {l === 'all' ? 'All' : `Top ${l}`}
              </button>
            ))}
          </div>
        </div>
        {fileLimit !== 'all' && blocks.length > fileLimit && (
          <p className="text-xs text-secondary mb-2">
            Showing {fileLimit} of {blocks.length} files by line count
          </p>
        )}
        <ResponsiveContainer width="100%" height={Math.max(200, lineChartData.length * 28)}>
          <BarChart
            data={lineChartData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-primary opacity-20" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Lines']} />
            <Bar dataKey="lines" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Asset Coverage */}
      {(coverageData.rows.length > 0) && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Asset Coverage</h2>

          {/* Coverage bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {[
              {
                label: 'Images',
                referenced: coverageData.imageReferenced,
                total: coverageData.imageTotal,
                missing: coverageData.imageMissing,
                orphaned: coverageData.imageOrphaned,
              },
              {
                label: 'Audio',
                referenced: coverageData.audioReferenced,
                total: coverageData.audioTotal,
                missing: coverageData.audioMissing,
                orphaned: coverageData.audioOrphaned,
              },
            ].map(({ label, referenced, total, missing, orphaned }) => {
              const pct = total > 0 ? Math.round((referenced / total) * 100) : 0;
              return (
                <div key={label} className="bg-secondary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-primary">{label}</span>
                    <span className="text-xs text-secondary tabular-nums">{referenced}/{total} referenced ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-tertiary rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-secondary">
                    {missing > 0 && (
                      <span className="text-orange-500 font-medium">{missing} missing from disk</span>
                    )}
                    {orphaned > 0 && (
                      <span className="text-gray-400">{orphaned} unreferenced</span>
                    )}
                    {missing === 0 && orphaned === 0 && (
                      <span className="text-green-500">All files accounted for</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Type pills */}
            <div className="flex rounded-md border border-primary overflow-hidden text-xs flex-none">
              {(['all', 'image', 'audio'] as CoverageTypeFilter[]).map(t => (
                <button
                  key={t}
                  onClick={() => setCoverageTypeFilter(t)}
                  className={`px-2.5 py-1 capitalize border-r border-primary last:border-0 transition-colors ${coverageTypeFilter === t ? 'bg-indigo-500 text-white' : 'bg-secondary text-secondary hover:bg-tertiary'}`}
                >
                  {t === 'all' ? 'All Types' : t === 'image' ? 'Images' : 'Audio'}
                </button>
              ))}
            </div>
            {/* Status pills */}
            <div className="flex rounded-md border border-primary overflow-hidden text-xs flex-none">
              {(['all', 'referenced', 'missing', 'orphaned'] as CoverageStatusFilter[]).map(s => (
                <button
                  key={s}
                  onClick={() => setCoverageStatusFilter(s)}
                  className={`px-2.5 py-1 capitalize border-r border-primary last:border-0 transition-colors ${coverageStatusFilter === s ? 'bg-indigo-500 text-white' : 'bg-secondary text-secondary hover:bg-tertiary'}`}
                >
                  {s === 'all' ? 'All Status' : s}
                </button>
              ))}
            </div>
            {/* Text search */}
            <div className="relative flex-1 min-w-[140px]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Filter assets…"
                value={coverageTextFilter}
                onChange={e => setCoverageTextFilter(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs bg-secondary border border-primary rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 text-primary placeholder:text-secondary"
              />
            </div>
            <span className="text-xs text-secondary flex-none">{coverageRows.length} asset{coverageRows.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Coverage table */}
          <div className="overflow-x-auto rounded-lg border border-primary">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-tertiary border-b border-primary text-secondary text-xs">
                  <th
                    className="px-3 py-2 text-left font-semibold cursor-pointer select-none"
                    onClick={() => toggleCoverageSort('name')}
                  >
                    Asset {coverageSortKey === 'name' ? (coverageSortDir === 'asc' ? '↑' : '↓') : <span className="opacity-40">↕</span>}
                  </th>
                  <th
                    className="px-3 py-2 text-left font-semibold cursor-pointer select-none w-20"
                    onClick={() => toggleCoverageSort('type')}
                  >
                    Type {coverageSortKey === 'type' ? (coverageSortDir === 'asc' ? '↑' : '↓') : <span className="opacity-40">↕</span>}
                  </th>
                  <th
                    className="px-3 py-2 text-left font-semibold cursor-pointer select-none w-36"
                    onClick={() => toggleCoverageSort('status')}
                  >
                    Status {coverageSortKey === 'status' ? (coverageSortDir === 'asc' ? '↑' : '↓') : <span className="opacity-40">↕</span>}
                  </th>
                </tr>
              </thead>
              <tbody>
                {coverageRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-secondary text-xs">No assets match the current filter</td>
                  </tr>
                )}
                {coverageRows.map((row, i) => (
                  <tr key={row.id} className={`border-b border-primary last:border-0 ${i % 2 === 1 ? 'bg-secondary/20' : ''}`}>
                    <td className="px-3 py-2 font-mono text-xs text-primary truncate max-w-xs">{row.name}</td>
                    <td className="px-3 py-2 text-xs text-secondary capitalize">{row.type}</td>
                    <td className="px-3 py-2">
                      {row.status === 'referenced' && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          Referenced
                        </span>
                      )}
                      {row.status === 'missing' && (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          Missing from disk
                        </span>
                      )}
                      {row.status === 'orphaned' && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                          Unreferenced
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default StatsView;
