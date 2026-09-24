import { rgba, isDark } from '../core/color.js';
import { wrapLines } from '../core/layout.js';
import { ensureFont } from '../fonts/loader.js';
import { applyFont, roundRectPath } from './text.js';

const NOMINAL_WIDTH = 560; // design units; everything scales with the card's width
const UI = { id: 'geist', family: 'Geist', italic: false };
const MONO = { id: 'geist-mono', family: 'Geist Mono', italic: false };
const face = (font, weight) => ensureFont({ ...font, weight });

/** Wraps text and caps it to `max` lines, ending with an ellipsis when cut. */
function clampedLines(ctx, text, maxWidth, max) {
  const lines = wrapLines(text, maxWidth, (s) => ctx.measureText(s).width);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  return [...kept.slice(0, -1), `${last.replace(/[\s.,;:–-]+$/, '')}…`];
}

function coverImage(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  ctx.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2, img.width * s, img.height * s);
}

function drawIcon(ctx, icon, x, y, size, theme, domain) {
  roundRectPath(ctx, x, y, size, size, size * 0.26);
  if (icon) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    coverImage(ctx, icon, x, y, size, size);
    ctx.restore();
    return;
  }
  ctx.fillStyle = theme.accent;
  ctx.fill();
  applyFont(ctx, face(UI, 700), size * 0.56);
  ctx.fillStyle = isDark(theme.accent) ? '#ffffff' : '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((domain[0] ?? '·').toUpperCase(), x + size / 2, y + size * 0.54);
}

function textBlock(ctx, layer, k, maxWidth, { titleSize, descSize, titleLines, descLines }) {
  applyFont(ctx, face(UI, 600), titleSize * k, -0.015);
  const title = clampedLines(ctx, layer.title || layer.domain, maxWidth, titleLines);
  applyFont(ctx, face(UI, 400), descSize * k);
  const desc = layer.showDescription && layer.description ? clampedLines(ctx, layer.description, maxWidth, descLines) : [];
  const metaH = 24 * k;
  const gap = 12 * k;
  const titleH = title.length * titleSize * k * 1.18;
  const descH = desc.length * descSize * k * 1.42;
  return { title, desc, metaH, gap, titleH, descH, height: metaH + gap + titleH + (desc.length ? gap * 0.7 + descH : 0) };
}

function paintText(ctx, layer, k, x, y, block, sizes, theme, icon) {
  const iconSize = block.metaH;
  drawIcon(ctx, icon, x, y, iconSize, theme, layer.domain);
  applyFont(ctx, face(MONO, 500), 13.5 * k, 0.08);
  ctx.fillStyle = rgba(theme.text, 0.62);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText((layer.siteName || layer.domain).toUpperCase(), x + iconSize + 10 * k, y + iconSize / 2 + k);
  let cy = y + block.metaH + block.gap;
  applyFont(ctx, face(UI, 600), sizes.titleSize * k, -0.015);
  ctx.fillStyle = theme.text;
  block.title.forEach((line) => {
    ctx.fillText(line, x, cy + sizes.titleSize * k * 0.59);
    cy += sizes.titleSize * k * 1.18;
  });
  if (!block.desc.length) return;
  cy += block.gap * 0.7;
  applyFont(ctx, face(UI, 400), sizes.descSize * k);
  ctx.fillStyle = rgba(theme.text, 0.66);
  block.desc.forEach((line) => {
    ctx.fillText(line, x, cy + sizes.descSize * k * 0.71);
    cy += sizes.descSize * k * 1.42;
  });
}

function cardShell(ctx, box, radius, theme, u) {
  const dark = isDark(theme.bg);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 50 * u;
  ctx.shadowOffsetY = 20 * u;
  roundRectPath(ctx, box.x, box.y, box.w, box.h, radius);
  ctx.fillStyle = dark ? 'rgba(22,22,28,0.72)' : 'rgba(255,255,255,0.82)';
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, box.x, box.y, box.w, box.h, radius);
  ctx.lineWidth = Math.max(1, u);
  ctx.strokeStyle = rgba(theme.text, dark ? 0.16 : 0.12);
  ctx.stroke();
}

