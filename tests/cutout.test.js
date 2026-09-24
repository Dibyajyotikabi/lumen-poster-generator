import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alphaBounds, coverage } from '../src/cutout/compose.js';
import { chooseMask, withAreas, combineMask, cutoutPlacement } from '../src/cutout/selection.js';

// 4×3 image helpers
const W = 4;
const H = 3;
const mask = (...on) => {
  const a = new Uint8ClampedArray(W * H);
  on.forEach((i) => (a[i] = 255));
  return a;
};

/** Three candidate masks: small (1px), medium (2px), large (6px); scores favour medium. */
function candidates() {
  const small = mask(5);
  const medium = mask(5, 6);
  const large = mask(1, 2, 5, 6, 9, 10);
  const packed = new Uint8ClampedArray(W * H * 3);
  // deliberately not in size order
  packed.set(large, 0);
  packed.set(small, W * H);
  packed.set(medium, W * H * 2);
  return withAreas({ width: W, height: H, count: 3, masks: packed, scores: [0.7, 0.8, 0.95] });
}

test('alphaBounds finds the tight box, pads and clamps', () => {
  assert.deepEqual(alphaBounds(mask(5, 6), W, H), { x: 1, y: 1, w: 2, h: 1 });
  assert.deepEqual(alphaBounds(mask(5), W, H, { pad: 5 }), { x: 0, y: 0, w: 4, h: 3 });
  assert.equal(alphaBounds(mask(), W, H), null);
});

test('coverage reports the kept share', () => {
  assert.equal(coverage(mask(0, 1, 2)), 3 / 12);
  assert.equal(coverage(new Uint8ClampedArray(0)), 0);
});

test('chooseMask picks by quality score or by area', () => {
  const c = candidates();
  assert.deepEqual([...chooseMask(c, 'auto')], [...mask(5, 6)]);
  assert.deepEqual([...chooseMask(c, 'small')], [...mask(5)]);
  assert.deepEqual([...chooseMask(c, 'medium')], [...mask(5, 6)]);
  assert.deepEqual([...chooseMask(c, 'large')], [...mask(1, 2, 5, 6, 9, 10)]);
});

test('combineMask applies clicks in order and never mutates the base', () => {
  const base = mask(0, 1, 2, 3);
  const removeHand = { keep: false, candidates: withAreas({ width: W, height: H, count: 1, masks: mask(1, 6), scores: [0.9] }) };
  const keepPhone = { keep: true, candidates: candidates() }; // best score → medium → pixels 5, 6
  // On this tiny grid the grown removal clears everything; the later keep click re-adds the phone.
  const out = combineMask({ base, width: W, height: H, clicks: [removeHand, keepPhone], sizeId: 'auto' });
  assert.deepEqual([...out].map((v, i) => (v ? i : -1)).filter((i) => i >= 0), [5, 6]);
  assert.deepEqual([...base], [...mask(0, 1, 2, 3)], 'base untouched');
});

test('combineMask works without an auto base', () => {
  const out = combineMask({ base: null, width: W, height: H, clicks: [{ keep: true, candidates: candidates() }], sizeId: 'large' });
  assert.equal(coverage(out), 6 / 12);
});

test('cutoutPlacement keeps the object where it was on the canvas', () => {
  const layer = { cx: 0.5, cy: 0.5, width: 0.5 };
  // object occupies the right half of a 1000×500 source, full height
  const crop = { box: { x: 500, y: 0, w: 500, h: 500 }, sourceWidth: 1000, sourceHeight: 500 };
  const p = cutoutPlacement(layer, crop, { width: 1280, height: 720 });
  assert.equal(p.width, 0.25);
  assert.ok(Math.abs(p.cx - 0.625) < 1e-9); // shifted right by a quarter of the layer width
  assert.ok(Math.abs(p.cy - 0.5) < 1e-9);
});

test('dilate grows a mask by the radius without touching the input', async () => {
  const { dilate } = await import('../src/cutout/selection.js');
  const src = new Uint8ClampedArray(5 * 5);
  src[12] = 255; // centre
  const out = dilate(src, 5, 5, 1);
  const on = [...out].map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(on, [6, 7, 8, 11, 12, 13, 16, 17, 18]); // 3×3 square
  assert.equal([...src].filter(Boolean).length, 1);
});

test('removing an object also clears its soft fringe', () => {
  const w = 10;
  const h = 1;
  const base = Uint8ClampedArray.from([0, 60, 255, 255, 255, 255, 255, 255, 60, 0]);
  const hand = new Uint8ClampedArray(10);
  hand[5] = hand[6] = hand[7] = 255;
  const out = combineMask({ base, width: w, height: h, sizeId: 'auto', clicks: [{ keep: false, candidates: withAreas({ width: w, height: h, count: 1, masks: hand, scores: [1] }) }] });
  assert.deepEqual([...out], [0, 60, 255, 0, 0, 0, 0, 0, 0, 0]); // radius 2 also clears the fringe at 8
});
