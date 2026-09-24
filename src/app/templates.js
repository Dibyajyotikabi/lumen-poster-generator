import { createTextLayer, createProfileLayer, createElementLayer, DEFAULT_FONT } from './model.js';

const MONO = { id: 'geist-mono', family: 'Geist Mono', weight: 500, italic: false };
const SERIF = { id: 'instrument-serif', family: 'Instrument Serif', weight: 400, italic: true };

const kicker = (text, overrides = {}) =>
  createTextLayer({ text, size: 18, width: 0.5, font: MONO, uppercase: true, tracking: 0.18, opacity: 0.85, box: 'pill', ...overrides });

const body = (text, overrides = {}) =>
  createTextLayer({ text, size: 26, width: 0.62, font: { ...DEFAULT_FONT, weight: 400 }, tracking: 0, lineHeight: 1.4, opacity: 0.66, ...overrides });

const heading = (text, font, overrides = {}) => createTextLayer({ text, size: 140, font, gradient: true, ...overrides });

/**
 * Each template rebuilds the layer stack from the current content so switching layouts
 * never loses what the user typed. `content` = { kicker, headline, subtitle, font }.
 */
export const TEMPLATES = [
  {
    id: 'box-post',
    label: 'Box post',
    build: (c) => [
      createElementLayer('post-card', { width: 0.8, height: 0.78, cy: 0.5 }),
      kicker(c.kicker, { cy: 0.22, color: '#1b1b1f', box: 'none' }),
      heading(c.headline, c.font, { cy: 0.44, size: 104, width: 0.68, gradient: false, color: '#111114' }),
      body(c.subtitle, { cy: 0.66, width: 0.62, color: '#3a3a42', opacity: 0.85 }),
      createElementLayer('rule', { cy: 0.78, width: 0.16, height: 0.03 }),
    ],
  },
  {
    id: 'brutal',
    label: 'Brutal box',
    build: (c) => [
      createElementLayer('brutal-box', { width: 0.8, height: 0.74, cy: 0.5 }),
      createElementLayer('star-burst', { cx: 0.84, cy: 0.2, width: 0.14, height: 0.25, color: '#ff5a8a' }),
      kicker(c.kicker, { cx: 0.45, cy: 0.24, color: '#111111', box: 'none', align: 'left', width: 0.62 }),
      heading(c.headline, c.font, { cx: 0.45, cy: 0.46, size: 100, width: 0.62, align: 'left', gradient: false, color: '#111111' }),
      body(c.subtitle, { cx: 0.45, cy: 0.66, width: 0.62, align: 'left', color: '#111111', opacity: 0.8 }),
    ],
  },
  {
    id: 'headline',
    label: 'Headline',
    build: (c) => [kicker(c.kicker, { cy: 0.27 }), heading(c.headline, c.font, { cy: 0.48 }), body(c.subtitle, { cy: 0.68 })],
  },
  {
    id: 'headline-profile',
    label: 'Headline + me',
    build: (c, [a]) => [kicker(c.kicker, { cy: 0.22 }), heading(c.headline, c.font, { cy: 0.42 }), body(c.subtitle, { cy: 0.6 }), createProfileLayer(a, { cy: 0.84 })],
  },
  {
    id: 'split',
    label: 'Split',
    build: (c, [a]) => [
      kicker(c.kicker, { cx: 0.29, cy: 0.24, width: 0.46, align: 'left' }),
      heading(c.headline, c.font, { cx: 0.33, cy: 0.47, width: 0.54, align: 'left', size: 120 }),
      body(c.subtitle, { cx: 0.33, cy: 0.7, width: 0.54, align: 'left' }),
      createProfileLayer(a, { variant: 'avatar', cx: 0.77, cy: 0.5, scale: 1.7 }),
    ],
  },
  {
    id: 'profile-hero',
    label: 'Profile hero',
    build: (c, [a]) => [kicker(c.kicker, { cy: 0.16 }), createProfileLayer(a, { variant: 'hero', cy: 0.55 })],
  },
  {
    id: 'collab',
    label: 'Collab',
    build: (c, [a, b]) => [
      heading(c.headline, c.font, { cy: 0.3, size: 110 }),
      createProfileLayer(a, { variant: 'card', cx: 0.29, cy: 0.72 }),
      createProfileLayer(b, { variant: 'card', cx: 0.71, cy: 0.72 }),
    ],
  },
  {
    id: 'quote',
    label: 'Quote',
    build: (c, [a]) => [
      createTextLayer({ text: `“${c.headline.replace(/[“”"]/g, '')}”`, size: 84, width: 0.78, cy: 0.44, font: SERIF, tracking: -0.01, lineHeight: 1.08 }),
      createProfileLayer(a, { cy: 0.83 }),
    ],
  },
  {
    id: 'number',
    label: 'Big number',
    build: (c) => [
      createTextLayer({ text: `*${(c.headline.match(/\d+/) ?? ['9'])[0]}*`, size: 420, cy: 0.44, width: 0.9, font: { ...c.font, weight: 800 }, lineHeight: 0.9, gradient: true, effect: 'glow' }),
      kicker(c.headline.replace(/\*/g, ''), { cy: 0.83, width: 0.7 }),
    ],
  },
];

/** Pulls the current kicker/headline/subtitle out of an existing layer stack. */
export function extractContent(layers) {
  const texts = layers.filter((l) => l.type === 'text' && l.text.trim());
  const bySize = [...texts].sort((a, b) => b.size - a.size);
  const main = bySize[0];
  const small = bySize.filter((l) => l !== main);
  const kickerLayer = small.find((l) => l.uppercase || l.box === 'pill');
  const subtitleLayer = small.find((l) => l !== kickerLayer);
  return {
    headline: main?.text ?? 'Your headline',
    font: main?.font ?? DEFAULT_FONT,
    kicker: kickerLayer?.text ?? 'Deep dive',
    subtitle: subtitleLayer?.text ?? 'A short supporting line that explains the idea.',
  };
}
