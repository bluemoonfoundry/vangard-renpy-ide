import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SceneSpriteProperties from './SceneSpriteProperties';
import type { SceneSprite, ProjectImage } from '@/types';

const image: ProjectImage = {
  filePath: 'game/images/eileen.png',
  fileName: 'eileen.png',
  fileHandle: null,
  isInProject: true,
};

function makeSprite(overrides: Partial<SceneSprite> = {}): SceneSprite {
  return {
    id: 's1', image, x: 0.5, y: 0.5, zoom: 1, zIndex: 1,
    flipH: false, flipV: false, rotation: 0, alpha: 1, blur: 0,
    ...overrides,
  };
}

function renderProps(sprite: SceneSprite, hasAnimatedMatrixFactor: boolean) {
  return render(
    <SceneSpriteProperties
      activeSprite={sprite}
      selectedSpriteId={sprite.id}
      onUpdate={vi.fn()}
      onRangeSliderStart={vi.fn()}
      onRangeSliderEnd={vi.fn()}
      hasAnimatedMatrixFactor={hasAnimatedMatrixFactor}
    />
  );
}

function getColorModeSelect(): HTMLSelectElement {
  return screen.getByText('Mode').parentElement!.querySelector('select') as HTMLSelectElement;
}

function rangeInputFor(label: string): HTMLElement | null | undefined {
  return screen.getByText(label).closest('div')?.parentElement?.querySelector('input[type="range"]');
}

describe('SceneSpriteProperties matrix-factor / static-tint exclusivity', () => {
  it('leaves the static color controls enabled when nothing is animating a matrix-factor property', () => {
    renderProps(makeSprite(), false);
    const select = getColorModeSelect();
    const tintOption = Array.from(select.options).find(o => o.value === 'tint')!;
    expect(tintOption.disabled).toBe(false);
    expect(rangeInputFor('Brightness')).not.toBeDisabled();
  });

  it('disables Tint/Colorize modes and the brightness/contrast/invert sliders when a timeline already animates a matrix-factor property', () => {
    renderProps(makeSprite(), true);
    const select = getColorModeSelect();
    const tintOption = Array.from(select.options).find(o => o.value === 'tint')!;
    const colorizeOption = Array.from(select.options).find(o => o.value === 'colorize')!;
    expect(tintOption.disabled).toBe(true);
    expect(colorizeOption.disabled).toBe(true);

    expect(rangeInputFor('Brightness')).toBeDisabled();
    expect(rangeInputFor('Contrast')).toBeDisabled();
    expect(rangeInputFor('Invert')).toBeDisabled();
  });

  it('disables the saturation slider once a tint is already active and a matrix-factor timeline exists', () => {
    renderProps(makeSprite({ colorMode: 'tint', tintColor: '#ff0000' }), true);
    expect(rangeInputFor('Saturation')).toBeDisabled();
  });
});
