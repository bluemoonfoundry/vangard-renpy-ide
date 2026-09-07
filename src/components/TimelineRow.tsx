/**
 * @file TimelineRow.tsx
 * @description One compact summary row for a `SpriteTimeline`: its name, a
 * non-interactive keyframe visualization (`MiniKeyframeRuler`), and
 * move/remove controls. Double-click the row (or press Enter/Space on it) to
 * open `TimelineEditDialog` for full editing.
 */
import React, { useState } from 'react';
import type { SpriteTimeline } from '@/types';
import ConfirmModal from './ConfirmModal';
import MiniKeyframeRuler from './MiniKeyframeRuler';

interface TimelineRowProps {
  timeline: SpriteTimeline;
  onOpenEditor: () => void;
  onRemoveTimeline: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const TimelineRow: React.FC<TimelineRowProps> = ({ timeline, onOpenEditor, onRemoveTimeline, onMoveUp, onMoveDown }) => {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onDoubleClick={onOpenEditor}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenEditor();
        }
      }}
      aria-label={`Edit timeline ${timeline.name}`}
      className="flex items-center gap-3 p-2 rounded-md border border-primary bg-secondary cursor-pointer hover:border-accent"
    >
      <span className="flex-1 text-sm font-semibold text-primary truncate">{timeline.name}</span>
      <div className="flex-[2] min-w-0">
        <MiniKeyframeRuler keyframes={timeline.keyframes} duration={timeline.duration} />
      </div>
      {onMoveUp && (
        <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} aria-label="Move up" className="text-xs text-secondary hover:text-primary">&uarr;</button>
      )}
      {onMoveDown && (
        <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} aria-label="Move down" className="text-xs text-secondary hover:text-primary">&darr;</button>
      )}
      <button onClick={(e) => { e.stopPropagation(); setShowRemoveConfirm(true); }} aria-label="Remove" className="text-xs text-red-600 dark:text-red-400 hover:underline">Remove</button>

      {showRemoveConfirm && (
        <ConfirmModal
          title="Remove Timeline"
          confirmText="Remove"
          onClose={() => setShowRemoveConfirm(false)}
          onConfirm={() => { setShowRemoveConfirm(false); onRemoveTimeline(); }}
        >
          Remove timeline &ldquo;{timeline.name}&rdquo;? This deletes all of its keyframes and cannot be undone.
        </ConfirmModal>
      )}
    </div>
  );
};

export default TimelineRow;
