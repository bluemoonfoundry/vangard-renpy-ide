import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import type { Block, RenpyAnalysisResult, LabelNode, RouteLink, IdentifiedRoute } from '../types';

interface StatsViewProps {
  blocks: Block[];
  analysisResult: RenpyAnalysisResult;
  routeAnalysisResult: { labelNodes: LabelNode[]; routeLinks: RouteLink[]; identifiedRoutes: IdentifiedRoute[] };
}

function countWordsInScript(script: string): number {
  if (!script) return 0;
  const DIALOGUE_NARRATION_REGEX = /(?:[a-zA-Z0-9_]+\s)?"((?:\\.|[^"\\])*)"/g;
  let total = 0;
  let match;
  while ((match = DIALOGUE_NARRATION_REGEX.exec(script)) !== null) {
    const text = match[1];
    if (text) {
      total += text.trim().split(/\s+/).filter(Boolean).length;
    }
  }
  return total;
}

const StatCard: React.FC<{ label: string; value: React.ReactNode; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-secondary rounded-lg p-4 flex flex-col gap-1">
    <span className="text-xs font-semibold text-secondary uppercase tracking-wide">{label}</span>
    <span className="text-2xl font-bold text-primary">{value}</span>
    {sub && <span className="text-xs text-secondary">{sub}</span>}
  </div>
);

const complexityColor = (score: number): string => {
  if (score <= 3) return '#22c55e';
  if (score <= 6) return '#f59e0b';
  return '#ef4444';
};

const StatsView: React.FC<StatsViewProps> = ({ blocks, analysisResult, routeAnalysisResult }) => {
  const { branchingBlockIds, labels, characters, dialogueLines } = analysisResult;
  const { identifiedRoutes } = routeAnalysisResult;

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

  const labelCount = useMemo(() => Object.keys(labels).length, [labels]);

  const complexityScore = useMemo(() => {
    const raw =
      (branchingBlockIds.size * 1.5 + identifiedRoutes.length * 2) /
      Math.max(1, labelCount) *
      5;
    return Math.min(10, Math.max(1, Math.round(raw)));
  }, [branchingBlockIds.size, identifiedRoutes.length, labelCount]);

  const charChartData = useMemo(() => {
    const data: { name: string; words: number; color: string }[] = [];
    characterWordCounts.forEach((words, tag) => {
      const char = characters.get(tag);
      const name = char?.name || tag;
      const color = char?.color || '#6366f1';
      data.push({ name, words, color });
    });
    return data.sort((a, b) => b.words - a.words);
  }, [characterWordCounts, characters]);

  const lineChartData = useMemo(
    () =>
      blocks
        .map(b => ({
          name: b.title || b.filePath?.split('/').pop() || 'Untitled',
          lines: b.content.split('\n').length,
        }))
        .sort((a, b) => b.lines - a.lines)
        .slice(0, 15),
    [blocks],
  );

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

  return (
    <div className="h-full overflow-y-auto p-6 text-primary">
      <h1 className="text-2xl font-bold mb-6">Script Statistics</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Words"
          value={totalWords.toLocaleString()}
          sub="dialogue &amp; narration"
        />
        <StatCard
          label="Estimated Playtime"
          value={estimatedMinutes < 60
            ? `${estimatedMinutes} min`
            : `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`}
          sub="at 200 words/min"
        />
        <StatCard
          label="Labels"
          value={labelCount.toLocaleString()}
          sub="named script points"
        />
        <StatCard
          label="Menus / Branches"
          value={branchingBlockIds.size.toLocaleString()}
          sub="blocks with choices"
        />
        <StatCard
          label="Unique Routes"
          value={identifiedRoutes.length.toLocaleString()}
          sub="identified paths"
        />
        <StatCard
          label="Complexity Score"
          value={
            <span
              className="inline-block px-3 py-0.5 rounded-full text-white text-2xl font-bold"
              style={{ backgroundColor: complexityColor(complexityScore) }}
            >
              {complexityScore} / 10
            </span>
          }
          sub="branching complexity"
        />
      </div>

      {/* Character Word Count Chart */}
      {charChartData.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Word Count by Character</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-primary opacity-20" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Words']} />
              <Bar dataKey="words" radius={[4, 4, 0, 0]}>
                {charChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Lines by File Chart */}
      {lineChartData.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Lines of Script by File</h2>
          <p className="text-xs text-secondary mb-2">Top {lineChartData.length} files by line count</p>
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
      )}
    </div>
  );
};

export default StatsView;
