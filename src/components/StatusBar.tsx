/**
 * @file StatusBar.tsx
 * @description Bottom status strip showing project health and activity indicators (~80 lines).
 * Key features: prioritised activity messages (save error > saving > scanning > analysis > idle),
 * block count, diagnostics error/warning counts with colour coding.
 * Integration: rendered at the bottom of `App.tsx`; all props are derived from top-level app state.
 */
import React from 'react';

interface StatusBarProps {
  isAnalysisPending: boolean;
  isScanningAssets: boolean;
  saveStatus: 'saving' | 'saved' | 'error';
  blockCount: number;
  errorCount: number;
  warningCount: number;
}

const Spinner: React.FC = () => (
  <svg className="animate-spin h-3 w-3 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const StatusBar: React.FC<StatusBarProps> = ({
  isAnalysisPending,
  isScanningAssets,
  saveStatus,
  blockCount,
  errorCount,
  warningCount,
}) => {
  // Priority: save error > saving > scanning > analysis pending > idle
  const activity = (() => {
    if (saveStatus === 'error') {
      return { spinner: false, color: 'text-red-400', label: 'Save failed — check file permissions' };
    }
    if (saveStatus === 'saving') {
      return { spinner: true, color: 'text-blue-400', label: 'Saving...' };
    }
    if (isScanningAssets) {
      return { spinner: true, color: 'text-indigo-400', label: 'Scanning assets...' };
    }
    if (isAnalysisPending) {
      return { spinner: true, color: 'text-indigo-400', label: 'Analyzing...' };
    }
    return { spinner: false, color: 'text-secondary', label: 'Ready' };
  })();

  return (
    <div className="flex-shrink-0 h-6 bg-header border-t border-primary flex items-center justify-between px-3 text-xs select-none">
      {/* Left — current activity */}
      <div className={`flex items-center gap-1.5 ${activity.color}`}>
        {activity.spinner && <Spinner />}
        <span>{activity.label}</span>
      </div>

      {/* Right — project summary + version */}
      <div className="flex items-center gap-3 text-secondary">
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {warningCount} warning{warningCount !== 1 ? 's' : ''}
          </span>
        )}
        <span>{blockCount} file{blockCount !== 1 ? 's' : ''}</span>
        <span className="border-l border-primary pl-3 opacity-50">
          v{process.env.APP_VERSION}
          {process.env.BUILD_NUMBER && process.env.BUILD_NUMBER !== 'dev' && (
            <span className="opacity-70"> ({process.env.BUILD_NUMBER})</span>
          )}
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