const VARIANTS = {
  card(ctx, layer, { W, H, u, theme }, image, icon) {
    const w = layer.width * W;
    const k = w / NOMINAL_WIDTH;
    const pad = 24 * k;
    const sizes = { titleSize: 28, descSize: 17, titleLines: 3, descLines: 2 };
    const imgH = image ? w / 1.91 : 0;
    const block = textBlock(ctx, layer, k, w - pad * 2, sizes);
    const h = imgH + pad * 2 + block.height;
    const box = { x: layer.cx * W - w / 2, y: layer.cy * H - h / 2, w, h };
    const radius = 26 * k;
    cardShell(ctx, box, radius, theme, u);
    if (image) {
      ctx.save();
      roundRectPath(ctx, box.x, box.y, w, h, radius);
      ctx.clip();
      coverImage(ctx, image, box.x, box.y, w, imgH);
      ctx.restore();
    }
    paintText(ctx, layer, k, box.x + pad, box.y + imgH + pad, block, sizes, theme, icon);
    return box;
  },

  compact(ctx, layer, { W, H, u, theme }, image, icon) {
    const w = layer.width * W;
    const k = w / NOMINAL_WIDTH;
    const pad = 18 * k;
    const thumb = image ? 150 * k : 0;
    const sizes = { titleSize: 23, descSize: 15, titleLines: 2, descLines: 2 };
    const textX = pad + (thumb ? thumb + 18 * k : 0);
    const block = textBlock(ctx, layer, k, w - textX - pad, sizes);
    const h = Math.max(thumb, block.height) + pad * 2;
    const box = { x: layer.cx * W - w / 2, y: layer.cy * H - h / 2, w, h };
    cardShell(ctx, box, 22 * k, theme, u);
    if (image) {
      ctx.save();
      roundRectPath(ctx, box.x + pad, box.y + (h - thumb) / 2, thumb, thumb, 14 * k);
      ctx.clip();
      coverImage(ctx, image, box.x + pad, box.y + (h - thumb) / 2, thumb, thumb);
      ctx.restore();
    }
    paintText(ctx, layer, k, box.x + textX, box.y + (h - block.height) / 2, block, sizes, theme, icon);
    return box;
  },

  minimal(ctx, layer, { W, H, u, theme }, image, icon) {
    const w = layer.width * W;
    const k = w / NOMINAL_WIDTH;
    const pad = 16 * k;
    const sizes = { titleSize: 21, descSize: 0, titleLines: 1, descLines: 0 };
    const iconSize = 40 * k;
    applyFont(ctx, face(UI, 600), sizes.titleSize * k, -0.01);
    const [title] = clampedLines(ctx, layer.title || layer.domain, w - iconSize - pad * 3 - 30 * k, 1);
    const h = iconSize + pad * 2;
    const box = { x: layer.cx * W - w / 2, y: layer.cy * H - h / 2, w, h };
    cardShell(ctx, box, h / 2, theme, u);
    drawIcon(ctx, icon ?? image, box.x + pad, box.y + pad, iconSize, theme, layer.domain);
    const tx = box.x + pad * 2 + iconSize;
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, tx, box.y + h * 0.4);
    applyFont(ctx, face(MONO, 500), 12 * k, 0.06);
    ctx.fillStyle = rgba(theme.text, 0.6);
    ctx.fillText(layer.domain.toUpperCase(), tx, box.y + h * 0.7);
    applyFont(ctx, face(UI, 500), 24 * k);
    ctx.fillStyle = rgba(theme.text, 0.7);
    ctx.textAlign = 'right';
    ctx.fillText('↗', box.x + w - pad * 1.4, box.y + h / 2);
    return box;
  },
};

/** Draws a link-preview layer centred on (cx, cy). Returns its bounding box. */
export function drawLinkLayer(ctx, layer, image, icon, env) {
  return (VARIANTS[layer.variant] ?? VARIANTS.card)(ctx, layer, env, image, icon);
}
