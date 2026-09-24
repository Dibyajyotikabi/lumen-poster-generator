import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapLines, fitText, fitTextBlock, slugify } from '../src/core/layout.js';
import { hexToRgb, rgbToHex, mix, isDark, shiftHue, hexToHsl, isHex, luminance } from '../src/core/color.js';
import { createRng } from '../src/core/random.js';
import { normalizeHandle, detectPlatform } from '../src/core/handles.js';
import { extractPalette } from '../src/core/extract-palette.js';
import { analyzeMood, suggestDirection, suggestFonts, MOODS } from '../src/fonts/suggest.js';
import { nearestWeight } from '../src/fonts/catalog.js';
import { createDocument, createTextLayer, createElementLayer, EDITORIAL_ELEMENTS, sanitizeDocument, docSize, SIZES } from '../src/app/model.js';
import { TEMPLATES, extractContent } from '../src/app/templates.js';
import { drawText, layoutText } from '../src/render/text.js';
import { textFitBounds } from '../src/render/renderer.js';
import { drawEditorialElement } from '../src/render/editorial-elements.js';
import { drawPaper } from '../src/render/paper.js';
import { markSelection, stripMarks, styledLines } from '../src/core/text-markup.js';

// Fake metric: every character is half the font size wide.
const measureAt = (str, size) => str.length * size * 0.5;

/* ---------- layout ---------- */

test('wrapLines breaks on width and respects explicit newlines', () => {
  const measure = (s) => s.length * 10;
  assert.deepEqual(wrapLines('one two three', 70, measure), ['one two', 'three']);
  assert.deepEqual(wrapLines('a\nb', 1000, measure), ['a', 'b']);
  assert.deepEqual(wrapLines('   ', 100, measure), []);
});

test('wrapLines keeps blank lines between paragraphs but trims the edges', () => {
  const measure = (s) => s.length;
  assert.deepEqual(wrapLines('\n\nfirst\n\nsecond\n\n', 100, measure), ['first', '', 'second']);
});

test('wrapLines handles very long text quickly', () => {
  const text = Array.from({ length: 20000 }, (_, i) => `word${i}`).join(' ');
  const started = performance.now();
  const lines = wrapLines(text, 400, (s) => s.length * 8);
  assert.ok(lines.length > 1000);
  assert.ok(performance.now() - started < 1000);
});

test('fitText returns the largest size that fits the box', () => {
  const fit = fitText({ text: 'One UI 9', maxWidth: 400, maxHeight: 120, minSize: 10, maxSize: 300, lineHeight: 1, maxLines: 4, measureAt });
  assert.equal(fit.lines.length, 1);
  assert.equal(fit.size, 100);
});

test('fitText falls back to minSize when nothing fits', () => {
  const fit = fitText({ text: 'x'.repeat(50), maxWidth: 10, maxHeight: 10, minSize: 12, maxSize: 40, lineHeight: 1, maxLines: 1, measureAt });
  assert.equal(fit.size, 12);
});

test('fitTextBlock keeps long text within the available height without dropping words', () => {
  const text = 'A longer paragraph needs room to breathe while keeping every word visible in the final poster.';
  const fit = fitTextBlock({ text, maxWidth: 180, maxHeight: 120, maxSize: 60, lineHeight: 1.16, measureAt });
  assert.ok(fit.size < 60);
  assert.ok(fit.lines.length * fit.size * 1.16 <= 120);
  assert.equal(fit.lines.join(' '), text);
  assert.ok(fit.lines.every((line) => measureAt(line, fit.size) <= 180));
});

test('fitTextBlock balances a short final line without changing the line count', () => {
  const text = 'The quick brown fox jumps over the lazy dog';
  const greedy = wrapLines(text, 22, (s) => s.length);
  const fit = fitTextBlock({ text, maxWidth: 22, maxHeight: 10, maxSize: 1, lineHeight: 1, measureAt: (s, size) => s.length * size });
  assert.equal(fit.lines.length, greedy.length);
  assert.equal(fit.lines.join(' '), text);
  assert.ok(fit.lines.at(-1).length > greedy.at(-1).length);
});

