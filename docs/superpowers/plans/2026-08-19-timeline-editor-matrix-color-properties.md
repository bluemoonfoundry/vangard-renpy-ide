# Timeline Editor Matrix-Color Properties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Timeline Editor's animatable-property set with `saturation`/`brightness`/`contrast`/`invert`, composing them into ATL's `matrixcolor` expression at codegen time, with a UI guard against combining them with a sprite's static tint/colorize.

**Architecture:** Four small, sequential tasks: (1) extend the data model and the two UI components' property lists/ranges/labels, (2) teach the ATL code generator to compose the four new properties into one `matrixcolor` token instead of giving each its own ATL property name, (3) add the `hasStaticTint` disabling rule to `TimelineRow`'s property picker, (4) thread `hasStaticTint` down from `SceneComposer.tsx` through `SpriteAnimationPanel.tsx` and extend the live-preview merge to cover the four new fields.

**Tech Stack:** TypeScript, React, Vitest, @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-19-timeline-editor-matrix-color-properties-design.md`

## Global Constraints

- Canonical property order (picker rendering, keyframe editor slider order, and codegen's composed-`matrixcolor` multiplication order): `x, y, zoom, alpha, rotation, blur, saturation, brightness, contrast, invert`.
- Value ranges, matching `SceneSpriteProperties.tsx`'s existing static sliders exactly: `saturation` min 0 max 2 step 0.05; `brightness` min -1 max 1 step 0.05; `contrast` min 0.1 max 3 step 0.05; `invert` min 0 max 1 step 0.1.
- `saturation`/`brightness`/`contrast`/`invert` do not get their own ATL property token — they compose into one `matrixcolor SaturationMatrix(v) * BrightnessMatrix(v) * ContrastMatrix(v) * InvertMatrix(v)` term (only the properties actually present, in canonical order), appended **last** on every generated line.
- Animating these four properties on a sprite with a static tint/colorize applied (`(colorMode === 'tint' && !!tintColor) || colorMode === 'colorize'`) is explicitly unsupported — the picker disables them for that sprite, it is not solved in codegen. No sprite-context plumbing into `atlCodeGenerator.ts`.
- Run after every task: `npx tsc --noEmit`, the task's own test file(s), `npx eslint <changed files>`.
- Run once, after Task 4: full `npm test -- --run` and `npm run build`.

---

### Task 1: Data model and property lists (`src/types.ts`, `src/components/PoseKeyframeEditor.tsx`, `src/components/TimelineRow.tsx`)

**Files:**
- Modify: `src/types.ts` (the `AnimatableProperty` type)
- Modify: `src/components/PoseKeyframeEditor.tsx:19,22-29,31-38` (`PROPERTY_ORDER`, `VALUE_RANGE_BY_PROPERTY`, `PROPERTY_LABEL`)
- Modify: `src/components/TimelineRow.tsx:30,32-39` (`PROPERTY_ORDER`, `PROPERTY_LABEL`)
- Modify: `src/components/TimelineRow.test.tsx:8` and `src/components/SpriteAnimationPanel.test.tsx:7` (`currentValues` const — both currently list only 6 keys, which will fail `Record<AnimatableProperty, number>` once `AnimatableProperty` has 10)

**Interfaces:**
- Produces: `AnimatableProperty` gains 4 new string-literal members, consumed by every later task and by all files that already import it (`atlCodeGenerator.ts`, `timelinePreview.ts`, `SpriteAnimationPanel.tsx`, `SceneComposer.tsx` — none of those need edits in this task since they use `AnimatableProperty` generically, not enumerating it).

This task has no dedicated new test — it's a data-shape extension with no new behavior of its own (Task 2 and Task 3 add the behavior that uses these new entries). Verification is `tsc --noEmit` (must be clean — the two test-file `currentValues` fixes below are exactly what keeps it clean) plus confirming the existing test suites for these files still pass.

- [ ] **Step 1: Extend `AnimatableProperty`**

In `src/types.ts`, find:
```typescript
export type AnimatableProperty = 'x' | 'y' | 'zoom' | 'alpha' | 'rotation' | 'blur';
```
Replace with:
```typescript
export type AnimatableProperty = 'x' | 'y' | 'zoom' | 'alpha' | 'rotation' | 'blur' | 'saturation' | 'brightness' | 'contrast' | 'invert';
```

- [ ] **Step 2: Run `tsc` and confirm the expected (and only the expected) breakage**

Run: `npx tsc --noEmit`
Expected: errors only in `src/components/TimelineRow.test.tsx` and `src/components/SpriteAnimationPanel.test.tsx` (their `currentValues` object literals no longer satisfy `Record<AnimatableProperty, number>` — missing the 4 new keys). No errors anywhere else. If anything else errors, stop and investigate before continuing.

- [ ] **Step 3: Extend `PoseKeyframeEditor.tsx`'s property lists**

In `src/components/PoseKeyframeEditor.tsx`, change line 19 from:
```typescript
const PROPERTY_ORDER: AnimatableProperty[] = ['x', 'y', 'zoom', 'alpha', 'rotation', 'blur'];
```
to:
```typescript
const PROPERTY_ORDER: AnimatableProperty[] = ['x', 'y', 'zoom', 'alpha', 'rotation', 'blur', 'saturation', 'brightness', 'contrast', 'invert'];
```

Change lines 22-29 from:
```typescript
export const VALUE_RANGE_BY_PROPERTY: Record<AnimatableProperty, ValueRange> = {
  x: { min: -1, max: 2, step: 0.01 },
  y: { min: -1, max: 2, step: 0.01 },
  zoom: { min: 0, max: 3, step: 0.05 },
  alpha: { min: 0, max: 1, step: 0.01 },
  rotation: { min: -360, max: 360, step: 1 },
  blur: { min: 0, max: 50, step: 1 },
};
```
to:
```typescript
export const VALUE_RANGE_BY_PROPERTY: Record<AnimatableProperty, ValueRange> = {
  x: { min: -1, max: 2, step: 0.01 },
  y: { min: -1, max: 2, step: 0.01 },
  zoom: { min: 0, max: 3, step: 0.05 },
  alpha: { min: 0, max: 1, step: 0.01 },
  rotation: { min: -360, max: 360, step: 1 },
  blur: { min: 0, max: 50, step: 1 },
  saturation: { min: 0, max: 2, step: 0.05 },
  brightness: { min: -1, max: 1, step: 0.05 },
  contrast: { min: 0.1, max: 3, step: 0.05 },
  invert: { min: 0, max: 1, step: 0.1 },
};
```

Change lines 31-38 from:
```typescript
const PROPERTY_LABEL: Record<AnimatableProperty, string> = {
  x: 'X Position',
  y: 'Y Position',
  zoom: 'Zoom',
  alpha: 'Alpha',
  rotation: 'Rotation',
  blur: 'Blur',
};
```
to:
```typescript
const PROPERTY_LABEL: Record<AnimatableProperty, string> = {
  x: 'X Position',
  y: 'Y Position',
  zoom: 'Zoom',
  alpha: 'Alpha',
  rotation: 'Rotation',
  blur: 'Blur',
  saturation: 'Saturation',
  brightness: 'Brightness',
  contrast: 'Contrast',
  invert: 'Invert',
};
```

- [ ] **Step 4: Extend `TimelineRow.tsx`'s property lists**

In `src/components/TimelineRow.tsx`, change line 30 from:
```typescript
const PROPERTY_ORDER: AnimatableProperty[] = ['x', 'y', 'zoom', 'alpha', 'rotation', 'blur'];
```
to:
```typescript
const PROPERTY_ORDER: AnimatableProperty[] = ['x', 'y', 'zoom', 'alpha', 'rotation', 'blur', 'saturation', 'brightness', 'contrast', 'invert'];
```

Change lines 32-39 from:
```typescript
const PROPERTY_LABEL: Record<AnimatableProperty, string> = {
  x: 'X Position',
  y: 'Y Position',
  zoom: 'Zoom',
  alpha: 'Alpha',
  rotation: 'Rotation',
  blur: 'Blur',
};
```
to:
```typescript
const PROPERTY_LABEL: Record<AnimatableProperty, string> = {
  x: 'X Position',
  y: 'Y Position',
  zoom: 'Zoom',
  alpha: 'Alpha',
  rotation: 'Rotation',
  blur: 'Blur',
  saturation: 'Saturation',
  brightness: 'Brightness',
  contrast: 'Contrast',
  invert: 'Invert',
};
```

- [ ] **Step 5: Fix the two test files' `currentValues` constants**

In `src/components/TimelineRow.test.tsx`, change line 8 from:
```typescript
const currentValues = { x: 0.5, y: 0.5, zoom: 1, alpha: 1, rotation: 0, blur: 0 };
```
to:
```typescript
const currentValues = { x: 0.5, y: 0.5, zoom: 1, alpha: 1, rotation: 0, blur: 0, saturation: 1, brightness: 0, contrast: 1, invert: 0 };
```

In `src/components/SpriteAnimationPanel.test.tsx`, change line 7 the same way:
```typescript
const currentValues = { x: 0.5, y: 0.5, zoom: 1, alpha: 1, rotation: 0, blur: 0, saturation: 1, brightness: 0, contrast: 1, invert: 0 };
```

- [ ] **Step 6: Run `tsc` again and confirm it's fully clean**

Run: `npx tsc --noEmit`
Expected: zero errors anywhere in the project.

- [ ] **Step 7: Run the existing test suites for the two touched components and confirm nothing broke**

Run: `npx vitest run src/components/PoseKeyframeEditor.test.tsx src/components/TimelineRow.test.tsx src/components/SpriteAnimationPanel.test.tsx`
Expected: all pass (note: there is no `PoseKeyframeEditor.test.tsx` file — skip it if `vitest run` reports "no test files found" for that path specifically, but `TimelineRow.test.tsx` and `SpriteAnimationPanel.test.tsx` must still fully pass).

- [ ] **Step 8: Lint**

Run: `npx eslint src/components/PoseKeyframeEditor.tsx src/components/TimelineRow.tsx src/components/TimelineRow.test.tsx src/components/SpriteAnimationPanel.test.tsx`
Expected: zero errors/warnings.

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/components/PoseKeyframeEditor.tsx src/components/TimelineRow.tsx src/components/TimelineRow.test.tsx src/components/SpriteAnimationPanel.test.tsx
git commit -m "feat: add saturation/brightness/contrast/invert to AnimatableProperty"
```

