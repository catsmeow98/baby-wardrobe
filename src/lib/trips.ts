/**
 * Shopping trips needing photos. Receiving a delivery (or "Bought & received" in the cart) puts a placeholder item in the
 * closet for each line, tagged with the trip; these helpers turn those rows into trips, and keep count while photos are
 * matched to the lines in bulk add. Pure: the queries live in trips-data.ts.
 */
export interface TripLine {
  /** The placeholder item in the closet. */
  itemId: string;
  categoryId: string;
  sizeId: string | null;
  labelId: string | null;
  /** Pieces still waiting for details. */
  qty: number;
}

export interface Trip {
  id: string;
  /** When the first piece was received (ISO). */
  at: string;
  lines: TripLine[];
  pieces: number;
}

export interface TripRow {
  trip_id: string;
  received_at: string;
  item: { id: string; category_id: string; fit_from_size_id: string | null; label_id: string | null; quantity: number } | null;
}

/** Rows (a receipt and its placeholder) to trips, newest first. Receipts whose placeholder is done (gone) are left out. */
export function groupTrips(rows: readonly TripRow[]): Trip[] {
  const byId = new Map<string, Trip>();
  for (const r of rows) {
    if (!r.item) continue;
    const t = byId.get(r.trip_id) ?? { id: r.trip_id, at: r.received_at, lines: [], pieces: 0 };
    if (r.received_at < t.at) t.at = r.received_at;
    t.lines.push({ itemId: r.item.id, categoryId: r.item.category_id, sizeId: r.item.fit_from_size_id, labelId: r.item.label_id, qty: r.item.quantity });
    t.pieces += r.item.quantity;
    byId.set(r.trip_id, t);
  }
  return [...byId.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Pieces still to match on each line, given what bulk add rows have taken (itemId and quantity per row). Can go negative. */
export function piecesLeft(lines: readonly TripLine[], uses: readonly { itemId: string; qty: number }[]): Map<string, number> {
  const left = new Map(lines.map((l) => [l.itemId, l.qty]));
  for (const u of uses) if (left.has(u.itemId)) left.set(u.itemId, left.get(u.itemId)! - u.qty);
  return left;
}

/** The line a new photo most likely shows: the first one with pieces left, in the trip's order ('' when all are matched). */
export function guessLine(lines: readonly TripLine[], left: ReadonlyMap<string, number>): string {
  return lines.find((l) => (left.get(l.itemId) ?? 0) > 0)?.itemId ?? '';
}

/** "Short-sleeve bodysuit ×3, Pants ×2" for a trip. */
export const tripSummary = (t: Trip, typeName: (categoryId: string) => string) =>
  t.lines.map((l) => `${typeName(l.categoryId)}${l.qty > 1 ? ` ×${l.qty}` : ''}`).join(', ');
