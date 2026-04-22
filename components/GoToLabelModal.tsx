/**
 * @file GoToLabelModal.tsx
 * @description Fuzzy-search jump dialog for quickly navigating to a label or block (~150 lines).
 * Key features: real-time fuzzy scoring (exact > prefix > substring), keyboard navigation
 * (↑/↓/Enter/Escape), max 10 results, uses `createPortal` for modal overlay.
 * Integration: opened via Cmd/Ctrl+G shortcut in any canvas; `items` list is provided by the
 * parent canvas (labels for RouteCanvas, blocks for StoryCanvas).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface GoToLabelItem {
  label: string;
  /** blockId for story canvas, nodeId for route/choice canvas */
  id: string;
}

interface GoToLabelModalProps {
  isOpen: boolean;
  items: GoToLabelItem[];
  canvasName: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  title?: string;
  placeholder?: string;
  emptyStateText?: string;
}

const MAX_RESULTS = 10;

/** Scores a candidate string against a query. Returns a positive number (higher = better match), or null if no match. */
function score(candidate: string, query: string): number | null {
  if (!query) return 0;
  const c = candidate.toLowerCase();
  const q = query.toLowerCase();
  // Exact match — best possible
  if (c === q) return 1000;
  // Starts with — very good; shorter candidates rank higher (fewer extra chars)
  if (c.startsWith(q)) return 500 + (100 - Math.min(candidate.length, 100));
  // Contains — good; earlier position ranks higher
  const idx = c.indexOf(q);
  if (idx !== -1) return 200 - idx;
  // Fuzzy: all query chars present in order — weakest match
  let ci = 0;
  for (const ch of q) {
    ci = c.indexOf(ch, ci);
    if (ci === -1) return null;
    ci++;
  }
  return 10; // fuzzy match scores lowest but still matches
}

const GoToLabelModal: React.FC<GoToLabelModalProps> = ({
  isOpen,
  items,
  canvasName,
  onSelect,
  onClose,
  title = 'Go to Label',
  placeholder = 'Go to label…',
  emptyStateText = 'No labels match',
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items.slice(0, MAX_RESULTS);
    const scored: { item: GoToLabelItem; s: number }[] = [];
    for (const item of items) {
      const s = score(item.label, query.trim());
      if (s !== null) scored.push({ item, s });
    }
    return scored.sort((a, b) => b.s - a.s).slice(0, MAX_RESULTS).map(x => x.item); // highest score first
  }, [items, query]);

  // Clamp activeIndex when results shrink
  useEffect(() => {
    setActiveIndex(i => Math.min(i, Math.max(0, filteredItems.length - 1)));
  }, [filteredItems.length]);

  // Scroll active item into view
  useEffect(() => {
    const li = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    li?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filteredItems[activeIndex];
      if (item) onSelect(item.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [filteredItems, activeIndex, onSelect, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex justify-center"
      style={{ paddingTop: '10vh' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Subtle backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Palette panel */}
      <div
        className="relative bg-gray-900 border border-gray-600 rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{ height: 'fit-content', maxHeight: '60vh' }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 flex-shrink-0">
            {title}
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 text-sm outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="text-xs text-gray-500 flex-shrink-0">{canvasName}</span>
        </div>

        {/* Results */}
        {filteredItems.length > 0 ? (
          <ul ref={listRef} className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 48px)' }}>
            {filteredItems.map((item, i) => (
              <li
                key={item.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm select-none ${
                  i === activeIndex
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={() => onSelect(item.id)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 flex-shrink-0 ${i === activeIndex ? 'text-indigo-200' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l3-3 3 3m0 10l-3 3-3-3" />
                </svg>
                <span className="font-mono">{item.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-3 py-4 text-sm text-gray-500 text-center">{emptyStateText}</div>
        )}

        {/* Footer hint */}
        <div className="px-3 py-1.5 border-t border-gray-700 flex items-center gap-3 text-xs text-gray-600">
          <span><kbd className="font-sans">↑↓</kbd> navigate</span>
          <span><kbd className="font-sans">↵</kbd> jump</span>
          <span><kbd className="font-sans">Esc</kbd> dismiss</span>
          <span className="ml-auto">{filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GoToLabelModal;
