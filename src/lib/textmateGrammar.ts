/**
 * @file textmateGrammar.ts
 * @description Bridge between vscode-textmate grammar engine and Monaco editor.
 * Loads Oniguruma WASM, creates a TextMate registry with the Ren'Py grammar,
 * and exposes an EncodedTokensProvider that Monaco can consume directly.
 */

import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import type { StateStack, IGrammar } from 'vscode-textmate';

// Lazily resolved module references (loaded asynchronously to handle WASM init)
let vsctm: typeof import('vscode-textmate') | null = null;
let grammar: IGrammar | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initializes the TextMate grammar engine with Oniguruma WASM and Ren'Py grammar.
 *
 * This async function performs three steps:
 * 1. Dynamically imports `vscode-oniguruma` and `vscode-textmate` libraries
 * 2. Fetches and loads the Oniguruma WASM binary (from `/onig.wasm` in public/)
 * 3. Creates a TextMate registry and loads the Ren'Py grammar from `renpy.tmLanguage.json`
 *
 * The function is idempotent: multiple calls return the same promise and initialization
 * only happens once. Must be called before `createTextMateTokensProvider()`.
 *
 * @returns Promise that resolves when initialization is complete
 * @throws Error if the grammar fails to load
 *
 * @example
 * ```typescript
 * await initTextMate();
 * const provider = createTextMateTokensProvider();
 * monaco.languages.setTokensProvider('renpy', provider);
 * ```
 *
 * @complexity O(1) after first call (returns cached promise)
 */
export async function initTextMate(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Dynamic imports — keeps the main bundle synchronous until we actually
    // need TextMate.
    const oniguruma = await import('vscode-oniguruma');
    vsctm = await import('vscode-textmate');

    // Fetch the Oniguruma WASM binary.
    // The file is copied to the public/ root by vite config so that it's
    // always served at a predictable URL in both dev and production.
    const wasmResponse = await fetch(new URL('/onig.wasm', import.meta.url));
    const wasmBinary = await wasmResponse.arrayBuffer();

    await oniguruma.loadWASM(wasmBinary);

    const registry = new vsctm.Registry({
      onigLib: Promise.resolve({
        createOnigScanner: (patterns: string[]) => oniguruma.createOnigScanner(patterns),
        createOnigString: (s: string) => oniguruma.createOnigString(s),
      }),
      async loadGrammar(scopeName: string) {
        if (scopeName === 'source.renpy') {
          // Import the grammar JSON — Vite resolves this at build time.
          const grammarJson = await import('./renpy.tmLanguage.json');
          return vsctm!.parseRawGrammar(JSON.stringify(grammarJson.default ?? grammarJson), 'renpy.tmLanguage.json');
        }
        return null;
      },
    });

    grammar = await registry.loadGrammar('source.renpy');
    if (!grammar) {
      throw new Error('Failed to load Ren\'Py TextMate grammar');
    }
  })();

  return initPromise;
}

// ---------------------------------------------------------------------------
// State wrapper — Monaco's IState interface requires `clone()` and `equals()`
// ---------------------------------------------------------------------------

/**
 * Monaco IState wrapper for TextMate's StateStack.
 *
 * Monaco requires tokenization state to implement `clone()` and `equals()` for
 * efficient incremental tokenization. This class wraps vscode-textmate's StateStack
 * and delegates to its native clone/equals methods.
 */
class TMState implements monaco.languages.IState {
  constructor(public readonly ruleStack: StateStack) {}

  clone(): TMState {
    return new TMState(this.ruleStack.clone());
  }

  equals(other: monaco.languages.IState): boolean {
    if (!(other instanceof TMState)) return false;
    return this.ruleStack.equals(other.ruleStack);
  }
}

// ---------------------------------------------------------------------------
// Token provider factory
// ---------------------------------------------------------------------------

/**
 * Creates a Monaco TokensProvider backed by the loaded TextMate grammar.
 *
 * Returns a Monaco-compatible tokenization provider that:
 * - Uses vscode-textmate to tokenize lines according to the Ren'Py grammar
 * - Converts TextMate scope names to Monaco token types
 * - Maintains tokenization state across lines for incremental updates
 *
 * The provider selects the most specific scope from each TextMate token (the last element
 * in the scopes array) and uses it as the Monaco token type. Monaco's theme engine
 * performs prefix matching, so `keyword.control.jump.renpy` will match theme rules
 * for `keyword.control`, `keyword`, etc.
 *
 * **IMPORTANT**: Must be called after `initTextMate()` has resolved, or this function
 * will throw an error.
 *
 * @returns Monaco TokensProvider for use with `monaco.languages.setTokensProvider()`
 * @throws Error if called before `initTextMate()` completes
 *
 * @see initTextMate for initialization
 */
export function createTextMateTokensProvider(): monaco.languages.TokensProvider {
  if (!grammar || !vsctm) {
    throw new Error('TextMate not initialised — call initTextMate() first');
  }

  const INITIAL = vsctm.INITIAL;

  return {
    getInitialState(): monaco.languages.IState {
      return new TMState(INITIAL);
    },

    tokenize(line: string, state: monaco.languages.IState): monaco.languages.ILineTokens {
      const tmState = state as TMState;
      const result = grammar!.tokenizeLine(line, tmState.ruleStack);

      // Convert TextMate tokens → Monaco tokens.
      // Each TextMate token has an array of scope names; we take the most
      // specific (last) scope and use it as the Monaco token type.  Monaco's
      // theme rules do prefix matching so `keyword.control.jump.renpy` will
      // match a rule for `keyword.control` or `keyword`.
      const tokens: monaco.languages.IToken[] = result.tokens.map((t) => {
        const scopes = t.scopes;
        // Use the most specific scope, falling back to the root scope.
        const monacoScope = scopes[scopes.length - 1] || 'source.renpy';
        return {
          startIndex: t.startIndex,
          scopes: monacoScope,
        };
      });

      return {
        tokens,
        endState: new TMState(result.ruleStack),
      };
    },
  };
}
