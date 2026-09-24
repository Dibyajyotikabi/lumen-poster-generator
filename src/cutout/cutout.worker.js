// Background-removal worker. Runs the ML models off the main thread so the editor stays smooth.
//   auto   → U²-Net (Apache-2.0)        : one-click salient-subject matte
//   object → SlimSAM-77 (Apache-2.0)    : masks for a clicked point (small / medium / large)
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm';
const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort.webgpu.bundle.min.mjs';
const AUTO_MODEL_URL = 'https://huggingface.co/BritishWerewolf/U-2-Net/resolve/main/onnx/model.onnx';
const SAM_MODEL = 'Xenova/slimsam-77-uniform';
const AUTO_SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const MODEL_CACHE = 'lumen-models';

let lib = null;
let ort = null;
let device = null;
let cpuOnly = false; // set by the client after a GPU failure; a fresh worker then never touches WebGPU
let autoSession = null;
let sam = null;
let samImage = null; // { key, inputs, embeddings, width, height }

const post = (msg, transfer = []) => self.postMessage(msg, transfer);
const isGpuError = (err) => /webgpu|storage buffer|shader|GPU/i.test(err?.message ?? '');

async function pickDevice() {
  if (device) return device;
  if (cpuOnly) return (device = 'wasm');
  try {
    device = (await self.navigator?.gpu?.requestAdapter()) ? 'webgpu' : 'wasm';
  } catch {
    device = 'wasm';
  }
  return device;
}

/** Streams a model file with progress, keeping a copy in Cache Storage for instant reuse. */
async function fetchModel(url, id, label) {
  const cache = await caches.open(MODEL_CACHE).catch(() => null);
  const hit = await cache?.match(url);
  if (hit) return new Uint8Array(await hit.arrayBuffer());
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Model download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    post({ id, type: 'progress', label, loaded, total });
  }
  const bytes = new Uint8Array(loaded);
  chunks.reduce((offset, chunk) => (bytes.set(chunk, offset), offset + chunk.length), 0);
  await cache?.put(url, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
  return bytes;
}

/* ---------- auto (U²-Net) ---------- */

async function getAutoSession(id) {
  if (autoSession) return autoSession;
  ort ??= await import(ORT_URL);
  const bytes = await fetchModel(AUTO_MODEL_URL, id, 'Downloading background model (one-time, ~176 MB)');
  post({ id, type: 'status', label: 'Starting model…' });
  const providers = (await pickDevice()) === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];
  autoSession = await ort.InferenceSession.create(bytes, { executionProviders: providers });
  return autoSession;
}

function autoInput(bitmap) {
  const scale = AUTO_SIZE / Math.max(bitmap.width, bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(AUTO_SIZE, AUTO_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, AUTO_SIZE, AUTO_SIZE).data;
  const plane = AUTO_SIZE * AUTO_SIZE;
  const data = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    for (let k = 0; k < 3; k += 1) data[k * plane + i] = (px[i * 4 + k] / 255 - MEAN[k]) / STD[k];
  }
  return { data, w, h };
}

/** Normalised low-res matte → full-size alpha, with a gentle contrast curve to remove haze. */
function upscaleMatte(values, w, h, width, height) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const small = new OffscreenCanvas(AUTO_SIZE, AUTO_SIZE);
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(AUTO_SIZE, AUTO_SIZE);
  for (let i = 0; i < values.length; i += 1) {
    const a = (values[i] - min) / range;
    img.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, (a - 0.08) / 0.84)) * 255);
  }
  sctx.putImageData(img, 0, 0);
  const big = new OffscreenCanvas(width, height);
  const bctx = big.getContext('2d', { willReadFrequently: true });
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, w, h, 0, 0, width, height);
  const rgba = bctx.getImageData(0, 0, width, height).data;
  const alpha = new Uint8ClampedArray(width * height);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = rgba[i * 4 + 3];
  return alpha;
}

