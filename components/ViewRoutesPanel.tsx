import React from 'react';
import type { IdentifiedRoute } from '../types';

interface ViewRoutesPanelProps {
  routes: IdentifiedRoute[];
  checkedRoutes: Set<number>;
  onToggleRoute: (routeId: number) => void;
}

const ViewRoutesPanel: React.FC<ViewRoutesPanelProps> = ({ routes, checkedRoutes, onToggleRoute }) => {
  return (
    <div className="view-routes-panel absolute top-4 right-4 z-20 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col space-y-2 max-h-[50vh] overflow-y-auto">
      <h4 className="text-sm font-semibold text-center px-2 pb-1 border-b dark:border-gray-600">Identified Routes ({routes.length})</h4>
      <div className="space-y-2">
        {routes.map(route => (
          <label key={route.id} className="flex items-center space-x-3 cursor-pointer text-sm p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <input
              type="checkbox"
              checked={checkedRoutes.has(route.id)}
              onChange={() => onToggleRoute(route.id)}
              className="h-4 w-4 rounded focus:ring-indigo-500"
              style={{ accentColor: route.color }}
            />
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: route.color }}></div>
            <span>Route {route.id + 1}</span>
          </label>
        ))}
        {routes.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center p-2">No distinct routes found.</p>
        )}
      </div>
    </div>
  );
};

export default ViewRoutesPanel;
