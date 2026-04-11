/**
 * @file MenuTemplatePickerModal.tsx
 * @description Modal for selecting a menu template to insert into the editor.
 * Displays searchable list of templates with preview.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { MenuTemplate } from '@/types';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface MenuTemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: MenuTemplate[];
  onSelect: (template: MenuTemplate) => void;
}

export function MenuTemplatePickerModal({
  isOpen,
  onClose,
  templates,
  onSelect,
}: MenuTemplatePickerModalProps) {
  const modalRef = useModalAccessibility(isOpen, onClose);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTemplate = selectedId ? templates.find(t => t.id === selectedId) : null;

  const handleInsert = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
    }
  };

  const generatePreview = (template: MenuTemplate): string => {
    let code = 'menu';
    if (template.menuStatement?.trim()) {
      code += ` "${template.menuStatement.trim().replace(/"/g, '\\"')}"`;
    }
    code += ':\n';

    template.choices.forEach(choice => {
      if (!choice.text.trim()) return;
      let line = '    "';
      line += choice.text.replace(/"/g, '\\"');
      line += '"';
      if (choice.condition?.trim()) {
        line += ` if ${choice.condition.trim()}`;
      }
      line += ':\n';
      switch (choice.action) {
        case 'jump':
          if (choice.target?.trim()) line += `        jump ${choice.target.trim()}\n`;
          break;
        case 'call':
          if (choice.target?.trim()) line += `        call ${choice.target.trim()}\n`;
          break;
        case 'pass':
          line += '        pass\n';
          break;
        case 'return':
          line += '        return\n';
          break;
      }
      code += line;
    });

    return code;
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        ref={modalRef}
        className="bg-secondary text-primary rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-picker-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-primary">
          <h2 id="template-picker-title" className="text-xl font-bold">
            Insert Menu Template
          </h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-primary">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full px-3 py-2 bg-tertiary border border-primary rounded text-primary placeholder-secondary"
          />
        </div>

        {/* Content - Split View */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: Template List */}
          <div className="w-64 border-r border-primary overflow-y-auto">
            {filteredTemplates.length === 0 ? (
              <p className="p-4 text-sm text-secondary italic">
                {searchQuery ? 'No templates match your search' : 'No templates available'}
              </p>
            ) : (
              <ul>
                {filteredTemplates.map(template => (
                  <li key={template.id}>
                    <button
                      onClick={() => setSelectedId(template.id)}
                      onDoubleClick={() => {
                        setSelectedId(template.id);
                        handleInsert();
                      }}
                      className={`w-full text-left p-3 border-b border-primary hover:bg-tertiary transition-colors ${
                        selectedId === template.id ? 'bg-tertiary' : ''
                      }`}
                    >
                      <p className="font-semibold text-sm truncate">{template.name}</p>
                      {template.description && (
                        <p className="text-xs text-secondary truncate mt-1">{template.description}</p>
                      )}
                      <p className="text-xs text-secondary mt-1">
                        {template.choices.length} choice{template.choices.length !== 1 ? 's' : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Right: Preview */}
          <div className="flex-1 flex flex-col p-4 bg-tertiary">
            {selectedTemplate ? (
              <>
                <h3 className="text-sm font-semibold mb-2 text-secondary">Preview</h3>
                <pre className="flex-1 p-3 bg-secondary rounded border border-primary overflow-auto text-sm font-mono text-primary">
                  {generatePreview(selectedTemplate)}
                </pre>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-secondary">
                Select a template to preview
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-primary">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-tertiary hover:bg-tertiary-hover rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={!selectedTemplate}
            className="px-4 py-2 bg-accent hover:bg-accent-hover rounded disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            Insert
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
