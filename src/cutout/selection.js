// Pure mask maths for the cut-out editor (no DOM) — unit tested.

export const SELECTION_SIZES = [
  { id: 'auto', label: 'Best' },
  { id: 'small', label: 'S' },
  { id: 'medium', label: 'M' },
  { id: 'large', label: 'L' },
];

function maskArea(masks, index, size) {
  let area = 0;
  const start = index * size;
  for (let i = start; i < start + size; i += 1) if (masks[i]) area += 1;
  return area;
}

/**
 * Picks one of the model's candidate masks for a click.
 * 'auto' → highest predicted quality; small/medium/large → by covered area.
 * Returns a view (no copy) into the packed masks.
 */
export function chooseMask(candidates, sizeId = 'auto') {
  const { masks, count, width, height, scores } = candidates;
  const size = width * height;
  let index = 0;
  if (sizeId === 'auto') {
    index = scores.reduce((best, s, i) => (s > scores[best] ? i : best), 0);
  } else {
    const byArea = Array.from({ length: count }, (_, i) => ({ i, area: candidates.areas?.[i] ?? maskArea(masks, i, size) })).sort((a, b) => a.area - b.area);
    const pick = { small: 0, medium: Math.floor((count - 1) / 2), large: count - 1 }[sizeId] ?? 0;
    index = byArea[pick].i;
  }
  return masks.subarray(index * size, (index + 1) * size);
}

/** Pre-computes areas so switching S/M/L is instant. Returns a new object. */
export function withAreas(candidates) {
  const size = candidates.width * candidates.height;
  return { ...candidates, areas: Array.from({ length: candidates.count }, (_, i) => maskArea(candidates.masks, i, size)) };
}

/**
 * Grows a binary mask by `radius` px (separable max filter). Used so a removed object also takes
 * its soft fringe with it instead of leaving a faint outline. Returns a new array.
 */
export function dilate(mask, width, height, radius) {
  if (radius < 1) return Uint8ClampedArray.from(mask);
  const r = Math.round(radius);
  const horizontal = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let last = -Infinity;
    for (let x = 0; x < width; x += 1) {
      if (mask[row + x]) last = x;
      if (x - last <= r) horizontal[row + x] = 255;
    }
    last = Infinity;
    for (let x = width - 1; x >= 0; x -= 1) {
      if (mask[row + x]) last = x;
      if (last - x <= r) horizontal[row + x] = 255;
    }
  }
  const out = new Uint8ClampedArray(mask.length);
  for (let x = 0; x < width; x += 1) {
    let last = -Infinity;
    for (let y = 0; y < height; y += 1) {
      if (horizontal[y * width + x]) last = y;
      if (y - last <= r) out[y * width + x] = 255;
    }
    last = Infinity;
    for (let y = height - 1; y >= 0; y -= 1) {
      if (horizontal[y * width + x]) last = y;
      if (last - y <= r) out[y * width + x] = 255;
    }
  }
  return out;
}

/** Fringe size relative to the image — about 0.5% of the long edge. */
export const fringeRadius = (width, height) => Math.max(2, Math.round(Math.max(width, height) / 200));

/**
 * Final alpha = (base ∪ keep masks) − (slightly grown) remove masks.
 * `clicks` = [{ keep: boolean, candidates }]; later clicks win, so a keep after a remove re-adds.
 */
export function combineMask({ base, width, height, clicks, sizeId }) {
  const size = width * height;
  const alpha = base ? Uint8ClampedArray.from(base) : new Uint8ClampedArray(size);
  clicks.forEach(({ keep, candidates }) => {
    const mask = chooseMask(candidates, sizeId);
    if (keep) {
      for (let i = 0; i < size; i += 1) if (mask[i] > alpha[i]) alpha[i] = mask[i];
    } else {
      const grown = dilate(mask, width, height, fringeRadius(width, height));
      for (let i = 0; i < size; i += 1) if (grown[i]) alpha[i] = 0;
    }
  });
  return alpha;
}

/** Where to place the cut-out so the object stays exactly where it was on the canvas. */
export function cutoutPlacement(layer, crop, canvas) {
  const layerW = layer.width * canvas.width;
  const layerH = layerW * (crop.sourceHeight / crop.sourceWidth);
  const offsetX = ((crop.box.x + crop.box.w / 2) / crop.sourceWidth - 0.5) * layerW;
  const offsetY = ((crop.box.y + crop.box.h / 2) / crop.sourceHeight - 0.5) * layerH;
  return {
    cx: layer.cx + offsetX / canvas.width,
    cy: layer.cy + offsetY / canvas.height,
    width: layer.width * (crop.box.w / crop.sourceWidth),
  };
}
