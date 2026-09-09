/**
 * @file atlPresetLibrary.ts
 * @description Hardcoded library of parameterized ATL (Animation & Transform
 * Language) presets, browsed via `ATLPresetBrowser`. Each preset's
 * `atlTemplate` is a transform *body* (no `transform NAME:` header) meant to
 * be pasted inside an existing transform block, with `{paramName}`
 * placeholders filled in by `instantiatePreset`.
 */
import type { ATLPreset, ATLPresetParameter } from '@/types';

const EASING_OPTIONS = [
  'linear', 'ease', 'easein', 'easeout',
  'easein_quad', 'easeout_quad',
  'easein_cubic', 'easeout_cubic',
  'easein_sine', 'easeout_sine',
  'easein_back', 'easeout_back',
  'easein_bounce', 'easeout_bounce',
];

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
    title: 'Bobbing Loop',
    description: 'Sprite continuously bobs up and down, looping forever.',
    tags: ['movement', 'loop'],
    parameters: [durationParam(1.0), { name: 'intensity', type: 'intensity', defaultValue: 20, min: 5, max: 100, step: 5 }],
    atlTemplate: 'yoffset 0\neasein {duration} yoffset -{intensity}\neaseout {duration} yoffset 0\nrepeat',
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

  // --- Events ---
  {
    title: 'Show/Hide Transition',
    description: 'Slides in when the image is shown and slides out when it is hidden, using on show/on hide blocks.',
    tags: ['entrance', 'exit', 'movement', 'events'],
    parameters: [durationParam(0.5), easingParam('easeout'), { name: 'distance', type: 'offset', defaultValue: 300, min: 50, max: 1000, step: 10 }],
    atlTemplate: 'on show:\n    xoffset -{distance}\n    {easing} {duration} xoffset 0\non hide:\n    {easing} {duration} xoffset {distance}',
  },

  // --- Camera & Staging ---
  {
    title: 'Slow Suspense Push-In',
    description: 'Glacial zoom-in onto a focal point to slowly build psychological tension.',
    tags: ['camera-staging', 'scale'],
    parameters: [durationParam(4.0, 1, 15), easingParam('easein_cubic'), { name: 'zoom_target', type: 'intensity', defaultValue: 1.25, min: 1.0, max: 2.0, step: 0.05 }],
    atlTemplate: 'zoom 1.0\n{easing} {duration} zoom {zoom_target}',
  },
  {
    title: 'Crash Zoom (Snap Zoom)',
    description: 'Immediate, sudden acceleration zoom on a shocking reveal or realization.',
    tags: ['camera-staging', 'scale', 'emphasis'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.15, min: 0.05, max: 0.5, step: 0.05 }, { name: 'zoom_target', type: 'intensity', defaultValue: 1.6, min: 1.1, max: 3.0, step: 0.05 }],
    atlTemplate: 'zoom 1.0\neasein_back {duration} zoom {zoom_target}',
  },
  {
    title: 'Vertigo / Dolly Zoom',
    description: 'Warps optical field of view, keeping subject stationary while perspective expands. Pair with an opposite zoom on the background layer for the full effect.',
    tags: ['camera-staging', 'scale'],
    parameters: [durationParam(1.5, 0.5, 5), { name: 'zoom_start', type: 'intensity', defaultValue: 1.0, min: 0.5, max: 2.0, step: 0.05 }, { name: 'zoom_end', type: 'intensity', defaultValue: 1.6, min: 0.5, max: 3.0, step: 0.05 }],
    atlTemplate: 'zoom {zoom_start}\nlinear {duration} zoom {zoom_end}',
  },
  {
    title: 'Subtle Handheld Breathing',
    description: 'Micro non-linear wobble simulating a physical camera operator.',
    tags: ['camera-staging', 'loop'],
    parameters: [durationParam(1.2, 0.3, 3), { name: 'intensity', type: 'intensity', defaultValue: 4, min: 1, max: 20, step: 1 }, { name: 'angle', type: 'intensity', defaultValue: 0.5, min: 0.1, max: 3, step: 0.1 }],
    atlTemplate: 'linear {duration} xoffset {intensity} yoffset {intensity} rotate {angle}\nlinear {duration} xoffset -{intensity} yoffset -{intensity} rotate -{angle}\nrepeat',
  },
  {
    title: 'Whip Pan',
    description: 'Rapid horizontal sweep with directional motion blur across the scene.',
    tags: ['camera-staging', 'movement'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.25, min: 0.1, max: 0.8, step: 0.05 }, easingParam('easein_cubic'), { name: 'distance', type: 'offset', defaultValue: 800, min: 100, max: 2000, step: 50 }, { name: 'blur_amount', type: 'intensity', defaultValue: 30, min: 5, max: 60, step: 5 }],
    atlTemplate: 'xoffset 0\nblur {blur_amount}\nparallel:\n    {easing} {duration} xoffset {distance}\nparallel:\n    linear {duration} blur 0.0',
  },
  {
    title: 'Establishing Pan',
    description: 'Smooth, slow horizontal sweep across a wide panoramic environment.',
    tags: ['camera-staging', 'movement'],
    parameters: [durationParam(5.0, 1, 20), easingParam('easein_sine'), { name: 'distance', type: 'offset', defaultValue: 400, min: 50, max: 2000, step: 50 }],
    atlTemplate: 'xoffset 0\nsubpixel True\n{easing} {duration} xoffset {distance}',
  },
  {
    title: 'Dutch Angle Drift',
    description: 'Subtle off-axis tilt signaling unease, disorientation, or moral decay.',
    tags: ['camera-staging', 'rotation'],
    parameters: [durationParam(2.0, 0.5, 8), easingParam('easein_sine'), { name: 'angle', type: 'intensity', defaultValue: 4, min: 1, max: 15, step: 1 }],
    atlTemplate: 'subpixel True\nrotate 0\n{easing} {duration} rotate {angle}',
  },
  {
    title: 'Character Reveal Pan-Up',
    description: 'Slow vertical tilt tracking upward from feet to face for introductions.',
    tags: ['camera-staging', 'entrance', 'movement'],
    parameters: [durationParam(1.5, 0.5, 5), easingParam('easeout'), { name: 'distance', type: 'offset', defaultValue: 250, min: 50, max: 800, step: 10 }],
    atlTemplate: 'yoffset {distance}\n{easing} {duration} yoffset 0',
  },
  {
    title: 'Rack Focus',
    description: 'Optical depth shift, blurring foreground while sharpening background.',
    tags: ['camera-staging'],
    parameters: [durationParam(0.8, 0.2, 3), { name: 'blur_start', type: 'intensity', defaultValue: 12, min: 0, max: 30, step: 1 }, { name: 'blur_end', type: 'intensity', defaultValue: 0, min: 0, max: 30, step: 1 }],
    atlTemplate: 'blur {blur_start}\neaseout {duration} blur {blur_end}',
  },
  {
    title: 'Over-The-Shoulder Shift',
    description: 'Framing and depth emphasis adjustment during dialogue exchanges.',
    tags: ['camera-staging', 'movement'],
    parameters: [durationParam(0.6, 0.2, 2), easingParam('ease'), { name: 'distance', type: 'offset', defaultValue: 150, min: 20, max: 500, step: 10 }, { name: 'zoom_target', type: 'intensity', defaultValue: 1.1, min: 1.0, max: 1.5, step: 0.05 }],
    atlTemplate: 'xoffset 0\nzoom 1.0\nparallel:\n    {easing} {duration} xoffset {distance}\nparallel:\n    {easing} {duration} zoom {zoom_target}',
  },
  {
    title: 'Tracking Slide',
    description: "Synchronized camera pan matching an actor's walking or running speed.",
    tags: ['camera-staging', 'movement'],
    parameters: [durationParam(1.0, 0.3, 4), { name: 'distance', type: 'offset', defaultValue: 400, min: 50, max: 2000, step: 50 }],
    atlTemplate: 'xoffset 0\nlinear {duration} xoffset {distance}',
  },
  {
    title: 'Vehicle Vibration',
    description: 'Micro-jitter simulating physical travel in a train, car, or cockpit.',
    tags: ['camera-staging', 'loop'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.06, min: 0.02, max: 0.2, step: 0.01 }, { name: 'intensity', type: 'intensity', defaultValue: 3, min: 1, max: 15, step: 1 }, { name: 'repeat_count', type: 'repeat', defaultValue: 8, min: 1, max: 30, step: 1 }],
    atlTemplate: 'linear {duration} xoffset {intensity} yoffset -{intensity}\nlinear {duration} xoffset -{intensity} yoffset {intensity}\nrepeat {repeat_count}',
  },
  {
    title: 'Crane Jib Rise',
    description: 'Smooth vertical camera lift coupled with an expanding perspective.',
    tags: ['camera-staging', 'movement'],
    parameters: [durationParam(2.0, 0.5, 6), easingParam('easeout_cubic'), { name: 'distance', type: 'offset', defaultValue: 200, min: 30, max: 800, step: 10 }, { name: 'zoom_target', type: 'intensity', defaultValue: 1.15, min: 1.0, max: 2.0, step: 0.05 }],
    atlTemplate: 'yoffset {distance}\nzoom 1.0\nparallel:\n    {easing} {duration} yoffset 0\nparallel:\n    {easing} {duration} zoom {zoom_target}',
  },
  {
    title: 'Dynamic Two-Shot Center',
    description: 'Automatic reframing and zoom widening to accommodate an entering actor.',
    tags: ['camera-staging'],
    parameters: [durationParam(0.8, 0.2, 2.5), { name: 'align_target', type: 'intensity', defaultValue: 0.5, min: 0.0, max: 1.0, step: 0.05 }, { name: 'zoom_target', type: 'intensity', defaultValue: 0.9, min: 0.5, max: 1.0, step: 0.05 }],
    atlTemplate: 'xalign 0.5\nzoom 1.0\nparallel:\n    ease_cubic {duration} xalign {align_target}\nparallel:\n    ease_cubic {duration} zoom {zoom_target}',
  },
  {
    title: 'Focus Puller Wobble',
    description: 'Focus slightly overshoots the target before locking into crisp clarity.',
    tags: ['camera-staging'],
    parameters: [durationParam(0.3, 0.1, 1), { name: 'overshoot', type: 'intensity', defaultValue: 10, min: 2, max: 30, step: 1 }],
    atlTemplate: 'blur 0.0\nlinear {duration} blur {overshoot}\neaseout {duration} blur 0.0',
  },

  // --- Character Acting ---
  {
    title: 'Idle Micro-Breathing',
    description: 'Natural looped chest expansion and vertical float to eliminate static poses.',
    tags: ['character-acting', 'loop'],
    parameters: [durationParam(1.8, 0.5, 4), { name: 'intensity', type: 'intensity', defaultValue: 4, min: 1, max: 15, step: 1 }, { name: 'yzoom_target', type: 'intensity', defaultValue: 1.01, min: 1.0, max: 1.1, step: 0.01 }],
    atlTemplate: 'yoffset 0\nyzoom 1.0\nlinear {duration} yoffset -{intensity} yzoom {yzoom_target}\nlinear {duration} yoffset 0 yzoom 1.0\nrepeat',
  },
  {
    title: 'Startled Flinch / Jolt',
    description: 'Sudden upward reflex snap with an elastic dampening settle.',
    tags: ['character-acting', 'emphasis'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.2, min: 0.05, max: 0.6, step: 0.05 }, { name: 'intensity', type: 'intensity', defaultValue: 30, min: 5, max: 100, step: 5 }],
    atlTemplate: 'yoffset 0\neaseout_bounce {duration} yoffset -{intensity}\neasein {duration} yoffset 0',
  },
  {
    title: 'Timid Step-Back',
    description: 'Hesitant retreat coupled with a slight downward posture dip.',
    tags: ['character-acting', 'movement'],
    parameters: [durationParam(0.5, 0.2, 1.5), { name: 'distance', type: 'offset', defaultValue: 60, min: 10, max: 300, step: 5 }, { name: 'intensity', type: 'intensity', defaultValue: 10, min: 2, max: 40, step: 2 }],
    atlTemplate: 'xoffset 0\nyoffset 0\neasein_quad {duration} xoffset -{distance} yoffset {intensity}',
  },
  {
    title: 'Aggressive Step-Forward',
    description: 'Assertive advance toward the player accompanied by a scale bump.',
    tags: ['character-acting', 'movement', 'emphasis'],
    parameters: [durationParam(0.35, 0.1, 1), { name: 'zoom_target', type: 'intensity', defaultValue: 1.08, min: 1.0, max: 1.4, step: 0.02 }, { name: 'intensity', type: 'intensity', defaultValue: 15, min: 2, max: 60, step: 2 }],
    atlTemplate: 'zoom 1.0\nyoffset 0\neaseout_cubic {duration} zoom {zoom_target} yoffset -{intensity}',
  },
  {
    title: 'Intimate Lean-In',
    description: 'Slow drift and slight scale increase toward the dialogue partner.',
    tags: ['character-acting', 'movement'],
    parameters: [durationParam(1.0, 0.3, 3), { name: 'zoom_target', type: 'intensity', defaultValue: 1.05, min: 1.0, max: 1.3, step: 0.01 }, { name: 'distance', type: 'offset', defaultValue: 20, min: 5, max: 100, step: 5 }],
    atlTemplate: 'zoom 1.0\nxoffset 0\nyoffset 0\nease {duration} zoom {zoom_target} xoffset {distance} yoffset -5',
  },
  {
    title: 'Dejected Slump',
    description: 'Downward sag and slight rotational tilt conveying exhaustion or defeat.',
    tags: ['character-acting', 'movement'],
    parameters: [durationParam(0.8, 0.3, 2.5), { name: 'intensity', type: 'intensity', defaultValue: 20, min: 5, max: 80, step: 5 }, { name: 'angle', type: 'intensity', defaultValue: 4, min: 1, max: 15, step: 1 }],
    atlTemplate: 'yoffset 0\nrotate 0\neasein_sine {duration} yoffset {intensity} rotate {angle}',
  },
  {
    title: 'Nod of Agreement',
    description: 'Rhythmic double dip down and up indicating non-verbal assent.',
    tags: ['character-acting'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.15, min: 0.05, max: 0.5, step: 0.05 }, { name: 'intensity', type: 'intensity', defaultValue: 12, min: 3, max: 50, step: 1 }],
    atlTemplate: 'yoffset 0\neaseout {duration} yoffset {intensity}\neasein {duration} yoffset 0\neaseout {duration} yoffset {intensity}\neasein {duration} yoffset 0',
  },
  {
    title: 'Head Shake (Doubt)',
    description: 'Side-to-side rotational oscillation signaling skepticism.',
    tags: ['character-acting'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.18, min: 0.05, max: 0.5, step: 0.01 }, { name: 'angle', type: 'intensity', defaultValue: 2, min: 1, max: 10, step: 1 }, { name: 'repeat_count', type: 'repeat', defaultValue: 2, min: 1, max: 8, step: 1 }],
    atlTemplate: 'rotate 0\nblock:\n    ease {duration} rotate {angle}\n    ease {duration} rotate -{angle}\n    repeat {repeat_count}\nease {duration} rotate 0',
  },
  {
    title: 'Nervous Pacing',
    description: 'Looping walk cycles with horizontal turnaround flips.',
    tags: ['character-acting', 'loop', 'movement'],
    parameters: [durationParam(0.9, 0.3, 3), { name: 'distance', type: 'offset', defaultValue: 120, min: 20, max: 500, step: 10 }],
    atlTemplate: 'xoffset 0\nxzoom 1.0\nlinear {duration} xoffset {distance}\nlinear 0.05 xzoom -1.0\nlinear {duration} xoffset 0\nlinear 0.05 xzoom 1.0\nrepeat',
  },
  {
    title: 'Shiver / Tremble',
    description: 'Micro-amplitude horizontal vibration indicating intense fear or cold.',
    tags: ['character-acting', 'loop'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.05, min: 0.02, max: 0.15, step: 0.01 }, { name: 'intensity', type: 'intensity', defaultValue: 3, min: 1, max: 15, step: 1 }, { name: 'repeat_count', type: 'repeat', defaultValue: 6, min: 1, max: 30, step: 1 }],
    atlTemplate: 'parallel:\n    linear {duration} xoffset {intensity}\n    linear {duration} xoffset -{intensity}\nrepeat {repeat_count}',
  },
  {
    title: 'Exasperated Sigh',
    description: 'Inhalation lift followed by a heavy, decelerated slump downward.',
    tags: ['character-acting'],
    parameters: [durationParam(0.7, 0.2, 2), { name: 'intensity', type: 'intensity', defaultValue: 12, min: 3, max: 50, step: 1 }, { name: 'yzoom_target', type: 'intensity', defaultValue: 1.02, min: 1.0, max: 1.1, step: 0.01 }],
    atlTemplate: 'yoffset 0\nyzoom 1.0\neaseout {duration} yoffset -{intensity} yzoom {yzoom_target}\neasein_quad {duration} yoffset {intensity} yzoom 1.0',
  },
  {
    title: 'Float / Levitation',
    description: 'Weightless, ethereal sinusoidal hovering for spectral or airborne entities.',
    tags: ['character-acting', 'loop'],
    parameters: [durationParam(1.5, 0.5, 4), { name: 'intensity', type: 'intensity', defaultValue: 15, min: 3, max: 60, step: 1 }],
    atlTemplate: 'yoffset 0\neasein_sine {duration} yoffset -{intensity}\neaseout_sine {duration} yoffset 0\nrepeat',
  },
  {
    title: 'Drunk / Concussed Sway',
    description: 'Unbalanced, asymmetric pendulum wobble conveying loss of equilibrium.',
    tags: ['character-acting', 'loop'],
    parameters: [durationParam(1.0, 0.3, 3), { name: 'angle', type: 'intensity', defaultValue: 6, min: 1, max: 25, step: 1 }, { name: 'distance', type: 'offset', defaultValue: 15, min: 2, max: 80, step: 1 }],
    atlTemplate: 'rotate 0\nxoffset 0\nease {duration} rotate {angle} xoffset {distance}\nease {duration} rotate -{angle} xoffset -{distance}\nrepeat',
  },
  {
    title: 'Sprightly Hop',
    description: 'Playful bounce using squash-and-stretch on takeoff and landing.',
    tags: ['character-acting', 'emphasis'],
    parameters: [durationParam(0.25, 0.1, 0.6), { name: 'intensity', type: 'intensity', defaultValue: 40, min: 10, max: 150, step: 5 }, { name: 'squash', type: 'intensity', defaultValue: 0.85, min: 0.6, max: 1.0, step: 0.01 }],
    atlTemplate: 'yoffset 0\nyzoom 1.0\nxzoom 1.0\neasein {duration} yzoom {squash} xzoom 1.1\neaseout_cubic {duration} yoffset -{intensity} yzoom 1.0 xzoom 1.0\neasein_quad {duration} yoffset 0 yzoom {squash} xzoom 1.1\nlinear 0.05 yzoom 1.0 xzoom 1.0',
  },
  {
    title: 'Cower / Shrink',
    description: 'Downward sinking scale reduction simulating an attempt to hide.',
    tags: ['character-acting'],
    parameters: [durationParam(0.5, 0.2, 1.5), { name: 'zoom_target', type: 'intensity', defaultValue: 0.85, min: 0.5, max: 1.0, step: 0.01 }, { name: 'intensity', type: 'intensity', defaultValue: 15, min: 2, max: 60, step: 1 }],
    atlTemplate: 'zoom 1.0\nyoffset 0\neasein_quad {duration} zoom {zoom_target} yoffset {intensity}',
  },
  {
    title: 'Aversion (Look Away)',
    description: 'Rapid sideward turn and lateral offset avoiding direct eye contact.',
    tags: ['character-acting'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.3, min: 0.1, max: 1, step: 0.05 }, { name: 'distance', type: 'offset', defaultValue: 30, min: 5, max: 150, step: 5 }, { name: 'angle', type: 'intensity', defaultValue: 12, min: 2, max: 45, step: 1 }],
    atlTemplate: 'xoffset 0\nrotate 0\nxzoom 1.0\neaseout_cubic {duration} xoffset {distance} rotate {angle}',
  },
  {
    title: 'Tiptoe Stalk',
    description: 'Slow, calculated periodic vertical dips simulating stealthy movement.',
    tags: ['character-acting', 'loop'],
    parameters: [durationParam(0.6, 0.2, 2), { name: 'intensity', type: 'intensity', defaultValue: 8, min: 2, max: 30, step: 1 }],
    atlTemplate: 'yoffset 0\nlinear {duration} yoffset -{intensity}\nlinear {duration} yoffset 0\nrepeat',
  },
  {
    title: 'Collapse to Knees',
    description: 'Heavy drop down the vertical axis with a bounce impact and faint.',
    tags: ['character-acting', 'emphasis'],
    parameters: [durationParam(0.6, 0.2, 2), { name: 'distance', type: 'offset', defaultValue: 100, min: 20, max: 400, step: 10 }, { name: 'faint_alpha', type: 'intensity', defaultValue: 0.6, min: 0.0, max: 1.0, step: 0.05 }],
    atlTemplate: 'yoffset 0\nalpha 1.0\neasein_cubic {duration} yoffset {distance}\neaseout_bounce 0.15 yoffset {distance}\nlinear {duration} alpha {faint_alpha}',
  },

  // --- Action & Combat ---
  {
    title: 'Screen Punch (Impact)',
    description: 'Directional shock displacement with rapid rebound and decay on hits.',
    tags: ['action-combat', 'emphasis'],
    parameters: [durationParam(0.25, 0.1, 0.6), { name: 'intensity', type: 'intensity', defaultValue: 25, min: 5, max: 100, step: 5 }],
    atlTemplate: 'xoffset 0\nyoffset 0\nlinear 0.03 xoffset {intensity} yoffset -{intensity}\neaseout_cubic {duration} xoffset 0 yoffset 0',
  },
  {
    title: 'Earthquake / Tremor',
    description: 'Sustained oscillating screen shake that tapers in amplitude over time.',
    tags: ['action-combat', 'loop'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.06, min: 0.02, max: 0.2, step: 0.01 }, { name: 'intensity', type: 'intensity', defaultValue: 12, min: 2, max: 50, step: 1 }, { name: 'repeat_count', type: 'repeat', defaultValue: 10, min: 1, max: 40, step: 1 }],
    atlTemplate: 'linear {duration} xoffset {intensity} yoffset -{intensity}\nlinear {duration} xoffset -{intensity} yoffset {intensity}\nrepeat {repeat_count}',
  },
  {
    title: 'Knockback & Wall Bounce',
    description: 'Violent horizontal launch across the screen slamming into the frame edge.',
    tags: ['action-combat', 'emphasis'],
    parameters: [durationParam(0.3, 0.1, 0.8), { name: 'distance', type: 'offset', defaultValue: 400, min: 50, max: 1500, step: 10 }, { name: 'overshoot', type: 'offset', defaultValue: 350, min: 40, max: 1400, step: 10 }],
    atlTemplate: 'xoffset 0\neasein_cubic {duration} xoffset {distance}\neaseout_bounce {duration} xoffset {overshoot}',
  },
  {
    title: 'Bullet-Time Slow-Mo',
    description: 'Rapid motion suddenly decelerating to a crawl before resuming full speed.',
    tags: ['action-combat', 'movement'],
    parameters: [{ name: 'duration_fast', type: 'duration', defaultValue: 0.1, min: 0.02, max: 0.4, step: 0.01 }, { name: 'duration_slow', type: 'duration', defaultValue: 1.2, min: 0.3, max: 3, step: 0.1 }, { name: 'distance', type: 'offset', defaultValue: 600, min: 100, max: 2000, step: 50 }],
    atlTemplate: 'xoffset 0\nlinear {duration_fast} xoffset 200\nlinear {duration_slow} xoffset 400\nlinear {duration_fast} xoffset {distance}',
  },
  {
    title: 'Speed Dash / Flash Step',
    description: 'Extreme horizontal stretch and instantaneous lateral disappearance.',
    tags: ['action-combat', 'exit'],
    parameters: [{ name: 'stretch', type: 'intensity', defaultValue: 2.5, min: 1.2, max: 5, step: 0.1 }, { name: 'distance', type: 'offset', defaultValue: 600, min: 100, max: 2000, step: 50 }],
    atlTemplate: 'xzoom 1.0\nalpha 1.0\nlinear 0.06 xzoom {stretch}\nlinear 0.06 xoffset {distance} alpha 0.0',
  },
  {
    title: 'Explosion Knock-Up',
    description: 'Character launched vertically out of frame, arcing down with a bounce.',
    tags: ['action-combat', 'emphasis'],
    parameters: [durationParam(0.6, 0.2, 1.5), { name: 'distance', type: 'offset', defaultValue: 300, min: 50, max: 1000, step: 10 }, { name: 'angle', type: 'intensity', defaultValue: 60, min: 10, max: 360, step: 10 }],
    atlTemplate: 'yoffset 0\nrotate 0\neaseout_cubic {duration} yoffset -{distance} rotate {angle}\neasein_bounce {duration} yoffset 0',
  },
  {
    title: 'Parry Deflection Twitch',
    description: 'Instantaneous white flash and micro-snap at the point of weapon contact.',
    tags: ['action-combat', 'emphasis'],
    parameters: [{ name: 'flash', type: 'intensity', defaultValue: 0.8, min: 0.2, max: 1.0, step: 0.05 }, { name: 'intensity', type: 'intensity', defaultValue: 8, min: 2, max: 30, step: 1 }],
    atlTemplate: 'matrixcolor BrightnessMatrix(0.0)\nxoffset 0\nlinear 0.03 matrixcolor BrightnessMatrix({flash}) xoffset {intensity}\nlinear 0.05 matrixcolor BrightnessMatrix(0.0) xoffset 0',
  },
  {
    title: 'Glitch Jitter',
    description: 'Chromatic aberration and spatial displacement over fractions of a second.',
    tags: ['action-combat', 'loop'],
    parameters: [{ name: 'intensity', type: 'intensity', defaultValue: 8, min: 2, max: 30, step: 1 }, { name: 'repeat_count', type: 'repeat', defaultValue: 3, min: 1, max: 15, step: 1 }],
    atlTemplate: 'matrixcolor TintMatrix("#ffffff")\nxoffset 0\nlinear 0.02 matrixcolor TintMatrix("#ff00ff") xoffset {intensity}\nlinear 0.02 matrixcolor TintMatrix("#00ffff") xoffset -{intensity}\nlinear 0.02 matrixcolor TintMatrix("#ffffff") xoffset 0\nrepeat {repeat_count}',
  },
  {
    title: 'Slash Recoil',
    description: 'Instantaneous diagonal recoil along the trajectory of a melee strike.',
    tags: ['action-combat', 'emphasis'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.12, min: 0.05, max: 0.4, step: 0.01 }, { name: 'distance', type: 'offset', defaultValue: 40, min: 5, max: 150, step: 5 }],
    atlTemplate: 'xoffset 0\nyoffset 0\neaseout_cubic {duration} xoffset {distance} yoffset -{distance}',
  },
  {
    title: 'Seismic Stomp',
    description: 'Heavy downward thud on screen base followed by reverberating tremors.',
    tags: ['action-combat', 'emphasis'],
    parameters: [durationParam(0.3, 0.1, 0.8), { name: 'distance', type: 'offset', defaultValue: 60, min: 10, max: 250, step: 5 }, { name: 'intensity', type: 'intensity', defaultValue: 10, min: 2, max: 40, step: 1 }, { name: 'repeat_count', type: 'repeat', defaultValue: 4, min: 1, max: 15, step: 1 }],
    atlTemplate: 'yoffset -{distance}\neasein_quad {duration} yoffset 0\nblock:\n    linear 0.05 xoffset {intensity}\n    linear 0.05 xoffset -{intensity}\n    repeat {repeat_count}',
  },
  {
    title: 'Energy Aura Pulse',
    description: 'Pulsing scale and alpha oscillation around a charging character.',
    tags: ['action-combat', 'loop'],
    parameters: [durationParam(0.5, 0.15, 1.5), { name: 'zoom_target', type: 'intensity', defaultValue: 1.08, min: 1.0, max: 1.5, step: 0.02 }],
    atlTemplate: 'zoom 1.0\nalpha 0.6\nlinear {duration} zoom {zoom_target} alpha 1.0\nlinear {duration} zoom 1.0 alpha 0.6\nrepeat',
  },
  {
    title: 'Staggered Multi-Hit',
    description: 'Rapid sequential directional micro-jolts for combo attacks.',
    tags: ['action-combat', 'emphasis'],
    parameters: [{ name: 'intensity', type: 'intensity', defaultValue: 15, min: 3, max: 50, step: 1 }],
    atlTemplate: 'xoffset 0\nyoffset 0\nlinear 0.04 xoffset {intensity}\nlinear 0.04 xoffset 0 yoffset -{intensity}\nlinear 0.04 yoffset 0 xoffset -{intensity}\nlinear 0.04 xoffset 0',
  },
  {
    title: 'Knockout Spin',
    description: 'Character spins and shrinks as they fall downward off-stage after defeat.',
    tags: ['action-combat', 'exit'],
    parameters: [durationParam(0.8, 0.3, 2), { name: 'angle', type: 'intensity', defaultValue: 540, min: 90, max: 1080, step: 90 }, { name: 'zoom_target', type: 'intensity', defaultValue: 0.6, min: 0.1, max: 1.0, step: 0.05 }, { name: 'distance', type: 'offset', defaultValue: 400, min: 50, max: 1500, step: 10 }],
    atlTemplate: 'rotate 0\nzoom 1.0\nyoffset 0\neasein {duration} rotate {angle} zoom {zoom_target} yoffset {distance}',
  },
  {
    title: 'Charged Attack Build-Up',
    description: 'Vibrational contraction drawing inward before explosive release.',
    tags: ['action-combat'],
    parameters: [{ name: 'shrink', type: 'intensity', defaultValue: 0.92, min: 0.7, max: 1.0, step: 0.01 }, { name: 'zoom_target', type: 'intensity', defaultValue: 1.4, min: 1.0, max: 3.0, step: 0.05 }, { name: 'repeat_count', type: 'repeat', defaultValue: 6, min: 1, max: 20, step: 1 }, { name: 'duration', type: 'duration', defaultValue: 0.2, min: 0.05, max: 0.6, step: 0.05 }],
    atlTemplate: 'zoom 1.0\nblock:\n    linear 0.05 zoom {shrink}\n    linear 0.05 zoom 1.0\n    repeat {repeat_count}\neaseout_back {duration} zoom {zoom_target}',
  },
  {
    title: 'Sonic Boom Shockwave',
    description: 'Expanding circular distortion ring displacing outward at supersonic speed.',
    tags: ['action-combat', 'emphasis'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.4, min: 0.1, max: 1, step: 0.05 }, { name: 'zoom_target', type: 'intensity', defaultValue: 3.0, min: 1.5, max: 6.0, step: 0.1 }],
    atlTemplate: 'zoom 0.0\nalpha 1.0\neaseout_cubic {duration} zoom {zoom_target} alpha 0.0',
  },

  // --- Atmosphere & Environment ---
  {
    title: 'Heat Haze Shimmer',
    description: 'Undulating vertical displacement simulating baking desert or asphalt heat (approximated with offset + blur; a true heat-haze needs a GLSL shader).',
    tags: ['atmosphere-enviro', 'loop'],
    parameters: [durationParam(1.0, 0.3, 3), { name: 'intensity', type: 'intensity', defaultValue: 4, min: 1, max: 15, step: 1 }],
    atlTemplate: 'yoffset 0\nblur 1.0\neasein_sine {duration} yoffset {intensity} blur 2.0\neaseout_sine {duration} yoffset 0 blur 1.0\nrepeat',
  },
  {
    title: 'Underwater Current Drift',
    description: 'Slow, buoyant lateral and vertical drift mimicking submerged physics.',
    tags: ['atmosphere-enviro', 'loop'],
    parameters: [durationParam(2.0, 0.5, 5), { name: 'intensity', type: 'intensity', defaultValue: 15, min: 3, max: 60, step: 1 }],
    atlTemplate: 'xoffset 0\nyoffset 0\neasein_sine {duration} xoffset {intensity} yoffset -{intensity}\neaseout_sine {duration} xoffset -{intensity} yoffset {intensity}\nrepeat',
  },
  {
    title: 'Candle / Campfire Flicker',
    description: 'Organic, randomized warm lighting oscillations mimicking firelight.',
    tags: ['atmosphere-enviro', 'loop'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.15, min: 0.05, max: 0.4, step: 0.01 }, { name: 'intensity', type: 'intensity', defaultValue: 0.15, min: 0.02, max: 0.4, step: 0.01 }],
    atlTemplate: 'matrixcolor BrightnessMatrix(0.0)\nlinear {duration} matrixcolor BrightnessMatrix({intensity})\nlinear {duration} matrixcolor BrightnessMatrix(-{intensity})\nrepeat',
  },
  {
    title: 'Fluorescent Tube Blink',
    description: 'Erratic high-speed strobe and hum transitions of failing indoor lighting.',
    tags: ['atmosphere-enviro', 'loop'],
    parameters: [durationParam(1.0, 0.2, 4)],
    atlTemplate: 'alpha 1.0\npause {duration}\nlinear 0.02 alpha 0.2\npause 0.02\nlinear 0.02 alpha 1.0\npause {duration}\nlinear 0.01 alpha 0.0\nlinear 0.01 alpha 1.0\nrepeat',
  },
  {
    title: 'Lightning Flash Strobe',
    description: 'Double-peak instantaneous white burst decaying into ambient dark.',
    tags: ['atmosphere-enviro', 'emphasis'],
    parameters: [durationParam(0.5, 0.1, 2)],
    atlTemplate: 'matrixcolor BrightnessMatrix(0.0)\nlinear 0.03 matrixcolor BrightnessMatrix(1.0)\nlinear 0.05 matrixcolor BrightnessMatrix(0.2)\nlinear 0.03 matrixcolor BrightnessMatrix(1.0)\nlinear {duration} matrixcolor BrightnessMatrix(0.0)',
  },
  {
    title: 'Falling Petals / Snow',
    description: 'Diagonal drifting fall with angular tumbling. For full particle coverage use SnowBlossom() alongside this transform.',
    tags: ['atmosphere-enviro', 'loop'],
    parameters: [durationParam(3.0, 1, 8), { name: 'intensity', type: 'offset', defaultValue: 100, min: 20, max: 500, step: 10 }, { name: 'distance', type: 'offset', defaultValue: 600, min: 100, max: 1500, step: 50 }],
    atlTemplate: 'xoffset 0\nyoffset -{distance}\nrotate 0\nlinear {duration} xoffset {intensity} yoffset {distance} rotate 360\nrepeat',
  },
  {
    title: 'Rising Ambient Dust',
    description: 'Tiny light flecks gently meandering upward through sunlight.',
    tags: ['atmosphere-enviro', 'loop'],
    parameters: [durationParam(3.0, 1, 8), { name: 'intensity', type: 'offset', defaultValue: 200, min: 30, max: 800, step: 10 }],
    atlTemplate: 'yoffset 0\nalpha 0.2\neasein_sine {duration} yoffset -{intensity} alpha 0.8\neaseout_sine {duration} yoffset -{intensity} alpha 0.2\nrepeat',
  },
  {
    title: 'Creeping Shadow Loom',
    description: 'Progressive encroachment of darkness and corner shadows across the scene.',
    tags: ['atmosphere-enviro'],
    parameters: [durationParam(3.0, 1, 10), { name: 'zoom_target', type: 'intensity', defaultValue: 1.15, min: 1.0, max: 1.5, step: 0.05 }, { name: 'alpha_target', type: 'intensity', defaultValue: 0.85, min: 0.0, max: 1.0, step: 0.05 }],
    atlTemplate: 'zoom 1.0\nalpha 0.0\neasein_sine {duration} zoom {zoom_target} alpha {alpha_target}',
  },
  {
    title: 'Rain Streak Parallax',
    description: 'Layered vertical streaks moving at differential speeds for depth in rain.',
    tags: ['atmosphere-enviro', 'loop'],
    parameters: [durationParam(0.6, 0.2, 2), { name: 'distance', type: 'offset', defaultValue: 400, min: 50, max: 1200, step: 10 }, { name: 'blur_amount', type: 'intensity', defaultValue: 6, min: 0, max: 20, step: 1 }],
    atlTemplate: 'yoffset -{distance}\nblur {blur_amount}\nlinear {duration} yoffset {distance}\nrepeat',
  },
  {
    title: 'Sunbeam God-Ray Shimmer',
    description: 'Additive light beams slowly sweeping and fluctuating in optical intensity.',
    tags: ['atmosphere-enviro', 'loop'],
    parameters: [durationParam(2.5, 0.5, 6), { name: 'alpha_target', type: 'intensity', defaultValue: 0.9, min: 0.4, max: 1.0, step: 0.05 }],
    atlTemplate: 'additive 1.0\nalpha 0.4\neasein_sine {duration} alpha {alpha_target}\neaseout_sine {duration} alpha 0.4\nrepeat',
  },
  {
    title: 'Wind Gust Sway',
    description: 'Heavy lateral tilt during sudden gusts, slowly settling back to rest.',
    tags: ['atmosphere-enviro', 'rotation'],
    parameters: [durationParam(0.4, 0.1, 1.2), { name: 'angle', type: 'intensity', defaultValue: 8, min: 2, max: 30, step: 1 }],
    atlTemplate: 'rotate 0\neasein_quad {duration} rotate {angle}\neaseout_sine {duration} rotate 0',
  },
  {
    title: 'Distant Horizon Mirage',
    description: 'Blurry, shimmering micro-displacements across distant skyline elements.',
    tags: ['atmosphere-enviro', 'loop'],
    parameters: [durationParam(2.0, 0.5, 5), { name: 'intensity', type: 'intensity', defaultValue: 3, min: 1, max: 12, step: 1 }, { name: 'blur_amount', type: 'intensity', defaultValue: 4, min: 0, max: 15, step: 1 }],
    atlTemplate: 'xoffset 0\nblur {blur_amount}\neasein_sine {duration} xoffset {intensity}\neaseout_sine {duration} xoffset -{intensity}\nrepeat',
  },

  // --- Psychological & Horror ---
  {
    title: 'Heartbeat Vignette Pulse',
    description: 'Rhythmic contraction timed to an accelerated panic pulse, applied as a double-beat cycle.',
    tags: ['psychological-horror', 'loop'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.12, min: 0.05, max: 0.4, step: 0.01 }, { name: 'zoom_target', type: 'intensity', defaultValue: 1.05, min: 1.0, max: 1.3, step: 0.01 }, { name: 'alpha_max', type: 'intensity', defaultValue: 0.8, min: 0.1, max: 1.0, step: 0.05 }],
    atlTemplate: 'zoom 1.0\nalpha 0.0\neaseout {duration} zoom {zoom_target} alpha {alpha_max}\neasein {duration} zoom 1.0 alpha 0.0\npause 0.1\neaseout {duration} zoom {zoom_target} alpha {alpha_max}\neasein {duration} zoom 1.0 alpha 0.0\nrepeat',
  },
  {
    title: 'Tunnel Vision Pinch',
    description: 'Gradual blacking out of peripheral vision during shock or panic (pair with a radial mask overlay for the vignette edge).',
    tags: ['psychological-horror'],
    parameters: [durationParam(1.5, 0.3, 5), { name: 'zoom_target', type: 'intensity', defaultValue: 1.3, min: 1.0, max: 2.0, step: 0.05 }],
    atlTemplate: 'zoom 1.0\neasein_sine {duration} zoom {zoom_target}',
  },
  {
    title: 'Drunken / Concussed Wobble',
    description: 'Sluggish, off-balance rotational rolling coupled with variable blur.',
    tags: ['psychological-horror', 'loop'],
    parameters: [durationParam(1.2, 0.4, 3), { name: 'angle', type: 'intensity', defaultValue: 6, min: 1, max: 20, step: 1 }, { name: 'blur_amount', type: 'intensity', defaultValue: 5, min: 0, max: 20, step: 1 }],
    atlTemplate: 'rotate 0\nblur 0.0\nease {duration} rotate {angle} blur {blur_amount}\nease {duration} rotate -{angle} blur 0.0\nrepeat',
  },
  {
    title: 'Panic Hyperventilation',
    description: 'Fast, shallow cyclical zoom pulses simulating breathless hyperventilation.',
    tags: ['psychological-horror', 'loop'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.15, min: 0.05, max: 0.4, step: 0.01 }, { name: 'zoom_target', type: 'intensity', defaultValue: 1.08, min: 1.0, max: 1.3, step: 0.01 }, { name: 'blur_amount', type: 'intensity', defaultValue: 4, min: 0, max: 15, step: 1 }],
    atlTemplate: 'zoom 1.0\nblur 0.0\nlinear {duration} zoom {zoom_target} blur {blur_amount}\nlinear {duration} zoom 1.0 blur 0.0\nrepeat',
  },
  {
    title: 'Reality Warp / Shear',
    description: 'Non-orthogonal distortion warping physical geometry during psychosis (approximated with rotate + horizontal skew via xzoom).',
    tags: ['psychological-horror', 'loop'],
    parameters: [durationParam(0.6, 0.2, 2), { name: 'angle', type: 'intensity', defaultValue: 5, min: 1, max: 20, step: 1 }],
    atlTemplate: 'rotate 0\nxzoom 1.0\nease {duration} rotate {angle} xzoom 1.15\nease {duration} rotate -{angle} xzoom 0.9\nrepeat',
  },
  {
    title: 'Phantom After-Image',
    description: 'Semi-transparent silhouette ghosts trailing behind moving actors (single-sprite approximation; a true after-image needs cloned layered images).',
    tags: ['psychological-horror', 'loop'],
    parameters: [durationParam(0.4, 0.1, 1), { name: 'distance', type: 'offset', defaultValue: 20, min: 5, max: 100, step: 5 }, { name: 'trail_alpha', type: 'intensity', defaultValue: 0.4, min: 0.0, max: 0.8, step: 0.05 }],
    atlTemplate: 'alpha 1.0\nxoffset 0\nlinear {duration} alpha {trail_alpha} xoffset {distance}\nlinear {duration} alpha 1.0 xoffset 0\nrepeat',
  },
  {
    title: 'Eyelid Blink (Waking Up)',
    description: 'Flutter-opening and shutting with focus recovery (pair with top/bottom black-bar Solids for the letterbox lids).',
    tags: ['psychological-horror'],
    parameters: [{ name: 'blur_amount', type: 'intensity', defaultValue: 10, min: 0, max: 30, step: 1 }],
    atlTemplate: 'alpha 1.0\nblur {blur_amount}\nlinear 0.1 alpha 0.0\nlinear 0.1 alpha 1.0\nlinear 0.15 alpha 0.0\nlinear 0.15 alpha 1.0 blur 0.0',
  },
  {
    title: 'Descent into Madness',
    description: 'Ultra-slow Dutch tilt with subtle palette corruption.',
    tags: ['psychological-horror'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 20, min: 5, max: 60, step: 1 }, { name: 'angle', type: 'intensity', defaultValue: 3, min: 1, max: 10, step: 1 }],
    atlTemplate: 'rotate 0\nmatrixcolor SaturationMatrix(1.0)\neasein {duration} rotate {angle} matrixcolor SaturationMatrix(0.5)',
  },
  {
    title: 'Uncanny Twitch',
    description: 'Instantaneous, unnatural angular head/limb twitches with zero inertia.',
    tags: ['psychological-horror', 'emphasis'],
    parameters: [{ name: 'angle', type: 'intensity', defaultValue: 10, min: 2, max: 45, step: 1 }],
    atlTemplate: 'rotate 0\nlinear 0.02 rotate {angle}\nlinear 0.02 rotate 0',
  },
  {
    title: 'Breathing Walls',
    description: 'Background architecture breathing and pulsating like living organic tissue.',
    tags: ['psychological-horror', 'loop'],
    parameters: [durationParam(1.5, 0.5, 4), { name: 'zoom_target', type: 'intensity', defaultValue: 1.03, min: 1.0, max: 1.15, step: 0.01 }],
    atlTemplate: 'zoom 1.0\neasein_sine {duration} zoom {zoom_target}\neaseout_sine {duration} zoom 1.0\nrepeat',
  },
  {
    title: 'Flashback White-Out',
    description: 'Blinding white burst burning out into high-contrast monochrome.',
    tags: ['psychological-horror'],
    parameters: [durationParam(0.4, 0.1, 1)],
    atlTemplate: 'matrixcolor BrightnessMatrix(0.0)\nlinear {duration} matrixcolor BrightnessMatrix(1.0)\nlinear {duration} matrixcolor SaturationMatrix(0.0)',
  },
  {
    title: 'Syncope Blackout Faint',
    description: 'Heavy downward perspective slide into black as consciousness fades.',
    tags: ['psychological-horror', 'exit'],
    parameters: [durationParam(1.0, 0.3, 3), { name: 'distance', type: 'offset', defaultValue: 80, min: 10, max: 300, step: 10 }, { name: 'blur_amount', type: 'intensity', defaultValue: 15, min: 0, max: 40, step: 1 }],
    atlTemplate: 'yoffset 0\nblur 0.0\nalpha 1.0\neasein_cubic {duration} yoffset {distance} blur {blur_amount} alpha 0.0',
  },
  {
    title: 'Sensory Isolation',
    description: 'Background rapidly drops into pitch darkness, isolating the lone actor.',
    tags: ['psychological-horror'],
    parameters: [durationParam(0.5, 0.1, 1.5), { name: 'alpha_target', type: 'intensity', defaultValue: 0.05, min: 0.0, max: 0.5, step: 0.01 }],
    atlTemplate: 'alpha 1.0\neasein_cubic {duration} alpha {alpha_target}',
  },
  {
    title: 'Doppelgänger Split',
    description: 'Character sprite cleaves apart into a semi-transparent duplicate drifting away (single-sprite approximation of a true clone split).',
    tags: ['psychological-horror'],
    parameters: [durationParam(0.7, 0.2, 2), { name: 'distance', type: 'offset', defaultValue: 60, min: 10, max: 250, step: 5 }, { name: 'alpha_target', type: 'intensity', defaultValue: 0.5, min: 0.1, max: 0.9, step: 0.05 }],
    atlTemplate: 'xoffset 0\nalpha 1.0\neaseout_cubic {duration} xoffset {distance} alpha {alpha_target}',
  },

  // --- UI & Framing ---
  {
    title: 'Cinemascope Letterbox',
    description: 'Smooth cinematic anamorphic black bar sliding inward for cutscenes (top bar; mirror with a negative distance for the bottom bar).',
    tags: ['ui-framing', 'entrance'],
    parameters: [durationParam(0.5, 0.2, 1.5), easingParam('easein_cubic'), { name: 'distance', type: 'offset', defaultValue: 100, min: 20, max: 400, step: 10 }],
    atlTemplate: 'yoffset -{distance}\n{easing} {duration} yoffset 0',
  },
  {
    title: 'Dynamic Dialogue Zoom',
    description: 'Gentle camera track and focus shift framing whoever is actively speaking.',
    tags: ['ui-framing'],
    parameters: [durationParam(0.5, 0.2, 1.5), easingParam('ease'), { name: 'zoom_target', type: 'intensity', defaultValue: 1.1, min: 1.0, max: 1.4, step: 0.02 }, { name: 'align_target', type: 'intensity', defaultValue: 0.5, min: 0.0, max: 1.0, step: 0.05 }],
    atlTemplate: 'zoom 1.0\nxalign 0.5\n{easing} {duration} zoom {zoom_target} xalign {align_target}',
  },
  {
    title: 'Spotlight Mask',
    description: 'Complete darkness over the stage except for an illuminated target (approximated on the spotlit sprite; pair with a darkening overlay on the rest of the stage).',
    tags: ['ui-framing'],
    parameters: [durationParam(0.5, 0.1, 1.5), { name: 'zoom_target', type: 'intensity', defaultValue: 1.1, min: 1.0, max: 1.5, step: 0.05 }],
    atlTemplate: 'alpha 0.3\nzoom 1.0\neasein {duration} alpha 1.0 zoom {zoom_target}',
  },
  {
    title: 'Polaroid Develop Reveal',
    description: 'CG slowly gaining exposure, saturation, and clarity like developing film.',
    tags: ['ui-framing', 'entrance'],
    parameters: [durationParam(2.0, 0.5, 6)],
    atlTemplate: 'matrixcolor SaturationMatrix(0.0)\nalpha 0.0\nlinear {duration} matrixcolor SaturationMatrix(1.0) alpha 1.0',
  },
  {
    title: 'Split-Screen Panel Wipe',
    description: 'Screen slides into a dynamic manga-style panel.',
    tags: ['ui-framing', 'entrance'],
    parameters: [durationParam(0.4, 0.1, 1), easingParam('easein_cubic'), { name: 'distance', type: 'offset', defaultValue: 400, min: 50, max: 1500, step: 10 }],
    atlTemplate: 'xoffset -{distance}\n{easing} {duration} xoffset 0',
  },
  {
    title: 'Chapter Title Reveal',
    description: 'Cinematic typography fading in with a slow drift.',
    tags: ['ui-framing', 'entrance'],
    parameters: [durationParam(1.2, 0.3, 3), { name: 'intensity', type: 'offset', defaultValue: 40, min: 5, max: 150, step: 5 }],
    atlTemplate: 'alpha 0.0\nxoffset -{intensity}\neasein_quad {duration} alpha 1.0 xoffset 0',
  },
  {
    title: 'Freeze-Frame Action Card',
    description: 'Kinetic freeze-frame desaturation with a high-impact title card pop.',
    tags: ['ui-framing', 'emphasis'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.3, min: 0.1, max: 1, step: 0.05 }, { name: 'zoom_target', type: 'intensity', defaultValue: 1.15, min: 1.0, max: 1.5, step: 0.05 }],
    atlTemplate: 'matrixcolor SaturationMatrix(1.0)\nzoom 0.9\nlinear 0.05 matrixcolor SaturationMatrix(0.2) zoom {zoom_target}\neaseout_back {duration} zoom 1.0',
  },
  {
    title: 'NVL Mode Cinema Curtain',
    description: 'Darkened, gradient vignette sliding behind multi-line text displays.',
    tags: ['ui-framing', 'entrance'],
    parameters: [durationParam(0.6, 0.2, 1.5), { name: 'distance', type: 'offset', defaultValue: 60, min: 10, max: 250, step: 5 }, { name: 'alpha_target', type: 'intensity', defaultValue: 0.75, min: 0.2, max: 1.0, step: 0.05 }],
    atlTemplate: 'yoffset {distance}\nalpha 0.0\neasein_cubic {duration} yoffset 0 alpha {alpha_target}',
  },
  {
    title: 'Speaker Focus / Dimming',
    description: 'Inactive dialogue partners dim and blur to yield focus to the speaker.',
    tags: ['ui-framing'],
    parameters: [durationParam(0.4, 0.1, 1), { name: 'dim_amount', type: 'intensity', defaultValue: 0.3, min: 0.0, max: 0.7, step: 0.05 }, { name: 'blur_amount', type: 'intensity', defaultValue: 3, min: 0, max: 15, step: 1 }, { name: 'zoom_target', type: 'intensity', defaultValue: 0.97, min: 0.8, max: 1.0, step: 0.01 }],
    atlTemplate: 'matrixcolor BrightnessMatrix(0.0)\nblur 0.0\nzoom 1.0\neasein {duration} matrixcolor BrightnessMatrix(-{dim_amount}) blur {blur_amount} zoom {zoom_target}',
  },
  {
    title: 'Item Inspection Float',
    description: 'Floating artifact gently rotating and tilting for close inspection.',
    tags: ['ui-framing', 'loop'],
    parameters: [durationParam(1.2, 0.4, 3), { name: 'intensity', type: 'intensity', defaultValue: 10, min: 2, max: 40, step: 1 }, { name: 'angle', type: 'intensity', defaultValue: 4, min: 1, max: 15, step: 1 }],
    atlTemplate: 'yoffset 0\nrotate 0\nxzoom 1.0\neasein_sine {duration} yoffset -{intensity} rotate {angle} xzoom 1.05\neaseout_sine {duration} yoffset 0 rotate -{angle} xzoom 1.0\nrepeat',
  },
  {
    title: 'HUD Alert Glitch',
    description: 'UI widgets shaking and flashing crimson during system failure or danger.',
    tags: ['ui-framing', 'loop'],
    parameters: [{ name: 'intensity', type: 'intensity', defaultValue: 6, min: 1, max: 25, step: 1 }, { name: 'repeat_count', type: 'repeat', defaultValue: 4, min: 1, max: 20, step: 1 }],
    atlTemplate: 'matrixcolor BrightnessMatrix(0.0)\nxoffset 0\nlinear 0.03 matrixcolor TintMatrix("#ff2222") xoffset {intensity}\nlinear 0.03 matrixcolor TintMatrix("#ffffff") xoffset -{intensity}\nrepeat {repeat_count}',
  },
  {
    title: 'Manga Reaction Pop',
    description: 'Sudden comic-style diagonal panel popping onto screen for reaction shots.',
    tags: ['ui-framing', 'entrance', 'emphasis'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.2, min: 0.05, max: 0.6, step: 0.05 }, { name: 'angle', type: 'intensity', defaultValue: 8, min: 1, max: 30, step: 1 }, { name: 'zoom_overshoot', type: 'intensity', defaultValue: 1.05, min: 1.0, max: 1.3, step: 0.01 }],
    atlTemplate: 'zoom 0.0\nrotate {angle}\neaseout_back {duration} zoom {zoom_overshoot} rotate 0\neasein 0.1 zoom 1.0',
  },
  {
    title: 'Foreground Silhouette',
    description: 'Blurred, dark foreground element framing midground action with depth.',
    tags: ['ui-framing'],
    parameters: [{ name: 'blur_amount', type: 'intensity', defaultValue: 10, min: 0, max: 30, step: 1 }, { name: 'alpha_target', type: 'intensity', defaultValue: 0.9, min: 0.2, max: 1.0, step: 0.05 }, { name: 'dim_amount', type: 'intensity', defaultValue: 0.4, min: 0.0, max: 0.8, step: 0.05 }],
    atlTemplate: 'blur {blur_amount}\nalpha {alpha_target}\nmatrixcolor BrightnessMatrix(-{dim_amount})',
  },
  {
    title: 'Subconscious Whisper',
    description: 'Ephemeral floating text lines wandering across the screen and dissolving.',
    tags: ['ui-framing', 'loop'],
    parameters: [durationParam(2.0, 0.5, 5), { name: 'intensity', type: 'offset', defaultValue: 30, min: 5, max: 150, step: 5 }, { name: 'alpha_target', type: 'intensity', defaultValue: 0.6, min: 0.1, max: 1.0, step: 0.05 }],
    atlTemplate: 'yoffset 0\nalpha 0.0\neasein_sine {duration} yoffset -{intensity} alpha {alpha_target}\neaseout_sine {duration} yoffset -{intensity} alpha 0.0',
  },

  // --- Transitions & Blends ---
  {
    title: 'Cinematic Whip Blur Cut',
    description: 'High-velocity horizontal blur snap carrying the viewer into the next shot.',
    tags: ['transitions-blends'],
    parameters: [{ name: 'duration', type: 'duration', defaultValue: 0.2, min: 0.05, max: 0.6, step: 0.05 }, { name: 'distance', type: 'offset', defaultValue: 700, min: 100, max: 2000, step: 50 }, { name: 'blur_amount', type: 'intensity', defaultValue: 25, min: 5, max: 60, step: 5 }],
    atlTemplate: 'xoffset 0\nblur 0.0\neasein_cubic {duration} xoffset {distance} blur {blur_amount}',
  },
  {
    title: 'Match-Cut Zoom Align',
    description: 'Seamless optical zoom into an object that becomes the next scene.',
    tags: ['transitions-blends', 'scale'],
    parameters: [durationParam(1.0, 0.3, 3), { name: 'zoom_target', type: 'intensity', defaultValue: 4.0, min: 1.5, max: 10.0, step: 0.5 }],
    atlTemplate: 'zoom 1.0\neasein_cubic {duration} zoom {zoom_target}',
  },
  {
    title: 'Faux 3D Card Flip',
    description: 'Simulates a 3D perspective coin or card rotation across the Y-axis.',
    tags: ['transitions-blends', 'rotation'],
    parameters: [durationParam(0.35, 0.1, 1)],
    atlTemplate: 'xzoom 1.0\nlinear {duration} xzoom 0.0\nlinear {duration} xzoom -1.0',
  },
  {
    title: 'Circular Iris Focus Cut',
    description: 'Vintage circular lens diaphragm closing down to a pinprick on a subject (approximated with zoom + fade; pair with a circular alphamask for the true iris shape).',
    tags: ['transitions-blends', 'exit'],
    parameters: [durationParam(0.8, 0.2, 2), { name: 'zoom_target', type: 'intensity', defaultValue: 2.0, min: 1.0, max: 5.0, step: 0.1 }],
    atlTemplate: 'zoom 1.0\nalpha 1.0\neasein_cubic {duration} zoom {zoom_target} alpha 0.0',
  },
  {
    title: 'Cross-Zoom Blur Cut',
    description: 'Outgoing scene zooms in while blurring; incoming scene resolves from blur.',
    tags: ['transitions-blends'],
    parameters: [durationParam(0.5, 0.15, 1.5), { name: 'zoom_target', type: 'intensity', defaultValue: 1.5, min: 1.0, max: 3.0, step: 0.1 }, { name: 'blur_amount', type: 'intensity', defaultValue: 15, min: 2, max: 40, step: 1 }],
    atlTemplate: 'zoom 1.0\nblur 0.0\neasein_cubic {duration} zoom {zoom_target} blur {blur_amount}',
  },
  {
    title: 'Curtain Fall',
    description: 'Scene wipes down like a heavy theater velvet curtain with bounce settling.',
    tags: ['transitions-blends', 'entrance'],
    parameters: [durationParam(0.6, 0.2, 1.5), { name: 'distance', type: 'offset', defaultValue: 800, min: 100, max: 2000, step: 50 }],
    atlTemplate: 'yoffset -{distance}\neasein_cubic {duration} yoffset 0\neaseout_bounce 0.2 yoffset 15',
  },
  {
    title: 'Memory Dissolve',
    description: 'Soft focus crossfade accompanied by high-key exposure and desaturation.',
    tags: ['transitions-blends'],
    parameters: [durationParam(1.5, 0.5, 4), { name: 'blur_amount', type: 'intensity', defaultValue: 12, min: 2, max: 30, step: 1 }, { name: 'saturation_target', type: 'intensity', defaultValue: 0.3, min: 0.0, max: 1.0, step: 0.05 }],
    atlTemplate: 'blur 0.0\nmatrixcolor SaturationMatrix(1.0)\nlinear {duration} blur {blur_amount} matrixcolor SaturationMatrix({saturation_target})',
  },
  {
    title: 'Time-Lapse Sky Cycle',
    description: 'Continuous color grade cycling through dawn, midday, dusk, and night.',
    tags: ['transitions-blends', 'loop'],
    parameters: [durationParam(3.0, 1, 10)],
    atlTemplate: 'matrixcolor TintMatrix("#ffcc88")\nlinear {duration} matrixcolor TintMatrix("#3355aa")\nlinear {duration} matrixcolor TintMatrix("#111133")\nlinear {duration} matrixcolor TintMatrix("#ffcc88")\nrepeat',
  },
  {
    title: 'Shatter Disperse Cut',
    description: 'Displayable fragments into angular pieces that fly outward off-screen.',
    tags: ['transitions-blends', 'exit'],
    parameters: [durationParam(0.5, 0.15, 1.5), { name: 'distance', type: 'offset', defaultValue: 300, min: 50, max: 1000, step: 10 }, { name: 'angle', type: 'intensity', defaultValue: 45, min: 5, max: 180, step: 5 }],
    atlTemplate: 'alpha 1.0\nxoffset 0\nyoffset 0\nrotate 0\neasein_cubic {duration} alpha 0.0 xoffset {distance} yoffset -{distance} rotate {angle}',
  },
  {
    title: 'Reel Push Slide',
    description: 'Incoming scene physically shoves the outgoing scene off the canvas (outgoing half; mirror with a positive distance on the incoming scene).',
    tags: ['transitions-blends', 'exit'],
    parameters: [durationParam(0.5, 0.15, 1.5), easingParam('easein_cubic'), { name: 'distance', type: 'offset', defaultValue: 1280, min: 200, max: 2500, step: 50 }],
    atlTemplate: 'xoffset 0\n{easing} {duration} xoffset -{distance}',
  },
  {
    title: 'Thermal Inversion Cut',
    description: 'High-contrast negative color inversion flash before settling into a new shot.',
    tags: ['transitions-blends'],
    parameters: [durationParam(0.6, 0.2, 1.5)],
    atlTemplate: 'matrixcolor InvertMatrix()\nlinear {duration} matrixcolor SaturationMatrix(1.0)',
  },
  {
    title: 'Cinematic Tint Fade',
    description: 'Fade out toward a narrative tone color (blood red, cold cyan, pure white).',
    tags: ['transitions-blends', 'exit'],
    parameters: [durationParam(1.0, 0.3, 3)],
    atlTemplate: 'matrixcolor SaturationMatrix(1.0)\nalpha 1.0\nlinear {duration} matrixcolor TintMatrix("#660000") alpha 0.0',
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
