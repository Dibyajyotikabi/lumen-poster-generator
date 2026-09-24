import { createStore } from './store.js';
import { createActions } from './actions.js';
import { SIZES, docSize } from './model.js';
import { createRenderer } from '../render/renderer.js';
import { createImageCache } from '../render/images.js';
import { loadCatalog } from '../fonts/catalog.js';
import { onFontLoaded } from '../fonts/loader.js';
import { createEditor } from '../ui/editor.js';
import { mountRail } from '../ui/layers-panel.js';
import { mountInspector } from '../ui/inspector.js';
import { createFontPicker } from '../ui/font-picker.js';
import { createProfilesDialog } from '../ui/profiles-dialog.js';
import { createCutoutDialog } from '../ui/cutout-dialog.js';
import { $, toast } from '../ui/dom.js';
import { asLink } from './link.js';

const NUDGE = 1;
const NUDGE_FAST = 10;

const store = createStore();
const canvas = $('#canvas');
let frame = 0;

const scheduleRender = () => {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    draw();
  });
};

const images = createImageCache((key, err) => {
  if (err && key === 'wallpaper') toast('Could not read the current wallpaper — try the macOS library instead');
  scheduleRender();
});
const render = createRenderer(images);
const actions = createActions({ store, images, render, cutout: createCutoutDialog() });

const editor = createEditor({
  store,
  area: $('#stageArea'),
  wrap: $('#canvasWrap'),
  canvas,
  onEditText: (id) => inspector.focusText(id),
});

const fontPicker = createFontPicker({ store });
const people = createProfilesDialog({ store, images });
const deps = { store, actions, images, openFontPicker: (id) => fontPicker.open(id), openProfiles: (id) => people.open(id), focusLink: () => inspector.focusLink() };

mountRail($('#rail'), deps);
const inspector = mountInspector($('#inspector'), deps);

/* ---------- render loop ---------- */

function draw() {
  const state = store.get();
  const boxes = render(canvas, state);
  editor.update(boxes);
  syncTopbar(state);
}

let lastSizeKey = null;
store.subscribe((state) => {
  const { width, height } = docSize(state.doc);
  const sizeKey = `${width}x${height}`;
  if (sizeKey !== lastSizeKey) {
    lastSizeKey = sizeKey;
    canvas.width = width;
    canvas.height = height;
    editor.fit();
  }
  scheduleRender();
});
onFontLoaded(scheduleRender);
loadCatalog().then(scheduleRender);

/* ---------- top bar ---------- */

const sizeSelect = $('#sizeSelect');
const customW = $('#customW');
const customH = $('#customH');
Object.entries(SIZES).forEach(([id, s]) => sizeSelect.append(new Option(id === 'custom' ? s.label : `${s.label} · ${s.width}×${s.height}`, id)));
sizeSelect.addEventListener('change', () => store.updateDoc({ size: sizeSelect.value }));

const clampDim = (v) => Math.min(4096, Math.max(64, Math.round(Number(v) || 0)));
[customW, customH].forEach((input) =>
  input.addEventListener('change', () => {
    store.updateDoc({ size: 'custom', custom: { width: clampDim(customW.value), height: clampDim(customH.value) } });
  }),
);

function syncTopbar(state) {
  const size = docSize(state.doc);
  sizeSelect.value = state.doc.size;
  if (document.activeElement !== customW) customW.value = size.width;
  if (document.activeElement !== customH) customH.value = size.height;
  $('#undo').disabled = !store.canUndo();
  $('#redo').disabled = !store.canRedo();
  $('#meta').textContent = `${size.width} × ${size.height} · ${state.doc.layers.length} layer${state.doc.layers.length === 1 ? '' : 's'}`;
}

$('#undo').addEventListener('click', () => store.undo());
$('#redo').addEventListener('click', () => store.redo());
$('#autoStyle').addEventListener('click', () => actions.autoStyle());
$('#copy').addEventListener('click', () => actions.copyImage());
$('#download').addEventListener('click', () => actions.exportImage($('#format').value, Number($('#scale').value)));

/* ---------- keyboard ---------- */

const isTyping = (target) => Boolean(target.closest?.('input, textarea, select, [contenteditable], dialog[open]'));

function nudge(dx, dy) {
  const { selection, doc } = store.get();
  const layer = doc.layers.find((l) => l.id === selection);
  if (!layer || layer.locked) return;
  const { width, height } = docSize(doc);
  store.updateLayer(layer.id, { cx: layer.cx + dx / width, cy: layer.cy + dy / height }, { key: `nudge:${layer.id}` });
}

document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (mod && key === 'z' && !isTyping(e.target)) {
    e.preventDefault();
    return e.shiftKey ? store.redo() : store.undo();
  }
  if (mod && key === 'y' && !isTyping(e.target)) return (e.preventDefault(), store.redo());
  if (mod && key === 's') return (e.preventDefault(), actions.exportImage($('#format').value, Number($('#scale').value)));
  if (isTyping(e.target)) return;
  const { selection } = store.get();
  if (mod && key === 'd' && selection) return (e.preventDefault(), actions.duplicate());
  if (mod) return;
  const step = e.shiftKey ? NUDGE_FAST : NUDGE;
  const arrows = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] };
  if (arrows[key] && selection) return (e.preventDefault(), nudge(...arrows[key]));
  if ((key === 'backspace' || key === 'delete') && selection) return (e.preventDefault(), actions.remove());
  if (key === 'escape') return store.select(null);
  if (key === 'enter' && selection) return (e.preventDefault(), inspector.focusText(selection));
  if (key === 'g') return actions.regenerate();
  if (key === 't') return actions.addText();
  if (key === 'a') return actions.autoStyle();
});

/* ---------- paste & drop images ---------- */

const imageFrom = (list) => [...(list ?? [])].find((f) => f.type?.startsWith('image/')) ?? null;

document.addEventListener('paste', (e) => {
  if (isTyping(e.target)) return;
  const file = imageFrom(e.clipboardData?.files);
  if (file) {
    e.preventDefault();
    actions.setBackgroundFile(file);
    toast('Pasted image set as background');
    return;
  }
  const link = asLink(e.clipboardData?.getData('text/plain'));
  if (link) {
    e.preventDefault();
    actions.importLink(link);
  }
});

const veil = $('#dropVeil');
let dragDepth = 0;
document.addEventListener('dragenter', (e) => {
  if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return;
  dragDepth += 1;
  veil.dataset.show = 'true';
});
document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) veil.dataset.show = 'false';
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  veil.dataset.show = 'false';
  const file = imageFrom(e.dataTransfer?.files);
  if (!file) return toast('Drop an image file');
  if (e.altKey) actions.addImageFile(file);
  else actions.setBackgroundFile(file);
});

/* ---------- boot ---------- */

const { width, height } = docSize(store.get().doc);
canvas.width = width;
canvas.height = height;
editor.fit();
draw();
document.fonts.ready.then(scheduleRender);