---

### Task 2: ATL matrix-color composition (`src/lib/atlCodeGenerator.ts`)

**Files:**
- Modify: `src/lib/atlCodeGenerator.ts` (full rewrite of the property-name mapping and `generateTimelineCode`)
- Test: `src/lib/atlCodeGenerator.test.ts` (append new tests)

**Interfaces:**
- Consumes: `AnimatableProperty` (Task 1, now 10 members).
- Produces: `generateATLFromTimeline`'s output now includes composed `matrixcolor` tokens for timelines covering `saturation`/`brightness`/`contrast`/`invert` — consumed by `SceneComposer.tsx` (unchanged call site, no signature change).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/atlCodeGenerator.test.ts`, inside the `describe('generateATLFromTimeline', ...)` block (after the existing tests, before the closing `});`):

```typescript
  it('composes matrix-factor properties into one matrixcolor token, placed last, alongside a simple property', () => {
    const t = timeline({
      properties: ['alpha', 'saturation'],
      keyframes: [
        { id: 'k1', time: 0, values: { alpha: 0, saturation: 1 }, easing: 'linear' },
        { id: 'k2', time: 1, values: { alpha: 1, saturation: 1.5 }, easing: 'linear' },
      ],
    });
    expect(generateATLFromTimeline(anim({ timelines: [t] }))).toBe(
      'transform eileen_animation:\n    alpha 0\n    matrixcolor SaturationMatrix(1)\n    linear 1 alpha 1 matrixcolor SaturationMatrix(1.5)\n'
    );
  });

  it('composes only the selected matrix-factor properties, in canonical order, with no other tokens when a timeline covers only matrix factors', () => {
    const t = timeline({
      properties: ['invert', 'saturation', 'contrast'],
      keyframes: [
        { id: 'k1', time: 0, values: { saturation: 1, contrast: 1, invert: 0 }, easing: 'linear' },
        { id: 'k2', time: 1, values: { saturation: 2, contrast: 0.5, invert: 1 }, easing: 'easein' },
      ],
    });
    expect(generateATLFromTimeline(anim({ timelines: [t] }))).toBe(
      'transform eileen_animation:\n    matrixcolor SaturationMatrix(1) * ContrastMatrix(1) * InvertMatrix(0)\n    easein 1 matrixcolor SaturationMatrix(2) * ContrastMatrix(0.5) * InvertMatrix(1)\n'
    );
  });

  it('produces no matrixcolor token when zero matrix-factor properties are selected', () => {
    const t = timeline({
      properties: ['x', 'alpha'],
      keyframes: [
        { id: 'k1', time: 0, values: { x: 0, alpha: 0 }, easing: 'linear' },
        { id: 'k2', time: 1, values: { x: 1, alpha: 1 }, easing: 'linear' },
      ],
    });
    expect(generateATLFromTimeline(anim({ timelines: [t] }))).not.toContain('matrixcolor');
  });

  it('composes brightness and invert into matrixcolor in canonical order (brightness before invert)', () => {
    const t = timeline({
      properties: ['invert', 'brightness'],
      keyframes: [
        { id: 'k1', time: 0, values: { brightness: 0, invert: 0 }, easing: 'linear' },
        { id: 'k2', time: 1, values: { brightness: 0.5, invert: 1 }, easing: 'linear' },
      ],
    });
    expect(generateATLFromTimeline(anim({ timelines: [t] }))).toBe(
      'transform eileen_animation:\n    matrixcolor BrightnessMatrix(0) * InvertMatrix(0)\n    linear 1 matrixcolor BrightnessMatrix(0.5) * InvertMatrix(1)\n'
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/atlCodeGenerator.test.ts`
Expected: the 4 new tests FAIL (the current implementation emits each property as its own token, e.g. `saturation 1`, not a composed `matrixcolor` term — `ATL_PROPERTY_NAME` has no entries for the 4 new properties, so `ATL_PROPERTY_NAME[p]` is `undefined` and the current code would emit `undefined 1`). The pre-existing tests should still pass.

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `src/lib/atlCodeGenerator.ts` with:

