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

const SOFT_BREAK = /[/\-_.?&=]/;

/**
 * Splits a word that is wider than the line into pieces that fit, preferring to break right
 * after '/', '-', '_', '.', '?', '&' or '=' (URLs, handles) and otherwise between characters.
 */
export function breakWord(word, maxWidth, measure) {
  const pieces = [];
  let rest = word;
  while (rest && measure(rest) > maxWidth) {
    let cut = 1;
    while (cut < rest.length && measure(rest.slice(0, cut + 1)) <= maxWidth) cut += 1;
    const soft = [...rest.slice(0, cut)].map((c, i) => (SOFT_BREAK.test(c) ? i + 1 : 0)).filter((i) => i >= cut * 0.5).pop();
    const at = soft ?? cut;
    pieces.push(rest.slice(0, at));
    rest = rest.slice(at);
  }
  if (rest) pieces.push(rest);
  return pieces;
}

// Linear-time greedy wrap; builds a fresh local array (no shared state is mutated).
function wrapWords(allWords, maxWidth, measure) {
  const words = allWords.flatMap((w) => (measure(w) > maxWidth ? breakWord(w, maxWidth, measure) : [w]));
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
