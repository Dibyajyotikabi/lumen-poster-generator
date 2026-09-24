import { h, icon, pickFile } from './dom.js';
import { TEMPLATES } from '../app/templates.js';
import { EDITORIAL_ELEMENTS } from '../app/model.js';

const TYPE_ICON = { text: 'text', profile: 'user', image: 'image', link: 'link', element: 'sparkle' };
const ELEMENT_GLYPHS = { bar: '▰', rule: '━•', number: '01', quote: '“”', arrow: '➜', dots: '•••', voxels: '▦', bracket: '⌜⌟' };
const NAME_LIMIT = 28;

function layerName(layer, profiles) {
  if (layer.type === 'text') {
    const clean = layer.text.replace(/[*~]/g, '').replace(/\s+/g, ' ').trim();
    return clean ? (clean.length > NAME_LIMIT ? `${clean.slice(0, NAME_LIMIT)}…` : clean) : 'Empty text';
  }
  if (layer.type === 'profile') return profiles.find((p) => p.id === layer.profileId)?.name ?? 'Profile';
  if (layer.type === 'link') return layer.siteName || layer.domain || 'Link';
  if (layer.type === 'element') return EDITORIAL_ELEMENTS.find((entry) => entry.id === layer.variant)?.label ?? 'Element';
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
  const elements = h('div', { class: 'element-grid' },
    EDITORIAL_ELEMENTS.map((entry) => h('button', {
      type: 'button', class: 'element-add',
      title: `Add ${entry.label}`, onclick: () => actions.addElement(entry.id),
    }, h('span', { class: 'element-glyph', 'aria-hidden': 'true' }, ELEMENT_GLYPHS[entry.id]), h('span', {}, entry.label))));

  const list = h('ol', { class: 'layer-list', 'aria-label': 'Layers (top first)' });
  const bgRow = h('button', { type: 'button', class: 'layer-row layer-bg', onclick: () => store.select(null) }, icon('palette', 14), h('span', { class: 'layer-name' }, 'Background'));

  root.append(
    h('section', { class: 'group' }, h('h3', { class: 'group-title' }, 'Add'), addRow),
    h('section', { class: 'group' }, h('h3', { class: 'group-title' }, 'Vox-style elements'), elements),
    h('section', { class: 'group' }, h('h3', { class: 'group-title' }, 'Layouts'), templates),
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
