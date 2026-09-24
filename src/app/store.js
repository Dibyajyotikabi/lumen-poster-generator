import { createDocument, createProfile, sanitizeDocument } from './model.js';

const DOC_KEY = 'lumen:doc:v2';
const PROFILES_KEY = 'lumen:profiles:v2';
const HISTORY_LIMIT = 120;
const COALESCE_MS = 700;
const SAVE_DELAY_MS = 300;

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[lumen] could not read', key, err);
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[lumen] could not save', key, err);
  }
}

function loadProfiles() {
  const saved = readJson(PROFILES_KEY);
  const valid = Array.isArray(saved) ? saved.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string') : [];
  return valid.length ? valid : [createProfile()];
}

/**
 * Single source of truth. Documents are immutable snapshots; every change produces a new doc,
 * which makes undo/redo a matter of keeping references.
 */
export function createStore() {
  const profiles = loadProfiles();
  let state = {
    doc: sanitizeDocument(readJson(DOC_KEY)) ?? createDocument(profiles[0].id),
    profiles,
    selection: null,
    preview: null, // transient override, e.g. hovering a font: { layerId, patch }
  };
  let past = [];
  let future = [];
  let lastCommit = { key: null, at: 0 };
  let saveTimer = 0;
  const listeners = new Set();

  const emit = (reason) => listeners.forEach((fn) => fn(state, reason));

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      writeJson(DOC_KEY, state.doc);
      writeJson(PROFILES_KEY, state.profiles);
    }, SAVE_DELAY_MS);
  }

  /** Replace the document. Changes sharing `key` within a short window merge into one undo step. */
  function commit(nextDoc, { key = null } = {}) {
    if (nextDoc === state.doc) return;
    const now = Date.now();
    const merge = key && key === lastCommit.key && now - lastCommit.at < COALESCE_MS;
    if (!merge) {
      past = [...past, state.doc].slice(-HISTORY_LIMIT);
      future = [];
    }
    lastCommit = { key, at: now };
    const selectionAlive = !state.selection || nextDoc.layers.some((l) => l.id === state.selection);
    state = { ...state, doc: nextDoc, selection: selectionAlive ? state.selection : null };
    scheduleSave();
    emit('doc');
  }

  function travel(from, to) {
    if (!from.length) return false;
    const target = from[from.length - 1];
    const next = { doc: target, rest: from.slice(0, -1), pushed: [...to, state.doc] };
    lastCommit = { key: null, at: 0 };
    state = { ...state, doc: next.doc, selection: next.doc.layers.some((l) => l.id === state.selection) ? state.selection : null };
    scheduleSave();
    emit('doc');
    return next;
  }

  return {
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    commit,
    updateDoc(patch, opts) {
      commit({ ...state.doc, ...patch }, opts);
    },
    updateTheme(patch, opts) {
      commit({ ...state.doc, theme: { ...state.doc.theme, ...patch } }, opts);
    },
    updateBackground(patch, opts) {
      commit({ ...state.doc, background: { ...state.doc.background, ...patch } }, opts);
    },
    updateLayer(id, patch, opts) {
      commit({ ...state.doc, layers: state.doc.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }, opts);
    },
    setLayers(layers, opts) {
      commit({ ...state.doc, layers }, opts);
    },
    select(id) {
      if (id === state.selection) return;
      state = { ...state, selection: id };
      emit('selection');
    },
    setPreview(preview) {
      state = { ...state, preview };
      emit('preview');
    },
    setProfiles(profiles) {
      state = { ...state, profiles };
      scheduleSave();
      emit('profiles');
    },
    undo() {
      const next = travel(past, future);
      if (next) {
        past = next.rest;
        future = next.pushed;
      }
    },
    redo() {
      const next = travel(future, past);
      if (next) {
        future = next.rest;
        past = next.pushed;
      }
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
