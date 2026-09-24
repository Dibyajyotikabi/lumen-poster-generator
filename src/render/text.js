import { rgba, mix } from '../core/color.js';
import { wrapLines } from '../core/layout.js';
import { ensureFont } from '../fonts/loader.js';

const MARK = '*';
const FALLBACK_STACK = 'ui-sans-serif, system-ui, -apple-system, sans-serif';

export const stripMarks = (str) => str.split(MARK).join('');

export function fontString({ family, weight, style }, size) {
  return `${style === 'italic' ? 'italic ' : ''}${weight} ${size.toFixed(2)}px "${family}", ${FALLBACK_STACK}`;
}

export function applyFont(ctx, face, size, tracking = 0) {
  ctx.font = fontString(face, size);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(size * tracking).toFixed(2)}px`;
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Measures and wraps a text layer. Box is centred on (cx, cy). */
export function layoutText(ctx, layer, W, H, u) {
  const size = Math.max(1, layer.size * u);
  const face = ensureFont(layer.font);
  applyFont(ctx, face, size, layer.tracking);
  const text = layer.uppercase ? layer.text.toUpperCase() : layer.text;
  const maxWidth = Math.max(size, layer.width * W);
  const measure = (s) => ctx.measureText(stripMarks(s)).width;
  const lines = wrapLines(text, maxWidth, measure);
  const widths = lines.map(measure);
  const lineH = size * layer.lineHeight;
  const boxH = Math.max(lineH, lines.length * lineH);
  const box = { x: layer.cx * W - maxWidth / 2, y: layer.cy * H - boxH / 2, w: maxWidth, h: boxH };
  return { face, size, lines, widths, lineH, box };
}

function lineStartX(L, layer, i) {
  const { box } = L;
  if (layer.align === 'left') return box.x;
  if (layer.align === 'right') return box.x + box.w - L.widths[i];
  return box.x + (box.w - L.widths[i]) / 2;
}

/** Paints every line; text wrapped in *stars* uses `highlight`. Highlight state carries across lines. */
function paintLines(ctx, L, layer, { fill, highlight, dx = 0, dy = 0, stroke = false }) {
  let on = false;
  L.lines.forEach((line, i) => {
    const y = L.box.y + (i + 0.5) * L.lineH + dy;
    let x = lineStartX(L, layer, i) + dx;
    line.split(MARK).forEach((part, j) => {
      if (j > 0) on = !on;
      if (!part) return;
      if (stroke) {
        ctx.strokeStyle = on ? highlight : fill;
        ctx.strokeText(part, x, y);
      } else {
        ctx.fillStyle = on ? highlight : fill;
        ctx.fillText(part, x, y);
      }
      x += ctx.measureText(part).width;
    });
  });
}

function drawBoxDecoration(ctx, L, layer, colors, u) {
  if (layer.box === 'none' || !L.lines.length) return;
  const { size, lineH } = L;
  if (layer.box === 'pill') {
    const maxW = Math.max(...L.widths);
    const padX = size * 0.9;
    const h = lineH * L.lines.length + size * 1.05;
    const left = Math.min(...L.lines.map((_, i) => lineStartX(L, layer, i))) - padX;
    roundRectPath(ctx, left, L.box.y + L.box.h / 2 - h / 2, maxW + padX * 2, h, h / 2);
    ctx.fillStyle = rgba(colors.fill, 0.07);
    ctx.fill();
    ctx.lineWidth = Math.max(1, u * 1.2);
    ctx.strokeStyle = rgba(colors.fill, 0.2);
    ctx.stroke();
    return;
  }
  // Marker: a solid block behind each line.
  ctx.fillStyle = colors.effect;
  L.lines.forEach((line, i) => {
    if (!line) return;
    const padX = size * 0.2;
    const y = L.box.y + (i + 0.5) * lineH;
    roundRectPath(ctx, lineStartX(L, layer, i) - padX, y - size * 0.56, L.widths[i] + padX * 2, size * 1.12, size * 0.12);
    ctx.fill();
  });
}

export function drawText(ctx, layer, L, theme, u) {
  if (!L.lines.length) return;
  const base = layer.color ?? theme.text;
  const colors = {
    fill: base,
    effect: layer.effectColor ?? theme.accent,
    highlight: layer.highlight ?? theme.accent,
  };
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  drawBoxDecoration(ctx, L, layer, colors, u);
  applyFont(ctx, L.face, L.size, layer.tracking);

  let fill = base;
  if (layer.gradient) {
    const g = ctx.createLinearGradient(0, L.box.y, 0, L.box.y + L.box.h);
    g.addColorStop(0, base);
    g.addColorStop(1, mix(base, theme.bg, 0.45));
    fill = g;
  }
  const paint = (opts = {}) => paintLines(ctx, L, layer, { fill, highlight: colors.highlight, ...opts });

  switch (layer.effect) {
    case 'shadow':
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = L.size * 0.28;
      ctx.shadowOffsetY = L.size * 0.06;
      paint();
      break;
    case 'glow':
      ctx.shadowColor = colors.effect;
      ctx.shadowBlur = L.size * 0.5;
      paint();
      ctx.shadowBlur = L.size * 0.18;
      paint();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      paint();
      break;
    case 'outline':
      ctx.lineWidth = Math.max(1, L.size * 0.03);
      ctx.lineJoin = 'round';
      paint({ stroke: true });
      break;
    case 'extrude': {
      const depth = Math.max(2, Math.round(L.size * 0.08));
      const side = mix(colors.effect, '#000000', 0.25);
      for (let d = depth; d > 0; d -= 1) paint({ fill: side, highlight: side, dx: d * 0.6, dy: d });
      paint();
      break;
    }
    default:
      paint();
  }
  ctx.restore();
}
