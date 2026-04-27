/**
 * @file ScreenManager.tsx
 * @description Virtualised list of all Ren'Py `screen` definitions parsed from project scripts (~70 lines).
 * Key features: alphabetically sorted, shows screen name and parameter list, click navigates to
 * the definition in the Monaco editor.
 * Integration: rendered as a sidebar panel; screen data comes from `useRenpyAnalysis`;
 * navigates via `onFindDefinition` which opens the file and scrolls to the line.
 */

import React, { useMemo } from 'react';
import type { RenpyScreen } from '@/types';
import { useVirtualList } from '@/hooks/useVirtualList';

// p-2 (16px) + main text line (20px) + optional param line (16px) + space-y-2 gap (8px)
const SCREEN_ITEM_HEIGHT = 60;

interface ScreenManagerProps {
    screens: Map<string, RenpyScreen>;
    onFindDefinition: (screenName: string) => void;
}

const ScreenManager: React.FC<ScreenManagerProps> = ({ screens, onFindDefinition }) => {
    const screenList = useMemo(
        () => Array.from(screens.values()).sort((a: RenpyScreen, b: RenpyScreen) => a.name.localeCompare(b.name)),
        [screens],
    );

    const { containerRef, handleScroll, virtualItems, totalHeight } = useVirtualList(screenList, SCREEN_ITEM_HEIGHT);

    return (
        <>
            {screenList.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No screens defined yet.</p>
            ) : (
                <div
                    ref={containerRef}
                    className="relative"
                    onScroll={handleScroll}
                >
                    <div style={{ height: totalHeight, position: 'relative' }}>
                        {virtualItems.map(({ item: screen, offsetTop }) => (
                            <div
                                key={screen.name}
                                style={{ position: 'absolute', top: offsetTop, left: 0, right: 0, height: SCREEN_ITEM_HEIGHT - 8 }}
                                className="p-2 rounded-md bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between"
                            >
                                <div className="flex-grow min-w-0">
                                    <p className="font-semibold font-mono text-sm truncate" title={screen.name}>{screen.name}</p>
                                    {screen.parameters && <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{screen.parameters}</p>}
                                </div>
                                <div className="flex items-center space-x-1 flex-shrink-0 pl-2">
                                    <button onClick={() => onFindDefinition(screen.name)} title="Go to definition" className="p-1 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded">
                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

export default ScreenManager;
