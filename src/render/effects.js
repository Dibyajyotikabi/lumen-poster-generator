import { rgba, mix, shiftHue, isDark } from '../core/color.js';

const TAU = Math.PI * 2;
const GLOW_STOPS = 8;
const GRAIN_TILE = 256;
const GRAIN_MAX_ALPHA = 90;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Light adds on dark backgrounds, tints on light ones. */
export const lightBlend = (bg) => (isDark(bg) ? 'screen' : 'source-over');

/** Soft radial light with an eased falloff. `squash` < 1 flattens it into an ellipse. */
export function glow(ctx, x, y, r, color, alpha, squash = 1) {
  if (r <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, squash);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  for (let i = 0; i <= GLOW_STOPS; i += 1) {
    const t = i / GLOW_STOPS;
    g.addColorStop(t, rgba(color, alpha * (1 - t) ** 2.2));
  }
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

function aura(ctx, { w, h, rng, accent, bg, intensity }) {
  const hues = [accent, shiftHue(accent, 38), shiftHue(accent, -32), mix(accent, '#ffffff', 0.4)];
  const strength = isDark(bg) ? 0.6 : 0.42;
  ctx.globalCompositeOperation = lightBlend(bg);
  hues.forEach((color) => {
    const x = w * (0.08 + rng() * 0.84);
    const y = h * (-0.15 + rng() * 1.3);
    const r = Math.max(w, h) * (0.28 + rng() * 0.3);
    glow(ctx, x, y, r, color, strength * intensity * (0.6 + rng() * 0.4));
  });
}

function spotlight(ctx, { w, h, rng, accent, bg, intensity }) {
  const light = mix(accent, '#ffffff', 0.55);
  const cx = w * (0.35 + rng() * 0.3);
  const topW = w * 0.05;
  const botW = w * (0.55 + rng() * 0.3);
  const layers = 7;
  ctx.globalCompositeOperation = lightBlend(bg);
  // Stacked translucent trapezoids give the beam soft edges.
  for (let k = 0; k < layers; k += 1) {
    const f = 1 - k * 0.12;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(light, (0.34 * intensity) / layers));
    g.addColorStop(0.75, rgba(light, (0.06 * intensity) / layers));
    g.addColorStop(1, rgba(light, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - (topW * f) / 2, 0);
    ctx.lineTo(cx + (topW * f) / 2, 0);
    ctx.lineTo(cx + (botW * f) / 2, h);
    ctx.lineTo(cx - (botW * f) / 2, h);
    ctx.closePath();
    ctx.fill();
  }
  glow(ctx, cx, 0, w * 0.45, light, 0.7 * intensity, 0.5);
  glow(ctx, cx, h * 1.02, w * 0.5, accent, 0.35 * intensity, 0.25);
}

function rays(ctx, { w, h, rng, accent, bg, intensity }) {
  const light = mix(accent, '#ffffff', 0.45);
  const ox = w * (0.15 + rng() * 0.7);
  const oy = -h * 0.2;
  const len = Math.hypot(w, h) * 1.3;
  const count = 9 + Math.floor(rng() * 6);
  const aim = Math.atan2(h * 0.6 - oy, w / 2 - ox);
  ctx.globalCompositeOperation = lightBlend(bg);
  for (let i = 0; i < count; i += 1) {
    const angle = aim + (rng() - 0.5) * 1.5;
    const spread = 0.01 + rng() * 0.045;
    const alpha = (0.08 + rng() * 0.18) * intensity;
    [1, 1.9, 3].forEach((widen, layer) => {
      const a = alpha * [0.55, 0.3, 0.15][layer];
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, len);
      g.addColorStop(0, rgba(light, a));
      g.addColorStop(0.55, rgba(light, a * 0.35));
      g.addColorStop(1, rgba(light, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(angle - spread * widen) * len, oy + Math.sin(angle - spread * widen) * len);
      ctx.lineTo(ox + Math.cos(angle + spread * widen) * len, oy + Math.sin(angle + spread * widen) * len);
      ctx.closePath();
      ctx.fill();
    });
  }
  glow(ctx, ox, 0, w * 0.35, light, 0.6 * intensity, 0.6);
  glow(ctx, w * (0.2 + rng() * 0.6), h, w * 0.5, accent, 0.25 * intensity, 0.4);
}

function eclipse(ctx, { w, h, u, rng, accent, bg, intensity }) {
  const dark = isDark(bg);
  const light = mix(accent, '#ffffff', 0.5);
  const R = Math.max(w, h * 1.6) * (0.62 + rng() * 0.1);
  const cx = w * (0.5 + (rng() - 0.5) * 0.2);
  const top = h * (0.72 + rng() * 0.08);
  const cy = top + R;

  ctx.globalCompositeOperation = lightBlend(bg);
  glow(ctx, cx, top, w * 0.7, accent, 0.55 * intensity, 0.32);
  glow(ctx, cx, top, w * 0.3, light, 0.6 * intensity, 0.18);
  ctx.globalCompositeOperation = 'source-over';

  const body = ctx.createLinearGradient(0, top, 0, h);
  body.addColorStop(0, dark ? mix(bg, '#000000', 0.25) : mix(bg, '#ffffff', 0.6));
  body.addColorStop(1, dark ? mix(bg, '#000000', 0.55) : mix(bg, '#ffffff', 0.25));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.clip();
  glow(ctx, cx, top, w * 0.35, light, 0.3 * intensity, 0.2);
  ctx.restore();

  const rim = ctx.createLinearGradient(cx - w * 0.5, 0, cx + w * 0.5, 0);
  rim.addColorStop(0, rgba(light, 0));
  rim.addColorStop(0.5, rgba(light, Math.min(1, 0.95 * intensity + 0.15)));
  rim.addColorStop(1, rgba(light, 0));
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1.5, u * 2.2);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();
}

