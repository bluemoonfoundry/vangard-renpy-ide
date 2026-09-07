/**
 * @file atlPresetLibrary.ts
 * @description Hardcoded library of parameterized ATL (Animation & Transform
 * Language) presets, browsed via `ATLPresetBrowser`. Each preset's
 * `atlTemplate` is a transform *body* (no `transform NAME:` header) meant to
 * be pasted inside an existing transform block, with `{paramName}`
 * placeholders filled in by `instantiatePreset`.
 */
import type { ATLPreset, ATLPresetParameter } from '@/types';

const EASING_OPTIONS = ['linear', 'ease', 'easein', 'easeout'];

function easingParam(defaultValue: string): ATLPresetParameter {
  return { name: 'easing', type: 'easing', defaultValue, options: EASING_OPTIONS };
}

function durationParam(defaultValue: number, min = 0.05, max = 5): ATLPresetParameter {
  return { name: 'duration', type: 'duration', defaultValue, min, max, step: 0.05 };
}

type RawPreset = Omit<ATLPreset, 'code'>;

const RAW_PRESETS: RawPreset[] = [
  // --- Movement ---
  {
    title: 'Slide In (Left)',
    description: 'Sprite enters from off-screen on the left.',
    tags: ['entrance', 'movement'],
    parameters: [durationParam(0.5), easingParam('easeout'), { name: 'distance', type: 'offset', defaultValue: 300, min: 50, max: 1000, step: 10 }],
    atlTemplate: 'xoffset -{distance}\n{easing} {duration} xoffset 0',
  },
  {
    title: 'Slide In (Right)',
    description: 'Sprite enters from off-screen on the right.',
    tags: ['entrance', 'movement'],
    parameters: [durationParam(0.5), easingParam('easeout'), { name: 'distance', type: 'offset', defaultValue: 300, min: 50, max: 1000, step: 10 }],
    atlTemplate: 'xoffset {distance}\n{easing} {duration} xoffset 0',
  },
  {
    title: 'Slide Out (Left)',
    description: 'Sprite exits off-screen to the left.',
    tags: ['exit', 'movement'],
    parameters: [durationParam(0.5), easingParam('easein'), { name: 'distance', type: 'offset', defaultValue: 300, min: 50, max: 1000, step: 10 }],
    atlTemplate: 'xoffset 0\n{easing} {duration} xoffset -{distance}',
  },
  {
    title: 'Slide Out (Right)',
    description: 'Sprite exits off-screen to the right.',
    tags: ['exit', 'movement'],
    parameters: [durationParam(0.5), easingParam('easein'), { name: 'distance', type: 'offset', defaultValue: 300, min: 50, max: 1000, step: 10 }],
    atlTemplate: 'xoffset 0\n{easing} {duration} xoffset {distance}',
  },
  {
    title: 'Bounce',
    description: 'Sprite bounces up and settles back down.',
    tags: ['movement', 'emphasis'],
    parameters: [durationParam(0.3), { name: 'intensity', type: 'intensity', defaultValue: 40, min: 10, max: 200, step: 5 }],
    atlTemplate: 'easeout {duration} yoffset -{intensity}\neasein {duration} yoffset 0',
  },
  {
    title: 'Shake',
    description: 'Sprite shakes rapidly from side to side.',
    tags: ['movement', 'emphasis'],
    parameters: [
      { name: 'duration', type: 'duration', defaultValue: 0.1, min: 0.05, max: 1.0, step: 0.05 },
      { name: 'intensity', type: 'intensity', defaultValue: 10, min: 5, max: 50, step: 5 },
      { name: 'repeat_count', type: 'repeat', defaultValue: 3, min: 1, max: 10, step: 1 },
    ],
    atlTemplate: 'parallel:\n    linear {duration} xoffset {intensity}\n    linear {duration} xoffset -{intensity}\nrepeat {repeat_count}',
  },

  // --- Opacity ---
  {
    title: 'Fade In',
    description: 'Sprite fades in from fully transparent.',
    tags: ['entrance', 'opacity'],
    parameters: [durationParam(1.0), easingParam('linear')],
    atlTemplate: 'alpha 0.0\n{easing} {duration} alpha 1.0',
  },
  {
    title: 'Fade Out',
    description: 'Sprite fades out to fully transparent.',
    tags: ['exit', 'opacity'],
    parameters: [durationParam(1.0), easingParam('linear')],
    atlTemplate: 'alpha 1.0\n{easing} {duration} alpha 0.0',
  },
  {
    title: 'Dissolve',
    description: 'Sprite fades in while gently zooming to full size.',
    tags: ['entrance', 'opacity'],
    parameters: [durationParam(1.2), easingParam('easeout')],
    atlTemplate: 'alpha 0.0\nzoom 0.95\nparallel:\n    {easing} {duration} alpha 1.0\n    {easing} {duration} zoom 1.0',
  },

  // --- Scale ---
  {
    title: 'Pop In',
    description: 'Sprite scales up from nothing while fading in.',
    tags: ['entrance', 'scale'],
    parameters: [durationParam(0.3)],
    atlTemplate: 'zoom 0.0\nalpha 0.0\nparallel:\n    easeout {duration} zoom 1.0\n    easeout {duration} alpha 1.0',
  },
  {
    title: 'Pop Out',
    description: 'Sprite scales down to nothing while fading out.',
    tags: ['exit', 'scale'],
    parameters: [durationParam(0.3)],
    atlTemplate: 'zoom 1.0\nalpha 1.0\nparallel:\n    easein {duration} zoom 0.0\n    easein {duration} alpha 0.0',
  },
  {
    title: 'Zoom Pulse',
    description: 'Sprite pulses larger and back to normal size, repeatedly.',
    tags: ['scale', 'loop'],
    parameters: [
      durationParam(0.4),
      { name: 'peak_zoom', type: 'intensity', defaultValue: 1.1, min: 1.0, max: 2.0, step: 0.05 },
      { name: 'repeat_count', type: 'repeat', defaultValue: 3, min: 1, max: 20, step: 1 },
    ],
    atlTemplate: 'parallel:\n    linear {duration} zoom {peak_zoom}\n    linear {duration} zoom 1.0\nrepeat {repeat_count}',
  },

  // --- Rotation ---
  {
    title: 'Spin',
    description: 'Sprite rotates a full 360 degrees, repeatedly.',
    tags: ['rotation', 'loop'],
    parameters: [durationParam(1.0), { name: 'repeat_count', type: 'repeat', defaultValue: 1, min: 1, max: 20, step: 1 }],
    atlTemplate: 'rotate 0\nlinear {duration} rotate 360\nrepeat {repeat_count}',
  },
  {
    title: 'Wobble',
    description: 'Sprite rocks back and forth like a pendulum.',
    tags: ['rotation', 'loop'],
    parameters: [
      durationParam(0.2),
      { name: 'angle', type: 'intensity', defaultValue: 8, min: 1, max: 45, step: 1 },
      { name: 'repeat_count', type: 'repeat', defaultValue: 3, min: 1, max: 20, step: 1 },
    ],
    atlTemplate: 'rotate 0\nparallel:\n    linear {duration} rotate {angle}\n    linear {duration} rotate -{angle}\nrepeat {repeat_count}',
  },

  // --- Combined ---
  {
    title: 'Roll Across',
    description: 'Sprite slides in from the left while rotating a full turn.',
    tags: ['entrance', 'combined'],
    parameters: [durationParam(0.8), easingParam('easeout'), { name: 'distance', type: 'offset', defaultValue: 300, min: 50, max: 1000, step: 10 }],
    atlTemplate: 'xoffset -{distance}\nrotate 0\nparallel:\n    {easing} {duration} xoffset 0\n    linear {duration} rotate 360',
  },
  {
    title: 'Dramatic Entrance',
    description: 'Sprite drops in from above while zooming and fading in.',
    tags: ['entrance', 'combined'],
    parameters: [durationParam(0.6), { name: 'distance', type: 'offset', defaultValue: 150, min: 20, max: 500, step: 10 }],
    atlTemplate: 'zoom 0.5\nalpha 0.0\nyoffset -{distance}\nparallel:\n    easeout {duration} zoom 1.0\n    easeout {duration} alpha 1.0\n    easeout {duration} yoffset 0',
  },
];

