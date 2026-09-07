import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import PoseKeyframeEditor, { VALUE_RANGE_BY_PROPERTY } from './PoseKeyframeEditor';
import type { AnimatableProperty, PoseKeyframe } from '@/types';

function keyframe(overrides: Partial<PoseKeyframe> = {}): PoseKeyframe {
  return { id: 'kf-1', time: 1, values: { alpha: 0.5 }, easing: 'linear', ...overrides };
}

function renderEditor(overrides: Partial<Parameters<typeof PoseKeyframeEditor>[0]> = {}) {
  const onSave = vi.fn();
  const onDelete = vi.fn();
  const onClose = vi.fn();
  const props = {
    keyframe: keyframe(),
    properties: ['alpha'] as AnimatableProperty[],
    duration: 2,
    isFirstKeyframe: false,
    onSave,
    onDelete,
    onClose,
    ...overrides,
  };
  return { ...render(<PoseKeyframeEditor {...props} />), props: { ...props, onSave: onSave as Mock, onDelete: onDelete as Mock, onClose: onClose as Mock } };
}

describe('PoseKeyframeEditor', () => {
  it('renders a slider for every selected property, in canonical order', () => {
    renderEditor({ properties: ['saturation', 'alpha', 'x'] });
    const labels = screen.getAllByText(/X Position|Alpha|Saturation/).map(el => el.textContent);
    expect(labels).toEqual(['X Position', 'Alpha', 'Saturation']);
  });

  it('shows the easing selector unless this is the first keyframe', () => {
    renderEditor({ isFirstKeyframe: false });
    expect(screen.getByLabelText(/Easing/)).toBeInTheDocument();
  });

  it('hides the easing selector for the first keyframe', () => {
    renderEditor({ isFirstKeyframe: true });
    expect(screen.queryByLabelText(/Easing/)).not.toBeInTheDocument();
  });

  it('Save clamps each property value to its VALUE_RANGE_BY_PROPERTY bounds', () => {
    const { props } = renderEditor({
      properties: ['zoom'],
      keyframe: keyframe({ values: { zoom: 999 } }),
    });
    fireEvent.click(screen.getByText('Save'));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    const saved = props.onSave.mock.calls[0][0] as PoseKeyframe;
    expect(saved.values.zoom).toBe(VALUE_RANGE_BY_PROPERTY.zoom.max);
  });

  it('Save clamps time to [0, duration]', () => {
    const { props } = renderEditor({ duration: 2, keyframe: keyframe({ time: 1 }) });
    fireEvent.change(screen.getByLabelText(/Time/), { target: { value: '50' } });
    fireEvent.click(screen.getByText('Save'));
    const saved = props.onSave.mock.calls[0][0] as PoseKeyframe;
    expect(saved.time).toBe(2);
  });

  it('Save carries the selected easing through', () => {
    const { props } = renderEditor({ isFirstKeyframe: false });
    fireEvent.change(screen.getByLabelText(/Easing/), { target: { value: 'easein' } });
    fireEvent.click(screen.getByText('Save'));
    const saved = props.onSave.mock.calls[0][0] as PoseKeyframe;
    expect(saved.easing).toBe('easein');
  });

  it('Delete calls onDelete after confirming', () => {
    const { props } = renderEditor();
    fireEvent.click(screen.getByText('Delete'));
    const confirmButtons = screen.getAllByText('Delete');
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it('Cancel and the close button both call onClose without saving', () => {
    const { props } = renderEditor();
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('defaults a property missing from keyframe.values to 0 in the displayed slider', () => {
    renderEditor({ properties: ['alpha', 'zoom'], keyframe: keyframe({ values: { alpha: 0.5 } }) });
    expect(document.getElementById('pkf-value-zoom')).toHaveValue('0');
  });
});
