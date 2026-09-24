import { getAsset } from '../core/assets.js';

/**
 * Image cache keyed by source string:
 *   asset:<id>      → IndexedDB upload
 *   wallpaper       → current macOS wallpaper (via local server)
 *   library:<id>    → macOS wallpaper library image
 * `get` never blocks: it returns the image when ready, otherwise null and loads in the background.
 */
export function createImageCache(onReady) {
  const ready = new Map();
  const pending = new Map();
  const failed = new Set();

  async function resolveUrl(key) {
    if (key === 'wallpaper') return `/api/wallpapers/current.jpg?t=${Date.now()}`;
    if (key.startsWith('library:')) return `/api/wallpapers/library/${encodeURIComponent(key.slice(8))}.jpg`;
    if (key.startsWith('asset:')) {
      const blob = await getAsset(key.slice(6));
      if (!blob) throw new Error(`Missing asset ${key}`);
      return URL.createObjectURL(blob);
    }
    throw new Error(`Unknown image key ${key}`);
  }

  function load(key) {
    const promise = resolveUrl(key)
      .then(
        (url) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Could not load ${key}`));
            img.src = url;
          }),
      )
      .then((img) => {
        ready.set(key, img);
        onReady(key);
        return img;
      })
      .catch((err) => {
        failed.add(key);
        console.warn('[lumen]', err.message);
        onReady(key, err);
        return null;
      })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }

  return {
    get(key) {
      if (!key) return null;
      if (ready.has(key)) return ready.get(key);
      if (!pending.has(key) && !failed.has(key)) load(key);
      return null;
    },
    /** Resolves once loaded (or null on failure). */
    whenReady(key) {
      if (ready.has(key)) return Promise.resolve(ready.get(key));
      return pending.get(key) ?? load(key);
    },
    isFailed: (key) => failed.has(key),
    forget(key) {
      ready.delete(key);
      failed.delete(key);
    },
  };
}