```typescript
/**
 * @file atlCodeGenerator.ts
 * @description Generates one-way ATL `transform` blocks from a sprite's
 * `SpriteAnimation` (keyframes -> code only; there is no parser and no
 * round-trip -- see the TODO(#38) note in SceneComposer.tsx). Used by
 * `SceneComposer.tsx` to append transform blocks to its generated scene code
 * and to name the `at <transform>` clause on the animated sprite's `show` line.
 */
import type { AnimatableProperty, SpriteAnimation, SpriteTimeline } from '@/types';

/** ATL property names for the six "simple" properties -- each gets its own token in generated code. */
const ATL_PROPERTY_NAME: Partial<Record<AnimatableProperty, string>> = {
  x: 'xcenter',
  y: 'ycenter',
  zoom: 'zoom',
  alpha: 'alpha',
  rotation: 'rotate',
  blur: 'blur',
};

/**
 * The four "matrix factor" properties have no ATL property name of their
 * own -- they compose into a single `matrixcolor <expr>` token (matching
 * SceneComposer.tsx's spriteEffectCode(), which does the same composition
 * for the non-animated/static case).
 */
const MATRIX_FACTOR_CONSTRUCTOR: Partial<Record<AnimatableProperty, (value: number) => string>> = {
  saturation: (v) => `SaturationMatrix(${formatValue(v)})`,
  brightness: (v) => `BrightnessMatrix(${formatValue(v)})`,
  contrast: (v) => `ContrastMatrix(${formatValue(v)})`,
  invert: (v) => `InvertMatrix(${formatValue(v)})`,
};

/** Canonical property order for all generated ATL lines, regardless of picker selection order. */
const PROPERTY_ORDER: AnimatableProperty[] = ['x', 'y', 'zoom', 'alpha', 'rotation', 'blur', 'saturation', 'brightness', 'contrast', 'invert'];

/** A valid Ren'Py transform name for the sprite's (single) animation, e.g. `eileen_animation`. */
export function transformNameFor(spriteId: string): string {
  const slug = spriteId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'sprite';
  return `${slug}_animation`;
}

function formatValue(value: number): string {
  return Number(value.toFixed(3)).toString();
}

/**
 * The ATL tokens for one keyframe's pose, in canonical property order: each
 * simple property gets its own `<atlName> <value>` token; any matrix-factor
 * properties present are composed into one `matrixcolor <expr>` token,
 * appended last.
 */
function buildPropertyTokens(orderedProperties: AnimatableProperty[], values: Partial<Record<AnimatableProperty, number>>): string[] {
  const tokens: string[] = [];
  const matrixFactorTerms: string[] = [];
  for (const property of orderedProperties) {
    const value = values[property] ?? 0;
    const atlName = ATL_PROPERTY_NAME[property];
    if (atlName) {
      tokens.push(`${atlName} ${formatValue(value)}`);
      continue;
    }
    const constructor = MATRIX_FACTOR_CONSTRUCTOR[property];
    if (constructor) matrixFactorTerms.push(constructor(value));
  }
  if (matrixFactorTerms.length > 0) tokens.push(`matrixcolor ${matrixFactorTerms.join(' * ')}`);
  return tokens;
}

/**
 * ATL body lines for one timeline (its keyframes, in time order), indented
 * by `indent`. The first keyframe emits one token per line; each subsequent
 * keyframe emits one combined warp line covering every property in
 * `timeline.properties`, in canonical order. Appends a trailing `repeat`
 * line if the timeline loops.
 */
function generateTimelineCode(timeline: SpriteTimeline, indent: string, honorLoop = true): string {
  const kfs = [...timeline.keyframes].sort((a, b) => a.time - b.time);
  if (kfs.length === 0) return '';

  const orderedProps = PROPERTY_ORDER.filter(p => timeline.properties.includes(p));
  if (orderedProps.length === 0) return '';

  const firstTokens = buildPropertyTokens(orderedProps, kfs[0].values);
  let code = firstTokens.map(t => `${indent}${t}`).join('\n') + '\n';
  for (let i = 1; i < kfs.length; i++) {
    const duration = kfs[i].time - kfs[i - 1].time;
    const tokens = buildPropertyTokens(orderedProps, kfs[i].values);
    code += `${indent}${kfs[i].easing} ${formatValue(duration)} ${tokens.join(' ')}\n`;
  }

  if (timeline.loop && honorLoop) code += `${indent}repeat\n`;

  return code;
}

/**
 * A full `transform NAME:` block for `anim`. Timelines with zero keyframes
 * contribute nothing. In `'parallel'` mode, 2+ timelines with keyframes each
 * become their own nested `parallel:` branch (a single one is emitted
 * directly, no wrapper); in `'sequential'` mode, timelines' blocks are
 * concatenated directly one after another, since that's ATL's own default
 * statement-sequence behavior.
 */
export function generateATLFromTimeline(anim: SpriteAnimation): string {
  const name = transformNameFor(anim.spriteId);
  const active = anim.timelines.filter(t => t.keyframes.length > 0 && t.properties.length > 0);

  if (active.length === 0) {
    return `transform ${name}:\n    pass\n`;
  }

  let body: string;
  if (anim.combineMode === 'parallel') {
    if (active.length > 1) {
      body = active.map(t => `    parallel:\n${generateTimelineCode(t, '        ')}`).join('');
    } else {
      body = generateTimelineCode(active[0], '    ');
    }
  } else {
    body = active.map((t, i) => generateTimelineCode(t, '    ', i === active.length - 1)).join('');
  }

  return `transform ${name}:\n${body}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/atlCodeGenerator.test.ts`
Expected: PASS, all tests (the pre-existing ones plus the 4 new ones — 14 total).

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: zero errors.
Run: `npx eslint src/lib/atlCodeGenerator.ts src/lib/atlCodeGenerator.test.ts`
Expected: zero errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/atlCodeGenerator.ts src/lib/atlCodeGenerator.test.ts
git commit -m "feat: compose saturation/brightness/contrast/invert into ATL matrixcolor"
```

