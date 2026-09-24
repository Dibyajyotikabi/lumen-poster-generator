const ALPHA_THRESHOLD = 24; // ignore near-invisible fringe when cropping

/**
 * Tight bounding box of pixels whose alpha exceeds `threshold`, padded by `pad` px.
 * Returns null when the mask is empty. Pure — safe to unit test.
 */
export function alphaBounds(alpha, width, height, { threshold = ALPHA_THRESHOLD, pad = 0 } = {}) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (alpha[row + x] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return { x, y, w: Math.min(width, maxX + pad + 1) - x, h: Math.min(height, maxY + pad + 1) - y };
}

/** Share of pixels kept — used to warn when a selection is empty or everything. */
export function coverage(alpha, threshold = 127) {
  let kept = 0;
  for (let i = 0; i < alpha.length; i += 1) if (alpha[i] > threshold) kept += 1;
  return alpha.length ? kept / alpha.length : 0;
}

/** Converts a single-channel alpha array into a canvas (white, alpha = mask) — optionally feathered. */
function maskCanvas({ alpha, width, height }, feather) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < alpha.length; i += 1) {
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = 255;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = alpha[i];
  }
  ctx.putImageData(img, 0, 0);
  if (feather <= 0 || !('filter' in ctx)) return canvas;
  const soft = new OffscreenCanvas(width, height);
  const sctx = soft.getContext('2d');
  sctx.filter = `blur(${feather}px)`;
  sctx.drawImage(canvas, 0, 0);
  return soft;
}

/** Image with the mask applied as transparency, at the mask's resolution. */
export function applyMask(source, mask, { feather = 0 } = {}) {
  const out = new OffscreenCanvas(mask.width, mask.height);
  const ctx = out.getContext('2d');
  ctx.drawImage(source, 0, 0, mask.width, mask.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas(mask, feather), 0, 0);
  return out;
}

/** Final cut-out: masked, cropped to the object (with a little breathing room), as a PNG blob. */
export async function exportCutout(source, mask, { feather = 0, pad = 4 } = {}) {
  const masked = applyMask(source, mask, { feather });
  const ctx = masked.getContext('2d', { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, masked.width, masked.height);
  const alpha = new Uint8ClampedArray(masked.width * masked.height);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = data[i * 4 + 3];
  const box = alphaBounds(alpha, masked.width, masked.height, { pad: pad + Math.ceil(feather) });
  if (!box) throw new Error('Nothing was selected — click on the object you want to keep');
  const crop = new OffscreenCanvas(box.w, box.h);
  crop.getContext('2d').drawImage(masked, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  const blob = await crop.convertToBlob({ type: 'image/png' });
  return { blob, box, sourceWidth: mask.width, sourceHeight: mask.height };
}
