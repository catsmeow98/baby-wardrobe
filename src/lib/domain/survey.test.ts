import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_NAMES, CAT_KEYS, FREQ_KEYS, SURVEY_SIZES, answersToParams, comboToString, defaultAnswers, defaultSizes, defaultStages, gearQty, monthClass, parseAnswers,
  parseCombo, seasonForSize, seasonOfMonth, sizeWindow, suggest, suggestAll, suggestGear, type Answers, type Combo, type Freq,
} from './survey';

const base = (): Answers => defaultAnswers(0);
const qOf = (a: Answers, size: number, key: string, season: 'spring' | 'summer' | 'winter' | 'fall' = 'spring') =>
  suggest(a, size, season).rows.find((r) => r.key === key)?.qty ?? 0;
const combo = (freq: Freq, ...cats: string[]): Combo => ({ cats, freq });
const only = (a: Answers, size: number, occ: 'sleep' | 'day' | 'dressy', combos: Combo[]) => {
  a.stages[size][occ] = combos;
  return a;
};
const CUSTOM = '123e4567-e89b-42d3-a456-426614174000';

test('the survey covers newborn to 2T, and every size has its own answers', () => {
  assert.deepEqual([...SURVEY_SIZES], [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(Object.keys(defaultStages()).map(Number), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('default sizes start at the current size', () => {
  assert.deepEqual(defaultSizes(null), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(defaultSizes(3), [3, 4, 5, 6, 7]);
  assert.deepEqual(defaultSizes(9), [7]);
});

test('size windows turn ages into calendar months from the birth month', () => {
  assert.equal(sizeWindow(3, 0).months, 'April');
  assert.equal(sizeWindow(3, 1).months, 'May to June');
  assert.equal(sizeWindow(3, 1).short, 'May-Jun');
  assert.equal(sizeWindow(3, 2).months, 'July to September');
  assert.equal(sizeWindow(3, 2).age, 'Age 3 to 6 months');
  assert.equal(sizeWindow(3, 0).age, 'Birth to 1 month');
  assert.equal(sizeWindow(9, 3).months, 'April to June');
  assert.equal(sizeWindow(0, 6).months, 'July to December');
  assert.equal(sizeWindow(0, 7).months, 'January to June');
  for (let i = 1; i < 8; i++) assert.equal(sizeWindow(5, i).startAge, sizeWindow(5, i - 1).endAge);
});

test('a window lists its calendar months', () => {
  assert.deepEqual(sizeWindow(3, 2).monthIdx, [6, 7, 8]); // July to September
  assert.deepEqual(sizeWindow(0, 6).monthIdx, [6, 7, 8, 9, 10, 11]);
  assert.equal(sizeWindow(0, 5).monthIdx.length, 6);
});

test('seasons come from the birth month and each size lands in a later season', () => {
  assert.deepEqual([0, 3, 6, 9, 11].map(seasonOfMonth), ['winter', 'spring', 'summer', 'fall', 'winter']);
  assert.equal(seasonForSize(6, 0), 'summer');
  assert.notEqual(seasonForSize(6, 0), seasonForSize(6, 3));
  assert.equal(seasonForSize(11, 0), 'winter');
});

test('the how-often scale is days per week', () => {
  assert.deepEqual([...FREQ_KEYS], ['lt1', '1-2', '3-4', '5-6', '7']);
});

test('every size gets a row for every built-in type, with whole numbers and a reason', () => {
  for (const r of suggestAll(base(), [...SURVEY_SIZES], () => 'spring')) {
    for (const k of CAT_KEYS) {
      const row = r.rows.find((x) => x.key === k)!;
      assert.ok(Number.isInteger(row.qty) && row.qty >= 0 && row.qty <= 99, `${k} ${r.size}`);
      assert.ok(row.why.length > 0);
    }
  }
});

test('pajama sets: every night, a set worn 2 to 3 nights, weekly laundry needs 4', () => {
  const a = only(base(), 3, 'sleep', [combo('7', 'footy')]);
  a.laundry = 7;
  a.stages[3].pj = '2-3';
  assert.equal(qOf(a, 3, 'footy'), 4); // 7 nights / 2.5 = 3, plus one in the wash
  a.stages[3].pj = 'daily';
  assert.equal(qOf(a, 3, 'footy'), 8); // a clean set every night, plus one
  a.stages[3].pj = '4-plus';
  assert.equal(qOf(a, 3, 'footy'), 3);
});

test('pajamas worn fewer nights a week need fewer sets, and no spare in the wash when rarely worn', () => {
  const a = only(base(), 3, 'sleep', [combo('1-2', 'pjs')]);
  a.laundry = 7;
  a.stages[3].pj = 'daily';
  assert.equal(qOf(a, 3, 'pjs'), 2); // 1.5 nights a week, 2 sets, no spare
  const b = only(base(), 3, 'sleep', [combo('lt1', 'pjs')]);
  b.laundry = 7;
  assert.equal(qOf(b, 3, 'pjs'), 1);
});

test('each size has its own pajama answer', () => {
  const a = base();
  a.laundry = 6;
  only(a, 2, 'sleep', [combo('7', 'pjs')]);
  only(a, 3, 'sleep', [combo('7', 'pjs')]);
  a.stages[2].pj = 'daily';
  a.stages[3].pj = '4-plus';
  assert.ok(qOf(a, 2, 'pjs') > qOf(a, 3, 'pjs'));
});

test('a combination adds one of each piece, so "bodysuit + pants + socks" produces all three', () => {
  const a = only(base(), 4, 'day', [combo('7', 'sbs', 'pants', 'socks')]);
  assert.equal(qOf(a, 4, 'sbs') > 0, true);
  assert.equal(qOf(a, 4, 'sbs'), qOf(a, 4, 'pants'));
  assert.equal(qOf(a, 4, 'sbs'), qOf(a, 4, 'socks'));
});

test('days per week shares outfits between combinations', () => {
  const a = only(base(), 4, 'day', [combo('7', 'sbs'), combo('1-2', 'top')]);
  assert.ok(qOf(a, 4, 'sbs') > qOf(a, 4, 'top'));
  const b = only(base(), 4, 'day', [combo('3-4', 'sbs')]);
  const c = only(base(), 4, 'day', [combo('7', 'sbs')]);
  assert.ok(qOf(b, 4, 'sbs') < qOf(c, 4, 'sbs')); // worn on fewer days, so fewer needed
});

test('combinations that add up to more than a week are scaled down together', () => {
  const a = only(base(), 4, 'day', [combo('7', 'sbs'), combo('7', 'top')]);
  const one = only(base(), 4, 'day', [combo('7', 'sbs')]);
  assert.ok(qOf(a, 4, 'sbs') + qOf(a, 4, 'top') < 2 * qOf(one, 4, 'sbs') + 2);
  assert.equal(qOf(a, 4, 'sbs'), qOf(a, 4, 'top'));
});

test('outfit changes, spare outfits and laundry frequency raise the totals', () => {
  const lo = only(base(), 4, 'day', [combo('7', 'sbs')]);
  const hi = only(base(), 4, 'day', [combo('7', 'sbs')]);
  hi.changes = 'three-plus';
  assert.ok(qOf(hi, 4, 'sbs') > qOf(lo, 4, 'sbs'));
  const spare = only(base(), 4, 'day', [combo('7', 'sbs')]);
  spare.spare = 'many';
  assert.ok(qOf(spare, 4, 'sbs') > qOf(lo, 4, 'sbs'));
  const laundry = only(base(), 4, 'day', [combo('7', 'sbs')]);
  laundry.laundry = 7;
  assert.ok(qOf(laundry, 4, 'sbs') > qOf(lo, 4, 'sbs'));
});

test('dressy outfits follow days per week and laundry gap, with at least one, and more changes a day raise them', () => {
  const a = only(base(), 4, 'dressy', [combo('lt1', 'dress')]);
  assert.equal(qOf(a, 4, 'dress'), 1);
  const b = only(base(), 4, 'dressy', [combo('7', 'dress')]);
  b.laundry = 7;
  b.changes = 'one';
  assert.equal(qOf(b, 4, 'dress'), 7);
  b.changes = 'three-plus';
  assert.ok(qOf(b, 4, 'dress') > 7);
  const none = only(base(), 4, 'dressy', []);
  assert.equal(qOf(none, 4, 'dress'), 0);
});

test('sleep sacks and swaddles are capped because only one is worn at a time', () => {
  const a = only(base(), 1, 'sleep', [combo('7', 'sack', 'swaddle')]);
  a.laundry = 14;
  assert.equal(qOf(a, 1, 'sack'), 3);
  assert.equal(qOf(a, 1, 'swaddle'), 3);
});

test('needs change by stage: shoes only once walking', () => {
  const a = only(base(), 2, 'day', [combo('7', 'shoes')]);
  assert.equal(qOf(a, 2, 'shoes'), 0);
  const b = only(base(), 5, 'day', [combo('7', 'shoes')]);
  assert.ok(qOf(b, 5, 'shoes') > 0);
});

test('month classes: December to February cold, June to August warm, hot and cold climates widen them', () => {
  assert.deepEqual([11, 0, 1].map((m) => monthClass(m)), ['cold', 'cold', 'cold']);
  assert.deepEqual([5, 6, 7].map((m) => monthClass(m)), ['warm', 'warm', 'warm']);
  assert.equal(monthClass(10), 'cool');
  assert.equal(monthClass(10, false, true), 'cold');
  assert.equal(monthClass(8), 'mild');
  assert.equal(monthClass(8, true), 'warm');
});

test('gear quantities: at least 1, 2 for 3 months in season, 3 for 5', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(gearQty), [1, 1, 1, 2, 2, 3, 3]);
});

test('September to January: 2 light jackets, 2 coats, 1 snowsuit', () => {
  const a = base();
  const win = { ...sizeWindow(0, 6), monthIdx: [8, 9, 10, 11, 0], months: 'September to January', short: 'Sep-Jan' };
  a.stages[6].gear = ['coat', 'jacket', 'snowsuit'];
  const r = suggest(a, 6, 'fall', win);
  const q = (k: string) => r.rows.find((x) => x.key === k)!.qty;
  assert.equal(q('jacket'), 2);
  assert.equal(q('coat'), 2);
  assert.equal(q('snowsuit'), 1);
});

test('summer: swimsuits and a sun hat get 2, and a jacket chosen in a warm window still gets 1', () => {
  const a = base();
  const win = { ...sizeWindow(0, 6), monthIdx: [5, 6, 7], months: 'June to August', short: 'Jun-Aug' };
  a.stages[6].gear = ['swim', 'hat', 'jacket'];
  const r = suggest(a, 6, 'summer', win);
  const q = (k: string) => r.rows.find((x) => x.key === k)!.qty;
  assert.equal(q('swim'), 2);
  assert.equal(q('hat'), 2);
  assert.equal(q('jacket'), 1);
  assert.match(r.rows.find((x) => x.key === 'jacket')!.why, /at least 1/);
});

test('nothing is assumed: with no outerwear chosen there is none, and a note says so', () => {
  const a = base();
  const r = suggest(a, 6, 'winter');
  for (const k of ['coat', 'jacket', 'bunting', 'snowsuit', 'mittens', 'swim']) assert.equal(r.rows.find((x) => x.key === k)!.qty, 0, k);
  assert.ok(r.notes.some((n) => /outerwear/i.test(n)));
});

test('suggested gear follows the months and the size', () => {
  const winter = [11, 0, 1];
  assert.deepEqual(suggestGear(winter, 6).sort(), ['coat', 'hat', 'mittens', 'snowsuit'].sort());
  assert.ok(suggestGear(winter, 1).includes('bunting'));
  assert.ok(!suggestGear(winter, 1).includes('snowsuit'));
  assert.ok(suggestGear([5, 6, 7], 6).includes('swim'));
  assert.ok(!suggestGear([5, 6, 7], 1).includes('swim'));
});

test('the person\'s own item types work in combinations, gear and results', () => {
  const a = only(base(), 4, 'day', [combo('7', 'sbs', CUSTOM)]);
  a.stages[4].gear = [CUSTOM];
  const labels = { [CUSTOM]: 'Poncho' };
  const r = suggest(a, 4, 'spring', undefined, labels);
  const row = r.rows.find((x) => x.key === CUSTOM)!;
  assert.equal(row.name, 'Poncho');
  assert.ok(row.qty >= 1);
  assert.match(row.why, /Poncho/);
});

test('empty sleep or day answers fall back to typical combinations with a note; empty dressy does not', () => {
  const a = base();
  a.stages[4].sleep = [];
  a.stages[4].day = [];
  a.stages[4].dressy = [];
  const r = suggest(a, 4, 'spring');
  assert.equal(r.notes.filter((n) => /typical/.test(n)).length, 2);
  assert.equal(r.rows.find((x) => x.key === 'romper')!.qty, 0);
});

test('combination strings round trip and reject bad input', () => {
  const x = combo('3-4', 'sbs', 'pants', CUSTOM);
  assert.deepEqual(parseCombo(comboToString(x)), x);
  assert.equal(parseCombo('nonsense~7'), null);
  assert.equal(parseCombo('sbs~nope'), null);
  assert.deepEqual(parseCombo('sbs.bogus.pants~7')!.cats, ['sbs', 'pants']);
});

test('old links still work: most, some and rare map to the new scale', () => {
  assert.equal(parseCombo('sbs~most')!.freq, '7');
  assert.equal(parseCombo('sbs~some')!.freq, '3-4');
  assert.equal(parseCombo('sbs~rare')!.freq, '1-2');
});

test('answers survive a trip through the query string', () => {
  const a = base();
  a.laundry = 5;
  a.hot = true;
  a.sizes = [2, 3];
  only(a, 2, 'sleep', [combo('5-6', 'pjs')]);
  a.stages[3].pj = '2-3';
  a.stages[3].gear = ['coat', CUSTOM];
  const p = answersToParams(a);
  const back = parseAnswers((k) => p.get(k), (k) => p.getAll(k));
  assert.equal(back.laundry, 5);
  assert.equal(back.hot, true);
  assert.deepEqual(back.sizes, [2, 3]);
  assert.deepEqual(back.stages[2].sleep, [combo('5-6', 'pjs')]);
  assert.equal(back.stages[3].pj, '2-3');
  assert.deepEqual(back.stages[3].gear, ['coat', CUSTOM]);
});

test('an old link with one pajama answer applies it to every size', () => {
  const p = new URLSearchParams('touched=1&size=2&size=3&pj=4-plus&dressy=rare&z2_sleep=pjs~most');
  const back = parseAnswers((k) => p.get(k), (k) => p.getAll(k));
  assert.equal(back.stages[2].pj, '4-plus');
  assert.equal(back.stages[3].pj, '4-plus');
  assert.equal(back.stages[2].sleep[0].freq, '7');
});

test('first visit uses defaults; a touched form with nothing chosen really means nothing', () => {
  const first = parseAnswers(() => null, () => []);
  assert.ok(first.stages[3].day.length > 0);
  const p = new URLSearchParams('touched=1&size=3');
  const touched = parseAnswers((k) => p.get(k), (k) => p.getAll(k));
  assert.equal(touched.stages[3].day.length, 0);
  assert.equal(touched.stages[3].gear.length, 0);
});

test('parseAnswers clamps numbers and ignores unknown choices and extra combinations', () => {
  const p = new URLSearchParams('touched=1&laundry=99&changes=bogus&spare=bogus&size=3&size=99');
  for (let i = 0; i < 10; i++) p.append('z3_day', 'sbs~7');
  for (let i = 0; i < 20; i++) p.append('z3_gear', i % 2 ? 'coat' : CUSTOM.replace('4000', `40${String(i).padStart(2, '0')}`));
  const back = parseAnswers((k) => p.get(k), (k) => p.getAll(k));
  assert.equal(back.laundry, 14);
  assert.equal(back.changes, 'one-two');
  assert.deepEqual(back.sizes, [3]);
  assert.equal(back.stages[3].day.length, 6);
  assert.ok(back.stages[3].gear.length <= 12);
});

test('defaults are independent copies, so editing one does not change the next', () => {
  const a = defaultAnswers(0);
  a.stages[3].day.push(combo('7', 'top'));
  a.stages[3].gear.push('coat');
  const b = defaultAnswers(0);
  assert.notEqual(a.stages[3].day.length, b.stages[3].day.length);
  assert.equal(b.stages[3].gear.length, 0);
});

test('typical routines use built-in names only', () => {
  for (const st of Object.values(defaultStages())) for (const x of [...st.sleep, ...st.day, ...st.dressy]) for (const k of x.cats) assert.ok(k in CATEGORY_NAMES, k);
});

test('a location\'s own month labels replace the fixed calendar', () => {
  // A mild place: nothing is ever cold, and December is only cool.
  const table = ['cool', 'cool', 'cool', 'mild', 'mild', 'warm', 'warm', 'warm', 'warm', 'mild', 'cool', 'cool'] as const;
  assert.equal(monthClass(11, false, false, table), 'cool');
  assert.equal(monthClass(11), 'cold'); // the fixed calendar says cold
  const a = base();
  a.months = table;
  const win = { ...sizeWindow(0, 6), monthIdx: [10, 11, 0], months: 'November to January', short: 'Nov-Jan' };
  a.stages[6].gear = ['snowsuit', 'coat'];
  const r = suggest(a, 6, 'winter', win);
  const q = (k: string) => r.rows.find((x) => x.key === k)!.qty;
  assert.equal(q('snowsuit'), 1); // no cold months here, so just the one that was chosen
  assert.equal(q('coat'), 2); // three cool months
  assert.equal(r.temp, 'cool');
  assert.ok(!suggestGear([10, 11, 0], 6, false, false, table).includes('snowsuit'));
});

test('the 38 built-in item types each sit in exactly one chip group and have an icon', async () => {
  const { CHIP_GROUPS } = await import('./survey');
  const { ITEM_ICONS } = await import('../item-icons');
  const listed = CHIP_GROUPS.flatMap((g) => g.keys);
  assert.equal(CAT_KEYS.length, 38);
  assert.deepEqual([...listed].sort(), [...CAT_KEYS].sort());
  for (const k of CAT_KEYS) assert.ok(ITEM_ICONS[k]?.length > 0, `icon for ${k}`);
  assert.equal(CATEGORY_NAMES.top, 'Short-sleeve top');
});

test('cardigan and pullover are cool-weather layers: in season for cool and cold months, never auto-suggested', () => {
  const a = only(base(), 4, 'day', [combo('7', 'sbs')]);
  a.stages[4].gear = ['cardigan', 'pullover'];
  const winter = [11, 0, 1, 2];
  const warm = [5, 6, 7];
  const rows = (months: number[]) => suggest(a, 4, 'winter', { ...sizeWindow(0, 4), monthIdx: months }).rows;
  assert.equal(rows(winter).find((r) => r.key === 'cardigan')!.qty, 2);
  assert.equal(rows(warm).find((r) => r.key === 'pullover')!.qty, 1); // chosen, so at least 1
  assert.ok(!suggestGear(winter, 4).includes('cardigan'));
  assert.ok(!suggestGear(winter, 4).includes('pullover'));
});

test('overalls and long-sleeve dress work as pieces in a combination', () => {
  const a = only(base(), 4, 'dressy', [combo('3-4', 'ldress'), combo('1-2', 'lovr')]);
  assert.ok(qOf(a, 4, 'ldress') >= 1 && qOf(a, 4, 'lovr') >= 1);
  assert.equal(qOf(only(base(), 4, 'day', [combo('7', 'sovr')]), 4, 'sovr') > 0, true);
});
