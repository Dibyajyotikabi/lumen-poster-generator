// Shared drawing kit for link cards: palettes, shells, images, avatars, logos and formatting.
import { rgba, isDark } from '../../core/color.js';
import { wrapLines } from '../../core/layout.js';
import { ensureFont } from '../../fonts/loader.js';
import { applyFont, roundRectPath } from '../text.js';

export { applyFont, roundRectPath };

const UI = { id: 'geist', family: 'Geist', italic: false };
const MONO = { id: 'geist-mono', family: 'Geist Mono', italic: false };
export const ui = (weight) => ensureFont({ ...UI, weight });
export const mono = (weight) => ensureFont({ ...MONO, weight });

export const LINK_BLUE = '#1d9bf0';

// Brand marks from Simple Icons (CC0).
const X_LOGO = 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z';
const YT_LOGO = 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z';
const paths = new Map();
const path = (d) => {
  if (!paths.has(d)) paths.set(d, new Path2D(d));
  return paths.get(d);
};

export function drawLogo(ctx, name, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(path(name === 'x' ? X_LOGO : YT_LOGO));
  ctx.restore();
}

/** Card surface colours. 'auto' = frosted glass that follows the design's theme. */
export function cardPalette(cardTheme, theme) {
  switch (cardTheme) {
    case 'light':
      return { surface: '#ffffff', text: '#0f1419', muted: '#536471', line: 'rgba(15,20,25,0.12)', dark: false };
    case 'dim':
      return { surface: '#15202b', text: '#f7f9f9', muted: '#8b98a5', line: 'rgba(255,255,255,0.12)', dark: true };
    case 'dark':
      return { surface: '#000000', text: '#e7e9ea', muted: '#71767b', line: 'rgba(255,255,255,0.16)', dark: true };
    default: {
      const dark = isDark(theme.bg);
      return {
        surface: dark ? 'rgba(20,20,26,0.74)' : 'rgba(255,255,255,0.86)',
        text: theme.text,
        muted: rgba(theme.text, 0.62),
        line: rgba(theme.text, dark ? 0.16 : 0.12),
        dark,
      };
    }
  }
}

export function shell(ctx, box, radius, pal, u) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = 60 * u;
  ctx.shadowOffsetY = 24 * u;
  roundRectPath(ctx, box.x, box.y, box.w, box.h, radius);
  ctx.fillStyle = pal.surface;
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, box.x, box.y, box.w, box.h, radius);
  ctx.lineWidth = Math.max(1, u);
  ctx.strokeStyle = pal.line;
  ctx.stroke();
}

export function coverImage(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  ctx.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2, img.width * s, img.height * s);
}

/** Image in a rounded frame (cover). */
export function framedImage(ctx, img, x, y, w, h, r, line) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  coverImage(ctx, img, x, y, w, h);
  ctx.restore();
  if (line) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.lineWidth = 1;
    ctx.strokeStyle = line;
    ctx.stroke();
  }
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const aspectOf = (img, fallback = 1.91) => (img ? img.width / img.height : fallback);

export function circleImage(ctx, img, x, y, d, fallback, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
  ctx.clip();
  if (img) coverImage(ctx, img, x, y, d, d);
  else {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, d, d);
    applyFont(ctx, ui(700), d * 0.42);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((fallback || '·').slice(0, 1).toUpperCase(), x + d / 2, y + d * 0.53);
  }
  ctx.restore();
}

export function verifiedBadge(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = LINK_BLUE;
  ctx.beginPath();
  // scalloped rosette: 8 bumps
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    const r = size / 2 - (i % 2 ? size * 0.07 : 0);
    ctx.lineTo(x + size / 2 + Math.cos(a) * r, y + size / 2 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.3, y + size * 0.52);
  ctx.lineTo(x + size * 0.45, y + size * 0.66);
  ctx.lineTo(x + size * 0.72, y + size * 0.36);
  ctx.stroke();
  ctx.restore();
}

/** Word-wraps and optionally caps to `max` lines (adds an ellipsis only when cut). */
export function lines(ctx, text, maxWidth, max = Infinity) {
  const all = wrapLines(text, maxWidth, (s) => ctx.measureText(s).width);
  if (all.length <= max) return all;
  const kept = all.slice(0, max);
  let last = kept[max - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  return [...kept.slice(0, -1), `${last.replace(/[\s.,;:–-]+$/, '')}…`];
}

export function fillLines(ctx, list, x, y, size, lh, color, align = 'left') {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  list.forEach((line, i) => ctx.fillText(line, x, y + (i + 0.5) * size * lh));
  return list.length * size * lh;
}

export function formatCount(n) {
  if (!Number.isFinite(n)) return '';
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '')}K`;
  return n.toLocaleString('en-US');
}

export function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${time} · ${day}`;
}
