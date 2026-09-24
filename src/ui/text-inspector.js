import { h, icon } from './dom.js';
import { slider, segmented, toggle, colorField, textField, section, pct } from './controls.js';
import { TEXT_EFFECTS, TEXT_BOXES } from '../app/model.js';
import { getFont, nearestWeight, availableIds } from '../fonts/catalog.js';
import { ensurePreview } from '../fonts/loader.js';
import { suggestFonts, analyzeMood, MOODS } from '../fonts/suggest.js';
import { layerHeader } from './layer-header.js';

const SUGGESTION_COUNT = 8;
const SUGGEST_DEBOUNCE_MS = 350;
const ALIGN = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
];

const layerOf = (state, id) => state.doc.layers.find((l) => l.id === id);

export function fontFromMeta(meta, weight, italic) {
  return { id: meta.id, family: meta.family, weight: nearestWeight(meta, weight), italic: Boolean(italic) && meta.styles?.includes('italic') };
}

export function buildTextInspector(deps, id) {
  const { store, openFontPicker } = deps;
  const update = (patch, key) => store.updateLayer(id, patch, key ? { key: `${id}:${key}` } : undefined);
  const initial = layerOf(store.get(), id);
  const theme = () => store.get().doc.theme;

  const text = textField({ value: initial.text, multiline: true, rows: 4, placeholder: 'Type anything — wrap *words* in stars to highlight', onInput: (v) => update({ text: v }, 'text') });
  text.input.classList.add('text-editor');

  /* ---------- font ---------- */
  const fontName = h('span', { class: 'font-current-name' });
  const fontMeta = h('span', { class: 'font-current-meta' });
  const fontButton = h('button', { type: 'button', class: 'font-current', onclick: () => openFontPicker(id) }, h('span', { class: 'font-current-text' }, fontName, fontMeta), h('span', { class: 'font-current-cta' }, 'Browse 1,900+'));
  const moodLabel = h('span', { class: 'mood-label' });
  const suggestions = h('div', { class: 'font-suggestions', role: 'list' });

  const applyFont = (meta) => {
    const layer = layerOf(store.get(), id);
    store.setPreview(null);
    update({ font: fontFromMeta(meta, layer.font.weight, layer.font.italic) });
  };
  const previewFont = (meta) => {
    const layer = layerOf(store.get(), id);
    store.setPreview(meta ? { layerId: id, patch: { font: fontFromMeta(meta, layer.font.weight, layer.font.italic) } } : null);
  };

  let suggestTimer = 0;
  let lastSuggestText = null;
  function renderSuggestions(value) {
    if (value === lastSuggestText) return;
    lastSuggestText = value;
    const [top] = analyzeMood(value);
    moodLabel.textContent = `Suits “${MOODS[top.id].label.toLowerCase()}”`;
    const metas = suggestFonts(value, availableIds(), SUGGESTION_COUNT).map(getFont).filter(Boolean);
    suggestions.replaceChildren(
      ...metas.map((meta) =>
        h(
          'button',
          {
            type: 'button',
            class: 'font-chip',
            role: 'listitem',
            title: meta.family,
            style: { 'font-family': `"${ensurePreview(meta)}", system-ui` },
            onclick: () => applyFont(meta),
            onmouseenter: () => previewFont(meta),
            onmouseleave: () => previewFont(null),
            onfocus: () => previewFont(meta),
            onblur: () => previewFont(null),
          },
          h('span', { class: 'font-chip-sample' }, 'Aa'),
          h('span', { class: 'font-chip-name' }, meta.family),
        ),
      ),
    );
  }

  /* ---------- controls ---------- */
  const weight = slider({ label: 'Weight', min: 100, max: 900, step: 100, value: initial.font.weight, onInput: (v) => update({ font: { ...layerOf(store.get(), id).font, weight: v } }, 'weight') });
  const size = slider({ label: 'Size', min: 6, max: 480, step: 1, value: initial.size, format: (v) => `${Math.round(v)}`, onInput: (v) => update({ size: v }, 'size') });
  const autoFit = toggle({ label: 'Auto fit', value: initial.autoFit ?? false, onChange: (v) => update({ autoFit: v }) });
  const width = slider({ label: 'Box width', min: 0.05, max: 1.5, step: 0.005, value: initial.width, format: pct, onInput: (v) => update({ width: v }, 'width') });
  const lineHeight = slider({ label: 'Line height', min: 0.7, max: 2.2, step: 0.01, value: initial.lineHeight, format: (v) => v.toFixed(2), onInput: (v) => update({ lineHeight: v }, 'lh') });
  const tracking = slider({ label: 'Letter spacing', min: -0.12, max: 0.5, step: 0.005, value: initial.tracking, format: (v) => `${Math.round(v * 1000)}`, onInput: (v) => update({ tracking: v }, 'tracking') });
  const align = segmented({ label: 'Align', options: ALIGN, value: initial.align, onChange: (v) => update({ align: v }) });
  const italic = toggle({ label: 'Italic', value: initial.font.italic, onChange: (v) => update({ font: { ...layerOf(store.get(), id).font, italic: v } }) });
  const upper = toggle({ label: 'Caps', value: initial.uppercase, onChange: (v) => update({ uppercase: v }) });
  const fade = toggle({ label: 'Fade', value: initial.gradient, onChange: (v) => update({ gradient: v }) });

  const color = colorField({ label: 'Text', value: initial.color ?? theme().text, onInput: (v) => update({ color: v }, 'color') });
  const highlight = colorField({ label: '*Highlight*', value: initial.highlight ?? theme().accent, onInput: (v) => update({ highlight: v }, 'hl') });
  const effectColor = colorField({ label: 'Effect', value: initial.effectColor ?? theme().accent, onInput: (v) => update({ effectColor: v }, 'fx') });
  const effect = segmented({ label: 'Effect', options: TEXT_EFFECTS, value: initial.effect, onChange: (v) => update({ effect: v }), compact: true });
  const box = segmented({ label: 'Background', options: TEXT_BOXES, value: initial.box, onChange: (v) => update({ box: v }), compact: true });
  const opacity = slider({ label: 'Opacity', min: 0, max: 1, step: 0.01, value: initial.opacity, format: pct, onInput: (v) => update({ opacity: v }, 'opacity') });

  const el = h(
    'div',
    {},
    layerHeader('Text', id, deps),
    section('Content', text.el, h('p', { class: 'hint-line' }, icon('sparkle', 12), ' No length limit · Enter for new lines · ', h('code', {}, '*word*'), ' highlights')),
    section('Typeface', fontButton, h('div', { class: 'suggest-head' }, moodLabel), suggestions, weight.el, h('div', { class: 'switch-row' }, italic.el, upper.el, fade.el)),
    section('Layout', autoFit.el, h('p', { class: 'hint-line' }, 'Balances long text and keeps it inside the canvas. Size is the upper limit.'), size.el, width.el, align.el, lineHeight.el, tracking.el),
    section('Colour & effects', h('div', { class: 'colors' }, color.el, highlight.el, effectColor.el), effect.el, box.el, opacity.el),
  );

  return {
    el,
    focus() {
      text.input.focus();
      text.input.select();
    },
    sync(state) {
      const layer = layerOf(state, id);
      if (!layer) return;
      const meta = getFont(layer.font.id);
      fontName.textContent = layer.font.family;
      fontName.style.fontFamily = meta ? `"${ensurePreview(meta)}", system-ui` : 'inherit';
      fontMeta.textContent = meta ? `${meta.category} · ${meta.weights.length} weight${meta.weights.length > 1 ? 's' : ''}` : '';
      const weights = meta?.weights ?? [layer.font.weight];
      weight.input.min = String(Math.min(...weights));
      weight.input.max = String(Math.max(...weights));
      weight.input.disabled = weights.length < 2;
      weight.set(layer.font.weight);
      text.set(layer.text);
      size.set(layer.size);
      autoFit.set(layer.autoFit ?? false);
      width.set(layer.width);
      lineHeight.set(layer.lineHeight);
      tracking.set(layer.tracking);
      align.set(layer.align);
      italic.set(layer.font.italic);
      upper.set(layer.uppercase);
      fade.set(layer.gradient);
      color.set(layer.color ?? state.doc.theme.text);
      highlight.set(layer.highlight ?? state.doc.theme.accent);
      effectColor.set(layer.effectColor ?? state.doc.theme.accent);
      effect.set(layer.effect);
      box.set(layer.box);
      opacity.set(layer.opacity);
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(() => renderSuggestions(layer.text), lastSuggestText === null ? 0 : SUGGEST_DEBOUNCE_MS);
    },
  };
}
