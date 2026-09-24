import { createRng } from '../core/random.js';

/**
 * Mood → typographic direction. Font ids are fontsource/Google ids; unknown ids are filtered
 * against the live catalog at runtime.
 */
export const MOODS = {
  tech: {
    label: 'Tech & product',
    words: ['ai', 'ui', 'ux', 'app', 'apps', 'code', 'coding', 'dev', 'tech', 'software', 'api', 'cloud', 'data', 'ios', 'android', 'update', 'launch', 'build', 'product', 'startup', 'gpu', 'cpu', 'chip', 'review', 'pro', 'max', 'beta', 'release', 'version', 'new', 'feature', 'features', 'macos', 'windows', 'web', 'figma', 'react', 'llm', 'agent', 'agents', 'samsung', 'apple', 'google', 'pixel', 'iphone', 'galaxy', 'one'],
    heading: ['geist', 'inter-tight', 'space-grotesk', 'manrope', 'sora', 'plus-jakarta-sans', 'outfit', 'unbounded', 'archivo', 'onest', 'schibsted-grotesk'],
    body: ['geist', 'inter', 'dm-sans', 'manrope'],
    palettes: ['ink', 'ocean', 'cobalt', 'mono', 'frost'],
    styles: ['aura', 'grid', 'eclipse', 'spotlight', 'rings', 'blobs'],
  },
  bold: {
    label: 'Bold & punchy',
    words: ['breaking', 'news', 'top', 'best', 'worst', 'how', 'why', 'secret', 'secrets', 'truth', 'insane', 'ultimate', 'vs', 'shocking', 'must', 'stop', 'never', 'fastest', 'biggest', 'huge', 'killer', 'finally', 'dead', 'wow', 'crazy', 'mistakes', 'every', 'nobody'],
    heading: ['anton', 'bebas-neue', 'archivo-black', 'oswald', 'league-gothic', 'big-shoulders-display', 'barlow-condensed', 'unbounded', 'bricolage-grotesque'],
    body: ['inter', 'barlow', 'archivo'],
    palettes: ['ember', 'mono', 'ink', 'lime'],
    styles: ['rays', 'spotlight', 'eclipse', 'rings'],
  },
  elegant: {
    label: 'Elegant & editorial',
    words: ['luxury', 'beauty', 'fashion', 'wedding', 'art', 'story', 'stories', 'life', 'love', 'style', 'interior', 'poetry', 'journey', 'dream', 'elegant', 'editorial', 'studio', 'collection', 'minimal', 'minimalism', 'aesthetic', 'craft', 'portfolio', 'gallery'],
    heading: ['instrument-serif', 'playfair-display', 'cormorant-garamond', 'dm-serif-display', 'fraunces', 'bodoni-moda', 'italiana', 'gloock', 'young-serif'],
    body: ['inter', 'dm-sans', 'geist', 'jost'],
    palettes: ['paper', 'sand', 'plum', 'rose'],
    styles: ['plain', 'mesh', 'spotlight', 'aurora'],
  },
  editorial: {
    label: 'Thoughtful & long-form',
    words: ['essay', 'notes', 'thoughts', 'lessons', 'learned', 'book', 'books', 'reading', 'history', 'guide', 'deep', 'dive', 'analysis', 'opinion', 'letter', 'chapter', 'weekly', 'newsletter', 'why', 'think', 'thinking', 'ideas', 'principles', 'framework'],
    heading: ['fraunces', 'newsreader', 'literata', 'source-serif-4', 'libre-caslon-text', 'eb-garamond', 'instrument-serif'],
    body: ['source-sans-3', 'inter', 'ibm-plex-sans'],
    palettes: ['paper', 'sand', 'frost', 'ink'],
    styles: ['plain', 'grid', 'spotlight', 'dots'],
  },
  playful: {
    label: 'Playful & friendly',
    words: ['fun', 'kids', 'game', 'games', 'gaming', 'party', 'happy', 'easy', 'hack', 'hacks', 'tips', 'cute', 'weekend', 'food', 'recipe', 'diy', 'cool', 'lol', 'vlog', 'challenge', 'play', 'summer'],
    heading: ['fredoka', 'baloo-2', 'bricolage-grotesque', 'lilita-one', 'rubik', 'chewy', 'sniglet', 'grandstander'],
    body: ['nunito', 'rubik', 'quicksand'],
    palettes: ['plum', 'lime', 'ember', 'rose'],
    styles: ['mesh', 'dots', 'waves', 'blobs'],
  },
  retro: {
    label: 'Retro & synth',
    words: ['retro', 'vintage', '80s', '90s', 'classic', 'old', 'synth', 'synthwave', 'arcade', 'pixel', 'film', 'analog', 'cassette', 'nostalgia', 'y2k'],
    heading: ['monoton', 'righteous', 'bungee', 'shrikhand', 'rubik-mono-one', 'press-start-2p', 'vt323', 'audiowide'],
    body: ['space-mono', 'ibm-plex-mono', 'jetbrains-mono'],
    palettes: ['ember', 'plum', 'midnight'],
    styles: ['rings', 'rays', 'dots', 'waves'],
  },
  nature: {
    label: 'Calm & natural',
    words: ['nature', 'green', 'travel', 'earth', 'forest', 'ocean', 'sea', 'mountain', 'mountains', 'calm', 'mindful', 'mindfulness', 'yoga', 'health', 'wellness', 'organic', 'sustainable', 'climate', 'garden', 'sleep', 'slow'],
    heading: ['dm-serif-display', 'lora', 'cormorant-garamond', 'josefin-sans', 'quicksand', 'young-serif'],
    body: ['nunito', 'lora', 'dm-sans'],
    palettes: ['moss', 'ocean', 'sand'],
    styles: ['aurora', 'waves', 'mesh', 'blobs'],
  },
  finance: {
    label: 'Business & money',
    words: ['money', 'finance', 'stock', 'stocks', 'invest', 'investing', 'crypto', 'bitcoin', 'market', 'markets', 'economy', 'revenue', 'growth', 'business', 'salary', 'tax', 'profit', 'income', 'wealth', 'career', 'job', 'jobs', 'hiring', 'interview', 'resume'],
    heading: ['ibm-plex-sans', 'inter-tight', 'manrope', 'sora', 'dm-sans', 'space-grotesk', 'instrument-sans'],
    body: ['inter', 'ibm-plex-sans', 'dm-sans'],
    palettes: ['moss', 'ink', 'frost', 'cobalt'],
    styles: ['grid', 'eclipse', 'rings', 'aura'],
  },
};

