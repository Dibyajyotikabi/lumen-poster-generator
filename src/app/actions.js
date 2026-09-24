import { createTextLayer, createProfileLayer, createImageLayer, createLinkLayer, createProfile, PALETTES, docSize, uid } from './model.js';
import { fetchLinkPreview, fetchRemoteImage } from './link.js';
import { TEMPLATES, extractContent } from './templates.js';
import { putAsset } from '../core/assets.js';
import { extractPalette } from '../core/extract-palette.js';
import { randomSeed } from '../core/random.js';
import { slugify } from '../core/layout.js';
import { imageKeyFor } from '../render/background.js';
import { suggestDirection } from '../fonts/suggest.js';
import { availableIds, getFont, nearestWeight } from '../fonts/catalog.js';
import { fontReady } from '../fonts/loader.js';
import { toast } from '../ui/dom.js';
import { cutoutPlacement } from '../cutout/selection.js';

const FORMATS = {
  png: { type: 'image/png', ext: 'png' },
  jpg: { type: 'image/jpeg', ext: 'jpg', quality: 0.93 },
  webp: { type: 'image/webp', ext: 'webp', quality: 0.93 },
};

const MIN_UNIQUE_PROFILES = 2;
const SAMPLE_PX = 48;

function themeFromImage(img) {
  const sample = document.createElement('canvas');
  sample.width = SAMPLE_PX;
  sample.height = SAMPLE_PX;
  const ctx = sample.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, SAMPLE_PX, SAMPLE_PX);
  return extractPalette(ctx.getImageData(0, 0, SAMPLE_PX, SAMPLE_PX).data);
}
const LINK_BACKDROP = { blur: 1, dim: 0.3, zoom: 1.2 };

