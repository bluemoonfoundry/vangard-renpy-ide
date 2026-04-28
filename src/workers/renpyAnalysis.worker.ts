/**
 * @file renpyAnalysis.worker.ts
 * @description Web Worker that runs Ren'Py analysis off the main thread.
 * Receives AnalysisBlock[] via postMessage, returns a complete RenpyAnalysisResult.
 *
 * Content-hash caching: if none of the block contents changed since the last run
 * (e.g. the user only moved blocks on the canvas), the cached result is returned
 * immediately without re-running the full analysis pass.
 */

import { performRenpyAnalysis, performRouteAnalysis } from '@/hooks/useRenpyAnalysis';
import type { AnalysisBlock } from '@/hooks/useRenpyAnalysis';
import type { RenpyAnalysisResult } from '@/types';
import { formatErrorMessage } from '@/lib/formatErrorMessage';
import { performTranslationAnalysis } from '@/lib/renpyTranslationParser';

interface WorkerRequest {
  id: number;
  blocks: AnalysisBlock[];
}

// ── Content-hash cache ────────────────────────────────────────────────────────

/**
 * Computes a fast 32-bit djb2 hash of a string for cache invalidation.
 *
 * This hash function is used to detect content changes in `.rpy` files. It's not
 * cryptographically secure, but it's fast and has good distribution for typical
 * text content.
 *
 * @param str - String to hash
 * @returns 32-bit signed integer hash
 *
 * @complexity O(n) where n = string length
 */
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

/**
 * Computes content signatures for all blocks for cache comparison.
 *
 * @param blocks - Array of blocks to hash
 * @returns Array of signatures with block ID and content hash
 * @complexity O(n·m) where n=block count, m=average block content length
 */
function computeSignatures(blocks: AnalysisBlock[]): BlockSignature[] {
  return blocks.map(b => ({ id: b.id, contentHash: djb2(b.content) }));
}

/**
 * Checks if two signature arrays are equal (same IDs in same order with same hashes).
 *
 * Used to detect if block content changed since the last analysis run.
 *
 * @param a - First signature array
 * @param b - Second signature array
 * @returns True if all signatures match
 * @complexity O(n) where n = signature count
 */
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

/**
 * Web Worker message handler for Ren'Py analysis requests.
 *
 * Receives `WorkerRequest` messages with block content, performs full analysis in three phases:
 * 1. **Parsing**: Extract labels, characters, images, screens, etc. via `performRenpyAnalysis()`
 * 2. **Route graph**: Build label nodes and route links via `performRouteAnalysis()`
 * 3. **Translation**: Analyze dialogue strings via `performTranslationAnalysis()`
 *
 * **Content-hash caching**: Before running analysis, computes djb2 hashes of all block content.
 * If hashes match the previous run, returns the cached result immediately without re-parsing.
 * This optimization handles the common case where the user drags blocks on the canvas (changing
 * positions but not content).
 *
 * Posts progress updates at 10%, 60%, 80%, and 95% completion.
 *
 * @param e - MessageEvent with WorkerRequest containing request ID and blocks
 *
 * @complexity O(n·m) where n=block count, m=average block length (dominated by parsing)
 * @see performRenpyAnalysis for main parsing logic
 * @see performRouteAnalysis for route graph construction
 * @see performTranslationAnalysis for translation string extraction
 */
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

    self.postMessage({ id, type: 'progress', phase: 'Analyzing translations', percent: 80 });
    const translationData = performTranslationAnalysis(blocks, result.dialogueLines, result.labels);
    result.translationData = translationData;

    self.postMessage({ id, type: 'progress', phase: 'Finalizing', percent: 95 });

    cachedSignatures = newSigs;
    cachedResult = result;

    self.postMessage({ id, result });
  } catch (err) {
    console.error('[Analysis Worker]', err);
    self.postMessage({ id, error: formatErrorMessage(err) });
  }
};
