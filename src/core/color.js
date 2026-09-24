const HEX_RE = /^#([0-9a-f]{6})$/i;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const isHex = (v) => typeof v === 'string' && HEX_RE.test(v);

export function hexToRgb(hex) {
  const match = HEX_RE.exec(hex);
  if (!match) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

/** Linear blend: t=0 → a, t=1 → b. */
export function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = clamp(t, 0, 1);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * k,
    g: ca.g + (cb.g - ca.g) * k,
    b: ca.b + (cb.b - ca.b) * k,
  });
}

/** WCAG relative luminance, 0 (black) → 1 (white). */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export const isDark = (hex) => luminance(hex) < 0.3;

export function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0)) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToHex({ h, s, l }) {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return rgbToHex({ r: l * 255, g: l * 255, b: l * 255 });
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t0) => {
    const t = ((t0 % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return rgbToHex({
    r: channel(hue + 1 / 3) * 255,
    g: channel(hue) * 255,
    b: channel(hue - 1 / 3) * 255,
  });
}

export function shiftHue(hex, degrees) {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, h: hsl.h + degrees });
}
