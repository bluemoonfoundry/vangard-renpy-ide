/**
 * @file SubsectionHeader.tsx
 * @description Collapsible header for subsections within accordion sections.
 */

import React from 'react';

interface SubsectionHeaderProps {
  title: string;
  count?: number;
  isCollapsed: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}

export function SubsectionHeader({
  title,
  count,
  isCollapsed,
  onToggle,
  actions,
}: SubsectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary transition-colors"
      >
        <svg
          className={`w-3 h-3 flex-none transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M2 4L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          {title}
          {count !== undefined && ` (${count})`}
        </span>
      </button>
      {!isCollapsed && actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
}
