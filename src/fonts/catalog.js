// Full Google Fonts catalog (via local server proxy of the Fontsource API).
const FALLBACK = [
  { id: 'geist', family: 'Geist', category: 'sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], styles: ['normal'] },
  { id: 'geist-mono', family: 'Geist Mono', category: 'monospace', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], styles: ['normal'] },
  { id: 'inter', family: 'Inter', category: 'sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], styles: ['normal', 'italic'] },
  { id: 'instrument-serif', family: 'Instrument Serif', category: 'serif', weights: [400], styles: ['normal', 'italic'] },
];

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'sans-serif', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'handwriting', label: 'Script' },
  { id: 'monospace', label: 'Mono' },
];

// Well-loved families float to the top of an unfiltered list.
const FEATURED = ['geist', 'inter-tight', 'instrument-serif', 'fraunces', 'space-grotesk', 'syne', 'bricolage-grotesque', 'playfair-display', 'anton', 'bebas-neue', 'manrope', 'sora', 'dm-serif-display', 'unbounded', 'jetbrains-mono', 'outfit', 'archivo-black', 'cormorant-garamond'];

let fonts = FALLBACK;
let byId = new Map(FALLBACK.map((f) => [f.id, f]));
let loading = null;

export function loadCatalog() {
  if (loading) return loading;
  loading = fetch('/api/fonts')
    .then((res) => {
      if (!res.ok) throw new Error(`Font catalog request failed (${res.status})`);
      return res.json();
    })
    .then((list) => {
      const rank = new Map(FEATURED.map((id, i) => [id, i]));
      fonts = [...list].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999) || a.family.localeCompare(b.family));
      byId = new Map(fonts.map((f) => [f.id, f]));
      return fonts;
    })
    .catch((err) => {
      console.warn('[lumen] using fallback fonts:', err.message);
      return fonts;
    });
  return loading;
}

export const getFont = (id) => byId.get(id) ?? null;
export const availableIds = () => new Set(byId.keys());
export const catalogSize = () => fonts.length;

export function searchFonts(query = '', category = 'all') {
  const q = query.trim().toLowerCase();
  return fonts.filter((f) => (category === 'all' || f.category === category) && (!q || f.family.toLowerCase().includes(q)));
}

/** Closest weight the family actually ships. */
export function nearestWeight(meta, weight) {
  if (!meta?.weights?.length) return Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
  const { weights } = meta;
  return weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), weights[0]);
}
