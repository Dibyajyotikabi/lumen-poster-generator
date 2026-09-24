import { BASE_UNIT, docSize } from '../app/model.js';
import { createBackgroundCache, paintBackground } from './background.js';
import { makeCanvas } from './effects.js';
import { layoutText, drawText, roundRectPath } from './text.js';
import { drawProfileLayer } from './profile.js';
import { drawLinkLayer } from './link/index.js';
import { rgba } from '../core/color.js';

const PLACEHOLDER_ASPECT = 0.62;

/** Give auto-fit text the vertical lane between nearby, horizontally overlapping layers. */
export function textFitBounds(layer, layers, H) {
  let top = H * 0.07;
  let bottom = H * 0.93;
  const halfWidth = (item) => item.type === 'profile'
    ? 0.14 * (item.scale ?? 1)
    : (item.width ?? 0.3) / 2;
  const left = layer.cx - halfWidth(layer);
  const right = layer.cx + halfWidth(layer);
  for (const other of layers) {
    if (other.id === layer.id || !other.visible || !Number.isFinite(other.cy)) continue;
    if (Math.min(right, other.cx + halfWidth(other)) <= Math.max(left, other.cx - halfWidth(other))) continue;
    const boundary = (layer.cy + other.cy) * H / 2;
    if (other.cy < layer.cy) top = Math.max(top, boundary);
    if (other.cy > layer.cy) bottom = Math.min(bottom, boundary);
  }
  if (bottom > top) return { top, bottom };
  const center = Math.max(H * 0.1, Math.min(H * 0.9, layer.cy * H));
  return { top: center - H * 0.03, bottom: center + H * 0.03 };
}

function drawImageLayer(ctx, layer, img, { W, H, u, theme }) {
  const w = layer.width * W;
  const h = img ? w * (img.height / img.width) : w * PLACEHOLDER_ASPECT;
  const box = { x: layer.cx * W - w / 2, y: layer.cy * H - h / 2, w, h };
  const radius = layer.radius * Math.min(w, h);
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  if (!img) {
    roundRectPath(ctx, box.x, box.y, w, h, radius);
    ctx.setLineDash([8 * u, 6 * u]);
    ctx.strokeStyle = rgba(theme.text, 0.4);
    ctx.lineWidth = Math.max(1, u * 1.5);
    ctx.stroke();
    ctx.restore();
    return box;
  }
  if (layer.cutout) {
    // Transparent cut-out: the shadow follows the object's outline, no rounded clip.
    if (layer.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 40 * u;
      ctx.shadowOffsetY = 16 * u;
    }
    ctx.drawImage(img, box.x, box.y, w, h);
    ctx.restore();
    return box;
  }
  if (layer.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 44 * u;
    ctx.shadowOffsetY = 18 * u;
    roundRectPath(ctx, box.x, box.y, w, h, radius);
    ctx.fillStyle = theme.bg;
    ctx.fill();
    ctx.restore();
  }
  roundRectPath(ctx, box.x, box.y, w, h, radius);
  ctx.clip();
  ctx.drawImage(img, box.x, box.y, w, h);
  ctx.restore();
  return box;
}

/**
 * Creates a render function bound to an image cache. The live preview reuses a cached background;
 * exports paint everything fresh at the requested scale.
 */
export function createRenderer(images) {
  const backgroundFor = createBackgroundCache();

  return function render(canvas, state, { scale = 1, live = true } = {}) {
    const { doc, profiles, preview } = state;
    const size = docSize(doc);
    const W = Math.round(size.width * scale);
    const H = Math.round(size.height * scale);
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const background = live ? backgroundFor(doc, images, W, H) : paintBackground(makeCanvas(W, H), doc, images, W, H);
    ctx.drawImage(background, 0, 0);

    const env = { W, H, u: Math.min(W, H) / BASE_UNIT, theme: doc.theme, intensity: doc.background.intensity };
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const boxes = new Map();

    doc.layers.forEach((base) => {
      if (!base.visible) return;
      const layer = preview?.layerId === base.id ? { ...base, ...preview.patch } : base;
      ctx.save();
      if (layer.type === 'text') {
        const L = layoutText(ctx, layer, W, H, env.u, layer.autoFit ? textFitBounds(layer, doc.layers, H) : null);
        drawText(ctx, layer, L, doc.theme, env.u);
        boxes.set(layer.id, L.box);
      } else if (layer.type === 'profile') {
        const profile = profileById.get(layer.profileId);
        const img = profile?.photoAssetId ? images.get(`asset:${profile.photoAssetId}`) : null;
        boxes.set(layer.id, drawProfileLayer(ctx, layer, profile, img, env));
      } else if (layer.type === 'link') {
        const get = (id) => (id ? images.get(`asset:${id}`) : null);
        const assets = { image: get(layer.imageAssetId), icon: get(layer.iconAssetId), avatar: get(layer.avatarAssetId), media: (layer.mediaAssetIds ?? []).map(get) };
        boxes.set(layer.id, drawLinkLayer(ctx, layer, assets, env));
      } else if (layer.type === 'image') {
        boxes.set(layer.id, drawImageLayer(ctx, layer, images.get(`asset:${layer.assetId}`), env));
      }
      ctx.restore();
    });
    return boxes;
  };
}
