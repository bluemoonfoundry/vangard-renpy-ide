/**
 * @file MiniKeyframeRuler.tsx
 * @description Non-interactive keyframe visualization for a `SpriteTimeline`
 * summary row in `TimelineRow`: a bar spanning the timeline's duration with a
 * dot per keyframe. Purely presentational -- the interactive version (click to
 * add, drag to move, click a dot to edit) lives in `TimelineEditDialog`.
 */
import React from 'react';
import type { PoseKeyframe } from '@/types';

interface MiniKeyframeRulerProps {
  keyframes: PoseKeyframe[];
  duration: number;
}

const MiniKeyframeRuler: React.FC<MiniKeyframeRulerProps> = ({ keyframes, duration }) => {
  if (keyframes.length === 0) {
    return <p className="text-xs text-secondary italic">No keyframes</p>;
  }

  return (
    <div className="relative h-4 rounded bg-tertiary border border-primary" aria-hidden="true">
      {keyframes.map(kf => (
        <span
          key={kf.id}
          style={{ left: `${duration > 0 ? (kf.time / duration) * 100 : 0}%` }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent border border-white dark:border-gray-800"
        />
      ))}
    </div>
  );
};

export default MiniKeyframeRuler;
