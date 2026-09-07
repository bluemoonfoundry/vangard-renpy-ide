# Timeline Editor: Matrix-Color Property Animation

## Problem

The Timeline Editor's animatable-property set (`AnimatableProperty` in
`src/types.ts`: `x`, `y`, `zoom`, `alpha`, `rotation`, `blur`) is narrower
than what Ren'Py's ATL actually supports. Auditing the full `SceneSprite`
property surface (`src/types.ts:868-892`) against ATL capability, one gap is
straightforward to close: `saturation`, `brightness`, `contrast`, and
`invert` are plain numeric factors that `SceneComposer.tsx`'s
`spriteEffectCode()`/`spriteVisualFilter()` already compose into a single
ATL `matrixcolor` expression for the static (non-animated) case
(`SaturationMatrix(n) * BrightnessMatrix(n) * ContrastMatrix(n) *
InvertMatrix(n)`), and ATL's `matrixcolor` property does support
interpolation between two matrix values via the normal warp syntax.

Three other gaps were identified but are explicitly **out of scope** for
this pass, each for a different reason:

- **Tint/colorize color** (`colorMode`, `tintColor`, `colorizeBlack`,
  `colorizeWhite`) — these are colors (hex strings), not numbers, and would
  require `PoseKeyframe.values` to support string-valued properties, not
  just numbers. A real type change for a much rarer creative need (smoothly
  blending between two tint colors) than "fade the brightness."
- **Shader uniforms** (`activeShader`/`shaderUniforms`) — the property
  *names* are dynamic, dependent on which shader is active. Breaks the
  closed-union model `AnimatableProperty` currently is; a different
  mechanism, not new union members.
- **Flip** (`flipH`/`flipV`) — blocked on splitting `SceneSprite.zoom` into
  independent x/y axes first, a prerequisite change to the sprite
  properties system itself, outside the Timeline Editor.
- **zIndex** — not an ATL transform property at all (it's a `zorder`
  argument on the `show` statement). Permanently out of scope, not just
  deferred.

## Interaction with Static Tint/Colorize: Kept Simple

`saturation`/`brightness`/`contrast`/`invert` don't have their own ATL
token — they compose into `matrixcolor` alongside the sprite's *static*
tint/colorize settings in the non-animated case. Animating them on a sprite
that also has a static tint/colorize applied would require either (a)
composing the static tint into the same generated `matrixcolor` expression
the animated transform emits (extra plumbing: `generateATLFromTimeline`
would need the sprite's static color fields as context, which it doesn't
take today), or (b) accepting two competing `matrixcolor` assignments for
the same sprite with unverified Ren'Py conflict-resolution semantics.

**Decision: keep it simple.** Do not support animating these four
properties on a sprite that has `colorMode !== 'none'`. The property picker
disables them with an explanatory tooltip instead. No codegen plumbing for
composing static + animated color state; no risk of an unverified Ren'Py
interaction.

## Data Model (`src/types.ts`)

Extend `AnimatableProperty`:

```typescript
export type AnimatableProperty = 'x' | 'y' | 'zoom' | 'alpha' | 'rotation' | 'blur' | 'saturation' | 'brightness' | 'contrast' | 'invert';
```

No other type changes. `PoseKeyframe.values: Partial<Record<AnimatableProperty, number>>` already covers these — they're plain numbers, same shape as the existing six.

## UI (`PoseKeyframeEditor.tsx`, `TimelineRow.tsx`)

Both files' `PROPERTY_ORDER` arrays gain the four new entries, in this
canonical order (used everywhere — picker rendering, keyframe editor slider
order, and codegen's composed-matrixcolor multiplication order):

```typescript
const PROPERTY_ORDER: AnimatableProperty[] = ['x', 'y', 'zoom', 'alpha', 'rotation', 'blur', 'saturation', 'brightness', 'contrast', 'invert'];
```

`PoseKeyframeEditor.tsx`'s `VALUE_RANGE_BY_PROPERTY` gains, matching
`SceneSpriteProperties.tsx`'s existing static sliders exactly (same
ranges/steps, so the animated and static editing experiences feel
consistent):

```typescript
  saturation: { min: 0, max: 2, step: 0.05 },
  brightness: { min: -1, max: 1, step: 0.05 },
  contrast: { min: 0.1, max: 3, step: 0.05 },
  invert: { min: 0, max: 1, step: 0.1 },
```

`TimelineRow.tsx`'s `PROPERTY_LABEL` gains `saturation: 'Saturation'`,
`brightness: 'Brightness'`, `contrast: 'Contrast'`, `invert: 'Invert'`.

### Static-tint disabling

`TimelineRow` gains a new required prop:

