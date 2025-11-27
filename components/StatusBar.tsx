
import React from 'react';

interface StatusBarProps {
  totalWords: number;
  currentFileWords: number | null;
  readingTime: string;
  statusMessage?: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ totalWords, currentFileWords, readingTime, statusMessage }) => {
  return (
    <footer className="flex-none h-6 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 text-xs text-gray-600 dark:text-gray-400 z-20 transition-colors duration-200">
      <div className="flex items-center space-x-2 overflow-hidden mr-4">
        {statusMessage && (
            <span className="font-medium text-indigo-600 dark:text-indigo-400 animate-pulse truncate max-w-md">
                {statusMessage}
            </span>
        )}
      </div>
      <div className="flex items-center space-x-4 flex-shrink-0">
        {currentFileWords !== null && (
            <span title="Words in current editor tab">
            Current File: {currentFileWords.toLocaleString()} words
            </span>
        )}
        {currentFileWords !== null && <div className="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>}
        <span title="Total words in all .rpy files">
            Total Project: {totalWords.toLocaleString()} words
        </span>
        <div className="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
        <span title="Estimated based on an average reading speed of 200 WPM">
            {readingTime}
        </span>
      </div>
    </footer>
  );
};

export default StatusBar;
