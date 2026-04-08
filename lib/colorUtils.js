/**
 * Color manipulation utilities for Ren'Py GUI color derivation.
 * Ports the color manipulation logic from Ren'Py SDK's gui7/parameters.py
 */

/**
 * RenpyColor class - represents an RGBA color with manipulation methods
 */
class RenpyColor {
  constructor(hex) {
    // Parse hex color (supports #RGB, #RRGGBB, #RRGGBBAA)
    const cleaned = hex.replace('#', '');

    if (cleaned.length === 3) {
      // #RGB -> #RRGGBB
      this.r = parseInt(cleaned[0] + cleaned[0], 16) / 255;
      this.g = parseInt(cleaned[1] + cleaned[1], 16) / 255;
      this.b = parseInt(cleaned[2] + cleaned[2], 16) / 255;
      this.a = 1.0;
    } else if (cleaned.length === 6) {
      // #RRGGBB
      this.r = parseInt(cleaned.substring(0, 2), 16) / 255;
      this.g = parseInt(cleaned.substring(2, 4), 16) / 255;
      this.b = parseInt(cleaned.substring(4, 6), 16) / 255;
      this.a = 1.0;
    } else if (cleaned.length === 8) {
      // #RRGGBBAA
      this.r = parseInt(cleaned.substring(0, 2), 16) / 255;
      this.g = parseInt(cleaned.substring(2, 4), 16) / 255;
      this.b = parseInt(cleaned.substring(4, 6), 16) / 255;
      this.a = parseInt(cleaned.substring(6, 8), 16) / 255;
    } else {
      throw new Error(`Invalid hex color: ${hex}`);
    }
  }

  /**
   * Convert RGB to HSV
   */
  rgbToHsv() {
    const max = Math.max(this.r, this.g, this.b);
    const min = Math.min(this.r, this.g, this.b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === this.r) {
        h = ((this.g - this.b) / delta) % 6;
      } else if (max === this.g) {
        h = (this.b - this.r) / delta + 2;
      } else {
        h = (this.r - this.g) / delta + 4;
      }
      h *= 60;
      if (h < 0) h += 360;
    }

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    return { h: h / 360, s, v };
  }

  /**
   * Convert HSV to RGB
   */
  static hsvToRgb(h, s, v) {
    h = h * 360;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r, g, b;
    if (h < 60) {
      [r, g, b] = [c, x, 0];
    } else if (h < 120) {
      [r, g, b] = [x, c, 0];
    } else if (h < 180) {
      [r, g, b] = [0, c, x];
    } else if (h < 240) {
      [r, g, b] = [0, x, c];
    } else if (h < 300) {
      [r, g, b] = [x, 0, c];
    } else {
      [r, g, b] = [c, 0, x];
    }

    return {
      r: r + m,
      g: g + m,
      b: b + m
    };
  }

  /**
   * Blend color toward white (tint)
   * @param {number} factor - Blend factor (0-1), where 1 = full white
   */
  tint(factor) {
    const newColor = new RenpyColor('#000000');
    newColor.r = this.r + (1.0 - this.r) * factor;
    newColor.g = this.g + (1.0 - this.g) * factor;
    newColor.b = this.b + (1.0 - this.b) * factor;
    newColor.a = this.a;
    return newColor;
  }

  /**
   * Blend color toward black (shade)
   * @param {number} factor - Blend factor (0-1), where 1 = full black
   */
  shade(factor) {
    const newColor = new RenpyColor('#000000');
    newColor.r = this.r * (1.0 - factor);
    newColor.g = this.g * (1.0 - factor);
    newColor.b = this.b * (1.0 - factor);
    newColor.a = this.a;
    return newColor;
  }

  /**
   * Replace the saturation component in HSV space
   * @param {number} newSaturation - New saturation (0-1)
   */
  replaceHSVSaturation(newSaturation) {
    const hsv = this.rgbToHsv();
    const rgb = RenpyColor.hsvToRgb(hsv.h, newSaturation, hsv.v);

    const newColor = new RenpyColor('#000000');
    newColor.r = rgb.r;
    newColor.g = rgb.g;
    newColor.b = rgb.b;
    newColor.a = this.a;
    return newColor;
  }

  /**
   * Replace the value (brightness) component in HSV space
   * @param {number} newValue - New value/brightness (0-1)
   */
  replaceValue(newValue) {
    const hsv = this.rgbToHsv();
    const rgb = RenpyColor.hsvToRgb(hsv.h, hsv.s, newValue);

    const newColor = new RenpyColor('#000000');
    newColor.r = rgb.r;
    newColor.g = rgb.g;
    newColor.b = rgb.b;
    newColor.a = this.a;
    return newColor;
  }

  /**
   * Set the alpha (opacity) channel
   * @param {number} newAlpha - New alpha (0-1)
   */
  replaceOpacity(newAlpha) {
    const newColor = new RenpyColor('#000000');
    newColor.r = this.r;
    newColor.g = this.g;
    newColor.b = this.b;
    newColor.a = newAlpha;
    return newColor;
  }

  /**
   * Convert to hex string
   * @param {boolean} includeAlpha - Include alpha channel in output
   */
  toHex(includeAlpha = true) {
    const r = Math.round(this.r * 255).toString(16).padStart(2, '0');
    const g = Math.round(this.g * 255).toString(16).padStart(2, '0');
    const b = Math.round(this.b * 255).toString(16).padStart(2, '0');

    if (includeAlpha && this.a < 1.0) {
      const a = Math.round(this.a * 255).toString(16).padStart(2, '0');
      return `#${r}${g}${b}${a}`;
    }

    return `#${r}${g}${b}`;
  }
}