---

### Task 3: Disable matrix-factor properties when a sprite has a static tint (`src/components/TimelineRow.tsx`)

**Files:**
- Modify: `src/components/TimelineRow.tsx`
- Modify: `src/components/TimelineRow.test.tsx`

**Interfaces:**
- Produces: `TimelineRow` gains a new required prop `hasStaticTint: boolean` — consumed by `SpriteAnimationPanel.tsx` (Task 4).

- [ ] **Step 1: Write the failing tests**

In `src/components/TimelineRow.test.tsx`, add `hasStaticTint: false,` to the `renderRow` helper's default `props` object (in the object literal at the top of the file, alongside `canLoop: true,`), so every existing call to `renderRow(...)` keeps compiling and defaults to the "no tint" case.

Then update the THREE raw `render(<TimelineRow .../>)` / `rerender(<TimelineRow .../>)` JSX call sites in this file that construct their own props inline instead of using the `renderRow` helper (search for `<TimelineRow` in the file — there are calls around the "adds a keyframe at the clicked time" test and the "disables the Loop checkbox" test) — add `hasStaticTint={false}` to each of those three JSX elements, matching how `canLoop={true}` is already present on them.

Append these new tests to the file (after the existing tests, before the closing `});` of the `describe('TimelineRow', ...)` block):

