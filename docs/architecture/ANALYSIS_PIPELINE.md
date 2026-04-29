# Analysis Pipeline Architecture

The analysis pipeline parses all open `.rpy` files and produces `RenpyAnalysisResult` — the central data structure that drives the canvases, diagnostics, IntelliSense, and the translation panel. It runs in a Web Worker to keep the UI thread responsive.

---

## 1. Pipeline Overview

```
Block content changes (editor keystrokes, external file reload)
  │
  ▼
useDebounce(blocks, 500ms)          ← App.tsx — strips non-content state
  │  Only { id, content, filePath, title } per block
  │  Drag/resize/color changes do NOT reach this point
  ▼
useRenpyAnalysis(debouncedBlocks)   ← src/hooks/useRenpyAnalysis.ts
  │  postMessage({ id, blocks })
  ▼
renpyAnalysis.worker.ts             ← Singleton Web Worker
  │
  ├─ Phase 1: performRenpyAnalysis()     → parse labels, jumps, characters,
  │                                         variables, screens, images
  ├─ Phase 2: performRouteAnalysis()     → build label graph, identify routes
  └─ Phase 3: performTranslationAnalysis() → compute translation coverage
  │
  ▼ postMessage({ id, result })
useRenpyAnalysis receives result
  │  Discards if id is stale (a newer request is in flight)
  ▼
RenpyAnalysisResult written to state in App.tsx
  │
  ├─ Story Canvas     (links, block classifications, root/leaf/branch sets)
  ├─ Flow Canvas      (labelNodes, routeLinks, identifiedRoutes)
  ├─ Choices Canvas   (same as Flow Canvas)
  ├─ Diagnostics      (invalidJumps, missing images, character/variable errors)
  └─ IntelliSense     (labels, characters, variables, screens for completion)
```

---

## 2. Debounce and Trigger

The debounce is applied in `App.tsx` before the hook is called, not inside the hook:

```typescript
// App.tsx
const debouncedBlocks = useDebounce(blocks, 500);
const [analysisResult, isPending] = useRenpyAnalysis(debouncedBlocks, trigger);
```

`useDebounce` delays the value by 500ms after the last change. This means:
- Rapid keystrokes in the Monaco editor produce only one analysis run, after the user pauses.
- Canvas drag events never reach the analysis pipeline because the hook input (`AnalysisBlock`) carries only `{ id, content, filePath, title }` — position, size, and color are stripped at the `useDebounce` call site.

The `trigger` parameter is a number that `App.tsx` can increment to force a re-run without a content change (e.g., after a project refresh).

---

## 3. Web Worker

The worker is a **module-type singleton** — created once on first use and reused for all subsequent analysis runs:

```typescript
// Simplified from useRenpyAnalysis.ts
let _analysisWorker: Worker | null = null;

function getAnalysisWorker(): Worker {
  if (!_analysisWorker) {
    _analysisWorker = new Worker(
      new URL('../workers/renpyAnalysis.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return _analysisWorker;
}
```

Using a singleton avoids the overhead of spawning a new worker on every keystroke. The worker runs all three analysis phases synchronously within a single message handler, so it processes one request at a time.

### Stale result rejection

Each request is tagged with a monotonically increasing integer `id`. When the worker posts a result, the hook checks whether the `id` matches the most recently sent request:

```
Request #5 sent → worker starts
Request #6 sent → worker still on #5
Worker finishes #5 → posts { id: 5, result }
Hook checks: current id is 6 → discards result #5
Worker finishes #6 → posts { id: 6, result }
Hook checks: current id is 6 → accepts, updates state
```

This prevents a slow analysis of an older snapshot from overwriting a more recent result.

### Progress events

The worker posts progress notifications during each phase:

```typescript
postMessage({ id, type: 'progress', phase: 'parsing', percent: 15 });
```

The hook exposes this as the third return value: `[result, isPending, progress]` where `progress` is `{ phase: string, percent: number } | null`. This drives the progress indicator shown in the status bar during large project loads.

