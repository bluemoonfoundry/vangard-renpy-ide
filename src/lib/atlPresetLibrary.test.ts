import { describe, it, expect } from 'vitest';
import { ATL_PRESETS, instantiatePreset } from './atlPresetLibrary';
import type { ATLPreset } from '@/types';

describe('ATL_PRESETS', () => {
  it('has between 15 and 20 presets', () => {
    expect(ATL_PRESETS.length).toBeGreaterThanOrEqual(15);
    expect(ATL_PRESETS.length).toBeLessThanOrEqual(20);
  });

  it('has unique titles', () => {
    const titles = ATL_PRESETS.map(p => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('every preset has a non-empty code field pre-filled from its defaults', () => {
    for (const preset of ATL_PRESETS) {
      expect(preset.code.length).toBeGreaterThan(0);
      expect(preset.code).not.toMatch(/\{[a-zA-Z_]+\}/); // no leftover placeholders
    }
  });

  it('every {placeholder} in atlTemplate has a matching parameter', () => {
    for (const preset of ATL_PRESETS) {
      const placeholders = [...preset.atlTemplate.matchAll(/\{([a-zA-Z_]+)\}/g)].map(m => m[1]);
      const paramNames = new Set(preset.parameters.map(p => p.name));
      for (const name of placeholders) {
        expect(paramNames.has(name), `${preset.title}: {${name}} has no matching parameter`).toBe(true);
      }
    }
  });

  it('every parameter is used at least once in its atlTemplate', () => {
    for (const preset of ATL_PRESETS) {
      for (const param of preset.parameters) {
        expect(preset.atlTemplate.includes(`{${param.name}}`), `${preset.title}: unused parameter ${param.name}`).toBe(true);
      }
    }
  });
});

describe('instantiatePreset', () => {
  const shake = ATL_PRESETS.find(p => p.title === 'Shake') as ATLPreset;

  it('substitutes every placeholder with the given value', () => {
    const result = instantiatePreset(shake, { duration: 0.2, intensity: 15, repeat_count: 5 });
    expect(result).toBe('parallel:\n    linear 0.2 xoffset 15\n    linear 0.2 xoffset -15\nrepeat 5');
  });

  it('falls back to defaultValue for omitted params', () => {
    const result = instantiatePreset(shake, {});
    expect(result).toBe(shake.code);
  });

  it('handles the edge value 0', () => {
    const result = instantiatePreset(shake, { duration: 0.05, intensity: 5, repeat_count: 0 });
    // repeat_count clamps up to its min (1)
    expect(result).toContain('repeat 1');
  });

  it('handles the edge value 1', () => {
    const spin = ATL_PRESETS.find(p => p.title === 'Spin') as ATLPreset;
    const result = instantiatePreset(spin, { duration: 1, repeat_count: 1 });
    expect(result).toBe('rotate 0\nlinear 1 rotate 360\nrepeat 1');
  });

  it('handles negative-offset templates correctly', () => {
    const wobble = ATL_PRESETS.find(p => p.title === 'Wobble') as ATLPreset;
    const result = instantiatePreset(wobble, { duration: 0.2, angle: 10, repeat_count: 2 });
    expect(result).toContain('rotate 10');
    expect(result).toContain('rotate -10');
  });

  it('clamps numeric values above max down to max', () => {
    const result = instantiatePreset(shake, { duration: 0.2, intensity: 999, repeat_count: 3 });
    expect(result).toContain('xoffset 50'); // intensity max is 50
  });

  it('clamps numeric values below min up to min', () => {
    const result = instantiatePreset(shake, { duration: 0.2, intensity: -100, repeat_count: 3 });
    expect(result).toContain('xoffset 5'); // intensity min is 5
  });

  it('passes string values (e.g. easing options) through unchanged', () => {
    const fadeIn = ATL_PRESETS.find(p => p.title === 'Fade In') as ATLPreset;
    const result = instantiatePreset(fadeIn, { duration: 0.5, easing: 'easein' });
    expect(result).toBe('alpha 0.0\neasein 0.5 alpha 1.0');
  });
});
