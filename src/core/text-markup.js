const MARKERS = { '*': 'highlight', '~': 'paper' };

export const stripMarks = (value) => String(value).replace(/[*~]/g, '');

/** Split wrapped lines into drawable runs, keeping styles active across line breaks. */
export function styledLines(lines) {
  const active = { highlight: false, paper: false };
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
        flush();
        active[style] = !active[style];
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
  if (start === end && value.trim()) {
    const word = (char) => char !== undefined && !/[\s*~]/.test(char);
    while (start > 0 && word(value[start - 1])) start -= 1;
    while (end < value.length && word(value[end])) end += 1;
    if (start === end) {
      while (end < value.length && !word(value[end])) end += 1;
      start = end;
      while (end < value.length && word(value[end])) end += 1;
    }
  }
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
