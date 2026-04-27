/**
 * @file useStickyNotes.ts
 * @description Custom hook for managing sticky notes across three canvases
 *
 * Handles sticky notes for Story Canvas, Route Canvas, and Choice Canvas.
 * Each canvas has its own collection of notes with add/update/delete operations.
 */

import { useCallback } from 'react';
import { useImmer } from 'use-immer';
import type { StickyNote, Position, AppSettings } from '@/types';
import type { CanvasTransform } from '@/hooks/useCanvasInteraction';

export interface UseStickyNotesReturn {
  // State
  stickyNotes: StickyNote[];
  routeStickyNotes: StickyNote[];
  choiceStickyNotes: StickyNote[];
  setStickyNotes: (updater: StickyNote[] | ((draft: StickyNote[]) => void)) => void;
  setRouteStickyNotes: (updater: StickyNote[] | ((draft: StickyNote[]) => void)) => void;
  setChoiceStickyNotes: (updater: StickyNote[] | ((draft: StickyNote[]) => void)) => void;

  // Story Canvas operations
  addStickyNote: (initialPosition?: Position) => void;
  updateStickyNote: (id: string, data: Partial<StickyNote>) => void;
  deleteStickyNote: (id: string) => void;

  // Route Canvas operations
  addRouteStickyNote: (initialPosition?: Position) => void;
  updateRouteStickyNote: (id: string, data: Partial<StickyNote>) => void;
  deleteRouteStickyNote: (id: string) => void;

  // Choice Canvas operations
  addChoiceStickyNote: (initialPosition?: Position) => void;
  updateChoiceStickyNote: (id: string, data: Partial<StickyNote>) => void;
  deleteChoiceStickyNote: (id: string) => void;

  // Utility
  clearAllStickyNotes: () => void;
}

export interface UseStickyNotesParams {
  appSettings: AppSettings;
  storyCanvasTransform: CanvasTransform;
  onStickyNoteChange?: () => void;
}

/**
 * Hook for managing sticky notes across three canvases
 *
 * @param params Configuration object with app settings and canvas transforms
 * @returns Object containing sticky note state and management functions
 *
 * @example
 * ```tsx
 * const {
 *   stickyNotes,
 *   addStickyNote,
 *   updateStickyNote,
 *   deleteStickyNote
 * } = useStickyNotes({
 *   appSettings,
 *   storyCanvasTransform,
 *   onStickyNoteChange: () => setHasUnsavedSettings(true)
 * });
 *
 * // Add a sticky note at cursor position
 * addStickyNote({ x: 100, y: 200 });
 *
 * // Update note content
 * updateStickyNote('note-123', { content: 'Remember to...' });
 *
 * // Delete note
 * deleteStickyNote('note-123');
 * ```
 */
