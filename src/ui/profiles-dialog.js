import { h, icon, pickFile, toast } from './dom.js';
import { textField, selectField } from './controls.js';
import { createProfile } from '../app/model.js';
import { PLATFORMS, detectPlatform, normalizeHandle } from '../core/handles.js';
import { putAsset, getAsset } from '../core/assets.js';
import { initials } from '../render/profile.js';

/** Manage any number of people (name, role, platform handle, photo) used by profile layers. */
export function createProfilesDialog({ store, images }) {
  let editingId = null;
  const photoUrls = new Map();

  const list = h('ul', { class: 'people-list' });
  const form = h('div', { class: 'people-form' });
  const dialog = h(
    'dialog',
    { class: 'people-dialog', 'aria-label': 'People' },
    h('header', { class: 'font-head' }, h('h2', {}, 'People'), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => dialog.close() }, icon('close', 16))),
    h('div', { class: 'people-body' }, h('div', { class: 'people-side' }, list, h('button', { type: 'button', class: 'btn btn-wide', onclick: add }, icon('plus'), h('span', {}, 'Add person'))), form),
  );
  document.body.append(dialog);
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());

  const profiles = () => store.get().profiles;
  const patchProfile = (id, patch) => store.setProfiles(profiles().map((p) => (p.id === id ? { ...p, ...patch } : p)));

  async function photoUrl(assetId) {
    if (!assetId) return null;
    if (!photoUrls.has(assetId)) {
      const blob = await getAsset(assetId);
      photoUrls.set(assetId, blob ? URL.createObjectURL(blob) : null);
    }
    return photoUrls.get(assetId);
  }

  function avatar(profile, size) {
    const el = h('span', { class: 'people-avatar', style: { width: `${size}px`, height: `${size}px` } }, initials(profile.name));
    photoUrl(profile.photoAssetId).then((url) => {
      if (!url) return;
      el.textContent = '';
      el.style.backgroundImage = `url("${url}")`;
    });
    return el;
  }

  function add() {
    const profile = createProfile({ name: 'New person', role: '', handle: '', platform: 'linkedin' });
    store.setProfiles([...profiles(), profile]);
    editingId = profile.id;
    render();
  }

  function remove(id) {
    const inUse = store.get().doc.layers.some((l) => l.type === 'profile' && l.profileId === id);
    if (profiles().length === 1) return toast('Keep at least one person');
    if (inUse) return toast('This person is used on the canvas — remove that layer first');
    store.setProfiles(profiles().filter((p) => p.id !== id));
    editingId = profiles()[0]?.id ?? null;
    render();
  }

  function renderList() {
    list.replaceChildren(
      ...profiles().map((p) =>
        h(
          'li',
          {},
          h(
            'button',
            { type: 'button', class: `people-item${p.id === editingId ? ' is-active' : ''}`, onclick: () => ((editingId = p.id), render()) },
            avatar(p, 32),
            h('span', { class: 'people-item-text' }, h('strong', {}, p.name || 'Untitled'), h('small', {}, p.handle || p.role || '—')),
          ),
        ),
      ),
    );
  }

  function renderForm() {
    const p = profiles().find((x) => x.id === editingId);
    if (!p) return form.replaceChildren();
    const refreshList = () => renderList();
    const name = textField({ label: 'Name', value: p.name, onInput: (v) => (patchProfile(p.id, { name: v }), refreshList()) });
    const role = textField({ label: 'Role / tagline', value: p.role, placeholder: 'e.g. Product Designer at Acme', onInput: (v) => patchProfile(p.id, { role: v }) });
    const platform = selectField({ label: 'Badge', options: PLATFORMS, value: p.platform, onChange: (v) => patchProfile(p.id, { platform: v, handle: normalizeHandle(v, profiles().find((x) => x.id === p.id).handle) }) });
    const handle = textField({ label: 'Handle or profile URL', value: p.handle, placeholder: 'Paste linkedin.com/in/you or type in/you', onInput: (v) => patchProfile(p.id, { handle: v }) });
    handle.input.addEventListener('change', () => {
      const detected = detectPlatform(handle.input.value);
      const nextPlatform = detected ?? profiles().find((x) => x.id === p.id).platform;
      const clean = normalizeHandle(nextPlatform, handle.input.value);
      handle.input.value = clean;
      platform.set(nextPlatform);
      patchProfile(p.id, { handle: clean, platform: nextPlatform });
      refreshList();
    });

    const photo = h(
      'div',
      { class: 'people-photo' },
      avatar(p, 88),
      h(
        'div',
        { class: 'people-photo-actions' },
        h('button', { type: 'button', class: 'btn btn-small', onclick: () => choosePhoto(p.id) }, icon('image'), h('span', {}, p.photoAssetId ? 'Change photo' : 'Upload photo')),
        p.photoAssetId ? h('button', { type: 'button', class: 'btn-link', onclick: () => (patchProfile(p.id, { photoAssetId: null }), render()) }, 'Remove photo') : null,
        h('p', { class: 'hint-line' }, 'LinkedIn hides photos behind a login, so upload yours here (saved locally).'),
      ),
    );

    form.replaceChildren(
      photo,
      name.el,
      role.el,
      h('div', { class: 'field-pair' }, platform.el, handle.el),
      h('footer', { class: 'people-foot' }, h('button', { type: 'button', class: 'btn btn-danger', onclick: () => remove(p.id) }, icon('trash'), h('span', {}, 'Delete person')), h('button', { type: 'button', class: 'btn btn-primary', onclick: () => dialog.close() }, 'Done')),
    );
  }

  async function choosePhoto(id) {
    const file = await pickFile();
    if (!file) return;
    try {
      const assetId = await putAsset(file);
      await images.whenReady(`asset:${assetId}`);
      patchProfile(id, { photoAssetId: assetId });
      render();
    } catch (err) {
      toast(err.message || 'Could not use that photo');
    }
  }

  function render() {
    renderList();
    renderForm();
  }

  return {
    open(profileId) {
      editingId = profileId ?? profiles()[0]?.id ?? null;
      render();
      dialog.showModal();
    },
  };
}
