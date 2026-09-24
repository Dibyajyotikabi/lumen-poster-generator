// Zero-dependency local server: static files + macOS wallpaper + font catalog APIs.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { unfurl, safeFetch, MAX_IMAGE_BYTES } from './unfurl.js';
import { fetchFontCatalog } from './catalog.js';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(os.tmpdir(), 'lumen-cache');
const PORT = Number(process.env.PORT) || 5173;
const HOST = '127.0.0.1';
const SYSTEM_WALLPAPERS = '/System/Library/Desktop Pictures';
const FONT_CACHE_MS = 7 * 24 * 3600 * 1000;
const IMAGE_EXT = /\.(heic|jpe?g|png|tiff?|webp)$/i;
const SIZES = { thumb: 480, full: 2880 };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const exists = (p) => stat(p).then(() => true, () => false);

function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

/* ---------- wallpaper ---------- */

const WALLPAPER_STORE = path.join(os.homedir(), 'Library/Application Support/com.apple.wallpaper/Store/Index.plist');
const OSASCRIPT_TIMEOUT_MS = 2500;
const WALLPAPER_CACHE_MS = 60000;

/** Asks System Events (may need Automation permission — hence the short timeout). */
async function wallpapersFromAppleScript() {
  try {
    const { stdout } = await run('osascript', ['-e', 'tell application "System Events" to get picture of every desktop'], { timeout: OSASCRIPT_TIMEOUT_MS });
    return stdout.split(', ').map((s) => s.trim()).filter(Boolean);
  } catch (err) {
    console.warn('[lumen] osascript unavailable:', err.killed ? 'timed out' : err.message);
    return [];
  }
}

