/**
 * @file MenuTemplateManager.tsx
 * @description Manages saved menu templates in the Tools section.
 * Displays list of templates with expand/collapse, edit, delete, and copy functionality.
 */

import React, { useState } from 'react';
import type { MenuTemplate } from '@/types';
import CopyButton from './CopyButton';

interface MenuTemplateManagerProps {
  templates: MenuTemplate[];
  onCreateTemplate: () => void;
  onEditTemplate: (template: MenuTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
}

export function MenuTemplateManager({
  templates,
  onCreateTemplate,
  onEditTemplate,
  onDeleteTemplate,
}: MenuTemplateManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const generateCodeFromTemplate = (template: MenuTemplate): string => {
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

      // Use code block if action is 'code' and codeBlock is provided
      if (choice.action === 'code' && choice.codeBlock?.trim()) {
        // Indent each line of the code block by 8 spaces (2 levels)
        const indentedCode = choice.codeBlock
          .split('\n')
          .map(codeLine => codeLine.trim() ? `        ${codeLine}` : '')
          .join('\n');
        line += indentedCode + '\n';
      } else {
        // Use simple action
        switch (choice.action) {
          case 'jump':
            if (choice.target?.trim()) {
              line += `        jump ${choice.target.trim()}\n`;
            }
            break;
          case 'call':
            if (choice.target?.trim()) {
              line += `        call ${choice.target.trim()}\n`;
            }
            break;
          case 'pass':
            line += '        pass\n';
            break;
          case 'return':
            line += '        return\n';
            break;
        }
      }

      code += line;
    });

    return code;
  };

  return (
    <div className="space-y-2">
      {templates.length === 0 ? (
        <p className="text-sm text-secondary italic py-4">
          No menu templates yet. Create one to reuse menu structures.
        </p>
      ) : (
        <ul className="space-y-2">
          {templates.map(template => {
            const isExpanded = expandedId === template.id;
            const generatedCode = generateCodeFromTemplate(template);

            return (
              <li
                key={template.id}
                className="bg-tertiary rounded border border-primary overflow-hidden"
              >
                {/* Template Header */}
                <div className="p-3 flex items-center justify-between group hover:bg-tertiary-hover">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : template.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-secondary">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-primary truncate">
                          {template.name}
                        </p>
                        {template.description && (
                          <p className="text-xs text-secondary truncate">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-secondary mr-2">
                      {template.choices.length} choice{template.choices.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => onEditTemplate(template)}
                      className="p-1 text-secondary hover:text-accent rounded"
                      title="Edit template"
                      aria-label="Edit template"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteTemplate(template.id)}
                      className="p-1 text-red-500 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete template"
                      aria-label="Delete template"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Preview */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="bg-secondary rounded p-2 border border-primary">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-secondary">Generated Code</span>
                        <CopyButton text={generatedCode} size="xs" />
                      </div>
                      <pre className="text-xs font-mono text-primary overflow-x-auto max-h-64 overflow-y-auto">
                        {generatedCode}
                      </pre>
                    </div>

                    <div className="text-xs text-secondary">
                      <p>Created: {new Date(template.createdAt).toLocaleDateString()}</p>
                      {template.updatedAt !== template.createdAt && (
                        <p>Updated: {new Date(template.updatedAt).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
