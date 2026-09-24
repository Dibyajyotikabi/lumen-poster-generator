const MARKERS = { '*': 'highlight', '~': 'paper' };

export const stripMarks = (value) => String(value).replace(/[*~]/g, '');

/** Split wrapped lines into drawable runs, keeping styles active across line breaks. */
export function styledLines(lines) {
  const active = { highlight: false, paper: false };
  const remaining = {
    highlight: lines.join('').split('*').length - 1,
    paper: lines.join('').split('~').length - 1,
  };
  return lines.map((line) => {
    const runs = [];
    let content = '';
    const flush = () => {
      if (content) runs.push({ text: content, ...active });
      content = '';
    };
    for (const char of line) {
      const style = MARKERS[char];
      if (style) {
        remaining[style] -= 1;
        // A stray opener must never paint every later word as paper.
        if (active[style] || remaining[style] > 0) {
          flush();
          active[style] = !active[style];
        }
      } else {
        content += char;
      }
    }
    flush();
    return runs;
  });
}

/** Wrap or unwrap a textarea selection with a visible style marker. */
export function markSelection(value, start, end, marker) {
  if (!Object.hasOwn(MARKERS, marker)) throw new Error('Unknown text marker');
  if (start === end) return { value, start, end };
  if (start > 0 && value[start - 1] === marker && value[end] === marker) {
    return {
      value: value.slice(0, start - 1) + value.slice(start, end) + value.slice(end + 1),
      start: start - 1,
      end: end - 1,
    };
  }
  return {
    value: value.slice(0, start) + marker + value.slice(start, end) + marker + value.slice(end),
    start: start + 1,
    end: end + 1,
  };
}
