import type { Ctx } from '@/lib/context';

export interface HistoryLine { categoryId: string; sizeId: string; qty: number; cancelled: number }
export interface HistoryEntry {
  key: string;
  kind: 'order' | 'store' | 'earlier';
  /** The order's or trip's name; none for in-store trips without one and for earlier entries. */
  name?: string;
  /** When it was ordered (orders) or bought (in store), or the day (earlier). ISO. */
  at: string;
  lines: HistoryLine[];
}

type ItemRow = { id: string; category_id: string; size_id: string; quantity_ordered: number; quantity_received: number; quantity_needed: number; status: string; order_id: string | null; updated_at: string };

/** Adds a line, merging the same item type and size. */
function add(lines: HistoryLine[], l: HistoryLine) {
  const same = lines.find((x) => x.categoryId === l.categoryId && x.sizeId === l.sizeId);
  if (same) {
    same.qty += l.qty;
    same.cancelled += l.cancelled;
  } else lines.push({ ...l });
}

/**
 * Finished shopping, newest first: orders with nothing left to arrive, in-store trips ("Bought & received"), and older
 * finished entries from before orders existed, grouped by day. At most `limit` entries.
 */
export async function loadHistory(ctx: Ctx, childId: string, limit = 30): Promise<HistoryEntry[]> {
  const [{ data: orders }, { data: items }, { data: receipts }] = await Promise.all([
    ctx.supabase.from('shopping_orders').select('id, name, ordered_at').eq('child_id', childId),
    ctx.supabase.from('shopping_items').select('id, category_id, size_id, quantity_ordered, quantity_received, quantity_needed, status, order_id, updated_at').eq('child_id', childId),
    ctx.supabase.from('shopping_receipts').select('shopping_item_id, trip_id, trip_name, received_at, quantity_received'),
  ]);
  const rows = (items ?? []) as ItemRow[];
  const mine = new Set(rows.map((r) => r.id));
  const recs = ((receipts ?? []) as { shopping_item_id: string; trip_id: string | null; trip_name: string | null; received_at: string; quantity_received: number }[])
    .filter((r) => mine.has(r.shopping_item_id));
  const out: HistoryEntry[] = [];

  // Orders: done once nothing is still to arrive.
  for (const o of (orders ?? []) as { id: string; name: string; ordered_at: string }[]) {
    const its = rows.filter((r) => r.order_id === o.id);
    if (!its.length || its.some((r) => r.status === 'ordered' || r.status === 'partially_received' || r.status === 'needed')) continue;
    const lines: HistoryLine[] = [];
    for (const r of its) {
      add(lines, { categoryId: r.category_id, sizeId: r.size_id, qty: r.quantity_received, cancelled: r.status === 'cancelled' ? r.quantity_ordered - r.quantity_received : 0 });
    }
    out.push({ key: `o:${o.id}`, kind: 'order', name: o.name, at: o.ordered_at, lines });
  }

  // In-store trips: received in a trip, not part of an order.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const trips = new Map<string, HistoryEntry>();
  const inTrip = new Set<string>();
  for (const r of recs) {
    const it = byId.get(r.shopping_item_id);
    if (!it || it.order_id || !r.trip_id) continue;
    inTrip.add(it.id);
    const t = trips.get(r.trip_id) ?? { key: `t:${r.trip_id}`, kind: 'store' as const, name: r.trip_name ?? undefined, at: r.received_at, lines: [] };
    if (r.received_at < t.at) t.at = r.received_at;
    if (!t.name && r.trip_name) t.name = r.trip_name;
    add(t.lines, { categoryId: it.category_id, sizeId: it.size_id, qty: r.quantity_received, cancelled: 0 });
    trips.set(r.trip_id, t);
  }
  out.push(...trips.values());

  // Earlier: finished entries with no order and no trip, by the day they were last changed.
  const days = new Map<string, HistoryEntry>();
  for (const r of rows) {
    if (r.order_id || inTrip.has(r.id) || !['received', 'cancelled'].includes(r.status)) continue;
    const day = r.updated_at.slice(0, 10);
    const e = days.get(day) ?? { key: `d:${day}`, kind: 'earlier' as const, at: r.updated_at, lines: [] };
    add(e.lines, {
      categoryId: r.category_id, sizeId: r.size_id, qty: r.quantity_received,
      cancelled: r.status === 'cancelled' ? Math.max(r.quantity_ordered, r.quantity_needed) - r.quantity_received : 0,
    });
    days.set(day, e);
  }
  out.push(...days.values());

  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);
}
