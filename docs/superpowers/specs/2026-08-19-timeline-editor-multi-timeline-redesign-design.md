# Timeline Editor: Multi-Timeline Redesign

## Problem

Phase 2 of the Timeline Editor (merged, not yet pushed) gives each sprite a
single `SpriteAnimation` with six fixed, always-present tracks — one per
`SceneSprite` property (`x`, `y`, `zoom`, `alpha`, `rotation`, `blur`) — each
with its own independent list of keyframes. Every animated property change
is wrapped in an artificial `parallel:` ATL block per property, even for the
common case of a single combined move (e.g. slide + fade together).

This over-complicates the common case and under-serves the real one: a
single ATL warp statement (`easein 1.0 xcenter 0.5 alpha 1.0`) already
changes multiple properties together under one duration/easing — that's how
`parallel:`-free ATL naturally works. The fixed-six-tracks model doesn't let
the user express that directly, and it can't express "these two properties
should ease differently over the same time span" without hand-authoring
separate tracks that happen to share start/end times.

This redesign replaces the fixed-tracks model with a small, user-managed set
of **timelines** per sprite: each timeline is a pose-keyframe sequence
scoped to whichever properties the user picks, and timelines combine either
simultaneously or in sequence.

Since this hasn't been pushed to `origin/main`, no migration path is needed
— old-shaped `scene.animations` data is simply dropped (treated as absent)
once this ships.

## Data Model (`src/types.ts`)

Replaces `Keyframe`, `KeyframeTrack`, and the current `SpriteAnimation`.

```typescript
export type AnimatableProperty = 'x' | 'y' | 'zoom' | 'alpha' | 'rotation' | 'blur';

/** A full pose snapshot for a timeline's covered properties, at a point in time. */
export interface PoseKeyframe {
  id: string;
  /** Seconds from the start of this timeline (not the sprite's other timelines). */
  time: number;
  /** One value per property in the owning timeline's `properties` set. */
  values: Partial<Record<AnimatableProperty, number>>;
  /** Easing applied to the transition arriving at this keyframe from the previous one. Ignored on a timeline's first keyframe. */
  easing: EasingFunction;
}

/** One named, independently-timed pose-keyframe sequence, scoped to a subset of the owning sprite's animatable properties. */
export interface SpriteTimeline {
  id: string;
  name: string;
  properties: AnimatableProperty[];
  keyframes: PoseKeyframe[];
  duration: number;
  loop: boolean;
}

/** All timeline-based animation for one sprite (SceneSprite.id, or 'background'). */
export interface SpriteAnimation {
  spriteId: string;
  /** How this sprite's timelines combine: simultaneously (default), or one after another in list order. */
  combineMode: 'parallel' | 'sequential';
  timelines: SpriteTimeline[];
}
```

`SceneComposition.animations?: SpriteAnimation[]` and
`SerializedSceneComposition.animations?: SpriteAnimation[]` keep their field
name and array-of-one-per-sprite shape, so `useProjectIO.ts` and
`projectSerializer.ts`'s pass-through lines (`animations: sc.animations`)
need no changes.

`EasingFunction` (`src/lib/easingFunctions.ts`) is unchanged.

### Invariants

- A sprite has at most one `SpriteAnimation` (found via
  `animations?.find(a => a.spriteId === id)`), same as before.
- **Property exclusivity in parallel mode**: when `combineMode === 'parallel'`,
  no two of a sprite's timelines may share a property in their `properties`
  set. Enforced in the UI (see below), not just validated after the fact.
- **No exclusivity in sequential mode**: when `combineMode === 'sequential'`,
  timelines may freely share properties — this is the expected way to
  express "fade in, then fade back out" as two timelines.
- Editing a timeline's `properties` set is allowed at any time, including
  when it already has keyframes:
  - Adding a property backfills every existing `PoseKeyframe.values` on that
    timeline with the sprite's current static value for it (same default a
    brand-new keyframe would use).
  - Removing a property deletes that key from every existing
    `PoseKeyframe.values` on that timeline.
- `combineMode` defaults to `'parallel'` when a sprite's first timeline is
  created. It's inert (no observable effect) until a second timeline exists.
- Timeline `name` is prefilled as `${spriteTag}${index}` (e.g. `bob0`,
  `bob1`) where `spriteTag` is the sprite's Ren'Py image tag and `index` is
  the count of the sprite's existing timelines at creation time (not
  reused/decremented on delete — creating a third timeline after deleting
  the first still gets index 2). The user can rename freely; names are not
  required to be unique (purely a UI label, never emitted into ATL).

