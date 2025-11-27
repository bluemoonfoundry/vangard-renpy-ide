
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
  const [isMounted, setIsMounted] = useState(false);
  const decorationIds = useRef<string[]>([]);
  
  // Refs to keep track of latest props for closures
  const onDirtyChangeRef = useRef(onDirtyChange);
  const onTriggerSaveRef = useRef(onTriggerSave);
  const onSaveRef = useRef(onSave);
  const blockRef = useRef(block);
  const onSwitchFocusBlockRef = useRef(onSwitchFocusBlock);
  const analysisResultRef = useRef(analysisResult);
  
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
    onTriggerSaveRef.current = onTriggerSave;
    onSaveRef.current = onSave;
    blockRef.current = block;
    onSwitchFocusBlockRef.current = onSwitchFocusBlock;
    analysisResultRef.current = analysisResult;
  }, [onDirtyChange, onTriggerSave, onSave, block, onSwitchFocusBlock, analysisResult]);

  useEffect(() => {
    return () => {
        if (editorRef.current) {
             try {
                const currentContent = editorRef.current.getValue();
                if (currentContent !== blockRef.current.content) {
                    onSaveRef.current(blockRef.current.id, currentContent);
                }
             } catch (e) {
             }
        }
        onDirtyChangeRef.current(blockRef.current.id, false);
        onEditorUnmount(blockRef.current.id);
    };
  }, [onEditorUnmount]);
  
  useEffect(() => {
    if (editorRef.current && initialScrollRequest) {
        const editor = editorRef.current;
        setTimeout(() => {
            editor.revealLineInCenter(initialScrollRequest.line, monaco.editor.ScrollType.Smooth);
            editor.setPosition({ lineNumber: initialScrollRequest.line, column: 1 });
        }, 100); 
    }
  }, [initialScrollRequest]);

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
        return; 
      }

      const currentIndent = line.length - line.trimStart().length;

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
    setIsMounted(true);

    aiFeaturesEnabledContextKey.current = editor.createContextKey('aiFeaturesEnabled', enableAiFeatures);

    // Setup Drop Handler
    const editorNode = editor.getDomNode();
    if (editorNode) {
      editorNode.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
        }
      });

      editorNode.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Stop native handling which might insert text as a snippet ($0)
        const data = e.dataTransfer?.getData('application/renpy-dnd');
        if (data) {
          try {
            const payload = JSON.parse(data);
            const target = editor.getTargetAtClientPoint(e.clientX, e.clientY);
            if (target && target.position) {
              const position = target.position;
              editor.executeEdits('dnd', [{
                range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                text: payload.text,
                forceMoveMarkers: true
              }]);
              editor.setPosition(position);
              editor.focus();
            }
          } catch (err) {
            console.error("Failed to parse drop data", err);
          }
        }
      });
    }

    editor.onDidChangeModelContent(() => {
        const currentContent = editor.getValue();
        const savedContent = blockRef.current.content;
        const isDirty = currentContent !== savedContent;
        onDirtyChangeRef.current(blockRef.current.id, isDirty);
    });

    // Use addAction instead of addCommand for cleaner action registration
    editor.addAction({
        id: 'save-block',
        label: 'Save',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => {
            if (onTriggerSaveRef.current) {
                onTriggerSaveRef.current(blockRef.current.id);
            }
        }
    });

    editor.onMouseDown((e) => {
      if (e.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT || !e.target.position) {
          return;
      }
      // Only trigger on Ctrl/Cmd click
      if (!e.event.ctrlKey && !e.event.metaKey) {
          return;
      }
  
      const position = e.target.position;
      const jumpsInBlock = analysisResultRef.current.jumps[blockRef.current.id] || [];
      const clickedJump = jumpsInBlock.find(jump =>
          jump.line === position.lineNumber &&
          position.column >= jump.columnStart &&
          position.column <= jump.columnEnd
      );
  
      if (clickedJump) {
          const targetLabelLocation = analysisResultRef.current.labels[clickedJump.target];
          if (targetLabelLocation) {
              e.event.preventDefault();
              onSwitchFocusBlockRef.current(targetLabelLocation.blockId, targetLabelLocation.line);
          }
      }
    });

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

    const disposable = editor.onDidChangeModelContent(() => {
      const markers = performValidation(editor.getValue(), monaco);
      monaco.editor.setModelMarkers(editor.getModel()!, 'renpy', markers);
    });
    
    const markers = performValidation(editor.getValue(), monaco);
    monaco.editor.setModelMarkers(editor.getModel()!, 'renpy', markers);
  };
  
  // Effect to update decorations when analysis or theme changes
  useEffect(() => {
      if (!isMounted || !editorRef.current || !monacoRef.current) return;
  
      const editor = editorRef.current;
      const monaco = monacoRef.current;
  
      const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
      const jumpsInBlock = analysisResult.jumps[block.id] || [];
  
      jumpsInBlock.forEach(jump => {
          const targetLabelLocation = analysisResult.labels[jump.target];
          if (targetLabelLocation) {
              newDecorations.push({
                  range: new monaco.Range(jump.line, jump.columnStart, jump.line, jump.columnEnd),
                  options: {
                      inlineClassName: 'renpy-jump-link',
                      hoverMessage: { value: `Cmd/Ctrl + click to follow link to '${jump.target}'`, isTrusted: true, supportHtml: true }
                  }
              });
          }
          else if (!jump.isDynamic) {
               newDecorations.push({
                  range: new monaco.Range(jump.line, jump.columnStart, jump.line, jump.columnEnd),
                  options: {
                      inlineClassName: 'renpy-jump-invalid',
                      hoverMessage: { value: `Label '${jump.target}' not found.`, isTrusted: true, supportHtml: true }
                  }
              });
          } else { // is dynamic
               newDecorations.push({
                  range: new monaco.Range(jump.line, jump.columnStart, jump.line, jump.columnEnd),
                  options: {
                      inlineClassName: 'renpy-jump-dynamic',
                      hoverMessage: { value: `Dynamic jump to expression '${jump.target}'. Cannot verify.`, isTrusted: true, supportHtml: true }
                  }
              });
          }
      });
      
      decorationIds.current = editor.deltaDecorations(decorationIds.current, newDecorations);
  
  }, [analysisResult, block.id, isMounted]);

  const getHoverMessage = (word: string, type: 'character' | 'image' | 'color'): { value: string, isTrusted: boolean, supportHtml: boolean } | null => {
      if (type === 'character') {
          const char = analysisResultRef.current.characters.get(word);
          if (char) {
              return {
                  value: `**Character: ${char.name}**\n\n${char.profile || 'No profile info.'}\n\n<div style="width: 20px; height: 20px; background-color: ${char.color}; border: 1px solid #ccc;"></div>`,
                  isTrusted: true,
                  supportHtml: true
              };
          }
      }
      return null;
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
          hover: {
              enabled: true,
              delay: 300,
          }
        }}
      />
      <GenerateContentModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onInsertContent={handleInsertContent}
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
