// Main-thread wrapper around the cut-out worker: promise per task, progress via callback.
// If the GPU path fails (some GPUs hit WebGPU limits), the worker is restarted in CPU-only mode and
// that choice is remembered for next time.
const MAX_EDGE = 2048;
const CPU_PREF_KEY = 'lumen:cutout-cpu';

let worker = null;
let seq = 0;
const pending = new Map();

const readCpuPref = () => {
  try {
    return localStorage.getItem(CPU_PREF_KEY) === '1';
  } catch {
    return false;
  }
};
let cpuOnly = readCpuPref();

function rememberCpu() {
  cpuOnly = true;
  try {
    localStorage.setItem(CPU_PREF_KEY, '1');
  } catch {
    // preference is only an optimisation
  }
}

function restartWorker() {
  worker?.terminate();
  worker = null;
  pending.forEach((t) => t.reject(new Error('Worker restarted')));
  pending.clear();
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./cutout.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const task = pending.get(data.id);
    if (!task) return;
    if (data.type === 'progress' || data.type === 'status') return task.onProgress?.(data);
    pending.delete(data.id);
    if (data.type === 'done') task.resolve({ ...data.result, device: data.device });
    else task.reject(Object.assign(new Error(data.message), { gpu: data.gpu }));
  };
  worker.onerror = (e) => {
    const err = new Error(e.message || 'Background removal worker crashed');
    pending.forEach((t) => t.reject(err));
    pending.clear();
    worker = null;
  };
  return worker;
}

function send(type, payload, onProgress, transfer = []) {
  const id = (seq += 1);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, type, cpuOnly, ...payload }, transfer);
  });
}

/** Runs a task; on a GPU failure restarts the worker on the CPU and retries once. */
async function withCpuFallback(run, onProgress) {
  try {
    return await run();
  } catch (err) {
    if (!err.gpu || cpuOnly) throw err;
    console.warn('[lumen] GPU cut-out failed, retrying on CPU:', err.message);
    rememberCpu();
    restartWorker();
    onProgress?.({ type: 'status', label: 'Your GPU can’t run this model — switching to CPU (slower)…' });
    return run();
  }
}

/** Downscaled ImageBitmap (≤ 2048px) — models don't benefit from more and it keeps things fast. */
export async function prepareBitmap(img) {
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.round((img.naturalWidth || img.width) * scale);
  const h = Math.round((img.naturalHeight || img.height) * scale);
  return createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
}

export function autoMask(bitmap, onProgress) {
  return withCpuFallback(async () => {
    const copy = await createImageBitmap(bitmap);
    return send('auto', { bitmap: copy }, onProgress, [copy]);
  }, onProgress);
}

export function prepareObjectPicker(key, bitmap, onProgress) {
  return withCpuFallback(async () => {
    const copy = await createImageBitmap(bitmap);
    return send('embed', { key, bitmap: copy }, onProgress, [copy]);
  }, onProgress);
}

/** Candidate masks (small → large) for one clicked point; point is normalised to the image (0–1). */
export const objectMasks = (key, point) => send('object', { key, point });