```typescript
  it('disables the four matrix-factor checkboxes (with a tooltip) when hasStaticTint is true', () => {
    renderRow({ hasStaticTint: true });
    for (const label of ['Saturation', 'Brightness', 'Contrast', 'Invert']) {
      const checkbox = screen.getByLabelText(label);
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveAttribute('title', "Disabled: this sprite has a static tint/colorize applied — animating color together with a static tint isn't supported.");
    }
  });

  it('leaves the four matrix-factor checkboxes enabled when hasStaticTint is false', () => {
    renderRow({ hasStaticTint: false });
    for (const label of ['Saturation', 'Brightness', 'Contrast', 'Invert']) {
      expect(screen.getByLabelText(label)).not.toBeDisabled();
    }
  });

  it('does not disable a matrix-factor property already selected by this timeline, even when hasStaticTint is true', () => {
    const withSaturation: SpriteTimeline = { ...emptyTimeline(), properties: ['saturation'] };
    renderRow({ timeline: withSaturation, hasStaticTint: true });
    expect(screen.getByLabelText('Saturation')).not.toBeDisabled();
  });

  it('hasStaticTint disabling is independent of the parallel-mode sibling-conflict disabling', () => {
    renderRow({ combineMode: 'sequential', hasStaticTint: true, propertiesClaimedBySiblings: ['saturation'] });
    // Sequential mode alone would not disable Saturation (sibling rule only applies in parallel), but hasStaticTint still does.
    expect(screen.getByLabelText('Saturation')).toBeDisabled();
  });

  it('leaves simple properties (e.g. Alpha) unaffected by hasStaticTint', () => {
    renderRow({ hasStaticTint: true });
    expect(screen.getByLabelText('Alpha')).not.toBeDisabled();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/TimelineRow.test.tsx`
