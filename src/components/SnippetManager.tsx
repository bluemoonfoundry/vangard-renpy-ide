/**
 * @file SnippetManager.tsx
 * @description Modern snippet browser with grid layout, search, and multi-source loading.
 * Key features: grid-based display with snippets loaded from multiple sources (built-in, user global, project-specific),
 * category filtering chips, fuzzy search, expandable code preview, reload button, custom user snippet CRUD via
 * `UserSnippetModal`, `CopyButton` on each snippet. Built-in snippets use `SnippetGridView` component.
 * Snippet sources: snippets/default-snippets.json (built-in), ~/.vangard-ide/snippets/custom.json (user global),
 * <project>/.vangard/snippets.json (project-specific).
 * Integration: rendered as a sidebar panel; persists user snippets to `ProjectSettings` via
 * `onUpdateUserSnippets`; launches `UserSnippetModal` for add/edit/delete.
 */

import React from 'react';
import type { UserSnippet } from '@/types';
import CopyButton from './CopyButton';
import SnippetGridView from './SnippetGridView';
import { useSnippetLoader } from '@/hooks/useSnippetLoader';

interface SnippetManagerProps {
    userSnippets?: UserSnippet[];
    onCreateSnippet?: () => void;
    onEditSnippet?: (snippet: UserSnippet) => void;
    onDeleteSnippet?: (snippetId: string) => void;
    projectRootPath?: string | null;
}

const SnippetManager: React.FC<SnippetManagerProps> = ({
    userSnippets,
    onCreateSnippet,
    onEditSnippet,
    onDeleteSnippet,
    projectRootPath
}) => {
    const { categories, isLoading, error, reload } = useSnippetLoader({ projectRootPath });

    return (
        <div className="space-y-6">
            {/* User Snippets Section */}
            {(userSnippets && userSnippets.length > 0 || onCreateSnippet) && (
                <div className="pb-6 border-b border-primary">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-primary">My Snippets</h3>
                        {onCreateSnippet && (
                            <button
                                onClick={onCreateSnippet}
                                className="px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-600 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                            >
                                + New
                            </button>
                        )}
                    </div>
                    {userSnippets && userSnippets.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {userSnippets.map(snippet => (
                                <div key={snippet.id} className="p-3 rounded-md bg-secondary border border-primary hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-primary">{snippet.title}</p>
                                            <p className="text-xs text-secondary mt-0.5">
                                                <code className="bg-tertiary px-1.5 py-0.5 rounded">{snippet.prefix}</code>
                                                {snippet.description && <span className="ml-1">— {snippet.description}</span>}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                                            <CopyButton text={snippet.code} label="" size="xs" />
                                            {onEditSnippet && (
                                                <button
                                                    onClick={() => onEditSnippet(snippet)}
                                                    className="px-2 py-1 text-xs font-semibold rounded bg-tertiary hover:bg-indigo-100 dark:hover:bg-indigo-800 text-primary transition-colors"
                                                    title="Edit snippet"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            {onDeleteSnippet && (
                                                <button
                                                    onClick={() => { if (window.confirm(`Delete snippet "${snippet.title}"?`)) onDeleteSnippet(snippet.id); }}
                                                    className="px-2 py-1 text-xs font-semibold rounded bg-tertiary hover:bg-red-100 dark:hover:bg-red-800 text-red-600 dark:text-red-400 transition-colors"
                                                    title="Delete snippet"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <pre className="bg-gray-800 dark:bg-gray-900 text-white p-2 rounded text-xs font-mono whitespace-pre-wrap">
                                        <code>{snippet.code}</code>
                                    </pre>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-secondary italic">No custom snippets yet. Create one to get started.</p>
                    )}
                </div>
            )}

            {/* Built-in Snippets Grid */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-primary">Snippet Library</h3>
                    <button
                        onClick={reload}
                        disabled={isLoading}
                        className="px-3 py-1 text-xs font-semibold text-accent hover:text-accent-hover border border-accent rounded-md hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                        title="Reload snippets from all sources"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {isLoading ? 'Loading...' : 'Reload'}
                    </button>
                </div>

                {error && (
                    <div className="mb-3 p-2 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs">
                        <strong>Error loading snippets:</strong> {error}
                    </div>
                )}

                {isLoading ? (
                    <div className="py-12 text-center text-secondary">
                        <svg className="animate-spin h-8 w-8 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-sm">Loading snippets...</p>
                    </div>
                ) : (
                    <SnippetGridView categories={categories} />
                )}
            </div>
        </div>
    );
};

export default SnippetManager;
