import { isHex } from '../core/color.js';

export const BASE_UNIT = 720;

export const SIZES = {
  youtube: { label: 'YouTube thumbnail', width: 1280, height: 720 },
  blog: { label: 'Blog featured / OG', width: 1200, height: 630 },
  x: { label: 'X / Twitter post', width: 1600, height: 900 },
  square: { label: 'Square post', width: 1080, height: 1080 },
  portrait: { label: 'Portrait post', width: 1080, height: 1350 },
  story: { label: 'Story / Reel', width: 1080, height: 1920 },
  banner: { label: 'LinkedIn banner', width: 1584, height: 396 },
  linkedin: { label: 'LinkedIn post', width: 1200, height: 627 },
  custom: { label: 'Custom size', width: 1280, height: 720 },
};

export const STYLES = [
  { id: 'aura', label: 'Aura' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'rays', label: 'Rays' },
  { id: 'eclipse', label: 'Eclipse' },
  { id: 'blobs', label: 'Blur' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'waves', label: 'Waves' },
  { id: 'rings', label: 'Rings' },
  { id: 'dots', label: 'Halftone' },
  { id: 'grid', label: 'Grid' },
  { id: 'mesh', label: 'Mesh' },
  { id: 'plain', label: 'Plain' },
];

export const PALETTES = [
  { id: 'ink', label: 'Ink', bg: '#0b0b10', text: '#f4f3ef', accent: '#6f86ff' },
  { id: 'ember', label: 'Ember', bg: '#110806', text: '#fff3ea', accent: '#ff6a2b' },
  { id: 'moss', label: 'Moss', bg: '#0a120d', text: '#eef4e8', accent: '#8fe07a' },
  { id: 'plum', label: 'Plum', bg: '#130a18', text: '#f8eefc', accent: '#c36bff' },
  { id: 'ocean', label: 'Ocean', bg: '#04121a', text: '#e8f6fb', accent: '#2ec5e8' },
  { id: 'cobalt', label: 'Cobalt', bg: '#050b24', text: '#eef2ff', accent: '#3d6bff' },
  { id: 'midnight', label: 'Midnight', bg: '#0d0221', text: '#fdf0ff', accent: '#ff3cac' },
  { id: 'lime', label: 'Lime', bg: '#0c0d08', text: '#f6f7ee', accent: '#d4ff3a' },
  { id: 'mono', label: 'Mono', bg: '#050505', text: '#ffffff', accent: '#bdbdbd' },
  { id: 'paper', label: 'Paper', bg: '#f3efe6', text: '#191813', accent: '#e0572a' },
  { id: 'frost', label: 'Frost', bg: '#eef2f8', text: '#0d1424', accent: '#4f7dff' },
  { id: 'sand', label: 'Sand', bg: '#e8ddcb', text: '#2a2018', accent: '#b8743a' },
  { id: 'rose', label: 'Rose', bg: '#f7e9ea', text: '#2a1216', accent: '#e0467c' },
];

export const TEXT_EFFECTS = [
  { id: 'none', label: 'None' },
  { id: 'shadow', label: 'Shadow' },
  { id: 'glow', label: 'Glow' },
  { id: 'outline', label: 'Outline' },
  { id: 'extrude', label: '3D' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'voxel', label: 'Voxel' },
];

export const TEXT_BOXES = [
  { id: 'none', label: 'None' },
  { id: 'pill', label: 'Pill' },
  { id: 'block', label: 'Marker' },
];

export const PAPER_STYLES = [
  { id: 'torn', label: 'Torn' },
  { id: 'notebook', label: 'Notebook' },
  { id: 'tape', label: 'Tape' },
  { id: 'newsprint', label: 'Newsprint' },
  { id: 'dark', label: 'Dark' },
];

export const EDITORIAL_ELEMENTS = [
  { id: 'bar', label: 'Accent bar' },
  { id: 'rule', label: 'Rule + dot' },
  { id: 'number', label: 'Number badge' },
  { id: 'quote', label: 'Quote marks' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'dots', label: 'Halftone dots' },
  { id: 'voxels', label: 'Voxel blocks' },
  { id: 'bracket', label: 'Frame corners' },
];

export const PROFILE_VARIANTS = [
  { id: 'chip', label: 'Chip' },
  { id: 'card', label: 'Card' },
  { id: 'hero', label: 'Hero' },
  { id: 'avatar', label: 'Avatar' },
];

export const DEFAULT_FONT = { id: 'geist', family: 'Geist', weight: 700, italic: false };

let counter = 0;
export const uid = (prefix = 'l') => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createTextLayer(overrides = {}) {
  return {
    id: uid('t'),
    type: 'text',
    visible: true,
    locked: false,
    text: 'Your headline',
    cx: 0.5,
    cy: 0.5,
    width: 0.8,
    size: 110,
    autoFit: false,
    font: { ...DEFAULT_FONT },
    color: null, // null → follows theme text colour
    align: 'center',
    lineHeight: 1.04,
    tracking: -0.03,
    uppercase: false,
    opacity: 1,
    gradient: false,
    effect: 'none',
    effectColor: null, // null → theme accent
    box: 'none',
    highlight: null, // null → theme accent
    paperColor: '#f4ead5',
    paperStyle: 'torn',
    ...overrides,
  };
}

export function createElementLayer(variant = 'bar', overrides = {}) {
  const placement = {
    bar: { cy: 0.72 },
    rule: { cy: 0.78 },
    number: { cx: 0.18, cy: 0.23 },
    quote: { cx: 0.2, cy: 0.27 },
    arrow: { cx: 0.78, cy: 0.76 },
    dots: { cx: 0.78, cy: 0.8 },
    voxels: { cx: 0.8, cy: 0.76 },
  }[variant] ?? {};
  return {
    id: uid('e'),
    type: 'element',
    visible: true,
    locked: false,
    variant,
    text: variant === 'number' ? '01' : '',
    cx: 0.5,
    cy: 0.5,
    width: variant === 'quote' || variant === 'number' ? 0.14 : 0.35,
    height: variant === 'bar' || variant === 'rule' ? 0.035 : 0.16,
    color: null,
    opacity: 1,
    ...placement,
    ...overrides,
  };
}

