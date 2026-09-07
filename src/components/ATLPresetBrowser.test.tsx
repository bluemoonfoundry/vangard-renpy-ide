import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ATLPresetBrowser from './ATLPresetBrowser';

function openPreset(title: string) {
  const heading = screen.getByText(title);
  const card = heading.closest('[role="button"]') as HTMLElement;
  return userEvent.setup().click(card);
}

describe('ATLPresetBrowser', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders preset cards from the built-in library', () => {
    render(<ATLPresetBrowser />);
    expect(screen.getByText('Fade In')).toBeInTheDocument();
    expect(screen.getByText('Shake')).toBeInTheDocument();
  });

  it('filters presets by search query', async () => {
    const user = userEvent.setup();
    render(<ATLPresetBrowser />);
    await user.type(screen.getByPlaceholderText('Search animations...'), 'shake');
    expect(screen.getByText('Shake')).toBeInTheDocument();
    expect(screen.queryByText('Fade In')).not.toBeInTheDocument();
  });

  it('filters presets by tag chip', async () => {
    const user = userEvent.setup();
    render(<ATLPresetBrowser />);
    await user.click(screen.getByRole('button', { name: 'rotation' }));
    expect(screen.getByText('Spin')).toBeInTheDocument();
    expect(screen.queryByText('Fade In')).not.toBeInTheDocument();
  });

  it('opens the parameter editor modal with a live code preview on card click', async () => {
    render(<ATLPresetBrowser />);
    await openPreset('Fade In');

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Fade In' })).toBeInTheDocument();
    expect(within(dialog).getByText(/alpha 0\.0/)).toBeInTheDocument();
    expect(within(dialog).getByText(/alpha 1\.0/)).toBeInTheDocument();
  });

  it('updates the live preview when a slider parameter changes', async () => {
    render(<ATLPresetBrowser />);
    await openPreset('Shake');

    const dialog = screen.getByRole('dialog');
    const intensitySlider = within(dialog).getByLabelText(/intensity/);
    fireEvent.change(intensitySlider, { target: { value: '25' } });

    expect(within(dialog).getByText(/xoffset 25/)).toBeInTheDocument();
  });

  it('calls onInsertAtCursor with the instantiated code and closes on Insert', async () => {
    const onInsertAtCursor = vi.fn();
    render(<ATLPresetBrowser onInsertAtCursor={onInsertAtCursor} />);
    await openPreset('Fade In');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Insert to Editor' }));

    expect(onInsertAtCursor).toHaveBeenCalledWith('alpha 0.0\nlinear 1 alpha 1.0');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not render an Insert action when onInsertAtCursor is not provided', async () => {
    render(<ATLPresetBrowser />);
    await openPreset('Fade In');
    expect(screen.queryByRole('button', { name: 'Insert to Editor' })).not.toBeInTheDocument();
  });

  it('toggles favorite state without opening the parameter modal', async () => {
    const user = userEvent.setup();
    render(<ATLPresetBrowser />);
    await user.click(screen.getByRole('button', { name: 'Favorite Fade In' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unfavorite Fade In' })).toBeInTheDocument();
  });
});
