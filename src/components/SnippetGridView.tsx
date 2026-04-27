/**
 * @file SnippetGridView.tsx
 * @description Grid-based snippet browser with search and category filtering.
 * Displays snippets as cards in a responsive grid layout for better discoverability.
 * Features: category filter chips, fuzzy search, expandable code preview, copy buttons.
 */
import React, { useState, useMemo } from 'react';
import CopyButton from './CopyButton';

interface Snippet {
  title: string;
  description: string;
  code: string;
}

interface SnippetCategory {
  name: string;
  snippets: Snippet[];
}

interface SnippetWithCategory extends Snippet {
  category: string;
}

interface SnippetGridViewProps {
  categories: SnippetCategory[];
}

const SnippetGridView: React.FC<SnippetGridViewProps> = ({ categories }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [expandedSnippet, setExpandedSnippet] = useState<string | null>(null);

  // Flatten all snippets with their category info
  const allSnippets = useMemo<SnippetWithCategory[]>(() => {
    return categories.flatMap(category =>
      category.snippets.map(snippet => ({
        ...snippet,
        category: category.name,
      }))
    );
  }, [categories]);

  // Filter snippets based on search and selected categories
  const filteredSnippets = useMemo(() => {
    let filtered = allSnippets;

    // Apply category filter
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(snippet => selectedCategories.has(snippet.category));
    }

    // Apply search filter (fuzzy search across title, description, and code)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(snippet =>
        snippet.title.toLowerCase().includes(query) ||
        snippet.description.toLowerCase().includes(query) ||
        snippet.code.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allSnippets, selectedCategories, searchQuery]);

  // Toggle category selection
  const toggleCategory = (categoryName: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedCategories(new Set());
    setSearchQuery('');
  };

  // Generate unique ID for each snippet (for expansion tracking)
  const getSnippetId = (snippet: SnippetWithCategory) => {
    return `${snippet.category}-${snippet.title}`;
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search snippets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 pl-9 rounded-md border border-primary bg-secondary text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map(category => {
          const isSelected = selectedCategories.has(category.name);
          return (
            <button
              key={category.name}
              onClick={() => toggleCategory(category.name)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-accent text-white'
                  : 'bg-tertiary text-secondary hover:bg-primary hover:text-primary border border-primary'
              }`}
            >
              {category.name}
            </button>
          );
        })}
        {(selectedCategories.size > 0 || searchQuery) && (
          <button
            onClick={clearFilters}
            className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Results Count */}
      <div className="text-xs text-secondary">
        {filteredSnippets.length} {filteredSnippets.length === 1 ? 'snippet' : 'snippets'}
        {(selectedCategories.size > 0 || searchQuery) && ` (filtered from ${allSnippets.length})`}
      </div>

      {/* Snippet Grid */}
      {filteredSnippets.length === 0 ? (
        <div className="text-center py-12 text-secondary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 mx-auto mb-3 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">No snippets found</p>
          <p className="text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredSnippets.map(snippet => {
            const snippetId = getSnippetId(snippet);
            const isExpanded = expandedSnippet === snippetId;
            const codePreview = snippet.code.length > 60 ? snippet.code.substring(0, 60) + '...' : snippet.code;

            return (
              <div
                key={snippetId}
                className="p-3 rounded-md bg-secondary border border-primary hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-primary truncate">{snippet.title}</h3>
                    <p className="text-xs text-secondary mt-0.5">{snippet.description}</p>
                  </div>
                  <CopyButton text={snippet.code} label="" size="xs" className="ml-2 flex-shrink-0" />
                </div>

                {/* Code Preview */}
                <div
                  className={`flex-1 bg-gray-800 dark:bg-gray-900 text-white p-2 rounded text-xs font-mono whitespace-pre-wrap cursor-pointer hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors ${
                    isExpanded ? '' : 'line-clamp-3'
                  }`}
                  onClick={() => setExpandedSnippet(isExpanded ? null : snippetId)}
                  title={isExpanded ? 'Click to collapse' : 'Click to expand'}
                >
                  <code>{isExpanded ? snippet.code : codePreview}</code>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                    {snippet.category}
                  </span>
                  {snippet.code.length > 60 && (
                    <button
                      onClick={() => setExpandedSnippet(isExpanded ? null : snippetId)}
                      className="text-[10px] text-secondary hover:text-accent transition-colors"
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SnippetGridView;
