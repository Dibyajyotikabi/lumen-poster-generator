import { h, icon, pickFile, toast } from './dom.js';
import { asLink } from '../app/link.js';
import { slider, segmented, toggle, colorField, button, section, pct } from './controls.js';
import { STYLES, PALETTES } from '../app/model.js';
import { paintBackground } from '../render/background.js';

const CHIP_W = 160;
const CHIP_H = 90;
const SOURCES = [
  { id: 'generated', label: 'Generate' },
  { id: 'wallpaper', label: 'Wallpaper' },
  { id: 'upload', label: 'Image' },
];

let wallpaperInfo = null;
const loadWallpapers = () => {
  wallpaperInfo ??= fetch('/api/wallpapers')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .catch((err) => {
      console.warn('[lumen] wallpaper list unavailable', err);
      wallpaperInfo = null;
      return { current: null, library: [], error: true };
    });
  return wallpaperInfo;
};

const sourceTab = (b) => (b.source === 'library' ? 'wallpaper' : b.source);

function wallpaperTile({ label, src, active, onClick }) {
  return h(
    'button',
    { type: 'button', class: `wall-tile${active ? ' is-active' : ''}`, title: label, 'aria-pressed': String(active), onclick: onClick },
    h('img', { src, alt: '', loading: 'lazy', decoding: 'async' }),
    h('span', {}, label),
  );
}

