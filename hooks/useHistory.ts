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
    setHistory(currentHistory => {
      const newPast = currentHistory.past.slice(0, currentHistory.past.length - 1);
      const newPresent = currentHistory.past[currentHistory.past.length - 1];
      const newFuture = [currentHistory.present, ...currentHistory.future];

      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      };
    });
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    setHistory(currentHistory => {
      const newPast = [...currentHistory.past, currentHistory.present];
      const newPresent = currentHistory.future[0];
      const newFuture = currentHistory.future.slice(1);

      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      };
    });
  }, [canRedo]);

  const setState = useCallback((action: T | ((prev: T) => T)) => {
    setHistory(currentHistory => {
      const newState = action instanceof Function ? action(currentHistory.present) : action;

      if (JSON.stringify(newState) === JSON.stringify(currentHistory.present)) {
        return currentHistory;
      }

      return {
        past: [...currentHistory.past, currentHistory.present],
        present: newState,
        future: [],
      };
    });
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};
