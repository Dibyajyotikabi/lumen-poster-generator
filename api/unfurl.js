import { unfurl } from '../server/unfurl.js';
import { isCrossSite, sendJson, queryParam } from './_shared.js';

export default async function handler(req, res) {
  if (isCrossSite(req)) return sendJson(res, 403, { error: 'Forbidden' });
  try {
    sendJson(res, 200, await unfurl(queryParam(req, 'url')), 'public, s-maxage=3600');
  } catch (err) {
    sendJson(res, err.status ?? 502, { error: err.status ? err.message : 'Could not fetch that link' });
  }
}
