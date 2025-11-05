import React from 'react';

interface LoadingOverlayProps {
  progress: number;
  message: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ progress, message }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[100] backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 max-w-lg w-full text-center border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Loading Project...</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 h-6 truncate" title={message}>
          {message}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
          <div
            className="bg-indigo-600 h-4 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-lg font-semibold mt-4 text-gray-800 dark:text-gray-200">{Math.round(progress)}%</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
