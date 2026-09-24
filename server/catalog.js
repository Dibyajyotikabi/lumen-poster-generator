// Google Fonts catalogue via the Fontsource API, trimmed to what the app needs.
const FONT_LIST_URL = 'https://api.fontsource.org/v1/fonts';

export async function fetchFontCatalog() {
  const response = await fetch(FONT_LIST_URL, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Font API responded ${response.status}`);
  return (await response.json())
    .filter((f) => f.type === 'google' && f.subsets.includes('latin'))
    .map((f) => ({ id: f.id, family: f.family, category: f.category, weights: f.weights, styles: f.styles, variable: f.variable }));
}