/** Clamps a numeric parameter value to its `min`/`max`, if set; strings pass through unchanged. */
function clampParamValue(param: ATLPresetParameter, value: number | string): number | string {
  if (typeof value === 'string') return value;
  let clamped = value;
  if (param.min !== undefined) clamped = Math.max(param.min, clamped);
  if (param.max !== undefined) clamped = Math.min(param.max, clamped);
  return clamped;
}

/** Formats a parameter value for insertion into ATL code: numbers are rounded to 2 decimals with no trailing zeros. */
function formatParamValue(value: number | string): string {
  if (typeof value === 'string') return value;
  return Number(value.toFixed(2)).toString();
}

/**
 * Substitutes each `{paramName}` placeholder in `preset.atlTemplate` with a
 * value from `values` (falling back to the parameter's `defaultValue`),
 * clamped to that parameter's `min`/`max`.
 */
export function instantiatePreset(
  preset: Pick<ATLPreset, 'atlTemplate' | 'parameters'>,
  values: Record<string, number | string> = {}
): string {
  let code = preset.atlTemplate;
  for (const param of preset.parameters) {
    const raw = values[param.name] ?? param.defaultValue;
    const clamped = clampParamValue(param, raw);
    code = code.replace(new RegExp(`\\{${param.name}\\}`, 'g'), formatParamValue(clamped));
  }
  return code;
}

function defaultParamValues(preset: RawPreset): Record<string, number | string> {
  const values: Record<string, number | string> = {};
  for (const param of preset.parameters) {
    values[param.name] = param.defaultValue;
  }
  return values;
}

/** The full ATL preset library, each with `code` pre-filled from its parameters' default values. */
export const ATL_PRESETS: ATLPreset[] = RAW_PRESETS.map(preset => ({
  ...preset,
  code: instantiatePreset(preset, defaultParamValues(preset)),
}));

/**
 * Converts a preset's `atlTemplate` into a Monaco snippet body: each unique
 * `{paramName}` placeholder becomes a `${n:defaultValue}` tabstop (repeated
 * occurrences of the same param share one tabstop, so editing either updates
 * both), for use with Monaco's `InsertAsSnippet` insert rule.
 */
export function presetToMonacoSnippet(preset: Pick<ATLPreset, 'atlTemplate' | 'parameters'>): string {
  const indexByName = new Map<string, number>();
  for (const param of preset.parameters) {
    if (!indexByName.has(param.name)) indexByName.set(param.name, indexByName.size + 1);
  }

  let snippet = preset.atlTemplate;
  for (const [name, index] of indexByName) {
    const param = preset.parameters.find(p => p.name === name)!;
    snippet = snippet.replace(new RegExp(`\\{${name}\\}`, 'g'), `\${${index}:${param.defaultValue}}`);
  }
  return snippet;
}