export function createActions({ store, images, render, cutout }) {
  const current = () => store.get();
  const layerById = (id) => current().doc.layers.find((l) => l.id === id);

  function insertLayer(layer) {
    store.setLayers([...current().doc.layers, layer]);
    store.select(layer.id);
    return layer;
  }

  const actions = {
    addText(overrides = {}) {
      return insertLayer(createTextLayer({ text: 'New text', size: 64, cy: 0.5, width: 0.6, ...overrides }));
    },

    addProfile(profileId = current().profiles[0]?.id) {
      return insertLayer(createProfileLayer(profileId, { cy: 0.5 }));
    },

    async addImageFile(file) {
      try {
        const assetId = await putAsset(file);
        await images.whenReady(`asset:${assetId}`);
        insertLayer(createImageLayer(assetId));
      } catch (err) {
        toast(err.message || 'Could not add that image');
      }
    },

    duplicate(id = current().selection) {
      const layer = layerById(id);
      if (!layer) return;
      const copy = { ...layer, id: uid(layer.id[0]), cx: Math.min(0.95, layer.cx + 0.03), cy: Math.min(0.95, layer.cy + 0.04) };
      const layers = current().doc.layers;
      const index = layers.findIndex((l) => l.id === id);
      store.setLayers([...layers.slice(0, index + 1), copy, ...layers.slice(index + 1)]);
      store.select(copy.id);
    },

    remove(id = current().selection) {
      if (!id) return;
      store.setLayers(current().doc.layers.filter((l) => l.id !== id));
      store.select(null);
    },

    /** dir: +1 brings forward (towards top of stack), -1 sends backward. */
    reorder(id, dir) {
      const layers = current().doc.layers;
      const i = layers.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= layers.length) return;
      const next = [...layers];
      [next[i], next[j]] = [next[j], next[i]];
      store.setLayers(next);
    },

    /** Opens the background remover for an image layer; always cuts from the untouched original. */
    async removeBackground(id = current().selection) {
      const layer = layerById(id);
      if (layer?.type !== 'image') return;
      const originalId = layer.originalAssetId ?? layer.assetId;
      const img = await images.whenReady(`asset:${originalId}`);
      if (!img) return toast('Could not load that image');
      const base = layer.original ?? { cx: layer.cx, cy: layer.cy, width: layer.width, radius: layer.radius };
      await cutout.open({
        img,
        key: originalId,
        onApply: async (result) => {
          const assetId = await putAsset(new File([result.blob], 'cutout.png', { type: 'image/png' }));
          await images.whenReady(`asset:${assetId}`);
          const placement = cutoutPlacement({ ...layer, ...base }, result, docSize(current().doc));
          store.updateLayer(id, { assetId, originalAssetId: originalId, original: base, cutout: true, radius: 0, ...placement });
          toast('Background removed');
        },
      });
    },

    restoreOriginal(id = current().selection) {
      const layer = layerById(id);
      if (!layer?.cutout) return;
      store.updateLayer(id, { assetId: layer.originalAssetId, cutout: false, originalAssetId: null, original: null, ...layer.original });
    },

    /**
     * Fetches a link's preview and shows it beautifully: the page image becomes a soft, blurred
     * backdrop (colours matched to it) and a crisp link card is placed on top.
     */
    async importLink(url, { background = true, card = true } = {}) {
      toast('Fetching link…');
      try {
        const preview = await fetchLinkPreview(url);
        const [imageFile, iconFile] = await Promise.all([
          fetchRemoteImage(preview.image).then((f) => f ?? fetchRemoteImage(preview.fallbackImage)),
          fetchRemoteImage(preview.icon),
        ]);
        const [imageAssetId, iconAssetId] = await Promise.all([imageFile ? putAsset(imageFile) : null, iconFile ? putAsset(iconFile).catch(() => null) : null]);
        const [image] = await Promise.all([imageAssetId, iconAssetId].map((id) => (id ? images.whenReady(`asset:${id}`) : null)));
        const { doc } = current();
        let next = doc;
        if (background && image) {
          next = { ...next, background: { ...next.background, source: 'upload', assetId: imageAssetId, ...LINK_BACKDROP, effectOnImage: false }, theme: themeFromImage(image) };
        } else if (background && preview.themeColor) {
          next = { ...next, theme: { ...next.theme, accent: preview.themeColor } };
        }
        let cardId = null;
        if (card) {
          // Showcase layout: keep people, give the card the stage.
          const people = doc.layers.filter((l) => l.type === 'profile').map((l) => ({ ...l, cy: 0.87 }));
          const cardLayer = createLinkLayer(preview, { imageAssetId, iconAssetId, variant: imageAssetId ? 'card' : 'compact', cy: people.length ? 0.44 : 0.5 });
          next = { ...next, layers: [...people, cardLayer] };
          cardId = cardLayer.id;
        }
        store.commit(next); // one undo step restores everything
        if (cardId) store.select(cardId);
        toast(`Added ${preview.siteName || preview.domain}${imageAssetId ? '' : ' (no preview image found)'} · ⌘Z to undo`);
        return preview;
      } catch (err) {
        console.warn('[lumen] link import failed', err);
        toast(err.message || 'Could not fetch that link');
        return null;
      }
    },

    /** Copies a link card's title into the main headline (or a new text layer). */
    useLinkTitle(id) {
      const link = layerById(id);
      if (link?.type !== 'link') return;
      const headline = [...current().doc.layers].filter((l) => l.type === 'text').sort((a, b) => b.size - a.size)[0];
      if (headline) store.updateLayer(headline.id, { text: link.title });
      else actions.addText({ text: link.title, size: 54, cy: 0.12, width: 0.86, lineHeight: 1.08 });
    },

    async linkImageAsBackground(id) {
      const link = layerById(id);
      if (!link?.imageAssetId) return toast('This link has no preview image');
      store.updateBackground({ source: 'upload', assetId: link.imageAssetId, ...LINK_BACKDROP });
      await images.whenReady(`asset:${link.imageAssetId}`);
      actions.matchImageColors();
    },

    center(id, axis) {
      store.updateLayer(id, axis === 'x' ? { cx: 0.5 } : { cy: 0.5 });
    },

    applyPalette(palette) {
      store.updateTheme({ bg: palette.bg, text: palette.text, accent: palette.accent });
    },

    regenerate() {
      store.updateBackground({ seed: randomSeed() });
    },

    applyTemplate(templateId) {
      const template = TEMPLATES.find((t) => t.id === templateId);
      if (!template) return;
      const needsTwo = templateId === 'collab' && current().profiles.length < MIN_UNIQUE_PROFILES;
      if (needsTwo) {
        store.setProfiles([...current().profiles, createProfile({ name: 'Guest Name', role: 'Their role', handle: 'in/guest', platform: 'linkedin' })]);
      }
      const ids = current().profiles.map((p) => p.id);
      const content = extractContent(current().doc.layers);
      store.setLayers(template.build(content, [ids[0], ids[1] ?? ids[0]]));
      store.select(null);
    },

    async setBackgroundFile(file) {
      try {
        const assetId = await putAsset(file);
        store.updateBackground({ source: 'upload', assetId });
        const img = await images.whenReady(`asset:${assetId}`);
        if (img) actions.matchImageColors();
      } catch (err) {
        toast(err.message || 'Could not use that image');
      }
    },

    /** Samples the background image and derives a legible theme from it. */
    async matchImageColors() {
      const key = imageKeyFor(current().doc.background);
      const img = key ? await images.whenReady(key) : null;
      if (!img) return toast('Pick an image or wallpaper background first');
      store.updateTheme(themeFromImage(img));
      toast('Colours matched to the image');
    },

    /**
     * Reads the headline, detects its mood and applies a fitting font pairing, palette and light style.
     * Repeated presses cycle through variations.
     */
    autoStyle() {
      const { doc } = current();
      const texts = doc.layers.filter((l) => l.type === 'text');
      if (!texts.length) return toast('Add some text first');
      const main = [...texts].sort((a, b) => b.size - a.size)[0];
      const seed = randomSeed();
      const dir = suggestDirection(texts.map((t) => t.text).join(' '), seed, availableIds());
      const headingMeta = getFont(dir.heading);
      const bodyMeta = getFont(dir.body);
      const toFont = (meta, id, weight) => ({ id, family: meta?.family ?? id, weight: nearestWeight(meta, weight), italic: false });

      const layers = doc.layers.map((l) => {
        if (l.type !== 'text' || l.font.id.includes('mono')) return l;
        if (l.id === main.id) return { ...l, font: toFont(headingMeta, dir.heading, 700) };
        return { ...l, font: toFont(bodyMeta, dir.body, l.font.weight) };
      });
      const usesImage = Boolean(imageKeyFor(doc.background));
      const palette = PALETTES.find((p) => p.id === dir.palette);
      store.commit({
        ...doc,
        layers,
        theme: usesImage ? doc.theme : { bg: palette.bg, text: palette.text, accent: palette.accent },
        background: { ...doc.background, style: dir.style, seed, effectOnImage: usesImage ? doc.background.effectOnImage : false },
      });
      toast(`${dir.moodLabel} · ${headingMeta?.family ?? dir.heading} + ${bodyMeta?.family ?? dir.body}`);
    },

    async renderExport(scale) {
      const state = current();
      const key = imageKeyFor(state.doc.background);
      const assetKeys = state.doc.layers.flatMap((l) =>
        l.type === 'image' ? [`asset:${l.assetId}`] : l.type === 'link' ? [l.imageAssetId, l.iconAssetId].filter(Boolean).map((id) => `asset:${id}`) : [],
      );
      const photoKeys = state.profiles.filter((p) => p.photoAssetId).map((p) => `asset:${p.photoAssetId}`);
      const fonts = state.doc.layers.filter((l) => l.type === 'text').map((l) => l.font);
      await Promise.all([
        ...[key, ...assetKeys, ...photoKeys].filter(Boolean).map((k) => images.whenReady(k)),
        ...fonts.map(fontReady),
        ...[400, 500, 600, 700].map((weight) => fontReady({ id: 'geist', family: 'Geist', weight })),
      ]);
      const canvas = document.createElement('canvas');
      render(canvas, { ...state, preview: null }, { scale, live: false });
      return canvas;
    },

    async exportImage(format = 'png', scale = 1) {
      const spec = FORMATS[format] ?? FORMATS.png;
      try {
        const canvas = await actions.renderExport(scale);
        const blob = await new Promise((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), spec.type, spec.quality),
        );
        const { width, height } = docSize(current().doc);
        const name = `${slugify(extractContent(current().doc.layers).headline.replace(/\*/g, ''))}-${width * scale}x${height * scale}.${spec.ext}`;
        const url = URL.createObjectURL(blob);
        const link = Object.assign(document.createElement('a'), { href: url, download: name });
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast(`Saved ${name}`);
      } catch (err) {
        console.warn('[lumen] export failed', err);
        toast('Could not export the image');
      }
    },

    async copyImage() {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return toast('Clipboard images are not supported here');
      try {
        const blobPromise = actions
          .renderExport(1)
          .then((canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Copy failed'))), 'image/png')));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
        toast('Copied to clipboard');
      } catch (err) {
        console.warn('[lumen] copy failed', err);
        toast('The browser blocked clipboard access');
      }
    },
  };
  return actions;
}
