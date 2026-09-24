import { h, icon } from './dom.js';
import { CATEGORIES, loadCatalog, searchFonts, getFont, availableIds, catalogSize } from '../fonts/catalog.js';
import { ensurePreview } from '../fonts/loader.js';
import { suggestFonts, analyzeMood, MOODS } from '../fonts/suggest.js';
import { fontFromMeta } from './text-inspector.js';

const ROW_H = 76;
const OVERSCAN = 6;
const SAMPLE_LIMIT = 48;
const SUGGESTED = 12;

/**
 * Searchable, virtualised browser over the full Google Fonts catalogue. Each row renders the
 * user's own text in that face; hovering previews it live on the canvas.
 */
export function createFontPicker({ store }) {
  let layerId = null;
  let results = [];
  let category = 'all';
  let activeIndex = -1;

  const search = h('input', { type: 'search', class: 'font-search', placeholder: 'Search 1,900+ Google fonts…', autocomplete: 'off', spellcheck: false });
  const count = h('span', { class: 'font-count' });
  const tabs = h(
    'div',
    { class: 'seg seg-compact font-cats', role: 'radiogroup', 'aria-label': 'Category' },
    CATEGORIES.map((c) => h('label', {}, h('input', { type: 'radio', name: 'font-cat', value: c.id, checked: c.id === 'all', onchange: () => ((category = c.id), refresh()) }), h('span', {}, c.label))),
  );
  const suggestTitle = h('p', { class: 'font-suggest-title' });
  const suggestRow = h('div', { class: 'font-suggest-row' });
  const spacer = h('div', { class: 'font-spacer' });
  const viewport = h('div', { class: 'font-list', role: 'listbox', tabIndex: 0, 'aria-label': 'Fonts' }, spacer);
  const close = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => dialog.close() }, icon('close', 16));

  const dialog = h(
    'dialog',
    { class: 'font-dialog', 'aria-label': 'Choose a font' },
    h('header', { class: 'font-head' }, h('div', { class: 'font-search-wrap' }, icon('search', 16), search), close),
    h('div', { class: 'font-toolbar' }, tabs, count),
    h('div', { class: 'font-suggest' }, suggestTitle, suggestRow),
    viewport,
  );
  document.body.append(dialog);

  const layer = () => store.get().doc.layers.find((l) => l.id === layerId);
  const sampleText = () => {
    const text = (layer()?.text ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    return (text || 'The quick brown fox').slice(0, SAMPLE_LIMIT);
  };

  function preview(meta) {
    const l = layer();
    store.setPreview(meta && l ? { layerId, patch: { font: fontFromMeta(meta, l.font.weight, l.font.italic) } } : null);
  }

  function apply(meta) {
    const l = layer();
    if (!l) return;
    store.setPreview(null);
    store.updateLayer(layerId, { font: fontFromMeta(meta, l.font.weight, l.font.italic) });
    dialog.close();
  }

  function row(meta, index) {
    const current = layer()?.font.id === meta.id;
    return h(
      'div',
      {
        class: `font-row${current ? ' is-current' : ''}${index === activeIndex ? ' is-active' : ''}`,
        role: 'option',
        'aria-selected': String(current),
        style: { transform: `translateY(${index * ROW_H}px)` },
        onmouseenter: () => preview(meta),
        onclick: () => apply(meta),
      },
      h('span', { class: 'font-row-meta' }, h('strong', {}, meta.family), h('span', {}, `${meta.category.replace('-', ' ')} · ${meta.weights.length} wt`)),
      h('span', { class: 'font-row-sample', style: { 'font-family': `"${ensurePreview(meta)}", system-ui` } }, sampleText()),
    );
  }

  function paintRows() {
    const first = Math.max(0, Math.floor(viewport.scrollTop / ROW_H) - OVERSCAN);
    const last = Math.min(results.length, Math.ceil((viewport.scrollTop + viewport.clientHeight) / ROW_H) + OVERSCAN);
    spacer.style.height = `${results.length * ROW_H}px`;
    spacer.replaceChildren(...results.slice(first, last).map((meta, i) => row(meta, first + i)));
  }

  function refresh() {
    results = searchFonts(search.value, category);
    activeIndex = -1;
    count.textContent = `${results.length.toLocaleString()} of ${catalogSize().toLocaleString()}`;
    viewport.scrollTop = 0;
    paintRows();
  }

  function renderSuggestions() {
    const text = layer()?.text ?? '';
    const [top] = analyzeMood(text);
    suggestTitle.replaceChildren(icon('sparkle', 13), ` Suggested for your text · ${MOODS[top.id].label}`);
    const metas = suggestFonts(text, availableIds(), SUGGESTED).map(getFont).filter(Boolean);
    suggestRow.replaceChildren(
      ...metas.map((meta) =>
        h(
          'button',
          { type: 'button', class: 'font-suggest-chip', title: meta.family, onmouseenter: () => preview(meta), onfocus: () => preview(meta), onclick: () => apply(meta) },
          h('span', { style: { 'font-family': `"${ensurePreview(meta)}", system-ui` } }, sampleText().split(' ').slice(0, 3).join(' ') || 'Aa'),
          h('small', {}, meta.family),
        ),
      ),
    );
  }

  let raf = 0;
  viewport.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(paintRows);
  });
  viewport.addEventListener('mouseleave', () => preview(null));
  suggestRow.addEventListener('mouseleave', () => preview(null));
  search.addEventListener('input', refresh);
  search.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key) || !results.length) return;
    e.preventDefault();
    if (e.key === 'Enter') return apply(results[Math.max(0, activeIndex)]);
    activeIndex = Math.max(0, Math.min(results.length - 1, activeIndex + (e.key === 'ArrowDown' ? 1 : -1)));
    const top = activeIndex * ROW_H;
    if (top < viewport.scrollTop || top + ROW_H > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = top - viewport.clientHeight / 2;
    preview(results[activeIndex]);
    paintRows();
  });
  dialog.addEventListener('close', () => store.setPreview(null));
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());

  return {
    open(id) {
      layerId = id;
      dialog.showModal();
      search.value = '';
      search.focus();
      loadCatalog().then(() => {
        renderSuggestions();
        refresh();
      });
    },
  };
}
