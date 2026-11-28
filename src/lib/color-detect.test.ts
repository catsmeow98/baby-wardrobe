import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorOfPixel, pickColor } from './color-detect.ts';

test('names common clothing colors, including dim and pale ones from real photos', () => {
  const cases: [number, number, number, string][] = [
    [255, 255, 255, 'white'], [250, 250, 248, 'white'], [20, 20, 20, 'black'], [128, 128, 128, 'gray'],
    [240, 230, 205, 'cream'], [120, 72, 40, 'brown'], [210, 30, 40, 'red'], [245, 170, 190, 'pink'],
    [240, 130, 30, 'orange'], [245, 215, 60, 'yellow'], [60, 160, 80, 'green'], [70, 130, 220, 'blue'],
    [25, 35, 80, 'navy'], [130, 70, 170, 'purple'], [170, 200, 235, 'blue'], [140, 170, 120, 'green'],
    // Indoor light: a white shirt reads light gray, a blue one in shade reads gray-blue.
    [182, 182, 178, 'white'], [100, 112, 130, 'blue'], [150, 150, 150, 'gray'], [110, 125, 100, 'green'],
    [200, 170, 175, 'pink'], [40, 40, 45, 'black'],
  ];
  for (const [r, g, b, want] of cases) assert.equal(colorOfPixel(r, g, b), want, `${r},${g},${b}`);
});

test('picks one color, or multicolor when nothing covers enough', () => {
  assert.equal(pickColor(new Map([['blue', 80], ['white', 20]])), 'blue');
  assert.equal(pickColor(new Map([['navy', 40], ['blue', 30], ['white', 30]])), 'navy');
  assert.equal(pickColor(new Map([['red', 35], ['yellow', 35], ['green', 30]])), 'multicolor');
  assert.equal(pickColor(new Map([['red', 10]])), null);
});

test('gray from shadows does not hide the real colour', () => {
  assert.equal(pickColor(new Map([['gray', 55], ['blue', 30], ['white', 15]])), 'blue');
  assert.equal(pickColor(new Map([['gray', 45], ['white', 40], ['black', 15]])), 'white');
  assert.equal(pickColor(new Map([['gray', 85], ['blue', 10], ['white', 5]])), 'gray');
});
