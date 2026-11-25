import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesCategory, withCurrent } from './categories';
import type { CategoryRow } from './db';

const mk = (id: string, group_id: string): CategoryRow => ({ id, name: id, base_name: id, sort_order: 0, group_id, grp: group_id, group_order: 0, owner_id: null, is_default: true, hidden: false });
const a = mk('a', 'g1');
const b = mk('b', 'g2');

test('matchesCategory: empty filter passes everything', () => {
  assert.equal(matchesCategory(a, {}), true);
  assert.equal(matchesCategory(undefined, {}), true);
});
test('matchesCategory: item category and item type narrow the list', () => {
  assert.equal(matchesCategory(a, { group: 'g1' }), true);
  assert.equal(matchesCategory(b, { group: 'g1' }), false);
  assert.equal(matchesCategory(a, { cat: 'a' }), true);
  assert.equal(matchesCategory(a, { group: 'g2', cat: 'a' }), false);
  assert.equal(matchesCategory(undefined, { cat: 'a' }), false);
});
test('withCurrent: keeps a deleted item type pickable only for the record that uses it', () => {
  const all = new Map([[a.id, a], [b.id, b]]);
  assert.deepEqual(withCurrent([a], all, 'b').map((c) => c.id), ['a', 'b']);
  assert.deepEqual(withCurrent([a], all, 'a').map((c) => c.id), ['a']);
  assert.deepEqual(withCurrent([a], all, undefined).map((c) => c.id), ['a']);
});