function grid(ctx, { w, h, u, rng, text, accent, bg, intensity }) {
  const cx = w * (0.4 + rng() * 0.2);
  const cy = h * (0.4 + rng() * 0.2);
  ctx.globalCompositeOperation = lightBlend(bg);
  glow(ctx, cx, cy * 0.6, Math.max(w, h) * 0.5, accent, 0.45 * intensity);
  ctx.globalCompositeOperation = 'source-over';

  const layer = makeCanvas(w, h);
  const g = layer.getContext('2d');
  const cell = Math.round(Math.min(w, h) / (7 + Math.floor(rng() * 5)));
  const ox = (w / 2) % cell;
  const oy = (h / 2) % cell;
  const lw = Math.max(1, Math.round(u));
  const crisp = (v) => Math.round(v) + (lw % 2 ? 0.5 : 0);
  g.strokeStyle = rgba(text, 0.16);
  g.lineWidth = lw;
  g.beginPath();
  for (let x = ox; x <= w; x += cell) {
    g.moveTo(crisp(x), 0);
    g.lineTo(crisp(x), h);
  }
  for (let y = oy; y <= h; y += cell) {
    g.moveTo(0, crisp(y));
    g.lineTo(w, crisp(y));
  }
  g.stroke();

  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, w, h);
  ctx.drawImage(layer, 0, 0);
}

function mesh(ctx, { w, h, rng, accent, bg, intensity }) {
  const colors = [accent, shiftHue(accent, 55), shiftHue(accent, -45), mix(accent, bg, 0.4)];
  const offset = Math.floor(rng() * colors.length);
  const R = Math.max(w, h) * 0.85;
  [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([px, py], i) => {
    const x = w * (px * 0.8 + 0.1 + (rng() - 0.5) * 0.3);
    const y = h * (py * 0.8 + 0.1 + (rng() - 0.5) * 0.3);
    glow(ctx, x, y, R * (0.7 + rng() * 0.4), colors[(i + offset) % colors.length], 0.75 * intensity);
  });
  // Calm the centre so type stays legible.
  glow(ctx, w / 2, h / 2, Math.max(w, h) * 0.45, bg, 0.4);
}

function plain(ctx, { w, h, bg, text, intensity }) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mix(bg, text, 0.06 * intensity));
  g.addColorStop(1, bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Cheap, cross-browser blur: downscale then upscale with smoothing (two passes). */
export function softBlur(source, w, h, radius) {
  if (radius < 1) return source;
  const factor = Math.max(1 / 48, Math.min(1, 2 / radius));
  const sw = Math.max(1, Math.round(w * factor));
  const sh = Math.max(1, Math.round(h * factor));
  const small = makeCanvas(sw, sh);
  const sctx = small.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(source, 0, 0, sw, sh);
  const mid = makeCanvas(Math.max(1, sw * 2), Math.max(1, sh * 2));
  const mctx = mid.getContext('2d');
  mctx.imageSmoothingQuality = 'high';
  mctx.drawImage(small, 0, 0, mid.width, mid.height);
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(mid, 0, 0, w, h);
  return out;
}

function blobs(ctx, { w, h, rng, accent, bg, intensity }) {
  const layer = makeCanvas(w, h);
  const g = layer.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const colors = [accent, shiftHue(accent, 50), shiftHue(accent, -60), mix(accent, '#ffffff', 0.35), shiftHue(accent, 160)];
  const count = 4 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i += 1) {
    g.globalAlpha = Math.min(1, (0.5 + rng() * 0.4) * intensity);
    g.fillStyle = colors[i % colors.length];
    g.beginPath();
    g.ellipse(w * rng(), h * rng(), Math.max(w, h) * (0.12 + rng() * 0.2), Math.max(w, h) * (0.1 + rng() * 0.18), rng() * Math.PI, 0, TAU);
    g.fill();
  }
  ctx.drawImage(softBlur(layer, w, h, Math.min(w, h) * 0.35), 0, 0);
}

