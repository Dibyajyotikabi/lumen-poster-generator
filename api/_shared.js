// Helpers shared by the Vercel serverless functions.

/** Only serve requests coming from our own pages (stops hot-linking the proxy from other sites). */
export function isCrossSite(req) {
  const site = req.headers['sec-fetch-site'];
  return Boolean(site) && site !== 'same-origin' && site !== 'none';
}

export function sendJson(res, status, body, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

export const queryParam = (req, name) => new URL(req.url, 'http://localhost').searchParams.get(name) ?? '';
