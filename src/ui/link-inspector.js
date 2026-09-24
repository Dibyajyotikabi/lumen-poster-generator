import { h } from './dom.js';
import { slider, segmented, toggle, textField, button, section, pct } from './controls.js';
import { LINK_VARIANTS, CARD_THEMES } from '../app/model.js';
import { layerHeader } from './layer-header.js';

const layerOf = (state, id) => state.doc.layers.find((l) => l.id === id);
const TITLES = { tweet: 'Post', video: 'Video', article: 'Link', image: 'Link' };

export function buildLinkInspector(deps, id) {
  const { store, actions } = deps;
  const update = (patch, key) => store.updateLayer(id, patch, key ? { key: `${id}:${key}` } : undefined);
  const initial = layerOf(store.get(), id);
  const kind = initial.kind ?? 'article';
  const isTweet = kind === 'tweet';

  const variants = LINK_VARIANTS[kind] ?? LINK_VARIANTS.article;
  const variant = variants.length > 1 ? segmented({ label: 'Design', options: variants, value: initial.variant, onChange: (v) => update({ variant: v }), compact: true }) : null;
  const theme = segmented({ label: 'Card colour', options: CARD_THEMES, value: initial.cardTheme ?? 'auto', onChange: (v) => update({ cardTheme: v }), compact: true });
  const width = slider({ label: 'Size', min: 0.15, max: 1, step: 0.005, value: initial.width, format: pct, onInput: (v) => update({ width: v }, 'width') });
  const toggles = isTweet
    ? [
        toggle({ label: 'Photos', value: initial.showMedia !== false, onChange: (v) => update({ showMedia: v }) }),
        toggle({ label: 'Date', value: initial.showDate !== false, onChange: (v) => update({ showDate: v }) }),
        toggle({ label: 'Stats', value: initial.showStats !== false, onChange: (v) => update({ showStats: v }) }),
      ]
    : [toggle({ label: 'Description', value: initial.showDescription !== false, onChange: (v) => update({ showDescription: v }) })];

  const fields = isTweet
    ? [textField({ label: 'Post text', value: initial.tweet?.text ?? '', multiline: true, rows: 5, onInput: (v) => update({ tweet: { ...layerOf(store.get(), id).tweet, text: v } }, 'text') })]
    : [
        textField({ label: 'Title', value: initial.title, multiline: true, rows: 2, onInput: (v) => update({ title: v }, 'title') }),
        textField({ label: 'Description', value: initial.description, multiline: true, rows: 3, onInput: (v) => update({ description: v }, 'desc') }),
      ];

  const source = h('a', { class: 'link-source', href: initial.url, target: '_blank', rel: 'noopener noreferrer' }, isTweet ? `@${initial.tweet?.author?.handle ?? ''}` : initial.domain);
  const el = h(
    'div',
    {},
    layerHeader(TITLES[kind] ?? 'Link', id, deps),
    section('Look', variant?.el, theme.el, width.el, h('div', { class: 'switch-row' }, toggles.map((t) => t.el)), h('p', { class: 'hint-line' }, 'Cards always fit the canvas — long posts shrink instead of getting cut.')),
    section(
      'Source',
      source,
      button({ label: isTweet ? 'Use post text as headline' : 'Use title as headline', iconName: 'text', variant: 'btn-wide', onClick: () => actions.useLinkTitle(id) }),
      button({ label: 'Use image as background', iconName: 'image', variant: 'btn-wide', onClick: () => actions.linkImageAsBackground(id) }),
    ),
    section('Text', ...fields.map((f) => f.el)),
  );

  return {
    el,
    sync(state) {
      const layer = layerOf(state, id);
      if (!layer) return;
      variant?.set(layer.variant);
      theme.set(layer.cardTheme ?? 'auto');
      width.set(layer.width);
      if (isTweet) {
        toggles[0].set(layer.showMedia !== false);
        toggles[1].set(layer.showDate !== false);
        toggles[2].set(layer.showStats !== false);
        fields[0].set(layer.tweet?.text ?? '');
      } else {
        toggles[0].set(layer.showDescription !== false);
        fields[0].set(layer.title);
        fields[1].set(layer.description);
      }
    },
  };
}
