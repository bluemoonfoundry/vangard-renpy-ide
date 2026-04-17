/**
 * @file renpyAnalysis.worker.ts
 * @description Web Worker that runs Ren'Py analysis off the main thread.
 * Receives AnalysisBlock[] via postMessage, returns a complete RenpyAnalysisResult.
 *
 * Content-hash caching: if none of the block contents changed since the last run
 * (e.g. the user only moved blocks on the canvas), the cached result is returned
 * immediately without re-running the full analysis pass.
 */

import { performRenpyAnalysis, performRouteAnalysis } from '../hooks/useRenpyAnalysis';
import type { AnalysisBlock } from '../hooks/useRenpyAnalysis';
import type { RenpyAnalysisResult } from '../types';
import { formatErrorMessage } from '../lib/formatErrorMessage';

interface WorkerRequest {
  id: number;
  blocks: AnalysisBlock[];
}

// ── Content-hash cache ────────────────────────────────────────────────────────

/** Fast 32-bit djb2 hash of a string. */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // keep 32-bit
  }
  return hash;
}

interface BlockSignature {
  id: string;
  contentHash: number;
}

function computeSignatures(blocks: AnalysisBlock[]): BlockSignature[] {
  return blocks.map(b => ({ id: b.id, contentHash: djb2(b.content) }));
}

function signaturesEqual(a: BlockSignature[], b: BlockSignature[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].contentHash !== b[i].contentHash) return false;
  }
  return true;
}

let cachedSignatures: BlockSignature[] = [];
let cachedResult: RenpyAnalysisResult | null = null;

// ─────────────────────────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, blocks } = e.data;
  try {
    const newSigs = computeSignatures(blocks);

    if (cachedResult && signaturesEqual(newSigs, cachedSignatures)) {
      // Content unchanged (e.g. only canvas positions changed) — skip re-analysis.
      self.postMessage({ id, result: cachedResult });
      return;
    }

    self.postMessage({ id, type: 'progress', phase: 'Parsing scripts', percent: 10 });

    const result = performRenpyAnalysis(blocks);

    self.postMessage({ id, type: 'progress', phase: 'Building route graph', percent: 60 });

    const routeData = performRouteAnalysis(blocks, result.labels, result.jumps);
    result.labelNodes = routeData.labelNodes;
    result.routeLinks = routeData.routeLinks;
    result.identifiedRoutes = routeData.identifiedRoutes;
    result.routesTruncated = routeData.routesTruncated;

    self.postMessage({ id, type: 'progress', phase: 'Finalizing', percent: 95 });

    cachedSignatures = newSigs;
    cachedResult = result;

    self.postMessage({ id, result });
  } catch (err) {
    console.error('[Analysis Worker]', err);
    self.postMessage({ id, error: formatErrorMessage(err) });
  }
};