function aurora(ctx, { w, h, rng, accent, bg, intensity }) {
  const colors = [accent, shiftHue(accent, 70), shiftHue(accent, -45)];
  ctx.globalCompositeOperation = lightBlend(bg);
  colors.forEach((color) => {
    const base = h * (0.2 + rng() * 0.45);
    const amp = h * (0.06 + rng() * 0.1);
    const freq = (1 + rng() * 2) * (TAU / w);
    const phase = rng() * TAU;
    const thick = h * (0.18 + rng() * 0.2);
    for (let k = 0; k < 8; k += 1) {
      const half = (thick * (1 - k * 0.1)) / 2;
      const grad = ctx.createLinearGradient(0, base - thick, 0, base + thick);
      const a = 0.09 * intensity;
      grad.addColorStop(0, rgba(color, 0));
      grad.addColorStop(0.45, rgba(color, a));
      grad.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let x = 0; x <= w; x += w / 60) ctx.lineTo(x, base + Math.sin(x * freq + phase) * amp - half);
      for (let x = w; x >= 0; x -= w / 60) ctx.lineTo(x, base + Math.sin(x * freq + phase + 0.6) * amp * 1.2 + half);
      ctx.closePath();
      ctx.fill();
    }
  });
  glow(ctx, w / 2, h * 1.1, w * 0.6, accent, 0.3 * intensity, 0.4);
}

function waves(ctx, { w, h, u, rng, accent, bg, intensity }) {
  const light = mix(accent, '#ffffff', 0.3);
  ctx.globalCompositeOperation = lightBlend(bg);
  glow(ctx, w * (0.3 + rng() * 0.4), h * 0.7, Math.max(w, h) * 0.5, accent, 0.35 * intensity);
  const lines = 28;
  const amp = h * (0.07 + rng() * 0.08);
  const freq = (0.8 + rng() * 1.4) * (TAU / w);
  const phase = rng() * TAU;
  const baseY = h * (0.55 + rng() * 0.25);
  ctx.lineWidth = Math.max(1, u * 1.3);
  for (let i = 0; i < lines; i += 1) {
    const t = i / (lines - 1);
    const y0 = baseY + (t - 0.5) * h * 0.4;
    ctx.strokeStyle = rgba(light, (0.04 + 0.28 * Math.sin(t * Math.PI)) * intensity);
    ctx.beginPath();
    for (let x = 0; x <= w; x += w / 140) {
      ctx.lineTo(x, y0 + Math.sin(x * freq + phase + t * 1.8) * amp * (0.5 + t));
    }
    ctx.stroke();
  }
}

function rings(ctx, { w, h, u, rng, accent, text, bg, intensity }) {
  const cx = w * (0.2 + rng() * 0.6);
  const cy = h * (rng() < 0.5 ? -0.05 : 1.05);
  ctx.globalCompositeOperation = lightBlend(bg);
  glow(ctx, cx, cy, Math.max(w, h) * 0.55, accent, 0.55 * intensity);
  ctx.globalCompositeOperation = 'source-over';
  const step = Math.min(w, h) * (0.07 + rng() * 0.04);
  const maxR = Math.hypot(w, h);
  ctx.lineWidth = Math.max(1, u);
  for (let r = step; r < maxR; r += step) {
    ctx.strokeStyle = rgba(text, 0.14 * (1 - r / maxR) * Math.min(1, intensity + 0.2));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  }
}

function dots(ctx, { w, h, rng, accent, bg, intensity }) {
  const fx = w * (0.2 + rng() * 0.6);
  const fy = h * (0.2 + rng() * 0.6);
  ctx.globalCompositeOperation = lightBlend(bg);
  glow(ctx, fx, fy, Math.max(w, h) * 0.45, accent, 0.4 * intensity);
  ctx.globalCompositeOperation = 'source-over';
  const step = Math.round(Math.min(w, h) / 38);
  const maxD = Math.hypot(w, h) * 0.55;
  ctx.fillStyle = rgba(mix(accent, '#ffffff', 0.25), Math.min(1, 0.55 * intensity + 0.1));
  ctx.beginPath();
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      const d = Math.hypot(x - fx, y - fy) / maxD;
      const r = step * 0.42 * Math.max(0, 1 - d) ** 1.6;
      if (r > 0.4) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
    }
  }
  ctx.fill();
}

export const EFFECTS = { aura, spotlight, rays, eclipse, blobs, aurora, waves, rings, dots, grid, mesh, plain };

export function vignette(ctx, w, h, amount, dark) {
  if (amount <= 0) return;
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${(amount * (dark ? 0.75 : 0.28)).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

let grainTile = null;

function getGrainTile() {
  if (grainTile) return grainTile;
  const tile = makeCanvas(GRAIN_TILE, GRAIN_TILE);
  const g = tile.getContext('2d');
  const img = g.createImageData(GRAIN_TILE, GRAIN_TILE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() < 0.5 ? 0 : 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * GRAIN_MAX_ALPHA;
  }
  g.putImageData(img, 0, 0);
  grainTile = tile;
  return tile;
}

/** Film grain: black & white specks, visible on both dark and light grounds. */
export function applyGrain(ctx, w, h, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, amount);
  ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
