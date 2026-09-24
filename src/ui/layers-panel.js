import { h, icon, pickFile } from './dom.js';
import { TEMPLATES } from '../app/templates.js';
import { DECORATIVE_ELEMENTS, EDITORIAL_ELEMENTS, ELEMENTS, SHAPE_ELEMENTS } from '../app/model.js';
import { STICKERS } from '../app/stickers.js';

const TYPE_ICON = { text: 'text', profile: 'user', image: 'image', link: 'link', element: 'sparkle' };
const ELEMENT_GLYPHS = { bar: '▰', rule: '━•', number: '01', quote: '“”', arrow: '➜', dots: '•••', voxels: '▦', bracket: '⌜⌟', 'paper-scrap': '▧', 'cracked-paper': '◩', 'washi-tape': '▱', scribble: '〰', swirl: '➰', cat: '🐱', bird: '🐦', flower: '✿', sparkles: '✦', heart: '♥', 'post-card': '▢', box: '■', 'box-outline': '□', 'brutal-box': '▣', 'glass-box': '◫', 'pill-shape': '⬭', circle: '●', speech: '💬', 'star-burst': '✸', line: '―' };
const NAME_LIMIT = 28;

function layerName(layer, profiles) {
  if (layer.type === 'text') {
    const clean = layer.text.replace(/[*~]/g, '').replace(/\s+/g, ' ').trim();
    return clean ? (clean.length > NAME_LIMIT ? `${clean.slice(0, NAME_LIMIT)}…` : clean) : 'Empty text';
  }
  if (layer.type === 'profile') return profiles.find((p) => p.id === layer.profileId)?.name ?? 'Profile';
  if (layer.type === 'link') return layer.siteName || layer.domain || 'Link';
  if (layer.type === 'element') return ELEMENTS.find((entry) => entry.id === layer.variant)?.label ?? 'Element';
  return 'Image';
}

function iconButton(name, label, onClick, pressed) {
  return h(
    'button',
    { type: 'button', class: 'icon-btn', title: label, 'aria-label': label, 'aria-pressed': pressed === undefined ? undefined : String(pressed), onclick: (e) => (e.stopPropagation(), onClick()) },
    icon(name, 14),
  );
}

