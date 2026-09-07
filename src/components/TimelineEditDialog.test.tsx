import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import TimelineEditDialog from './TimelineEditDialog';
import type { AnimatableProperty, SpriteTimeline } from '@/types';

const currentValues = { x: 0.5, y: 0.5, zoom: 1, alpha: 1, rotation: 0, blur: 0, saturation: 1, brightness: 0, contrast: 1, invert: 0 };

function emptyTimeline(): SpriteTimeline {
  return { id: 't1', name: 'bob0', properties: [], keyframes: [], duration: 2, loop: false };
}

function alphaTimeline(): SpriteTimeline {
  return { id: 't1', name: 'bob0', properties: ['alpha'], keyframes: [{ id: 'kf-1', time: 1, values: { alpha: 0.5 }, easing: 'linear' }], duration: 2, loop: false };
}

function renderDialog(overrides: Partial<Parameters<typeof TimelineEditDialog>[0]> = {}) {
  const onChangeTimeline = vi.fn();
  const onClose = vi.fn();
  const props = {
    timeline: emptyTimeline(),
    propertiesClaimedBySiblings: [] as AnimatableProperty[],
    combineMode: 'parallel' as const,
    canLoop: true,
    hasStaticTint: false,
    currentValues,
    onChangeTimeline,
    onClose,
    ...overrides,
  };
  return { ...render(<TimelineEditDialog {...props} />), props: { ...props, onChangeTimeline: onChangeTimeline as Mock, onClose: onClose as Mock } };
}

