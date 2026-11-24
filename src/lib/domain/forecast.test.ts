import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, ageMonths, brandStats, dateAtSize, effectiveOffset, fitWord, forecast, percentileOf, sizeFor, transition } from './forecast';

test('addMonths clamps to the end of shorter months and crosses years', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(addMonths('2026-03-10', 0), '2026-03-10');
});

test('age in months', () => {
  assert.ok(Math.abs(ageMonths('2026-01-01', '2026-07-01') - 5.95) < 0.1);
});

test('sizeFor follows the chart and offsets shift it', () => {
  assert.equal(sizeFor(20), 0);
  assert.equal(sizeFor(27), 3);
  assert.equal(sizeFor(27, 1), 2); // a brand that runs large keeps a taller child in a smaller size
  assert.equal(sizeFor(99), 9);
});

test('percentile at the median is 50', () => {
  assert.equal(percentileOf(0), 50);
  assert.ok(percentileOf(1) > 80 && percentileOf(-1) < 20);
});

const M = [{ date: '2026-07-01', lengthIn: 26.5 }];

test('forecast needs a measurement and stops at 36 months', () => {
  assert.equal(forecast('girls', '2026-01-01', [], '2026-08-01', 12), null);
  const f = forecast('girls', '2026-01-01', M, '2026-08-01', 12)!;
  assert.equal(f.rows.length, 13);
  assert.equal(f.rows[0].date, '2026-08-01');
  assert.ok(f.rows.every((r) => r.low < r.mid && r.mid < r.high));
  const late = forecast('boys', '2024-01-01', [{ date: '2026-06-01', lengthIn: 35 }], '2026-08-01', 24)!;
  assert.ok(late.rows[late.rows.length - 1].age <= 36);
  assert.ok(late.rows.length < 25);
});

test('measurements outside birth to 36 months are ignored', () => {
  assert.equal(forecast('girls', '2026-01-01', [{ date: '2025-12-01', lengthIn: 20 }], '2026-02-01', 6), null);
  assert.equal(forecast('girls', '2020-01-01', [{ date: '2026-01-01', lengthIn: 40 }], '2026-02-01', 6), null);
});

test('projected length grows and a larger size is eventually reached', () => {
  const f = forecast('girls', '2026-01-01', M, '2026-08-01', 24)!;
  const mids = f.rows.map((r) => r.mid);
  assert.ok(mids.every((v, i) => i === 0 || v >= mids[i - 1]));
  const t = transition(f, 0);
  assert.ok(t.next && t.next.size > t.now);
  assert.equal(dateAtSize(f, 0, t.next!.size), t.next!.date);
  // a brand that runs large delays the move
  assert.ok(dateAtSize(f, 1.5, t.next!.size)! > dateAtSize(f, 0, t.next!.size)!);
  assert.ok(transition(f, 1.5).now < t.now);
});

test('brand ratings: none means no change, few ratings move little, many move more, and it is capped', () => {
  assert.equal(brandStats([]).adjust, 0);
  const one = brandStats([1]).adjust;
  const ten = brandStats(Array(10).fill(1)).adjust;
  assert.ok(one > 0 && one < ten && ten <= 2);
  assert.ok(brandStats([-1, -1]).adjust < 0);
  assert.equal(brandStats([-1, 0, 1]).adjust, 0);
  assert.deepEqual([brandStats([-1, 0, 1, 1]).small, brandStats([-1, 0, 1, 1]).true, brandStats([-1, 0, 1, 1]).large], [1, 1, 2]);
  assert.equal(effectiveOffset(0.5, brandStats([])), 0.5);
  assert.equal(fitWord(-0.5), 'Runs small');
  assert.equal(fitWord(0), 'True to size');
  assert.equal(fitWord(0.5), 'Runs large');
});
