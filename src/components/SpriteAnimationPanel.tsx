/**
 * @file SpriteAnimationPanel.tsx
 * @description Root panel for one sprite's `SpriteAnimation`, opened from
 * the "Timeline" toggle in `SceneComposer`. Renders a combine-mode toggle
 * (hidden until 2+ timelines exist), a compact table of `TimelineRow`
 * summaries, an "+ Add Timeline" button, and a single overall play/scrub
 * control that previews the sprite's fully combined animation. Full editing
 * of a timeline happens in `TimelineEditDialog`, opened by double-clicking a
 * row or immediately after adding a new timeline. The generated ATL itself
 * comes from `atlCodeGenerator.ts`, independent of this preview.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AnimatableProperty, SpriteAnimation, SpriteTimeline } from '@/types';
import TimelineRow from './TimelineRow';
import TimelineEditDialog from './TimelineEditDialog';
import ConfirmModal from './ConfirmModal';
import { startPlayback, interpolateSpriteAnimation, getTotalDuration, type PlaybackHandle } from '@/lib/timelinePreview';
import { createId } from '@/lib/createId';
import { MATRIX_FACTOR_PROPERTIES, getActiveTimelines } from '@/lib/atlCodeGenerator';

interface SpriteAnimationPanelProps {
  spriteLabel: string;
  animation: SpriteAnimation | null;
  /** Current static value of each property on the underlying sprite, used as the default for new/backfilled keyframe values. */
  currentValues: Record<AnimatableProperty, number>;
  /** True disables the four matrix-factor checkboxes on every TimelineRow: this sprite already has a static color effect applied (tint/colorize, or a non-default saturation/brightness/contrast/invert), and animating color together with an existing static effect isn't supported. */
  hasStaticTint: boolean;
  /** Creates the animation (with a starter timeline) and returns that starter timeline's id, so its edit dialog can be opened immediately. */
  onCreateAnimation: () => string;
  onChangeAnimation: (updater: (prev: SpriteAnimation) => SpriteAnimation) => void;
  onDeleteAnimation: () => void;
  /** Called every preview frame with interpolated values, and with `null` when playback stops/resets. */
  onPreviewUpdate: (values: Partial<Record<AnimatableProperty, number>> | null) => void;
}

function createTimeline(spriteLabel: string, index: number): SpriteTimeline {
  return { id: createId('tl'), name: `${spriteLabel}${index}`, properties: [], keyframes: [], duration: 1, loop: false };
}

