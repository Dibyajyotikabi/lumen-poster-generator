import { rgba, shiftHue, isDark } from '../core/color.js';
import { ensureFont } from '../fonts/loader.js';
import { glow, lightBlend } from './effects.js';
import { applyFont, roundRectPath } from './text.js';

const TAU = Math.PI * 2;
const UI = { id: 'geist', family: 'Geist', italic: false };
const face = (weight) => ensureFont({ ...UI, weight });

export function initials(name) {
  const letters = String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return letters || '·';
}

/* ---------- avatar ---------- */

export function drawAvatar(ctx, { x, y, d, image, name, theme }) {
  const r = d / 2;
  const cx = x + r;
  const cy = y + r;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  if (image) {
    const s = Math.max(d / image.width, d / image.height);
    ctx.drawImage(image, cx - (image.width * s) / 2, cy - (image.height * s) / 2, image.width * s, image.height * s);
  } else {
    const g = ctx.createLinearGradient(x, y, x + d, y + d);
    g.addColorStop(0, theme.accent);
    g.addColorStop(1, shiftHue(theme.accent, 45));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, d, d);
    applyFont(ctx, face(600), d * 0.38, -0.02);
    ctx.fillStyle = isDark(theme.accent) ? '#ffffff' : '#111111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(name), cx, cy + d * 0.02);
  }
  ctx.restore();
  const ring = Math.max(1, d * 0.018);
  ctx.lineWidth = ring;
  ctx.strokeStyle = rgba(theme.text, 0.2);
  ctx.beginPath();
  ctx.arc(cx, cy, r - ring / 2, 0, TAU);
  ctx.stroke();
}

/* ---------- platform badges ---------- */

function letterBadge(ctx, x, y, s, bg, letter, fg = '#ffffff') {
  roundRectPath(ctx, x, y, s, s, s * 0.24);
  ctx.fillStyle = bg;
  ctx.fill();
  applyFont(ctx, face(700), s * 0.6, -0.02);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, x + s / 2, y + s * 0.53);
}

const BADGES = {
  linkedin: (ctx, x, y, s) => letterBadge(ctx, x, y, s, '#0A66C2', 'in'),
  x: (ctx, x, y, s) => letterBadge(ctx, x, y, s, '#000000', 'X'),
  github: (ctx, x, y, s) => letterBadge(ctx, x, y, s, '#24292f', 'GH'),
  youtube: (ctx, x, y, s) => {
    roundRectPath(ctx, x - s * 0.1, y + s * 0.12, s * 1.2, s * 0.8, s * 0.22);
    ctx.fillStyle = '#FF0033';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.4, y + s * 0.32);
    ctx.lineTo(x + s * 0.72, y + s * 0.52);
    ctx.lineTo(x + s * 0.4, y + s * 0.72);
    ctx.closePath();
    ctx.fill();
  },
  instagram: (ctx, x, y, s) => {
    const g = ctx.createLinearGradient(x, y + s, x + s, y);
    g.addColorStop(0, '#feda75');
    g.addColorStop(0.45, '#d62976');
    g.addColorStop(1, '#4f5bd5');
    roundRectPath(ctx, x, y, s, s, s * 0.28);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s * 0.09;
    roundRectPath(ctx, x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6, s * 0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.14, 0, TAU);
    ctx.stroke();
  },
  website: (ctx, x, y, s, theme) => {
    const cx = x + s / 2;
    const cy = y + s / 2;
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, s / 2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = isDark(theme.accent) ? '#ffffff' : '#111111';
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.3, 0, TAU);
    ctx.moveTo(cx - s * 0.3, cy);
    ctx.lineTo(cx + s * 0.3, cy);
    ctx.moveTo(cx + s * 0.13, cy - s * 0.27);
    ctx.ellipse(cx, cy, s * 0.13, s * 0.3, 0, -Math.PI / 2 + 0.2, Math.PI * 1.5 + 0.2);
    ctx.stroke();
  },
};

