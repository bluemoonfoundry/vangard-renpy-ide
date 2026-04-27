/**
 * @file ViewRoutesPanel.tsx
 * @description Route-highlighting toggle list for `RouteCanvas` (~120 lines).
 * Key features: colour-coded route rows (start → end label), per-route checkbox toggle,
 * truncation warning when route count exceeds the analysis limit, `embedded` prop for
 * borderless rendering inside `CanvasToolbox`.
 * Integration: rendered by `RouteCanvas` (or via `CanvasToolbox`); receives `IdentifiedRoute[]`
 * from `useRenpyAnalysis` route analysis.
 */
import React, { useState } from 'react';
import type { IdentifiedRoute } from '@/types';

interface RouteLabel {
  startLabel: string;
  endLabel: string;
}

interface ViewRoutesPanelProps {
  routes: IdentifiedRoute[];
  routesTruncated?: boolean;
  checkedRoutes: Set<number>;
  onToggleRoute: (routeId: number) => void;
  routeLabels: Map<number, RouteLabel>;
  className?: string;
  /**
   * When true, renders without an outer container (no border/bg/shadow).
   * Use when embedding inside CanvasToolbox which provides the container.
   */
  embedded?: boolean;
}

const ViewRoutesPanel: React.FC<ViewRoutesPanelProps> = ({
  routes,
  routesTruncated,
  checkedRoutes,
  onToggleRoute,
  routeLabels,
  className = '',
  embedded = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const inner = (
    <>
      <button
        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
          embedded ? '' : 'border-b border-gray-200 dark:border-gray-600'
        }`}
        onClick={() => setIsCollapsed(v => !v)}
        title="Auto-detected distinct execution paths through the story"
      >
        <span>Routes ({routes.length}{routesTruncated ? '+' : ''})</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {!isCollapsed && (
        // max-h-60 ≈ 240px ≈ 10 routes before scrolling
        <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
          {routes.map(route => {
            const labels = routeLabels.get(route.id);
            return (
              <label key={route.id} className="flex items-center gap-2 cursor-pointer text-xs p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <input
                  type="checkbox"
                  checked={checkedRoutes.has(route.id)}
                  onChange={() => onToggleRoute(route.id)}
                  className="h-3.5 w-3.5 shrink-0 rounded focus:ring-indigo-500"
                  style={{ accentColor: route.color }}
                />
                <div className="w-3 h-3 shrink-0 rounded-sm" style={{ backgroundColor: route.color }} />
                {labels ? (
                  <span className="font-mono truncate" title={`${labels.startLabel} → ${labels.endLabel}`}>
                    <span className="text-green-600 dark:text-green-400">{labels.startLabel}</span>
                    <span className="text-gray-400 mx-0.5">→</span>
                    <span className="text-amber-600 dark:text-amber-400">{labels.endLabel}</span>
                  </span>
                ) : (
                  <span>Route {route.id + 1}</span>
                )}
              </label>
            );
          })}
          {routesTruncated && (
            <p className="text-xs text-amber-500 dark:text-amber-400 text-center p-2">
              Showing first {routes.length} routes. Large project route limit reached.
            </p>
          )}
          {routes.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center p-2">No distinct routes found.</p>
          )}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <div className={`view-routes-panel bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-52 max-w-full overflow-hidden ${className}`}>
      {inner}
    </div>
  );
};

export default ViewRoutesPanel;
