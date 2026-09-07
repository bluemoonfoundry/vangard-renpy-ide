import { describe, it, expect } from 'vitest';
import { currentValuesForSprite } from './spriteCurrentValues';
import type { SceneSprite } from '@/types';

function sprite(overrides: Partial<SceneSprite> = {}): SceneSprite {
  return {
    id: 's1',
    image: { filePath: 'x.png', fileName: 'x.png', isInProject: true, fileHandle: null, dataUrl: '' },
    x: 0.5, y: 0.5, zoom: 1, zIndex: 1, flipH: false, flipV: false, rotation: 0, alpha: 1, blur: 0,
    ...overrides,
  };
}

describe('currentValuesForSprite', () => {
  it('reads the six simple properties directly', () => {
    const result = currentValuesForSprite(sprite({ x: 0.2, y: 0.8, zoom: 1.5, alpha: 0.5, rotation: 45, blur: 3 }));
    expect(result).toMatchObject({ x: 0.2, y: 0.8, zoom: 1.5, alpha: 0.5, rotation: 45, blur: 3 });
  });

  it('falls back to neutral defaults for saturation/brightness/contrast/invert when unset', () => {
    const result = currentValuesForSprite(sprite());
    expect(result).toMatchObject({ saturation: 1, brightness: 0, contrast: 1, invert: 0 });
  });

  it('reads explicit saturation/brightness/contrast/invert values when set', () => {
    const result = currentValuesForSprite(sprite({ saturation: 1.8, brightness: 0.4, contrast: 0.6, invert: 1 }));
    expect(result).toMatchObject({ saturation: 1.8, brightness: 0.4, contrast: 0.6, invert: 1 });
  });
});
