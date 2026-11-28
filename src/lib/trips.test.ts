import test from 'node:test';
import assert from 'node:assert/strict';
import { groupTrips, guessLine, piecesLeft, tripSummary, type TripRow } from './trips';

const item = (id: string, cat: string, qty: number) => ({ id, category_id: cat, fit_from_size_id: 's1', label_id: null, quantity: qty });

test('trips: grouped by trip, newest first, done lines left out', () => {
  const rows: TripRow[] = [
    { trip_id: 'a', received_at: '2026-11-27T18:00:00Z', item: item('p1', 'body', 3) },
    { trip_id: 'a', received_at: '2026-11-27T17:59:00Z', item: item('p2', 'pants', 2) },
    { trip_id: 'b', received_at: '2026-11-28T10:00:00Z', item: item('p3', 'hat', 1) },
    { trip_id: 'b', received_at: '2026-11-28T10:00:00Z', item: null },
    { trip_id: 'c', received_at: '2026-11-29T10:00:00Z', item: null },
  ];
  const t = groupTrips(rows);
  assert.deepEqual(t.map((x) => x.id), ['b', 'a'], 'a trip with nothing left is not shown');
  assert.equal(t[1].at, '2026-11-27T17:59:00Z', 'a trip starts at its first receipt');
  assert.equal(t[1].pieces, 5);
  assert.equal(tripSummary(t[1], (c) => ({ body: 'Bodysuit', pants: 'Pants' })[c] ?? c), 'Bodysuit ×3, Pants ×2');
});

test('trips: pieces left and the next guess', () => {
  const lines = groupTrips([
    { trip_id: 'a', received_at: 'x', item: item('p1', 'body', 3) },
    { trip_id: 'a', received_at: 'x', item: item('p2', 'pants', 2) },
  ])[0].lines;
  let left = piecesLeft(lines, []);
  assert.equal(guessLine(lines, left), 'p1');
  left = piecesLeft(lines, [{ itemId: 'p1', qty: 1 }, { itemId: 'p1', qty: 2 }]);
  assert.equal(left.get('p1'), 0);
  assert.equal(guessLine(lines, left), 'p2', 'one photo per piece: the next photo goes to the next line');
  left = piecesLeft(lines, [{ itemId: 'p1', qty: 3 }, { itemId: 'p2', qty: 3 }, { itemId: 'other', qty: 1 }]);
  assert.equal(left.get('p2'), -1, 'over-matching shows as negative');
  assert.equal(guessLine(lines, left), '');
});

test('trips: the name comes from the receipts', () => {
  const t = groupTrips([
    { trip_id: 'a', received_at: 'x', trip_name: null, item: item('p1', 'body', 1) },
    { trip_id: 'a', received_at: 'x', trip_name: 'Old Navy sale – part 2', item: item('p2', 'pants', 1) },
    { trip_id: 'b', received_at: 'y', item: item('p3', 'hat', 1) },
  ]);
  assert.equal(t.find((x) => x.id === 'a')?.name, 'Old Navy sale – part 2');
  assert.equal(t.find((x) => x.id === 'b')?.name, undefined, 'older trips have no name');
});

test('trips: the summary has sizes and adds up lines of the same type and size', () => {
  const t = groupTrips([
    { trip_id: 'a', received_at: 'x', item: { id: 'p1', category_id: 'ls', fit_from_size_id: 's69', label_id: null, quantity: 3 } },
    { trip_id: 'a', received_at: 'x', item: { id: 'p2', category_id: 'ls', fit_from_size_id: 's912', label_id: null, quantity: 1 } },
    { trip_id: 'a', received_at: 'x', item: { id: 'p3', category_id: 'ls', fit_from_size_id: 's69', label_id: null, quantity: 1 } },
  ])[0];
  const sizes: Record<string, string> = { s69: '6-9M', s912: '9-12M' };
  assert.equal(tripSummary(t, () => 'Long-sleeve bodysuit', (id) => sizes[id]), 'Long-sleeve bodysuit 6-9M ×4, Long-sleeve bodysuit 9-12M');
});
