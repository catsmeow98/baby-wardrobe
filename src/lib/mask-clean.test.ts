import test from 'node:test';
import assert from 'node:assert/strict';
import { alphaBounds, cleanMask, refineMask, scaleBox, worthCropping } from './mask-clean';

const W = 30;
const H = 20;
const grid = (f: (x: number, y: number) => boolean) => Uint8Array.from({ length: W * H }, (_, i) => (f(i % W, Math.floor(i / W)) ? 255 : 0));
const at = (m: Uint8Array, x: number, y: number) => m[y * W + x];

test('drops stray specks and fills holes inside the item', () => {
  const soft = grid((x, y) => (x >= 3 && x <= 14 && y >= 3 && y <= 16 && !(x >= 7 && x <= 9 && y >= 8 && y <= 10)) || (x === 25 && y === 2));
  const out = cleanMask(soft, W, H);
  assert.equal(at(out, 8, 9), 255, 'hole filled');
  assert.equal(at(out, 25, 2), 0, 'speck removed');
  assert.equal(at(out, 5, 5), 255);
  assert.equal(at(out, 20, 10), 0);
});

test('keeps a second piece when it is big enough', () => {
  const soft = grid((x, y) => (x >= 1 && x <= 8 && y >= 2 && y <= 12) || (x >= 18 && x <= 26 && y >= 2 && y <= 12));
  const out = cleanMask(soft, W, H);
  assert.equal(at(out, 4, 6), 255);
  assert.equal(at(out, 22, 6), 255);
});

test('an empty mask stays empty and a full one stays full', () => {
  assert.ok(cleanMask(new Uint8Array(W * H), W, H).every((v) => v === 0));
  assert.ok(cleanMask(new Uint8Array(W * H).fill(255), W, H).every((v) => v === 255));
});


/** A width x height grid of one value, with rectangles painted on it: [x, y, w, h, value]. */
const rects = (w: number, h: number, list: [number, number, number, number, number][], base = 0): number[] => {
  const g = new Array<number>(w * h).fill(base);
  for (const [rx, ry, rw, rh, v] of list) for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) g[y * w + x] = v;
  return g;
};

test('refineMask: background stays clear, the item interior is solid, the edge is soft', () => {
  const W = 40, H = 40;
  const g = rects(W, H, [[10, 10, 20, 20, 255]], 0);
  const a = refineMask(g, W, H);
  assert.equal(a[2 * W + 2], 0);
  assert.equal(a[20 * W + 20], 255);
  // edge pixels with saliency 255 are fully solid; weaker edge pixels fade
  const weak = rects(W, H, [[10, 10, 20, 20, 255], [10, 10, 20, 1, 105]], 0);
  const b = refineMask(weak, W, H);
  assert.ok(b[10 * W + 20] > 0 && b[10 * W + 20] < 255, `a weak edge fades (got ${b[10 * W + 20]})`);
  assert.equal(b[20 * W + 20], 255);
});

test('refineMask: a thin sleeve with modest saliency survives (the old fixed cut-off of 128 lost it)', () => {
  const W = 60, H = 40;
  const g = rects(W, H, [[5, 10, 20, 20, 255], [25, 17, 25, 8, 115]], 0); // body, plus a sleeve at 115 (under 128)
  const a = refineMask(g, W, H);
  assert.equal(a[21 * W + 38], 255, 'the middle of the sleeve is kept solid');
  assert.ok(a[18 * W + 38] > 0, 'its edge is kept, faded');
});

test('refineMask: a second item is kept, specks are dropped, and holes are filled', () => {
  const W = 80, H = 50;
  const g = rects(W, H, [[5, 5, 30, 30, 255], [45, 10, 20, 20, 255], [70, 45, 2, 2, 255], [15, 15, 6, 6, 0]], 0);
  const a = refineMask(g, W, H);
  assert.equal(a[20 * W + 55], 255, 'second item kept');
  assert.equal(a[46 * W + 70], 0, 'a speck is dropped');
  assert.equal(a[17 * W + 17], 255, 'the hole inside the first item is filled');
});

test('refineMask: a piece under the share is dropped', () => {
  const W = 100, H = 60;
  const g = rects(W, H, [[5, 5, 50, 50, 255], [80, 20, 6, 6, 255]], 0); // 36 vs 2500: well under 12%
  assert.equal(refineMask(g, W, H)[22 * W + 82], 0);
});

test('alphaBounds, worthCropping and scaleBox', () => {
  const W = 100, H = 80;
  const alpha = rects(W, H, [[30, 20, 40, 30, 255]], 0);
  const box = alphaBounds(alpha, W, H, 16, 0.05)!;
  assert.deepEqual(box, { x: 25, y: 15, width: 50, height: 40 });
  assert.equal(worthCropping(box, W, H), true);
  assert.equal(worthCropping({ x: 0, y: 0, width: 98, height: 79 }, W, H), false);
  assert.equal(alphaBounds(new Array(W * H).fill(0), W, H), null);
  assert.deepEqual(scaleBox({ x: 10, y: 20, width: 30, height: 40 }, 1.5, 2), { x: 15, y: 40, width: 45, height: 80 });
  // the margin never leaves the image
  const edge = alphaBounds(rects(W, H, [[0, 0, 100, 80, 255]]), W, H)!;
  assert.deepEqual(edge, { x: 0, y: 0, width: 100, height: 80 });
});
