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

  it('excludes a timeline with keyframes but zero selected properties (falls back to pass if it is the only one)', () => {
    const brokenTimeline = timeline({ properties: [], keyframes: [{ id: 'k1', time: 0, values: {}, easing: 'linear' }, { id: 'k2', time: 1, values: {}, easing: 'linear' }] });
    expect(generateATLFromTimeline(anim({ timelines: [brokenTimeline] }))).toBe('transform eileen_animation:\n    pass\n');
  });

  it('excludes a timeline with keyframes but zero selected properties even alongside a valid one', () => {
    const brokenTimeline = timeline({ id: 'broken', properties: [], keyframes: [{ id: 'k1', time: 0, values: {}, easing: 'linear' }, { id: 'k2', time: 1, values: {}, easing: 'linear' }] });
    const validTimeline = timeline({ id: 'valid', properties: ['alpha'], keyframes: [{ id: 'k3', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k4', time: 1, values: { alpha: 1 }, easing: 'linear' }] });
    expect(generateATLFromTimeline(anim({ timelines: [brokenTimeline, validTimeline] }))).toBe('transform eileen_animation:\n    alpha 0\n    linear 1 alpha 1\n');
  });

  it('does not repeat mid-sequence when a non-last sequential timeline loops (would restart the whole block)', () => {
    const first = timeline({ id: 't1', loop: true, properties: ['alpha'], keyframes: [{ id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 1 }, easing: 'linear' }] });
    const second = timeline({ id: 't2', loop: false, properties: ['zoom'], keyframes: [{ id: 'k3', time: 0, values: { zoom: 1 }, easing: 'linear' }, { id: 'k4', time: 1, values: { zoom: 2 }, easing: 'linear' }] });
    const code = generateATLFromTimeline(anim({ combineMode: 'sequential', timelines: [first, second] }));
    expect(code).not.toContain('repeat');
    expect(code).toBe('transform eileen_animation:\n    alpha 0\n    linear 1 alpha 1\n    zoom 1\n    linear 1 zoom 2\n');
  });

  it('honors loop on the last sequential timeline, trailing the whole output', () => {
    const first = timeline({ id: 't1', loop: false, properties: ['alpha'], keyframes: [{ id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 1 }, easing: 'linear' }] });
    const second = timeline({ id: 't2', loop: true, properties: ['zoom'], keyframes: [{ id: 'k3', time: 0, values: { zoom: 1 }, easing: 'linear' }, { id: 'k4', time: 1, values: { zoom: 2 }, easing: 'linear' }] });
    const code = generateATLFromTimeline(anim({ combineMode: 'sequential', timelines: [first, second] }));
    expect(code).toBe('transform eileen_animation:\n    alpha 0\n    linear 1 alpha 1\n    zoom 1\n    linear 1 zoom 2\n    repeat\n');
  });

  it('composes matrix-factor properties into one matrixcolor token, placed last, alongside a simple property', () => {
    const t = timeline({
      properties: ['alpha', 'saturation'],
      keyframes: [
        { id: 'k1', time: 0, values: { alpha: 0, saturation: 1 }, easing: 'linear' },
        { id: 'k2', time: 1, values: { alpha: 1, saturation: 1.5 }, easing: 'linear' },
      ],
    });
    expect(generateATLFromTimeline(anim({ timelines: [t] }))).toBe(
      'transform eileen_animation:\n    alpha 0\n    matrixcolor SaturationMatrix(1.00)\n    linear 1 alpha 1 matrixcolor SaturationMatrix(1.50)\n'
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
      'transform eileen_animation:\n    matrixcolor SaturationMatrix(1.00) * ContrastMatrix(1.00) * InvertMatrix(0.00)\n    easein 1 matrixcolor SaturationMatrix(2.00) * ContrastMatrix(0.50) * InvertMatrix(1.00)\n'
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
      'transform eileen_animation:\n    matrixcolor BrightnessMatrix(0.00) * InvertMatrix(0.00)\n    linear 1 matrixcolor BrightnessMatrix(0.50) * InvertMatrix(1.00)\n'
    );
  });
});
