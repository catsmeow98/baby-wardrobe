import type { Ctx } from '@/lib/context';
import { groupTrips, type Trip, type TripRow } from '@/lib/trips';

/**
 * A child's shopping trips that still have received pieces waiting for photos and details (newest first), or just one trip.
 * Each receipt carries its trip; its placeholder item still needs details until bulk add replaces it.
 */
export async function loadTrips(ctx: Ctx, childId: string, tripId?: string): Promise<Trip[]> {
  let q = ctx.supabase
    .from('shopping_receipts')
    .select('trip_id, received_at, trip_name, item:inventory_items!inner(id, category_id, fit_from_size_id, label_id, quantity, needs_details, child_id)')
    .not('trip_id', 'is', null)
    .eq('item.needs_details', true)
    .eq('item.child_id', childId);
  if (tripId) q = q.eq('trip_id', tripId);
  const { data, error } = await q;
  if (error) {
    console.error('Could not load shopping trips', error);
    return [];
  }
  return groupTrips((data ?? []) as unknown as TripRow[]);
}

/** The trip a placeholder item came from, if it still needs details. */
export async function tripOfItem(ctx: Ctx, itemId: string): Promise<string | null> {
  const { data } = await ctx.supabase.from('shopping_receipts').select('trip_id').eq('inventory_item_id', itemId).not('trip_id', 'is', null).maybeSingle();
  return (data?.trip_id as string | undefined) ?? null;
}
