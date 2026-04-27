/**
 * @file MenuInspectorPanel.tsx
 * @description Collapsed/expanded inspector for the selected `menu` node on `RouteCanvas` (~130 lines).
 * Key features: shows all choices with their conditions, target labels, and route colour indicators;
 * click-to-navigate to source line in editor; `embedded` prop for borderless rendering in
 * `CanvasToolbox`; exports `SelectedMenu` and `MenuPopoverChoice` interfaces.
 * Integration: rendered by `RouteCanvas`; selected menu set when the user clicks a menu edge group.
 */
import React from 'react';

export interface MenuPopoverChoice {
  choiceText: string;
  choiceCondition?: string;
  targetLabel: string;
  sourceLine?: number;
  blockId: string;
  /** Colors of currently-checked routes that include this choice. */
  routeColors: string[];
}

export interface SelectedMenu {
  groupKey: string;
  sourceLabel: string;
  menuLine: number;
  choices: MenuPopoverChoice[];
}

interface MenuInspectorPanelProps {
  selectedMenu: SelectedMenu | null;
  isOpen: boolean;
  onToggle: () => void;
  onOpenEditor: (blockId: string, line: number) => void;
  /**
   * When true, renders without an outer container (no border/bg/shadow).
   * Use when embedding inside CanvasToolbox which provides the container.
   */
  embedded?: boolean;
}

/**
 * Collapsible panel that shows the choices for a selected menu node in the
 * RouteCanvas. Displays choice text, conditions, target labels, and route colors.
 * Extracted from RouteCanvas into its own file for use inside CanvasToolbox.
 */
const MenuInspectorPanel: React.FC<MenuInspectorPanelProps> = ({
  selectedMenu,
  isOpen,
  onToggle,
  onOpenEditor,
  embedded = false,
}) => {
  const firstChoice = selectedMenu?.choices[0];
  return (
    <div className={embedded ? 'overflow-hidden' : 'bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-64 overflow-hidden'}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">Menu Inspector</span>
          {selectedMenu && (
            <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 truncate">
              {selectedMenu.sourceLabel}
            </span>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ml-1 ${isOpen ? '' : '-rotate-90'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {isOpen && (
        !selectedMenu ? (
          <div className="px-3 py-5 text-xs text-center text-gray-400 dark:text-gray-500">
            Click a menu pill{' '}
            <span className="inline-block w-3 h-3 rounded-full bg-indigo-500 opacity-80 align-middle" />{' '}
            to inspect choices
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-64 overflow-y-auto">
              {selectedMenu.choices.map((choice, i) => (
                <li key={i} className="px-3 py-2">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-900 dark:text-gray-100 leading-snug break-words">
                        &ldquo;{choice.choiceText}&rdquo;
                      </p>
                      {choice.choiceCondition && (
                        <span className="mt-1 text-xs font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded px-1 py-px inline-block">
                          if {choice.choiceCondition}
                        </span>
                      )}
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          →{' '}
                          <span className="font-mono text-indigo-500 dark:text-indigo-400">
                            {choice.targetLabel}
                          </span>
                        </span>
                        {choice.routeColors.map((color, ci) => (
                          <span
                            key={ci}
                            className="w-2 h-2 rounded-full shrink-0 inline-block"
                            style={{ backgroundColor: color }}
                            title="Part of a highlighted route"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-400 dark:text-gray-500">line {selectedMenu.menuLine}</span>
              {firstChoice && (
                <button
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
                  onClick={() => onOpenEditor(firstChoice.blockId, selectedMenu.menuLine)}
                >
                  Open in editor ↗
                </button>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
};

export default MenuInspectorPanel;