const DEFAULT_MOOD = 'tech';
const tokenize = (text) => String(text).toLowerCase().match(/[a-z0-9$₹€%]+/g) ?? [];

/** Scores each mood for the text. Returns [{ id, score }] best first. */
export function analyzeMood(text) {
  const tokens = tokenize(text);
  const words = new Set(tokens);
  const hasDigits = /\d/.test(text);
  const scores = Object.entries(MOODS).map(([id, mood]) => {
    const hits = mood.words.filter((w) => words.has(w)).length;
    let score = hits * 2;
    if (id === 'tech' && hasDigits) score += 0.8;
    if (id === 'bold' && (/[!?]/.test(text) || tokens.length <= 3)) score += 0.7;
    if (id === 'finance' && /[$₹€%]/.test(text)) score += 2;
    if (id === 'editorial' && tokens.length > 8) score += 1;
    if (id === DEFAULT_MOOD) score += 0.1;
    return { id, score };
  });
  return scores.sort((a, b) => b.score - a.score);
}

const pickFrom = (list, rng, available) => {
  const pool = available ? list.filter((id) => available.has(id)) : list;
  const source = pool.length ? pool : list;
  return source[Math.floor(rng() * source.length)];
};

/**
 * A complete art direction for the text. `seed` cycles variations; `available` (Set of font ids)
 * restricts picks to fonts present in the catalog.
 */
export function suggestDirection(text, seed = 1, available = null) {
  const ranked = analyzeMood(text);
  const top = ranked.filter((m) => m.score >= ranked[0].score - 0.5);
  const rng = createRng(seed);
  const moodId = top[Math.floor(rng() * top.length)].id;
  const mood = MOODS[moodId];
  return {
    mood: moodId,
    moodLabel: mood.label,
    heading: pickFrom(mood.heading, rng, available),
    body: pickFrom(mood.body, rng, available),
    palette: pickFrom(mood.palettes, rng),
    style: pickFrom(mood.styles, rng),
  };
}

/** Font ids that suit the text, best mood first. */
export function suggestFonts(text, available = null, limit = 10) {
  const ids = analyzeMood(text)
    .slice(0, 3)
    .flatMap(({ id }) => MOODS[id].heading);
  const unique = [...new Set(ids)].filter((id) => !available || available.has(id));
  return unique.slice(0, limit);
}
