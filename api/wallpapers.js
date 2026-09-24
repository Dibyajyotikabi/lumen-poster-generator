import { sendJson } from './_shared.js';

// macOS wallpapers only exist when Lumen runs on your Mac (npm start); the hosted version says so.
export default function handler(req, res) {
  sendJson(res, 200, { current: null, library: [], unsupported: true }, 'public, s-maxage=86400');
}
