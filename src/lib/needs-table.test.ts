import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNeedsTable } from './needs-table';

test('needs table: cells, totals, ordering', () => {
  const t = buildNeedsTable(
    [
      { categoryId: 'coat', size: 4, remaining: 1 },
      { categoryId: 'top', size: 3, remaining: 5 },
      { categoryId: 'top', size: 4, remaining: 2 },
      { categoryId: 'socks', size: 3, remaining: 6 },
      { categoryId: 'hat', size: 3, remaining: 0 },
    ],
    ['top', 'coat', 'socks', 'hat'],
  );
  assert.deepEqual(t.sizes, [3, 4]);
  assert.deepEqual(t.rows.map((r) => r.categoryId), ['top', 'coat', 'socks'], 'follows the given type order; a type with nothing needed is left out');
  assert.equal(t.rows[0].cells.get(3), 5);
  assert.equal(t.rows[0].cells.get(4), 2);
  assert.equal(t.rows[0].total, 7);
  assert.equal(t.rows[1].cells.get(3), undefined, 'no need in that size');
  assert.equal(t.columnTotals.get(3), 11);
  assert.equal(t.columnTotals.get(4), 3);
  assert.equal(t.grandTotal, 14);
});

test('needs table: empty, unknown types last, repeated gaps add up', () => {
  const none = buildNeedsTable([], ['top']);
  assert.deepEqual(none.sizes, []);
  assert.equal(none.rows.length, 0);
  assert.equal(none.grandTotal, 0);
  const t = buildNeedsTable([{ categoryId: 'x', size: 2, remaining: 1 }, { categoryId: 'top', size: 2, remaining: 1 }, { categoryId: 'top', size: 2, remaining: 2 }], ['top']);
  assert.deepEqual(t.rows.map((r) => r.categoryId), ['top', 'x']);
  assert.equal(t.rows[0].cells.get(2), 3);
});
