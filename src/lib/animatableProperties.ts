/**
 * @file animatableProperties.ts
 * @description Canonical ordering and display labels for `AnimatableProperty`,
 * shared by every UI/codegen surface that lists or names the ten sprite
 * properties (position, matrix-factor tints, etc.). Single source of truth --
 * previously triplicated across PoseKeyframeEditor.tsx, TimelineRow.tsx, and
 * atlCodeGenerator.ts with no compiler enforcement of consistency.
 */
import type { AnimatableProperty } from '@/types';

/** Canonical property order for pickers and generated ATL lines, regardless of selection order. */
export const PROPERTY_ORDER: AnimatableProperty[] = ['x', 'y', 'zoom', 'alpha', 'rotation', 'blur', 'saturation', 'brightness', 'contrast', 'invert'];

export const PROPERTY_LABEL: Record<AnimatableProperty, string> = {
  x: 'X Position',
  y: 'Y Position',
  zoom: 'Zoom',
  alpha: 'Alpha',
  rotation: 'Rotation',
  blur: 'Blur',
  saturation: 'Saturation',
  brightness: 'Brightness',
  contrast: 'Contrast',
  invert: 'Invert',
};
