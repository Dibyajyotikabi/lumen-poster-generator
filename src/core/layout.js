const trimBlankEdges = (lines) => {
  const first = lines.findIndex((l) => l !== '');
  if (first === -1) return [];
  const last = lines.length - 1 - [...lines].reverse().findIndex((l) => l !== '');
  return lines.slice(first, last + 1);
};

/**
 * Greedy word wrap. `measure(str)` returns rendered width. Explicit newlines are respected and
 * blank lines between paragraphs are kept (leading/trailing blanks are dropped).
 */
export function wrapLines(text, maxWidth, measure) {
  const wrapped = String(text)
    .split('\n')
    .map((para) => para.trim().split(/\s+/).filter(Boolean))
    .flatMap((words) => (words.length === 0 ? [''] : wrapWords(words, maxWidth, measure)));
  return trimBlankEdges(wrapped);
}

// Linear-time greedy wrap; builds a fresh local array (no shared state is mutated).
function wrapWords(words, maxWidth, measure) {
  const lines = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Largest font size (binary search) whose wrapped lines fit the box.
 * `measureAt(str, size)` returns width of `str` at `size`.
 */
export function fitText({ text, maxWidth, maxHeight, minSize, maxSize, lineHeight, maxLines, measureAt }) {
  const layoutAt = (size) => wrapLines(text, maxWidth, (s) => measureAt(s, size));
  const fits = (size, lines) =>
    lines.length <= maxLines &&
    lines.length * size * lineHeight <= maxHeight &&
    lines.every((line) => measureAt(line, size) <= maxWidth);

  let lo = Math.floor(minSize);
  let hi = Math.floor(maxSize);
  let best = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const lines = layoutAt(mid);
    if (fits(mid, lines)) {
      best = { size: mid, lines };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best ?? { size: Math.floor(minSize), lines: layoutAt(minSize).slice(0, maxLines) };
}

export function slugify(text, fallback = 'thumbnail') {
  const slug = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}
