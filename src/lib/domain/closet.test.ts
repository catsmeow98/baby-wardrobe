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
  assert.deepEqual(names({ fits: ['notyet'] }), ['Snowsuit']);
  assert.deepEqual(names({ fits: ['outgrown'] }), ['Old sleeper']);
  assert.deepEqual(names({ statuses: ['outgrown'] }), ['Old sleeper']);
  assert.deepEqual(names({ seasons: ['winter'], categoryIds: ['b'] }), ['Snowsuit']);
  assert.deepEqual(names({ tagGroups: [3] }), ['Snowsuit']);
  assert.deepEqual(names({ fits: ['notyet', 'outgrown'] }), ['Snowsuit', 'Old sleeper'], 'several fits: any of them');
  assert.deepEqual(names({ statuses: ['active', 'outgrown'], tagGroups: [0, 3] }), ['Snowsuit', 'Old sleeper']);
  assert.deepEqual(names({ fits: ['unknown'] }, null), ['White bodysuits', 'Snowsuit', 'Old sleeper'], 'no current size means unknown fit');
  assert.equal(fitStateFor(it({ fitOverride: 'fits' }), null), 'fits');
});

test('a current size range: overlapping items fit, others are not yet or outgrown', () => {
  // Sizes by order: 2 = 3-6M, 3 = 6-9M. The child is between them.
  assert.equal(fitStateFor(it({ fitFrom: 3, fitTo: 3 }), 2, 3), 'fits', 'a next-size piece fits while between sizes');
  assert.equal(fitStateFor(it({ fitFrom: 3, fitTo: 3 }), 2), 'notyet', 'with a single size it is not yet');
  assert.equal(fitStateFor(it({ fitFrom: 1, fitTo: 2 }), 2, 3), 'fits', 'a smaller piece still fits at the bottom of the range');
  assert.equal(fitStateFor(it({ fitFrom: 0, fitTo: 1 }), 2, 3), 'outgrown');
  assert.equal(fitStateFor(it({ fitFrom: 4, fitTo: 5 }), 2, 3), 'notyet');
  assert.equal(fitStateFor(it({ fitFrom: 3, fitTo: 3 }), 2, 1), 'notyet', 'a top below the bottom is treated as a single size');
  assert.equal(fitStateFor(it({ fitFrom: 3, fitTo: 3 }), 2, null), 'notyet');
});
