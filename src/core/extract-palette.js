import { rgbToHex, luminance, mix, hexToHsl, hslToHex } from './color.js';

const BUCKET_BITS = 4;
const SHIFT = 8 - BUCKET_BITS;

function bucketize(pixels) {
  const buckets = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const key = ((pixels[i] >> SHIFT) << (BUCKET_BITS * 2)) | ((pixels[i + 1] >> SHIFT) << BUCKET_BITS) | (pixels[i + 2] >> SHIFT);
    const b = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    buckets.set(key, { r: b.r + pixels[i], g: b.g + pixels[i + 1], b: b.b + pixels[i + 2], n: b.n + 1 });
  }
  return [...buckets.values()].map(({ r, g, b, n }) => ({ hex: rgbToHex({ r: r / n, g: g / n, b: b / n }), n }));
}

/**
 * Derives a legible { bg, text, accent } theme from RGBA pixels.
 * bg = dominant colour, accent = most vivid frequent colour, text = high-contrast ink.
 */
export function extractPalette(pixels) {
  const colors = bucketize(pixels).sort((a, b) => b.n - a.n);
  if (!colors.length) return { bg: '#0b0b10', text: '#f4f3ef', accent: '#6f86ff' };
  const bg = colors[0].hex;
  const scored = colors.slice(0, 40).map((c) => {
    const { s, l } = hexToHsl(c.hex);
    return { ...c, score: s * (1 - Math.abs(l - 0.55)) * Math.sqrt(c.n) };
  });
  const vivid = scored.sort((a, b) => b.score - a.score)[0].hex;
  const hsl = hexToHsl(vivid);
  const accent = hslToHex({ h: hsl.h, s: Math.max(hsl.s, 0.55), l: Math.min(Math.max(hsl.l, 0.5), 0.68) });
  const dark = luminance(bg) < 0.3;
  const text = dark ? mix('#ffffff', accent, 0.06) : mix('#111111', accent, 0.08);
  return { bg, text, accent };
}
