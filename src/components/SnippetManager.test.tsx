import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SnippetManager from './SnippetManager';
import type { UserSnippet } from '@/types';
import { installElectronAPI, uninstallElectronAPI } from '@/test/mocks/electronAPI';

describe('SnippetManager', () => {
  beforeEach(() => {
    installElectronAPI();
  });

  afterEach(() => {
    uninstallElectronAPI();
  });
  it('renders built-in snippet categories', async () => {
    render(<SnippetManager />);
    expect(screen.getByText('Snippet Library')).toBeInTheDocument();

    // Wait for snippets to load
    const dialogueCategory = await screen.findAllByText('Dialogue & Narration');
    expect(dialogueCategory[0]).toBeInTheDocument();

    const logicCategory = await screen.findAllByText('Logic & Control Flow');
    expect(logicCategory[0]).toBeInTheDocument();
  });

  it('renders user snippets section when onCreateSnippet is provided', () => {
    render(<SnippetManager onCreateSnippet={vi.fn()} />);
    expect(screen.getByText('My Snippets')).toBeInTheDocument();
    expect(screen.getByText('+ New')).toBeInTheDocument();
  });

  it('does not render user snippets section when no props provided', () => {
    render(<SnippetManager />);
    expect(screen.queryByText('My Snippets')).not.toBeInTheDocument();
  });

  it('renders user snippet entries with edit and delete buttons', () => {
    const snippets: UserSnippet[] = [
      { id: 's1', title: 'My Custom', prefix: 'mycust', description: 'A custom snippet', code: 'show test' },
    ];
    render(
      <SnippetManager
        userSnippets={snippets}
        onCreateSnippet={vi.fn()}
        onEditSnippet={vi.fn()}
        onDeleteSnippet={vi.fn()}
      />
    );
    expect(screen.getByText('My Custom')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onCreateSnippet when + New is clicked', async () => {
    const onCreateSnippet = vi.fn();
    const user = userEvent.setup();
    render(<SnippetManager onCreateSnippet={onCreateSnippet} />);
    await user.click(screen.getByText('+ New'));
    expect(onCreateSnippet).toHaveBeenCalledTimes(1);
  });

  it('calls onEditSnippet with the snippet when Edit is clicked', async () => {
    const onEditSnippet = vi.fn();
    const snippet: UserSnippet = { id: 's1', title: 'Test', prefix: 'tst', description: '', code: 'pass' };
    const user = userEvent.setup();
    render(
      <SnippetManager
        userSnippets={[snippet]}
        onCreateSnippet={vi.fn()}
        onEditSnippet={onEditSnippet}
        onDeleteSnippet={vi.fn()}
      />
    );
    await user.click(screen.getByText('Edit'));
    expect(onEditSnippet).toHaveBeenCalledWith(snippet);
  });

  it('calls onDeleteSnippet after confirmation when Delete is clicked', async () => {
    const onDeleteSnippet = vi.fn();
    const snippet: UserSnippet = { id: 's1', title: 'Test', prefix: 'tst', description: '', code: 'pass' };
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <SnippetManager
        userSnippets={[snippet]}
        onCreateSnippet={vi.fn()}
        onEditSnippet={vi.fn()}
        onDeleteSnippet={onDeleteSnippet}
      />
    );
    await user.click(screen.getByText('Delete'));
    expect(window.confirm).toHaveBeenCalled();
    expect(onDeleteSnippet).toHaveBeenCalledWith('s1');
    vi.restoreAllMocks();
  });

  it('does not call onDeleteSnippet when confirmation is cancelled', async () => {
    const onDeleteSnippet = vi.fn();
    const snippet: UserSnippet = { id: 's1', title: 'Test', prefix: 'tst', description: '', code: 'pass' };
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <SnippetManager
        userSnippets={[snippet]}
        onCreateSnippet={vi.fn()}
        onEditSnippet={vi.fn()}
        onDeleteSnippet={onDeleteSnippet}
      />
    );
    await user.click(screen.getByText('Delete'));
    expect(onDeleteSnippet).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('shows empty state message when no user snippets exist', () => {
    render(<SnippetManager userSnippets={[]} onCreateSnippet={vi.fn()} />);
    expect(screen.getByText(/No custom snippets yet/)).toBeInTheDocument();
  });
});
