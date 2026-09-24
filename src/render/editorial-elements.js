import { isDark, mix, rgba } from '../core/color.js';

function polygon(ctx, points, fill) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function voxel(ctx, x, y, size, color) {
  const side = size * 0.28;
  polygon(ctx, [[x, y], [x + size, y], [x + size + side, y - side], [x + side, y - side]], mix(color, '#ffffff', 0.34));
  polygon(ctx, [[x + size, y], [x + size + side, y - side], [x + size + side, y + size - side], [x + size, y + size]], mix(color, '#000000', 0.34));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

/** Drag-and-resize editorial graphics rendered in both preview and export. */
export function drawEditorialElement(ctx, layer, { W, H, u, theme }) {
  const w = Math.max(4 * u, layer.width * W);
  const h = Math.max(4 * u, layer.height * H);
  const x = layer.cx * W - w / 2;
  const y = layer.cy * H - h / 2;
  const color = layer.color ?? theme.accent;
  const light = mix(color, '#ffffff', 0.46);
  const dark = mix(color, '#000000', 0.36);
  ctx.save();
  ctx.globalAlpha = layer.opacity;

  switch (layer.variant) {
    case 'bar': {
      polygon(ctx, [[x, y], [x + w, y], [x + w - h * 0.55, y + h], [x, y + h]], color);
      ctx.fillStyle = light;
      ctx.fillRect(x, y, w * 0.18, Math.max(2 * u, h * 0.14));
      break;
    }
    case 'rule': {
      const radius = Math.min(h * 0.25, 8 * u);
      ctx.fillStyle = color;
      ctx.fillRect(x, y + h / 2 - Math.max(1.5 * u, h * 0.06), w - radius * 3, Math.max(3 * u, h * 0.12));
      ctx.beginPath();
      ctx.arc(x + w - radius, y + h / 2, radius, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'number': {
      const radius = Math.min(w, h) * 0.48;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isDark(color) ? '#ffffff' : '#14141a';
      ctx.font = `800 ${Math.min(radius * 1.25, w / Math.max(1, String(layer.text).length) * 1.4)}px ui-sans-serif, system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(layer.text || '01').slice(0, 4), x + w / 2, y + h / 2);
      break;
    }
    case 'quote': {
      ctx.font = `900 ${Math.min(h * 1.8, w * 0.75)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText('“', x + w / 2, y + h * 0.61);
      break;
    }
    case 'arrow': {
      const stem = Math.min(h * 0.18, 10 * u);
      const head = Math.min(h * 0.4, w * 0.26);
      ctx.fillStyle = color;
      ctx.fillRect(x, y + h / 2 - stem / 2, w - head * 0.7, stem);
      polygon(ctx, [[x + w - head, y + h / 2 - head], [x + w, y + h / 2], [x + w - head, y + h / 2 + head]], color);
      break;
    }
    case 'dots': {
      const cols = Math.max(3, Math.min(16, Math.round(w / (17 * u))));
      const rows = Math.max(2, Math.min(9, Math.round(h / (17 * u))));
      const stepX = w / cols;
      const stepY = h / rows;
      ctx.fillStyle = color;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const r = Math.min(stepX, stepY) * (0.13 + 0.18 * (col / cols));
          ctx.beginPath();
          ctx.arc(x + (col + 0.5) * stepX, y + (row + 0.5) * stepY, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'voxels': {
      const size = Math.min(w / 4.3, h / 2.7);
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          if (row === 1 && col === 0) continue;
          voxel(ctx, x + col * size * 0.96, y + (row + 0.35) * size * 0.97, size * 0.78,
            (row + col) % 3 === 0 ? light : (row + col) % 3 === 1 ? color : dark);
        }
      }
      break;
    }
    case 'bracket': {
      const arm = Math.min(w, h) * 0.28;
      ctx.lineWidth = Math.max(3 * u, Math.min(w, h) * 0.06);
      ctx.lineCap = 'square';
      ctx.strokeStyle = color;
      for (const [sx, sy, dx, dy] of [
        [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
      ]) {
        ctx.beginPath();
        ctx.moveTo(sx + arm * dx, sy);
        ctx.lineTo(sx, sy);
        ctx.lineTo(sx, sy + arm * dy);
        ctx.stroke();
      }
      break;
    }
    default:
      ctx.fillStyle = rgba(color, 0.65);
      ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  return { x, y, w, h };
}