/** Left rail: add buttons, layout templates and the layer stack. */
export function mountRail(root, { store, actions, focusLink }) {
  const addRow = h(
    'div',
    { class: 'add-row' },
    h('button', { type: 'button', class: 'add-btn', onclick: () => actions.addText() }, icon('text', 18), h('span', {}, 'Text')),
    h('button', { type: 'button', class: 'add-btn', onclick: () => actions.addProfile() }, icon('user', 18), h('span', {}, 'Profile')),
    h('button', { type: 'button', class: 'add-btn', onclick: () => pickFile().then((f) => f && actions.addImageFile(f)) }, icon('image', 18), h('span', {}, 'Image')),
    h('button', { type: 'button', class: 'add-btn', onclick: () => focusLink() }, icon('link', 18), h('span', {}, 'Link')),
  );

  const templates = h(
    'div',
    { class: 'templates' },
    TEMPLATES.map((t) => h('button', { type: 'button', class: 'template-btn', dataset: { template: t.id }, onclick: () => actions.applyTemplate(t.id) }, h('span', { class: `tpl-glyph tpl-${t.id}`, 'aria-hidden': 'true' }), h('span', {}, t.label))),
  );
  const elementGrid = (entries) => h('div', { class: 'element-grid' },
    entries.map((entry) => h('button', {
      type: 'button', class: 'element-add',
      title: `Add ${entry.label}`, onclick: () => actions.addElement(entry.id),
    }, h('span', { class: 'element-glyph', 'aria-hidden': 'true' }, ELEMENT_GLYPHS[entry.id]), h('span', {}, entry.label))));

  const list = h('ol', { class: 'layer-list', 'aria-label': 'Layers (top first)' });
  const bgRow = h('button', { type: 'button', class: 'layer-row layer-bg', onclick: () => store.select(null) }, icon('palette', 14), h('span', { class: 'layer-name' }, 'Background'));

  const stickerGrid = h('div', { class: 'sticker-grid' },
    STICKERS.map((sticker) => h('button', {
      type: 'button', class: 'sticker-add', title: `Add ${sticker.emoji} sticker`, 'aria-label': `Add ${sticker.emoji} sticker`,
      onclick: () => actions.addSticker(sticker),
    }, h('img', { src: sticker.src, alt: '', loading: 'lazy', width: 40, height: 40 }))));

  const group = (title, ...children) => h('section', { class: 'group' }, h('h3', { class: 'group-title' }, title), ...children);
  const TABS = [
    { id: 'add', label: 'Add', panel: [group('Add', addRow), group('Layouts', templates)] },
    { id: 'shapes', label: 'Boxes', panel: [group('Boxes & shapes', elementGrid(SHAPE_ELEMENTS)), group('Vox-style', elementGrid(EDITORIAL_ELEMENTS))] },
    { id: 'stickers', label: 'Stickers', panel: [group('3D stickers', stickerGrid), group('Illustrated', elementGrid(DECORATIVE_ELEMENTS.filter((entry) => entry.group === 'stickers')))] },
    { id: 'paper', label: 'Paper', panel: [group('Paper & doodles', elementGrid(DECORATIVE_ELEMENTS.filter((entry) => entry.group === 'paper')))] },
  ];
  const panels = TABS.map((tab) => h('div', { class: 'rail-panel', role: 'tabpanel', dataset: { tab: tab.id } }, ...tab.panel));
  const tabButtons = TABS.map((tab) => h('button', { type: 'button', class: 'rail-tab', role: 'tab', dataset: { tab: tab.id }, onclick: () => showTab(tab.id) }, tab.label));
  function showTab(id) {
    tabButtons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    panels.forEach((p) => { p.hidden = p.dataset.tab !== id; });
    try { localStorage.setItem('lumen:rail-tab', id); } catch { /* storage unavailable */ }
  }
  let savedTab = 'add';
  try { savedTab = localStorage.getItem('lumen:rail-tab') || 'add'; } catch { /* storage unavailable */ }
  showTab(TABS.some((t) => t.id === savedTab) ? savedTab : 'add');

  root.append(
    h('div', { class: 'rail-tabs', role: 'tablist' }, ...tabButtons),
    h('div', { class: 'rail-panels' }, ...panels),
    h('section', { class: 'group group-layers' }, h('h3', { class: 'group-title' }, 'Layers'), list, bgRow),
  );

  function renderList() {
    const { doc, profiles, selection } = store.get();
    bgRow.setAttribute('aria-current', String(selection === null));
    list.replaceChildren(
      ...[...doc.layers].reverse().map((layer) =>
        h(
          'li',
          {},
          h(
            'div',
            {
              class: `layer-row${layer.id === selection ? ' is-selected' : ''}${layer.visible ? '' : ' is-hidden'}`,
              role: 'button',
              tabIndex: 0,
              onclick: () => store.select(layer.id),
              onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), store.select(layer.id)),
            },
            icon(TYPE_ICON[layer.type], 14),
            h('span', { class: 'layer-name' }, layerName(layer, profiles)),
            h(
              'span',
              { class: 'layer-actions' },
              iconButton('up', 'Bring forward', () => actions.reorder(layer.id, 1)),
              iconButton('down', 'Send backward', () => actions.reorder(layer.id, -1)),
              iconButton(layer.locked ? 'lock' : 'unlock', layer.locked ? 'Unlock' : 'Lock', () => store.updateLayer(layer.id, { locked: !layer.locked }), layer.locked),
              iconButton(layer.visible ? 'eye' : 'eyeOff', layer.visible ? 'Hide' : 'Show', () => store.updateLayer(layer.id, { visible: !layer.visible }), !layer.visible),
            ),
          ),
        ),
      ),
    );
  }

  store.subscribe((_, reason) => {
    if (reason !== 'preview') renderList();
  });
  renderList();
}
