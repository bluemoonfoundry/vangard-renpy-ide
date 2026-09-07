import { describe, it, expect } from 'vitest';
import { applyEasing, EASING_OPTIONS } from './easingFunctions';
import type { EasingFunction } from '@/types';

describe('applyEasing', () => {
  it('every easing returns 0 at t=0 and 1 at t=1', () => {
    for (const easing of EASING_OPTIONS) {
      expect(applyEasing(0, easing)).toBeCloseTo(0, 5);
      expect(applyEasing(1, easing)).toBeCloseTo(1, 5);
    }
  });

  it('linear is the identity function', () => {
    expect(applyEasing(0.3, 'linear')).toBeCloseTo(0.3, 5);
    expect(applyEasing(0.75, 'linear')).toBeCloseTo(0.75, 5);
  });

  it('easein starts slow (below the linear diagonal) at t=0.5', () => {
    expect(applyEasing(0.5, 'easein')).toBeLessThan(0.5);
  });

  it('easeout starts fast (above the linear diagonal) at t=0.5', () => {
    expect(applyEasing(0.5, 'easeout')).toBeGreaterThan(0.5);
  });

  it('easeinout_quad is symmetric around t=0.5', () => {
    const before = applyEasing(0.3, 'easeinout_quad');
    const after = applyEasing(0.7, 'easeinout_quad');
    expect(before).toBeCloseTo(1 - after, 5);
  });

  it('every easing is monotonically non-decreasing over [0, 1]', () => {
    for (const easing of EASING_OPTIONS) {
      let prev = -Infinity;
      for (let t = 0; t <= 1; t += 0.05) {
        const v = applyEasing(t, easing);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });

  it('clamps out-of-range t to [0, 1]', () => {
    expect(applyEasing(-0.5, 'linear' as EasingFunction)).toBe(0);
    expect(applyEasing(1.5, 'linear' as EasingFunction)).toBe(1);
  });
});
