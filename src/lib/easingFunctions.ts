/**
 * @file easingFunctions.ts
 * @description Pure JS implementations of Ren'Py's standard ATL easing/warp
 * functions, shared by the timeline preview's interpolation engine
 * (`timelinePreview.ts`) and the generated ATL code (`atlCodeGenerator.ts`,
 * which just needs the matching ATL keyword).
 */
import type { EasingFunction } from '@/types';

/** `t` and the return value are both in [0, 1]. */
export type EasingFn = (t: number) => number;

const EASING_FUNCTIONS: Record<EasingFunction, EasingFn> = {
  linear: (t) => t,
  // Ren'Py's "ease" is a half-sine ease-in-out.
  ease: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  // easein: slow start, accelerating (Ren'Py: "starts slow, ends fast").
  easein: (t) => 1 - Math.cos((t * Math.PI) / 2),
  // easeout: fast start, decelerating into place (Ren'Py: "starts fast, ends slow").
  easeout: (t) => Math.sin((t * Math.PI) / 2),
  easein_quad: (t) => t * t,
  easeout_quad: (t) => 1 - (1 - t) * (1 - t),
  easeinout_quad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

/** Applies the named easing to `t` (clamped to [0, 1]). */
export function applyEasing(t: number, easing: EasingFunction): number {
  const clamped = Math.min(1, Math.max(0, t));
  return EASING_FUNCTIONS[easing](clamped);
}

export const EASING_OPTIONS: EasingFunction[] = Object.keys(EASING_FUNCTIONS) as EasingFunction[];
