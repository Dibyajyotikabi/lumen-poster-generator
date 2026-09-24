// Client helpers for link previews (the server does the fetching, with SSRF protection).
const URL_RE = /^https?:\/\/[^\s]+$/i;
const BARE_DOMAIN_RE = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i;

/** Returns a normalised http(s) URL if the text is a single link, otherwise null. */
export function asLink(text) {
  const value = String(text ?? '').trim();
  if (URL_RE.test(value)) return value;
  if (BARE_DOMAIN_RE.test(value)) return `https://${value}`;
  return null;
}

async function getJson(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export const fetchLinkPreview = (url) => getJson(`/api/unfurl?url=${encodeURIComponent(url)}`);

/** Downloads a remote image through our origin and returns it as a File (or null on failure). */
export async function fetchRemoteImage(url) {
  if (!url) return null;
  const res = await fetch(`/api/image?url=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  const blob = await res.blob();
  return blob.type.startsWith('image/') ? new File([blob], 'link-image', { type: blob.type }) : null;
}