test('auto-fit text stays inside the canvas even near an edge', async () => {
  const previousDocument = globalThis.document;
  const previousFontFace = globalThis.FontFace;
  globalThis.document = { fonts: { add() {} } };
  globalThis.FontFace = class { load() { return Promise.resolve(this); } };
  try {
    const ctx = {
      font: '',
      letterSpacing: '0px',
      measureText(value) {
        const size = Number(this.font.match(/([\d.]+)px/)[1]);
        return { width: value.length * (size * 0.5 + Number.parseFloat(this.letterSpacing)) };
      },
    };
    const layer = createTextLayer({
      text: 'A long passage should remain safely inside the poster even when its anchor sits near a corner.',
      autoFit: true,
      size: 110,
      width: 1.5,
      cx: 0.95,
      cy: 0.95,
    });
    const fitted = layoutText(ctx, layer, 1280, 720, 1);
    assert.ok(fitted.box.x >= 1280 * 0.06);
    assert.ok(fitted.box.x + fitted.box.w <= 1280 * 0.94 + 0.001);
    assert.ok(fitted.box.y >= 720 * 0.07);
    assert.ok(fitted.box.y + fitted.box.h <= 720 * 0.93 + 0.001);
    assert.equal(fitted.lines.join(' '), layer.text);
  } finally {
    await Promise.resolve();
    globalThis.document = previousDocument;
    globalThis.FontFace = previousFontFace;
  }
});

test('auto-fit reserves space for neighboring layers in the same column', () => {
  const headline = createTextLayer({ cx: 0.5, cy: 0.45, width: 0.8, autoFit: true });
  const kicker = createTextLayer({ cx: 0.5, cy: 0.25, width: 0.5 });
  const subtitle = createTextLayer({ cx: 0.5, cy: 0.62, width: 0.62 });
  const side = createTextLayer({ cx: 0.95, cy: 0.46, width: 0.05 });
  const bounds = textFitBounds(headline, [kicker, headline, subtitle, side], 720);
  assert.ok(Math.abs(bounds.top - 252) < 0.001);
  assert.ok(Math.abs(bounds.bottom - 385.2) < 0.001);
  const cramped = textFitBounds(headline, [
    { ...kicker, cy: 0.48 }, headline, { ...subtitle, cy: 0.42 },
  ], 720);
  assert.ok(cramped.bottom - cramped.top < 720 * 0.12);
});

test('paper and accent markers preserve visible words across wrapped lines', () => {
  assert.equal(stripMarks('A *bright* ~paper strip~'), 'A bright paper strip');
  const runs = styledLines(['A ~paper', 'strip~ and *bright', 'words*']);
  assert.deepEqual(runs[0].at(-1), { text: 'paper', highlight: false, paper: true });
  assert.deepEqual(runs[1][0], { text: 'strip', highlight: false, paper: true });
  assert.deepEqual(runs[2][0], { text: 'words', highlight: true, paper: false });
  const stray = styledLines(['A ~stray marker', 'cannot style later words']);
  assert.ok(stray.flat().every((run) => !run.paper));
});

test('style buttons wrap and unwrap the selected phrase', () => {
  const marked = markSelection('A paper idea', 2, 7, '~');
  assert.equal(marked.value, 'A ~paper~ idea');
  assert.deepEqual([marked.start, marked.end], [3, 8]);
  assert.deepEqual(markSelection(marked.value, marked.start, marked.end, '~'), { value: 'A paper idea', start: 2, end: 7 });
  assert.deepEqual(markSelection('Title', 5, 5, '*'), { value: 'Title', start: 5, end: 5 });
  assert.deepEqual(markSelection('One good idea', 5, 5, '~'), { value: 'One good idea', start: 5, end: 5 });
  assert.equal(markSelection('extraordinary', 5, 8, '~').value, 'extra~ord~inary');
});