/**
 * Derive all GUI colors from an accent color and theme
 * Mirrors the logic from Ren'Py SDK's gui7/parameters.py GuiParameters.__init__
 *
 * @param {string} accentHex - Hex color string for accent (e.g., "#00b8c3")
 * @param {boolean} isLight - True for light theme, false for dark theme
 * @returns {Object} Object with all GUI color defines as hex strings
 */
function deriveGuiColors(accentHex, isLight) {
  const accent = new RenpyColor(accentHex);

  // HOVER COLOR - derived from accent
  const hoverColor = isLight
    ? accent  // Same as accent
    : accent.tint(0.6);  // 60% toward white

  // MUTED COLOR - for unfilled bar portions
  const mutedColor = isLight
    ? accent.tint(0.6)       // 60% toward white
    : accent.shade(0.4);     // 40% toward black

  // HOVER MUTED COLOR
  const hoverMutedColor = isLight
    ? accent.tint(0.4)       // 40% toward white
    : accent.shade(0.6);     // 60% toward black

  // MENU COLOR - desaturated accent for menu backgrounds
  const menuColor = isLight
    ? accent.replaceHSVSaturation(0.25).replaceValue(0.75)
    : accent.replaceHSVSaturation(0.25).replaceValue(0.25);

  // TITLE COLOR - vibrant variant of accent
  const titleColor = accent.replaceHSVSaturation(0.5).replaceValue(1.0);

  // FIXED COLORS - theme-dependent but NOT accent-derived
  const selectedColor = new RenpyColor(isLight ? '#555555' : '#ffffff');
  const idleColor = new RenpyColor(isLight ? '#707070' : '#888888');
  const idleSmallColor = new RenpyColor(isLight ? '#606060' : '#aaaaaa');
  const textColor = new RenpyColor(isLight ? '#404040' : '#ffffff');

  // INSENSITIVE - derived from idle_color with 50% opacity
  const insensitiveColor = idleColor.replaceOpacity(0.5);

  return {
    accent_color: accent.toHex(false),
    hover_color: hoverColor.toHex(false),
    muted_color: mutedColor.toHex(false),
    hover_muted_color: hoverMutedColor.toHex(false),
    menu_color: menuColor.toHex(false),
    title_color: titleColor.toHex(false),
    selected_color: selectedColor.toHex(false),
    idle_color: idleColor.toHex(false),
    idle_small_color: idleSmallColor.toHex(false),
    text_color: textColor.toHex(false),
    interface_text_color: textColor.toHex(false),
    insensitive_color: insensitiveColor.toHex(true),  // Include alpha
    choice_button_text_idle_color: idleColor.toHex(false),
    choice_button_text_insensitive_color: insensitiveColor.toHex(true),
  };
}

/**
 * SDK color swatches (20 predefined combinations)
 * Top 2 rows = dark themes (10 colors)
 * Bottom 2 rows = light themes (10 colors)
 */
const SDK_COLOR_SWATCHES = {
  dark: [
    '#0099cc', '#99ccff', '#66cc00', '#cccc00', '#cc6600',
    '#0066cc', '#9933ff', '#00cc99', '#cc0066', '#cc0000'
  ],
  light: [
    '#003366', '#0099ff', '#336600', '#000000', '#cc6600',
    '#000066', '#660066', '#006666', '#cc0066', '#990000'
  ]
};

export {
  RenpyColor,
  deriveGuiColors,
  SDK_COLOR_SWATCHES
};
