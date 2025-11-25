

import React, { useRef, useEffect, useState } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import type { Block, RenpyAnalysisResult, ToastMessage } from '../types';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import GenerateContentModal from './GenerateContentModal';

interface EditorViewProps {
  block: Block;
  blocks: Block[];
  analysisResult: RenpyAnalysisResult;
  initialScrollRequest?: { line: number; key: number };
  onSwitchFocusBlock: (blockId: string, line: number) => void;
  onSave: (blockId: string, newContent: string) => void;
  onTriggerSave?: (blockId: string) => void;
  onDirtyChange: (blockId: string, isDirty: boolean) => void;
  editorTheme: 'light' | 'dark';
  apiKey?: string;
  enableAiFeatures: boolean;
  availableModels: string[];
  selectedModel: string;
  addToast: (message: string, type: ToastMessage['type']) => void;
  onEditorMount: (blockId: string, editor: monaco.editor.IStandaloneCodeEditor) => void;
  onEditorUnmount: (blockId: string) => void;
}

const EditorView: React.FC<EditorViewProps> = (props) => {
  const { 
    block, 
    blocks,
    analysisResult,
    initialScrollRequest,
    onSwitchFocusBlock,
    onSave, 
    onTriggerSave,
    onDirtyChange,
    editorTheme,
    apiKey,
    enableAiFeatures,
    availableModels,
    selectedModel,
    addToast,
    onEditorMount,
    onEditorUnmount,
  } = props;
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const aiFeaturesEnabledContextKey = useRef<monaco.editor.IContextKey<boolean> | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  
  // Refs to keep track of latest props for closures
  const onDirtyChangeRef = useRef(onDirtyChange);
  const onTriggerSaveRef = useRef(onTriggerSave);
  const onSaveRef = useRef(onSave);
  const blockRef = useRef(block);
  
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
    onTriggerSaveRef.current = onTriggerSave;
    onSaveRef.current = onSave;
    blockRef.current = block;
  }, [onDirtyChange, onTriggerSave, onSave, block]);

  useEffect(() => {
    // When the component unmounts (tab switch/close), sync content to parent block state
    // and clear the editor dirty flag. This effectively persists the changes to the 'file'
    // but not yet to disk, maintaining a dirty state at the block level.
    return () => {
        if (editorRef.current) {
             try {
                const currentContent = editorRef.current.getValue();
                if (currentContent !== blockRef.current.content) {
                    onSaveRef.current(blockRef.current.id, currentContent);
                }
             } catch (e) {
                 // Editor might be disposed already
             }
        }
        onDirtyChangeRef.current(blockRef.current.id, false);
        onEditorUnmount(blockRef.current.id);
    };
  }, [onEditorUnmount]);
  
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

  // This effect synchronizes the `enableAiFeatures` prop with the Monaco editor's context key.
  // This ensures the context menu item is correctly shown or hidden when the setting changes.
  useEffect(() => {
    if (aiFeaturesEnabledContextKey.current) {
      aiFeaturesEnabledContextKey.current.set(enableAiFeatures);
    }
  }, [enableAiFeatures]);

  const handleInsertContent = (content: string) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selection = editor.getSelection();
    if (selection) {
      const id = { major: 1, minor: 1 };
      const op = { identifier: id, range: selection, text: content, forceMoveMarkers: true };
      editor.executeEdits('gemini-insert', [op]);
      editor.focus();
    }
  };

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
    onEditorMount(block.id, editor);
    editor.focus();

    // Create the context key and store it in the ref so we can update it later.
    aiFeaturesEnabledContextKey.current = editor.createContextKey('aiFeaturesEnabled', enableAiFeatures);

    // Listen for content changes to update dirty state
    editor.onDidChangeModelContent(() => {
        const currentContent = editor.getValue();
        const savedContent = blockRef.current.content;
        // We use a simple equality check. If the editor content differs from the 
        // last saved content (blockRef.current.content), it is dirty.
        const isDirty = currentContent !== savedContent;
        onDirtyChangeRef.current(blockRef.current.id, isDirty);
    });

    // Add Ctrl+S / Cmd+S binding
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (onTriggerSaveRef.current) {
            onTriggerSaveRef.current(blockRef.current.id);
        }
    });

    // Add the "Generate AI Content" action to the context menu
    editor.addAction({
      id: 'generate-ai-content',
      label: 'Generate AI Content...',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI,
      ],
      precondition: 'aiFeaturesEnabled',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.5,
      run: () => {
        setIsGenerateModalOpen(true);
      },
    });

    // Add validation
    const disposable = editor.onDidChangeModelContent(() => {
      const markers = performValidation(editor.getValue(), monaco);
      monaco.editor.setModelMarkers(editor.getModel()!, 'renpy', markers);
    });
    
    // Initial validation
    const markers = performValidation(editor.getValue(), monaco);
    monaco.editor.setModelMarkers(editor.getModel()!, 'renpy', markers);
  };

  const getCurrentContext = () => {
      if (!editorRef.current) return '';
      const model = editorRef.current.getModel();
      const position = editorRef.current.getPosition();
      if (model && position) {
          return model.getValueInRange({
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
          });
      }
      return '';
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Editor
        height="100%"
        defaultLanguage="renpy"
        path={block.filePath || block.id}
        defaultValue={block.content}
        theme={editorTheme === 'dark' ? 'renpy-dark' : 'renpy-light'}
        onMount={handleEditorDidMount}
        beforeMount={handleEditorWillMount}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
        }}
      />
      <GenerateContentModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onInsertContent={handleInsertContent}
        apiKey={apiKey}
        currentBlockId={block.id}
        blocks={blocks}
        analysisResult={analysisResult}
        getCurrentContext={getCurrentContext}
        availableModels={availableModels}
        selectedModel={selectedModel}
      />
    </div>
  );
};

export default EditorView;