/** Reads macOS's wallpaper store directly; image URLs live inside nested binary plists. */
async function wallpapersFromStore() {
  try {
    const { stdout } = await run('plutil', ['-convert', 'xml1', '-o', '-', WALLPAPER_STORE], { timeout: 5000, maxBuffer: 20 * 1024 * 1024 });
    const blobs = [...stdout.matchAll(/<data>([\s\S]*?)<\/data>/g)].map((m) => Buffer.from(m[1].replace(/\s+/g, ''), 'base64').toString('latin1'));
    const urls = [stdout, ...blobs].flatMap((text) => [...text.matchAll(/file:\/\/[^\x00-\x1f"<>]+?\.(?:heic|jpe?g|png|tiff?|webp)/gi)].map((m) => m[0]));
    return [...new Set(urls)].map((u) => {
      try {
        return fileURLToPath(u);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch (err) {
    console.warn('[lumen] wallpaper store unreadable:', err.message);
    return [];
  }
}

let wallpaperCache = { at: 0, file: null };

async function findCurrentWallpaper() {
  if (Date.now() - wallpaperCache.at < WALLPAPER_CACHE_MS) return wallpaperCache.file;
  const firstExisting = async (list) => {
    for (const candidate of list) if (IMAGE_EXT.test(candidate) && (await exists(candidate))) return candidate;
    return null;
  };
  // The store read is instant; AppleScript is only a fallback because it can stall on a permission prompt.
  const file = (await firstExisting(await wallpapersFromStore())) ?? (await firstExisting(await wallpapersFromAppleScript()));
  wallpaperCache = { at: Date.now(), file };
  return file;
}

async function listSystemWallpapers() {
  try {
    const entries = await readdir(SYSTEM_WALLPAPERS);
    return entries.filter((f) => IMAGE_EXT.test(f)).sort().map((f) => ({ id: f, name: f.replace(IMAGE_EXT, '') }));
  } catch {
    return [];
  }
}

/** Converts any image (incl. HEIC) to a cached JPEG via macOS `sips`. */
async function toJpeg(source, size) {
  const info = await stat(source);
  const key = createHash('sha1').update(`${source}:${info.mtimeMs}:${size}`).digest('hex');
  const out = path.join(CACHE_DIR, `${key}.jpg`);
  if (await exists(out)) return out;
  await mkdir(CACHE_DIR, { recursive: true });
  await run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '86', '-Z', String(size), source, '--out', out]);
  return out;
}

function streamFile(res, file, type) {
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  createReadStream(file).pipe(res);
}

async function handleWallpaper(res, url) {
  const size = SIZES[url.searchParams.get('size')] ?? SIZES.full;
  if (url.pathname === '/api/wallpapers') {
    const current = await findCurrentWallpaper();
    return send(res, 200, {
      current: current ? { name: path.basename(current).replace(IMAGE_EXT, '') } : null,
      library: await listSystemWallpapers(),
    });
  }
  if (url.pathname === '/api/wallpapers/current.jpg') {
    const current = await findCurrentWallpaper();
    if (!current) return send(res, 404, { error: 'Current wallpaper file is not available on disk' });
    return streamFile(res, await toJpeg(current, size), 'image/jpeg');
  }
  const match = /^\/api\/wallpapers\/library\/(.+)\.jpg$/.exec(url.pathname);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const known = await listSystemWallpapers();
    if (!known.some((w) => w.id === id)) return send(res, 404, { error: 'Unknown wallpaper' });
    return streamFile(res, await toJpeg(path.join(SYSTEM_WALLPAPERS, id), size), 'image/jpeg');
  }
  return send(res, 404, { error: 'Not found' });
}

/* ---------- fonts ---------- */

async function handleFonts(res) {
  const file = path.join(CACHE_DIR, 'fonts.json');
  try {
    const info = await stat(file).catch(() => null);
    if (info && Date.now() - info.mtimeMs < FONT_CACHE_MS) {
      return send(res, 200, await readFile(file), MIME['.json'], { 'Cache-Control': 'max-age=3600' });
    }
    const body = JSON.stringify(await fetchFontCatalog());
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, body);
    return send(res, 200, body, MIME['.json'], { 'Cache-Control': 'max-age=3600' });
  } catch (err) {
    console.warn('[lumen] font catalog failed:', err.message);
    if (await exists(file)) return send(res, 200, await readFile(file), MIME['.json']);
    return send(res, 502, { error: 'Font catalog unavailable (offline?)' });
  }
}

/* ---------- links ---------- */

async function handleUnfurl(res, url) {
  try {
    return send(res, 200, await unfurl(url.searchParams.get('url') ?? ''), MIME['.json'], { 'Cache-Control': 'max-age=600' });
  } catch (err) {
    return send(res, err.status ?? 502, { error: err.status ? err.message : 'Could not fetch that link' });
  }
}

/** Streams a remote image through our origin so the canvas can use it (no CORS tainting). */
async function handleImageProxy(res, url) {
  try {
    const { type, body } = await safeFetch(url.searchParams.get('url') ?? '', { accept: 'image/avif,image/webp,image/*;q=0.9', maxBytes: MAX_IMAGE_BYTES });
    if (!type.startsWith('image/')) return send(res, 415, { error: 'Not an image' });
    return send(res, 200, body, type.includes('svg') ? 'image/svg+xml' : type, { 'Cache-Control': 'max-age=3600', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
  } catch (err) {
    return send(res, err.status ?? 502, { error: err.status ? err.message : 'Could not fetch that image' });
  }
}

/* ---------- static ---------- */

async function handleStatic(res, url) {
  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(ROOT, `.${rel}`);
  const blocked = !file.startsWith(ROOT + path.sep) || /\/(\.|node_modules|server)/.test(rel);
  if (blocked) return send(res, 403, 'Forbidden', 'text/plain');
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return send(res, 404, 'Not found', 'text/plain');
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
  try {
    if (url.pathname.startsWith('/api/wallpapers')) return await handleWallpaper(res, url);
    if (url.pathname === '/api/fonts') return await handleFonts(res);
    if (url.pathname === '/api/unfurl') return await handleUnfurl(res, url);
    if (url.pathname === '/api/image') return await handleImageProxy(res, url);
    return await handleStatic(res, url);
  } catch (err) {
    console.error('[lumen] request failed', req.url, err);
    if (!res.headersSent) send(res, 500, { error: 'Internal error' });
  }
});

server.listen(PORT, HOST, () => console.info(`Lumen Studio → http://localhost:${PORT}`));
