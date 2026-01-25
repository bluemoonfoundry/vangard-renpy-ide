import { useState, useCallback } from 'react';

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const useHistory = <T>(initialState: T) => {
  const [history, setHistory] = useState<History<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // Prevent undoing to the initial state (position 0) - only allow undo to position 1
  // This prevents the application from entering a blank state when all changes are undone
  const canUndo = history.past.length > 1;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;

    const newPast = history.past.slice(0, history.past.length - 1);
    const newPresent = history.past[history.past.length - 1];
    const newFuture = [history.present, ...history.future];

    setHistory({
      past: newPast,
      present: newPresent,
      future: newFuture,
    });
  }, [canUndo, history]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    const newPast = [...history.past, history.present];
    const newPresent = history.future[0];
    const newFuture = history.future.slice(1);

    setHistory({
      past: newPast,
      present: newPresent,
      future: newFuture,
    });
  }, [canRedo, history]);

  const setState = useCallback((action: T | ((prev: T) => T)) => {
    const newState = action instanceof Function ? action(history.present) : action;

    if (JSON.stringify(newState) === JSON.stringify(history.present)) {
      return; // Do nothing if state is unchanged
    }

    setHistory({
      past: [...history.past, history.present],
      present: newState,
      future: [], // Clear future on new state
    });
  }, [history.present]);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};
