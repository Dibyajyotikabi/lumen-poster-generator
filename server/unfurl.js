// Link unfurling: fetch a public page safely and extract its preview metadata (Open Graph etc.).
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { providerPreview } from './providers.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36 LumenStudio/2';
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 12000;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/* ---------- SSRF protection ---------- */

const PRIVATE_V4 = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const v4ToInt = (ip) => ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;

/** True for loopback, private, link-local, CGNAT, multicast and reserved addresses (v4 and v6). */
export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const value = v4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => (value >>> (32 - bits)) === (v4ToInt(base) >>> (32 - bits)));
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]);
    return lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || /^ff/.test(lower);
  }
  return true;
}

/** Parses and validates a user-supplied URL; resolves DNS and rejects internal targets. */
export async function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw Object.assign(new Error('That doesn’t look like a valid link'), { status: 400 });
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw Object.assign(new Error('Only http(s) links are supported'), { status: 400 });
  if (url.username || url.password) throw Object.assign(new Error('Links with credentials are not allowed'), { status: 400 });
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw Object.assign(new Error('Local addresses are not allowed'), { status: 400 });
  }
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw Object.assign(new Error('Could not find that website'), { status: 400 });
  if (addresses.some((a) => isPrivateAddress(a.address))) throw Object.assign(new Error('Private network addresses are not allowed'), { status: 400 });
  return url;
}

/** fetch with manual redirects (each hop re-validated), a timeout and a byte cap. */
export async function safeFetch(raw, { accept, maxBytes }) {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en;q=0.9,*;q=0.5' },
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url).href);
      continue;
    }
    if (!res.ok) throw Object.assign(new Error(`The site responded ${res.status}`), { status: 502 });
    const declared = Number(res.headers.get('content-length')) || 0;
    if (declared > maxBytes) throw Object.assign(new Error('That file is too large'), { status: 413 });
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        // HTML: the <head> is what we need, so a truncated page is fine. Images must be complete.
        if (accept.startsWith('text/html')) break;
        throw Object.assign(new Error('That file is too large'), { status: 413 });
      }
      chunks.push(value);
    }
    return { url, type: (res.headers.get('content-type') ?? '').toLowerCase(), body: Buffer.concat(chunks) };
  }
  throw Object.assign(new Error('Too many redirects'), { status: 502 });
}

/* ---------- metadata parsing ---------- */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, code) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[code.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

const attr = (tag, name) => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
};

const absolute = (value, base) => {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value), base);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const YOUTUBE_ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i;

/** Extracts preview metadata from HTML. `base` resolves relative URLs. Pure. */
export function parseMeta(html, base) {
  const head = String(html).slice(0, MAX_HTML_BYTES);
  const meta = {};
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attr(tag, 'property') ?? attr(tag, 'name') ?? attr(tag, 'itemprop') ?? '').toLowerCase();
    const content = attr(tag, 'content');
    if (key && content !== null && !(key in meta)) meta[key] = content;
  }
  const icons = [...head.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => ({ rel: (attr(tag, 'rel') ?? '').toLowerCase(), href: attr(tag, 'href'), sizes: attr(tag, 'sizes') ?? '' }))
    .filter((l) => l.href && /icon/.test(l.rel))
    .sort((a, b) => Number(/apple-touch/.test(b.rel)) - Number(/apple-touch/.test(a.rel)) || (parseInt(b.sizes, 10) || 0) - (parseInt(a.sizes, 10) || 0));
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const url = new URL(base);
  const youtube = YOUTUBE_ID.exec(url.href)?.[1];
  const image =
    (youtube && `https://i.ytimg.com/vi/${youtube}/maxresdefault.jpg`) ||
    absolute(meta['og:image:secure_url'] ?? meta['og:image'] ?? meta['og:image:url'] ?? meta['twitter:image'] ?? meta['twitter:image:src'] ?? meta.image, base);
  const theme = decodeEntities(meta['theme-color'] ?? '');
  return {
    url: url.href,
    domain: url.hostname.replace(/^www\./, ''),
    title: decodeEntities(meta['og:title'] ?? meta['twitter:title'] ?? titleTag ?? '') || url.hostname,
    description: decodeEntities(meta['og:description'] ?? meta['twitter:description'] ?? meta.description ?? ''),
    siteName: decodeEntities(meta['og:site_name'] ?? meta['application-name'] ?? ''),
    image,
    fallbackImage: youtube ? `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg` : null,
    icon: absolute(icons[0]?.href, base) ?? new URL('/favicon.ico', base).href,
    themeColor: /^#[0-9a-f]{6}$/i.test(theme) ? theme.toLowerCase() : null,
  };
}

/** Unfurls a link. Direct image links are returned as an image-only preview. */
export async function unfurl(raw) {
  const target = await assertPublicUrl(raw);
  const rich = await providerPreview(target.href, safeFetch);
  if (rich) return rich;
  const { url, type, body } = await safeFetch(raw, { accept: 'text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5', maxBytes: MAX_HTML_BYTES });
  if (type.startsWith('image/')) {
    const name = decodeURIComponent(url.pathname.split('/').pop() || url.hostname);
    return { kind: 'image', url: url.href, domain: url.hostname.replace(/^www\./, ''), title: name, description: '', siteName: '', image: url.href, fallbackImage: null, icon: null, themeColor: null };
  }
  if (!/html|xml/.test(type)) throw Object.assign(new Error('That link isn’t a web page or image'), { status: 415 });
  return { kind: 'article', ...parseMeta(body.toString('utf8'), url.href) };
}