## Components

Replaces `SpriteTimeline.tsx`, `SpriteTimelineTrack.tsx`, `KeyframeEditor.tsx`.

### `SpriteAnimationPanel` (replaces `SpriteTimeline.tsx`)

Root panel for the sprite selected in `SceneComposer`, shown when the
Timeline toggle is on (unchanged entry point).

- If the sprite has no `SpriteAnimation`: an "+ Add Timeline" prompt (same
  as today's "+ Add Animation", but creating a `SpriteAnimation` with one
  empty `SpriteTimeline` in a single action, since a `SpriteAnimation` with
  zero timelines is a pointless intermediate state).
- Once it has one: a `combineMode` toggle (Parallel / Sequential) — hidden
  or disabled while only one timeline exists, since it has no effect yet.
- A list of `TimelineRow`s, one per `SpriteTimeline`, each removable and
  reorderable (up/down buttons, matching the existing Layers panel's
  drag-and-drop convention would be overkill here — this list is rarely
  more than 2-3 items). List order matters: it's the sequential-mode play
  order, and the display order in parallel mode (cosmetic there).
- "+ Add Timeline" button appends another `TimelineRow` to the end (empty
  properties, 0 keyframes, prefilled name).
- One overall Play/Pause button and scrubber previewing the sprite's full
  combined animation (see Preview Playback below) — not per-timeline.

### `TimelineRow` (new; folds in what `SpriteTimelineTrack` did)

One timeline, rendered as an expandable row:

- Editable name field.
- Property picker: a checkbox per `AnimatableProperty`. In `'parallel'`
  mode, a property already claimed by another of the sprite's timelines is
  disabled with a tooltip ("Already used by 'bob0'"). In `'sequential'`
  mode, nothing is disabled.
- Duration (number input) and Loop (checkbox) controls, same style as the
  current `SpriteTimeline.tsx` header controls.