function measureHandleRow(ctx, profile, size) {
  const handle = String(profile.handle ?? '').trim();
  applyFont(ctx, face(500), size);
  const textW = handle ? ctx.measureText(handle).width : 0;
  const hasBadge = profile.platform && profile.platform !== 'none' && BADGES[profile.platform];
  const badge = hasBadge ? size * 1.15 : 0;
  const gap = badge && handle ? size * 0.5 : 0;
  return { handle, size, badge, gap, platform: profile.platform, w: badge + gap + textW, h: badge || handle ? size * 1.3 : 0 };
}

function drawHandleRow(ctx, row, x, cy, theme) {
  if (row.badge) BADGES[row.platform](ctx, x, cy - row.badge / 2, row.badge, theme);
  if (!row.handle) return;
  applyFont(ctx, face(500), row.size);
  ctx.fillStyle = rgba(theme.text, 0.66);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(row.handle, x + row.badge + row.gap, cy);
}

function measureLine(ctx, text, weight, size, tracking = 0) {
  applyFont(ctx, face(weight), size, tracking);
  return text ? ctx.measureText(text).width : 0;
}

function drawLine(ctx, text, { x, cy, weight, size, color, align = 'left', tracking = 0 }) {
  if (!text) return;
  applyFont(ctx, face(weight), size, tracking);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, cy);
}

/* ---------- variants ---------- */

function layoutChip(ctx, p, k) {
  const d = 62 * k;
  const gap = 16 * k;
  const nameSize = 23 * k;
  const nameW = measureLine(ctx, p.name, 600, nameSize, -0.01);
  const row = measureHandleRow(ctx, p, 17 * k);
  return { d, gap, nameSize, row, w: d + gap + Math.max(nameW, row.w), h: d };
}

function drawChip(ctx, p, L, box, img, theme) {
  drawAvatar(ctx, { x: box.x, y: box.y, d: L.d, image: img, name: p.name, theme });
  const tx = box.x + L.d + L.gap;
  const hasRow = L.row.w > 0;
  drawLine(ctx, p.name, { x: tx, cy: box.y + (hasRow ? L.d * 0.34 : L.d / 2), weight: 600, size: L.nameSize, color: theme.text, tracking: -0.01 });
  if (hasRow) drawHandleRow(ctx, L.row, tx, box.y + L.d * 0.72, theme);
}

function layoutCard(ctx, p, k) {
  const pad = 22 * k;
  const d = 78 * k;
  const gap = 20 * k;
  const nameSize = 27 * k;
  const roleSize = 18 * k;
  const nameW = measureLine(ctx, p.name, 600, nameSize, -0.01);
  const roleW = measureLine(ctx, p.role, 400, roleSize);
  const row = measureHandleRow(ctx, p, 17 * k);
  const colH = nameSize * 1.2 + (p.role ? roleSize * 1.4 : 0) + (row.h ? row.h + 8 * k : 0);
  const inner = Math.max(d, colH);
  return { pad, d, gap, nameSize, roleSize, row, colH, w: pad * 2 + d + gap + Math.max(nameW, roleW, row.w) + pad * 0.4, h: pad * 2 + inner };
}

function drawCard(ctx, p, L, box, img, theme, intensity, u) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 40 * u;
  ctx.shadowOffsetY = 14 * u;
  roundRectPath(ctx, box.x, box.y, box.w, box.h, L.pad * 1.1);
  ctx.fillStyle = rgba('#ffffff', isDark(theme.bg) ? 0.07 : 0.55);
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, box.x, box.y, box.w, box.h, L.pad * 1.1);
  ctx.lineWidth = Math.max(1, u);
  ctx.strokeStyle = rgba(theme.text, 0.14);
  ctx.stroke();

  drawAvatar(ctx, { x: box.x + L.pad, y: box.y + (box.h - L.d) / 2, d: L.d, image: img, name: p.name, theme });
  const tx = box.x + L.pad + L.d + L.gap;
  let y = box.y + (box.h - L.colH) / 2;
  drawLine(ctx, p.name, { x: tx, cy: y + L.nameSize * 0.6, weight: 600, size: L.nameSize, color: theme.text, tracking: -0.01 });
  y += L.nameSize * 1.2;
  if (p.role) {
    drawLine(ctx, p.role, { x: tx, cy: y + L.roleSize * 0.7, weight: 400, size: L.roleSize, color: rgba(theme.text, 0.62) });
    y += L.roleSize * 1.4;
  }
  if (L.row.h) drawHandleRow(ctx, L.row, tx, y + 8 * (L.pad / 22) + L.row.h / 2, theme);
}