Expected: FAIL — either a TypeScript error (missing required `hasStaticTint` prop, once Step 3 below hasn't happened yet the component doesn't accept it at all so this is really just "new tests fail because the checkboxes are never disabled") or the 5 new tests fail because nothing currently disables the matrix-factor checkboxes based on any `hasStaticTint` prop (the prop doesn't exist on the component yet).

- [ ] **Step 3: Add the prop and disabling logic**

In `src/components/TimelineRow.tsx`, add a new constant after `PROPERTY_LABEL` (around line 40, after the `PROPERTY_LABEL` object's closing `};`):

```typescript
const MATRIX_FACTOR_PROPERTIES: AnimatableProperty[] = ['saturation', 'brightness', 'contrast', 'invert'];
```

Add `hasStaticTint: boolean;` to `TimelineRowProps` (with a doc comment), after the `canLoop` field:
```typescript
  /** True disables the four matrix-factor checkboxes (saturation/brightness/contrast/invert): this sprite has a static tint/colorize applied, and animating color together with a static tint isn't supported. */
  hasStaticTint: boolean;
```

Add `hasStaticTint` to the destructured props in the component signature:
```typescript
const TimelineRow: React.FC<TimelineRowProps> = ({
  timeline, propertiesClaimedBySiblings, combineMode, canLoop, hasStaticTint, currentValues, onChangeTimeline, onRemoveTimeline, onMoveUp, onMoveDown,
}) => {
```

Replace the property-picker rendering block (the `{PROPERTY_ORDER.map(property => { ... })}` block, currently around lines 135-144) with:

```typescript
        {PROPERTY_ORDER.map(property => {
          const isSelected = timeline.properties.includes(property);
          const isDisabledBySibling = combineMode === 'parallel' && !isSelected && propertiesClaimedBySiblings.includes(property);
          const isDisabledByTint = hasStaticTint && !isSelected && MATRIX_FACTOR_PROPERTIES.includes(property);
          const isDisabled = isDisabledBySibling || isDisabledByTint;
          return (
            <label key={property} className={`flex items-center gap-1 text-xs ${isDisabled ? 'text-secondary opacity-50' : 'text-primary'}`}>
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                title={isDisabledByTint ? "Disabled: this sprite has a static tint/colorize applied — animating color together with a static tint isn't supported." : undefined}
                onChange={() => toggleProperty(property)}
                aria-label={PROPERTY_LABEL[property]}
              />
              {PROPERTY_LABEL[property]}
            </label>
          );
        })}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/TimelineRow.test.tsx`
Expected: PASS, all tests (pre-existing plus the 5 new ones — 19 total).

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: errors only in `src/components/SpriteAnimationPanel.tsx` and `src/components/SpriteAnimationPanel.test.tsx` (they render `<TimelineRow>` without the new required `hasStaticTint` prop — fixed in Task 4) and `src/components/SceneComposer.tsx` (renders `<SpriteAnimationPanel>` — also fixed in Task 4). No errors anywhere else.
Run: `npx eslint src/components/TimelineRow.tsx src/components/TimelineRow.test.tsx`
Expected: zero errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components/TimelineRow.tsx src/components/TimelineRow.test.tsx
git commit -m "feat: disable matrix-factor properties when sprite has a static tint"
```

---

### Task 4: Thread `hasStaticTint` through `SpriteAnimationPanel` and `SceneComposer`, extend live preview

**Files:**
- Modify: `src/components/SpriteAnimationPanel.tsx`
- Modify: `src/components/SpriteAnimationPanel.test.tsx`
- Modify: `src/components/SceneComposer.tsx:1072-1083` (the `<SpriteAnimationPanel>` render) and `:878-889` (`withTimelinePreview`)

**Interfaces:**
- Consumes: `TimelineRow`'s new `hasStaticTint` prop (Task 3).
- Produces: `SpriteAnimationPanel` gains a new required prop `hasStaticTint: boolean`, consumed by `SceneComposer.tsx`.

No dedicated new test for the `SceneComposer.tsx` half (it has no test file today, same as every other task that's touched it in this project's history) — verified via full-suite + build. `SpriteAnimationPanel.test.tsx` gets one new test confirming the prop passes through to its `TimelineRow` children.

- [ ] **Step 1: Write the failing test**

In `src/components/SpriteAnimationPanel.test.tsx`, add `hasStaticTint: false,` to the `renderPanel` helper's default `props` object, and add `hasStaticTint={false}` to the TWO raw `render(<SpriteAnimationPanel .../>)` / `rerender(<SpriteAnimationPanel .../>)` JSX call sites in the "hides the combine-mode toggle" test (search for `<SpriteAnimationPanel` in the file — there are two inline-props JSX elements there, not using the `renderPanel` helper).

Append this test (after the existing tests, before the closing `});` of the `describe('SpriteAnimationPanel', ...)` block):

```typescript
  it('passes hasStaticTint through to every TimelineRow it renders', () => {
    const twoTimelines = anim({ timelines: [timeline({ id: 't1', name: 'bob0' }), timeline({ id: 't2', name: 'bob1' })] });
    renderPanel({ animation: twoTimelines, hasStaticTint: true });
    for (const label of ['Saturation', 'Brightness', 'Contrast', 'Invert']) {
      // Two rows -> two checkboxes per label; both must be disabled.
      const checkboxes = screen.getAllByLabelText(label);
      expect(checkboxes).toHaveLength(2);
      for (const checkbox of checkboxes) expect(checkbox).toBeDisabled();
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/SpriteAnimationPanel.test.tsx`
Expected: FAIL — `SpriteAnimationPanel` doesn't accept or forward a `hasStaticTint` prop yet, so the checkboxes are never disabled.

- [ ] **Step 3: Thread the prop through `SpriteAnimationPanel.tsx`**

Add `hasStaticTint: boolean;` to `SpriteAnimationPanelProps` (with a doc comment), after `currentValues`:
```typescript
  /** True disables the four matrix-factor checkboxes on every TimelineRow: the sprite has a static tint/colorize applied. */
  hasStaticTint: boolean;
```

Add `hasStaticTint` to the destructured props in the component signature:
```typescript
const SpriteAnimationPanel: React.FC<SpriteAnimationPanelProps> = ({
  spriteLabel, animation, currentValues, hasStaticTint, onCreateAnimation, onChangeAnimation, onDeleteAnimation, onPreviewUpdate,
}) => {
```

In the `<TimelineRow>` render (inside the `.map` over `animation.timelines`), add `hasStaticTint={hasStaticTint}` as a prop, alongside the existing `canLoop`/`propertiesClaimedBySiblings`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/SpriteAnimationPanel.test.tsx`
Expected: PASS, all tests (pre-existing plus the 1 new one — 11 total).

- [ ] **Step 5: Update `SceneComposer.tsx`**

Change lines 1072-1083 from:
```typescript
                        <SpriteAnimationPanel
                            spriteLabel={selectedSpriteId === 'background' ? 'Background' : getRenpyTag(activeSprite.image)}
                            animation={activeAnimation}
                            currentValues={{
                                x: activeSprite.x, y: activeSprite.y, zoom: activeSprite.zoom,
                                alpha: activeSprite.alpha, rotation: activeSprite.rotation, blur: activeSprite.blur,
                            }}
                            onCreateAnimation={handleCreateAnimation}
                            onChangeAnimation={handleChangeAnimation}
                            onDeleteAnimation={handleDeleteAnimation}
                            onPreviewUpdate={setTimelinePreviewValues}
                        />
```
to:
```typescript
                        <SpriteAnimationPanel
                            spriteLabel={selectedSpriteId === 'background' ? 'Background' : getRenpyTag(activeSprite.image)}
                            animation={activeAnimation}
                            currentValues={{
                                x: activeSprite.x, y: activeSprite.y, zoom: activeSprite.zoom,
                                alpha: activeSprite.alpha, rotation: activeSprite.rotation, blur: activeSprite.blur,
                                saturation: activeSprite.saturation ?? 1.0, brightness: activeSprite.brightness ?? 0,
                                contrast: activeSprite.contrast ?? 1.0, invert: activeSprite.invert ?? 0,
                            }}
                            hasStaticTint={(activeSprite.colorMode === 'tint' && !!activeSprite.tintColor) || activeSprite.colorMode === 'colorize'}
                            onCreateAnimation={handleCreateAnimation}
                            onChangeAnimation={handleChangeAnimation}
                            onDeleteAnimation={handleDeleteAnimation}
                            onPreviewUpdate={setTimelinePreviewValues}
                        />
```

Change lines 878-889 (`withTimelinePreview`) from:
```typescript
    const withTimelinePreview = useCallback((sprite: SceneSprite, id: string): SceneSprite => {
        if (!showTimeline || selectedSpriteId !== id || !timelinePreviewValues) return sprite;
        return {
            ...sprite,
            x: timelinePreviewValues.x ?? sprite.x,
            y: timelinePreviewValues.y ?? sprite.y,
            zoom: timelinePreviewValues.zoom ?? sprite.zoom,
            alpha: timelinePreviewValues.alpha ?? sprite.alpha,
            rotation: timelinePreviewValues.rotation ?? sprite.rotation,
            blur: timelinePreviewValues.blur ?? sprite.blur,
        };
    }, [showTimeline, selectedSpriteId, timelinePreviewValues]);
```
to:
```typescript
    const withTimelinePreview = useCallback((sprite: SceneSprite, id: string): SceneSprite => {
        if (!showTimeline || selectedSpriteId !== id || !timelinePreviewValues) return sprite;
        return {
            ...sprite,
            x: timelinePreviewValues.x ?? sprite.x,
            y: timelinePreviewValues.y ?? sprite.y,
            zoom: timelinePreviewValues.zoom ?? sprite.zoom,
            alpha: timelinePreviewValues.alpha ?? sprite.alpha,
            rotation: timelinePreviewValues.rotation ?? sprite.rotation,
            blur: timelinePreviewValues.blur ?? sprite.blur,
            saturation: timelinePreviewValues.saturation ?? sprite.saturation,
            brightness: timelinePreviewValues.brightness ?? sprite.brightness,
            contrast: timelinePreviewValues.contrast ?? sprite.contrast,
            invert: timelinePreviewValues.invert ?? sprite.invert,
        };
    }, [showTimeline, selectedSpriteId, timelinePreviewValues]);
```

This last change is what makes the live canvas preview (Play/scrub) actually reflect an animated saturation/brightness/contrast/invert — without it, keyframing these properties would generate correct ATL but silently show nothing changing in the preview while playing (`spriteVisualFilter`, which builds the preview's CSS filter, already reads `sprite.saturation`/`.brightness`/`.contrast`/`.invert`, so it picks this up automatically once `withTimelinePreview` overrides them).

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: zero errors anywhere in the project.
Run: `npx eslint src/components/SpriteAnimationPanel.tsx src/components/SpriteAnimationPanel.test.tsx src/components/SceneComposer.tsx`
Expected: zero errors/warnings.

- [ ] **Step 7: Run the full test suite**

Run: `npm test -- --run`
Expected: all test files pass.

- [ ] **Step 8: Run the production build**

Run: `npm run build`
Expected: succeeds (the pre-existing "chunks larger than 500kB" warning is expected and unrelated).

- [ ] **Step 9: Commit**

```bash
git add src/components/SpriteAnimationPanel.tsx src/components/SpriteAnimationPanel.test.tsx src/components/SceneComposer.tsx
git commit -m "feat: wire hasStaticTint through SpriteAnimationPanel and extend live preview"
```

---

## Self-Review Notes

- **Spec coverage:** data model + UI lists (Task 1), codegen composition (Task 2), picker disabling rule (Task 3), integration + live-preview extension (Task 4) — every spec section has a task.
- **Type consistency:** `hasStaticTint: boolean` is named identically on both `TimelineRowProps` (Task 3) and `SpriteAnimationPanelProps` (Task 4); `MATRIX_FACTOR_CONSTRUCTOR`'s four keys match `MATRIX_FACTOR_PROPERTIES`'s four entries exactly.
- **No placeholders:** every step has complete code. The live-preview extension (Task 4 Step 5, `withTimelinePreview`) was not explicitly called out in the spec's own text but is necessary for the feature to actually be visible while previewing — included here with its rationale stated inline rather than silently added.
