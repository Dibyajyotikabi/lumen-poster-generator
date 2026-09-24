// Link layer entry point: picks the design and makes sure it always fits on the canvas.
import { CARD_LAYOUTS, CARD_NOMINAL } from './cards.js';
import { layoutTweet, TWEET_NOMINAL } from './tweet.js';
import { EXTRA_LAYOUTS, EXTRA_NOMINAL } from './cards-extra.js';

const MAX_HEIGHT = 0.92; // of canvas height
const MAX_WIDTH = 0.94;
const SEARCH_STEPS = 10;
const SHRINK_PASSES = 12;

/**
 * Designs whose height comes from text can reflow: widen first (keeps type readable), shrink
 * only if the widest card still overflows. Image-led designs scale proportionally.
 */
const LAYOUTS = {
  ...Object.fromEntries(Object.entries(CARD_LAYOUTS).map(([id, layout]) => [id, { layout, nominal: CARD_NOMINAL, reflow: id === 'compact' || id === 'minimal' }])),
  tweet: { layout: layoutTweet, nominal: TWEET_NOMINAL, reflow: true },
  browser: { layout: EXTRA_LAYOUTS.browser, nominal: EXTRA_NOMINAL, reflow: false },
  headline: { layout: EXTRA_LAYOUTS.headline, nominal: EXTRA_NOMINAL, reflow: true },
  quote: { layout: EXTRA_LAYOUTS.quote, nominal: EXTRA_NOMINAL, reflow: true },
};

/**
 * Chooses { w, k } so that measure(w, k) ≤ maxHeight. Pure given `measure`.
 * reflow: grow width (binary search for the narrowest width that fits) before shrinking type.
 */
export function fitCard({ width, maxWidth, maxHeight, nominal, reflow, measure }) {
  let w = Math.min(width, maxWidth);
  let k = w / nominal;
  if (measure(w, k) <= maxHeight) return { w, k };
  if (reflow && measure(maxWidth, k) <= maxHeight) {
    let lo = w;
    let hi = maxWidth;
    for (let i = 0; i < SEARCH_STEPS; i += 1) {
      const mid = (lo + hi) / 2;
      if (measure(mid, k) <= maxHeight) hi = mid;
      else lo = mid;
    }
    return { w: hi, k };
  }
  if (reflow) w = maxWidth;
  for (let i = 0; i < SHRINK_PASSES; i += 1) {
    const h = measure(w, k);
    if (h <= maxHeight) break;
    const ratio = (maxHeight / h) * 0.995;
    k *= reflow ? Math.sqrt(ratio) * 0.99 : ratio;
    if (!reflow) w *= ratio;
  }
  return { w, k };
}

export function drawLinkLayer(ctx, layer, assets, env) {
  const spec = LAYOUTS[layer.variant] ?? LAYOUTS.card;
  const measure = (w, k) => spec.layout(ctx, layer, w, assets, env, k).h;
  const { w, k } = fitCard({ width: layer.width * env.W, maxWidth: env.W * MAX_WIDTH, maxHeight: env.H * MAX_HEIGHT, nominal: spec.nominal, reflow: spec.reflow, measure });
  const L = spec.layout(ctx, layer, w, assets, env, k);
  const box = { x: layer.cx * env.W - w / 2, y: layer.cy * env.H - L.h / 2, w, h: L.h };
  ctx.save();
  L.paint(box);
  ctx.restore();
  return box;
}
