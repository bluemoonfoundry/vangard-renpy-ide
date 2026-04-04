import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 500));
    expect(result.current).toBe('hello');
  });

  it('does not update before the delay elapses', () => {
    let value = 'initial';
    const { result, rerender } = renderHook(() => useDebounce(value, 500));

    value = 'updated';
    rerender();

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('initial');
  });

  it('updates after the delay elapses', () => {
    let value = 'initial';
    const { result, rerender } = renderHook(() => useDebounce(value, 500));

    value = 'updated';
    rerender();

    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe('updated');
  });

  it('resets the timer on rapid successive changes', () => {
    let value = 'initial';
    const { result, rerender } = renderHook(() => useDebounce(value, 500));

    value = 'first';
    rerender();
    act(() => { vi.advanceTimersByTime(300); });

    value = 'second';
    rerender();
    act(() => { vi.advanceTimersByTime(300); }); // only 300ms since last change

    expect(result.current).toBe('initial'); // not yet updated

    act(() => { vi.advanceTimersByTime(200); }); // now 500ms since 'second'
    expect(result.current).toBe('second');
  });

  it('works with object values', () => {
    const initial = [{ id: '1', content: 'a' }];
    let value = initial;
    const { result, rerender } = renderHook(() => useDebounce(value, 300));

    const updated = [{ id: '1', content: 'b' }];
    value = updated;
    rerender();

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe(updated);
  });
});
