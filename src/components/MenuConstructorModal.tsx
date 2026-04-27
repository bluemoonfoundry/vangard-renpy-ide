/**
 * @file MenuConstructorModal.tsx
 * @description Modal component for visually building Ren'Py menu blocks.
 * Provides visual editor for menu choices with validation and code generation.
 * Can be used for creating new menus or editing existing templates.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MenuChoice, MenuTemplate } from '@/types';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import { createId } from '@/lib/createId';
import * as monaco from 'monaco-editor';
import CodeActionButtons from './CodeActionButtons';

interface CodeBlockEditorProps {
  value: string;
  onChange: (value: string) => void;
  hasError: boolean;
}

function CodeBlockEditor({ value, onChange, hasError }: CodeBlockEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create Monaco editor instance
    const editor = monaco.editor.create(containerRef.current, {
      value: value,
      language: 'python', // Use Python for Ren'Py syntax highlighting
      theme: 'vs-dark',
      minimap: { enabled: false },
      lineNumbers: 'on',
      fontSize: 12,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on',
      folding: false,
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'none',
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      overviewRulerLanes: 0,
    });

    editorRef.current = editor;

    // Listen for content changes
    const disposable = editor.onDidChangeModelContent(() => {
      onChangeRef.current(editor.getValue());
    });

    return () => {
      disposable.dispose();
      editor.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update editor value when prop changes (but not from editor itself)
  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`border rounded ${hasError ? 'border-red-500' : 'border-primary'}`}
      style={{ height: '120px' }}
    />
  );
}

interface MenuConstructorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (code: string, templateData?: { name: string; description?: string; menuStatement?: string; choices: MenuChoice[] }) => void;
  initialTemplate?: MenuTemplate;
  labels: Set<string>;
  variables: Set<string>;
  mode: 'create' | 'edit-template';
  activeEditor?: monaco.editor.IStandaloneCodeEditor | null;
}

export function MenuConstructorModal({
  isOpen,
  onClose,
  onInsert,
  initialTemplate,
  labels,
  variables,
  mode,
  activeEditor,
}: MenuConstructorModalProps) {
  const { contentRef: modalRef } = useModalAccessibility({ isOpen, onClose });

  const [menuStatement, setMenuStatement] = useState('');
  const [choices, setChoices] = useState<MenuChoice[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(mode === 'edit-template');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // Initialize from template when editing
  useEffect(() => {
    if (initialTemplate) {
      setMenuStatement(initialTemplate.menuStatement || '');
      setChoices(initialTemplate.choices);
      setTemplateName(initialTemplate.name);
      setTemplateDescription(initialTemplate.description || '');
      setSaveAsTemplate(mode === 'edit-template');
    } else {
      // Start with 2 empty choices
      setChoices([
        { id: createId('choice'), text: '', action: 'jump', target: '' },
        { id: createId('choice'), text: '', action: 'jump', target: '' },
      ]);
    }
  }, [initialTemplate, mode]);

  const addChoice = () => {
    setChoices([...choices, { id: createId('choice'), text: '', action: 'jump', target: '' }]);
  };

  const removeChoice = (id: string) => {
    if (choices.length > 1) {
      setChoices(choices.filter(c => c.id !== id));
    }
  };

  const updateChoice = (id: string, updates: Partial<MenuChoice>) => {
    setChoices(choices.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newChoices = [...choices];
    const draggedItem = newChoices[draggedIndex];
    newChoices.splice(draggedIndex, 1);
    newChoices.splice(index, 0, draggedItem);

    setChoices(newChoices);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Generate Ren'Py code
  const generateCode = (): string => {
    let code = 'menu';
    if (menuStatement.trim()) {
      code += ` "${menuStatement.trim().replace(/"/g, '\\"')}"`;
    }
    code += ':\n';

    choices.forEach(choice => {
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

  // Validation
  const getChoiceErrors = (choice: MenuChoice): string[] => {
    const errors: string[] = [];
    if (!choice.text.trim()) return errors; // Skip validation for empty choices

    if ((choice.action === 'jump' || choice.action === 'call') && !choice.target?.trim()) {
      errors.push(`${choice.action} action requires a target label`);
    }

    if (choice.action === 'code' && !choice.codeBlock?.trim()) {
      errors.push('Custom code action requires code to be entered');
    }

    return errors;
  };

  const isValid = (): boolean => {
    if (choices.filter(c => c.text.trim()).length === 0) return false;

    // Check that jump/call actions have targets, and code actions have code blocks
    for (const choice of choices) {
      if (!choice.text.trim()) continue;
      if ((choice.action === 'jump' || choice.action === 'call') && !choice.target?.trim()) {
        return false;
      }
      if (choice.action === 'code' && !choice.codeBlock?.trim()) {
        return false;
      }
    }

    // If saving as template, need a name
    if (saveAsTemplate && !templateName.trim()) return false;

    return true;
  };

  const handleInsert = () => {
    if (!isValid()) return;

    const code = generateCode();
    const templateData = saveAsTemplate ? {
      name: templateName.trim(),
      description: templateDescription.trim() || undefined,
      menuStatement: menuStatement.trim() || undefined,
      choices: choices.filter(c => c.text.trim()),
    } : undefined;

    onInsert(code, templateData);
    onClose();
  };

  if (!isOpen) return null;

  const generatedCode = generateCode();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div
        ref={modalRef}
        className="bg-secondary text-primary rounded-lg shadow-xl max-w-7xl w-full max-h-full flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-constructor-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-primary flex-shrink-0">
          <h2 id="menu-constructor-title" className="text-lg font-semibold">
            {mode === 'edit-template' ? 'Edit Menu Template' : 'Create Menu'}
          </h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Split View */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: Builder */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto border-r border-primary">
            {/* Menu Statement */}
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1.5 text-secondary">
                Menu Statement (optional)
              </label>
              <input
                type="text"
                value={menuStatement}
                onChange={(e) => setMenuStatement(e.target.value)}
                placeholder='e.g., "What will you do?"'
                className="w-full px-2.5 py-1.5 bg-tertiary border border-primary rounded text-sm text-primary placeholder-secondary"
              />
            </div>

            {/* Choices */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-secondary">Choices</label>
                <button
                  onClick={addChoice}
                  className="px-2.5 py-1 bg-accent hover:bg-accent-hover rounded text-xs text-white font-semibold"
                >
                  + Add Choice
                </button>
              </div>

              {choices.filter(c => c.text.trim()).length === 0 && (
                <div className="mb-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded flex items-start gap-2">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs text-yellow-800 dark:text-yellow-200">
                    At least one choice needs text before you can insert the menu.
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {choices.map((choice, index) => {
                  const errors = getChoiceErrors(choice);
                  const hasError = errors.length > 0;

                  return (
                  <div
                    key={choice.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`p-2.5 rounded border cursor-move ${
                      draggedIndex === index ? 'opacity-50' : ''
                    } ${
                      hasError ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : 'bg-tertiary border-primary'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {/* Drag Handle */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <svg className="w-4 h-4 text-secondary" fill="currentColor" viewBox="0 0 16 16">
                          <circle cx="4" cy="3" r="1.5"/>
                          <circle cx="4" cy="8" r="1.5"/>
                          <circle cx="4" cy="13" r="1.5"/>
                          <circle cx="12" cy="3" r="1.5"/>
                          <circle cx="12" cy="8" r="1.5"/>
                          <circle cx="12" cy="13" r="1.5"/>
                        </svg>
                        <span className="text-secondary font-mono text-xs">#{index + 1}</span>
                      </div>

                      <input
                        type="text"
                        value={choice.text}
                        onChange={(e) => updateChoice(choice.id, { text: e.target.value })}
                        placeholder="Choice text"
                        className="flex-1 px-2.5 py-1.5 bg-secondary border border-primary rounded text-sm text-primary placeholder-secondary"
                      />

                      <button
                        onClick={() => removeChoice(choice.id)}
                        disabled={choices.length === 1}
                        className="p-1 text-red-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                        title="Remove choice"
                        aria-label="Remove choice"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 ml-6">
                      {/* Condition */}
                      <input
                        type="text"
                        value={choice.condition || ''}
                        onChange={(e) => updateChoice(choice.id, { condition: e.target.value })}
                        placeholder="Condition (optional)"
                        className="px-2.5 py-1.5 bg-secondary border border-primary rounded text-xs text-primary placeholder-secondary font-mono"
                        list={`variables-datalist-${choice.id}`}
                      />

                      {/* Action + Target */}
                      <div className="flex gap-2 flex-col">
                        <div className="flex gap-2">
                          <select
                            value={choice.action}
                            onChange={(e) => updateChoice(choice.id, { action: e.target.value as MenuChoice['action'] })}
                            className="px-2.5 py-1.5 bg-secondary border border-primary rounded text-primary text-xs"
                          >
                            <option value="jump">jump</option>
                            <option value="call">call</option>
                            <option value="pass">pass</option>
                            <option value="return">return</option>
                            <option value="code">custom code</option>
                          </select>

                          {(choice.action === 'jump' || choice.action === 'call') && (
                            <input
                              type="text"
                              value={choice.target || ''}
                              onChange={(e) => updateChoice(choice.id, { target: e.target.value })}
                              placeholder="label name"
                              className={`flex-1 px-2.5 py-1.5 bg-secondary rounded text-xs text-primary placeholder-secondary font-mono ${
                                hasError ? 'border-2 border-red-500' : 'border border-primary'
                              }`}
                              list={`labels-datalist-${choice.id}`}
                            />
                          )}
                        </div>
                        {hasError && (
                          <div className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1">
                            <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span>{errors[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Code Block Editor - shown when action is 'code' */}
                    {choice.action === 'code' && (
                      <div className="ml-6 mt-2">
                        <label className="block text-xs font-medium mb-1.5 text-secondary">
                          Custom Code Block
                        </label>
                        <CodeBlockEditor
                          value={choice.codeBlock || ''}
                          onChange={(value) => updateChoice(choice.id, { codeBlock: value })}
                          hasError={hasError}
                        />
                      </div>
                    )}

                    {/* Datalists for autocomplete */}
                    <datalist id={`labels-datalist-${choice.id}`}>
                      {Array.from(labels).map(label => (
                        <option key={label} value={label} />
                      ))}
                    </datalist>
                    <datalist id={`variables-datalist-${choice.id}`}>
                      {Array.from(variables).map(variable => (
                        <option key={variable} value={variable} />
                      ))}
                    </datalist>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Save as Template (only in 'create' mode) */}
            {mode === 'create' && (
              <div className="mt-3 p-2.5 bg-tertiary rounded border border-primary">
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  <span className="text-xs font-medium">Save as Template</span>
                </label>

                {saveAsTemplate && (
                  <div className="space-y-1.5 ml-5">
                    <div>
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="Template name"
                        className={`w-full px-2.5 py-1.5 bg-secondary rounded text-primary placeholder-secondary text-xs ${
                          saveAsTemplate && !templateName.trim() ? 'border-2 border-red-500' : 'border border-primary'
                        }`}
                      />
                      {saveAsTemplate && !templateName.trim() && (
                        <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-1">
                          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>Template name is required</span>
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-2.5 py-1.5 bg-secondary border border-primary rounded text-primary placeholder-secondary text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Template Metadata (edit-template mode) */}
            {mode === 'edit-template' && (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-secondary">Template Name</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className={`w-full px-2.5 py-1.5 bg-tertiary rounded text-sm text-primary ${
                      !templateName.trim() ? 'border-2 border-red-500' : 'border border-primary'
                    }`}
                  />
                  {!templateName.trim() && (
                    <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-1">
                      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>Template name is required</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-secondary">Description (optional)</label>
                  <input
                    type="text"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-tertiary border border-primary rounded text-sm text-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="w-80 flex flex-col p-4 bg-tertiary">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-secondary">Generated Code</h3>
              <CodeActionButtons code={generatedCode} size="xs" />
            </div>
            <pre className="flex-1 p-2.5 bg-secondary rounded border border-primary overflow-auto text-xs font-mono text-primary leading-relaxed">
              {generatedCode}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-primary flex-shrink-0">
          {!isValid() && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded">
              <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-yellow-800 dark:text-yellow-200 font-medium">
                {choices.filter(c => c.text.trim()).length === 0
                  ? 'Add at least one choice with text'
                  : saveAsTemplate && !templateName.trim()
                  ? 'Template name is required'
                  : 'Some choices need a target label'}
              </span>
            </div>
          )}
          {isValid() && <div></div>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-tertiary hover:bg-tertiary-hover rounded text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={!isValid()}
              className="px-4 py-1.5 bg-accent hover:bg-accent-hover rounded disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold"
            >
              {mode === 'edit-template' ? 'Update Template' : 'Insert'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
