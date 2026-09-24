import { h } from './dom.js';
import { docSize } from '../app/model.js';

const SNAP_PX = 7; // in display pixels
const HIT_PAD_PX = 6;
const STAGE_PAD = 48;
const MIN_SCALE_DIST = 4;

/**
 * Direct manipulation on the preview: click to select, drag to move (with centre snapping),
 * right handle to change text/image width, corner handle to scale. Selection chrome lives in a
 * DOM overlay so it never ends up in exported images.
 */
export function createEditor({ store, area, wrap, canvas, onEditText }) {
  const overlay = h('div', { class: 'overlay' });
  wrap.append(overlay);
  let boxes = new Map();
  let gesture = null;
  let hoverId = null;
  let gestureCount = 0;
  let guides = {};

  /* ---------- geometry ---------- */

  function fit() {
    const { width, height } = docSize(store.get().doc);
    const pad = area.clientWidth < 700 ? 16 : STAGE_PAD;
    const availW = Math.max(50, area.clientWidth - pad * 2);
    const availH = Math.max(50, area.clientHeight - pad * 2);
    const scale = Math.min(availW / width, availH / height);
    wrap.style.width = `${Math.floor(width * scale)}px`;
    wrap.style.height = `${Math.floor(height * scale)}px`;
  }
  new ResizeObserver(fit).observe(area);

  const displayScale = () => wrap.clientWidth / canvas.width;

  function toCanvas(e) {
    const rect = wrap.getBoundingClientRect();
    const k = displayScale();
    return { x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k };
  }

  function hitTest(pt) {
    const pad = HIT_PAD_PX / displayScale();
    const layers = store.get().doc.layers;
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const layer = layers[i];
      const box = boxes.get(layer.id);
      if (!layer.visible || layer.locked || !box) continue;
      if (pt.x >= box.x - pad && pt.x <= box.x + box.w + pad && pt.y >= box.y - pad && pt.y <= box.y + box.h + pad) return layer;
    }
    return null;
  }

  /* ---------- overlay ---------- */

  function place(el, box, k) {
    el.style.transform = `translate(${box.x * k}px, ${box.y * k}px)`;
    el.style.width = `${box.w * k}px`;
    el.style.height = `${box.h * k}px`;
  }

  function drawOverlay() {
    const { selection, doc } = store.get();
    const k = displayScale();
    overlay.replaceChildren();
    if (hoverId && hoverId !== selection && boxes.get(hoverId)) {
      const hover = h('div', { class: 'hover-box' });
      place(hover, boxes.get(hoverId), k);
      overlay.append(hover);
    }
    const layer = doc.layers.find((l) => l.id === selection);
    const box = boxes.get(selection);
    if (layer && box) {
      const sel = h('div', { class: `sel-box${layer.locked ? ' is-locked' : ''}` });
      place(sel, box, k);
      if (!layer.locked) {
        if (layer.type !== 'profile') sel.append(h('span', { class: 'handle handle-e', dataset: { handle: 'e' }, title: 'Drag to change width' }));
        sel.append(h('span', { class: 'handle handle-se', dataset: { handle: 'se' }, title: 'Drag to resize' }));
      }
      overlay.append(sel);
    }
    if (guides.x) overlay.append(h('div', { class: 'guide guide-v', style: { transform: `translateX(${guides.x * k}px)` } }));
    if (guides.y) overlay.append(h('div', { class: 'guide guide-h', style: { transform: `translateY(${guides.y * k}px)` } }));
  }

  /* ---------- gestures ---------- */

  function snap(value, targets, size) {
    const threshold = SNAP_PX / displayScale() / size;
    const hit = targets.find((t) => Math.abs(value - t) < threshold);
    return hit === undefined ? { value, guide: null } : { value: hit, guide: hit * size };
  }

  function startGesture(e, layer, handle) {
    const pt = toCanvas(e);
    const box = boxes.get(layer.id);
    const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    gesture = {
      key: `gesture-${(gestureCount += 1)}`,
      id: layer.id,
      handle,
      start: pt,
      layer,
      box,
      startDist: Math.max(MIN_SCALE_DIST, Math.hypot(pt.x - center.x, pt.y - center.y)),
      center,
    };
    overlay.setPointerCapture(e.pointerId);
  }

  function moveGesture(e) {
    const pt = toCanvas(e);
    const { W, H } = { W: canvas.width, H: canvas.height };
    const { layer, start, key } = gesture;
    const dx = pt.x - start.x;
    const dy = pt.y - start.y;

    if (!gesture.handle) {
      const others = store.get().doc.layers.filter((l) => l.id !== layer.id && l.visible);
      const sx = snap(layer.cx + dx / W, [0.5, ...others.map((l) => l.cx)], W);
      const sy = snap(layer.cy + dy / H, [0.5, ...others.map((l) => l.cy)], H);
      store.updateLayer(layer.id, { cx: sx.value, cy: sy.value }, { key });
      return { x: sx.guide, y: sy.guide };
    }
    if (gesture.handle === 'e') {
      const width = Math.max(0.04, Math.min(2, (gesture.box.w + dx * 2) / W));
      store.updateLayer(layer.id, { width }, { key });
      return {};
    }
    const factor = Math.hypot(pt.x - gesture.center.x, pt.y - gesture.center.y) / gesture.startDist;
    const patch =
      layer.type === 'text'
        ? { size: Math.max(4, Math.round(layer.size * factor * 10) / 10) }
        : layer.type === 'profile'
          ? { scale: Math.max(0.2, Math.min(6, layer.scale * factor)) }
          : layer.type === 'element'
            ? { width: Math.max(0.03, Math.min(2, layer.width * factor)), height: Math.max(0.01, Math.min(1.5, layer.height * factor)) }
          : { width: Math.max(0.03, Math.min(2, layer.width * factor)) };
    store.updateLayer(layer.id, patch, { key });
    return {};
  }

  overlay.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const { doc, selection } = store.get();
    const handle = e.target.dataset?.handle;
    if (handle) {
      const layer = doc.layers.find((l) => l.id === selection);
      if (layer) startGesture(e, layer, handle);
      return;
    }
    const layer = hitTest(toCanvas(e));
    store.select(layer?.id ?? null);
    if (layer) startGesture(e, layer, null);
  });

  overlay.addEventListener('pointermove', (e) => {
    if (gesture) {
      guides = moveGesture(e);
      return;
    }
    const layer = hitTest(toCanvas(e));
    overlay.style.cursor = layer ? 'move' : 'default';
    if ((layer?.id ?? null) !== hoverId) {
      hoverId = layer?.id ?? null;
      drawOverlay();
    }
  });

  const endGesture = () => {
    if (!gesture) return;
    gesture = null;
    guides = {};
    drawOverlay();
  };
  overlay.addEventListener('pointerup', endGesture);
  overlay.addEventListener('pointercancel', endGesture);
  overlay.addEventListener('pointerleave', () => {
    if (gesture || !hoverId) return;
    hoverId = null;
    drawOverlay();
  });
  overlay.addEventListener('dblclick', (e) => {
    const layer = hitTest(toCanvas(e));
    if (layer?.type === 'text') onEditText(layer.id);
  });

  return {
    fit,
    /** Called after every render with fresh layer boxes. */
    update(nextBoxes) {
      boxes = nextBoxes;
      drawOverlay();
    },
  };
}
