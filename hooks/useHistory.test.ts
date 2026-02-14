/**
 * @file hooks/useHistory.test.ts
 * @description Tests for the useHistory undo/redo hook.
 */

import { renderHook, act } from '@testing-library/react';
import { useHistory } from './useHistory';

describe('useHistory', () => {
  it('initializes with the given state', () => {
    const { result } = renderHook(() => useHistory({ count: 0 }));
    expect(result.current.state).toEqual({ count: 0 });
  });

  it('starts with canUndo=false and canRedo=false', () => {
    const { result } = renderHook(() => useHistory(0));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  // -------------------------------------------------------------------------
  // setState
  // -------------------------------------------------------------------------

  describe('setState', () => {
    it('updates the present state', () => {
      const { result } = renderHook(() => useHistory(0));
      act(() => result.current.setState(1));
      expect(result.current.state).toBe(1);
    });

    it('accepts a function updater', () => {
      const { result } = renderHook(() => useHistory(10));
      act(() => result.current.setState((prev: number) => prev + 5));
      expect(result.current.state).toBe(15);
    });

    it('does nothing if the new state is identical (by JSON)', () => {
      const { result } = renderHook(() => useHistory({ a: 1 }));
      act(() => result.current.setState({ a: 1 }));
      // Should still not be undoable — no actual state change recorded
      expect(result.current.canUndo).toBe(false);
    });

    it('clears the redo stack on new state push', () => {
      const { result } = renderHook(() => useHistory(0));

      // Push two states: 0 -> 1 -> 2
      act(() => result.current.setState(1));
      act(() => result.current.setState(2));

      // Undo: 2 -> 1
      act(() => result.current.undo());
      expect(result.current.canRedo).toBe(true);

      // Push new state: diverge from history
      act(() => result.current.setState(99));
      expect(result.current.state).toBe(99);
      expect(result.current.canRedo).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Undo
  // -------------------------------------------------------------------------

  describe('undo', () => {
    it('requires at least 2 pushes before undo is available', () => {
      const { result } = renderHook(() => useHistory(0));

      // After one push (initial + 1), canUndo should still be false
      // because the hook prevents undoing to the initial blank state
      act(() => result.current.setState(1));
      expect(result.current.canUndo).toBe(false);

      // After two pushes (initial + 2), canUndo should be true
      act(() => result.current.setState(2));
      expect(result.current.canUndo).toBe(true);
    });

    it('reverts to the previous state', () => {
      const { result } = renderHook(() => useHistory('a'));
      act(() => result.current.setState('b'));
      act(() => result.current.setState('c'));

      act(() => result.current.undo());
      expect(result.current.state).toBe('b');
    });

    it('can undo multiple times', () => {
      const { result } = renderHook(() => useHistory(0));
      act(() => result.current.setState(1));
      act(() => result.current.setState(2));
      act(() => result.current.setState(3));

      act(() => result.current.undo());
      expect(result.current.state).toBe(2);

      act(() => result.current.undo());
      expect(result.current.state).toBe(1);
    });

    it('does nothing when canUndo is false', () => {
      const { result } = renderHook(() => useHistory(0));
      act(() => result.current.setState(1));

      // canUndo is false (only 1 item in past)
      act(() => result.current.undo());
      expect(result.current.state).toBe(1);
    });

    it('enables canRedo after undo', () => {
      const { result } = renderHook(() => useHistory(0));
      act(() => result.current.setState(1));
      act(() => result.current.setState(2));

      act(() => result.current.undo());
      expect(result.current.canRedo).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Redo
  // -------------------------------------------------------------------------

  describe('redo', () => {
    it('restores the undone state', () => {
      const { result } = renderHook(() => useHistory(0));
      act(() => result.current.setState(1));
      act(() => result.current.setState(2));

      act(() => result.current.undo());
      expect(result.current.state).toBe(1);

      act(() => result.current.redo());
      expect(result.current.state).toBe(2);
    });

    it('can redo multiple times', () => {
      const { result } = renderHook(() => useHistory(0));
      act(() => result.current.setState(1));
      act(() => result.current.setState(2));
      act(() => result.current.setState(3));

      act(() => result.current.undo());
      act(() => result.current.undo());
      expect(result.current.state).toBe(1);

      act(() => result.current.redo());
      expect(result.current.state).toBe(2);

      act(() => result.current.redo());
      expect(result.current.state).toBe(3);
    });

    it('does nothing when canRedo is false', () => {
      const { result } = renderHook(() => useHistory(0));
      act(() => result.current.setState(1));

      act(() => result.current.redo());
      expect(result.current.state).toBe(1);
    });

    it('disables canRedo when all future states are exhausted', () => {
      const { result } = renderHook(() => useHistory(0));
      act(() => result.current.setState(1));
      act(() => result.current.setState(2));

      act(() => result.current.undo());
      act(() => result.current.redo());
      expect(result.current.canRedo).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Complex Sequences
  // -------------------------------------------------------------------------

  describe('complex sequences', () => {
    it('handles undo-push-redo correctly (redo cleared)', () => {
      const { result } = renderHook(() => useHistory(0));
      act(() => result.current.setState(1));
      act(() => result.current.setState(2));
      act(() => result.current.setState(3));

      // Undo twice: 3 -> 2 -> 1
      act(() => result.current.undo());
      act(() => result.current.undo());
      expect(result.current.state).toBe(1);

      // Push new divergent state
      act(() => result.current.setState(100));
      expect(result.current.state).toBe(100);
      expect(result.current.canRedo).toBe(false);

      // Can still undo to 1
      act(() => result.current.undo());
      expect(result.current.state).toBe(1);
    });

    it('works with object state', () => {
      const { result } = renderHook(() => useHistory({ x: 0, y: 0 }));
      act(() => result.current.setState({ x: 1, y: 0 }));
      act(() => result.current.setState({ x: 1, y: 2 }));

      act(() => result.current.undo());
      expect(result.current.state).toEqual({ x: 1, y: 0 });

      act(() => result.current.redo());
      expect(result.current.state).toEqual({ x: 1, y: 2 });
    });

    it('works with array state', () => {
      const { result } = renderHook(() => useHistory<string[]>([]));
      act(() => result.current.setState(['a']));
      act(() => result.current.setState(['a', 'b']));

      act(() => result.current.undo());
      expect(result.current.state).toEqual(['a']);
    });
  });
});
