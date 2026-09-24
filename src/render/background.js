import { EFFECTS, vignette, applyGrain, makeCanvas, softBlur } from './effects.js';
import { createRng } from '../core/random.js';
import { isDark, rgba } from '../core/color.js';
import { BASE_UNIT } from '../app/model.js';

const BLUR_SCALE = 0.06;

export function imageKeyFor(background) {
  if (background.source === 'wallpaper') return 'wallpaper';
  if (background.source === 'library' && background.libraryId) return `library:${background.libraryId}`;
  if (background.source === 'upload' && background.assetId) return `asset:${background.assetId}`;
  return null;
}

function drawCover(ctx, img, w, h, zoom = 1) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  ctx.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
}

function runEffect(ctx, style, env) {
  ctx.save();
  (EFFECTS[style] ?? EFFECTS.plain)(ctx, env);
  ctx.restore();
}

/** Paints theme + generated light or image background + vignette + grain into `canvas`. */
export function paintBackground(canvas, doc, images, w, h) {
  const { theme, background: b } = doc;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);

  const env = {
    w,
    h,
    u: Math.min(w, h) / BASE_UNIT,
    rng: createRng(b.seed),
    bg: theme.bg,
    text: theme.text,
    accent: theme.accent,
    intensity: b.intensity,
  };
  const key = imageKeyFor(b);
  const img = key ? images.get(key) : null;

  if (img) {
    const layer = makeCanvas(w, h);
    drawCover(layer.getContext('2d'), img, w, h, b.zoom);
    ctx.drawImage(b.blur > 0 ? softBlur(layer, w, h, b.blur * Math.min(w, h) * BLUR_SCALE) : layer, 0, 0);
    if (b.dim > 0) {
      ctx.fillStyle = rgba(theme.bg, b.dim);
      ctx.fillRect(0, 0, w, h);
    }
    if (b.effectOnImage && b.style !== 'plain') runEffect(ctx, b.style, { ...env, intensity: b.intensity * 0.8 });
  } else {
    runEffect(ctx, b.style, env);
  }
  vignette(ctx, w, h, b.vignette, isDark(theme.bg));
  applyGrain(ctx, w, h, b.grain);
  return canvas;
}

/** Memoises the background so dragging/typing only repaints layers. */
export function createBackgroundCache() {
  let lastKey = null;
  let canvas = null;
  return (doc, images, w, h) => {
    const imgKey = imageKeyFor(doc.background);
    const ready = imgKey ? Boolean(images.get(imgKey)) : false;
    const key = JSON.stringify([doc.theme, doc.background, w, h, ready]);
    if (key !== lastKey || !canvas) {
      canvas = canvas ?? makeCanvas(w, h);
      paintBackground(canvas, doc, images, w, h);
      lastKey = key;
    }
    return canvas;
  };
}
