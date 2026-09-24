import { h, icon, toast } from './dom.js';
import { segmented, slider } from './controls.js';
import { prepareBitmap, autoMask, prepareObjectPicker, objectMasks } from '../cutout/client.js';
import { SELECTION_SIZES, withAreas, combineMask } from '../cutout/selection.js';
import { applyMask, exportCutout, coverage } from '../cutout/compose.js';

const TOOLS = [
  { id: 'keep', label: 'Keep' },
  { id: 'remove', label: 'Remove' },
];
const VIEWS = [
  { id: 'result', label: 'Result' },
  { id: 'overlay', label: 'Overlay' },
];
const DOT_RADIUS = 7;
const MB = 1024 * 1024;

/**
 * Background remover: one-click auto matte, then refine by clicking objects to keep (e.g. the phone)
 * or remove (e.g. the hand holding it, stray text). Everything runs locally in the browser.
 */
export function createCutoutDialog() {
  let session = null; // per opening: { bitmap, key, base, clicks, sizeId, feather, view, tool, alpha, onApply }
  let busy = false;
  let pickerReady = null;

  /* ---------- DOM ---------- */
  const canvas = h('canvas', { class: 'cutout-canvas', 'aria-label': 'Cut-out preview — click to keep or remove objects' });
  const stage = h('div', { class: 'cutout-stage' }, canvas);
  const statusText = h('span', { class: 'cutout-status-text' }, '');
  const bar = h('span', { class: 'cutout-bar' }, h('span', { class: 'cutout-bar-fill' }));
  const status = h('div', { class: 'cutout-status', role: 'status', 'aria-live': 'polite' }, statusText, bar);
  const autoBtn = h('button', { type: 'button', class: 'btn btn-magic btn-wide', onclick: () => runAuto() }, icon('sparkle'), h('span', {}, 'Auto remove background'));
  const tool = segmented({ label: 'Click to', options: TOOLS, value: 'keep', onChange: (v) => update({ tool: v }) });
  const size = segmented({ label: 'Selection size', options: SELECTION_SIZES, value: 'auto', onChange: (v) => update({ sizeId: v }, true), compact: true });
  const feather = slider({ label: 'Edge softness', min: 0, max: 6, step: 0.5, value: 1, format: (v) => `${v}px`, onInput: (v) => update({ feather: v }) });
  const view = segmented({ label: 'Preview', options: VIEWS, value: 'result', onChange: (v) => update({ view: v }), compact: true });
  const clickInfo = h('p', { class: 'hint-line' });
  const undoBtn = h('button', { type: 'button', class: 'btn btn-small', onclick: () => undoClick() }, icon('undo', 14), h('span', {}, 'Undo click'));
  const resetBtn = h('button', { type: 'button', class: 'btn btn-small', onclick: () => resetAll() }, h('span', {}, 'Start over'));
  const applyBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => apply() }, 'Apply cut-out');
  const cancelBtn = h('button', { type: 'button', class: 'btn', onclick: () => dialog.close() }, 'Cancel');

  const dialog = h(
    'dialog',
    { class: 'cutout-dialog', 'aria-label': 'Remove background' },
    h('header', { class: 'font-head' }, h('h2', {}, 'Remove background'), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => dialog.close() }, icon('close', 16))),
    h(
      'div',
      { class: 'cutout-body' },
      stage,
      h(
        'aside',
        { class: 'cutout-side' },
        status,
        h('section', { class: 'group' }, h('h3', { class: 'group-title' }, '1 · One click'), autoBtn, h('p', { class: 'hint-line' }, 'Finds the main subject automatically.')),
        h(
          'section',
          { class: 'group' },
          h('h3', { class: 'group-title' }, '2 · Refine by clicking'),
          tool.el,
          h('p', { class: 'hint-line' }, 'Keep: click the product (e.g. the phone). Remove: click a hand, text or logo to cut it away. Hold ⌥ to flip.'),
          size.el,
          clickInfo,
          h('div', { class: 'cutout-row' }, undoBtn, resetBtn),
        ),
        h('section', { class: 'group' }, feather.el, view.el),
      ),
    ),
    h('footer', { class: 'cutout-foot' }, h('span', { class: 'hint-line' }, 'Runs privately on your Mac — nothing is uploaded.'), h('span', { class: 'cutout-row' }, cancelBtn, applyBtn)),
  );
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    session = null;
  });

  /* ---------- state ---------- */

  function setStatus(label, loaded = 0, total = 0) {
    statusText.textContent = total ? `${label} · ${Math.round(loaded / MB)} / ${Math.round(total / MB)} MB` : label;
    status.dataset.active = label ? 'true' : 'false';
    bar.firstChild.style.transform = `scaleX(${total ? loaded / total : 0})`;
    bar.dataset.indeterminate = String(Boolean(label) && !total);
  }

  const progress = (p) => setStatus(p.label, p.loaded, p.total);

  function update(patch, recombine = false) {
    if (!session) return;
    session = { ...session, ...patch };
    if (recombine) recompute();
    paint();
    syncControls();
  }

  function recompute() {
    const { base, clicks, bitmap, sizeId } = session;
    const alpha = base || clicks.length ? combineMask({ base, width: bitmap.width, height: bitmap.height, clicks, sizeId }) : null;
    session = { ...session, alpha };
  }

  function syncControls() {
    const { clicks, alpha } = session;
    const keeps = clicks.filter((c) => c.keep).length;
    clickInfo.textContent = clicks.length ? `${keeps} kept · ${clicks.length - keeps} removed` : 'No clicks yet.';
    undoBtn.disabled = busy || !clicks.length;
    resetBtn.disabled = busy || (!clicks.length && !session.base);
    applyBtn.disabled = busy || !alpha;
    autoBtn.disabled = busy;
    stage.dataset.tool = session.tool;
  }

  /* ---------- preview ---------- */

  function fitCanvas() {
    const { bitmap } = session;
    const maxW = stage.clientWidth - 32;
    const maxH = stage.clientHeight - 32;
    const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
  }

  function paint() {
    if (!session) return;
    const { bitmap, alpha, view: mode, feather: soft, clicks } = session;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const mask = alpha ? { alpha, width: bitmap.width, height: bitmap.height } : null;
    if (!mask) {
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    } else if (mode === 'result') {
      ctx.drawImage(applyMask(bitmap, mask, { feather: soft }), 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const cut = applyMask(bitmap, mask, { feather: soft });
      ctx.fillStyle = 'rgba(12, 12, 20, 0.62)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(cut, 0, 0, canvas.width, canvas.height);
    }
    stage.dataset.checker = String(Boolean(mask) && mode === 'result');
    clicks.forEach((c) => {
      ctx.beginPath();
      ctx.arc(c.x * canvas.width, c.y * canvas.height, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = c.keep ? '#22c55e' : '#ef4444';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });
  }

  /* ---------- actions ---------- */

  async function guard(task) {
    if (busy) return;
    busy = true;
    syncControls();
    try {
      await task();
    } catch (err) {
      console.warn('[lumen] cut-out failed', err);
      toast(err.message?.includes('fetch') ? 'Could not download the model — check your connection' : `Background removal failed: ${err.message}`);
    } finally {
      busy = false;
      setStatus('');
      if (session) syncControls();
    }
  }

  function runAuto() {
    return guard(async () => {
      const s = session;
      const result = await autoMask(s.bitmap, progress);
      if (session !== s && session?.key !== s.key) return;
      session = { ...session, base: result.alpha };
      recompute();
      if (coverage(session.alpha) < 0.005) toast('No clear subject found — click the object you want instead');
      paint();
    });
  }

  function ensurePicker() {
    const { key, bitmap } = session;
    if (!pickerReady || pickerReady.key !== key) {
      const promise = prepareObjectPicker(key, bitmap, (p) => !busy && progress(p)).then(() => setStatus(''));
      pickerReady = { key, promise };
      promise.catch(() => {
        pickerReady = null;
      });
    }
    return pickerReady.promise;
  }

  function onCanvasClick(e) {
    if (!session || busy) return;
    const rect = canvas.getBoundingClientRect();
    const point = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
    const keep = (session.tool === 'keep') !== e.altKey;
    guard(async () => {
      const s = session;
      setStatus('Selecting…');
      await ensurePicker();
      let candidates;
      try {
        candidates = await objectMasks(s.key, point);
      } catch (err) {
        if (!/not prepared/.test(err.message)) throw err;
        pickerReady = null; // worker restarted (CPU fallback) — prepare again
        await ensurePicker();
        candidates = await objectMasks(s.key, point);
      }
      if (session?.key !== s.key) return;
      session = { ...session, clicks: [...session.clicks, { ...point, keep, candidates: withAreas(candidates) }] };
      recompute();
      paint();
    });
  }
  canvas.addEventListener('click', onCanvasClick);

  function undoClick() {
    update({ clicks: session.clicks.slice(0, -1) }, true);
  }

  function resetAll() {
    update({ clicks: [], base: null }, true);
  }

  function apply() {
    return guard(async () => {
      const { bitmap, alpha, feather: soft, onApply } = session;
      setStatus('Saving cut-out…');
      const result = await exportCutout(bitmap, { alpha, width: bitmap.width, height: bitmap.height }, { feather: soft });
      await onApply(result);
      dialog.close();
    });
  }

  return {
    /** img: HTMLImageElement of the original; onApply({ blob, box, sourceWidth, sourceHeight }) */
    async open({ img, key, onApply }) {
      const bitmap = await prepareBitmap(img);
      session = { bitmap, key, base: null, clicks: [], sizeId: 'auto', feather: 1, view: 'result', tool: 'keep', alpha: null, onApply };
      tool.set('keep');
      size.set('auto');
      feather.set(1);
      view.set('result');
      setStatus('');
      dialog.showModal();
      fitCanvas();
      paint();
      syncControls();
      ensurePicker().catch((err) => console.warn('[lumen] object picker unavailable', err));
    },
  };
}
