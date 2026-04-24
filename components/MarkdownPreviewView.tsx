/**
 * @file MarkdownPreviewView.tsx
 * @description Split preview/edit view for `.md` files (~200 lines).
 * Key features: rendered HTML preview via `marked`, Monaco source editor, save-on-blur,
 * unsaved-changes dirty indicator, error display for missing files.
 * Integration: opened as a tab in `EditorView` for `.md` files; reads/writes via
 * `window.electronAPI.readFile` / `writeFile` IPC calls.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Editor from '@monaco-editor/react';
import { logger } from '../lib/logger';

interface MarkdownPreviewViewProps {
  filePath: string;
  projectRootPath: string;
  editorTheme?: 'light' | 'dark';
  addToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const MarkdownPreviewView: React.FC<MarkdownPreviewViewProps> = ({ filePath, projectRootPath, editorTheme = 'dark', addToast }) => {
  const [content, setContent] = useState<string>('');
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedContentRef = useRef('');

  // Load file content
  useEffect(() => {
    const loadFile = async () => {
      if (!window.electronAPI) return;
      setIsLoading(true);
      setError(null);
      try {
        const fullPath = await window.electronAPI.path.join(projectRootPath, filePath);
        const text = await window.electronAPI.readFile(fullPath);
        setContent(text);
        savedContentRef.current = text;
      } catch (err) {
        logger.error('Failed to load markdown file', err);
        setError('Failed to load file.');
      } finally {
        setIsLoading(false);
      }
    };
    loadFile();
  }, [filePath, projectRootPath]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!window.electronAPI || !isDirty) return;
    try {
      const fullPath = await window.electronAPI.path.join(projectRootPath, filePath);
      await window.electronAPI.writeFile(fullPath, content);
      savedContentRef.current = content;
      setIsDirty(false);
      addToast?.('File saved', 'success');
    } catch (err) {
      logger.error('Failed to save markdown file', err);
      addToast?.('Failed to save file', 'error');
    }
  }, [content, filePath, projectRootPath, isDirty, addToast]);

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && mode === 'edit') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, mode]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    const newContent = value ?? '';
    setContent(newContent);
    setIsDirty(newContent !== savedContentRef.current);
  }, []);

  // Parse markdown with sanitization
  const renderedHtml = useMemo(() => {
    try {
      const parsed = marked.parse(content, { gfm: true, breaks: true }) as string;
      // Sanitize HTML to prevent XSS attacks
      return DOMPurify.sanitize(parsed, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'a', 'code', 'pre', 'ul', 'ol', 'li',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody',
          'tr', 'th', 'td', 'blockquote', 'hr', 'img', 'span', 'div', 'del',
          'input'
        ],
        ALLOWED_ATTR: ['href', 'class', 'src', 'alt', 'title', 'id', 'type', 'checked', 'disabled']
      });
    } catch (e) {
      logger.error('Failed to parse markdown', e);
      return '<p>Failed to parse markdown.</p>';
    }
  }, [content]);

  const fileName = filePath.split('/').pop() ?? 'Markdown';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-secondary">
        Loading {fileName}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-secondary">{fileName}</span>
          {isDirty && <span className="text-xs text-blue-500 font-medium">Modified</span>}
        </div>
        <div className="flex items-center space-x-2">
          {mode === 'edit' && isDirty && (
            <button
              onClick={handleSave}
              className="px-3 py-1 text-xs font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Save
            </button>
          )}
          <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
            <button
              onClick={() => setMode('preview')}
              className={`px-3 py-1 text-xs font-semibold transition-colors ${
                mode === 'preview'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label="Preview markdown"
            >
              Preview
            </button>
            <button
              onClick={() => setMode('edit')}
              className={`px-3 py-1 text-xs font-semibold transition-colors ${
                mode === 'edit'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label="Edit markdown"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {mode === 'preview' ? (
        <div className="flex-1 overflow-y-auto p-8 overscroll-contain">
          <div
            className="markdown-body max-w-4xl mx-auto"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      ) : (
        <div className="flex-1">
          <Editor
            height="100%"
            language="markdown"
            theme={editorTheme === 'dark' ? 'vs-dark' : 'vs'}
            value={content}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              lineNumbers: 'on',
              fontSize: 14,
              padding: { top: 16 },
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default MarkdownPreviewView;
