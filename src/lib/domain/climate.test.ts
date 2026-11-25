import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMonth, dominantClass, monthlyClasses, type DailyHigh } from './climate';

test('months are labelled from the average daily high in °F', () => {
  assert.deepEqual([20, 39.9, 40, 59.9, 60, 75, 75.1, 95].map(classifyMonth), ['cold', 'cold', 'cool', 'cool', 'mild', 'mild', 'warm', 'warm']);
});

const year = (y: number, highs: number[]): DailyHigh[] => {
  const out: DailyHigh[] = [];
  for (let m = 0; m < 12; m++) for (let d = 1; d <= 28; d++) out.push({ date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, highF: highs[m] });
  return out;
};

test('monthly labels average every year, January first', () => {
  const highs = [30, 35, 45, 58, 70, 82, 88, 86, 76, 62, 48, 35];
  const days = [...year(2022, highs), ...year(2023, highs.map((h) => h + 2))];
  assert.deepEqual(monthlyClasses(days), ['cold', 'cold', 'cool', 'cool', 'mild', 'warm', 'warm', 'warm', 'warm', 'mild', 'cool', 'cold']);
});

test('missing days are skipped, and too little data means no answer', () => {
  const days = year(2023, Array(12).fill(70)).map((d, i) => (i % 5 === 0 ? { ...d, highF: null } : d));
  assert.equal(monthlyClasses(days)?.[0], 'mild');
  assert.equal(monthlyClasses(year(2023, Array(12).fill(70)).filter((d) => !d.date.startsWith('2023-07'))), null);
  assert.equal(monthlyClasses([]), null);
});

test('the dominant label of a window, a tie going to the colder one', () => {
  assert.equal(dominantClass(['warm', 'warm', 'cool']), 'warm');
  assert.equal(dominantClass(['cool', 'warm']), 'cool');
  assert.equal(dominantClass(['cold', 'cool']), 'cold');
});