async function runAuto(id, bitmap) {
  const session = await getAutoSession(id);
  post({ id, type: 'status', label: 'Removing background…' });
  const { data, w, h } = autoInput(bitmap);
  const output = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', data, [1, 3, AUTO_SIZE, AUTO_SIZE]) });
  const matte = output[session.outputNames[0]].data;
  return { width: bitmap.width, height: bitmap.height, alpha: upscaleMatte(matte, w, h, bitmap.width, bitmap.height) };
}

/* ---------- object picker (SlimSAM) ---------- */

async function getSam(id) {
  if (sam) return sam;
  lib ??= await import(TRANSFORMERS_URL);
  lib.env.allowLocalModels = false;
  const dev = await pickDevice();
  const files = new Map();
  const onProgress = (p) => {
    if (p.status !== 'progress' && p.status !== 'done') return;
    files.set(p.file, { loaded: p.loaded ?? p.total ?? 0, total: p.total ?? 0 });
    const sum = [...files.values()].reduce((a, f) => ({ loaded: a.loaded + f.loaded, total: a.total + f.total }), { loaded: 0, total: 0 });
    post({ id, type: 'progress', label: 'Downloading object picker (one-time, ~14 MB)', ...sum });
  };
  const model = await lib.SamModel.from_pretrained(SAM_MODEL, { device: dev, dtype: dev === 'webgpu' ? 'fp32' : 'q8', progress_callback: onProgress });
  const processor = await lib.AutoProcessor.from_pretrained(SAM_MODEL, { progress_callback: onProgress });
  sam = { model, processor };
  return sam;
}

function toRawImage(bitmap) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return new lib.RawImage(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.width, bitmap.height, 4);
}

async function embed(id, key, bitmap) {
  if (samImage?.key === key) return;
  const { model, processor } = await getSam(id);
  post({ id, type: 'status', label: 'Analysing image…' });
  const image = toRawImage(bitmap);
  const inputs = await processor(image);
  const embeddings = await model.get_image_embeddings(inputs);
  samImage = { key, inputs, embeddings, width: image.width, height: image.height };
}

/** All three candidate masks for one clicked point (normalised coords), packed + their scores. */
async function objectMasks({ x, y }) {
  const { model, processor } = sam;
  const { inputs, embeddings, width, height } = samImage;
  const [rh, rw] = inputs.reshaped_input_sizes[0];
  const input_points = new lib.Tensor('float32', [x * rw, y * rh], [1, 1, 1, 2]);
  const input_labels = new lib.Tensor('int64', [1n], [1, 1, 1]);
  const { pred_masks, iou_scores } = await model({ ...embeddings, input_points, input_labels });
  const [masks] = await processor.post_process_masks(pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
  const count = iou_scores.data.length;
  const size = width * height;
  const packed = new Uint8ClampedArray(size * count);
  const source = masks.data; // [1, count, H, W] booleans
  for (let i = 0; i < packed.length; i += 1) packed[i] = source[i] ? 255 : 0;
  return { width, height, count, masks: packed, scores: Array.from(iou_scores.data) };
}

/* ---------- messaging ---------- */

const TASKS = {
  auto: (data) => runAuto(data.id, data.bitmap),
  embed: async (data) => {
    await embed(data.id, data.key, data.bitmap);
    return { ready: true };
  },
  object: (data) => {
    if (samImage?.key !== data.key) throw new Error('Image is not prepared yet');
    return objectMasks(data.point);
  },
};

self.onmessage = async ({ data }) => {
  if (data.cpuOnly) cpuOnly = true;
  try {
    const task = TASKS[data.type];
    if (!task) throw new Error(`Unknown task ${data.type}`);
    const result = await task(data);
    const buffer = result.alpha?.buffer ?? result.masks?.buffer;
    post({ id: data.id, type: 'done', result, device }, buffer ? [buffer] : []);
  } catch (err) {
    post({ id: data.id, type: 'error', message: err?.message ?? String(err), gpu: isGpuError(err) });
  }
};
