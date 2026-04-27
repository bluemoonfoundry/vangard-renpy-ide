import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import SnippetGridView from './SnippetGridView';

const mockCategories = [
  {
    name: 'Test Category 1',
    snippets: [
      {
        title: 'Test Snippet 1',
        description: 'First test snippet',
        code: 'show test1',
      },
      {
        title: 'Test Snippet 2',
        description: 'Second test snippet',
        code: 'show test2',
      },
    ],
  },
  {
    name: 'Test Category 2',
    snippets: [
      {
        title: 'Another Snippet',
        description: 'From second category',
        code: 'hide another',
      },
    ],
  },
];

describe('SnippetGridView', () => {
  it('renders all snippet cards', () => {
    render(<SnippetGridView categories={mockCategories} />);
    expect(screen.getByText('Test Snippet 1')).toBeInTheDocument();
    expect(screen.getByText('Test Snippet 2')).toBeInTheDocument();
    expect(screen.getByText('Another Snippet')).toBeInTheDocument();
  });

  it('displays total snippet count', () => {
    render(<SnippetGridView categories={mockCategories} />);
    expect(screen.getByText('3 snippets')).toBeInTheDocument();
  });

  it('renders category filter chips', () => {
    render(<SnippetGridView categories={mockCategories} />);
    const category1Chips = screen.getAllByText('Test Category 1');
    const category2Chips = screen.getAllByText('Test Category 2');
    // Should have at least one chip for each category
    expect(category1Chips.length).toBeGreaterThan(0);
    expect(category2Chips.length).toBeGreaterThan(0);
  });

  it('filters snippets by category when chip is clicked', async () => {
    const user = userEvent.setup();
    render(<SnippetGridView categories={mockCategories} />);

    // Click on "Test Category 1" chip (first one is the filter button)
    const category1Buttons = screen.getAllByText('Test Category 1');
    await user.click(category1Buttons[0]);

    // Should show only 2 snippets from category 1
    expect(screen.getByText('2 snippets (filtered from 3)')).toBeInTheDocument();
    expect(screen.getByText('Test Snippet 1')).toBeInTheDocument();
    expect(screen.getByText('Test Snippet 2')).toBeInTheDocument();
    expect(screen.queryByText('Another Snippet')).not.toBeInTheDocument();
  });

  it('filters snippets by search query', async () => {
    const user = userEvent.setup();
    render(<SnippetGridView categories={mockCategories} />);

    const searchInput = screen.getByPlaceholderText('Search snippets...');
    await user.type(searchInput, 'another');

    // Should show only 1 snippet matching "another"
    expect(screen.getByText('1 snippet (filtered from 3)')).toBeInTheDocument();
    expect(screen.getByText('Another Snippet')).toBeInTheDocument();
    expect(screen.queryByText('Test Snippet 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Snippet 2')).not.toBeInTheDocument();
  });

  it('shows clear filters button when filters are active', async () => {
    const user = userEvent.setup();
    render(<SnippetGridView categories={mockCategories} />);

    // No clear button initially
    expect(screen.queryByText('Clear Filters')).not.toBeInTheDocument();

    // Click a category filter (first occurrence is the button)
    const category1Buttons = screen.getAllByText('Test Category 1');
    await user.click(category1Buttons[0]);

    // Clear button should appear
    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
  });

  it('clears all filters when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<SnippetGridView categories={mockCategories} />);

    // Apply filters (first occurrence is the button)
    const category1Buttons = screen.getAllByText('Test Category 1');
    await user.click(category1Buttons[0]);
    const searchInput = screen.getByPlaceholderText('Search snippets...');
    await user.type(searchInput, 'test');

    expect(screen.getByText(/filtered from 3/)).toBeInTheDocument();

    // Clear filters
    await user.click(screen.getByText('Clear Filters'));

    // Should show all snippets again
    expect(screen.getByText('3 snippets')).toBeInTheDocument();
    expect(searchInput).toHaveValue('');
  });

  it('shows empty state when no snippets match filters', async () => {
    const user = userEvent.setup();
    render(<SnippetGridView categories={mockCategories} />);

    const searchInput = screen.getByPlaceholderText('Search snippets...');
    await user.type(searchInput, 'nonexistent');

    expect(screen.getByText('No snippets found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
  });

  it('expands snippet code when clicked', async () => {
    const user = userEvent.setup();
    const longCode = 'a'.repeat(100);
    const categories = [
      {
        name: 'Test',
        snippets: [
          {
            title: 'Long Snippet',
            description: 'Has long code',
            code: longCode,
          },
        ],
      },
    ];
    render(<SnippetGridView categories={categories} />);

    // Code should be truncated initially
    expect(screen.getByText(/a+\.\.\./)).toBeInTheDocument();

    // Click to expand
    const codeBlock = screen.getByText(/a+\.\.\./).closest('div');
    if (codeBlock) {
      await user.click(codeBlock);
    }

    // Should show full code now (no truncation)
    expect(screen.getByText(longCode)).toBeInTheDocument();
  });

  it('displays snippet category tags', () => {
    render(<SnippetGridView categories={mockCategories} />);

    const categoryTags = screen.getAllByText(/Test Category \d/);
    expect(categoryTags.length).toBeGreaterThan(0);
  });
});
