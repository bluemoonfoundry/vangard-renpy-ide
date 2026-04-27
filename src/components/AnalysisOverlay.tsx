/**
 * @file AnalysisOverlay.tsx
 * @description Full-screen overlay displayed while `useRenpyAnalysis` is running (~50 lines).
 * Key features: animated spinner, phase label (Parsing/Building graph/…), percent progress bar,
 * block count context message.
 * Integration: rendered by `App.tsx` when `isAnalysisPending` is true; progress data comes from
 * `AnalysisProgress` emitted by `useRenpyAnalysis`.
 */
import React from 'react';
import type { AnalysisProgress } from '@/hooks/useRenpyAnalysis';

interface AnalysisOverlayProps {
  blockCount: number;
  progress?: AnalysisProgress | null;
}

const AnalysisOverlay: React.FC<AnalysisOverlayProps> = ({ blockCount, progress }) => {
  const percent = progress?.percent ?? 0;
  const phase = progress?.phase ?? 'Preparing';

  return (
    <div data-analyzing="true" className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 max-w-lg w-full text-center border border-gray-200 dark:border-gray-700">
        <div className="flex justify-center mb-6">
          <svg className="animate-spin h-10 w-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">Preparing your project...</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Analyzing {blockCount} script {blockCount === 1 ? 'file' : 'files'} and building the story graph.
          {blockCount > 50 && ' This may take a moment for large projects.'}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700 overflow-hidden">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.max(percent, 5)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          {progress ? `${phase}... ${percent}%` : 'The application will be ready when analysis is complete.'}
        </p>
      </div>
    </div>
  );
};

export default AnalysisOverlay;