```typescript
  /** True disables the four matrix-factor checkboxes (saturation/brightness/contrast/invert): the sprite has a static tint/colorize applied, and animating color together with a static tint isn't supported. */
  hasStaticTint: boolean;
```

In the property picker, a matrix-factor property (`saturation`,
`brightness`, `contrast`, `invert`) is disabled when `hasStaticTint` is
true, with `title="Disabled: this sprite has a static tint/colorize
applied — animating color together with a static tint isn't supported."`
This is independent of and composes with the existing
`combineMode === 'parallel' && propertiesClaimedBySiblings.includes(...)`
disabling rule — either condition alone disables the checkbox.

`SpriteAnimationPanel.tsx` computes and passes `hasStaticTint` down to
every `TimelineRow` it renders. `SceneComposer.tsx` computes it once from
`activeSprite`, matching `spriteEffectCode`'s own exact guard conditions
for when it actually emits a tint/colorize matrix term (not just
`colorMode !== 'none'`, which would false-positive-block a `'tint'` mode
with no `tintColor` set yet):

```typescript
const hasStaticTint = (activeSprite.colorMode === 'tint' && !!activeSprite.tintColor) || activeSprite.colorMode === 'colorize';
```

## Code Generation (`atlCodeGenerator.ts`)

`generateTimelineCode` currently emits one `<atlName> <value>` token per
property in a keyframe's ordered property list. It needs to split that list
into two groups per keyframe:

- **Simple properties** (`x`, `y`, `zoom`, `alpha`, `rotation`, `blur`) —
  unchanged, each still emits its own token via `ATL_PROPERTY_NAME`.
- **Matrix-factor properties** (`saturation`, `brightness`, `contrast`,
  `invert`) — collected into a single `matrixcolor <expr>` token, only for
  the ones actually present in `timeline.properties`, multiplied together
  in canonical order using the same `Matrix(...)` constructor names
  `spriteEffectCode` already uses:

```typescript
const MATRIX_FACTOR_CONSTRUCTOR: Partial<Record<AnimatableProperty, (v: number) => string>> = {
  saturation: (v) => `SaturationMatrix(${formatValue(v)})`,
  brightness: (v) => `BrightnessMatrix(${formatValue(v)})`,
  contrast: (v) => `ContrastMatrix(${formatValue(v)})`,
  invert: (v) => `InvertMatrix(${formatValue(v)})`,
};
```

The composed `matrixcolor` token, if any matrix-factor properties are
present, is appended **last** on each generated line — both the
first-keyframe's static property lines and every subsequent warp line —
matching where `spriteEffectCode` already places `matrixcolor` relative to
position/alpha in the static (non-animated) case.

Example: a timeline covering `alpha` and `saturation`, going from `{alpha:
0, saturation: 1}` to `{alpha: 1, saturation: 1.5}` over 1 second with
`linear` easing, generates:

```
    alpha 0
    matrixcolor SaturationMatrix(1)
    linear 1 alpha 1 matrixcolor SaturationMatrix(1.5)
```

(`formatValue` collapses trailing zeros via `Number(x.toFixed(3)).toString()`, so `1.0` renders as `1`, not `1.000` — shown here as the function actually behaves.)

`transformNameFor` and the parallel/sequential combination logic in
`generateATLFromTimeline` are unchanged — this only affects how one
timeline's own property list becomes ATL text.

## Testing

- `atlCodeGenerator.test.ts`: a timeline mixing a simple property and
  matrix factors produces one combined warp line with `matrixcolor` last; a
  timeline with only matrix factors composes just those (no `matrixcolor`
  token when zero matrix-factor properties are present, even if the
  timeline has other properties); canonical multiplication order
  (`SaturationMatrix * BrightnessMatrix * ContrastMatrix * InvertMatrix`)
  is deterministic regardless of the order properties were checked in the
  picker.
- `TimelineRow.test.tsx`: the four matrix-factor checkboxes are disabled
  (with the tooltip text) when `hasStaticTint` is true, enabled when false;
  a property already disabled by `hasStaticTint` stays disabled regardless
  of `combineMode`/sibling-conflict state, and the two disabling rules
  don't interfere with each other for properties that only trigger one of
  them.

## Out of Scope

- Tint/colorize color interpolation (needs string-valued keyframe support).
- Shader uniform animation (needs a dynamic-property mechanism).
- Flip animation (needs `zoom` split into independent x/y axes first).
- zIndex (not an ATL transform property; permanently out of scope).
- Composing static tint/colorize into an animated `matrixcolor` expression
  (deliberately deferred — see "Interaction with Static Tint/Colorize"
  above; revisit only if a real user need for combining both emerges).