- A ruler spanning `[0, duration]` with one dot per `PoseKeyframe`. Click
  empty ruler space to add a keyframe there (values default to the sprite's
  current static values for this timeline's properties); click a dot to
  open `PoseKeyframeEditor`; drag a dot to reposition it in time — same
  pointer-event mechanics as the current `SpriteTimelineTrack`.
- Disabled/greyed with a placeholder message ("Pick at least one property
  to start keyframing") while `properties` is empty.

### `PoseKeyframeEditor` (replaces `KeyframeEditor`)

Modal for one `PoseKeyframe`: one slider per property *currently in the
owning timeline's `properties` set* (not a fixed six), using the same
`VALUE_RANGE_BY_PROPERTY` bounds as today, plus the easing dropdown
(hidden on a timeline's first keyframe, as today). Delete/Save/Cancel
footer, unchanged from today's `KeyframeEditor`.

## Preview Playback (`src/lib/timelinePreview.ts`)

Replaces `interpolateTrack`/`interpolateAnimation`. New entry point:
`interpolateSpriteAnimation(anim: SpriteAnimation, time: number): Partial<Record<AnimatableProperty, number>>`.

- **Parallel**: every timeline plays from `t=0` simultaneously. At any
  instant, interpolate each timeline independently (nearest-keyframe pair,
  same easing/lerp logic as today's `interpolateTrack`, generalized to a
  pose instead of a scalar) and merge the results — safe, since parallel
  timelines never share properties.
- **Sequential**: each timeline gets a start offset (sum of the durations
  of the timelines before it in list order). At instant `t`, find which
  timeline's `[offset, offset + duration)` window contains it and
  interpolate locally within that window using `t - offset`. For any
  `AnimatableProperty` not covered by the currently-active timeline, hold
  the last value set by a *previous* timeline in the sequence that did
  cover it (search backward through prior timelines' final keyframes),
  falling back to the sprite's static base value if no prior timeline ever
  touched it. This mirrors how ATL leaves properties untouched by later
  statements at whatever value an earlier statement last set them to.
- `startPlayback` (rAF loop) is updated to call `interpolateSpriteAnimation`
  instead of `interpolateAnimation`, and its total duration becomes
  `max(timeline durations)` in parallel mode or `sum(timeline durations)`
  in sequential mode.

## Code Generation (`src/lib/atlCodeGenerator.ts`)

- `transformNameFor(spriteId: string): string` replaces the current
  `transformNameFor(anim: SpriteAnimation)` — becomes simply
  `` `${spriteId}_animation` `` (slugified as before), since there's no
  longer a user-facing animation name to slugify (only timeline names,
  which stay UI-only).
- New `generateTimelineCode(timeline: SpriteTimeline, indent: string): string`
  (replaces `generateTrackCode`): first keyframe emits one plain-property
  line per covered property (`xcenter 0`, `alpha 0`, ...); each subsequent
  keyframe emits **one** combined warp line covering every property in
  `timeline.properties`
  (`` `${easing} ${duration} ${prop1} ${v1} ${prop2} ${v2}` ``, properties
  ordered `x, y, zoom, alpha, rotation, blur` — `AnimatableProperty`'s
  declaration order — for stable, deterministic output regardless of the
  order the user checked them in the picker), sorted by time as today.
  Trailing `repeat` line if `timeline.loop`.
- `generateATLFromTimeline(anim: SpriteAnimation): string` (name kept,
  signature changes) builds the full `transform <name>:` block:
  - `'parallel'`: each timeline with keyframes becomes its own nested
    `parallel:` branch (multiple timelines) or is emitted directly with no
    `parallel:` wrapper (exactly one timeline with keyframes) — same
    single-vs-multiple distinction the current code already makes for
    tracks.
  - `'sequential'`: each timeline's block is concatenated directly, one
    after another, in list order — no `parallel:` wrapper, since ATL's
    default statement-sequence behavior already runs them one after
    another.
  - A timeline with zero keyframes contributes nothing (same as an empty
    track today).
  - Zero timelines with keyframes still falls back to `` `transform NAME:\n    pass\n` ``.

`ATL_PROPERTY_NAME` mapping (`x`→`xcenter`, `y`→`ycenter`, `rotation`→`rotate`,
others unchanged) is unchanged.

## `SceneComposer.tsx` Integration

- `activeAnimation` lookup (`scene.animations?.find(a => a.spriteId === id)`)
  is unchanged in shape, just returns the new `SpriteAnimation` type.
- `handleCreateAnimation` now creates a `SpriteAnimation` with one starter
  `SpriteTimeline` (empty properties/keyframes, prefilled name, duration 1,
  not looping), rather than the old flat `tracks: []`.
- `handleChangeAnimation` (updater over the active `SpriteAnimation`) is
  reused as-is; `TimelineRow`s call it with updaters that operate on
  `prev.timelines`.
- `animatedAnimationBySpriteId` (feeds code generation) keeps its current
  filter condition (`anim.timelines.some(t => t.keyframes.length > 0)`
  instead of `anim.tracks.some(...)`).
- `withTimelinePreview` swaps its call from `interpolateAnimation` /
  per-track lookups to `interpolateSpriteAnimation`.

## Testing

- `src/lib/timelinePreview.test.ts`: parallel merge of two non-overlapping
  timelines; sequential offset computation and window selection; sequential
  hold-forward for a property not covered by the active timeline; single
  timeline (both modes collapse to the same behavior).
- `src/lib/atlCodeGenerator.test.ts`: single-timeline single-property
  (unchanged shape from today); single timeline covering multiple
  properties (one combined warp line, not one per property); two timelines
  in parallel (nested `parallel:` branches); two timelines sequential (no
  `parallel:`, concatenated); loop; empty-timelines fallback to `pass`.
- `src/components/TimelineRow.test.tsx` (replaces
  `SpriteTimelineTrack.test.tsx`): add/edit/delete a `PoseKeyframe`;
  property picker disables a property claimed by a sibling timeline in
  parallel mode and doesn't in sequential mode; changing properties
  backfills/drops keyframe values.
- `src/components/SpriteAnimationPanel.test.tsx` (replaces
  `SpriteTimeline.test.tsx`): add/remove/reorder a timeline; `combineMode`
  toggle visibility and effect; overall play/scrub against a two-timeline
  sprite in both modes; sequential playback order following a reorder.

## Out of Scope

- Undo/redo integration for timeline/keyframe edits (already a known gap
  from Phase 2, unchanged by this redesign).
- Timeline ruler zoom/snapping.
- Manual verification by running a game in Ren'Py.
- Any change to the ATL Preset Library (Phase 1) — untouched by this spec.