test('paper renders behind only explicitly marked text, including legacy paper layers', () => {
  const painted = [];
  let sheets = 0;
  const ctx = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    fill() {}, stroke() {}, clip() {}, fillRect() {}, arc() {},
    createLinearGradient() { sheets += 1; return { addColorStop() {} }; },
    fillText(value) { painted.push([value, this.fillStyle]); },
    measureText(value) { return { width: value.length * 10 }; },
  };
  const layout = (line) => ({
    face: { family: 'Geist', weight: 700, style: 'normal' },
    size: 30, lineH: 38, lines: [line], runs: styledLines([line]),
    widths: [stripMarks(line).length * 10], box: { x: 0, y: 0, w: 500, h: 38 },
  });
  const layer = createTextLayer({ box: 'paper', effect: 'none' });
  const theme = { text: '#ffffff', accent: '#ff9900', bg: '#101010' };
  drawText(ctx, layer, layout('plain ~selected~ tail'), theme, 1);
  assert.equal(sheets, 1);
  assert.deepEqual(painted, [['plain ', '#ffffff'], ['selected', '#222027'], [' tail', '#ffffff']]);
  painted.length = 0;
  drawText(ctx, layer, layout('plain text'), theme, 1);
  assert.equal(sheets, 1);
  assert.deepEqual(painted, [['plain text', '#ffffff']]);
});

test('paper and display effects paint styled text without marker glyphs', () => {
  const painted = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    fill() {}, stroke() {}, clip() {}, fillRect() {}, arc() {},
    createLinearGradient() { return { addColorStop() {} }; },
    fillText(value) { painted.push(value); }, strokeText(value) { painted.push(value); },
    measureText(value) { return { width: value.length * 12 }; },
  };
  const line = 'A ~paper strip~ with *accent*';
  const layout = {
    face: { family: 'Geist', weight: 700, style: 'normal' },
    size: 30, lineH: 38, lines: [line], runs: styledLines([line]),
    widths: [stripMarks(line).length * 12], box: { x: 20, y: 20, w: 500, h: 38 },
  };
  const theme = { text: '#ffffff', accent: '#ff9900', bg: '#101010' };
  for (const effect of ['editorial', 'voxel']) {
    drawText(ctx, createTextLayer({ text: line, box: 'paper', effect }), layout, theme, 1);
  }
  assert.ok(painted.includes('paper strip'));
  assert.ok(painted.every((value) => !/[*~]/.test(value)));
});

test('paper finishes draw deterministic torn edges and distinct textures', () => {
  const events = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, clip() {}, fill() {},
    moveTo(x, y) { events.push(['move', x, y]); },
    lineTo(x, y) { events.push(['line', x, y]); },
    stroke() { events.push(['stroke']); },
    fillRect() { events.push(['rect']); },
    arc() { events.push(['dot']); },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  const draw = (style) => {
    events.length = 0;
    drawPaper(ctx, { x: 0, y: 0, w: 180, h: 64, color: '#f4ead5', ink: '#222027', style, seed: 7, u: 1 });
    return [...events];
  };
  assert.deepEqual(draw('torn'), draw('torn'));
  assert.ok(draw('notebook').filter(([kind]) => kind === 'stroke').length > draw('torn').filter(([kind]) => kind === 'stroke').length);
  assert.ok(draw('newsprint').some(([kind]) => kind === 'dot'));
  assert.ok(draw('tape').some(([kind]) => kind === 'rect'));
});

test('all Vox-style elements paint and keep editable canvas bounds', () => {
  const painted = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, arc() {}, fillRect() {}, fillText(value) { painted.push(value); },
  };
  const theme = { accent: '#6f86ff' };
  for (const { id } of EDITORIAL_ELEMENTS) {
    const layer = createElementLayer(id);
    const box = drawEditorialElement(ctx, layer, { W: 1280, H: 720, u: 1, theme });
    assert.ok(box.w > 0 && box.h > 0 && Number.isFinite(box.x) && Number.isFinite(box.y), id);
  }
  assert.ok(painted.includes('01'));
  assert.equal(createElementLayer('bar').cy, 0.72);
  assert.equal(createElementLayer('number').cx, 0.18);
});

