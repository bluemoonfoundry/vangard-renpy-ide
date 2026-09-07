# Timeline Editor Multi-Timeline Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Timeline Editor's fixed six-track-per-sprite animation model with a user-managed list of property-scoped "timelines" per sprite that combine in parallel or sequential order.

**Architecture:** Bottom-up: rewrite the shared data model in `src/types.ts` first, then the two pure-logic libraries that consume it (`atlCodeGenerator.ts`, `timelinePreview.ts`), then the UI components leaf-to-root (`PoseKeyframeEditor` → `TimelineRow` → `SpriteAnimationPanel`), then wire the new panel into `SceneComposer.tsx`. Each library/component task is TDD (test file first, verify it fails, implement, verify it passes) except the types-only task (no test target exists for a pure type change) and the final `SceneComposer.tsx` integration task (no dedicated test file for that component today — verified via full-suite + build, matching how the original Phase 1/2 integration into `SceneComposer.tsx` was verified in this project's history).

**Tech Stack:** TypeScript, React, Vitest, @testing-library/react, @testing-library/user-event.

**Spec:** `docs/superpowers/specs/2026-08-19-timeline-editor-multi-timeline-redesign-design.md`

## Global Constraints

- No migration code for old-shaped `scene.animations` data — old shape is simply dropped/absent once this ships (confirmed with user; not yet pushed to `origin/main`).
- Property canonical order for all generated output and picker rendering: `x, y, zoom, alpha, rotation, blur` (spec's exact wording, matches `AnimatableProperty`'s declaration order).
- `combineMode` defaults to `'parallel'` when a sprite's first timeline is created.
- Timeline `name` prefill: `${spriteTag}${index}` where `index` is the count of the sprite's existing timelines at creation time (not reused after deletes). Names are UI-only, never emitted into ATL, and need not be unique.
- Property-set edits on a timeline are allowed at any time: adding a property backfills every existing keyframe's value for it (from the sprite's current static value); removing a property drops that key from every existing keyframe.
- No-overlapping-properties is enforced only when `combineMode === 'parallel'`; freely allowed in `'sequential'`.
- Run after every task: `npx tsc --noEmit` (must be clean by the end of Task 7; interim tasks may show errors in not-yet-updated dependents — noted per task), the task's own test file, and `npx eslint <changed files>`.
- Run once, after Task 7: full `npm test -- --run` and `npm run build`.

---

### Task 1: Data model (`src/types.ts`)

**Files:**
- Modify: `src/types.ts:909-938` (replaces `Keyframe`, `KeyframeTrack`, `SpriteAnimation`; `EasingFunction` at line 910 is unchanged and stays)

**Interfaces:**
- Produces: `AnimatableProperty`, `PoseKeyframe { id, time, values, easing }`, `SpriteTimeline { id, name, properties, keyframes, duration, loop }`, `SpriteAnimation { spriteId, combineMode, timelines }` — every later task consumes these exact names/shapes.