export function createProfileLayer(profileId, overrides = {}) {
  return {
    id: uid('p'),
    type: 'profile',
    visible: true,
    locked: false,
    profileId,
    variant: 'chip',
    cx: 0.5,
    cy: 0.85,
    scale: 1,
    ...overrides,
  };
}

export function createImageLayer(assetId, overrides = {}) {
  return {
    id: uid('i'),
    type: 'image',
    visible: true,
    locked: false,
    assetId,
    cx: 0.5,
    cy: 0.5,
    width: 0.3,
    radius: 0.06,
    opacity: 1,
    shadow: true,
    ...overrides,
  };
}

export const LINK_VARIANTS = {
  tweet: [{ id: 'tweet', label: 'Post' }],
  video: [
    { id: 'video', label: 'Video' },
    { id: 'hero', label: 'Hero' },
    { id: 'card', label: 'Card' },
    { id: 'compact', label: 'Compact' },
    { id: 'minimal', label: 'Pill' },
  ],
  article: [
    { id: 'card', label: 'Card' },
    { id: 'hero', label: 'Hero' },
    { id: 'compact', label: 'Compact' },
    { id: 'minimal', label: 'Pill' },
  ],
};

export const CARD_THEMES = [
  { id: 'auto', label: 'Glass' },
  { id: 'light', label: 'Light' },
  { id: 'dim', label: 'Dim' },
  { id: 'dark', label: 'Dark' },
];

export const DEFAULT_LINK_VARIANT = { tweet: 'tweet', video: 'video', article: 'card', image: 'hero' };

export function createLinkLayer(preview, overrides = {}) {
  return {
    id: uid('k'),
    type: 'link',
    visible: true,
    locked: false,
    kind: preview.kind ?? 'article',
    url: preview.url,
    domain: preview.domain,
    author: preview.author ?? null,
    tweet: preview.tweet ? { ...preview.tweet, author: { ...preview.tweet.author, avatar: undefined } } : null,
    avatarAssetId: null,
    mediaAssetIds: [],
    cardTheme: preview.kind === 'tweet' ? 'light' : 'auto',
    showStats: true,
    showDate: true,
    showMedia: true,
    siteName: preview.siteName ?? '',
    title: preview.title ?? preview.domain,
    description: preview.description ?? '',
    imageAssetId: null,
    iconAssetId: null,
    variant: DEFAULT_LINK_VARIANT[preview.kind] ?? 'card',
    showDescription: true,
    cx: 0.5,
    cy: 0.5,
    width: 0.46,
    ...overrides,
  };
}

export function createProfile(overrides = {}) {
  return {
    id: uid('pr'),
    name: 'Dibyajyoti Kabi',
    role: 'Design & Technology',
    platform: 'linkedin',
    handle: 'in/dibyajyotikabi',
    photoAssetId: null,
    ...overrides,
  };
}

export function createDocument(profileId) {
  return {
    version: 2,
    size: 'youtube',
    custom: { width: 1280, height: 720 },
    theme: { bg: '#0b0b10', text: '#f4f3ef', accent: '#6f86ff' },
    background: {
      source: 'generated', // generated | wallpaper | library | upload
      style: 'aura',
      seed: 20260924,
      intensity: 0.85,
      grain: 0.3,
      vignette: 0.35,
      libraryId: null,
      assetId: null,
      blur: 0,
      dim: 0.25,
      zoom: 1,
      effectOnImage: false,
    },
    layers: [
      createTextLayer({ text: 'Deep dive', cy: 0.25, width: 0.5, size: 18, font: { id: 'geist-mono', family: 'Geist Mono', weight: 500, italic: false }, uppercase: true, tracking: 0.18, opacity: 0.85, box: 'pill' }),
      createTextLayer({ text: 'One UI *9*', cy: 0.45, size: 150, gradient: true }),
      createTextLayer({ text: 'Everything new, what’s gone, and what actually matters.', cy: 0.62, width: 0.62, size: 26, font: { ...DEFAULT_FONT, weight: 400 }, tracking: 0, lineHeight: 1.4, opacity: 0.66 }),
      createProfileLayer(profileId, { cy: 0.855 }),
    ],
  };
}

export function docSize(doc) {
  return doc.size === 'custom' ? doc.custom : SIZES[doc.size] ?? SIZES.youtube;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clampNum = (v, min, max, fallback) => (isNum(v) ? Math.min(max, Math.max(min, v)) : fallback);

/** Validates a document loaded from storage; returns null when unusable. */
export function sanitizeDocument(input) {
  if (!input || input.version !== 2 || !Array.isArray(input.layers)) return null;
  const theme = input.theme ?? {};
  if (![theme.bg, theme.text, theme.accent].every(isHex)) return null;
  const layers = input.layers
    .filter((l) => l && typeof l.id === 'string' && ['text', 'profile', 'image', 'link', 'element'].includes(l.type))
    .map((l) => l.type === 'text' && l.box === 'paper' ? { ...l, box: 'none' } : l);
  const custom = {
    width: Math.round(clampNum(input.custom?.width, 64, 4096, 1280)),
    height: Math.round(clampNum(input.custom?.height, 64, 4096, 720)),
  };
  return {
    ...input,
    size: Object.hasOwn(SIZES, input.size) ? input.size : 'youtube',
    custom,
    layers,
  };
}
