/**
 * @file spriteCurrentValues.ts
 * @description Reads a SceneSprite's current animatable-property values,
 * used as the defaults for new/backfilled Timeline Editor keyframes.
 * Extracted as a pure, independently-testable function since
 * SceneComposer.tsx (its only caller) has no test file of its own.
 */
import type { AnimatableProperty, SceneSprite } from '@/types';

export function currentValuesForSprite(sprite: SceneSprite): Record<AnimatableProperty, number> {
  return {
    x: sprite.x,
    y: sprite.y,
    zoom: sprite.zoom,
    alpha: sprite.alpha,
    rotation: sprite.rotation,
    blur: sprite.blur,
    saturation: sprite.saturation ?? 1.0,
    brightness: sprite.brightness ?? 0,
    contrast: sprite.contrast ?? 1.0,
    invert: sprite.invert ?? 0,
  };
}
