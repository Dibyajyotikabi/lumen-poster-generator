import { h, pickFile } from './dom.js';
import { slider, segmented, toggle, selectField, button, section, pct } from './controls.js';
import { PROFILE_VARIANTS } from '../app/model.js';
import { buildTextInspector } from './text-inspector.js';
import { buildBackgroundInspector } from './background-inspector.js';
import { layerHeader } from './layer-header.js';
import { putAsset } from '../core/assets.js';

const layerOf = (state, id) => state.doc.layers.find((l) => l.id === id);

function buildProfileInspector(deps, id) {
  const { store, openProfiles } = deps;
  const update = (patch, key) => store.updateLayer(id, patch, key ? { key: `${id}:${key}` } : undefined);
  const initial = layerOf(store.get(), id);
  const profileOptions = () => store.get().profiles.map((p) => ({ id: p.id, label: p.name || 'Untitled' }));

  const who = selectField({ label: 'Person', options: profileOptions(), value: initial.profileId, onChange: (v) => update({ profileId: v }) });
  const variant = segmented({ label: 'Style', options: PROFILE_VARIANTS, value: initial.variant, onChange: (v) => update({ variant: v }) });
  const scale = slider({ label: 'Size', min: 0.3, max: 4, step: 0.01, value: initial.scale, format: pct, onInput: (v) => update({ scale: v }, 'scale') });

  const el = h(
    'div',
    {},
    layerHeader('Profile', id, deps),
    section('Person', who.el, button({ label: 'Edit people & photos', iconName: 'user', variant: 'btn-wide', onClick: () => openProfiles(layerOf(store.get(), id)?.profileId) })),
    section('Look', variant.el, scale.el),
  );
  return {
    el,
    sync(state) {
      const layer = layerOf(state, id);
      if (!layer) return;
      who.select.replaceChildren(...profileOptions().map((o) => new Option(o.label, o.id)));
      who.set(layer.profileId);
      variant.set(layer.variant);
      scale.set(layer.scale);
    },
  };
}

function buildImageInspector(deps, id) {
  const { store } = deps;
  const update = (patch, key) => store.updateLayer(id, patch, key ? { key: `${id}:${key}` } : undefined);
  const initial = layerOf(store.get(), id);
  const width = slider({ label: 'Width', min: 0.03, max: 1.5, step: 0.005, value: initial.width, format: pct, onInput: (v) => update({ width: v }, 'width') });
  const radius = slider({ label: 'Corner radius', min: 0, max: 0.5, step: 0.005, value: initial.radius, format: pct, onInput: (v) => update({ radius: v }, 'radius') });
  const opacity = slider({ label: 'Opacity', min: 0, max: 1, step: 0.01, value: initial.opacity, format: pct, onInput: (v) => update({ opacity: v }, 'opacity') });
  const shadow = toggle({ label: 'Drop shadow', value: initial.shadow, onChange: (v) => update({ shadow: v }) });
  const replace = button({
    label: 'Replace image',
    iconName: 'image',
    variant: 'btn-wide',
    onClick: async () => {
      const file = await pickFile();
      if (file) update({ assetId: await putAsset(file) });
    },
  });
  const el = h('div', {}, layerHeader('Image', id, deps), section('Image', replace, width.el, radius.el, opacity.el, shadow.el));
  return {
    el,
    sync(state) {
      const layer = layerOf(state, id);
      if (!layer) return;
      width.set(layer.width);
      radius.set(layer.radius);
      opacity.set(layer.opacity);
      shadow.set(layer.shadow);
    },
  };
}

const BUILDERS = { text: buildTextInspector, profile: buildProfileInspector, image: buildImageInspector };

/** Context-sensitive right panel: background settings, or the selected layer's properties. */
export function mountInspector(root, deps) {
  const { store } = deps;
  let mounted = { key: null, sync: () => {}, api: {} };

  function mount() {
    const state = store.get();
    const layer = layerOf(state, state.selection);
    const key = layer ? `${layer.type}:${layer.id}` : 'background';
    if (key !== mounted.key) {
      const built = layer ? BUILDERS[layer.type](deps, layer.id) : buildBackgroundInspector(deps);
      root.replaceChildren(built.el);
      root.scrollTop = 0;
      mounted = { key, sync: built.sync, api: built };
    }
    mounted.sync(state);
  }

  store.subscribe((_, reason) => reason !== 'preview' && mount());
  mount();
  return {
    focusText(id) {
      store.select(id);
      mount();
      mounted.api.focus?.();
    },
  };
}