describe('TimelineEditDialog', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 200, bottom: 20, width: 200, height: 20, x: 0, y: 0, toJSON: () => {},
    } as DOMRect);
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows a placeholder and no ruler while no properties are selected', () => {
    renderDialog();
    expect(screen.getByText('Pick at least one property to start keyframing')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add keyframe/ })).not.toBeInTheDocument();
  });

  it('renders the timeline name', () => {
    renderDialog();
    expect(screen.getByDisplayValue('bob0')).toBeInTheDocument();
  });

  it('renaming calls onChangeTimeline with the new name', () => {
    const { props } = renderDialog();
    fireEvent.change(screen.getByDisplayValue('bob0'), { target: { value: 'Entrance' } });
    const updater = props.onChangeTimeline.mock.calls[0][0];
    expect(updater(emptyTimeline()).name).toBe('Entrance');
  });

  it('checking a property adds it and backfills existing keyframes with the current value', () => {
    const { props } = renderDialog({ timeline: alphaTimeline() });
    fireEvent.click(screen.getByLabelText('Zoom'));
    const updater = props.onChangeTimeline.mock.calls[0][0];
    const result = updater(alphaTimeline());
    expect(result.properties).toEqual(['alpha', 'zoom']);
    expect(result.keyframes[0].values).toEqual({ alpha: 0.5, zoom: 1 });
  });

  it('unchecking a property removes it and drops its value from existing keyframes', () => {
    const withTwoProps: SpriteTimeline = { ...alphaTimeline(), properties: ['alpha', 'zoom'], keyframes: [{ id: 'kf-1', time: 1, values: { alpha: 0.5, zoom: 2 }, easing: 'linear' }] };
    const { props } = renderDialog({ timeline: withTwoProps });
    fireEvent.click(screen.getByLabelText('Zoom'));
    const updater = props.onChangeTimeline.mock.calls[0][0];
    const result = updater(withTwoProps);
    expect(result.properties).toEqual(['alpha']);
    expect(result.keyframes[0].values).toEqual({ alpha: 0.5 });
  });

  it('disables a property claimed by a sibling timeline in parallel mode', () => {
    renderDialog({ combineMode: 'parallel', propertiesClaimedBySiblings: ['zoom'] });
    expect(screen.getByLabelText('Zoom')).toBeDisabled();
  });

  it('does not disable any property in sequential mode, even if claimed by a sibling', () => {
    renderDialog({ combineMode: 'sequential', propertiesClaimedBySiblings: ['zoom'] });
    expect(screen.getByLabelText('Zoom')).not.toBeDisabled();
  });

  it('does not disable a property already selected by this timeline itself', () => {
    renderDialog({ timeline: alphaTimeline(), combineMode: 'parallel', propertiesClaimedBySiblings: ['zoom'] });
    expect(screen.getByLabelText('Alpha')).not.toBeDisabled();
  });

  it('adds a keyframe at the clicked time with the current values, and opens the editor once re-rendered with it', async () => {
    const withOneProp: SpriteTimeline = { ...emptyTimeline(), properties: ['alpha'] };
    const onChangeTimeline = vi.fn();
    const { rerender } = render(
      <TimelineEditDialog timeline={withOneProp} propertiesClaimedBySiblings={[]} combineMode="parallel" canLoop={true} hasStaticTint={false} currentValues={currentValues} onChangeTimeline={onChangeTimeline} onClose={() => {}} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add keyframe' }), { clientX: 100 }); // 100/200 * 2s = 1.0s

    const updater = onChangeTimeline.mock.calls[0][0];
    const result = updater(withOneProp);
    expect(result.keyframes).toHaveLength(1);
    expect(result.keyframes[0].time).toBeCloseTo(1.0, 2);
    expect(result.keyframes[0].values).toEqual({ alpha: 1 });

    rerender(
      <TimelineEditDialog timeline={result} propertiesClaimedBySiblings={[]} combineMode="parallel" canLoop={true} hasStaticTint={false} currentValues={currentValues} onChangeTimeline={onChangeTimeline} onClose={() => {}} />
    );
    expect(await screen.findByRole('heading', { name: 'Keyframe' })).toBeInTheDocument();
  });

  it('opens the keyframe editor when a dot is clicked, and deletes it on Delete after confirming', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog({ timeline: alphaTimeline() });

    await user.click(screen.getByRole('button', { name: /keyframe at 1.00s/ }));
    const dialog = screen.getByRole('heading', { name: 'Keyframe' }).closest('[role="dialog"]') as HTMLElement;
    expect(within(dialog).getByRole('heading', { name: 'Keyframe' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    const confirmDialog = screen.getByRole('heading', { name: 'Delete Keyframe' }).closest('[role="dialog"]') as HTMLElement;
    await user.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));

    const updater = props.onChangeTimeline.mock.calls[0][0];
    expect(updater(alphaTimeline()).keyframes).toHaveLength(0);
  });

  it('repositions a keyframe on pointer drag', () => {
    const { props } = renderDialog({ timeline: alphaTimeline() });
    const dot = screen.getByRole('button', { name: /keyframe at 1.00s/ });
    Object.defineProperty(dot, 'setPointerCapture', { value: vi.fn() });
    Object.defineProperty(dot, 'hasPointerCapture', { value: vi.fn(() => true) });
    Object.defineProperty(dot, 'releasePointerCapture', { value: vi.fn() });

    fireEvent.pointerDown(dot, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(dot, { pointerId: 1, clientX: 150 }); // 150/200 * 2s = 1.5s

    const updater = props.onChangeTimeline.mock.calls.at(-1)![0];
    expect(updater(alphaTimeline()).keyframes[0].time).toBeCloseTo(1.5, 2);

    fireEvent.pointerUp(dot, { pointerId: 1 });
  });

  it('does not reopen the editor when the click following a drag is the synthetic post-drag click', () => {
    renderDialog({ timeline: alphaTimeline() });
    const dot = screen.getByRole('button', { name: /keyframe at 1.00s/ });
    Object.defineProperty(dot, 'setPointerCapture', { value: vi.fn() });
    Object.defineProperty(dot, 'hasPointerCapture', { value: vi.fn(() => true) });
    Object.defineProperty(dot, 'releasePointerCapture', { value: vi.fn() });

    fireEvent.pointerDown(dot, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(dot, { pointerId: 1, clientX: 150 }); // actually dragged past the threshold
    fireEvent.pointerUp(dot, { pointerId: 1 });
    fireEvent.click(dot); // the synthetic click browsers fire after a drag's pointerup

    expect(screen.queryByRole('heading', { name: 'Keyframe' })).not.toBeInTheDocument();
  });

  it('still opens the editor on a plain click with no preceding drag movement', async () => {
    const user = userEvent.setup();
    renderDialog({ timeline: alphaTimeline() });
    await user.click(screen.getByRole('button', { name: /keyframe at 1.00s/ }));
    expect(screen.getByRole('heading', { name: 'Keyframe' })).toBeInTheDocument();
  });

  it('disables the Loop checkbox when canLoop is false, and enables it when true', () => {
    const { rerender } = renderDialog({ canLoop: false });
    expect(screen.getByLabelText('Loop')).toBeDisabled();

    rerender(
      <TimelineEditDialog
        timeline={emptyTimeline()}
        propertiesClaimedBySiblings={[]}
        combineMode="parallel"
        canLoop={true}
        hasStaticTint={false}
        currentValues={currentValues}
        onChangeTimeline={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByLabelText('Loop')).not.toBeDisabled();
  });

  it('shrinking duration below an existing keyframe time clamps that keyframe to the new duration', () => {
    const { props } = renderDialog({ timeline: alphaTimeline() }); // keyframe at time=1, duration=2
    fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '0.5' } });
    const updater = props.onChangeTimeline.mock.calls[0][0];
    const result = updater(alphaTimeline());
    expect(result.duration).toBe(0.5);
    expect(result.keyframes[0].time).toBe(0.5);
  });

  it('shrinking duration above all keyframe times leaves their times untouched', () => {
    const { props } = renderDialog({ timeline: alphaTimeline() }); // keyframe at time=1, duration=2
    fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '1.5' } });
    const updater = props.onChangeTimeline.mock.calls[0][0];
    const result = updater(alphaTimeline());
    expect(result.duration).toBe(1.5);
    expect(result.keyframes[0].time).toBe(1);
  });

  it('disables the four matrix-factor checkboxes (with a tooltip) when hasStaticTint is true', () => {
    renderDialog({ hasStaticTint: true });
    for (const label of ['Saturation', 'Brightness', 'Contrast', 'Invert']) {
      const checkbox = screen.getByLabelText(label);
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveAttribute('title', "Disabled: this sprite has a static tint/colorize applied — animating color together with a static tint isn't supported.");
    }
  });

  it('leaves the four matrix-factor checkboxes enabled when hasStaticTint is false', () => {
    renderDialog({ hasStaticTint: false });
    for (const label of ['Saturation', 'Brightness', 'Contrast', 'Invert']) {
      expect(screen.getByLabelText(label)).not.toBeDisabled();
    }
  });

  it('does not disable a matrix-factor property already selected by this timeline, even when hasStaticTint is true', () => {
    const withSaturation: SpriteTimeline = { ...emptyTimeline(), properties: ['saturation'] };
    renderDialog({ timeline: withSaturation, hasStaticTint: true });
    expect(screen.getByLabelText('Saturation')).not.toBeDisabled();
  });

  it('hasStaticTint disabling is independent of the parallel-mode sibling-conflict disabling', () => {
    renderDialog({ combineMode: 'sequential', hasStaticTint: true, propertiesClaimedBySiblings: ['saturation'] });
    // Sequential mode alone would not disable Saturation (sibling rule only applies in parallel), but hasStaticTint still does.
    expect(screen.getByLabelText('Saturation')).toBeDisabled();
  });

  it('leaves simple properties (e.g. Alpha) unaffected by hasStaticTint', () => {
    renderDialog({ hasStaticTint: true });
    expect(screen.getByLabelText('Alpha')).not.toBeDisabled();
  });

  it('disables a matrix-factor property when a sibling claims a DIFFERENT matrix-factor property, in parallel mode', () => {
    renderDialog({ combineMode: 'parallel', propertiesClaimedBySiblings: ['brightness'] });
    expect(screen.getByLabelText('Saturation')).toBeDisabled();
  });

  it('disables a matrix-factor property when a sibling claims a DIFFERENT matrix-factor property, in sequential mode too (unlike the simple-property sibling rule)', () => {
    renderDialog({ combineMode: 'sequential', propertiesClaimedBySiblings: ['brightness'] });
    expect(screen.getByLabelText('Saturation')).toBeDisabled();
  });

  it('does not disable a matrix-factor property already selected by this timeline, even when a sibling claims a different matrix-factor property', () => {
    const withSaturation: SpriteTimeline = { ...emptyTimeline(), properties: ['saturation'] };
    renderDialog({ timeline: withSaturation, combineMode: 'parallel', propertiesClaimedBySiblings: ['brightness'] });
    expect(screen.getByLabelText('Saturation')).not.toBeDisabled();
  });

  it('does not disable simple properties when a sibling claims a matrix-factor property', () => {
    renderDialog({ combineMode: 'parallel', propertiesClaimedBySiblings: ['brightness'] });
    expect(screen.getByLabelText('Alpha')).not.toBeDisabled();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