const SpriteAnimationPanel: React.FC<SpriteAnimationPanelProps> = ({
  spriteLabel, animation, currentValues, hasStaticTint, onCreateAnimation, onChangeAnimation, onDeleteAnimation, onPreviewUpdate,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingTimelineId, setEditingTimelineId] = useState<string | null>(null);
  const playbackRef = useRef<PlaybackHandle | null>(null);

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setIsPlaying(false);
  }, []);

  // Stop playback and clear the live preview override whenever the selected sprite's animation changes/unmounts.
  useEffect(() => () => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setIsPlaying(false);
    setPlayheadTime(0);
    onPreviewUpdate(null);
  }, [animation?.spriteId, onPreviewUpdate]);

  if (!animation) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-secondary mb-3">No animation for {spriteLabel} yet.</p>
        <button onClick={() => setEditingTimelineId(onCreateAnimation())} className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold">
          + Add Animation
        </button>
      </div>
    );
  }

  const timelines = animation.timelines ?? [];
  const totalDuration = getTotalDuration(animation);
  // Matches atlCodeGenerator's honorLoop, which only honors loop on the last *active*
  // (keyframed + property-bearing) sequential timeline, not necessarily the last in the array.
  const activeTimelines = getActiveTimelines(animation);
  const lastLoopableId = activeTimelines.length > 0
    ? activeTimelines[activeTimelines.length - 1].id
    : timelines[timelines.length - 1]?.id;

  const hasOverlappingProperties = (() => {
    const seen = new Set<AnimatableProperty>();
    let timelinesWithAMatrixFactor = 0;
    for (const t of timelines) {
      if (t.properties.some(p => MATRIX_FACTOR_PROPERTIES.includes(p))) timelinesWithAMatrixFactor++;
      for (const p of t.properties) {
        if (seen.has(p)) return true;
        seen.add(p);
      }
    }
    return timelinesWithAMatrixFactor > 1;
  })();

  const handlePlay = () => {
    if (isPlaying) { stopPlayback(); return; }
    setIsPlaying(true);
    playbackRef.current = startPlayback(
      animation,
      (values, elapsed) => { setPlayheadTime(elapsed); onPreviewUpdate(values); },
      () => { setIsPlaying(false); playbackRef.current = null; }
    );
  };

  const handleScrub = (time: number) => {
    stopPlayback();
    setPlayheadTime(time);
    onPreviewUpdate(interpolateSpriteAnimation(animation, time));
  };

  const setCombineMode = (combineMode: SpriteAnimation['combineMode']) => {
    onChangeAnimation(prev => ({ ...prev, combineMode }));
  };

  const handleAddTimeline = () => {
    const usedIndices = timelines
      .map(t => {
        if (!t.name.startsWith(spriteLabel)) return -1;
        const suffix = t.name.slice(spriteLabel.length);
        return /^\d+$/.test(suffix) ? Number(suffix) : -1;
      })
      .filter(n => n >= 0);
    const nextIndex = usedIndices.length > 0 ? Math.max(...usedIndices) + 1 : 0;
    const newTimeline = createTimeline(spriteLabel, nextIndex);
    onChangeAnimation(prev => ({ ...prev, timelines: [...(prev.timelines ?? []), newTimeline] }));
    setEditingTimelineId(newTimeline.id);
  };

  const handleRemoveTimeline = (id: string) => {
    onChangeAnimation(prev => ({ ...prev, timelines: (prev.timelines ?? []).filter(t => t.id !== id) }));
  };

  const handleChangeTimeline = (id: string, updater: (prev: SpriteTimeline) => SpriteTimeline) => {
    onChangeAnimation(prev => ({ ...prev, timelines: (prev.timelines ?? []).map(t => t.id === id ? updater(t) : t) }));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    onChangeAnimation(prev => {
      const timelines = [...(prev.timelines ?? [])];
      const target = index + direction;
      [timelines[index], timelines[target]] = [timelines[target], timelines[index]];
      return { ...prev, timelines };
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-primary">{spriteLabel}</h3>
        <button onClick={() => setShowDeleteConfirm(true)} className="text-xs text-red-600 dark:text-red-400 hover:underline">Remove Animation</button>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Remove Animation"
          confirmText="Remove"
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => { setShowDeleteConfirm(false); onDeleteAnimation(); }}
        >
          Remove the animation for {spriteLabel}? This deletes all of its timelines and keyframes and cannot be undone.
        </ConfirmModal>
      )}

      {timelines.length >= 2 && (
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="combine-mode"
              value="parallel"
              checked={animation.combineMode === 'parallel'}
              disabled={hasOverlappingProperties}
              title={hasOverlappingProperties ? 'Cannot switch to Parallel: two or more timelines share a property, or multiple timelines each animate a color property (saturation/brightness/contrast/invert) that shares one ATL value. Remove the overlap first.' : undefined}
              onChange={() => setCombineMode('parallel')}
            />
            Parallel
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="combine-mode" value="sequential" checked={animation.combineMode === 'sequential'} onChange={() => setCombineMode('sequential')} />
            Sequential
          </label>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handlePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="px-3 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-sm font-bold w-16"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="text-xs font-mono text-secondary ml-auto">{playheadTime.toFixed(2)}s / {totalDuration.toFixed(2)}s</span>
      </div>

      <input
        type="range"
        min={0}
        max={totalDuration}
        step={0.05}
        value={Math.min(playheadTime, totalDuration)}
        onChange={(e) => handleScrub(Number(e.target.value))}
        aria-label="Playhead"
        className="w-full"
      />

      <div className="space-y-1">
        <div className="flex items-center gap-3 px-2 text-xs font-semibold text-secondary uppercase tracking-wide">
          <span className="flex-1">Name</span>
          <span className="flex-[2]">Keyframes</span>
        </div>
        {timelines.map((timeline, index) => (
          <TimelineRow
            key={timeline.id}
            timeline={timeline}
            onOpenEditor={() => setEditingTimelineId(timeline.id)}
            onRemoveTimeline={() => handleRemoveTimeline(timeline.id)}
            onMoveUp={index > 0 ? () => handleMove(index, -1) : undefined}
            onMoveDown={index < timelines.length - 1 ? () => handleMove(index, 1) : undefined}
          />
        ))}
      </div>

      <button onClick={handleAddTimeline} className="w-full px-3 py-1.5 rounded border border-dashed border-primary text-secondary hover:text-primary hover:border-accent text-sm font-bold">
        + Add Timeline
      </button>

      {(() => {
        const editingIndex = timelines.findIndex(t => t.id === editingTimelineId);
        if (editingIndex === -1) return null;
        const editingTimeline = timelines[editingIndex];
        return (
          <TimelineEditDialog
            timeline={editingTimeline}
            combineMode={animation.combineMode}
            canLoop={animation.combineMode === 'parallel' || editingTimeline.id === lastLoopableId}
            propertiesClaimedBySiblings={timelines.filter((_, i) => i !== editingIndex).flatMap(t => t.properties)}
            hasStaticTint={hasStaticTint}
            currentValues={currentValues}
            onChangeTimeline={(updater) => handleChangeTimeline(editingTimeline.id, updater)}
            onClose={() => setEditingTimelineId(null)}
          />
        );
      })()}
    </div>
  );
};

export default SpriteAnimationPanel;
