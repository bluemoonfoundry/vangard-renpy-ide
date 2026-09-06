/**
 * @file TimelineEditDialog.tsx
 * @description Modal for fully editing one `SpriteTimeline`: name, property
 * picker, duration/loop, and a ruler spanning the timeline's duration with a
 * dot per keyframe. Click empty ruler space to add a keyframe there (values
 * default to `currentValues`); click a dot to open `PoseKeyframeEditor`; drag
 * a dot to reposition it in time (native pointer events, per this repo's
 * canvas convention -- see CLAUDE.md). Opened from a `TimelineRow` summary
 * row (double-click) or immediately after adding a new timeline.
 */
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AnimatableProperty, PoseKeyframe, SpriteTimeline } from '@/types';
import PoseKeyframeEditor, { VALUE_RANGE_BY_PROPERTY } from './PoseKeyframeEditor';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import { createId } from '@/lib/createId';
import { MATRIX_FACTOR_PROPERTIES } from '@/lib/atlCodeGenerator';
import { PROPERTY_ORDER, PROPERTY_LABEL } from '@/lib/animatableProperties';

interface TimelineEditDialogProps {
  timeline: SpriteTimeline;
  /** Properties already claimed by a sibling timeline on the same sprite -- disabled in the picker when `combineMode === 'parallel'` for simple properties, or unconditionally (both combine modes) for matrix-factor properties (saturation/brightness/contrast/invert), since those always share one ATL matrixcolor value regardless of combine mode. */
  propertiesClaimedBySiblings: AnimatableProperty[];
  combineMode: 'parallel' | 'sequential';
  /** False disables the Loop checkbox: only the last timeline in a sequential sequence may safely loop (an earlier one would repeat forever and block every timeline after it — see atlCodeGenerator.ts's sequential honorLoop logic). Always true in parallel mode. */
  canLoop: boolean;
  /** True disables the four matrix-factor checkboxes: this sprite already has a static color effect applied (tint/colorize, or a non-default saturation/brightness/contrast/invert), and animating color together with an existing static effect isn't supported. */
  hasStaticTint: boolean;
  /** Current static value of each property on the underlying sprite, used as the default for new/backfilled keyframe values. */
  currentValues: Record<AnimatableProperty, number>;
  onChangeTimeline: (updater: (prev: SpriteTimeline) => SpriteTimeline) => void;
  onClose: () => void;
}

