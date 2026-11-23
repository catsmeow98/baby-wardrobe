// Mirrors the scenarios in supabase/tests/10_rls_and_rules.test.sql so the app and the database agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZE_GROUPS, TAG_SIZES, groupOfTag, displaySize, fitState, goalProgress, sizeProgress,
  orderItem, receive, ShoppingError, type InventoryItem, type Goal, type ShoppingItem,
} from './index';

const S36 = groupOfTag('3-6M')!;
const S69 = groupOfTag('6-9M')!;
const SBS = 'short-sleeve';
let n = 0;
const item = (o: Partial<InventoryItem>): InventoryItem => ({
  id: `i${++n}`, childId: 'c1', categoryId: SBS, quantity: 1, status: 'active', condition: 'good',
  fitFrom: S36, fitTo: S69, fitOverride: null, ...o,
});

test('size groups: a range and its top size are the same size', () => {
  assert.equal(SIZE_GROUPS.length, 10);
  assert.equal(TAG_SIZES.length, 16);
  assert.equal(groupOfTag('9M'), groupOfTag('6-9M'));
  assert.equal(groupOfTag('6M'), groupOfTag('3-6M'));
  assert.equal(groupOfTag('3M'), groupOfTag('0-3M'));
  assert.equal(groupOfTag('12M'), groupOfTag('9-12M'));
  assert.equal(groupOfTag('18M'), groupOfTag('12-18M'));
  assert.equal(groupOfTag('24M'), groupOfTag('18-24M'));
  assert.equal(groupOfTag(' 9m '), groupOfTag('6-9M'), 'tag lookup ignores case and spaces');
  assert.equal(groupOfTag('5X'), undefined);
  assert.equal(displaySize(S69), '6-9M (9M)');
  assert.equal(displaySize(0), 'Newborn');
  assert.throws(() => displaySize(99), RangeError);
});

test('fit state follows the child current size', () => {
  const cur = S36;
  assert.equal(fitState(item({ fitFrom: S36, fitTo: S69 }), cur), 'fits');
  assert.equal(fitState(item({ fitFrom: S69, fitTo: S69 }), cur), 'notyet');
  assert.equal(fitState(item({ fitFrom: 0, fitTo: 1 }), cur), 'outgrown');
  assert.equal(fitState(item({ fitFrom: 1, fitTo: S36 }), cur), 'small');
  assert.equal(fitState(item({ fitFrom: S36, fitTo: S36 }), cur), 'fits', 'a single-size item at the current size fits');
  assert.equal(fitState(item({ fitFrom: null, fitTo: null }), cur), 'unknown');
  assert.equal(fitState(item({ fitOverride: 'small' }), cur), 'small', 'override wins');
});

const items: InventoryItem[] = [
  item({ quantity: 5 }),
  item({ fitFrom: S69, fitTo: S69 }),
  item({ quantity: 2, status: 'stored' }),
  item({ quantity: 3, status: 'outgrown' }),
  item({ quantity: 4, condition: 'unusable' }),
  item({ quantity: 6, fitFrom: null, fitTo: null }),
  item({ quantity: 9, categoryId: 'bottoms', fitFrom: S36, fitTo: S36 }),
];
const goals: Goal[] = [
  { childId: 'c1', categoryId: SBS, size: S36, target: 12 },
  { childId: 'c1', categoryId: SBS, size: S69, target: 12 },
  { childId: 'c1', categoryId: 'bottoms', size: S36, target: 4 },
];
const shop = (o: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id: 's1', childId: 'c1', categoryId: SBS, size: S36, needed: 3, ordered: 0, received: 0, status: 'needed', ...o,
});
const find = (p: ReturnType<typeof goalProgress>, cat: string, size: number) =>
  p.find((x) => x.categoryId === cat && x.size === size)!;

test('goal progress counts the right pieces', () => {
  const p = goalProgress(goals, items, []);
  assert.deepEqual([find(p, SBS, S36).owned, find(p, SBS, S36).remaining], [7, 5]);
  assert.equal(find(p, SBS, S69).owned, 8, 'a piece counts toward every size in its range');
  assert.deepEqual([find(p, 'bottoms', S36).owned, find(p, 'bottoms', S36).remaining], [9, 0], 'remaining never below zero');
});

test('size progress caps each goal and never sums overlapping sizes', () => {
  const sp = sizeProgress(goalProgress(goals, items, []), 'c1', S36);
  assert.deepEqual(sp, { size: S36, goalTotal: 16, ownedTowardGoal: 11, percent: 69 });
  assert.equal(sizeProgress([], 'c1', S36).percent, null, 'no goals means no percentage');
});

test('incoming counts only open orders for the same category and size', () => {
  const needed = goalProgress(goals, items, [shop()]);
  assert.equal(find(needed, SBS, S36).incoming, 0, 'a needed item is not incoming');
  const ordered = goalProgress(goals, items, [shop({ ordered: 3, status: 'ordered' })]);
  assert.deepEqual([find(ordered, SBS, S36).incoming, find(ordered, SBS, S36).remaining], [3, 2]);
  assert.equal(find(ordered, SBS, S69).incoming, 0, 'other sizes do not count it');
  const cancelled = goalProgress(goals, items, [shop({ ordered: 3, status: 'cancelled' })]);
  assert.equal(find(cancelled, SBS, S36).incoming, 0);
});

test('shopping: order, partial receipt, then completion with no double counting', () => {
  assert.throws(() => receive(shop(), 1), ShoppingError, 'cannot receive before ordering');
  let s = orderItem(shop(), 3);
  assert.equal(s.status, 'ordered');

  const r1 = receive(s, 2);
  s = r1.item;
  assert.equal(s.status, 'partially_received');
  const inv = [...items, item({ quantity: r1.addToInventory.quantity, fitFrom: r1.addToInventory.size, fitTo: r1.addToInventory.size })];
  const mid = find(goalProgress(goals, inv, [s]), SBS, S36);
  assert.deepEqual([mid.owned, mid.incoming, mid.remaining], [9, 1, 2]);

  assert.throws(() => receive(s, 2), /outstanding/);
  const r2 = receive(s, 1);
  assert.equal(r2.item.status, 'received');
  const inv2 = [...inv, item({ quantity: 1, fitFrom: S36, fitTo: S36 })];
  const done = find(goalProgress(goals, inv2, [r2.item]), SBS, S36);
  assert.deepEqual([done.owned, done.incoming], [10, 0]);
  assert.throws(() => orderItem(r2.item, 5), /received item cannot be ordered/);
});

test('shopping validation', () => {
  assert.throws(() => orderItem(shop(), 0), ShoppingError);
  assert.throws(() => orderItem(shop(), 1.5), ShoppingError);
  assert.throws(() => orderItem(shop({ status: 'cancelled' }), 2), ShoppingError);
  assert.throws(() => orderItem(shop({ ordered: 3, received: 2, status: 'partially_received' }), 1), /already received/);
  assert.equal(orderItem(shop({ ordered: 3, received: 2, status: 'partially_received' }), 2).status, 'received');
});
