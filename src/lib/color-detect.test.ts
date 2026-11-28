import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorOfPixel, judge, pickColor } from './color-detect.ts';

test('names common clothing colors, including dim and pale ones from real photos', () => {
  const cases: [number, number, number, string][] = [
    [255, 255, 255, 'white'], [250, 250, 248, 'white'], [20, 20, 20, 'black'], [128, 128, 128, 'gray'],
    [240, 230, 205, 'cream'], [120, 72, 40, 'brown'], [210, 30, 40, 'red'], [245, 170, 190, 'pink'],
    [240, 130, 30, 'orange'], [245, 215, 60, 'yellow'], [60, 160, 80, 'green'], [70, 130, 220, 'blue'],
    [25, 35, 80, 'navy'], [130, 70, 170, 'purple'], [170, 200, 235, 'blue'], [140, 170, 120, 'green'],
    // Indoor light: a white shirt reads light gray, a blue one in shade reads gray-blue.
    [182, 182, 178, 'white'], [100, 112, 130, 'blue'], [150, 150, 150, 'gray'], [110, 125, 100, 'green'],
    [200, 170, 175, 'white'], [240, 160, 180, 'pink'], [40, 40, 45, 'black'],
    // From real photos in warm indoor light: a white bodysuit, a cream sweater, an olive shirt in shade.
    [166, 152, 143, 'cream'], [183, 179, 179, 'white'], [160, 140, 126, 'cream'], [87, 79, 64, 'green'], [100, 97, 81, 'green'],
    // A yellow bodysuit in warm light, and its shaded folds; real oranges stay orange.
    [196, 161, 86, 'yellow'], [146, 114, 57, 'yellow'], [230, 120, 40, 'orange'], [200, 100, 40, 'orange'], [250, 150, 80, 'orange'],
    // Browns stay brown.
    [90, 60, 40, 'brown'], [150, 130, 100, 'brown'], [110, 90, 60, 'brown'], [60, 45, 35, 'brown'], [139, 69, 19, 'brown'], [160, 82, 45, 'brown'],
    // From the Recolor check: an orange read as red, yellows read as orange, a brown read as red, grays tinted pink.
    [184, 73, 44, 'orange'], [195, 150, 94, 'yellow'], [199, 157, 110, 'yellow'], [129, 81, 80, 'brown'], [154, 131, 127, 'gray'], [196, 172, 172, 'white'],
    [177, 35, 33, 'red'], [128, 0, 32, 'red'],
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

test('only vivid colours are filled in; muted ones offer quick picks', () => {
  const b = (name: string, share: number, r: number, g: number, bl: number) => ({ name, share, rgb: [r, g, bl] as [number, number, number] });
  assert.deepEqual(judge('navy', [b('navy', 0.7, 11, 69, 96)]), { sure: true, hints: [] });
  const gray = judge('cream', [b('cream', 0.6, 219, 205, 192), b('white', 0.3, 200, 200, 195)]);
  assert.equal(gray.sure, false);
  assert.deepEqual(gray.hints.slice(0, 3), ['white', 'cream', 'gray']);
  assert.equal(judge('brown', [b('brown', 0.7, 212, 171, 150)]).hints[0], 'gray');
  assert.equal(judge('multicolor', [b('red', 0.4, 177, 35, 33), b('yellow', 0.3, 232, 155, 13)]).sure, true);
  assert.equal(judge('multicolor', [b('cream', 0.4, 188, 157, 143), b('pink', 0.3, 208, 175, 169)]).sure, false);
});