---

## 4. Analysis Phases

All three phases run sequentially inside the worker. Earlier phases feed later ones.

### Phase 1 — `performRenpyAnalysis(blocks)`

Parses each block's `.rpy` content and extracts:
- **Labels** — definitions, locations, jump/call targets
- **Jumps** — `jump` and `call` statements with source and destination label
- **Characters** — defined character variables and their display names
- **Variables** — `default` and `define` statements
- **Screens** — `screen` definitions
- **Images** — `image` definitions
- **Block classification** — which blocks are story / screen-only / config

This is the most computationally expensive phase.

### Phase 2 — `performRouteAnalysis(blocks, labels, jumps)`

Builds the label-level graph used by the Flow Canvas and Choices Canvas:
- **`labelNodes[]`** — one node per label definition, with position hints
- **`routeLinks[]`** — directed edges between label nodes (jump, call, implicit fall-through)
- **`identifiedRoutes[]`** — named paths through the graph (used for route coloring and trace mode)
- **`routesTruncated`** — true if the graph exceeded the route enumeration limit

### Phase 3 — `performTranslationAnalysis(blocks, dialogueLines, labels)`

Computes translation coverage statistics:
- Lines translated vs. untranslated per language
- Missing translation blocks
- Coverage percentage by language

---

## 5. `RenpyAnalysisResult` Structure

The result is a single object. Its fields are consumed by five distinct subsystems:

| Subsystem | Fields consumed |
|---|---|
| **Story Canvas** | `links`, `firstLabels`, `rootBlockIds`, `leafBlockIds`, `branchingBlockIds`, `storyBlockIds`, `screenOnlyBlockIds`, `configBlockIds`, `blockTypes` |
| **Flow Canvas / Choices Canvas** | `labelNodes`, `routeLinks`, `identifiedRoutes`, `routesTruncated` |
| **Diagnostics** | `invalidJumps`, `labels`, `jumps`, `characters`, `variables`, `variableUsages`, `definedImages` |
| **IntelliSense** | `labels`, `characters`, `variables`, `screens` |
| **Translation panel** | `translationData`, `dialogueLines`, `characterUsage` |

The full interface is defined in `src/types.ts`. Because `RenpyAnalysisResult` is derived — never persisted, always recomputed — adding a new field is safe: add it to the type, populate it in the appropriate analysis phase, and consume it in the UI. Old saved projects do not need migration.

---

## 6. Error Handling

The worker wraps all three phases in a try-catch:

```typescript
try {
  // phases 1–3
  postMessage({ id, result });
} catch (err) {
  console.error(err);
  postMessage({ id, error: formatErrorMessage(err) });
}
```

When the hook receives an error response, it **silently ignores it** — the previous valid `RenpyAnalysisResult` is kept in state and the error is not surfaced to the user. This means a parse error in one analysis run leaves the UI showing stale-but-valid data rather than crashing.

The practical effect: if a block has a syntax error severe enough to crash the parser (not just a Ren'Py validation warning — those are handled by `useDiagnostics` separately), the canvas and IntelliSense freeze at their last good state until the content is corrected and the next successful analysis runs.

---

## 7. What Does and Does Not Trigger Re-analysis

| Action | Triggers re-analysis? | Why |
|---|---|---|
| Typing in Monaco editor | Yes (after 500ms pause) | Block `content` changes |
| External file change (auto-reload) | Yes | Block `content` changes |
| Dragging a block on the canvas | **No** | Position is not in `AnalysisBlock` |
| Resizing a block | **No** | Size is not in `AnalysisBlock` |
| Changing a block's color | **No** | Color is not in `AnalysisBlock` |
| Opening / closing a tab | **No** | Tab state is not in `blocks[]` |
| `trigger` increment (project refresh) | Yes | Explicit force re-run |

This separation is the reason drag performance is smooth even on large projects — moving 50 blocks around the canvas does not trigger 50 analysis runs.