This task has no dedicated test (it's a pure type change with no runtime behavior of its own) and is expected to leave `tsc --noEmit` reporting errors in every file that still references the old `Keyframe`/`KeyframeTrack`/old-shaped `SpriteAnimation` — those are fixed one file per task below. Do not "fix" those other files in this task.

- [ ] **Step 1: Replace the old types**

Replace lines 909-938 of `src/types.ts` (currently `EasingFunction` through the closing brace of the old `SpriteAnimation`) with:

```typescript
/** Ren'Py's standard ATL easing/warp functions. */
export type EasingFunction = 'linear' | 'ease' | 'easein' | 'easeout' | 'easein_quad' | 'easeout_quad' | 'easeinout_quad';

export type AnimatableProperty = 'x' | 'y' | 'zoom' | 'alpha' | 'rotation' | 'blur';

/** A full pose snapshot for a timeline's covered properties, at a point in time. */
export interface PoseKeyframe {
  id: string;
  /** Seconds from the start of this timeline (not the sprite's other timelines). */
  time: number;
  /** One value per property in the owning timeline's `properties` set. */
  values: Partial<Record<AnimatableProperty, number>>;
  /** Easing applied to the transition arriving at this keyframe from the previous one. Ignored on a timeline's first keyframe. */
  easing: EasingFunction;
}

/** One named, independently-timed pose-keyframe sequence, scoped to a subset of the owning sprite's animatable properties. */
export interface SpriteTimeline {
  id: string;
  name: string;
  properties: AnimatableProperty[];
  keyframes: PoseKeyframe[];
  duration: number;
  loop: boolean;
}

/** All timeline-based animation for one sprite (SceneSprite.id, or 'background'). */
export interface SpriteAnimation {
  spriteId: string;
  /** How this sprite's timelines combine: simultaneously (default), or one after another in list order. */
  combineMode: 'parallel' | 'sequential';
  timelines: SpriteTimeline[];
}
```

- [ ] **Step 2: Verify the expected (and only the expected) breakage**

Run: `npx tsc --noEmit`
Expected: errors in exactly these files, no others: `src/lib/atlCodeGenerator.ts`, `src/lib/atlCodeGenerator.test.ts`, `src/lib/timelinePreview.ts`, `src/lib/timelinePreview.test.ts`, `src/components/KeyframeEditor.tsx`, `src/components/SpriteTimelineTrack.tsx`, `src/components/SpriteTimelineTrack.test.tsx`, `src/components/SpriteTimeline.tsx`, `src/components/SpriteTimeline.test.tsx`, `src/components/SceneComposer.tsx`. If any other file errors, stop and investigate before continuing — it means something outside this plan's scope depends on the old shape.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: replace fixed-track animation types with multi-timeline model"
```

---

### Task 2: `src/lib/atlCodeGenerator.ts`

**Files:**
- Modify: `src/lib/atlCodeGenerator.ts` (full rewrite, same path)
- Test: `src/lib/atlCodeGenerator.test.ts` (full rewrite, same path)

**Interfaces:**
- Consumes: `AnimatableProperty`, `PoseKeyframe`, `SpriteTimeline`, `SpriteAnimation` (Task 1).
- Produces: `transformNameFor(spriteId: string): string`, `generateATLFromTimeline(anim: SpriteAnimation): string` — both consumed by `SceneComposer.tsx` (Task 7). `generateTimelineCode` is internal (not exported).

- [ ] **Step 1: Write the failing test file**

Replace the full contents of `src/lib/atlCodeGenerator.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { generateATLFromTimeline, transformNameFor } from './atlCodeGenerator';
import type { SpriteAnimation, SpriteTimeline } from '@/types';

function timeline(overrides: Partial<SpriteTimeline> = {}): SpriteTimeline {
  return { id: 't1', name: 'Timeline', properties: [], keyframes: [], duration: 2, loop: false, ...overrides };
}

function anim(overrides: Partial<SpriteAnimation> = {}): SpriteAnimation {
  return { spriteId: 'eileen', combineMode: 'parallel', timelines: [], ...overrides };
}

describe('transformNameFor', () => {
  it('derives the transform name from the sprite id alone', () => {
    expect(transformNameFor('eileen')).toBe('eileen_animation');
    expect(transformNameFor('background')).toBe('background_animation');
  });
});

describe('generateATLFromTimeline', () => {
  it('falls back to a pass-only transform when no timeline has keyframes', () => {
    expect(generateATLFromTimeline(anim({ timelines: [timeline()] }))).toBe('transform eileen_animation:\n    pass\n');
  });

  it('generates a single combined warp line for a single timeline covering multiple properties', () => {
    const t = timeline({
      properties: ['x', 'alpha'],
      keyframes: [
        { id: 'k1', time: 0, values: { x: 0, alpha: 0 }, easing: 'linear' },
        { id: 'k2', time: 1, values: { x: 0.5, alpha: 1 }, easing: 'easein' },
      ],
    });
    expect(generateATLFromTimeline(anim({ timelines: [t] }))).toBe(
      'transform eileen_animation:\n    xcenter 0\n    alpha 0\n    easein 1 xcenter 0.5 alpha 1\n'
    );
  });

  it('emits properties in canonical order (x, y, zoom, alpha, rotation, blur) regardless of the properties array order', () => {
    const t = timeline({
      properties: ['alpha', 'x'],
      keyframes: [
        { id: 'k1', time: 0, values: { alpha: 1, x: 0 }, easing: 'linear' },
        { id: 'k2', time: 1, values: { alpha: 0, x: 1 }, easing: 'linear' },
      ],
    });
    const code = generateATLFromTimeline(anim({ timelines: [t] }));
    expect(code).toContain('xcenter 0\n    alpha 1\n');
    expect(code).toContain('linear 1 xcenter 1 alpha 0\n');
  });

  it('emits a static-only line (no warp) for a timeline with exactly one keyframe', () => {
    const t = timeline({ properties: ['zoom'], keyframes: [{ id: 'k1', time: 0, values: { zoom: 1.5 }, easing: 'linear' }] });
    expect(generateATLFromTimeline(anim({ timelines: [t] }))).toBe('transform eileen_animation:\n    zoom 1.5\n');
  });

  it('sorts keyframes by time regardless of input order', () => {
    const t = timeline({
      properties: ['alpha'],
      keyframes: [
        { id: 'k2', time: 1, values: { alpha: 1 }, easing: 'linear' },
        { id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' },
      ],
    });
    expect(generateATLFromTimeline(anim({ timelines: [t] }))).toBe('transform eileen_animation:\n    alpha 0\n    linear 1 alpha 1\n');
  });

  it('appends "repeat" per-timeline when that timeline loops', () => {
    const t = timeline({
      loop: true,
      properties: ['rotation'],
      keyframes: [{ id: 'k1', time: 0, values: { rotation: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { rotation: 360 }, easing: 'linear' }],
    });
    expect(generateATLFromTimeline(anim({ timelines: [t] }))).toBe('transform eileen_animation:\n    rotate 0\n    linear 1 rotate 360\n    repeat\n');
  });

  it('wraps two timelines in nested parallel: branches when combineMode is parallel', () => {
    const t1 = timeline({ id: 't1', properties: ['x'], keyframes: [{ id: 'k1', time: 0, values: { x: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { x: 1 }, easing: 'linear' }] });
    const t2 = timeline({ id: 't2', properties: ['alpha'], keyframes: [{ id: 'k3', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k4', time: 1, values: { alpha: 1 }, easing: 'easein' }] });
    const code = generateATLFromTimeline(anim({ combineMode: 'parallel', timelines: [t1, t2] }));
    expect(code).toBe(
      'transform eileen_animation:\n    parallel:\n        xcenter 0\n        linear 1 xcenter 1\n    parallel:\n        alpha 0\n        easein 1 alpha 1\n'
    );
  });

  it('concatenates two timelines directly with no parallel: wrapper when combineMode is sequential', () => {
    const t1 = timeline({ id: 't1', properties: ['alpha'], keyframes: [{ id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 1 }, easing: 'linear' }] });
    const t2 = timeline({ id: 't2', properties: ['alpha'], keyframes: [{ id: 'k3', time: 0, values: { alpha: 1 }, easing: 'linear' }, { id: 'k4', time: 1, values: { alpha: 0 }, easing: 'easeout' }] });
    const code = generateATLFromTimeline(anim({ combineMode: 'sequential', timelines: [t1, t2] }));
    expect(code).toBe(
      'transform eileen_animation:\n    alpha 0\n    linear 1 alpha 1\n    alpha 1\n    easeout 1 alpha 0\n'
    );
    expect(code).not.toContain('parallel:');
  });

  it('skips timelines with zero keyframes entirely, even alongside animated ones', () => {
    const empty = timeline({ id: 'empty', properties: ['blur'], keyframes: [] });
    const t = timeline({ id: 't1', properties: ['alpha'], keyframes: [{ id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 1 }, easing: 'linear' }] });
    const code = generateATLFromTimeline(anim({ timelines: [empty, t] }));
    expect(code).toBe('transform eileen_animation:\n    alpha 0\n    linear 1 alpha 1\n');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/atlCodeGenerator.test.ts`
Expected: FAIL — compile/type errors, since `src/lib/atlCodeGenerator.ts` still imports the old `KeyframeTrack`/old-shaped `SpriteAnimation` from Task 1's now-changed `types.ts`.

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

const ATL_PROPERTY_NAME: Record<AnimatableProperty, string> = {
  x: 'xcenter',
  y: 'ycenter',
  zoom: 'zoom',
  alpha: 'alpha',
  rotation: 'rotate',
  blur: 'blur',
};

/** Canonical property order for all generated ATL lines, regardless of picker selection order. */
const PROPERTY_ORDER: AnimatableProperty[] = ['x', 'y', 'zoom', 'alpha', 'rotation', 'blur'];

/** A valid Ren'Py transform name for the sprite's (single) animation, e.g. `eileen_animation`. */
export function transformNameFor(spriteId: string): string {
  const slug = spriteId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'sprite';
  return `${slug}_animation`;
}

function formatValue(value: number): string {
  return Number(value.toFixed(3)).toString();
}

/**
 * ATL body lines for one timeline (its keyframes, in time order), indented
 * by `indent`. The first keyframe emits one plain property line per
 * property; each subsequent keyframe emits one combined warp line covering
 * every property in `timeline.properties`, in canonical order. Appends a
 * trailing `repeat` line if the timeline loops.
 */
function generateTimelineCode(timeline: SpriteTimeline, indent: string): string {
  const kfs = [...timeline.keyframes].sort((a, b) => a.time - b.time);
  if (kfs.length === 0) return '';

  const orderedProps = PROPERTY_ORDER.filter(p => timeline.properties.includes(p));

  let code = orderedProps.map(p => `${indent}${ATL_PROPERTY_NAME[p]} ${formatValue(kfs[0].values[p] ?? 0)}`).join('\n') + '\n';
  for (let i = 1; i < kfs.length; i++) {
    const duration = kfs[i].time - kfs[i - 1].time;
    const parts = orderedProps.map(p => `${ATL_PROPERTY_NAME[p]} ${formatValue(kfs[i].values[p] ?? 0)}`).join(' ');
    code += `${indent}${kfs[i].easing} ${formatValue(duration)} ${parts}\n`;
  }

  if (timeline.loop) code += `${indent}repeat\n`;

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
  const active = anim.timelines.filter(t => t.keyframes.length > 0);

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
    body = active.map(t => generateTimelineCode(t, '    ')).join('');
  }

  return `transform ${name}:\n${body}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/atlCodeGenerator.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Type-check and lint just this pair of files**

Run: `npx tsc --noEmit` (still expect errors in the other not-yet-updated files listed in Task 1 Step 2, minus `atlCodeGenerator.ts`/`atlCodeGenerator.test.ts`, which must now be clean)
Run: `npx eslint src/lib/atlCodeGenerator.ts src/lib/atlCodeGenerator.test.ts`
Expected: zero errors/warnings from eslint.

- [ ] **Step 6: Commit**

```bash
git add src/lib/atlCodeGenerator.ts src/lib/atlCodeGenerator.test.ts
git commit -m "feat: generate ATL from multi-timeline SpriteAnimation"
```

---

### Task 3: `src/lib/timelinePreview.ts`

**Files:**
- Modify: `src/lib/timelinePreview.ts` (full rewrite, same path)
- Test: `src/lib/timelinePreview.test.ts` (full rewrite, same path)

**Interfaces:**
- Consumes: `AnimatableProperty`, `PoseKeyframe`, `SpriteTimeline`, `SpriteAnimation` (Task 1); `applyEasing` from `./easingFunctions` (unchanged).
- Produces: `interpolateTimeline(timeline: SpriteTimeline, localTime: number): Partial<Record<AnimatableProperty, number>>`, `interpolateSpriteAnimation(anim: SpriteAnimation, time: number): Partial<Record<AnimatableProperty, number>>`, `getTotalDuration(anim: SpriteAnimation): number`, `startPlayback(anim, onUpdate, onEnd?): PlaybackHandle`, `PlaybackHandle` — all consumed by `SpriteAnimationPanel.tsx` (Task 6).

- [ ] **Step 1: Write the failing test file**

Replace the full contents of `src/lib/timelinePreview.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { interpolateTimeline, interpolateSpriteAnimation, getTotalDuration } from './timelinePreview';
import type { SpriteAnimation, SpriteTimeline } from '@/types';

const xTimeline: SpriteTimeline = {
  id: 't-x', name: 'Position', properties: ['x'], duration: 2, loop: false,
  keyframes: [
    { id: 'k1', time: 0, values: { x: 0 }, easing: 'linear' },
    { id: 'k2', time: 1, values: { x: 1 }, easing: 'linear' },
    { id: 'k3', time: 2, values: { x: 0.5 }, easing: 'linear' },
  ],
};

describe('interpolateTimeline', () => {
  it('returns an empty object for a timeline with no keyframes', () => {
    expect(interpolateTimeline({ ...xTimeline, keyframes: [] }, 0.5)).toEqual({});
  });

  it('returns the single pose for a one-keyframe timeline at any time', () => {
    const single: SpriteTimeline = { ...xTimeline, keyframes: [{ id: 'k1', time: 1, values: { x: 0.7 }, easing: 'linear' }] };
    expect(interpolateTimeline(single, 0)).toEqual({ x: 0.7 });
    expect(interpolateTimeline(single, 5)).toEqual({ x: 0.7 });
  });

  it('clamps to the first pose before the first keyframe, and the last pose after the last (non-looping)', () => {
    expect(interpolateTimeline(xTimeline, -1)).toEqual({ x: 0 });
    expect(interpolateTimeline(xTimeline, 10)).toEqual({ x: 0.5 });
  });

  it('wraps around when the timeline loops', () => {
    const looping: SpriteTimeline = { ...xTimeline, loop: true };
    // 2.5s wraps to 0.5s within a 2s duration
    expect(interpolateTimeline(looping, 2.5).x).toBeCloseTo(0.5, 5);
  });

  it('linearly interpolates between two keyframes for every covered property', () => {
    expect(interpolateTimeline(xTimeline, 0.5)).toEqual({ x: 0.5 });
  });

  it('applies the arriving keyframe\'s easing', () => {
    const eased: SpriteTimeline = {
      ...xTimeline,
      keyframes: [
        { id: 'k1', time: 0, values: { x: 0 }, easing: 'linear' },
        { id: 'k2', time: 1, values: { x: 1 }, easing: 'easein' },
      ],
    };
    expect(interpolateTimeline(eased, 0.5).x).toBeLessThan(0.5);
  });

  it('interpolates every property in the timeline independently at the same instant', () => {
    const multi: SpriteTimeline = {
      ...xTimeline,
      properties: ['x', 'alpha'],
      keyframes: [
        { id: 'k1', time: 0, values: { x: 0, alpha: 0 }, easing: 'linear' },
        { id: 'k2', time: 1, values: { x: 1, alpha: 1 }, easing: 'linear' },
      ],
    };
    expect(interpolateTimeline(multi, 0.5)).toEqual({ x: 0.5, alpha: 0.5 });
  });
});

describe('getTotalDuration', () => {
  it('is the max of the timelines\' durations in parallel mode', () => {
    const anim: SpriteAnimation = { spriteId: 's', combineMode: 'parallel', timelines: [{ ...xTimeline, duration: 2 }, { ...xTimeline, id: 't2', duration: 5 }] };
    expect(getTotalDuration(anim)).toBe(5);
  });

  it('is the sum of the timelines\' durations in sequential mode', () => {
    const anim: SpriteAnimation = { spriteId: 's', combineMode: 'sequential', timelines: [{ ...xTimeline, duration: 2 }, { ...xTimeline, id: 't2', duration: 1.5 }] };
    expect(getTotalDuration(anim)).toBe(3.5);
  });

  it('is 0 for a sprite animation with no timelines', () => {
    expect(getTotalDuration({ spriteId: 's', combineMode: 'parallel', timelines: [] })).toBe(0);
  });
});

describe('interpolateSpriteAnimation', () => {
  it('merges independent parallel timelines at the same instant', () => {
    const alphaTimeline: SpriteTimeline = { id: 't-a', name: 'Fade', properties: ['alpha'], duration: 2, loop: false, keyframes: [{ id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k2', time: 2, values: { alpha: 1 }, easing: 'linear' }] };
    const anim: SpriteAnimation = { spriteId: 's', combineMode: 'parallel', timelines: [xTimeline, alphaTimeline] };
    expect(interpolateSpriteAnimation(anim, 1)).toEqual({ x: 1, alpha: 0.5 });
  });

  it('a single timeline behaves identically in both combine modes', () => {
    const anim = (mode: 'parallel' | 'sequential'): SpriteAnimation => ({ spriteId: 's', combineMode: mode, timelines: [xTimeline] });
    expect(interpolateSpriteAnimation(anim('parallel'), 0.5)).toEqual(interpolateSpriteAnimation(anim('sequential'), 0.5));
  });

  it('selects the active timeline by cumulative offset in sequential mode', () => {
    const first: SpriteTimeline = { id: 't1', name: 'First', properties: ['x'], duration: 1, loop: false, keyframes: [{ id: 'k1', time: 0, values: { x: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { x: 1 }, easing: 'linear' }] };
    const second: SpriteTimeline = { id: 't2', name: 'Second', properties: ['x'], duration: 1, loop: false, keyframes: [{ id: 'k1', time: 0, values: { x: 1 }, easing: 'linear' }, { id: 'k2', time: 1, values: { x: 0 }, easing: 'linear' }] };
    const anim: SpriteAnimation = { spriteId: 's', combineMode: 'sequential', timelines: [first, second] };
    // t=0.5 is inside `first`'s [0,1) window; t=1.5 is inside `second`'s [1,2) window, local time 0.5
    expect(interpolateSpriteAnimation(anim, 0.5).x).toBeCloseTo(0.5, 5);
    expect(interpolateSpriteAnimation(anim, 1.5).x).toBeCloseTo(0.5, 5);
  });

  it('holds a property\'s last value forward from an earlier timeline when the active timeline doesn\'t cover it', () => {
    const alphaOnly: SpriteTimeline = { id: 't1', name: 'Fade', properties: ['alpha'], duration: 1, loop: false, keyframes: [{ id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 1 }, easing: 'linear' }] };
    const zoomOnly: SpriteTimeline = { id: 't2', name: 'Zoom', properties: ['zoom'], duration: 1, loop: false, keyframes: [{ id: 'k1', time: 0, values: { zoom: 1 }, easing: 'linear' }, { id: 'k2', time: 1, values: { zoom: 2 }, easing: 'linear' }] };
    const anim: SpriteAnimation = { spriteId: 's', combineMode: 'sequential', timelines: [alphaOnly, zoomOnly] };
    // At t=1.5, `zoomOnly` is active (local time 0.5) but doesn't cover alpha -- alpha should hold at 1 (alphaOnly's final value)
    const result = interpolateSpriteAnimation(anim, 1.5);
    expect(result.alpha).toBe(1);
    expect(result.zoom).toBeCloseTo(1.5, 5);
  });

  it('a later timeline\'s coverage of a shared property wins over an earlier one\'s held-forward value', () => {
    const first: SpriteTimeline = { id: 't1', name: 'FadeIn', properties: ['alpha'], duration: 1, loop: false, keyframes: [{ id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 1 }, easing: 'linear' }] };
    const second: SpriteTimeline = { id: 't2', name: 'FadeOut', properties: ['alpha'], duration: 1, loop: false, keyframes: [{ id: 'k1', time: 0, values: { alpha: 1 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 0 }, easing: 'linear' }] };
    const anim: SpriteAnimation = { spriteId: 's', combineMode: 'sequential', timelines: [first, second] };
    expect(interpolateSpriteAnimation(anim, 1.5).alpha).toBeCloseTo(0.5, 5);
  });

  it('returns an empty object for a sprite animation with no timelines', () => {
    expect(interpolateSpriteAnimation({ spriteId: 's', combineMode: 'parallel', timelines: [] }, 1)).toEqual({});
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/timelinePreview.test.ts`
Expected: FAIL — compile errors (old implementation still imports `KeyframeTrack`/old `SpriteAnimation`; `interpolateSpriteAnimation`/`getTotalDuration` don't exist yet).

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `src/lib/timelinePreview.ts` with:

```typescript
/**
 * @file timelinePreview.ts
 * @description Interpolates `SpriteTimeline` poses at an arbitrary time, and
 * drives an `requestAnimationFrame` playback loop for `SpriteAnimationPanel`'s
 * Play button -- used only for the live canvas preview, never for the
 * generated ATL code (that's `atlCodeGenerator.ts`, driven by the same
 * keyframe data but independent of this interpolation).
 */
import type { AnimatableProperty, SpriteAnimation, SpriteTimeline } from '@/types';
import { applyEasing } from './easingFunctions';

function wrapOrClampLocalTime(timeline: SpriteTimeline, localTime: number): number {
  if (timeline.duration <= 0) return 0;
  if (timeline.loop) {
    const wrapped = localTime % timeline.duration;
    return wrapped < 0 ? wrapped + timeline.duration : wrapped;
  }
  return Math.max(0, Math.min(timeline.duration, localTime));
}

/**
 * Pose (one value per property in `timeline.properties`) at `localTime`
 * seconds from the start of `timeline`. Before the first keyframe, holds the
 * first keyframe's pose; after the last, holds the last (or wraps around if
 * `timeline.loop`). Empty object if the timeline has no keyframes.
 */
export function interpolateTimeline(timeline: SpriteTimeline, localTime: number): Partial<Record<AnimatableProperty, number>> {
  const kfs = timeline.keyframes;
  if (kfs.length === 0) return {};

  const sorted = [...kfs].sort((a, b) => a.time - b.time);
  const t = wrapOrClampLocalTime(timeline, localTime);

  if (sorted.length === 1 || t <= sorted[0].time) return { ...sorted[0].values };
  if (t >= sorted[sorted.length - 1].time) return { ...sorted[sorted.length - 1].values };

  const nextIndex = sorted.findIndex(kf => kf.time > t);
  const prev = sorted[nextIndex - 1];
  const curr = sorted[nextIndex];
  const span = curr.time - prev.time;
  const frac = span <= 0 ? 1 : (t - prev.time) / span;
  const easedT = applyEasing(frac, curr.easing);

  const result: Partial<Record<AnimatableProperty, number>> = {};
  for (const prop of timeline.properties) {
    const prevVal = prev.values[prop] ?? 0;
    const currVal = curr.values[prop] ?? prevVal;
    result[prop] = prevVal + easedT * (currVal - prevVal);
  }
  return result;
}

/** Sum of the timelines' durations (sequential), or the max (parallel). 0 if there are no timelines. */
export function getTotalDuration(anim: SpriteAnimation): number {
  if (anim.timelines.length === 0) return 0;
  return anim.combineMode === 'parallel'
    ? Math.max(...anim.timelines.map(t => t.duration))
    : anim.timelines.reduce((sum, t) => sum + t.duration, 0);
}

function longestTimeline(anim: SpriteAnimation): SpriteTimeline {
  return anim.timelines.reduce((max, t) => (t.duration > max.duration ? t : max));
}

/** Whether the combined preview should loop forever once it reaches `getTotalDuration(anim)`. */
function overallLoops(anim: SpriteAnimation): boolean {
  if (anim.timelines.length === 0) return false;
  return anim.combineMode === 'parallel'
    ? longestTimeline(anim).loop
    : anim.timelines[anim.timelines.length - 1].loop;
}

/**
 * Pose at `time` seconds into the combined animation. In `'parallel'` mode,
 * every timeline plays from t=0 simultaneously and their poses are merged
 * (safe -- parallel timelines never share properties). In `'sequential'`
 * mode, each timeline gets a start offset (sum of prior timelines'
 * durations); the timeline whose window contains `time` is interpolated
 * locally, and any property it doesn't cover holds the last value set by
 * the most recent *earlier* timeline that did cover it (mirroring how ATL
 * leaves properties untouched by later statements at whatever value an
 * earlier statement last set).
 */
export function interpolateSpriteAnimation(anim: SpriteAnimation, time: number): Partial<Record<AnimatableProperty, number>> {
  if (anim.timelines.length === 0) return {};

  if (anim.combineMode === 'parallel') {
    const result: Partial<Record<AnimatableProperty, number>> = {};
    for (const timeline of anim.timelines) {
      Object.assign(result, interpolateTimeline(timeline, time));
    }
    return result;
  }

  let offset = 0;
  let activeIndex = 0;
  let localTime = time;
  for (let i = 0; i < anim.timelines.length; i++) {
    const timeline = anim.timelines[i];
    if (time < offset + timeline.duration || i === anim.timelines.length - 1) {
      activeIndex = i;
      localTime = time - offset;
      break;
    }
    offset += timeline.duration;
  }

  const result: Partial<Record<AnimatableProperty, number>> = {};
  for (let i = 0; i < activeIndex; i++) {
    Object.assign(result, interpolateTimeline(anim.timelines[i], anim.timelines[i].duration));
  }
  Object.assign(result, interpolateTimeline(anim.timelines[activeIndex], localTime));
  return result;
}

export interface PlaybackHandle {
  stop: () => void;
}

/**
 * Starts an `requestAnimationFrame` playback loop over `anim`'s combined
 * timelines, calling `onUpdate` with the interpolated pose every frame.
 * Loops indefinitely if the timeline determining the total duration loops
 * (the longest one in parallel mode, the last one in sequential mode);
 * otherwise calls `onEnd` once and stops. Returns a handle whose `stop()`
 * cancels the loop.
 */
export function startPlayback(
  anim: SpriteAnimation,
  onUpdate: (values: Partial<Record<AnimatableProperty, number>>, elapsed: number) => void,
  onEnd?: () => void,
): PlaybackHandle {
  let stopped = false;
  let rafId: number;
  const startTime = performance.now();
  const duration = getTotalDuration(anim);
  const loops = overallLoops(anim);

  const tick = (now: number) => {
    if (stopped) return;
    let elapsed = (now - startTime) / 1000;

    if (elapsed >= duration) {
      if (loops && duration > 0) {
        elapsed = elapsed % duration;
      } else {
        onUpdate(interpolateSpriteAnimation(anim, duration), duration);
        onEnd?.();
        return;
      }
    }

    onUpdate(interpolateSpriteAnimation(anim, elapsed), elapsed);
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/timelinePreview.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit` (errors should now only remain in `KeyframeEditor.tsx`, `SpriteTimelineTrack.tsx`, `SpriteTimelineTrack.test.tsx`, `SpriteTimeline.tsx`, `SpriteTimeline.test.tsx`, `SceneComposer.tsx`)
Run: `npx eslint src/lib/timelinePreview.ts src/lib/timelinePreview.test.ts`
Expected: zero errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/timelinePreview.ts src/lib/timelinePreview.test.ts
git commit -m "feat: interpolate multi-timeline SpriteAnimation for live preview"
```

---

### Task 4: `src/components/PoseKeyframeEditor.tsx` (replaces `KeyframeEditor.tsx`)

**Files:**
- Create: `src/components/PoseKeyframeEditor.tsx`
- Delete: `src/components/KeyframeEditor.tsx`

**Interfaces:**
- Consumes: `AnimatableProperty`, `PoseKeyframe` (Task 1); `EASING_OPTIONS` from `@/lib/easingFunctions` (unchanged); `useModalAccessibility` (unchanged).
- Produces: `VALUE_RANGE_BY_PROPERTY: Record<AnimatableProperty, { min: number; max: number; step: number }>` (named export, consumed by `TimelineRow.tsx` in Task 5), default export `PoseKeyframeEditor` component with props `{ keyframe: PoseKeyframe; properties: AnimatableProperty[]; duration: number; isFirstKeyframe: boolean; onSave: (updated: PoseKeyframe) => void; onDelete: () => void; onClose: () => void }`.

No dedicated test file for this task — mirrors the original codebase's own choice (`KeyframeEditor.tsx` had no standalone test file either); its behavior is exercised through `TimelineRow.test.tsx` in Task 5. Verification here is `tsc`/`eslint` only.

- [ ] **Step 1: Delete the old file and create the new one**

```bash
git rm src/components/KeyframeEditor.tsx
```

Create `src/components/PoseKeyframeEditor.tsx`:

```typescript
/**
 * @file PoseKeyframeEditor.tsx
 * @description Modal for precisely editing one `PoseKeyframe`'s time, its
 * value for every property in the owning timeline's `properties` set, and
 * easing. Opened by clicking a keyframe dot in `TimelineRow`.
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AnimatableProperty, PoseKeyframe } from '@/types';
import { EASING_OPTIONS } from '@/lib/easingFunctions';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface ValueRange {
  min: number;
  max: number;
  step: number;
}

const PROPERTY_ORDER: AnimatableProperty[] = ['x', 'y', 'zoom', 'alpha', 'rotation', 'blur'];

/** Slider bounds per property, matching the corresponding `SceneSprite` field's expected range. */
export const VALUE_RANGE_BY_PROPERTY: Record<AnimatableProperty, ValueRange> = {
  x: { min: -1, max: 2, step: 0.01 },
  y: { min: -1, max: 2, step: 0.01 },
  zoom: { min: 0, max: 3, step: 0.05 },
  alpha: { min: 0, max: 1, step: 0.01 },
  rotation: { min: -360, max: 360, step: 1 },
  blur: { min: 0, max: 50, step: 1 },
};

const PROPERTY_LABEL: Record<AnimatableProperty, string> = {
  x: 'X Position',
  y: 'Y Position',
  zoom: 'Zoom',
  alpha: 'Alpha',
  rotation: 'Rotation',
  blur: 'Blur',
};

interface PoseKeyframeEditorProps {
  keyframe: PoseKeyframe;
  properties: AnimatableProperty[];
  duration: number;
  isFirstKeyframe: boolean;
  onSave: (updated: PoseKeyframe) => void;
  onDelete: () => void;
  onClose: () => void;
}

const PoseKeyframeEditor: React.FC<PoseKeyframeEditorProps> = ({ keyframe, properties, duration, isFirstKeyframe, onSave, onDelete, onClose }) => {
  const [time, setTime] = useState(keyframe.time);
  const [values, setValues] = useState<Partial<Record<AnimatableProperty, number>>>(keyframe.values);
  const [easing, setEasing] = useState(keyframe.easing);
  const { modalProps, contentRef } = useModalAccessibility({ isOpen: true, onClose, titleId: 'pose-keyframe-editor-title' });
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const orderedProperties = PROPERTY_ORDER.filter(p => properties.includes(p));

  useEffect(() => {
    setTimeout(() => closeButtonRef.current?.focus(), 50);
  }, []);

  const setPropertyValue = (property: AnimatableProperty, value: number) => {
    setValues(prev => ({ ...prev, [property]: value }));
  };

  const handleSave = () => {
    const clampedValues: Partial<Record<AnimatableProperty, number>> = {};
    for (const property of orderedProperties) {
      const range = VALUE_RANGE_BY_PROPERTY[property];
      const raw = values[property] ?? 0;
      clampedValues[property] = Math.max(range.min, Math.min(range.max, raw));
    }
    onSave({ ...keyframe, time: Math.max(0, Math.min(duration, time)), values: clampedValues, easing });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div
        ref={contentRef}
        {...modalProps}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-sm m-4 flex flex-col border border-gray-200 dark:border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 id="pose-keyframe-editor-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">Keyframe</h2>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close" className="text-secondary hover:text-primary p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <main className="p-4 space-y-4">
          <div>
            <label htmlFor="pkf-time" className="flex items-center justify-between text-xs font-medium text-secondary mb-1">
              <span>Time (seconds)</span>
              <span className="font-mono text-primary">{time.toFixed(2)}</span>
            </label>
            <input
              id="pkf-time"
              type="range"
              min={0}
              max={duration}
              step={0.05}
              value={time}
              onChange={e => setTime(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {orderedProperties.map(property => {
            const range = VALUE_RANGE_BY_PROPERTY[property];
            return (
              <div key={property}>
                <label htmlFor={`pkf-value-${property}`} className="flex items-center justify-between text-xs font-medium text-secondary mb-1">
                  <span>{PROPERTY_LABEL[property]}</span>
                  <span className="font-mono text-primary">{values[property] ?? 0}</span>
                </label>
                <input
                  id={`pkf-value-${property}`}
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={values[property] ?? 0}
                  onChange={e => setPropertyValue(property, Number(e.target.value))}
                  className="w-full"
                />
              </div>
            );
          })}

          {!isFirstKeyframe && (
            <div>
              <label htmlFor="pkf-easing" className="block text-xs font-medium text-secondary mb-1">Easing (arriving from the previous keyframe)</label>
              <select
                id="pkf-easing"
                value={easing}
                onChange={e => setEasing(e.target.value as PoseKeyframe['easing'])}
                className="w-full text-sm rounded-md border border-primary bg-secondary text-primary px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {EASING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          )}
        </main>

        <footer className="bg-gray-50 dark:bg-gray-700 p-4 rounded-b-lg flex justify-between items-center">
          <button onClick={onDelete} className="px-3 py-2 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
            Delete
          </button>
          <div className="space-x-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
              Cancel
            </button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm">
              Save
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default PoseKeyframeEditor;
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit` (errors should now only remain in `SpriteTimelineTrack.tsx`, `SpriteTimelineTrack.test.tsx`, `SpriteTimeline.tsx`, `SpriteTimeline.test.tsx`, `SceneComposer.tsx`)
Run: `npx eslint src/components/PoseKeyframeEditor.tsx`
Expected: zero errors/warnings.

- [ ] **Step 3: Commit**

```bash
git add -A src/components/PoseKeyframeEditor.tsx src/components/KeyframeEditor.tsx
git commit -m "feat: add PoseKeyframeEditor, replacing single-property KeyframeEditor"
```

---

### Task 5: `src/components/TimelineRow.tsx` (replaces `SpriteTimelineTrack.tsx`)

**Files:**
- Create: `src/components/TimelineRow.tsx`
- Create: `src/components/TimelineRow.test.tsx`
- Delete: `src/components/SpriteTimelineTrack.tsx`
- Delete: `src/components/SpriteTimelineTrack.test.tsx`

**Interfaces:**
- Consumes: `AnimatableProperty`, `PoseKeyframe`, `SpriteTimeline` (Task 1); `PoseKeyframeEditor`, `VALUE_RANGE_BY_PROPERTY` (Task 4); `createId` from `@/lib/createId` (unchanged).
- Produces: default export `TimelineRow` component with props `{ timeline: SpriteTimeline; propertiesClaimedBySiblings: AnimatableProperty[]; combineMode: 'parallel' | 'sequential'; currentValues: Record<AnimatableProperty, number>; onChangeTimeline: (updater: (prev: SpriteTimeline) => SpriteTimeline) => void; onRemoveTimeline: () => void; onMoveUp?: () => void; onMoveDown?: () => void }` — consumed by `SpriteAnimationPanel.tsx` (Task 6).

- [ ] **Step 1: Delete the old files and write the failing test file**

```bash
git rm src/components/SpriteTimelineTrack.tsx src/components/SpriteTimelineTrack.test.tsx
```

Create `src/components/TimelineRow.test.tsx`:

```typescript
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TimelineRow from './TimelineRow';
import type { SpriteTimeline } from '@/types';

const currentValues = { x: 0.5, y: 0.5, zoom: 1, alpha: 1, rotation: 0, blur: 0 };

function emptyTimeline(): SpriteTimeline {
  return { id: 't1', name: 'bob0', properties: [], keyframes: [], duration: 2, loop: false };
}

function alphaTimeline(): SpriteTimeline {
  return { id: 't1', name: 'bob0', properties: ['alpha'], keyframes: [{ id: 'kf-1', time: 1, values: { alpha: 0.5 }, easing: 'linear' }], duration: 2, loop: false };
}

function renderRow(overrides: Partial<Parameters<typeof TimelineRow>[0]> = {}) {
  const props = {
    timeline: emptyTimeline(),
    propertiesClaimedBySiblings: [] as const,
    combineMode: 'parallel' as const,
    currentValues,
    onChangeTimeline: vi.fn(),
    onRemoveTimeline: vi.fn(),
    ...overrides,
  };
  return { ...render(<TimelineRow {...props} />), props };
}

describe('TimelineRow', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 200, bottom: 20, width: 200, height: 20, x: 0, y: 0, toJSON: () => {},
    } as DOMRect);
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows a placeholder and no ruler while no properties are selected', () => {
    renderRow();
    expect(screen.getByText('Pick at least one property to start keyframing')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add keyframe/ })).not.toBeInTheDocument();
  });

  it('renders the timeline name', () => {
    renderRow();
    expect(screen.getByDisplayValue('bob0')).toBeInTheDocument();
  });

  it('renaming calls onChangeTimeline with the new name', () => {
    const { props } = renderRow();
    fireEvent.change(screen.getByDisplayValue('bob0'), { target: { value: 'Entrance' } });
    const updater = props.onChangeTimeline.mock.calls[0][0];
    expect(updater(emptyTimeline()).name).toBe('Entrance');
  });

  it('checking a property adds it and backfills existing keyframes with the current value', () => {
    const { props } = renderRow({ timeline: alphaTimeline() });
    fireEvent.click(screen.getByLabelText('Zoom'));
    const updater = props.onChangeTimeline.mock.calls[0][0];
    const result = updater(alphaTimeline());
    expect(result.properties).toEqual(['alpha', 'zoom']);
    expect(result.keyframes[0].values).toEqual({ alpha: 0.5, zoom: 1 });
  });

  it('unchecking a property removes it and drops its value from existing keyframes', () => {
    const withTwoProps: SpriteTimeline = { ...alphaTimeline(), properties: ['alpha', 'zoom'], keyframes: [{ id: 'kf-1', time: 1, values: { alpha: 0.5, zoom: 2 }, easing: 'linear' }] };
    const { props } = renderRow({ timeline: withTwoProps });
    fireEvent.click(screen.getByLabelText('Zoom'));
    const updater = props.onChangeTimeline.mock.calls[0][0];
    const result = updater(withTwoProps);
    expect(result.properties).toEqual(['alpha']);
    expect(result.keyframes[0].values).toEqual({ alpha: 0.5 });
  });

  it('disables a property claimed by a sibling timeline in parallel mode', () => {
    renderRow({ combineMode: 'parallel', propertiesClaimedBySiblings: ['zoom'] });
    expect(screen.getByLabelText('Zoom')).toBeDisabled();
  });

  it('does not disable any property in sequential mode, even if claimed by a sibling', () => {
    renderRow({ combineMode: 'sequential', propertiesClaimedBySiblings: ['zoom'] });
    expect(screen.getByLabelText('Zoom')).not.toBeDisabled();
  });

  it('does not disable a property already selected by this timeline itself', () => {
    renderRow({ timeline: alphaTimeline(), combineMode: 'parallel', propertiesClaimedBySiblings: ['zoom'] });
    expect(screen.getByLabelText('Alpha')).not.toBeDisabled();
  });

  it('adds a keyframe at the clicked time with the current values, and opens the editor once re-rendered with it', async () => {
    const withOneProp: SpriteTimeline = { ...emptyTimeline(), properties: ['alpha'] };
    const onChangeTimeline = vi.fn();
    const { rerender } = render(
      <TimelineRow timeline={withOneProp} propertiesClaimedBySiblings={[]} combineMode="parallel" currentValues={currentValues} onChangeTimeline={onChangeTimeline} onRemoveTimeline={() => {}} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add keyframe' }), { clientX: 100 }); // 100/200 * 2s = 1.0s

    const updater = onChangeTimeline.mock.calls[0][0];
    const result = updater(withOneProp);
    expect(result.keyframes).toHaveLength(1);
    expect(result.keyframes[0].time).toBeCloseTo(1.0, 2);
    expect(result.keyframes[0].values).toEqual({ alpha: 1 });

    rerender(
      <TimelineRow timeline={result} propertiesClaimedBySiblings={[]} combineMode="parallel" currentValues={currentValues} onChangeTimeline={onChangeTimeline} onRemoveTimeline={() => {}} />
    );
    expect(await screen.findByRole('heading', { name: 'Keyframe' })).toBeInTheDocument();
  });

  it('opens the keyframe editor when a dot is clicked, and deletes it on Delete', async () => {
    const user = userEvent.setup();
    const { props } = renderRow({ timeline: alphaTimeline() });

    await user.click(screen.getByRole('button', { name: /keyframe at 1.00s/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Keyframe' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    const updater = props.onChangeTimeline.mock.calls[0][0];
    expect(updater(alphaTimeline()).keyframes).toHaveLength(0);
  });

  it('repositions a keyframe on pointer drag', () => {
    const { props } = renderRow({ timeline: alphaTimeline() });
    const dot = screen.getByRole('button', { name: /keyframe at 1.00s/ });
    Object.defineProperty(dot, 'setPointerCapture', { value: vi.fn() });
    Object.defineProperty(dot, 'hasPointerCapture', { value: vi.fn(() => true) });
    Object.defineProperty(dot, 'releasePointerCapture', { value: vi.fn() });

    fireEvent.pointerDown(dot, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(dot, { pointerId: 1, clientX: 150 }); // 150/200 * 2s = 1.5s

    const updater = props.onChangeTimeline.mock.calls.at(-1)![0];
    expect(updater(alphaTimeline()).keyframes[0].time).toBeCloseTo(1.5, 2);

    fireEvent.pointerUp(dot, { pointerId: 1 });
  });

  it('calls onRemoveTimeline when Remove is clicked', async () => {
    const user = userEvent.setup();
    const onRemoveTimeline = vi.fn();
    renderRow({ onRemoveTimeline });
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemoveTimeline).toHaveBeenCalled();
  });

  it('calls onMoveUp/onMoveDown when provided, and omits the buttons when not', async () => {
    const user = userEvent.setup();
    const onMoveUp = vi.fn();
    renderRow({ onMoveUp });
    await user.click(screen.getByRole('button', { name: 'Move up' }));
    expect(onMoveUp).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Move down' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/TimelineRow.test.tsx`
Expected: FAIL — `TimelineRow.tsx` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/components/TimelineRow.tsx`:

```typescript
/**
 * @file TimelineRow.tsx
 * @description One `SpriteTimeline` in `SpriteAnimationPanel`: an editable
 * name, a property picker, duration/loop controls, and a ruler spanning the
 * timeline's duration with a dot per keyframe. Click empty ruler space to
 * add a keyframe there (values default to `currentValues`); click a dot to
 * open `PoseKeyframeEditor`; drag a dot to reposition it in time (native
 * pointer events, per this repo's canvas convention -- see CLAUDE.md).
 */
import React, { useState, useRef } from 'react';
import type { AnimatableProperty, PoseKeyframe, SpriteTimeline } from '@/types';
import PoseKeyframeEditor, { VALUE_RANGE_BY_PROPERTY } from './PoseKeyframeEditor';
import { createId } from '@/lib/createId';

interface TimelineRowProps {
  timeline: SpriteTimeline;
  /** Properties already claimed by a sibling timeline on the same sprite -- disabled in the picker only when `combineMode === 'parallel'`. */
  propertiesClaimedBySiblings: AnimatableProperty[];
  combineMode: 'parallel' | 'sequential';
  /** Current static value of each property on the underlying sprite, used as the default for new/backfilled keyframe values. */
  currentValues: Record<AnimatableProperty, number>;
  onChangeTimeline: (updater: (prev: SpriteTimeline) => SpriteTimeline) => void;
  onRemoveTimeline: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const PROPERTY_ORDER: AnimatableProperty[] = ['x', 'y', 'zoom', 'alpha', 'rotation', 'blur'];

const PROPERTY_LABEL: Record<AnimatableProperty, string> = {
  x: 'X Position',
  y: 'Y Position',
  zoom: 'Zoom',
  alpha: 'Alpha',
  rotation: 'Rotation',
  blur: 'Blur',
};

const TimelineRow: React.FC<TimelineRowProps> = ({
  timeline, propertiesClaimedBySiblings, combineMode, currentValues, onChangeTimeline, onRemoveTimeline, onMoveUp, onMoveDown,
}) => {
  const [editingKeyframeId, setEditingKeyframeId] = useState<string | null>(null);
  const [draggingKeyframeId, setDraggingKeyframeId] = useState<string | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  const editingKeyframe = timeline.keyframes.find(kf => kf.id === editingKeyframeId) ?? null;
  const isFirstKeyframe = editingKeyframe
    ? [...timeline.keyframes].sort((a, b) => a.time - b.time)[0]?.id === editingKeyframe.id
    : false;

  const toggleProperty = (property: AnimatableProperty) => {
    onChangeTimeline(prev => {
      const has = prev.properties.includes(property);
      if (has) {
        return {
          ...prev,
          properties: prev.properties.filter(p => p !== property),
          keyframes: prev.keyframes.map(kf => {
            const values = { ...kf.values };
            delete values[property];
            return { ...kf, values };
          }),
        };
      }
      const backfillValue = currentValues[property];
      return {
        ...prev,
        properties: [...prev.properties, property],
        keyframes: prev.keyframes.map(kf => ({ ...kf, values: { ...kf.values, [property]: backfillValue } })),
      };
    });
  };

  const setName = (name: string) => onChangeTimeline(prev => ({ ...prev, name }));
  const setDuration = (duration: number) => onChangeTimeline(prev => ({ ...prev, duration: Math.max(0.1, duration) }));
  const setLoop = (loop: boolean) => onChangeTimeline(prev => ({ ...prev, loop }));

  const timeFromClientX = (clientX: number): number => {
    const rect = rulerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(fraction * timeline.duration * 20) / 20; // snap to 0.05s
  };

  const handleRulerClick = (e: React.MouseEvent) => {
    if (e.target !== rulerRef.current) return; // ignore clicks that landed on a dot
    const time = timeFromClientX(e.clientX);
    const values: Partial<Record<AnimatableProperty, number>> = {};
    for (const property of timeline.properties) values[property] = currentValues[property];
    const newKeyframe: PoseKeyframe = { id: createId('pk'), time, values, easing: 'linear' };
    onChangeTimeline(prev => ({ ...prev, keyframes: [...prev.keyframes, newKeyframe] }));
    setEditingKeyframeId(newKeyframe.id);
  };

  const handleDotPointerDown = (e: React.PointerEvent, keyframeId: string) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingKeyframeId(keyframeId);
  };

  const handleDotPointerMove = (e: React.PointerEvent) => {
    if (!draggingKeyframeId) return;
    const time = timeFromClientX(e.clientX);
    onChangeTimeline(prev => ({
      ...prev,
      keyframes: prev.keyframes.map(kf => kf.id === draggingKeyframeId ? { ...kf, time } : kf),
    }));
  };

  const handleDotPointerUp = (e: React.PointerEvent) => {
    if (draggingKeyframeId) {
      const target = e.target as HTMLElement;
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
      setDraggingKeyframeId(null);
    }
  };

  return (
    <div className="p-3 rounded-md border border-primary bg-secondary space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={timeline.name}
          onChange={e => setName(e.target.value)}
          className="flex-1 text-sm font-semibold rounded border border-primary bg-secondary text-primary px-2 py-1"
        />
        {onMoveUp && <button onClick={onMoveUp} aria-label="Move up" className="text-xs text-secondary hover:text-primary">&uarr;</button>}
        {onMoveDown && <button onClick={onMoveDown} aria-label="Move down" className="text-xs text-secondary hover:text-primary">&darr;</button>}
        <button onClick={onRemoveTimeline} aria-label="Remove" className="text-xs text-red-600 dark:text-red-400 hover:underline">Remove</button>
      </div>

      <div className="flex flex-wrap gap-3">
        {PROPERTY_ORDER.map(property => {
          const isSelected = timeline.properties.includes(property);
          const isDisabled = combineMode === 'parallel' && !isSelected && propertiesClaimedBySiblings.includes(property);
          return (
            <label key={property} className={`flex items-center gap-1 text-xs ${isDisabled ? 'text-secondary opacity-50' : 'text-primary'}`}>
              <input type="checkbox" checked={isSelected} disabled={isDisabled} onChange={() => toggleProperty(property)} aria-label={PROPERTY_LABEL[property]} />
              {PROPERTY_LABEL[property]}
            </label>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-xs text-secondary">
          Duration
          <input type="number" min={0.1} step={0.1} value={timeline.duration} onChange={e => setDuration(Number(e.target.value))} className="w-16 text-xs rounded border border-primary bg-secondary text-primary px-1 py-0.5" />
          s
        </label>
        <label className="flex items-center gap-1 text-xs text-secondary">
          <input type="checkbox" checked={timeline.loop} onChange={e => setLoop(e.target.checked)} />
          Loop
        </label>
      </div>

      {timeline.properties.length === 0 ? (
        <p className="text-xs text-secondary italic py-2">Pick at least one property to start keyframing</p>
      ) : (
        <div
          ref={rulerRef}
          role="button"
          aria-label="Add keyframe"
          onClick={handleRulerClick}
          onPointerMove={handleDotPointerMove}
          onPointerUp={handleDotPointerUp}
          className="relative h-6 rounded bg-tertiary border border-primary cursor-pointer"
        >
          {timeline.keyframes.map(kf => (
            <button
              key={kf.id}
              type="button"
              aria-label={`keyframe at ${kf.time.toFixed(2)}s`}
              onPointerDown={(e) => handleDotPointerDown(e, kf.id)}
              onClick={(e) => { e.stopPropagation(); setEditingKeyframeId(kf.id); }}
              style={{ left: `${timeline.duration > 0 ? (kf.time / timeline.duration) * 100 : 0}%` }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent border-2 border-white dark:border-gray-800 shadow cursor-grab active:cursor-grabbing"
            />
          ))}
        </div>
      )}

      {editingKeyframe && (
        <PoseKeyframeEditor
          keyframe={editingKeyframe}
          properties={timeline.properties}
          duration={timeline.duration}
          isFirstKeyframe={isFirstKeyframe}
          onClose={() => setEditingKeyframeId(null)}
          onSave={(updated) => {
            const clampedValues: Partial<Record<AnimatableProperty, number>> = {};
            for (const property of timeline.properties) {
              const range = VALUE_RANGE_BY_PROPERTY[property];
              const raw = updated.values[property] ?? 0;
              clampedValues[property] = Math.max(range.min, Math.min(range.max, raw));
            }
            onChangeTimeline(prev => ({
              ...prev,
              keyframes: prev.keyframes.map(kf => kf.id === updated.id ? { ...updated, values: clampedValues } : kf),
            }));
            setEditingKeyframeId(null);
          }}
          onDelete={() => {
            onChangeTimeline(prev => ({ ...prev, keyframes: prev.keyframes.filter(kf => kf.id !== editingKeyframe.id) }));
            setEditingKeyframeId(null);
          }}
        />
      )}
    </div>
  );
};

export default TimelineRow;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/TimelineRow.test.tsx`
Expected: PASS (14 tests)

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit` (errors should now only remain in `SpriteTimeline.tsx`, `SpriteTimeline.test.tsx`, `SceneComposer.tsx`)
Run: `npx eslint src/components/TimelineRow.tsx src/components/TimelineRow.test.tsx`
Expected: zero errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/TimelineRow.tsx src/components/TimelineRow.test.tsx src/components/SpriteTimelineTrack.tsx src/components/SpriteTimelineTrack.test.tsx
git commit -m "feat: add TimelineRow, replacing single-property SpriteTimelineTrack"
```

---

### Task 6: `src/components/SpriteAnimationPanel.tsx` (replaces `SpriteTimeline.tsx`)

**Files:**
- Create: `src/components/SpriteAnimationPanel.tsx`
- Create: `src/components/SpriteAnimationPanel.test.tsx`
- Delete: `src/components/SpriteTimeline.tsx`
- Delete: `src/components/SpriteTimeline.test.tsx`

**Interfaces:**
- Consumes: `AnimatableProperty`, `SpriteAnimation`, `SpriteTimeline` (Task 1); `startPlayback`, `interpolateSpriteAnimation`, `getTotalDuration`, `PlaybackHandle` (Task 3); `TimelineRow` (Task 5); `createId` from `@/lib/createId`.
- Produces: default export `SpriteAnimationPanel` component with props `{ spriteLabel: string; animation: SpriteAnimation | null; currentValues: Record<AnimatableProperty, number>; onCreateAnimation: () => void; onChangeAnimation: (updater: (prev: SpriteAnimation) => SpriteAnimation) => void; onDeleteAnimation: () => void; onPreviewUpdate: (values: Partial<Record<AnimatableProperty, number>> | null) => void }` — consumed by `SceneComposer.tsx` (Task 7).

- [ ] **Step 1: Delete the old files and write the failing test file**

```bash
git rm src/components/SpriteTimeline.tsx src/components/SpriteTimeline.test.tsx
```

Create `src/components/SpriteAnimationPanel.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SpriteAnimationPanel from './SpriteAnimationPanel';
import type { SpriteAnimation, SpriteTimeline } from '@/types';

const currentValues = { x: 0.5, y: 0.5, zoom: 1, alpha: 1, rotation: 0, blur: 0 };

function timeline(overrides: Partial<SpriteTimeline> = {}): SpriteTimeline {
  return { id: 't1', name: 'bob0', properties: [], keyframes: [], duration: 2, loop: false, ...overrides };
}

function anim(overrides: Partial<SpriteAnimation> = {}): SpriteAnimation {
  return { spriteId: 'bob', combineMode: 'parallel', timelines: [timeline()], ...overrides };
}

function renderPanel(overrides: Partial<Parameters<typeof SpriteAnimationPanel>[0]> = {}) {
  const props = {
    spriteLabel: 'bob',
    animation: anim(),
    currentValues,
    onCreateAnimation: vi.fn(),
    onChangeAnimation: vi.fn(),
    onDeleteAnimation: vi.fn(),
    onPreviewUpdate: vi.fn(),
    ...overrides,
  };
  return { ...render(<SpriteAnimationPanel {...props} />), props };
}

describe('SpriteAnimationPanel', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 200, bottom: 20, width: 200, height: 20, x: 0, y: 0, toJSON: () => {},
    } as DOMRect);
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows an "Add Animation" prompt when the sprite has no animation', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({ animation: null });
    expect(screen.getByText(/No animation for bob yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add Animation' }));
    expect(props.onCreateAnimation).toHaveBeenCalled();
  });

  it('renders one TimelineRow per timeline', () => {
    renderPanel({ animation: anim({ timelines: [timeline({ id: 't1', name: 'bob0' }), timeline({ id: 't2', name: 'bob1' })] }) });
    expect(screen.getByDisplayValue('bob0')).toBeInTheDocument();
    expect(screen.getByDisplayValue('bob1')).toBeInTheDocument();
  });

  it('hides the combine-mode toggle with only one timeline, and shows it with two or more', () => {
    const { rerender } = render(
      <SpriteAnimationPanel spriteLabel="bob" animation={anim()} currentValues={currentValues} onCreateAnimation={() => {}} onChangeAnimation={() => {}} onDeleteAnimation={() => {}} onPreviewUpdate={() => {}} />
    );
    expect(screen.queryByRole('radio', { name: 'Parallel' })).not.toBeInTheDocument();

    rerender(
      <SpriteAnimationPanel
        spriteLabel="bob"
        animation={anim({ timelines: [timeline({ id: 't1' }), timeline({ id: 't2' })] })}
        currentValues={currentValues}
        onCreateAnimation={() => {}}
        onChangeAnimation={() => {}}
        onDeleteAnimation={() => {}}
        onPreviewUpdate={() => {}}
      />
    );
    expect(screen.getByRole('radio', { name: 'Parallel' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sequential' })).toBeInTheDocument();
  });

  it('adds a new timeline with a prefilled name using the sprite label and next index', () => {
    const { props } = renderPanel({ animation: anim({ timelines: [timeline({ id: 't1', name: 'bob0' })] }) });
    fireEvent.click(screen.getByRole('button', { name: '+ Add Timeline' }));
    const updater = props.onChangeAnimation.mock.calls[0][0];
    const result = updater(anim({ timelines: [timeline({ id: 't1', name: 'bob0' })] }));
    expect(result.timelines).toHaveLength(2);
    expect(result.timelines[1].name).toBe('bob1');
    expect(result.timelines[1].properties).toEqual([]);
  });

  it('removes the correct timeline', async () => {
    const user = userEvent.setup();
    const twoTimelines = anim({ timelines: [timeline({ id: 't1', name: 'bob0' }), timeline({ id: 't2', name: 'bob1' })] });
    const { props } = renderPanel({ animation: twoTimelines });
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await user.click(removeButtons[0]);
    const updater = props.onChangeAnimation.mock.calls[0][0];
    expect(updater(twoTimelines).timelines.map(t => t.id)).toEqual(['t2']);
  });

  it('computes propertiesClaimedBySiblings correctly for each row (verified via parallel-mode disabling)', () => {
    const twoTimelines = anim({
      timelines: [timeline({ id: 't1', name: 'bob0', properties: ['alpha'] }), timeline({ id: 't2', name: 'bob1', properties: [] })],
    });
    renderPanel({ animation: twoTimelines });
    const rows = screen.getAllByLabelText('Alpha');
    // First row's own Alpha checkbox is selected+enabled; second row's Alpha checkbox is disabled (claimed by the first).
    expect(rows[0]).not.toBeDisabled();
    expect(rows[1]).toBeDisabled();
  });

  it('reordering swaps the timelines and affects sequential playback order', () => {
    const first = timeline({ id: 't1', name: 'First', properties: ['alpha'], keyframes: [{ id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 1 }, easing: 'linear' }] });
    const second = timeline({ id: 't2', name: 'Second', properties: ['alpha'], keyframes: [{ id: 'k1', time: 0, values: { alpha: 1 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 0 }, easing: 'linear' }] });
    const sequential = anim({ combineMode: 'sequential', timelines: [first, second] });
    const { props } = renderPanel({ animation: sequential });
    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    const updater = props.onChangeAnimation.mock.calls[0][0];
    const reordered = updater(sequential);
    expect(reordered.timelines.map(t => t.id)).toEqual(['t2', 't1']);
  });

  it('calls onDeleteAnimation when Remove Animation is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Remove Animation' }));
    expect(props.onDeleteAnimation).toHaveBeenCalled();
  });

  it('calls onPreviewUpdate with the interpolated pose when the playhead is scrubbed', () => {
    const withAlpha = anim({ timelines: [timeline({ properties: ['alpha'], keyframes: [{ id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k2', time: 2, values: { alpha: 1 }, easing: 'linear' }] })] });
    const { props } = renderPanel({ animation: withAlpha });
    fireEvent.change(screen.getByRole('slider', { name: 'Playhead' }), { target: { value: '1' } });
    expect(props.onPreviewUpdate).toHaveBeenCalledWith(expect.objectContaining({ alpha: expect.closeTo(0.5, 5) }));
  });

  it('toggles the Play button label when clicked', async () => {
    const user = userEvent.setup();
    renderPanel();
    const playButton = screen.getByRole('button', { name: 'Play' });
    await user.click(playButton);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/SpriteAnimationPanel.test.tsx`
Expected: FAIL — `SpriteAnimationPanel.tsx` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/components/SpriteAnimationPanel.tsx`:

```typescript
/**
 * @file SpriteAnimationPanel.tsx
 * @description Root panel for one sprite's `SpriteAnimation`, opened from
 * the "Timeline" toggle in `SceneComposer`. Renders a combine-mode toggle
 * (hidden until 2+ timelines exist), the list of `TimelineRow`s, an
 * "+ Add Timeline" button, and a single overall play/scrub control that
 * previews the sprite's fully combined animation. The generated ATL itself
 * comes from `atlCodeGenerator.ts`, independent of this preview.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AnimatableProperty, SpriteAnimation, SpriteTimeline } from '@/types';
import TimelineRow from './TimelineRow';
import { startPlayback, interpolateSpriteAnimation, getTotalDuration, type PlaybackHandle } from '@/lib/timelinePreview';
import { createId } from '@/lib/createId';

interface SpriteAnimationPanelProps {
  spriteLabel: string;
  animation: SpriteAnimation | null;
  /** Current static value of each property on the underlying sprite, used as the default for new/backfilled keyframe values. */
  currentValues: Record<AnimatableProperty, number>;
  onCreateAnimation: () => void;
  onChangeAnimation: (updater: (prev: SpriteAnimation) => SpriteAnimation) => void;
  onDeleteAnimation: () => void;
  /** Called every preview frame with interpolated values, and with `null` when playback stops/resets. */
  onPreviewUpdate: (values: Partial<Record<AnimatableProperty, number>> | null) => void;
}

function createTimeline(spriteLabel: string, index: number): SpriteTimeline {
  return { id: createId('tl'), name: `${spriteLabel}${index}`, properties: [], keyframes: [], duration: 1, loop: false };
}

const SpriteAnimationPanel: React.FC<SpriteAnimationPanelProps> = ({
  spriteLabel, animation, currentValues, onCreateAnimation, onChangeAnimation, onDeleteAnimation, onPreviewUpdate,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(0);
  const playbackRef = useRef<PlaybackHandle | null>(null);

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setIsPlaying(false);
  }, []);

  // Stop playback and clear the live preview override whenever the selected sprite's animation changes/unmounts.
  useEffect(() => () => { playbackRef.current?.stop(); onPreviewUpdate(null); }, [animation?.spriteId, onPreviewUpdate]);

  if (!animation) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-secondary mb-3">No animation for {spriteLabel} yet.</p>
        <button onClick={onCreateAnimation} className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">
          + Add Animation
        </button>
      </div>
    );
  }

  const totalDuration = getTotalDuration(animation);

  const handlePlay = () => {
    if (isPlaying) { stopPlayback(); return; }
    setIsPlaying(true);
    playbackRef.current = startPlayback(
      animation,
      (values, elapsed) => { setPlayheadTime(elapsed); onPreviewUpdate(values); },
      () => { setIsPlaying(false); playbackRef.current = null; }
    );
  };

  const handleScrub = (time: number) => {
    stopPlayback();
    setPlayheadTime(time);
    onPreviewUpdate(interpolateSpriteAnimation(animation, time));
  };

  const setCombineMode = (combineMode: SpriteAnimation['combineMode']) => {
    onChangeAnimation(prev => ({ ...prev, combineMode }));
  };

  const handleAddTimeline = () => {
    const newTimeline = createTimeline(spriteLabel, animation.timelines.length);
    onChangeAnimation(prev => ({ ...prev, timelines: [...prev.timelines, newTimeline] }));
  };

  const handleRemoveTimeline = (id: string) => {
    onChangeAnimation(prev => ({ ...prev, timelines: prev.timelines.filter(t => t.id !== id) }));
  };

  const handleChangeTimeline = (id: string, updater: (prev: SpriteTimeline) => SpriteTimeline) => {
    onChangeAnimation(prev => ({ ...prev, timelines: prev.timelines.map(t => t.id === id ? updater(t) : t) }));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    onChangeAnimation(prev => {
      const timelines = [...prev.timelines];
      const target = index + direction;
      [timelines[index], timelines[target]] = [timelines[target], timelines[index]];
      return { ...prev, timelines };
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-primary">{spriteLabel}</h3>
        <button onClick={onDeleteAnimation} className="text-xs text-red-600 dark:text-red-400 hover:underline">Remove Animation</button>
      </div>

      {animation.timelines.length >= 2 && (
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input type="radio" name="combine-mode" value="parallel" checked={animation.combineMode === 'parallel'} onChange={() => setCombineMode('parallel')} />
            Parallel
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="combine-mode" value="sequential" checked={animation.combineMode === 'sequential'} onChange={() => setCombineMode('sequential')} />
            Sequential
          </label>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handlePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold w-16"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="text-xs font-mono text-secondary ml-auto">{playheadTime.toFixed(2)}s / {totalDuration.toFixed(2)}s</span>
      </div>

      <input
        type="range"
        min={0}
        max={totalDuration}
        step={0.05}
        value={Math.min(playheadTime, totalDuration)}
        onChange={(e) => handleScrub(Number(e.target.value))}
        aria-label="Playhead"
        className="w-full"
      />

      <div className="space-y-2">
        {animation.timelines.map((timeline, index) => (
          <TimelineRow
            key={timeline.id}
            timeline={timeline}
            combineMode={animation.combineMode}
            propertiesClaimedBySiblings={animation.timelines.filter((_, i) => i !== index).flatMap(t => t.properties)}
            currentValues={currentValues}
            onChangeTimeline={(updater) => handleChangeTimeline(timeline.id, updater)}
            onRemoveTimeline={() => handleRemoveTimeline(timeline.id)}
            onMoveUp={index > 0 ? () => handleMove(index, -1) : undefined}
            onMoveDown={index < animation.timelines.length - 1 ? () => handleMove(index, 1) : undefined}
          />
        ))}
      </div>

      <button onClick={handleAddTimeline} className="w-full px-3 py-1.5 rounded border border-dashed border-primary text-secondary hover:text-primary hover:border-accent text-sm font-bold">
        + Add Timeline
      </button>
    </div>
  );
};

export default SpriteAnimationPanel;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/SpriteAnimationPanel.test.tsx`
Expected: PASS (10 tests)

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit` (errors should now only remain in `SceneComposer.tsx`)
Run: `npx eslint src/components/SpriteAnimationPanel.tsx src/components/SpriteAnimationPanel.test.tsx`
Expected: zero errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/SpriteAnimationPanel.tsx src/components/SpriteAnimationPanel.test.tsx src/components/SpriteTimeline.tsx src/components/SpriteTimeline.test.tsx
git commit -m "feat: add SpriteAnimationPanel, replacing fixed-track SpriteTimeline"
```

---

### Task 7: `src/components/SceneComposer.tsx` integration

**Files:**
- Modify: `src/components/SceneComposer.tsx:11,14-15,206-207,710-716,739-740,777-778,797-824,876-887,1070-1081`

**Interfaces:**
- Consumes: `AnimatableProperty`, `SpriteAnimation`, `SpriteTimeline` (Task 1); `generateATLFromTimeline`, `transformNameFor` (Task 2); `interpolateSpriteAnimation` is not needed directly here (only `SpriteAnimationPanel` uses it); `SpriteAnimationPanel` (Task 6); `createId` (already imported).

No dedicated test file exists for `SceneComposer.tsx` today, so this task is verified via the full suite and build, not a new unit test.

- [ ] **Step 1: Update imports**

In `src/components/SceneComposer.tsx`, change line 11:

```typescript
import type { ProjectImage, ImageMetadata, SceneComposition, SceneSprite, SpriteAnimation, KeyframeTrack } from '@/types';
```

to:

```typescript
import type { ProjectImage, ImageMetadata, SceneComposition, SceneSprite, SpriteAnimation, SpriteTimeline, AnimatableProperty } from '@/types';
```

Change line 14:

```typescript
import SpriteTimeline from './SpriteTimeline';
```

to:

```typescript
import SpriteAnimationPanel from './SpriteAnimationPanel';
```

- [ ] **Step 2: Update the preview-values state type**

Change line 207 from:

```typescript
    const [timelinePreviewValues, setTimelinePreviewValues] = useState<Partial<Record<KeyframeTrack['property'], number>> | null>(null);
```

to:

```typescript
    const [timelinePreviewValues, setTimelinePreviewValues] = useState<Partial<Record<AnimatableProperty, number>> | null>(null);
```

- [ ] **Step 3: Update the animated-animation lookup filter**

Change lines 708-716 from:

```typescript
    // Timeline animations: only ones with at least one animated (2+ keyframe) track produce a
    // usable `transform`; a spriteId maps to at most one, since the UI only supports one per sprite.
    const animatedAnimationBySpriteId = useMemo(() => {
        const map = new Map<string, SpriteAnimation>();
        for (const anim of scene.animations ?? []) {
            if (anim.tracks.some(t => t.keyframes.length > 0)) map.set(anim.spriteId, anim);
        }
        return map;
    }, [scene.animations]);
```

to:

```typescript
    // Timeline animations: only ones with at least one timeline that has keyframes produce a
    // usable `transform`; a spriteId maps to at most one, since a sprite has one SpriteAnimation.
    const animatedAnimationBySpriteId = useMemo(() => {
        const map = new Map<string, SpriteAnimation>();
        for (const anim of scene.animations ?? []) {
            if (anim.timelines.some(t => t.keyframes.length > 0)) map.set(anim.spriteId, anim);
        }
        return map;
    }, [scene.animations]);
```

- [ ] **Step 4: Update the `transformNameFor` call sites**

Change line 740 from:

```typescript
            const bgAtClause = bgAnim ? ` at ${transformNameFor(bgAnim)}` : '';
```

to:

```typescript
            const bgAtClause = bgAnim ? ` at ${transformNameFor(bgAnim.spriteId)}` : '';
```

Change line 778 from:

```typescript
            const atClause = spriteAnim ? ` at ${transformNameFor(spriteAnim)}` : '';
```

to:

```typescript
            const atClause = spriteAnim ? ` at ${transformNameFor(spriteAnim.spriteId)}` : '';
```

- [ ] **Step 5: Update animation CRUD handlers**

Change lines 796-824 from:

```typescript
    // Timeline: one animation per sprite, keyed by SceneSprite.id ('background' for the background layer).
    const activeAnimation = useMemo(() => {
        if (!selectedSpriteId) return null;
        return scene.animations?.find(a => a.spriteId === selectedSpriteId) ?? null;
    }, [scene.animations, selectedSpriteId]);

    const handleCreateAnimation = useCallback(() => {
        if (!selectedSpriteId) return;
        saveUndo();
        const newAnimation: SpriteAnimation = {
            id: createId('anim'), spriteId: selectedSpriteId, name: 'Animation', duration: 1, loop: false, tracks: [],
        };
        onSceneChange(prev => ({ ...prev, animations: [...(prev.animations ?? []), newAnimation] }));
    }, [selectedSpriteId, saveUndo, onSceneChange]);

    const handleChangeAnimation = useCallback((updater: (prev: SpriteAnimation) => SpriteAnimation) => {
        if (!activeAnimation) return;
        onSceneChange(prev => ({
            ...prev,
            animations: (prev.animations ?? []).map(a => a.id === activeAnimation.id ? updater(a) : a),
        }));
    }, [activeAnimation, onSceneChange]);

    const handleDeleteAnimation = useCallback(() => {
        if (!activeAnimation) return;
        saveUndo();
        setTimelinePreviewValues(null);
        onSceneChange(prev => ({ ...prev, animations: (prev.animations ?? []).filter(a => a.id !== activeAnimation.id) }));
    }, [activeAnimation, saveUndo, onSceneChange]);
```

to:

```typescript
    // Timeline: one animation per sprite, keyed by SceneSprite.id ('background' for the background layer).
    const activeAnimation = useMemo(() => {
        if (!selectedSpriteId) return null;
        return scene.animations?.find(a => a.spriteId === selectedSpriteId) ?? null;
    }, [scene.animations, selectedSpriteId]);

    const handleCreateAnimation = useCallback(() => {
        if (!selectedSpriteId || !activeSprite) return;
        saveUndo();
        const spriteLabel = selectedSpriteId === 'background' ? 'background' : getRenpyTag(activeSprite.image);
        const starterTimeline: SpriteTimeline = {
            id: createId('tl'), name: `${spriteLabel}0`, properties: [], keyframes: [], duration: 1, loop: false,
        };
        const newAnimation: SpriteAnimation = { spriteId: selectedSpriteId, combineMode: 'parallel', timelines: [starterTimeline] };
        onSceneChange(prev => ({ ...prev, animations: [...(prev.animations ?? []), newAnimation] }));
    }, [selectedSpriteId, activeSprite, getRenpyTag, saveUndo, onSceneChange]);

    const handleChangeAnimation = useCallback((updater: (prev: SpriteAnimation) => SpriteAnimation) => {
        if (!activeAnimation) return;
        onSceneChange(prev => ({
            ...prev,
            animations: (prev.animations ?? []).map(a => a.spriteId === activeAnimation.spriteId ? updater(a) : a),
        }));
    }, [activeAnimation, onSceneChange]);

    const handleDeleteAnimation = useCallback(() => {
        if (!activeAnimation) return;
        saveUndo();
        setTimelinePreviewValues(null);
        onSceneChange(prev => ({ ...prev, animations: (prev.animations ?? []).filter(a => a.spriteId !== activeAnimation.spriteId) }));
    }, [activeAnimation, saveUndo, onSceneChange]);
```

Note: `activeSprite` (`const activeSprite = useMemo(...)`) is already declared at line 791, above this block (line 797 onward) — no reordering needed.

- [ ] **Step 6: Update the live preview merge helper's type**

Change line 876 from:

```typescript
    const withTimelinePreview = useCallback((sprite: SceneSprite, id: string): SceneSprite => {
```

The body (lines 877-886) is unchanged — it already reads `timelinePreviewValues.x`, `.y`, `.zoom`, `.alpha`, `.rotation`, `.blur`, which are the same six keys under the new `AnimatableProperty` type. Only the type annotation on `timelinePreviewValues` itself (Step 2) needed to change.

- [ ] **Step 7: Update the JSX render block**

Change lines 1069-1081 from:

```typescript
                    {activeSprite ? (
                        <SpriteTimeline
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
                    ) : (
```

to:

```typescript
                    {activeSprite ? (
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
                    ) : (
```

- [ ] **Step 8: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: zero errors, anywhere in the project.
Run: `npx eslint src/components/SceneComposer.tsx`
Expected: zero errors/warnings.

- [ ] **Step 9: Run the full test suite**

Run: `npm test -- --run`
Expected: all test files pass, including every test file touched in Tasks 2-6.

- [ ] **Step 10: Run the production build**

Run: `npm run build`
Expected: build succeeds with no new errors (the existing "chunks larger than 500kB" warning is pre-existing and unrelated).

- [ ] **Step 11: Commit**

```bash
git add src/components/SceneComposer.tsx
git commit -m "feat: wire SpriteAnimationPanel multi-timeline model into SceneComposer"
```

---

## Self-Review Notes

- **Spec coverage:** every spec section has a task — data model (Task 1), codegen (Task 2), preview interpolation (Task 3), `PoseKeyframeEditor` (Task 4), `TimelineRow` incl. property picker/conflict-disabling/backfill-drop/reorder (Task 5), `SpriteAnimationPanel` incl. combine-mode toggle/add-timeline-naming/overall playback (Task 6), `SceneComposer.tsx` integration (Task 7).
- **Type consistency:** `AnimatableProperty`, `PoseKeyframe`, `SpriteTimeline`, `SpriteAnimation` field names are identical across every task (verified by re-reading each task's Interfaces block against Task 1's definitions while writing).
- **No placeholders:** every step has complete code; the one intentionally-untested task (`PoseKeyframeEditor`, Task 4) is explicitly justified by precedent (the file it replaces, `KeyframeEditor.tsx`, also had no dedicated test file) rather than left as a gap.
