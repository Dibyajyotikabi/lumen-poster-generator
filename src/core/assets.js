// Uploaded images (photos, backgrounds, logos) live in IndexedDB — localStorage is far too small.
const DB_NAME = 'lumen-assets';
const STORE = 'assets';
const MAX_EDGE = 3000;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req?.result);
        t.onerror = () => reject(t.error);
      }),
  );
}

/** Downscale very large images before storing so the app stays fast. */
async function normalizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 4_000_000) {
    bitmap.close();
    return file;
  }
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
  return canvas.convertToBlob({ type: hasAlpha ? 'image/png' : 'image/jpeg', quality: 0.92 });
}

export async function putAsset(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Only image files are supported');
  const blob = await normalizeImage(file);
  const id = `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await tx('readwrite', (store) => store.put(blob, id));
  return id;
}

export const getAsset = (id) => tx('readonly', (store) => store.get(id));
export const deleteAsset = (id) => tx('readwrite', (store) => store.delete(id));
