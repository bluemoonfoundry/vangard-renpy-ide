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

  it('excludes inactive timelines (no keyframes yet) from the sum in sequential mode, matching generated ATL', () => {
    const empty: SpriteTimeline = { id: 't-empty', name: 'New', properties: [], duration: 1, loop: false, keyframes: [] };
    const anim: SpriteAnimation = { spriteId: 's', combineMode: 'sequential', timelines: [{ ...xTimeline, duration: 2 }, empty] };
    expect(getTotalDuration(anim)).toBe(2);
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

  it('holds forward the true final pose of an earlier LOOPING timeline, not its first keyframe', () => {
    const loopingFirst: SpriteTimeline = { id: 't1', name: 'Loop', properties: ['alpha'], duration: 1, loop: true, keyframes: [{ id: 'k1', time: 0, values: { alpha: 0.2 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 0.9 }, easing: 'linear' }] };
    const second: SpriteTimeline = { id: 't2', name: 'Second', properties: ['zoom'], duration: 1, loop: false, keyframes: [{ id: 'k1', time: 0, values: { zoom: 1 }, easing: 'linear' }, { id: 'k2', time: 1, values: { zoom: 2 }, easing: 'linear' }] };
    const anim: SpriteAnimation = { spriteId: 's', combineMode: 'sequential', timelines: [loopingFirst, second] };
    // At t=1.5, `second` is active; `loopingFirst` should hold at its true final value (0.9), not wrap back to its first keyframe's 0.2
    expect(interpolateSpriteAnimation(anim, 1.5).alpha).toBe(0.9);
  });

  it('returns an empty object for a sprite animation with no timelines', () => {
    expect(interpolateSpriteAnimation({ spriteId: 's', combineMode: 'parallel', timelines: [] }, 1)).toEqual({});
  });

  it('skips an inactive middle timeline (no keyframes) rather than treating it as a pause, matching generated ATL', () => {
    const first: SpriteTimeline = { id: 't1', name: 'First', properties: ['x'], duration: 1, loop: false, keyframes: [{ id: 'k1', time: 0, values: { x: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { x: 1 }, easing: 'linear' }] };
    const inactive: SpriteTimeline = { id: 't2', name: 'New', properties: [], duration: 1, loop: false, keyframes: [] };
    const third: SpriteTimeline = { id: 't3', name: 'Third', properties: ['x'], duration: 1, loop: false, keyframes: [{ id: 'k1', time: 0, values: { x: 1 }, easing: 'linear' }, { id: 'k2', time: 1, values: { x: 0 }, easing: 'linear' }] };
    const anim: SpriteAnimation = { spriteId: 's', combineMode: 'sequential', timelines: [first, inactive, third] };
    // Without the inactive timeline's phantom 1s pause, `third` starts right after `first` at t=1, not t=2
    expect(interpolateSpriteAnimation(anim, 1.5).x).toBeCloseTo(0.5, 5);
  });
});
