import { isDark, rgba, mix } from '../core/color.js';
import { fitTextBlock, wrapLines } from '../core/layout.js';
import { stripMarks, styledLines } from '../core/text-markup.js';
import { ensureFont } from '../fonts/loader.js';

const FALLBACK_STACK = 'ui-sans-serif, system-ui, -apple-system, sans-serif';

export { stripMarks };

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

/** Measures and wraps a text layer; auto-fit boxes stay within the canvas margins. */
export function layoutText(ctx, layer, W, H, u, fitBounds = null) {
  let size = Math.max(1, layer.size * u);
  const face = ensureFont(layer.font);
  const text = layer.uppercase ? layer.text.toUpperCase() : layer.text;
  const marginX = W * 0.06;
  const marginY = H * 0.07;
  const top = Math.max(marginY, fitBounds?.top ?? marginY);
  const bottom = Math.min(H - marginY, fitBounds?.bottom ?? H - marginY);
  const maxWidth = layer.autoFit
    ? Math.max(1, Math.min(layer.width * W, W - marginX * 2))
    : Math.max(size, layer.width * W);
  const lineHeight = layer.autoFit && (text.length > 80 || text.split('\n').length > 2)
    ? Math.max(layer.lineHeight, 1.16)
    : layer.lineHeight;
  let lines;
  if (layer.autoFit) {
    const fitted = fitTextBlock({
      text,
      maxWidth,
      maxHeight: bottom - top,
      maxSize: size,
      lineHeight,
      measureAt: (s, atSize) => {
        applyFont(ctx, face, atSize, layer.tracking);
        return ctx.measureText(stripMarks(s)).width;
      },
    });
    size = fitted.size;
    lines = fitted.lines;
  } else {
    applyFont(ctx, face, size, layer.tracking);
    lines = wrapLines(text, maxWidth, (s) => ctx.measureText(stripMarks(s)).width);
  }
  applyFont(ctx, face, size, layer.tracking);
  const measure = (s) => ctx.measureText(stripMarks(s)).width;
  const widths = lines.map(measure);
  const lineH = size * lineHeight;
  const boxH = Math.max(lineH, lines.length * lineH);
  const x = layer.autoFit
    ? Math.max(marginX, Math.min(W - marginX - maxWidth, layer.cx * W - maxWidth / 2))
    : layer.cx * W - maxWidth / 2;
  const y = layer.autoFit
    ? Math.max(top, Math.min(bottom - boxH, layer.cy * H - boxH / 2))
    : layer.cy * H - boxH / 2;
  const box = { x, y, w: maxWidth, h: boxH };
  return { face, size, lines, runs: styledLines(lines), widths, lineH, box };
}

function lineStartX(L, layer, i) {
  const { box } = L;
  if (layer.align === 'left') return box.x;
  if (layer.align === 'right') return box.x + box.w - L.widths[i];
  return box.x + (box.w - L.widths[i]) / 2;
}

/** Paints the text after paper shapes have been placed behind marked runs. */
function paintLines(ctx, L, layer, { fill, highlight, paperInk, dx = 0, dy = 0, stroke = false }) {
  L.runs.forEach((runs, i) => {
    const y = L.box.y + (i + 0.5) * L.lineH + dy;
    let x = lineStartX(L, layer, i) + dx;
    runs.forEach((run) => {
      const ink = run.paper || layer.box === 'paper' ? paperInk : run.highlight ? highlight : fill;
      if (stroke) {
        ctx.strokeStyle = ink;
        ctx.strokeText(run.text, x, y);
      } else {
        ctx.fillStyle = ink;
        ctx.fillText(run.text, x, y);
      }
      x += ctx.measureText(run.text).width;
    });
  });
}

