// Minimal Monaco stub for tests. jsdom cannot run the real Monaco editor.
const mockEditor = {
  getValue: () => '',
  setValue: () => {},
  onDidChangeModelContent: () => ({ dispose: () => {} }),
  getModel: () => null,
  dispose: () => {},
  layout: () => {},
  revealLineInCenter: () => {},
  setPosition: () => {},
  deltaDecorations: () => [],
  addCommand: () => {},
  addAction: () => {},
  createContextKey: () => ({ set: () => {}, get: () => false }),
  onDidChangeCursorPosition: () => ({ dispose: () => {} }),
  onMouseDown: () => ({ dispose: () => {} }),
  getPosition: () => null,
  executeEdits: () => {},
  focus: () => {},
};

const editor = {
  create: () => mockEditor,
  setTheme: () => {},
  defineTheme: () => {},
  createModel: () => ({}),
  getModels: () => [],
  setModelLanguage: () => {},
  setModelMarkers: () => {},
  ScrollType: { Smooth: 0 },
  MouseTargetType: { CONTENT_TEXT: 6 },
};

const MarkerSeverity = { Error: 8, Warning: 4, Info: 2, Hint: 1 };

const languages = {
  register: () => {},
  getLanguages: () => [],
  setLanguageConfiguration: () => {},
  setMonarchTokensProvider: () => {},
  setTokensProvider: () => {},
  registerCompletionItemProvider: () => ({ dispose: () => {} }),
  registerDefinitionProvider: () => ({ dispose: () => {} }),
  registerDocumentSemanticTokensProvider: () => ({ dispose: () => {} }),
  CompletionItemKind: { Text: 0, Snippet: 27, Function: 2 },
  CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
  SemanticTokensLegend: class {},
};

const KeyMod = { CtrlCmd: 2048, Shift: 1024, Alt: 512 };
const KeyCode = { KeyS: 49, KeyF: 33, KeyH: 39, KeyB: 32, KeyI: 41, KeyU: 52, Enter: 3, Escape: 9, Tab: 2 };

/** Minimal event emitter used by EditorView's semanticTokensChangeEmitter. */
class Emitter<T = void> {
  private _listeners: Array<(e: T) => void> = [];
  event = (listener: (e: T) => void) => {
    this._listeners.push(listener);
    return { dispose: () => {} };
  };
  fire(e?: T) {
    this._listeners.forEach(l => l(e as T));
  }
  dispose() {}
}

/** Minimal Range stub used in EditorView edit operations. */
class Range {
  constructor(
    public startLineNumber: number,
    public startColumn: number,
    public endLineNumber: number,
    public endColumn: number
  ) {}
}

export {
  editor,
  languages,
  KeyMod,
  KeyCode,
  MarkerSeverity,
  Emitter,
  Range,
};
