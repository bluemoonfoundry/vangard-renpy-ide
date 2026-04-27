import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiagnosticsPanel from './DiagnosticsPanel';
import { createBlock } from '@/test/mocks/sampleData';
import type { DiagnosticsResult, IgnoredDiagnosticRule } from '@/types';

describe('DiagnosticsPanel', () => {
  it('uses icon buttons for ignore and navigation while the message body stays inert', async () => {
    const user = userEvent.setup();
    const onOpenBlock = vi.fn();
    const onUpdateIgnoredDiagnostics = vi.fn();
    const diagnostics: DiagnosticsResult = {
      issues: [{
        id: 'invalid-jump:b1:missing_label',
        severity: 'error',
        category: 'invalid-jump',
        message: 'Undefined label "missing_label"',
        blockId: 'b1',
        filePath: 'game/script.rpy',
        line: 2,
      }],
      errorCount: 1,
      warningCount: 0,
      infoCount: 0,
    };

    render(
      <DiagnosticsPanel
        diagnostics={diagnostics}
        blocks={[createBlock({ id: 'b1' })]}
        stickyNotes={[]}
        tasks={[]}
        ignoredDiagnostics={[]}
        onUpdateTasks={vi.fn()}
        onUpdateIgnoredDiagnostics={onUpdateIgnoredDiagnostics}
        onOpenBlock={onOpenBlock}
        onHighlightBlock={vi.fn()}
      />
    );

    await user.click(screen.getByText('Undefined label "missing_label"'));

    expect(onOpenBlock).not.toHaveBeenCalled();
    expect(onUpdateIgnoredDiagnostics).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Open script.rpy:2' }));

    expect(onOpenBlock).toHaveBeenCalledWith('b1', 2);

    await user.click(screen.getByRole('button', { name: 'Ignore issue' }));

    expect(onUpdateIgnoredDiagnostics).toHaveBeenCalledWith([
      {
        category: 'invalid-jump',
        filePath: 'game/script.rpy',
        blockId: undefined,
        line: 2,
        message: 'Undefined label "missing_label"',
      } satisfies IgnoredDiagnosticRule,
    ]);
  });
});
