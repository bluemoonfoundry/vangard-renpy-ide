/**
 * @file atlCodeGenerator.ts
 * @description Generates one-way ATL `transform` blocks from a sprite's
 * `SpriteAnimation` (keyframes -> code only; there is no parser and no
 * round-trip -- see the TODO(#38) note in SceneComposer.tsx). Used by
 * `SceneComposer.tsx` to append transform blocks to its generated scene code
 * and to name the `at <transform>` clause on the animated sprite's `show` line.
 */
import type { AnimatableProperty, SpriteAnimation, SpriteTimeline } from '@/types';
import { PROPERTY_ORDER } from '@/lib/animatableProperties';

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
 *
 * Note: Ren'Py's `matrixcolor` interpolates the composed PRODUCT matrix
 * entry-wise between keyframes, not each factor independently -- so the
 * generated ATL's blend of e.g. SaturationMatrix(...) * ContrastMatrix(...)
 * over time is not guaranteed to numerically match this app's own
 * per-property linear preview in timelinePreview.ts. Both are smooth and
 * visually plausible, just not identical curves.
 */
const MATRIX_FACTOR_CONSTRUCTOR: Partial<Record<AnimatableProperty, (value: number) => string>> = {
  saturation: (v) => `SaturationMatrix(${formatMatrixValue(v)})`,
  brightness: (v) => `BrightnessMatrix(${formatMatrixValue(v)})`,
  contrast: (v) => `ContrastMatrix(${formatMatrixValue(v)})`,
  invert: (v) => `InvertMatrix(${formatMatrixValue(v)})`,
};

/** Neutral (identity) value per matrix-factor property, used as a defensive fallback if a keyframe is ever missing a value it should have. */
const MATRIX_FACTOR_NEUTRAL_VALUE: Partial<Record<AnimatableProperty, number>> = {
  saturation: 1,
  brightness: 0,
  contrast: 1,
  invert: 0,
};

/**
 * The four properties that collapse into one shared `matrixcolor` ATL token
 * instead of getting their own (see MATRIX_FACTOR_CONSTRUCTOR above).
 * Exported so the UI can treat them as a mutually-exclusive group across a
 * sprite's sibling timelines -- splitting them across timelines still only
 * produces one matrixcolor slot per transform, so unlike simple properties
 * they can't be safely divided between timelines even when combined
 * sequentially (a later timeline's matrixcolor assignment replaces an
 * earlier one's rather than combining with it).
 */
export const MATRIX_FACTOR_PROPERTIES: AnimatableProperty[] = ['saturation', 'brightness', 'contrast', 'invert'];

/** A valid Ren'Py transform name for the sprite's (single) animation, e.g. `eileen_animation`. */
export function transformNameFor(spriteId: string): string {
  const slug = spriteId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'sprite';
  return `${slug}_animation`;
}

function formatValue(value: number): string {
  return Number(value.toFixed(3)).toString();
}

/** Matches SceneComposer.tsx's spriteEffectCode() formatting for the same matrix-factor constructors, so animated and static matrixcolor expressions are visually consistent in generated code. */
function formatMatrixValue(value: number): string {
  return value.toFixed(2);
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
    const value = values[property] ?? MATRIX_FACTOR_NEUTRAL_VALUE[property] ?? 0;
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
 * The timelines that actually contribute to generated ATL (have both
 * keyframes and at least one selected property) -- everything else is
 * skipped by `generateATLFromTimeline`. Exported so the UI (canLoop) and the
 * live preview (overallLoops) can agree with codegen's `honorLoop` on which
 * timeline is "last" in sequential mode, rather than each independently
 * assuming it's the last element of the full `timelines` array.
 */
export function getActiveTimelines(anim: SpriteAnimation): SpriteTimeline[] {
  return (anim.timelines ?? []).filter(t => t.keyframes.length > 0 && t.properties.length > 0);
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
  const active = getActiveTimelines(anim);

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
