import React, { useRef, useEffect } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import type { Block, RenpyAnalysisResult } from '../types';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

interface EditorViewProps {
  block: Block;
  analysisResult: RenpyAnalysisResult;
  initialScrollRequest?: { line: number; key: number };
  onSwitchFocusBlock: (blockId: string, line: number) => void;
  onSave: (blockId: string, newContent: string) => void;
  onDirtyChange: (blockId: string, isDirty: boolean) => void;
  saveTrigger: number;
  editorTheme: 'light' | 'dark';
}

const EditorView: React.FC<EditorViewProps> = ({ 
  block, 
  analysisResult,
  initialScrollRequest,
  onSwitchFocusBlock,
  onSave, 
  onDirtyChange,
  saveTrigger, 
  editorTheme 
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);

  useEffect(() => {
    if (saveTrigger > 0 && editorRef.current) {
        onSave(block.id, editorRef.current.getValue());
    }
  }, [saveTrigger, onSave, block.id]);

  useEffect(() => {
    // When the component unmounts, ensure dirty state is cleared
    return () => {
        onDirtyChange(block.id, false);
    };
  }, [block.id, onDirtyChange]);
  
  useEffect(() => {
    // This effect handles scrolling the editor to a specific line when requested.
    // It runs whenever a new `initialScrollRequest` is passed in.
    if (editorRef.current && initialScrollRequest) {
        const editor = editorRef.current;
        setTimeout(() => {
            editor.revealLineInCenter(initialScrollRequest.line, monaco.editor.ScrollType.Smooth);
            editor.setPosition({ lineNumber: initialScrollRequest.line, column: 1 });
        }, 100); // A small delay ensures the editor is fully ready.
    }
  }, [initialScrollRequest]);

  const handleEditorWillMount: BeforeMount = (monaco) => {
    // This setup only needs to run once per application load.
    if (!monaco.languages.getLanguages().some(({ id }) => id === 'renpy')) {
      monaco.languages.register({ id: 'renpy' });
      monaco.languages.setMonarchTokensProvider('renpy', {
        keywords: ['label', 'jump', 'call', 'menu', 'scene', 'show', 'hide', 'with', 'define', 'python', 'if', 'elif', 'else', 'return', 'expression'],
        tokenizer: { root: [[/#.*$/, 'comment'], [/"/, 'string', '@string_double'], [/'/, 'string', '@string_single'], [/\b[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }], [/\b\d+/, 'number'], [/[:=+\-*/!<>]+/, 'operator'], [/[(),.]/, 'punctuation']], string_double: [[/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"/, 'string', '@pop']], string_single: [[/[^\\']+/, 'string'], [/\\./, 'string.escape'], [/'/, 'string', '@pop']] },
      });
      monaco.editor.defineTheme('renpy-dark', { base: 'vs-dark', inherit: true, rules: [{ token: 'keyword', foreground: '859900' }, { token: 'string', foreground: '2aa198' }, { token: 'comment', foreground: '586e75', fontStyle: 'italic' }, { token: 'number', foreground: '268bd2' }, { token: 'identifier', foreground: 'd4d4d4' }, { token: 'operator', foreground: '93a1a1' }, { token: 'punctuation', foreground: '93a1a1' }], colors: { 'editor.background': '#252a33' } });
      monaco.editor.defineTheme('renpy-light', { base: 'vs', inherit: true, rules: [{ token: 'keyword', foreground: '859900' }, { token: 'string', foreground: '2aa198' }, { token: 'comment', foreground: '93a1a1', fontStyle: 'italic' }, { token: 'number', foreground: '268bd2' }, { token: 'identifier', foreground: '333333' }, { token: 'operator', foreground: '657b83' }, { token: 'punctuation', foreground: '657b83' }], colors: { 'editor.background': '#ffffff' } });
    }
  };

  const performValidation = (code: string, monacoInstance: typeof monaco): monaco.editor.IMarkerData[] => {
    const markers: monaco.editor.IMarkerData[] = [];
    const lines = code.split('\n');
    let previousIndent = -1;
    let expectIndentedBlock = false;

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();
      
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        return; // Skip empty and comment lines, but don't reset indent expectation
      }

      const currentIndent = line.length - line.trimStart().length;

      // 1. Check for expected indentation
      if (expectIndentedBlock) {
        if (currentIndent <= previousIndent) {
          markers.push({
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: line.length + 1,
            message: 'Indentation error: Expected an indented block.',
            severity: monacoInstance.MarkerSeverity.Error,
          });
        }
        expectIndentedBlock = false;
      }
      
      // 2. Check indentation consistency (must be multiple of 4)
      if (currentIndent % 4 !== 0) {
        markers.push({
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: currentIndent + 1,
          message: 'Indentation error: Use 4 spaces per indentation level.',
          severity: monacoInstance.MarkerSeverity.Error,
        });
      }

      // 3. Check for missing colons on block statements
      const colonKeywords = ['label', 'if', 'elif', 'menu', 'python', 'while', 'for', 'else'];
      const firstWord = trimmedLine.split(/[\s:]/)[0];
      if (colonKeywords.includes(firstWord) && !trimmedLine.endsWith(':')) {
        markers.push({
          startLineNumber: lineNumber,
          startColumn: line.indexOf(trimmedLine) + trimmedLine.length + 1,
          endLineNumber: lineNumber,
          endColumn: line.indexOf(trimmedLine) + trimmedLine.length + 2,
          message: `Syntax Error: Missing ':'`,
          severity: monacoInstance.MarkerSeverity.Error,
        });
      }
      
      if (trimmedLine.endsWith(':')) {
        expectIndentedBlock = true;
        previousIndent = currentIndent;
      }
    });

    // 4. Check for invalid jumps using existing analysis
    const invalidJumpsForBlock = analysisResult.invalidJumps[block.id] || [];
    const allJumpsInBlock = analysisResult.jumps[block.id] || [];

    allJumpsInBlock.forEach(jump => {
      if (invalidJumpsForBlock.includes(jump.target)) {
        markers.push({
          startLineNumber: jump.line,
          startColumn: jump.columnStart,
          endLineNumber: jump.line,
          endColumn: jump.columnEnd,
          message: `Invalid jump target: Label '${jump.target}' not found.`,
          severity: monacoInstance.MarkerSeverity.Error,
        });
      }
    });

    return markers;
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.focus();

    const validateCode = () => {
        if (!monacoRef.current || !editorRef.current) return;
        const code = editorRef.current.getValue();
        const model = editorRef.current.getModel();
        if (model) {
            const markers = performValidation(code, monacoRef.current);
            monacoRef.current.editor.setModelMarkers(model, 'renpy-validator', markers);
        }
    };
    
    // Initial validation and hyperlink setup
    validateCode();

    const { jumps, labels } = analysisResult;
    const blockJumps = jumps[block.id] || [];
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = blockJumps.map(jump => {
      const targetExists = !!labels[jump.target];
      let inlineClassName = 'renpy-jump-link';
      
      if (!targetExists) {
        if (jump.isDynamic) {
          inlineClassName = 'renpy-jump-dynamic';
        } else {
          inlineClassName = 'renpy-jump-invalid';
        }
      }

      return {
        range: new monaco.Range(jump.line, jump.columnStart, jump.line, jump.columnEnd),
        options: {
          inlineClassName: inlineClassName,
        }
      };
    });
    editor.deltaDecorations([], newDecorations);

    // Set up click listener for valid jumps
    editor.onMouseDown((e) => {
        const target = e.target;
        if (target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT || !target.position) return;
        
        const classList = target.element?.classList;
        const isJumpLink = classList?.contains('renpy-jump-link') || 
                           classList?.contains('renpy-jump-dynamic') || 
                           classList?.contains('renpy-jump-invalid');
        if (!isJumpLink) return;

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
    
    // Track dirty state and re-validate on content change
    editor.onDidChangeModelContent(() => {
        const currentValue = editor.getValue();
        onDirtyChange(block.id, currentValue !== block.content);
        validateCode();
    });
  };

  return (
    <div className="w-full h-full p-1 bg-white dark:bg-gray-800">
        <Editor
            key={block.id}
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
                fontSize: 16,
                padding: { top: 10 },
            }}
        />
    </div>
  );
};

export default EditorView;