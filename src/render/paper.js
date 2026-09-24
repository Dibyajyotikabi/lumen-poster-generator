import { mix, rgba } from '../core/color.js';

const noise = (seed, n) => {
  const value = Math.sin(seed * 23.73 + n * 91.17) * 43758.5453;
  return value - Math.floor(value);
};

function edgePath(ctx, x, y, w, h, style, seed, u) {
  const tear = style === 'tape' ? 0 : Math.min(h * 0.1, 9 * u);
  const steps = Math.max(12, Math.min(44, Math.ceil(w / (18 * u))));
  ctx.beginPath();
  if (style === 'tape') {
    const cut = Math.min(h * 0.16, 10 * u);
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w, y + cut * 0.3);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x, y + h - cut * 0.3);
  } else {
    ctx.moveTo(x, y + tear);
    for (let i = 0; i <= steps; i += 1) {
      const px = x + (w * i) / steps;
      ctx.lineTo(px, y + noise(seed, i) * tear);
    }
    ctx.lineTo(x + w - tear * 0.5, y + h * 0.5);
    for (let i = steps; i >= 0; i -= 1) {
      const px = x + (w * i) / steps;
      ctx.lineTo(px, y + h - noise(seed + 7, i) * tear);
    }
    ctx.lineTo(x + tear * 0.5, y + h * 0.5);
  }
  ctx.closePath();
}

/** A deterministic paper scrap. The same preview and export get identical edges and fibers. */
export function drawPaper(ctx, { x, y, w, h, color, ink, style = 'torn', seed = 1, u = 1 }) {
  if (w <= 0 || h <= 0) return;
  const shade = mix(color, style === 'dark' ? '#000000' : '#56472f', style === 'newsprint' ? 0.2 : 0.1);
  ctx.save();
  edgePath(ctx, x, y, w, h, style, seed, u);
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = 17 * u;
  ctx.shadowOffsetX = 3 * u;
  ctx.shadowOffsetY = 7 * u;
  const gradient = ctx.createLinearGradient(x, y, x + w * 0.1, y + h);
  gradient.addColorStop(0, mix(color, '#ffffff', 0.15));
  gradient.addColorStop(0.54, color);
  gradient.addColorStop(1, shade);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.clip();

  // A bright torn edge and a dark lower lip make the sheet read as material.
  ctx.lineWidth = Math.max(1, 1.4 * u);
  ctx.strokeStyle = rgba('#ffffff', 0.68);
  ctx.beginPath();
  ctx.moveTo(x, y + 2 * u);
  ctx.lineTo(x + w, y + 2 * u);
  ctx.stroke();
  ctx.strokeStyle = rgba('#4c382c', 0.22);
  ctx.beginPath();
  ctx.moveTo(x, y + h - 3 * u);
  ctx.lineTo(x + w, y + h - 3 * u);
  ctx.stroke();

  const fibers = Math.min(320, Math.max(45, Math.floor((w * h) / (500 * u * u))));
  for (let i = 0; i < fibers; i += 1) {
    const px = x + noise(seed + 31, i) * w;
    const py = y + noise(seed + 73, i) * h;
    const len = (1 + noise(seed + 59, i) * 4) * u;
    ctx.strokeStyle = rgba(i % 3 ? ink : '#ffffff', i % 3 ? 0.09 : 0.21);
    ctx.lineWidth = Math.max(0.5, noise(seed + 83, i) * u);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + len, py - len * 0.2);
    ctx.stroke();
  }

  if (style === 'notebook') {
    ctx.strokeStyle = 'rgba(72,112,169,0.31)';
    ctx.lineWidth = Math.max(1, u);
    const spacing = Math.max(12 * u, Math.min(27 * u, h / 4));
    for (let yy = y + spacing; yy < y + h; yy += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(214,70,69,0.54)';
    ctx.beginPath();
    ctx.moveTo(x + Math.min(18 * u, w * 0.1), y);
    ctx.lineTo(x + Math.min(18 * u, w * 0.1), y + h);
    ctx.stroke();
  } else if (style === 'newsprint' || style === 'dark') {
    ctx.fillStyle = rgba(ink, 0.11);
    const gap = Math.max(9 * u, Math.sqrt((w * h) / 2400));
    for (let row = 0; row < Math.floor(h / gap); row += 1) {
      for (let col = 0; col < Math.floor(w / gap); col += 1) {
        ctx.beginPath();
        ctx.arc(x + (col + 0.5) * gap, y + (row + 0.5) * gap, 0.7 * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (style === 'tape') {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y + h * 0.12, w, h * 0.15);
    ctx.strokeStyle = rgba(ink, 0.13);
    ctx.lineWidth = Math.max(0.5, u);
    for (let xx = x - h; xx < x + w; xx += 12 * u) {
      ctx.beginPath();
      ctx.moveTo(xx, y + h);
      ctx.lineTo(xx + h, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}