test('slugify produces safe file names', () => {
  assert.equal(slugify('One UI 9 — What’s New?'), 'one-ui-9-what-s-new');
  assert.equal(slugify('!!!'), 'thumbnail');
});

/* ---------- colour ---------- */

test('colour helpers round-trip and blend', () => {
  assert.deepEqual(hexToRgb('#ff8000'), { r: 255, g: 128, b: 0 });
  assert.equal(rgbToHex({ r: 255, g: 128, b: 0 }), '#ff8000');
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(isDark('#0b0b10'), true);
  assert.equal(isDark('#f3efe6'), false);
  assert.throws(() => hexToRgb('red'));
  assert.equal(isHex('#abcdef'), true);
  assert.equal(isHex('#abc'), false);
});

test('shiftHue rotates hue and preserves lightness', () => {
  const shifted = shiftHue('#ff0000', 120);
  assert.equal(shifted, '#00ff00');
  assert.ok(Math.abs(hexToHsl(shifted).l - hexToHsl('#ff0000').l) < 0.01);
});

test('createRng is deterministic per seed', () => {
  const a = createRng(42);
  const b = createRng(42);
  const seqA = [a(), a(), a()];
  assert.deepEqual(seqA, [b(), b(), b()]);
  assert.notEqual(createRng(43)(), seqA[0]);
});

/* ---------- palette extraction ---------- */

function pixels(colors) {
  return new Uint8ClampedArray(colors.flatMap(([rgb, count]) => Array.from({ length: count }, () => [...rgb, 255]).flat()));
}

test('extractPalette picks the dominant colour as bg and a vivid accent', () => {
  const data = pixels([[[10, 12, 30], 900], [[255, 60, 120], 80], [[120, 120, 120], 20]]);
  const theme = extractPalette(data);
  assert.ok(isDark(theme.bg));
  assert.ok(luminance(theme.text) > 0.7, 'text contrasts with a dark bg');
  const { h, s } = hexToHsl(theme.accent);
  assert.ok(s > 0.5 && (h > 300 || h < 20), `accent should be the pink, got ${theme.accent}`);
});

test('extractPalette gives dark text on light images and survives empty input', () => {
  const light = extractPalette(pixels([[[240, 236, 228], 500], [[40, 90, 220], 60]]));
  assert.ok(luminance(light.text) < 0.1);
  assert.deepEqual(Object.keys(extractPalette(new Uint8ClampedArray(0))), ['bg', 'text', 'accent']);
});

/* ---------- handles ---------- */

test('normalizeHandle cleans pasted profile URLs', () => {
  assert.equal(normalizeHandle('linkedin', 'https://www.linkedin.com/in/dibyajyotikabi/'), 'in/dibyajyotikabi');
  assert.equal(normalizeHandle('x', 'https://x.com/someone?s=20'), '@someone');
  assert.equal(normalizeHandle('github', 'octocat'), '@octocat');
  assert.equal(normalizeHandle('youtube', 'https://youtube.com/@channel'), '@channel');
  assert.equal(normalizeHandle('website', 'https://www.example.com/'), 'example.com');
  assert.equal(normalizeHandle('linkedin', '  '), '');
});

test('detectPlatform recognises profile URLs', () => {
  assert.equal(detectPlatform('https://linkedin.com/in/abc'), 'linkedin');
  assert.equal(detectPlatform('twitter.com/abc'), 'x');
  assert.equal(detectPlatform('just a name'), null);
});

/* ---------- font suggestions ---------- */

test('analyzeMood reads the intent of the text', () => {
  assert.equal(analyzeMood('One UI 9 review — new features')[0].id, 'tech');
  assert.equal(analyzeMood('How to invest your salary: $10k growth')[0].id, 'finance');
  assert.equal(analyzeMood('A slow morning in the mountains, calm and mindful')[0].id, 'nature');
  assert.equal(analyzeMood('Retro synthwave arcade')[0].id, 'retro');
});

