import React, { useRef } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import type { Block, RenpyAnalysisResult } from '../types';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

interface EditorModalProps {
  block: Block;
  analysisResult: RenpyAnalysisResult;
  initialScrollLine?: number;
  onSwitchFocusBlock: (blockId: string, line: number) => void;
  onSave: (newContent: string) => void;
  onClose: () => void;
  editorTheme: 'light' | 'dark';
}

const EditorModal: React.FC<EditorModalProps> = ({ 
  block, 
  analysisResult,
  initialScrollLine,
  onSwitchFocusBlock,
  onSave, 
  onClose, 
  editorTheme 
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleSave = () => {
    if (editorRef.current) {
      onSave(editorRef.current.getValue());
    }
  };
  
  const handleEditorWillMount: BeforeMount = (monaco) => {
    // This setup only needs to run once per application load.
    if (!monaco.languages.getLanguages().some(({ id }) => id === 'renpy')) {
      monaco.languages.register({ id: 'renpy' });
      monaco.languages.setMonarchTokensProvider('renpy', {
        keywords: ['label', 'jump', 'call', 'menu', 'scene', 'show', 'hide', 'with', 'define', 'python', 'if', 'elif', 'else', 'return'],
        tokenizer: { root: [[/#.*$/, 'comment'], [/"/, 'string', '@string_double'], [/'/, 'string', '@string_single'], [/\b[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }], [/\b\d+/, 'number'], [/[:=+\-*/!<>]+/, 'operator'], [/[(),.]/, 'punctuation']], string_double: [[/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"/, 'string', '@pop']], string_single: [[/[^\\']+/, 'string'], [/\\./, 'string.escape'], [/'/, 'string', '@pop']] },
      });
      monaco.editor.defineTheme('renpy-dark', { base: 'vs-dark', inherit: true, rules: [{ token: 'keyword', foreground: '859900' }, { token: 'string', foreground: '2aa198' }, { token: 'comment', foreground: '586e75', fontStyle: 'italic' }, { token: 'number', foreground: '268bd2' }, { token: 'identifier', foreground: 'd4d4d4' }, { token: 'operator', foreground: '93a1a1' }, { token: 'punctuation', foreground: '93a1a1' }], colors: { 'editor.background': '#252a33' } });
      monaco.editor.defineTheme('renpy-light', { base: 'vs', inherit: true, rules: [{ token: 'keyword', foreground: '859900' }, { token: 'string', foreground: '2aa198' }, { token: 'comment', foreground: '93a1a1', fontStyle: 'italic' }, { token: 'number', foreground: '268bd2' }, { token: 'identifier', foreground: '333333' }, { token: 'operator', foreground: '657b83' }, { token: 'punctuation', foreground: '657b83' }], colors: { 'editor.background': '#ffffff' } });
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.focus();

    // --- Start: Consolidated Setup Logic ---
    // 1. Apply decorations (hyperlinks)
    const { jumps, labels } = analysisResult;
    const blockJumps = jumps[block.id] || [];
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = blockJumps.map(jump => {
      const isInvalid = !labels[jump.target];
      return {
        range: new monaco.Range(jump.line, jump.columnStart, jump.line, jump.columnEnd),
        options: {
          inlineClassName: isInvalid ? 'renpy-jump-invalid' : 'renpy-jump-link',
        }
      };
    });
    editor.deltaDecorations([], newDecorations); // Using [] is safe because it's a new editor instance

    // 2. Set up click listener
    editor.onMouseDown((e) => {
        const target = e.target;
        if (target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT || !target.position) return;
        if (!target.element?.classList.contains('renpy-jump-link')) return;

        const clickedJump = blockJumps.find(j => 
            j.line === target.position!.lineNumber &&
            j.columnStart <= target.position!.column &&
            j.columnEnd >= target.position!.column
        );
        
        if (!clickedJump) return;
        
        const targetLabelLocation = labels[clickedJump.target];
        if (!targetLabelLocation) return;
        
        if (targetLabelLocation.blockId === block.id) {
            editor.revealLineInCenter(targetLabelLocation.line, monaco.editor.ScrollType.Smooth);
            editor.setPosition({ lineNumber: targetLabelLocation.line, column: 1 });
        } else {
            onSwitchFocusBlock(targetLabelLocation.blockId, targetLabelLocation.line);
        }
    });
    
    // 3. Scroll to initial line if provided
    if (initialScrollLine) {
        setTimeout(() => {
            editor.revealLineInCenter(initialScrollLine, monaco.editor.ScrollType.Smooth);
            editor.setPosition({ lineNumber: initialScrollLine, column: 1 });
        }, 100); // Small timeout to ensure layout is complete
    }
    // --- End: Consolidated Setup Logic ---
  };

  const modalTitle = block.filePath || block.title || analysisResult.firstLabels[block.id] || `Ren'Py Block`;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={onClose} // Close on backdrop click
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-3/4 h-3/4 flex flex-col"
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <header className="bg-gray-100 dark:bg-gray-700 p-4 rounded-t-lg flex justify-between items-center flex-shrink-0 border-b border-gray-200 dark:border-gray-600">
          <h2 className="text-xl font-bold truncate">Focus Mode: <span className="text-indigo-600 dark:text-indigo-400" title={modalTitle}>{modalTitle}</span></h2>
          <button 
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition duration-200"
          >
            Save & Close
          </button>
        </header>
        <div className="flex-grow p-1 relative">
          <Editor
            key={block.id} // This key is CRITICAL: it forces React to re-mount the editor, triggering onMount
            height="100%"
            language="renpy"
            theme={editorTheme === 'dark' ? 'renpy-dark' : 'renpy-light'}
            defaultValue={block.content}
            beforeMount={handleEditorWillMount}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: true },
              lineNumbers: 'on',
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              fontSize: 16,
              padding: { top: 10 },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default EditorModal;
