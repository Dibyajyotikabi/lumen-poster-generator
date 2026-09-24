import { getFont, nearestWeight } from './catalog.js';

const CDN = 'https://cdn.jsdelivr.net/fontsource/fonts';
const SUBSETS = ['latin', 'latin-ext'];

const state = new Map(); // key → 'loading' | 'ready' | 'failed'
const promises = new Map(); // key → Promise<void>
let notify = () => {};

export const onFontLoaded = (fn) => {
  notify = fn;
};

function faceSpec(font) {
  const meta = getFont(font.id);
  const weight = nearestWeight(meta, font.weight ?? 400);
  const italic = Boolean(font.italic) && (meta?.styles ?? []).includes('italic');
  return { weight, style: italic ? 'italic' : 'normal' };
}

function loadFaces(family, id, weight, style) {
  const faces = SUBSETS.map(
    (subset) =>
      new FontFace(family, `url(${CDN}/${id}@latest/${subset}-${weight}-${style}.woff2) format("woff2")`, {
        weight: String(weight),
        style,
        display: 'swap',
        unicodeRange: subset === 'latin' ? 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' : 'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF',
      }),
  );
  faces.forEach((f) => document.fonts.add(f));
  // latin-ext is optional (not every family ships it) — only latin must succeed.
  return Promise.allSettled(faces.map((f) => f.load())).then((results) => {
    if (results[0].status === 'rejected') throw results[0].reason;
  });
}

/**
 * Ensures a face is available for canvas drawing. Returns the resolved { family, weight, style }
 * that should be used in the canvas font string, and triggers a re-render once loaded.
 */
export function ensureFont(font) {
  const { weight, style } = faceSpec(font);
  const key = `${font.id}:${weight}:${style}`;
  if (!state.has(key)) {
    state.set(key, 'loading');
    const promise = loadFaces(font.family, font.id, weight, style)
      .then(() => {
        state.set(key, 'ready');
        notify(key);
      })
      .catch((err) => {
        state.set(key, 'failed');
        console.warn('[lumen] font failed', key, err?.message ?? err);
      });
    promises.set(key, promise);
  }
  return { family: font.family, weight, style, ready: state.get(key) === 'ready' };
}

/** Loads a preview face under an alias family so partially-loaded previews never leak into canvas text. */
export function ensurePreview(meta) {
  const alias = `pv-${meta.id}`;
  const weight = nearestWeight(meta, 400);
  const key = `preview:${meta.id}`;
  if (!state.has(key)) {
    state.set(key, 'loading');
    const face = new FontFace(alias, `url(${CDN}/${meta.id}@latest/latin-${weight}-normal.woff2) format("woff2")`, { weight: String(weight) });
    document.fonts.add(face);
    face
      .load()
      .then(() => state.set(key, 'ready'))
      .catch(() => state.set(key, 'failed'));
  }
  return alias;
}

export const fontStatus = (font) => {
  const { weight, style } = faceSpec(font);
  return state.get(`${font.id}:${weight}:${style}`) ?? 'idle';
};

/** Resolves when the face is loaded (or has failed) — used before exporting. */
export function fontReady(font) {
  ensureFont(font);
  const { weight, style } = faceSpec(font);
  return promises.get(`${font.id}:${weight}:${style}`) ?? Promise.resolve();
}