test('suggestDirection is deterministic and respects available fonts', () => {
  const a = suggestDirection('Apple M5 chip review', 7);
  assert.deepEqual(a, suggestDirection('Apple M5 chip review', 7));
  const onlyGeist = suggestDirection('Apple M5 chip review', 7, new Set(['geist', 'inter']));
  assert.equal(onlyGeist.heading, 'geist');
  assert.ok(MOODS[a.mood].heading.includes(a.heading));
});

test('suggestFonts returns unique ids limited to the catalog', () => {
  const ids = suggestFonts('wedding fashion story', new Set(['playfair-display', 'fraunces', 'geist']), 5);
  assert.ok(ids.includes('playfair-display'));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => ['playfair-display', 'fraunces', 'geist'].includes(id)));
});

test('nearestWeight snaps to shipped weights', () => {
  assert.equal(nearestWeight({ weights: [400, 700] }, 600), 700);
  assert.equal(nearestWeight({ weights: [400] }, 900), 400);
  assert.equal(nearestWeight(null, 640), 600);
});

/* ---------- document model ---------- */

test('createDocument is valid and survives sanitize', () => {
  const doc = createDocument('pr1');
  assert.deepEqual(sanitizeDocument(JSON.parse(JSON.stringify(doc))), doc);
  assert.deepEqual(docSize(doc), SIZES.youtube);
  const withElement = { ...doc, layers: [...doc.layers, createElementLayer('quote')] };
  assert.deepEqual(sanitizeDocument(JSON.parse(JSON.stringify(withElement))), withElement);
  const withOldPaper = { ...doc, layers: [...doc.layers, createTextLayer({ box: 'paper', text: 'Only ~this~' })] };
  assert.equal(sanitizeDocument(withOldPaper).layers.at(-1).box, 'none');
});

test('sanitizeDocument rejects junk and clamps custom sizes', () => {
  assert.equal(sanitizeDocument(null), null);
  assert.equal(sanitizeDocument({ version: 1 }), null);
  const doc = createDocument('pr1');
  const bad = { ...doc, size: 'nope', custom: { width: 99999, height: -5 }, layers: [...doc.layers, { type: 'evil' }] };
  const clean = sanitizeDocument(bad);
  assert.equal(clean.size, 'youtube');
  assert.deepEqual(clean.custom, { width: 4096, height: 64 });
  assert.equal(clean.layers.length, doc.layers.length);
});

test('templates rebuild layers from existing content', () => {
  const content = extractContent(createDocument('pr1').layers);
  assert.equal(content.headline, 'One UI *9*');
  assert.equal(content.kicker, 'Deep dive');
  TEMPLATES.forEach((t) => {
    const layers = t.build(content, ['pr1', 'pr2']);
    assert.ok(layers.length > 0, t.id);
    assert.equal(new Set(layers.map((l) => l.id)).size, layers.length, `${t.id} ids unique`);
  });
  const collab = TEMPLATES.find((t) => t.id === 'collab').build(content, ['pr1', 'pr2']);
  assert.deepEqual(collab.filter((l) => l.type === 'profile').map((l) => l.profileId), ['pr1', 'pr2']);
});

test('wrapLines hard-breaks words that are wider than the line, preferring URL separators', async () => {
  const { breakWord } = await import('../src/core/layout.js');
  const measure = (s) => s.length * 10;
  const lines = wrapLines('see github.com/Dibyajyotikabi/lumen-poster-generator now', 150, measure);
  lines.forEach((l) => assert.ok(measure(l) <= 150, `"${l}" fits`));
  assert.equal(lines.join('').replace(/\s/g, ''), 'seegithub.com/Dibyajyotikabi/lumen-poster-generatornow');
  assert.deepEqual(breakWord('abcdefghij', 40, measure), ['abcd', 'efgh', 'ij']);
  assert.deepEqual(breakWord('aaa/bbbbbb', 60, measure), ['aaa/', 'bbbbbb']);
});
