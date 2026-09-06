import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MiniKeyframeRuler from './MiniKeyframeRuler';

describe('MiniKeyframeRuler', () => {
  it('shows "No keyframes" when there are none', () => {
    render(<MiniKeyframeRuler keyframes={[]} duration={2} />);
    expect(screen.getByText('No keyframes')).toBeInTheDocument();
  });

  it('renders one dot per keyframe, positioned by time/duration', () => {
    const keyframes = [
      { id: 'a', time: 0, values: {}, easing: 'linear' as const },
      { id: 'b', time: 1, values: {}, easing: 'linear' as const },
    ];
    const { container } = render(<MiniKeyframeRuler keyframes={keyframes} duration={2} />);
    const dots = container.querySelectorAll('span');
    expect(dots).toHaveLength(2);
    expect((dots[0] as HTMLElement).style.left).toBe('0%');
    expect((dots[1] as HTMLElement).style.left).toBe('50%');
  });
});