function layoutHero(ctx, p, k) {
  const d = 190 * k;
  const nameSize = 62 * k;
  const roleSize = 26 * k;
  const nameW = measureLine(ctx, p.name, 650, nameSize, -0.03);
  const roleW = measureLine(ctx, p.role, 400, roleSize);
  const row = measureHandleRow(ctx, p, 22 * k);
  const gaps = { avatar: 32 * k, role: 10 * k, row: 20 * k };
  const h = d + gaps.avatar + nameSize * 1.1 + (p.role ? gaps.role + roleSize * 1.3 : 0) + (row.h ? gaps.row + row.h : 0);
  return { d, nameSize, roleSize, row, gaps, w: Math.max(d, nameW, roleW, row.w), h };
}

function drawHero(ctx, p, L, box, img, theme, intensity) {
  const cx = box.x + box.w / 2;
  ctx.save();
  ctx.globalCompositeOperation = lightBlend(theme.bg);
  glow(ctx, cx, box.y + L.d / 2, L.d * 1.25, theme.accent, 0.5 * intensity);
  ctx.restore();
  drawAvatar(ctx, { x: cx - L.d / 2, y: box.y, d: L.d, image: img, name: p.name, theme });
  let y = box.y + L.d + L.gaps.avatar;
  drawLine(ctx, p.name, { x: cx, cy: y + L.nameSize * 0.55, weight: 650, size: L.nameSize, color: theme.text, align: 'center', tracking: -0.03 });
  y += L.nameSize * 1.1;
  if (p.role) {
    y += L.gaps.role;
    drawLine(ctx, p.role, { x: cx, cy: y + L.roleSize * 0.65, weight: 400, size: L.roleSize, color: rgba(theme.text, 0.64), align: 'center' });
    y += L.roleSize * 1.3;
  }
  if (L.row.h) drawHandleRow(ctx, L.row, cx - L.row.w / 2, y + L.gaps.row + L.row.h / 2, theme);
}

const VARIANTS = {
  chip: { layout: layoutChip, draw: drawChip },
  card: { layout: layoutCard, draw: drawCard },
  hero: { layout: layoutHero, draw: drawHero },
  avatar: {
    layout: (ctx, p, k) => ({ d: 170 * k, w: 170 * k, h: 170 * k }),
    draw: (ctx, p, L, box, img, theme, intensity) => {
      ctx.save();
      ctx.globalCompositeOperation = lightBlend(theme.bg);
      glow(ctx, box.x + L.d / 2, box.y + L.d / 2, L.d * 1.2, theme.accent, 0.5 * intensity);
      ctx.restore();
      drawAvatar(ctx, { x: box.x, y: box.y, d: L.d, image: img, name: p.name, theme });
    },
  },
};

/** Draws a profile layer centred on (cx, cy). Returns its bounding box. */
export function drawProfileLayer(ctx, layer, profile, img, { W, H, u, theme, intensity }) {
  const variant = VARIANTS[layer.variant] ?? VARIANTS.chip;
  const p = profile ?? { name: 'Missing profile', role: '', handle: '', platform: 'none' };
  const L = variant.layout(ctx, p, u * layer.scale);
  const box = { x: layer.cx * W - L.w / 2, y: layer.cy * H - L.h / 2, w: L.w, h: L.h };
  ctx.save();
  variant.draw(ctx, p, L, box, img, theme, intensity, u);
  ctx.restore();
  return box;
}
