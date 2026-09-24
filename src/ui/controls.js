import { h, icon } from './dom.js';

let fieldId = 0;
const nextId = () => `f${(fieldId += 1)}`;

const isFocused = (el) => document.activeElement === el;

/** Every control returns { el, set(value) } so inspectors can re-sync after undo/drag. */

export function slider({ label, min, max, step = 1, value, format = (v) => v, onInput, disabled = false }) {
  const id = nextId();
  const out = h('output', { for: id });
  const input = h('input', { id, type: 'range', min, max, step, disabled });
  const paint = (v) => {
    input.value = v;
    out.textContent = format(Number(v));
    const lo = Number(input.min);
    const hi = Number(input.max);
    const pctFill = hi > lo ? ((Number(input.value) - lo) / (hi - lo)) * 100 : 0;
    input.style.setProperty('--p', `${pctFill}%`);
  };
  input.addEventListener('input', () => {
    paint(Number(input.value));
    onInput(Number(input.value));
  });
  paint(value);
  const el = h('div', { class: 'field' }, h('label', { class: 'field-label', for: id }, h('span', {}, label), out), input);
  return { el, set: (v) => !isFocused(input) && paint(v), input };
}

export function colorField({ label, value, onInput }) {
  const id = nextId();
  const input = h('input', { id, type: 'color', value });
  const code = h('code', {}, value.toUpperCase());
  input.addEventListener('input', () => {
    code.textContent = input.value.toUpperCase();
    onInput(input.value);
  });
  const el = h('label', { class: 'color', for: id }, input, h('span', { class: 'color-meta' }, h('span', {}, label), code));
  return {
    el,
    set: (v) => {
      if (isFocused(input)) return;
      input.value = v;
      code.textContent = v.toUpperCase();
    },
  };
}

export function segmented({ label, options, value, onChange, compact = false }) {
  const name = nextId();
  const inputs = options.map((opt) =>
    h('input', { type: 'radio', name, value: opt.id, checked: opt.id === value, onchange: () => onChange(opt.id) }),
  );
  const group = h(
    'div',
    { class: `seg${compact ? ' seg-compact' : ''}`, role: 'radiogroup', 'aria-label': label },
    options.map((opt, i) => h('label', { title: opt.title ?? opt.label }, inputs[i], h('span', {}, opt.icon ? icon(opt.icon, 15) : opt.label))),
  );
  const el = label ? h('div', { class: 'field' }, h('span', { class: 'field-label' }, label), group) : group;
  return { el, set: (v) => inputs.forEach((input) => (input.checked = input.value === v)) };
}

export function toggle({ label, value, onChange }) {
  const input = h('input', { type: 'checkbox', checked: value, onchange: () => onChange(input.checked) });
  const el = h('label', { class: 'switch' }, input, h('span', { class: 'switch-track' }), h('span', {}, label));
  return { el, set: (v) => (input.checked = Boolean(v)) };
}

export function textField({ label, value, placeholder = '', onInput, multiline = false, rows = 3 }) {
  const id = nextId();
  const input = multiline
    ? h('textarea', { id, rows, placeholder, spellcheck: true })
    : h('input', { id, type: 'text', placeholder, autocomplete: 'off' });
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  const el = h('div', { class: 'field' }, label ? h('label', { class: 'field-label', for: id }, label) : null, input);
  return { el, input, set: (v) => !isFocused(input) && input.value !== v && (input.value = v) };
}

export function selectField({ label, options, value, onChange }) {
  const id = nextId();
  const select = h('select', { id, onchange: () => onChange(select.value) }, options.map((o) => new Option(o.label, o.id)));
  select.value = value;
  const el = h('div', { class: 'field' }, label ? h('label', { class: 'field-label', for: id }, label) : null, select);
  return { el, select, set: (v) => (select.value = v) };
}

export function button({ label, iconName, onClick, variant = '', title }) {
  return h('button', { type: 'button', class: `btn ${variant}`.trim(), onclick: onClick, title: title ?? label, 'aria-label': title ?? label }, iconName ? icon(iconName) : null, label ? h('span', {}, label) : null);
}

export function section(title, ...children) {
  return h('section', { class: 'group' }, h('h3', { class: 'group-title' }, title), ...children);
}

export const pct = (v) => `${Math.round(v * 100)}%`;