const TimelineEditDialog: React.FC<TimelineEditDialogProps> = ({
  timeline, propertiesClaimedBySiblings, combineMode, canLoop, hasStaticTint, currentValues, onChangeTimeline, onClose,
}) => {
  const [editingKeyframeId, setEditingKeyframeId] = useState<string | null>(null);
  const [draggingKeyframeId, setDraggingKeyframeId] = useState<string | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const dragStartClientXRef = useRef(0);
  const dragMovedRef = useRef(false);
  const { modalProps, contentRef } = useModalAccessibility({ isOpen: true, onClose, titleId: 'timeline-edit-dialog-title' });

  const editingKeyframe = timeline.keyframes.find(kf => kf.id === editingKeyframeId) ?? null;
  const isFirstKeyframe = editingKeyframe
    ? [...timeline.keyframes].sort((a, b) => a.time - b.time)[0]?.id === editingKeyframe.id
    : false;

  const toggleProperty = (property: AnimatableProperty) => {
    onChangeTimeline(prev => {
      const has = prev.properties.includes(property);
      if (has) {
        return {
          ...prev,
          properties: prev.properties.filter(p => p !== property),
          keyframes: prev.keyframes.map(kf => {
            const values = { ...kf.values };
            delete values[property];
            return { ...kf, values };
          }),
        };
      }
      const backfillValue = currentValues[property];
      return {
        ...prev,
        properties: [...prev.properties, property],
        keyframes: prev.keyframes.map(kf => ({ ...kf, values: { ...kf.values, [property]: backfillValue } })),
      };
    });
  };

  const setName = (name: string) => onChangeTimeline(prev => ({ ...prev, name }));
  const setDuration = (duration: number) => onChangeTimeline(prev => {
    const clampedDuration = Math.max(0.1, duration);
    return {
      ...prev,
      duration: clampedDuration,
      keyframes: prev.keyframes.map(kf => kf.time > clampedDuration ? { ...kf, time: clampedDuration } : kf),
    };
  });
  const setLoop = (loop: boolean) => onChangeTimeline(prev => ({ ...prev, loop }));

  const timeFromClientX = (clientX: number): number => {
    const rect = rulerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(fraction * timeline.duration * 20) / 20; // snap to 0.05s
  };

  const handleRulerClick = (e: React.MouseEvent) => {
    if (e.target !== rulerRef.current) return; // ignore clicks that landed on a dot
    const time = timeFromClientX(e.clientX);
    const values: Partial<Record<AnimatableProperty, number>> = {};
    for (const property of timeline.properties) values[property] = currentValues[property];
    const newKeyframe: PoseKeyframe = { id: createId('pk'), time, values, easing: 'linear' };
    onChangeTimeline(prev => ({ ...prev, keyframes: [...prev.keyframes, newKeyframe] }));
    setEditingKeyframeId(newKeyframe.id);
  };

  const handleDotPointerDown = (e: React.PointerEvent, keyframeId: string) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartClientXRef.current = e.clientX;
    dragMovedRef.current = false;
    setDraggingKeyframeId(keyframeId);
  };

  const handleDotPointerMove = (e: React.PointerEvent) => {
    if (!draggingKeyframeId) return;
    if (Math.abs(e.clientX - dragStartClientXRef.current) > 2) dragMovedRef.current = true;
    const time = timeFromClientX(e.clientX);
    onChangeTimeline(prev => ({
      ...prev,
      keyframes: prev.keyframes.map(kf => kf.id === draggingKeyframeId ? { ...kf, time } : kf),
    }));
  };

  const handleDotPointerUp = (e: React.PointerEvent) => {
    if (draggingKeyframeId) {
      const target = e.target as HTMLElement;
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
      setDraggingKeyframeId(null);
    }
  };

  const handleDotClick = (e: React.MouseEvent, keyframeId: string) => {
    e.stopPropagation();
    if (dragMovedRef.current) {
      dragMovedRef.current = false; // this click is the synthetic one following a drag -- suppress opening the editor
      return;
    }
    setEditingKeyframeId(keyframeId);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onClose}>
      <div
        ref={contentRef}
        {...modalProps}
        className="bg-secondary rounded-lg shadow-2xl w-full max-w-lg m-4 flex flex-col border border-primary text-primary max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-primary flex items-center justify-between">
          <h2 id="timeline-edit-dialog-title" className="text-lg font-bold">Edit Timeline</h2>
          <button onClick={onClose} aria-label="Close" className="text-secondary hover:text-primary p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <main className="p-4 space-y-3">
          <input
            type="text"
            value={timeline.name}
            onChange={e => setName(e.target.value)}
            aria-label="Timeline name"
            className="w-full text-sm font-semibold rounded border border-primary bg-secondary text-primary px-2 py-1"
          />

          <div className="flex flex-wrap gap-3">
            {PROPERTY_ORDER.map(property => {
              const isSelected = timeline.properties.includes(property);
              const isMatrixFactor = MATRIX_FACTOR_PROPERTIES.includes(property);
              const isDisabledBySibling = !isSelected && (
                (combineMode === 'parallel' && propertiesClaimedBySiblings.includes(property)) ||
                (isMatrixFactor && propertiesClaimedBySiblings.some(p => MATRIX_FACTOR_PROPERTIES.includes(p)))
              );
              const isDisabledByTint = hasStaticTint && !isSelected && isMatrixFactor;
              const isDisabled = isDisabledBySibling || isDisabledByTint;
              const title = isDisabledByTint
                ? "Disabled: this sprite has a static tint/colorize applied — animating color together with a static tint isn't supported."
                : (isMatrixFactor && isDisabledBySibling)
                ? "Disabled: another timeline on this sprite already animates a color property (saturation/brightness/contrast/invert) — they all share one ATL matrixcolor value, so only one timeline can own them."
                : undefined;
              return (
                <label key={property} className={`flex items-center gap-1 text-xs ${isDisabled ? 'text-secondary opacity-50' : 'text-primary'}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    title={title}
                    onChange={() => toggleProperty(property)}
                    aria-label={PROPERTY_LABEL[property]}
                  />
                  {PROPERTY_LABEL[property]}
                </label>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-secondary">
              Duration
              <input type="number" min={0.1} step={0.1} value={timeline.duration} onChange={e => setDuration(Number(e.target.value))} className="w-16 text-xs rounded border border-primary bg-secondary text-primary px-1 py-0.5" />
              s
            </label>
            <label className="flex items-center gap-1 text-xs text-secondary">
              <input
                type="checkbox"
                checked={timeline.loop}
                disabled={!canLoop}
                title={!canLoop ? 'Only the last timeline in a sequential sequence can loop.' : undefined}
                onChange={e => setLoop(e.target.checked)}
              />
              Loop
            </label>
          </div>

          {timeline.properties.length === 0 ? (
            <p className="text-xs text-secondary italic py-2">Pick at least one property to start keyframing</p>
          ) : (
            <div
              ref={rulerRef}
              role="button"
              aria-label="Add keyframe"
              onClick={handleRulerClick}
              onPointerMove={handleDotPointerMove}
              onPointerUp={handleDotPointerUp}
              className="relative h-6 rounded bg-tertiary border border-primary cursor-pointer"
            >
              {timeline.keyframes.map(kf => (
                <button
                  key={kf.id}
                  type="button"
                  aria-label={`keyframe at ${kf.time.toFixed(2)}s`}
                  onPointerDown={(e) => handleDotPointerDown(e, kf.id)}
                  onClick={(e) => handleDotClick(e, kf.id)}
                  style={{ left: `${timeline.duration > 0 ? (kf.time / timeline.duration) * 100 : 0}%` }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent border-2 border-white dark:border-gray-800 shadow cursor-grab active:cursor-grabbing"
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {editingKeyframe && (
        <PoseKeyframeEditor
          keyframe={editingKeyframe}
          properties={timeline.properties}
          duration={timeline.duration}
          isFirstKeyframe={isFirstKeyframe}
          onClose={() => setEditingKeyframeId(null)}
          onSave={(updated) => {
            const clampedValues: Partial<Record<AnimatableProperty, number>> = {};
            for (const property of timeline.properties) {
              const range = VALUE_RANGE_BY_PROPERTY[property];
              const raw = updated.values[property] ?? 0;
              clampedValues[property] = Math.max(range.min, Math.min(range.max, raw));
            }
            onChangeTimeline(prev => ({
              ...prev,
              keyframes: prev.keyframes.map(kf => kf.id === updated.id ? { ...updated, values: clampedValues } : kf),
            }));
            setEditingKeyframeId(null);
          }}
          onDelete={() => {
            onChangeTimeline(prev => ({ ...prev, keyframes: prev.keyframes.filter(kf => kf.id !== editingKeyframe.id) }));
            setEditingKeyframeId(null);
          }}
        />
      )}
    </div>,
    document.body
  );
};

export default TimelineEditDialog;
