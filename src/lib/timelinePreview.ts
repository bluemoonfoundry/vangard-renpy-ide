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
import { getActiveTimelines } from './atlCodeGenerator';

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

/**
 * Sum of the active timelines' durations (sequential), or the max (parallel).
 * 0 if there are no active timelines. Mirrors `getActiveTimelines` so an
 * empty/inactive timeline (no keyframes or no properties yet, e.g. one just
 * added via '+ Add Timeline') never inflates the preview's duration with a
 * phantom pause the generated ATL doesn't have.
 */
export function getTotalDuration(anim: SpriteAnimation): number {
  const timelines = getActiveTimelines(anim);
  if (timelines.length === 0) return 0;
  return anim.combineMode === 'parallel'
    ? Math.max(...timelines.map(t => t.duration))
    : timelines.reduce((sum, t) => sum + t.duration, 0);
}

function longestTimeline(timelines: SpriteTimeline[]): SpriteTimeline {
  return timelines.reduce((max, t) => (t.duration > max.duration ? t : max));
}

/** Whether the combined preview should loop forever once it reaches `getTotalDuration(anim)`. Matches atlCodeGenerator's `honorLoop`, which only honors loop on the last *active* (keyframed + property-bearing) sequential timeline. */
function overallLoops(anim: SpriteAnimation): boolean {
  const active = getActiveTimelines(anim);
  if (active.length === 0) return false;
  return anim.combineMode === 'parallel' ? longestTimeline(active).loop : active[active.length - 1].loop;
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
  const timelines = getActiveTimelines(anim);
  if (timelines.length === 0) return {};

  if (anim.combineMode === 'parallel') {
    const result: Partial<Record<AnimatableProperty, number>> = {};
    for (const timeline of timelines) {
      Object.assign(result, interpolateTimeline(timeline, time));
    }
    return result;
  }

  let offset = 0;
  let activeIndex = 0;
  let localTime = time;
  for (let i = 0; i < timelines.length; i++) {
    const timeline = timelines[i];
    if (time < offset + timeline.duration || i === timelines.length - 1) {
      activeIndex = i;
      localTime = time - offset;
      break;
    }
    offset += timeline.duration;
  }

  const result: Partial<Record<AnimatableProperty, number>> = {};
  for (let i = 0; i < activeIndex; i++) {
    const priorTimeline = timelines[i];
    const lastKeyframe = [...priorTimeline.keyframes].sort((a, b) => a.time - b.time).at(-1)!;
    Object.assign(result, lastKeyframe.values);
  }
  Object.assign(result, interpolateTimeline(timelines[activeIndex], localTime));
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