export function useStickyNotes(params: UseStickyNotesParams): UseStickyNotesReturn {
  const { appSettings, storyCanvasTransform, onStickyNoteChange } = params;

  // --- State ---
  const [stickyNotes, setStickyNotes] = useImmer<StickyNote[]>([]);
  const [routeStickyNotes, setRouteStickyNotes] = useImmer<StickyNote[]>([]);
  const [choiceStickyNotes, setChoiceStickyNotes] = useImmer<StickyNote[]>([]);

  // --- Story Canvas Sticky Note Management ---

  /**
   * Add a new sticky note to the Story Canvas
   */
  const addStickyNote = useCallback((initialPosition?: Position) => {
    const id = `note-${Date.now()}`;
    const width = 200;
    const height = 200;

    let position: Position;
    if (initialPosition) {
      position = initialPosition;
      // Center the note on the click position
      position.x -= width / 2;
      position.y -= height / 2;
    } else {
      const leftOffset = appSettings.isLeftSidebarOpen ? appSettings.leftSidebarWidth : 0;
      const rightOffset = appSettings.isRightSidebarOpen ? appSettings.rightSidebarWidth : 0;
      const topOffset = 64;

      const visibleWidth = window.innerWidth - leftOffset - rightOffset;
      const visibleHeight = window.innerHeight - topOffset;

      const screenCenterX = leftOffset + (visibleWidth / 2);
      const screenCenterY = topOffset + (visibleHeight / 2);

      const worldCenterX = (screenCenterX - storyCanvasTransform.x) / storyCanvasTransform.scale;
      const worldCenterY = (screenCenterY - storyCanvasTransform.y) / storyCanvasTransform.scale;

      position = {
        x: worldCenterX - (width / 2),
        y: worldCenterY - (height / 2)
      };
    }

    const newNote: StickyNote = {
      id,
      content: '',
      position,
      width,
      height,
      color: 'yellow'
    };

    setStickyNotes(draft => {
      draft.push(newNote);
    });

    if (onStickyNoteChange) {
      onStickyNoteChange();
    }
  }, [appSettings, storyCanvasTransform, setStickyNotes, onStickyNoteChange]);

  /**
   * Update an existing sticky note on the Story Canvas
   */
  const updateStickyNote = useCallback((id: string, data: Partial<StickyNote>) => {
    setStickyNotes(draft => {
      const idx = draft.findIndex(n => n.id === id);
      if (idx !== -1) Object.assign(draft[idx], data);
    });

    if (onStickyNoteChange) {
      onStickyNoteChange();
    }
  }, [setStickyNotes, onStickyNoteChange]);

  /**
   * Delete a sticky note from the Story Canvas
   */
  const deleteStickyNote = useCallback((id: string) => {
    setStickyNotes(draft => {
      const idx = draft.findIndex(n => n.id === id);
      if (idx !== -1) draft.splice(idx, 1);
    });

    if (onStickyNoteChange) {
      onStickyNoteChange();
    }
  }, [setStickyNotes, onStickyNoteChange]);

  // --- Route Canvas Sticky Note Management ---

  /**
   * Add a new sticky note to the Route Canvas
   */
  const addRouteStickyNote = useCallback((initialPosition?: Position) => {
    const id = `rnote-${Date.now()}`;
    const width = 200;
    const height = 200;
    const pos = initialPosition
      ? { x: initialPosition.x - width / 2, y: initialPosition.y - height / 2 }
      : { x: 0, y: 0 };

    setRouteStickyNotes(draft => {
      draft.push({ id, content: '', position: pos, width, height, color: 'yellow' });
    });

    if (onStickyNoteChange) {
      onStickyNoteChange();
    }
  }, [setRouteStickyNotes, onStickyNoteChange]);

  /**
   * Update an existing sticky note on the Route Canvas
   */
  const updateRouteStickyNote = useCallback((id: string, data: Partial<StickyNote>) => {
    setRouteStickyNotes(draft => {
      const idx = draft.findIndex(n => n.id === id);
      if (idx !== -1) Object.assign(draft[idx], data);
    });

    if (onStickyNoteChange) {
      onStickyNoteChange();
    }
  }, [setRouteStickyNotes, onStickyNoteChange]);

  /**
   * Delete a sticky note from the Route Canvas
   */
  const deleteRouteStickyNote = useCallback((id: string) => {
    setRouteStickyNotes(draft => {
      const idx = draft.findIndex(n => n.id === id);
      if (idx !== -1) draft.splice(idx, 1);
    });

    if (onStickyNoteChange) {
      onStickyNoteChange();
    }
  }, [setRouteStickyNotes, onStickyNoteChange]);

  // --- Choice Canvas Sticky Note Management ---

  /**
   * Add a new sticky note to the Choice Canvas
   */
  const addChoiceStickyNote = useCallback((initialPosition?: Position) => {
    const id = `cnote-${Date.now()}`;
    const width = 200;
    const height = 200;
    const pos = initialPosition
      ? { x: initialPosition.x - width / 2, y: initialPosition.y - height / 2 }
      : { x: 0, y: 0 };

    setChoiceStickyNotes(draft => {
      draft.push({ id, content: '', position: pos, width, height, color: 'yellow' });
    });

    if (onStickyNoteChange) {
      onStickyNoteChange();
    }
  }, [setChoiceStickyNotes, onStickyNoteChange]);

  /**
   * Update an existing sticky note on the Choice Canvas
   */
  const updateChoiceStickyNote = useCallback((id: string, data: Partial<StickyNote>) => {
    setChoiceStickyNotes(draft => {
      const idx = draft.findIndex(n => n.id === id);
      if (idx !== -1) Object.assign(draft[idx], data);
    });

    if (onStickyNoteChange) {
      onStickyNoteChange();
    }
  }, [setChoiceStickyNotes, onStickyNoteChange]);

  /**
   * Delete a sticky note from the Choice Canvas
   */
  const deleteChoiceStickyNote = useCallback((id: string) => {
    setChoiceStickyNotes(draft => {
      const idx = draft.findIndex(n => n.id === id);
      if (idx !== -1) draft.splice(idx, 1);
    });

    if (onStickyNoteChange) {
      onStickyNoteChange();
    }
  }, [setChoiceStickyNotes, onStickyNoteChange]);

  // --- Utility ---

  /**
   * Clear all sticky notes from all canvases (typically on project close)
   */
  const clearAllStickyNotes = useCallback(() => {
    setStickyNotes([]);
    setRouteStickyNotes([]);
    setChoiceStickyNotes([]);
  }, [setStickyNotes, setRouteStickyNotes, setChoiceStickyNotes]);

  return {
    // State
    stickyNotes,
    routeStickyNotes,
    choiceStickyNotes,
    setStickyNotes,
    setRouteStickyNotes,
    setChoiceStickyNotes,

    // Story Canvas operations
    addStickyNote,
    updateStickyNote,
    deleteStickyNote,

    // Route Canvas operations
    addRouteStickyNote,
    updateRouteStickyNote,
    deleteRouteStickyNote,

    // Choice Canvas operations
    addChoiceStickyNote,
    updateChoiceStickyNote,
    deleteChoiceStickyNote,

    // Utility
    clearAllStickyNotes,
  };
}
