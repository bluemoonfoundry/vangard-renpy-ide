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

const LABEL_REGEX = /^\s*label\s+([a-zA-Z0-9_]+):/;
const JUMP_REGEX = /\b(jump|call)\s+([a-zA-Z0-9_]+)/g;

const Breadcrumbs: React.FC<{ filePath?: string, context?: string }> = ({ filePath, context }) => {
    if (!filePath) return null;
    
    const parts = filePath.split(/[/\\]/);
    
    return (
        <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-1.5 select-none overflow-hidden">
            {parts.map((part, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <span className="opacity-50">/</span>}
                    <span className={i === parts.length - 1 && !context ? "font-semibold text-gray-700 dark:text-gray-200" : ""}>{part}</span>
                </React.Fragment>
            ))}
            {context && (
                <>
                    <span className="opacity-50">&gt;</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center">
                        {context}
                    </span>
                </>
            )}
        </div>
    );
};

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
  const [currentContext, setCurrentContext] = useState<string>('');
  
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
    const localLabels = new Set<string>();

    // Pass 1: Find local labels currently defined in editor content
    lines.forEach(line => {
        const match = line.match(LABEL_REGEX);
        if (match) localLabels.add(match[1]);
    });

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
          severity: monacoInstance.MarkerSeverity.Warning,
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

      // Real-time Jump Validation
      // Replace strings with spaces to preserve indices
      let sanitizedLine = line.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, m => ' '.repeat(m.length)).replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, m => ' '.repeat(m.length));
      const commentIndex = sanitizedLine.indexOf('#');
      if (commentIndex !== -1) sanitizedLine = sanitizedLine.substring(0, commentIndex);

      const lineJumpRegex = new RegExp(JUMP_REGEX);
      let match;
      while ((match = lineJumpRegex.exec(sanitizedLine)) !== null) {
          const target = match[2];
          if (target === 'expression') continue;

          const isLocal = localLabels.has(target);
          const globalLabelDef = analysisResultRef.current.labels[target];
          // Valid if found locally OR (found globally AND NOT associated with this block's old state)
          const isExternal = globalLabelDef && globalLabelDef.blockId !== blockRef.current.id;

          if (!isLocal && !isExternal) {
              const targetStart = match.index + match[0].indexOf(target);
              markers.push({
                  startLineNumber: lineNumber,
                  startColumn: targetStart + 1,
                  endLineNumber: lineNumber,
                  endColumn: targetStart + 1 + target.length,
                  message: `Invalid jump: Label '${target}' not found in project.`,
                  severity: monacoInstance.MarkerSeverity.Error,
              });
          }
      }
    });

    return markers;
  };

  const updateContext = () => {
      if (!editorRef.current) return;
      const position = editorRef.current.getPosition();
      if (!position) return;

      const lineNumber = position.lineNumber;
      const labels = Object.values(analysisResultRef.current.labels)
          .filter(l => l.blockId === blockRef.current.id && l.line <= lineNumber)
          .sort((a, b) => b.line - a.line);
      
      const screens = Array.from(analysisResultRef.current.screens.values())
          .filter(s => s.definedInBlockId === blockRef.current.id && s.line <= lineNumber)
          .sort((a, b) => b.line - a.line);

      let bestContext = '';
      let bestLine = -1;

      if (labels.length > 0) {
          bestContext = `label ${labels[0].label}`;
          bestLine = labels[0].line;
      }

      if (screens.length > 0 && screens[0].line > bestLine) {
          bestContext = `screen ${screens[0].name}`;
      }

      setCurrentContext(bestContext);
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    onEditorMount(block.id, editor);
    editor.focus();
    setIsMounted(true);
    updateContext(); // Initial context

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
        
        const markers = performValidation(currentContent, monaco);
        monaco.editor.setModelMarkers(editor.getModel()!, 'renpy', markers);
    });
    
    editor.onDidChangeCursorPosition(() => {
        updateContext();
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
    
    // Initial validation on mount
    const markers = performValidation(editor.getValue(), monaco);
    monaco.editor.setModelMarkers(editor.getModel()!, 'renpy', markers);
  };
  
  // Update markers when analysis changes (e.g. newly defined global labels)
  useEffect(() => {
      if (isMounted && editorRef.current && monacoRef.current) {
          const markers = performValidation(editorRef.current.getValue(), monacoRef.current);
          monacoRef.current.editor.setModelMarkers(editorRef.current.getModel()!, 'renpy', markers);
      }
  }, [analysisResult, isMounted]);
  
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
               // We handle errors via markers now, but we can keep a visual style for invalid links if desired
               // For now, markers provide the "red squiggly", so maybe just leave text normal or style differently
               // Leaving 'renpy-jump-invalid' for specific styling if needed beyond error marker
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
      <Breadcrumbs filePath={block.filePath} context={currentContext} />
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