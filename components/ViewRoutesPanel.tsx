import React from 'react';
import type { IdentifiedRoute } from '../types';

interface RouteLabel {
  startLabel: string;
  endLabel: string;
}

interface ViewRoutesPanelProps {
  routes: IdentifiedRoute[];
  checkedRoutes: Set<number>;
  onToggleRoute: (routeId: number) => void;
  routeLabels: Map<number, RouteLabel>;
}

const ViewRoutesPanel: React.FC<ViewRoutesPanelProps> = ({ routes, checkedRoutes, onToggleRoute, routeLabels }) => {
  return (
    <div className="view-routes-panel absolute top-4 right-4 z-20 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col space-y-2 max-h-[50vh] overflow-y-auto w-52">
      <h4 className="text-sm font-semibold text-center px-2 pb-1 border-b dark:border-gray-600" title="Auto-detected distinct execution paths through the story">Routes ({routes.length})</h4>
      <div className="space-y-1">
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
        {routes.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center p-2">No distinct routes found.</p>
        )}
      </div>
    </div>
  );
};

export default ViewRoutesPanel;
