import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_NAMES, CAT_KEYS, STAGES, SURVEY_SIZES, answersToParams, comboToString, defaultAnswers, defaultStages, parseAnswers, parseCombo,
  seasonForSize, seasonOfMonth, stageOfSize, suggest, suggestAll, type Answers, type CatKey, type Combo,
} from './survey';

const base = (): Answers => defaultAnswers(0);
const q = (a: Answers, size: number, key: CatKey, season: 'spring' | 'summer' | 'winter' | 'fall' = 'spring') =>
  suggest(a, size, season).rows.find((r) => r.key === key)!.qty;
const only = (a: Answers, stage: 's1' | 's2' | 's3' | 's4', occ: 'sleep' | 'day' | 'dressy', combos: Combo[]) => {
  a.stages[stage][occ] = combos;
  return a;
};

test('sizes up to 2T are all covered by exactly one stage', () => {
  assert.deepEqual([...SURVEY_SIZES], [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(STAGES.flatMap((s) => [...s.sizes]), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(stageOfSize(0).id, 's1');
  assert.equal(stageOfSize(7).id, 's4');
  assert.equal(stageOfSize(9).id, 's4'); // beyond 2T falls back to the last stage
});

test('every size gets a row for every category, with whole numbers and a reason', () => {
  const all = suggestAll(base(), SURVEY_SIZES, () => 'spring');
  assert.equal(all.length, 8);
  for (const s of all) {
    assert.deepEqual(s.rows.map((r) => r.name), CAT_KEYS.map((k) => CATEGORY_NAMES[k]));
    assert.ok(s.rows.every((r) => Number.isInteger(r.qty) && r.qty >= 0 && r.qty <= 99 && r.why.length > 0));
  }
});

test('needs change by stage: swaddles early, sleep sacks later, shoes only once walking', () => {
  const a = base();
  assert.ok(q(a, 0, 'swaddle') > 0);
  assert.equal(q(a, 4, 'swaddle'), 0);
  assert.equal(q(a, 0, 'sack'), 0);
  assert.ok(q(a, 2, 'sack') > 0);
  assert.equal(q(a, 6, 'sack'), 0);
  // shoes are forced to zero before walking even when chosen
  const withShoes = only(base(), 's2', 'day', [{ cats: ['top', 'pants', 'shoes'], freq: 'most' }]);
  assert.equal(q(withShoes, 2, 'shoes'), 0);
  assert.ok(suggest(withShoes, 2, 'spring').notes.some((n) => n.includes('Shoes')));
  const walking = only(base(), 's3', 'day', [{ cats: ['top', 'pants', 'shoes'], freq: 'most' }]);
  assert.ok(q(walking, 4, 'shoes') > 0);
});

test('a combination adds one of each piece, so "bodysuit + pants + socks" produces all three', () => {
  const a = only(base(), 's2', 'day', [{ cats: ['lsb', 'pants', 'socks'], freq: 'most' }]);
  a.hot = false;
  assert.ok(q(a, 2, 'lsb') > 0 && q(a, 2, 'pants') > 0 && q(a, 2, 'socks') > 0);
  assert.equal(q(a, 2, 'top'), 0);
  // 3 days between loads, 1 to 2 changes a day, a few spares: ceil(3*2)+2 = 8 outfits
  assert.equal(q(a, 2, 'lsb'), 8);
  assert.equal(q(a, 2, 'pants'), 8);
});

test('how often shares outfits between combinations', () => {
  const a = only(base(), 's2', 'day', [
    { cats: ['lsb'], freq: 'most' },
    { cats: ['top'], freq: 'rare' },
  ]);
  // 8 outfits split 3:1 gives 6 and 2
  assert.equal(q(a, 2, 'lsb'), 6);
  assert.equal(q(a, 2, 'top'), 2);
  const even = only(base(), 's2', 'day', [
    { cats: ['lsb'], freq: 'some' },
    { cats: ['top'], freq: 'some' },
  ]);
  assert.equal(q(even, 2, 'lsb'), 4);
  assert.equal(q(even, 2, 'top'), 4);
});

test('outfit changes, spare outfits and laundry frequency raise the totals', () => {
  const day = (mut: (a: Answers) => void) => {
    const a = only(base(), 's2', 'day', [{ cats: ['lsb'], freq: 'most' }]);
    mut(a);
    return q(a, 2, 'lsb');
  };
  const normal = day(() => undefined);
  assert.ok(day((a) => (a.changes = 'three-plus')) > normal);
  assert.ok(day((a) => (a.changes = 'one')) < normal);
  assert.ok(day((a) => (a.spare = 'many')) > normal);
  assert.ok(day((a) => (a.spare = 'none')) < normal);
  assert.ok(day((a) => (a.laundry = 7)) > normal);
  assert.equal(day((a) => { a.changes = 'one'; a.spare = 'none'; a.laundry = 3; }), 3);
});

test('dressy outfits scale with times a week and laundry gap, with at least one', () => {
  const dressy = (key: Answers['dressyPerWeek'], laundry = 7) => {
    const a = only(base(), 's2', 'dressy', [{ cats: ['romper'], freq: 'most' }]);
    a.stages.s2.day = [{ cats: ['lsb'], freq: 'most' }];
    a.dressyPerWeek = key;
    a.laundry = laundry;
    return q(a, 2, 'romper');
  };
  assert.equal(dressy('rare', 3), 1);
  assert.equal(dressy('1-2'), 2);
  assert.equal(dressy('3-4'), 4);
  assert.equal(dressy('5-plus'), 6);
  assert.ok(dressy('5-plus', 3) < dressy('5-plus', 7));
  // no dressy combinations means no dressy outfits
  const none = only(base(), 's2', 'dressy', []);
  none.stages.s2.day = [{ cats: ['lsb'], freq: 'most' }];
  assert.equal(q(none, 2, 'romper'), 0);
});

test('sleep sacks and swaddles are capped because only one is worn at a time', () => {
  const a = only(base(), 's1', 'sleep', [{ cats: ['footy', 'swaddle'], freq: 'most' }]);
  a.laundry = 14;
  assert.equal(q(a, 0, 'swaddle'), 3);
  assert.ok(q(a, 0, 'footy') > 3);
});

test('weather drives outerwear, mittens, hats and swimsuits', () => {
  const a = base();
  assert.equal(q(a, 3, 'coat', 'summer'), 0);
  assert.equal(q(a, 3, 'swim', 'summer'), 1);
  a.hot = true;
  assert.equal(q(a, 3, 'swim', 'summer'), 2);
  a.cold = true;
  assert.equal(q(a, 3, 'coat', 'winter'), 1);
  assert.equal(q(a, 3, 'bunting', 'winter'), 1); // small baby: bunting
  assert.equal(q(a, 3, 'snowsuit', 'winter'), 0);
  assert.equal(q(a, 6, 'snowsuit', 'winter'), 1); // older baby: snowsuit
  assert.equal(q(a, 6, 'bunting', 'winter'), 0);
  assert.equal(q(a, 3, 'mittens', 'winter'), 1);
  a.cold = false;
  assert.equal(q(a, 3, 'coat', 'winter'), 0);
  assert.equal(q(a, 3, 'jacket', 'winter'), 1);
  assert.equal(q(a, 0, 'swim', 'summer'), 0); // too young for swimsuits
});

test('empty sleep or day answers fall back to typical combinations with a note; empty dressy does not', () => {
  const a = base();
  a.stages.s2 = { sleep: [], day: [], dressy: [] };
  const s = suggest(a, 2, 'spring');
  assert.equal(s.notes.length, 2);
  assert.ok(s.rows.find((r) => r.key === 'footy')!.qty > 0);
  assert.ok(s.rows.find((r) => r.key === 'pants')!.qty > 0);
  assert.equal(s.rows.find((r) => r.key === 'romper')!.qty, 0);
});

test('seasons come from the birth month and each size lands in a later season', () => {
  assert.deepEqual([0, 3, 6, 9, 11].map(seasonOfMonth), ['winter', 'spring', 'summer', 'fall', 'winter']);
  // born in July: newborn size in summer, 12-18M (age 12) the next summer-ish
  assert.equal(seasonForSize(6, 0), 'summer');
  assert.notEqual(seasonForSize(6, 0), seasonForSize(6, 3));
  assert.equal(seasonForSize(11, 0), 'winter');
});

test('combination strings round trip and reject bad input', () => {
  const x: Combo = { cats: ['lsb', 'pants', 'socks'], freq: 'some' };
  assert.deepEqual(parseCombo(comboToString(x)), x);
  assert.equal(parseCombo('nonsense~most'), null);
  assert.equal(parseCombo('lsb~bogus'), null);
  assert.deepEqual(parseCombo('lsb.lsb.pants~rare'), { cats: ['lsb', 'pants'], freq: 'rare' });
  assert.deepEqual(parseCombo('lsb.hacker~most'), { cats: ['lsb'], freq: 'most' });
});

test('answers survive a trip through the query string', () => {
  const a = base();
  a.laundry = 5; a.changes = 'two-three'; a.spare = 'several'; a.dressyPerWeek = '3-4'; a.hot = true; a.birthMonth = 8;
  a.stages.s1.day = [{ cats: ['sbs', 'pants'], freq: 'rare' }, { cats: ['footy'], freq: 'most' }];
  a.stages.s3.sleep = [];
  const qs = new URLSearchParams(answersToParams(a).toString());
  const back = parseAnswers((k) => qs.get(k), (k) => qs.getAll(k));
  assert.deepEqual(back, a);
});

test('first visit uses defaults; a touched form with nothing chosen really means nothing', () => {
  const mk = (s: string, m = 4) => {
    const p = new URLSearchParams(s);
    return parseAnswers((k) => p.get(k), (k) => p.getAll(k), m);
  };
  assert.deepEqual(mk(''), defaultAnswers(4));
  const touched = mk('touched=1');
  assert.deepEqual(touched.stages.s2.day, []);
  assert.equal(touched.laundry, 3);
});

test('parseAnswers clamps numbers and ignores unknown choices and extra combinations', () => {
  const p = new URLSearchParams('touched=1&laundry=999&birth=-4&changes=bogus&spare=bogus&dressy=bogus');
  for (let i = 0; i < 12; i++) p.append('s1_day', 'lsb~most');
  const a = parseAnswers((k) => p.get(k), (k) => p.getAll(k));
  assert.equal(a.laundry, 14);
  assert.equal(a.birthMonth, 0);
  assert.equal(a.changes, 'one-two');
  assert.equal(a.spare, 'few');
  assert.equal(a.dressyPerWeek, 'rare');
  assert.equal(a.stages.s1.day.length, 6);
});

test('defaults are independent copies, so editing one does not change the next', () => {
  const a = defaultStages();
  a.s1.day.push({ cats: ['top'], freq: 'rare' });
  assert.equal(defaultStages().s1.day.length, 2);
});
