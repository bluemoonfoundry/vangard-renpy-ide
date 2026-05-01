# Implementation Summary: Implicit Variable Detection (Issue #174)

## Overview
Successfully implemented implicit variable detection for older Ren'Py projects that use `$ variable = value` syntax instead of `define`/`default` statements.

## Changes Made

### 1. Type System Updates (`src/types.ts`)
- Added `'implicit'` as a new type option for the `Variable` interface
- Added `dismissedImplicitVariableHint?: boolean` to `ProjectSettings` interface

### 2. Analysis Pipeline (`src/hooks/useRenpyAnalysis.ts`)
- Extended variable detection to identify implicit variables using regex: `/^\s*\$\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*=(?!=)\s*(.+)/`
- Detects `$ variable = value` statements while excluding:
  - Augmented assignments (`+=`, `-=`, etc.) which are modifications, not definitions
  - Comparison operators (`==`) via negative lookahead
  - Lines within triple-quoted strings
  - Commented-out code
- Implicit variables are only added if not already defined explicitly

### 3. Diagnostics (`src/hooks/useDiagnostics.ts`)
- Added new diagnostic category: `'implicit-variable'`
- Generates `info`-level diagnostics for each implicit variable with message:
  `[IMPLICIT_VAR] Variable 'varname' uses implicit definition. Consider using 'default varname = ...' for better compatibility.`
- Only reports implicit variables in story blocks (not GUI/config files)

### 4. Variables Pane Banner (`src/components/VariableManager.tsx`)
- Added contextual banner that appears when:
  - Project has ≥10 implicit variables
  - Project has <5 explicit variables
  - User hasn't dismissed the hint
- Banner displays:
  - Count of implicit variables
  - Explanation that Variables pane only shows explicit definitions
  - "View in Diagnostics" button (opens diagnostics tab)
  - Dismiss button (saves preference to project settings)
- VariableEditor handles implicit variables gracefully (converts to `default` when editing)

### 5. UI Integration (`src/components/StoryElementsPanel.tsx`)
- Added three new props to thread banner state and callbacks:
  - `dismissedImplicitVarHint: boolean`
  - `onDismissImplicitVarHint: () => void`
  - `onOpenDiagnostics: () => void`

### 6. State Management (`src/App.tsx`)
- Added `dismissedImplicitVarHint` state variable
- Loads dismissal state from `game/project.ide.json` on project open
- Saves dismissal state to `game/project.ide.json` on save
- Added toast notification on first detection (per-project, stored in localStorage)
  - Shows once per project when ≥10 implicit variables detected
  - Message: "X implicit variables detected. Check the Variables pane or Diagnostics tab for details."
- Wired banner callbacks to open diagnostics tab and save dismissal preference

## Testing

### Test File Created
`test-implicit-vars.rpy` demonstrates:
- ✅ Implicit variable detection (`$ player_name = "Alex"`)
- ✅ Explicit variables not flagged as implicit (`default`/`define`)
- ✅ Augmented assignments skipped (`$ score += 10`)
- ✅ Comparisons skipped (`$ result = (score == 10)`)
- ✅ Comments skipped (`# $ commented_var = ...`)

### Manual Testing Checklist
- [ ] Open project with 10+ implicit variables
- [ ] Verify toast appears on first load
- [ ] Verify banner appears in Variables pane (if <5 explicit vars)
- [ ] Click "View in Diagnostics" - should open diagnostics tab with `[IMPLICIT_VAR]` entries
- [ ] Click dismiss (×) - banner should disappear
- [ ] Save project (Ctrl+S) - verify `dismissedImplicitVariableHint: true` in `game/project.ide.json`
- [ ] Close and reopen project - banner should NOT reappear
- [ ] Verify implicit variables show in Diagnostics tab with correct file/line info

## Edge Cases Handled
1. **Augmented assignments**: `$ score += 1` correctly skipped (modification, not definition)
2. **Comparison operators**: `$ result = (x == y)` correctly detected (negative lookahead for `==`)
3. **Triple-quoted strings**: Variable-like patterns in dialogue are skipped via `getTripleQuotedLineMask()`
4. **Comments**: `#` comments stripped before matching
5. **persistent.* variables**: Detected correctly; VariableManager already has Persistent section
6. **Character variables**: Already filtered out in existing code (lines 302-304)
7. **Multiple projects**: Toast notification is per-project (localStorage key includes projectPath)
8. **Banner threshold**: Only appears for projects with ≥10 implicit vars AND <5 explicit vars (avoids false alarms)

## Files Modified
1. `src/types.ts` - Type definitions
2. `src/hooks/useRenpyAnalysis.ts` - Detection logic
3. `src/hooks/useDiagnostics.ts` - Diagnostic generation
4. `src/components/VariableManager.tsx` - Banner UI
5. `src/components/StoryElementsPanel.tsx` - Props threading
6. `src/App.tsx` - State management and integration

## Future Enhancements (Out of Scope)
- "Fix This" context menu action to generate explicit definitions
- Batch selection in diagnostics for bulk fixing
- Auto-migration wizard on project open
- Support for `init python` block variable extraction
