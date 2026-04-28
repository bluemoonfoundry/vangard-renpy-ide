# Code Reading Guide

## Who this guide is for

This guide helps new contributors understand the Ren'IDE codebase before making their first contribution.

## Recommended reading order

1. `CLAUDE.md` — Start here for project conventions, architecture notes, commands, and contributor expectations.
2. `src/types.ts` — Read this next because it defines the shared domain model used across the app.
3. `src/App.tsx` — Use this as the high-level map of renderer state, tabs, hooks, and UI coordination.
4. `src/hooks/useRenpyAnalysis.ts` — Read this to understand how Ren'Py files become labels, jumps, links, routes, and analysis results.
5. `src/hooks/useHistory.ts` — Read this to understand undo/redo behavior for blocks.
6. `src/hooks/useDiagnostics.ts` — Read this to understand how analysis and validation become diagnostics.
7. `src/components/StoryCanvas.tsx`, `RouteCanvas.tsx`, and `ChoiceCanvas.tsx` — Read these after the shared types and analysis flow.
8. `preload.js` and `electron.js` — Read these to understand the Electron IPC boundary and native filesystem/project behavior.

## Core mental model

Ren'IDE loads Ren'Py project files, represents them as `Block` objects, analyzes their content into `RenpyAnalysisResult`, then renders that derived structure through canvases, editors, diagnostics, and tabs.

The main flow is:

```text
Ren'Py files
→ Electron project loading
→ Block objects
→ Ren'Py analysis
→ Canvas links / routes / diagnostics / editor navigation
→ User actions
→ State updates and optional filesystem writes
