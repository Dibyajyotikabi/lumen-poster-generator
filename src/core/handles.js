export const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X / Twitter' },
  { id: 'github', label: 'GitHub' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'website', label: 'Website' },
  { id: 'none', label: 'No badge' },
];

const URL_PATTERNS = {
  linkedin: /linkedin\.com\/(in|company)\/([^/?#\s]+)/i,
  x: /(?:x|twitter)\.com\/([^/?#\s]+)/i,
  github: /github\.com\/([^/?#\s]+)/i,
  youtube: /youtube\.com\/(@[^/?#\s]+|c\/[^/?#\s]+|channel\/[^/?#\s]+)/i,
  instagram: /instagram\.com\/([^/?#\s]+)/i,
};

/** Detects the platform from a pasted profile URL, or null. */
export function detectPlatform(input) {
  const found = Object.entries(URL_PATTERNS).find(([, re]) => re.test(String(input)));
  return found ? found[0] : null;
}

/** Turns a pasted URL or raw handle into a clean display handle for the given platform. */
export function normalizeHandle(platform, input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const match = URL_PATTERNS[platform]?.exec(raw);
  if (platform === 'linkedin' && match) return `${match[1].toLowerCase()}/${decodeURIComponent(match[2])}`;
  if (platform === 'youtube' && match) return match[1].startsWith('@') ? match[1] : `youtube.com/${match[1]}`;
  if (match) return `@${decodeURIComponent(match[1])}`;
  if (platform === 'website') return raw.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  if (['x', 'github', 'instagram'].includes(platform) && !raw.startsWith('@') && /^[\w.-]+$/.test(raw)) return `@${raw}`;
  return raw;
}
