/**
 * @file AccordionSection.tsx
 * @description Reusable accordion section component for Story Elements panel.
 * Provides collapsible sections with header and content.
 */

import React from 'react';

interface AccordionSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  itemCount?: number;
  disabled?: boolean;
}

export function AccordionSection({
  title,
  isExpanded,
  onToggle,
  children,
  itemCount,
  disabled = false,
}: AccordionSectionProps) {
  return (
    <div className={`border-b border-primary flex flex-col ${disabled ? 'opacity-50' : ''}`}>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`flex-none w-full px-4 py-3 flex items-center justify-between transition-colors ${
          disabled ? 'cursor-not-allowed' : 'hover:bg-tertiary-hover'
        }`}
        aria-expanded={isExpanded}
        aria-controls={`accordion-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="font-medium">{title}</span>
          {itemCount !== undefined && itemCount > 0 && (
            <span className="text-xs bg-accent text-white px-2 py-0.5 rounded-full">
              {itemCount}
            </span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div
          id={`accordion-${title.toLowerCase().replace(/\s+/g, '-')}`}
          className="bg-tertiary flex-shrink-0"
        >
          {children}
        </div>
      )}
    </div>
  );
}
