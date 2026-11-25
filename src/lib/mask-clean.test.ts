import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMask } from './mask-clean';

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
