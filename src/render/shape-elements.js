import { mix, rgba } from '../core/color.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

function shadowed(ctx, u, blur, offset, alpha, paint) {
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = blur * u;
  ctx.shadowOffsetY = offset * u;
  paint();
  ctx.restore();
}

/** Box / shape layers for boxed posts. Returns false for unknown variants. */
export function drawShapeElement(ctx, variant, { x, y, w, h, color, u }) {
  const edge = Math.min(w, h);
  switch (variant) {
    case 'post-card': {
      const r = Math.min(28 * u, edge * 0.08);
      shadowed(ctx, u, 60, 24, 0.28, () => {
        rr(ctx, x, y, w, h, r);
        ctx.fillStyle = color;
        ctx.fill();
      });
      rr(ctx, x, y, w, h, r);
      ctx.strokeStyle = rgba(mix(color, '#000000', 0.5), 0.12);
      ctx.lineWidth = Math.max(1, u);
      ctx.stroke();
      return true;
    }
    case 'box':
      rr(ctx, x, y, w, h, Math.min(18 * u, edge * 0.1));
      ctx.fillStyle = color;
      ctx.fill();
      return true;
    case 'box-outline': {
      const lw = Math.max(2 * u, edge * 0.025);
      rr(ctx, x + lw / 2, y + lw / 2, w - lw, h - lw, Math.min(18 * u, edge * 0.1));
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
      return true;
    }
    case 'brutal-box': {
      const off = Math.max(6 * u, edge * 0.04);
      const lw = Math.max(3 * u, edge * 0.018);
      ctx.fillStyle = '#111111';
      ctx.fillRect(x + off, y + off, w - off, h - off);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w - off, h - off);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = lw;
      ctx.strokeRect(x + lw / 2, y + lw / 2, w - off - lw, h - off - lw);
      return true;
    }
    case 'glass-box': {
      const r = Math.min(26 * u, edge * 0.1);
      shadowed(ctx, u, 40, 16, 0.22, () => {
        rr(ctx, x, y, w, h, r);
        ctx.fillStyle = rgba(color, 0.14);
        ctx.fill();
      });
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, rgba(color, 0.22));
      g.addColorStop(1, rgba(color, 0.05));
      rr(ctx, x, y, w, h, r);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(color, 0.45);
      ctx.lineWidth = Math.max(1, 1.5 * u);
      ctx.stroke();
      return true;
    }
    case 'pill-shape':
      rr(ctx, x, y, w, h, h / 2);
      ctx.fillStyle = color;
      ctx.fill();
      return true;
    case 'circle':
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      return true;
    case 'speech': {
      const tail = h * 0.2;
      const bh = h - tail;
      const r = Math.min(24 * u, edge * 0.2);
      shadowed(ctx, u, 30, 10, 0.2, () => {
        rr(ctx, x, y, w, bh, r);
        ctx.moveTo(x + w * 0.22, y + bh - 1);
        ctx.lineTo(x + w * 0.16, y + h);
        ctx.lineTo(x + w * 0.38, y + bh - 1);
        ctx.fillStyle = color;
        ctx.fill();
      });
      return true;
    }
    case 'star-burst': {
      const spikes = 14;
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.beginPath();
      for (let i = 0; i <= spikes * 2; i += 1) {
        const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const k = i % 2 ? 0.74 : 1;
        ctx.lineTo(cx + Math.cos(a) * (w / 2) * k, cy + Math.sin(a) * (h / 2) * k);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = Math.max(2 * u, edge * 0.02);
      ctx.stroke();
      return true;
    }
    case 'line':
      rr(ctx, x, y, w, h, h / 2);
      ctx.fillStyle = color;
      ctx.fill();
      return true;
    default:
      return false;
  }
}
