/**
 * @file CanvasNavControls.tsx
 * @description Fit-to-screen and go-to-start navigation buttons for canvas views (~50 lines).
 * Key features: "Fit all to screen" button (F shortcut hint), conditional "Go to start label"
 * button; shared across `StoryCanvas`, `RouteCanvas`, and `ChoiceCanvas`.
 * Integration: rendered inside the bottom-right control cluster of each canvas component;
 * calls `onFit` and `onGoToStart` callbacks provided by the parent canvas.
 */
import React from 'react';

interface CanvasNavControlsProps {
  onFit: () => void;
  fitTitle?: string;
  onGoToStart?: () => void;
  hasStart?: boolean;
}

/**
 * Fit-to-screen and go-to-start buttons, anchored in the bottom-right canvas
 * cluster above the Minimap. Shared across StoryCanvas, RouteCanvas, and ChoiceCanvas.
 */
const CanvasNavControls: React.FC<CanvasNavControlsProps> = ({
  onFit,
  fitTitle = 'Fit all to screen (F)',
  onGoToStart,
  hasStart = false,
}) => (
  <div className="flex items-center gap-1.5">
    {hasStart && onGoToStart && (
      <button
        onClick={onGoToStart}
        title="Go to start label"
        aria-label="Go to start label"
        className="h-9 w-9 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center shadow"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 7l2.55 2.4A1 1 0 0116 11H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
        </svg>
      </button>
    )}
    <button
      onClick={onFit}
      title={fitTitle}
      aria-label="Fit all to screen"
      className="h-9 w-9 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center shadow"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H5.414l3.293 3.293a1 1 0 11-1.414 1.414L4 6.414V8a1 1 0 01-2 0V4zm13 0a1 1 0 01.707.293l-3.293 3.293a1 1 0 01-1.414-1.414L15.586 3H14a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V5.414l-3.293 3.293A1 1 0 0112.293 7.29zM3 16a1 1 0 010-2V12.414l3.293-3.293a1 1 0 011.414 1.414L4.414 14H6a1 1 0 010 2H4a1 1 0 01-1-1zm13 1a1 1 0 01-.707-.293l-3.293-3.293a1 1 0 011.414-1.414L16.586 15H15a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V16.586l-3.293 3.293A1 1 0 0113.293 19.29z" clipRule="evenodd" />
      </svg>
    </button>
  </div>
);

export default CanvasNavControls;
