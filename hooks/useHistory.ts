/**
 * @file useHistory.ts
 * @description Implements undo/redo history management for application state.
 * Maintains a stack of past and future states with ability to navigate between them.
 * Prevents undoing to the initial blank state to ensure application always has valid state.
 */

import { useState, useCallback } from 'react';

/**
 * Represents the undo/redo history state.
 * @template T - Type of state being tracked
 * @interface History
 * @property {T[]} past - Array of previous states (oldest to most recent)
 * @property {T} present - Current state
 * @property {T[]} future - Array of states that can be redone (can redo to these)
 */
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
