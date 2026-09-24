import { safeFetch, MAX_IMAGE_BYTES } from '../server/unfurl.js';
import { isCrossSite, sendJson, queryParam } from './_shared.js';

/** Streams a remote image through our origin so the canvas can use it without CORS tainting. */
export default async function handler(req, res) {
  if (isCrossSite(req)) return sendJson(res, 403, { error: 'Forbidden' });
  try {
    const { type, body } = await safeFetch(queryParam(req, 'url'), { accept: 'image/avif,image/webp,image/*;q=0.9', maxBytes: MAX_IMAGE_BYTES });
    if (!type.startsWith('image/')) return sendJson(res, 415, { error: 'Not an image' });
    res.statusCode = 200;
    res.setHeader('Content-Type', type.includes('svg') ? 'image/svg+xml' : type);
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.end(body);
  } catch (err) {
    sendJson(res, err.status ?? 502, { error: err.status ? err.message : 'Could not fetch that image' });
  }
}
