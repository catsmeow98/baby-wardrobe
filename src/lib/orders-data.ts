import type { Ctx } from '@/lib/context';

export interface OrderLine { item: string; categoryId: string; sizeId: string; ordered: number; received: number; status: string }
export interface OrderView { id: string; name: string; orderedAt: string; lines: OrderLine[]; outstanding: number }

/** A child's orders with something still to arrive, oldest first. */
export async function loadOpenOrders(ctx: Ctx, childId: string): Promise<OrderView[]> {
  const { data, error } = await ctx.supabase
    .from('shopping_orders')
    .select('id, name, ordered_at, items:shopping_items(id, category_id, size_id, quantity_ordered, quantity_received, status)')
    .eq('child_id', childId)
    .order('ordered_at');
  if (error) {
    console.error('Could not load orders', error);
    return [];
  }
  type Row = { id: string; name: string; ordered_at: string; items: { id: string; category_id: string; size_id: string; quantity_ordered: number; quantity_received: number; status: string }[] };
  return ((data ?? []) as unknown as Row[])
    .map((o) => {
      const lines = o.items
        .filter((i) => i.status !== 'cancelled')
        .map((i) => ({ item: i.id, categoryId: i.category_id, sizeId: i.size_id, ordered: i.quantity_ordered, received: i.quantity_received, status: i.status }));
      const outstanding = lines.reduce((t, l) => t + (['ordered', 'partially_received'].includes(l.status) ? Math.max(0, l.ordered - l.received) : 0), 0);
      return { id: o.id, name: o.name, orderedAt: o.ordered_at, lines, outstanding };
    })
    .filter((o) => o.outstanding > 0);
}
