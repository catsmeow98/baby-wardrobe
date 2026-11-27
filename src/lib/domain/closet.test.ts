import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFitRange, autoName, filterItems, fitStateFor, type ClosetItem } from './index';

test('resolveFitRange defaults from the tag size', () => {
  assert.deepEqual(resolveFitRange(null, null, null), { fitFrom: null, fitTo: null }, 'nothing picked means unknown');
  assert.deepEqual(resolveFitRange(3, null, null), { fitFrom: 3, fitTo: 3 });
  assert.deepEqual(resolveFitRange(3, null, 5), { fitFrom: 3, fitTo: 5 });
  assert.deepEqual(resolveFitRange(3, 2, 4), { fitFrom: 2, fitTo: 4 });
  assert.deepEqual(resolveFitRange(null, 2, null), { fitFrom: 2, fitTo: 2 });
  assert.deepEqual(resolveFitRange(null, null, 4), { fitFrom: 4, fitTo: 4 });
  assert.ok('error' in resolveFitRange(3, 4, 2));
  assert.ok('error' in resolveFitRange(5, null, 3), 'through below the tag size is rejected');
});

test('autoName', () => {
  assert.equal(autoName('Striped bodysuits', "Carter's", 'Tops'), 'Striped bodysuits');
  assert.equal(autoName('  ', "Carter's", 'Footy sleepers'), "Carter's footy sleepers");
  assert.equal(autoName('', '', 'Swaddles'), 'Swaddles');
});

let n = 0;
const it = (o: Partial<ClosetItem>): ClosetItem => ({
  id: `i${++n}`, childId: 'c', categoryId: 'a', quantity: 1, status: 'active', condition: 'good',
  fitFrom: 2, fitTo: 3, fitOverride: null, name: 'Item', brand: null, notes: null, season: 'year_round', tagGroup: 2, ...o,
});

test('filters combine', () => {
  const items = [
    it({ name: 'White bodysuits', brand: "Carter's" }),
    it({ name: 'Snowsuit', categoryId: 'b', season: 'winter', fitFrom: 3, fitTo: 3, tagGroup: 3 }),
    it({ name: 'Old sleeper', status: 'outgrown', fitFrom: 0, fitTo: 1, tagGroup: 0 }),
  ];
  const names = (f: Parameters<typeof filterItems>[1], cur: number | null = 2) => filterItems(items, f, cur).map((x) => x.name);
  assert.deepEqual(names({}), ['White bodysuits', 'Snowsuit', 'Old sleeper']);
  assert.deepEqual(names({ q: 'carter' }), ['White bodysuits']);
  assert.deepEqual(names({ fit: 'notyet' }), ['Snowsuit']);
  assert.deepEqual(names({ fit: 'outgrown' }), ['Old sleeper']);
  assert.deepEqual(names({ status: 'outgrown' }), ['Old sleeper']);
  assert.deepEqual(names({ season: 'winter', categoryId: 'b' }), ['Snowsuit']);
  assert.deepEqual(names({ tagGroup: 3 }), ['Snowsuit']);
  assert.deepEqual(names({ fit: 'unknown' }, null), ['White bodysuits', 'Snowsuit', 'Old sleeper'], 'no current size means unknown fit');
  assert.equal(fitStateFor(it({ fitOverride: 'fits' }), null), 'fits');
});
