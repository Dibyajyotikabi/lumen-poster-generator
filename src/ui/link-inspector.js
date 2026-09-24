import { h } from './dom.js';
import { slider, segmented, toggle, textField, button, section, pct } from './controls.js';
import { LINK_VARIANTS } from '../app/model.js';
import { layerHeader } from './layer-header.js';

const layerOf = (state, id) => state.doc.layers.find((l) => l.id === id);

export function buildLinkInspector(deps, id) {
  const { store, actions } = deps;
  const update = (patch, key) => store.updateLayer(id, patch, key ? { key: `${id}:${key}` } : undefined);
  const initial = layerOf(store.get(), id);

  const variant = segmented({ label: 'Style', options: LINK_VARIANTS, value: initial.variant, onChange: (v) => update({ variant: v }) });
  const width = slider({ label: 'Width', min: 0.15, max: 1, step: 0.005, value: initial.width, format: pct, onInput: (v) => update({ width: v }, 'width') });
  const title = textField({ label: 'Title', value: initial.title, multiline: true, rows: 2, onInput: (v) => update({ title: v }, 'title') });
  const description = textField({ label: 'Description', value: initial.description, multiline: true, rows: 3, onInput: (v) => update({ description: v }, 'desc') });
  const showDesc = toggle({ label: 'Show description', value: initial.showDescription, onChange: (v) => update({ showDescription: v }) });
  const source = h('a', { class: 'link-source', href: initial.url, target: '_blank', rel: 'noopener noreferrer' }, initial.domain);

  const el = h(
    'div',
    {},
    layerHeader('Link', id, deps),
    section(
      'Link',
      source,
      button({ label: 'Use title as headline', iconName: 'text', variant: 'btn-wide', onClick: () => actions.useLinkTitle(id) }),
      button({ label: 'Use image as background', iconName: 'image', variant: 'btn-wide', onClick: () => actions.linkImageAsBackground(id) }),
    ),
    section('Look', variant.el, width.el, showDesc.el),
    section('Text', title.el, description.el),
  );
  return {
    el,
    sync(state) {
      const layer = layerOf(state, id);
      if (!layer) return;
      variant.set(layer.variant);
      width.set(layer.width);
      title.set(layer.title);
      description.set(layer.description);
      showDesc.set(layer.showDescription);
    },
  };
}
