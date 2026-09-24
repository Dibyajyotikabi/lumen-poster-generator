import { fetchFontCatalog } from '../server/catalog.js';
import { sendJson } from './_shared.js';

export default async function handler(req, res) {
  try {
    sendJson(res, 200, await fetchFontCatalog(), 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
  } catch (err) {
    console.error('[lumen] font catalog failed', err);
    sendJson(res, 502, { error: 'Font catalog unavailable' });
  }
}