function tornPaper(ctx, x, y, w, h, color, ink, seed, u) {
  const tear = Math.max(1, u * 2.5);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y + tear);
  ctx.lineTo(x + w * 0.24, y);
  ctx.lineTo(x + w * 0.68, y + tear * 0.65);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - tear, y + h * 0.52);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w * 0.62, y + h - tear * 0.4);
  ctx.lineTo(x + w * 0.28, y + h);
  ctx.lineTo(x, y + h - tear);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 12 * u;
  ctx.shadowOffsetY = 4 * u;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.clip();
  ctx.strokeStyle = rgba(ink, 0.09);
  ctx.lineWidth = Math.max(0.5, u * 0.7);
  const count = Math.min(45, Math.max(8, Math.round(w * h / (3500 * u * u))));
  for (let i = 0; i < count; i += 1) {
    const px = x + ((i * 0.618 + seed * 0.137) % 1) * w;
    const py = y + ((i * 0.414 + seed * 0.271) % 1) * h;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + (2 + i % 4) * u, py - u * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPaperRuns(ctx, L, layer, paperColor, paperInk, u) {
  L.runs.forEach((runs, i) => {
    let x = lineStartX(L, layer, i);
    let start = null;
    let width = 0;
    const draw = () => {
      if (start === null) return;
      const padX = L.size * 0.16;
      const h = L.lineH * 0.88;
      const y = L.box.y + (i + 0.5) * L.lineH - h / 2;
      tornPaper(ctx, start - padX, y, width + padX * 2, h, paperColor, paperInk, i + start, u);
      start = null;
      width = 0;
    };
    runs.forEach((run) => {
      const runWidth = ctx.measureText(run.text).width;
      if (run.paper) {
        start ??= x;
        width += runWidth;
      } else draw();
      x += runWidth;
    });
    draw();
  });
}

function drawBoxDecoration(ctx, L, layer, colors, u) {
  if (layer.box === 'none' || !L.lines.length) return;
  const { size, lineH } = L;
  if (layer.box === 'paper') {
    const left = Math.min(...L.lines.map((_, i) => lineStartX(L, layer, i)));
    const right = Math.max(...L.lines.map((_, i) => lineStartX(L, layer, i) + L.widths[i]));
    tornPaper(ctx, left - size * 0.38, L.box.y - size * 0.24,
      right - left + size * 0.76, L.box.h + size * 0.48,
      colors.paper, colors.paperInk, 1, u);
    return;
  }
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
    paper: layer.paperColor ?? '#f4ead5',
  };
  colors.paperInk = isDark(colors.paper) ? '#fffaf0' : '#222027';
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  drawBoxDecoration(ctx, L, layer, colors, u);
  applyFont(ctx, L.face, L.size, layer.tracking);
  if (layer.box !== 'paper') drawPaperRuns(ctx, L, layer, colors.paper, colors.paperInk, u);

  let fill = base;
  if (layer.gradient) {
    const g = ctx.createLinearGradient(0, L.box.y, 0, L.box.y + L.box.h);
    g.addColorStop(0, base);
    g.addColorStop(1, mix(base, theme.bg, 0.45));
    fill = g;
  }
  const paint = (opts = {}) => paintLines(ctx, L, layer, { fill, highlight: colors.highlight, paperInk: colors.paperInk, ...opts });

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
      for (let d = depth; d > 0; d -= 1) paint({ fill: side, highlight: side, paperInk: side, dx: d * 0.6, dy: d });
      paint();
      break;
    }
    case 'editorial': {
      const offset = Math.max(2, L.size * 0.065);
      paint({ fill: colors.effect, highlight: colors.effect, paperInk: colors.effect, dx: offset, dy: offset });
      paint();
      ctx.fillStyle = colors.effect;
      L.lines.forEach((line, i) => {
        if (!line) return;
        const x = lineStartX(L, layer, i);
        const y = L.box.y + (i + 0.88) * L.lineH;
        ctx.fillRect(x, y, Math.min(L.widths[i], L.size * 2.8), Math.max(2 * u, L.size * 0.045));
      });
      break;
    }
    case 'voxel': {
      const step = Math.max(1.5 * u, L.size * 0.035);
      const side = mix(colors.effect, '#000000', 0.32);
      for (let d = 6; d >= 1; d -= 1) {
        paint({ fill: side, highlight: side, paperInk: side, dx: d * step, dy: d * step });
      }
      ctx.lineJoin = 'miter';
      ctx.lineWidth = Math.max(1.5 * u, L.size * 0.035);
      paint({ fill: colors.effect, highlight: colors.effect, paperInk: colors.effect, stroke: true });
      paint();
      break;
    }
    default:
      paint();
  }
  ctx.restore();
}