export function buildBackgroundInspector(deps) {
  const { store, actions, images } = deps;
  const bg = () => store.get().doc.background;
  const setBg = (patch, key) => store.updateBackground(patch, key ? { key: `bg:${key}` } : undefined);

  /* ---------- source ---------- */
  const source = segmented({ options: SOURCES, value: sourceTab(bg()), onChange: (v) => selectSource(v) });
  const sourceBody = h('div', { class: 'source-body' });

  function selectSource(tab) {
    if (tab === 'generated') return setBg({ source: 'generated' });
    if (tab === 'upload') {
      if (bg().assetId) return setBg({ source: 'upload' });
      return pickFile().then((f) => (f ? actions.setBackgroundFile(f) : source.set(sourceTab(bg()))));
    }
    loadWallpapers().then((info) => {
      if (info.current) setBg({ source: 'wallpaper', effectOnImage: bg().effectOnImage });
      else if (info.library[0]) setBg({ source: 'library', libraryId: bg().libraryId ?? info.library[0].id });
      else {
        toast(info.unsupported ? 'Mac wallpapers work when you run Lumen on your Mac — upload any image instead' : 'No wallpapers found on this Mac');
        source.set(sourceTab(bg()));
      }
    });
  }

  let wallTiles = [];
  function renderWallpapers() {
    const wrap = h('div', { class: 'wall-grid' }, h('p', { class: 'hint-line' }, 'Loading wallpapers…'));
    loadWallpapers().then((info) => {
      const entries = [
        ...(info.current ? [{ label: `Current · ${info.current.name}`, src: '/api/wallpapers/current.jpg?size=thumb', patch: { source: 'wallpaper' }, is: (b) => b.source === 'wallpaper' }] : []),
        ...info.library.map((w) => ({
          label: w.name,
          src: `/api/wallpapers/library/${encodeURIComponent(w.id)}.jpg?size=thumb`,
          patch: { source: 'library', libraryId: w.id },
          is: (b) => b.source === 'library' && b.libraryId === w.id,
        })),
      ];
      wallTiles = entries.map((e) => ({ is: e.is, el: wallpaperTile({ label: e.label, src: e.src, active: e.is(bg()), onClick: () => setBg(e.patch) }) }));
      const note = info.current
        ? null
        : h(
            'p',
            { class: 'hint-line' },
            info.error || info.unsupported
              ? 'Mac wallpapers are available when you run Lumen on your Mac (npm start). Upload any image instead.'
              : 'Your current wallpaper file isn’t on disk any more — pick one from the macOS library, or upload any image.',
          );
      wrap.replaceChildren(...(note ? [note] : []), ...wallTiles.map((t) => t.el));
    });
    return wrap;
  }

  function syncWallTiles(b) {
    wallTiles.forEach((t) => {
      const active = t.is(b);
      t.el.classList.toggle('is-active', active);
      t.el.setAttribute('aria-pressed', String(active));
    });
  }

  function renderUpload() {
    return h(
      'div',
      { class: 'drop-hint' },
      button({ label: bg().assetId ? 'Replace image' : 'Choose image', iconName: 'image', variant: 'btn-wide', onClick: () => pickFile().then((f) => f && actions.setBackgroundFile(f)) }),
      h('p', { class: 'hint-line' }, 'Or drop / paste (⌘V) an image anywhere.'),
    );
  }

  /* ---------- from a link ---------- */
  const linkInput = h('input', { type: 'url', class: 'link-input', placeholder: 'Paste any link — article, YouTube, product…', autocomplete: 'off', spellcheck: false });
  const linkBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Fetch');
  const linkForm = h(
    'form',
    {
      class: 'link-form',
      noValidate: true, // we accept bare domains like example.com/post — asLink() normalises them
      onsubmit: async (e) => {
        e.preventDefault();
        const url = asLink(linkInput.value);
        if (!url) return toast('Paste a full link, e.g. https://example.com/article');
        linkBtn.disabled = true;
        const preview = await actions.importLink(url);
        linkBtn.disabled = false;
        if (preview) linkInput.value = '';
      },
    },
    h('span', { class: 'link-input-wrap' }, icon('link', 15), linkInput),
    linkBtn,
  );
  const linkSection = section('From a link', linkForm, h('p', { class: 'hint-line' }, 'Uses the page’s image as a soft backdrop and adds a link card. Tip: just press ⌘V with a copied link.'));

  /* ---------- image adjustments ---------- */
  const blur = slider({ label: 'Blur', min: 0, max: 1, step: 0.01, value: bg().blur, format: pct, onInput: (v) => setBg({ blur: v }, 'blur') });
  const dim = slider({ label: 'Dim', min: 0, max: 0.9, step: 0.01, value: bg().dim, format: pct, onInput: (v) => setBg({ dim: v }, 'dim') });
  const zoom = slider({ label: 'Zoom', min: 1, max: 3, step: 0.01, value: bg().zoom, format: (v) => `${v.toFixed(2)}×`, onInput: (v) => setBg({ zoom: v }, 'zoom') });
  const overlayFx = toggle({ label: 'Light effects on top', value: bg().effectOnImage, onChange: (v) => setBg({ effectOnImage: v }) });
  const match = button({ label: 'Match colours to image', iconName: 'wand', variant: 'btn-wide', onClick: () => actions.matchImageColors() });
  const imageSection = section('Image', blur.el, dim.el, zoom.el, overlayFx.el, match);

  /* ---------- styles ---------- */
  let chipKey = null;
  const chips = STYLES.map(({ id, label }) => {
    const canvas = h('canvas', { width: CHIP_W, height: CHIP_H, 'aria-hidden': 'true' });
    const input = h('input', { type: 'radio', name: 'bg-style', value: id, onchange: () => setBg({ style: id }) });
    return { id, canvas, input, el: h('label', { class: 'style-chip' }, input, canvas, h('span', {}, label)) };
  });
  const paintChips = (doc) => {
    const key = JSON.stringify([doc.theme, doc.background.seed, doc.background.intensity, doc.background.grain]);
    if (key === chipKey) return;
    chipKey = key;
    chips.forEach((c) => paintBackground(c.canvas, { ...doc, background: { ...doc.background, source: 'generated', style: c.id, vignette: 0.2 } }, images, CHIP_W, CHIP_H));
  };
  const styleHead = h('div', { class: 'row-between' }, h('h3', { class: 'group-title' }, 'Light & atmosphere'), button({ iconName: 'dice', label: 'Regenerate', variant: 'btn-small', title: 'New variation (G)', onClick: () => actions.regenerate() }));
  const styleSection = h('section', { class: 'group' }, styleHead, h('div', { class: 'styles', role: 'radiogroup', 'aria-label': 'Light style' }, chips.map((c) => c.el)));

  /* ---------- colours ---------- */
  const theme = () => store.get().doc.theme;
  const cBg = colorField({ label: 'Background', value: theme().bg, onInput: (v) => store.updateTheme({ bg: v }, { key: 'theme:bg' }) });
  const cText = colorField({ label: 'Text', value: theme().text, onInput: (v) => store.updateTheme({ text: v }, { key: 'theme:text' }) });
  const cAccent = colorField({ label: 'Light', value: theme().accent, onInput: (v) => store.updateTheme({ accent: v }, { key: 'theme:accent' }) });
  const swatches = PALETTES.map((p) =>
    h('button', { type: 'button', class: 'palette', title: p.label, 'aria-label': `${p.label} palette`, style: { '--bg': p.bg, '--text': p.text, '--accent': p.accent }, onclick: () => actions.applyPalette(p) }, 'Aa'),
  );

  const intensity = slider({ label: 'Light strength', min: 0, max: 1.5, step: 0.01, value: bg().intensity, format: pct, onInput: (v) => setBg({ intensity: v }, 'intensity') });
  const grain = slider({ label: 'Grain', min: 0, max: 1, step: 0.01, value: bg().grain, format: pct, onInput: (v) => setBg({ grain: v }, 'grain') });
  const vignette = slider({ label: 'Vignette', min: 0, max: 1, step: 0.01, value: bg().vignette, format: pct, onInput: (v) => setBg({ vignette: v }, 'vignette') });

  const el = h(
    'div',
    {},
    h('header', { class: 'inspector-head' }, h('h2', {}, 'Background'), h('span', { class: 'inspector-sub' }, 'Click a layer to edit it')),
    linkSection,
    h('section', { class: 'group' }, h('h3', { class: 'group-title' }, 'Source'), source.el, sourceBody),
    imageSection,
    styleSection,
    section('Colour', h('div', { class: 'colors' }, cBg.el, cText.el, cAccent.el), h('div', { class: 'palettes' }, swatches)),
    section('Texture', intensity.el, grain.el, vignette.el),
  );

  let lastTab = null;
  return {
    el,
    focusLink() {
      linkInput.focus();
    },
    sync(state) {
      const b = state.doc.background;
      const tab = sourceTab(b);
      source.set(tab);
      if (tab !== lastTab) {
        wallTiles = [];
        sourceBody.replaceChildren(tab === 'wallpaper' ? renderWallpapers() : tab === 'upload' ? renderUpload() : '');
        lastTab = tab;
      }
      syncWallTiles(b);
      imageSection.hidden = tab === 'generated';
      styleSection.classList.toggle('is-muted', tab !== 'generated' && !b.effectOnImage);
      chips.forEach((c) => (c.input.checked = c.id === b.style));
      paintChips(state.doc);
      [blur, dim, zoom].forEach((ctl, i) => ctl.set([b.blur, b.dim, b.zoom][i]));
      overlayFx.set(b.effectOnImage);
      cBg.set(state.doc.theme.bg);
      cText.set(state.doc.theme.text);
      cAccent.set(state.doc.theme.accent);
      swatches.forEach((s, i) => {
        const p = PALETTES[i];
        const t = state.doc.theme;
        s.setAttribute('aria-pressed', String(p.bg === t.bg && p.text === t.text && p.accent === t.accent));
      });
      intensity.set(b.intensity);
      grain.set(b.grain);
      vignette.set(b.vignette);
    },
  };
}

