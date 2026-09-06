import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TimelineRow from './TimelineRow';
import type { SpriteTimeline } from '@/types';

function emptyTimeline(): SpriteTimeline {
  return { id: 't1', name: 'bob0', properties: [], keyframes: [], duration: 2, loop: false };
}

function alphaTimeline(): SpriteTimeline {
  return { id: 't1', name: 'bob0', properties: ['alpha'], keyframes: [{ id: 'kf-1', time: 1, values: { alpha: 0.5 }, easing: 'linear' }], duration: 2, loop: false };
}

function renderRow(overrides: Partial<Parameters<typeof TimelineRow>[0]> = {}) {
  const onOpenEditor = vi.fn();
  const onRemoveTimeline = vi.fn();
  const props = {
    timeline: emptyTimeline(),
    onOpenEditor,
    onRemoveTimeline,
    ...overrides,
  };
  return { ...render(<TimelineRow {...props} />), props };
}

describe('TimelineRow', () => {
  it('renders the timeline name', () => {
    renderRow();
    expect(screen.getByText('bob0')).toBeInTheDocument();
  });

  it('shows "No keyframes" for a timeline with none', () => {
    renderRow();
    expect(screen.getByText('No keyframes')).toBeInTheDocument();
  });

  it('renders a dot per keyframe', () => {
    renderRow({ timeline: alphaTimeline() });
    expect(screen.queryByText('No keyframes')).not.toBeInTheDocument();
  });

  it('opens the editor on double-click', async () => {
    const user = userEvent.setup();
    const { props } = renderRow();
    await user.dblClick(screen.getByRole('button', { name: 'Edit timeline bob0' }));
    expect(props.onOpenEditor).toHaveBeenCalled();
  });

  it('opens the editor on Enter', async () => {
    const user = userEvent.setup();
    const { props } = renderRow();
    screen.getByRole('button', { name: 'Edit timeline bob0' }).focus();
    await user.keyboard('{Enter}');
    expect(props.onOpenEditor).toHaveBeenCalled();
  });

  it('calls onMoveUp/onMoveDown when provided, and omits the buttons when not, without opening the editor', async () => {
    const user = userEvent.setup();
    const onMoveUp = vi.fn();
    const { props } = renderRow({ onMoveUp });
    await user.click(screen.getByRole('button', { name: 'Move up' }));
    expect(onMoveUp).toHaveBeenCalled();
    expect(props.onOpenEditor).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Move down' })).not.toBeInTheDocument();
  });

  it('calls onRemoveTimeline when Remove is clicked and confirmed, without opening the editor', async () => {
    const user = userEvent.setup();
    const { props } = renderRow();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(props.onRemoveTimeline).toHaveBeenCalled();
    expect(props.onOpenEditor).not.toHaveBeenCalled();
  });
});
