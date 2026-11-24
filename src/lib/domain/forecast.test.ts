import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, ageMonths, brandStats, dateAtSize, effectiveOffset, fitWord, forecast, percentileOf, sizeFor, transition } from './forecast';
import { CATEGORY_NAMES, CAT_KEYS, DEFAULT_ANSWERS, parseAnswers, seasonOfMonth, suggest } from './survey';

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

test('survey covers every category and maps to seeded names', () => {
  const { rows } = suggest(DEFAULT_ANSWERS, 3, 'spring');
  assert.equal(rows.length, 14);
  assert.deepEqual(rows.map((r) => r.name), CAT_KEYS.map((k) => CATEGORY_NAMES[k]));
  assert.ok(rows.every((r) => Number.isInteger(r.qty) && r.qty >= 0 && r.why.length > 0));
});

test('survey responds to laundry frequency, climate and routine', () => {
  const total = (a = DEFAULT_ANSWERS, size = 3, season: 'spring' | 'summer' | 'winter' = 'spring') => suggest(a, size, season).rows.reduce((t, r) => t + r.qty, 0);
  assert.ok(total({ ...DEFAULT_ANSWERS, laundry: 7 }) > total({ ...DEFAULT_ANSWERS, laundry: 2 }));
  const q = (a: typeof DEFAULT_ANSWERS, season: 'summer' | 'winter', key: string) => suggest(a, 3, season).rows.find((r) => r.key === key)!.qty;
  assert.equal(q(DEFAULT_ANSWERS, 'summer', 'outer'), 0);
  assert.equal(q({ ...DEFAULT_ANSWERS, cold: true }, 'winter', 'outer'), 2);
  assert.ok(q({ ...DEFAULT_ANSWERS, hot: true }, 'summer', 'swim') > 0);
  // sleep choices drive sleepwear
  const sleepers = suggest({ ...DEFAULT_ANSWERS, sleepWear: ['pjs'] }, 8, 'spring').rows;
  assert.ok(sleepers.find((r) => r.key === 'sleep')!.qty > 0);
  assert.equal(sleepers.find((r) => r.key === 'footy')!.qty, 0);
  // swaddles only when chosen and only in small sizes
  assert.equal(suggest({ ...DEFAULT_ANSWERS, sleepWear: ['swaddle'] }, 1, 'spring').rows.find((r) => r.key === 'swaddle')!.qty, 2);
  assert.equal(suggest({ ...DEFAULT_ANSWERS, sleepWear: ['swaddle'] }, 6, 'spring').rows.find((r) => r.key === 'swaddle')!.qty, 0);
  // dressy picks create outfits
  assert.ok(suggest({ ...DEFAULT_ANSWERS, dressWear: ['dress', 'set'], outings: 'high' }, 3, 'spring').rows.find((r) => r.key === 'outfit')!.qty >= 4);
});

test('survey with nothing picked falls back to age based defaults rather than zero', () => {
  const rows = suggest({ ...DEFAULT_ANSWERS, sleepWear: [], dayWear: [], dressWear: [] }, 3, 'spring').rows;
  assert.ok(rows.find((r) => r.key === 'footy')!.qty + rows.find((r) => r.key === 'footless')!.qty > 0);
  assert.ok(rows.find((r) => r.key === 'bot')!.qty > 0);
});

test('seasons by month', () => {
  assert.deepEqual([0, 3, 6, 9, 11].map(seasonOfMonth), ['winter', 'spring', 'summer', 'fall', 'winter']);
});

test('parseAnswers: defaults on first visit, clamps numbers, drops unknown choices', () => {
  const mk = (qs: string) => {
    const p = new URLSearchParams(qs);
    return parseAnswers((k) => p.get(k), (k) => p.getAll(k));
  };
  assert.deepEqual(mk(''), DEFAULT_ANSWERS);
  const a = mk('touched=1&laundry=999&changes=-4&hot=yes&sleep=pjs&sleep=nonsense&season=bogus');
  assert.equal(a.laundry, 14);
  assert.equal(a.changes, 1);
  assert.equal(a.hot, true);
  assert.equal(a.season, 'auto');
  assert.deepEqual(a.sleepWear, ['pjs']);
  assert.deepEqual(a.dayWear, []); // touched form with nothing ticked really means none
});
