import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SpriteAnimationPanel from './SpriteAnimationPanel';
import type { SpriteAnimation, SpriteTimeline } from '@/types';

const currentValues = { x: 0.5, y: 0.5, zoom: 1, alpha: 1, rotation: 0, blur: 0, saturation: 1, brightness: 0, contrast: 1, invert: 0 };

function timeline(overrides: Partial<SpriteTimeline> = {}): SpriteTimeline {
  return { id: 't1', name: 'bob0', properties: [], keyframes: [], duration: 2, loop: false, ...overrides };
}

function anim(overrides: Partial<SpriteAnimation> = {}): SpriteAnimation {
  return { spriteId: 'bob', combineMode: 'parallel', timelines: [timeline()], ...overrides };
}

function renderPanel(overrides: Partial<Parameters<typeof SpriteAnimationPanel>[0]> = {}) {
  const props = {
    spriteLabel: 'bob',
    animation: anim(),
    currentValues,
    hasStaticTint: false,
    onCreateAnimation: vi.fn(),
    onChangeAnimation: vi.fn(),
    onDeleteAnimation: vi.fn(),
    onPreviewUpdate: vi.fn(),
    ...overrides,
  };
  return { ...render(<SpriteAnimationPanel {...props} />), props };
}

describe('SpriteAnimationPanel', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 200, bottom: 20, width: 200, height: 20, x: 0, y: 0, toJSON: () => {},
    } as DOMRect);
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows an "Add Animation" prompt when the sprite has no animation', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({ animation: null });
    expect(screen.getByText(/No animation for bob yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add Animation' }));
    expect(props.onCreateAnimation).toHaveBeenCalled();
  });

  it('renders one TimelineRow per timeline', () => {
    renderPanel({ animation: anim({ timelines: [timeline({ id: 't1', name: 'bob0' }), timeline({ id: 't2', name: 'bob1' })] }) });
    expect(screen.getByText('bob0')).toBeInTheDocument();
    expect(screen.getByText('bob1')).toBeInTheDocument();
  });

  it('opens the edit dialog for a row on double-click, and closes it on Close', async () => {
    const user = userEvent.setup();
    renderPanel({ animation: anim({ timelines: [timeline({ id: 't1', name: 'bob0' })] }) });
    await user.dblClick(screen.getByRole('button', { name: 'Edit timeline bob0' }));
    expect(screen.getByRole('heading', { name: 'Edit Timeline' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('bob0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Edit Timeline' })).not.toBeInTheDocument();
  });

  it('opens the edit dialog for the new timeline immediately after Add Timeline', async () => {
    const user = userEvent.setup();
    const Wrapper: React.FC = () => {
      const [animation, setAnimation] = React.useState(anim({ timelines: [timeline({ id: 't1', name: 'bob0' })] }));
      return (
        <SpriteAnimationPanel
          spriteLabel="bob"
          animation={animation}
          currentValues={currentValues}
          hasStaticTint={false}
          onCreateAnimation={() => {}}
          onChangeAnimation={(updater) => setAnimation(updater)}
          onDeleteAnimation={() => {}}
          onPreviewUpdate={() => {}}
        />
      );
    };
    render(<Wrapper />);
    await user.click(screen.getByRole('button', { name: '+ Add Timeline' }));
    expect(screen.getByRole('heading', { name: 'Edit Timeline' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('bob1')).toBeInTheDocument();
  });

  it('hides the combine-mode toggle with only one timeline, and shows it with two or more', () => {
    const { rerender } = render(
      <SpriteAnimationPanel spriteLabel="bob" animation={anim()} currentValues={currentValues} hasStaticTint={false} onCreateAnimation={() => {}} onChangeAnimation={() => {}} onDeleteAnimation={() => {}} onPreviewUpdate={() => {}} />
    );
    expect(screen.queryByRole('radio', { name: 'Parallel' })).not.toBeInTheDocument();

    rerender(
      <SpriteAnimationPanel
        spriteLabel="bob"
        animation={anim({ timelines: [timeline({ id: 't1' }), timeline({ id: 't2' })] })}
        currentValues={currentValues}
        hasStaticTint={false}
        onCreateAnimation={() => {}}
        onChangeAnimation={() => {}}
        onDeleteAnimation={() => {}}
        onPreviewUpdate={() => {}}
      />
    );
    expect(screen.getByRole('radio', { name: 'Parallel' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sequential' })).toBeInTheDocument();
  });

  it('adds a new timeline with a prefilled name using the sprite label and next index', () => {
    const { props } = renderPanel({ animation: anim({ timelines: [timeline({ id: 't1', name: 'bob0' })] }) });
    fireEvent.click(screen.getByRole('button', { name: '+ Add Timeline' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updater = (props.onChangeAnimation as any).mock.calls[0][0];
    const result = updater(anim({ timelines: [timeline({ id: 't1', name: 'bob0' })] }));
    expect(result.timelines).toHaveLength(2);
    expect(result.timelines[1].name).toBe('bob1');
    expect(result.timelines[1].properties).toEqual([]);
  });

  it('removes the correct timeline', async () => {
    const user = userEvent.setup();
    const twoTimelines = anim({ timelines: [timeline({ id: 't1', name: 'bob0' }), timeline({ id: 't2', name: 'bob1' })] });
    const { props } = renderPanel({ animation: twoTimelines });
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await user.click(removeButtons[0]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updater = (props.onChangeAnimation as any).mock.calls[0][0];
    expect(updater(twoTimelines).timelines.map(t => t.id)).toEqual(['t2']);
  });

  it('computes propertiesClaimedBySiblings correctly for each row (verified via parallel-mode disabling)', async () => {
    const user = userEvent.setup();
    const twoTimelines = anim({
      timelines: [timeline({ id: 't1', name: 'bob0', properties: ['alpha'] }), timeline({ id: 't2', name: 'bob1', properties: [] })],
    });
    renderPanel({ animation: twoTimelines });

    await user.dblClick(screen.getByRole('button', { name: 'Edit timeline bob0' }));
    expect(screen.getByLabelText('Alpha')).not.toBeDisabled(); // this timeline's own selected property
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.dblClick(screen.getByRole('button', { name: 'Edit timeline bob1' }));
    expect(screen.getByLabelText('Alpha')).toBeDisabled(); // claimed by sibling bob0
  });

  it('reordering swaps the timelines and affects sequential playback order', () => {
    const first = timeline({ id: 't1', name: 'First', properties: ['alpha'], keyframes: [{ id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 1 }, easing: 'linear' }] });
    const second = timeline({ id: 't2', name: 'Second', properties: ['alpha'], keyframes: [{ id: 'k1', time: 0, values: { alpha: 1 }, easing: 'linear' }, { id: 'k2', time: 1, values: { alpha: 0 }, easing: 'linear' }] });
    const sequential = anim({ combineMode: 'sequential', timelines: [first, second] });
    const { props } = renderPanel({ animation: sequential });
    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updater = (props.onChangeAnimation as any).mock.calls[0][0];
    const reordered = updater(sequential);
    expect(reordered.timelines.map(t => t.id)).toEqual(['t2', 't1']);
  });

  it('calls onDeleteAnimation when Remove Animation is clicked and confirmed', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Remove Animation' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(props.onDeleteAnimation).toHaveBeenCalled();
  });

  it('calls onPreviewUpdate with the interpolated pose when the playhead is scrubbed', () => {
    const withAlpha = anim({ timelines: [timeline({ properties: ['alpha'], keyframes: [{ id: 'k1', time: 0, values: { alpha: 0 }, easing: 'linear' }, { id: 'k2', time: 2, values: { alpha: 1 }, easing: 'linear' }] })] });
    const { props } = renderPanel({ animation: withAlpha });
    fireEvent.change(screen.getByRole('slider', { name: 'Playhead' }), { target: { value: '1' } });
    expect(props.onPreviewUpdate).toHaveBeenCalledWith(expect.objectContaining({ alpha: expect.closeTo(0.5, 5) }));
  });

  it('disables the Parallel radio when timelines have overlapping properties', () => {
    const overlapping = anim({
      combineMode: 'sequential',
      timelines: [
        timeline({ id: 't1', name: 'bob0', properties: ['alpha'] }),
        timeline({ id: 't2', name: 'bob1', properties: ['alpha'] }),
      ],
    });
    renderPanel({ animation: overlapping });
    expect(screen.getByRole('radio', { name: 'Parallel' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Sequential' })).not.toBeDisabled();
  });

  it('leaves the Parallel radio enabled when timelines do not overlap', () => {
    const nonOverlapping = anim({
      combineMode: 'sequential',
      timelines: [
        timeline({ id: 't1', name: 'bob0', properties: ['alpha'] }),
        timeline({ id: 't2', name: 'bob1', properties: ['zoom'] }),
      ],
    });
    renderPanel({ animation: nonOverlapping });
    expect(screen.getByRole('radio', { name: 'Parallel' })).not.toBeDisabled();
  });

  it('toggles the Play button label when clicked', async () => {
    const user = userEvent.setup();
    renderPanel();
    const playButton = screen.getByRole('button', { name: 'Play' });
    await user.click(playButton);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('passes hasStaticTint through to the edit dialog for every timeline', async () => {
    const user = userEvent.setup();
    const twoTimelines = anim({ timelines: [timeline({ id: 't1', name: 'bob0' }), timeline({ id: 't2', name: 'bob1' })] });
    renderPanel({ animation: twoTimelines, hasStaticTint: true });

    for (const name of ['bob0', 'bob1']) {
      await user.dblClick(screen.getByRole('button', { name: `Edit timeline ${name}` }));
      for (const label of ['Saturation', 'Brightness', 'Contrast', 'Invert']) {
        expect(screen.getByLabelText(label)).toBeDisabled();
      }
      await user.click(screen.getByRole('button', { name: 'Close' }));
    }
  });

  it('disables the Parallel radio when two timelines each animate a different matrix-factor property', () => {
    const differentMatrixFactors = anim({
      timelines: [
        timeline({ id: 't1', name: 'bob0', properties: ['saturation'] }),
        timeline({ id: 't2', name: 'bob1', properties: ['brightness'] }),
      ],
    });
    renderPanel({ animation: differentMatrixFactors });
    expect(screen.getByRole('radio', { name: 'Parallel' })).toBeDisabled();
  });
});
