'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext, toInventory } from '@/lib/context';
import { countsTowardSize } from '@/lib/domain';
import { signedUrls } from '@/lib/photos';
import { sizeName } from '@/lib/db';
import type { ItemRow } from '@/lib/db';
import { safeBack, withParams } from '@/lib/back';

/** Returns to the shopping list with the filters the person had, plus a message. */
const backFor = (formData: FormData) => (error?: string, ok?: string): never =>
  redirect(withParams(safeBack(formData.get('back'), '/shopping'), { error, ok: error ? undefined : ok }));
const refresh = () => ['/shopping', '/goals', '/closet', '/dashboard'].forEach((p) => revalidatePath(p));
const uuid = z.string().uuid();
const qtyOf = (v: FormDataEntryValue | null) => z.coerce.number().int().min(1).max(999).safeParse(v);

/** The database raises plain-language messages (code 22023) for rule breaks; anything else stays generic. */
const message = (e: { code?: string; message?: string }, fallback: string) => (e.code === '22023' && e.message ? e.message : fallback);

export async function orderFromGap(formData: FormData) {
  const back = backFor(formData);
  const cat = uuid.safeParse(formData.get('categoryId'));
  const size = uuid.safeParse(formData.get('sizeId'));
  const qty = qtyOf(formData.get('quantity'));
  if (!cat.success || !size.success || !qty.success) return back('Enter a quantity of 1 or more.');
  const ctx = await getContext();
  if (!ctx.active) return back('Add a child first.');
  const { data, error } = await ctx.supabase
    .from('shopping_items')
    .insert({ child_id: ctx.active.id, category_id: cat.data, size_id: size.data, quantity_needed: qty.data, notes: 'From goals' })
    .select('id')
    .single();
  if (error || !data) return back('We could not add that to your list.');
  const { error: e2 } = await ctx.supabase.rpc('order_shopping_item', { p_shopping_item: data.id, p_quantity: qty.data });
  if (e2) return back(message(e2, 'We could not mark that as ordered.'));
  refresh();
  return back(undefined, 'Marked as ordered. It now counts as incoming.');
}

export async function addShoppingItem(formData: FormData) {
  const back = backFor(formData);
  const parsed = z
    .object({
      categoryId: uuid,
      sizeId: uuid,
      quantity: z.coerce.number().int().min(1).max(999),
      priority: z.enum(['low', 'medium', 'high']),
      price: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().min(0).max(100000).optional()),
      notes: z.string().trim().max(500).default(''),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return back('Check the item type, size, quantity and price.');
  const ctx = await getContext();
  if (!ctx.active) return back('Add a child first.');
  const v = parsed.data;
  const { error } = await ctx.supabase.from('shopping_items').insert({
    child_id: ctx.active.id, category_id: v.categoryId, size_id: v.sizeId, quantity_needed: v.quantity,
    priority: v.priority, estimated_price: v.price ?? null, notes: v.notes || null,
  });
  if (error) return back('We could not add that to your list.');
  refresh();
  return back(undefined, 'Added to your list.');
}

export async function markOrdered(formData: FormData) {
  const back = backFor(formData);
  const id = uuid.safeParse(formData.get('id'));
  const qty = qtyOf(formData.get('quantity'));
  if (!id.success || !qty.success) return back('Enter a quantity of 1 or more.');
  const ctx = await getContext();
  const { error } = await ctx.supabase.rpc('order_shopping_item', { p_shopping_item: id.data, p_quantity: qty.data });
  if (error) return back(message(error, 'We could not mark that as ordered.'));
  refresh();
  return back(undefined, 'Marked as ordered.');
}

export async function receiveDelivery(formData: FormData) {
  const back = backFor(formData);
  const id = uuid.safeParse(formData.get('id'));
  const qty = qtyOf(formData.get('quantity'));
  if (!id.success || !qty.success) return back('Enter a quantity of 1 or more.');
  const ctx = await getContext();
  // Each receive is a trip, so its pieces can get photos and details together later (see bulk add).
  const trip = crypto.randomUUID();
  const { error } = await ctx.supabase.rpc('receive_shopping_item', { p_shopping_item: id.data, p_quantity: qty.data, p_trip: trip });
  if (error) return back(message(error, 'We could not record that delivery.'));
  refresh();
  return redirect(withParams(safeBack(formData.get('back'), '/shopping'), { ok: `${qty.data} added to your closet.`, trip }));
}

export async function cancelItem(formData: FormData) {
  const back = backFor(formData);
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return back('That item could not be found.');
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('shopping_items').update({ status: 'cancelled' }).eq('id', id.data);
  if (error) return back('We could not cancel that item.');
  refresh();
  return back(undefined, 'Cancelled.');
}

const cartLineSchema = z.object({ categoryId: uuid, sizeId: uuid, qty: z.number().int().min(1).max(99) });

/**
 * "Mark bought" for the in-store cart: each line goes on the shopping list as ordered (the same path as Order on a gap), so it
 * counts as incoming until it is received. Returns which lines were saved, so the page clears only those from the cart.
 */
export async function markCartBought(lines: unknown, name?: unknown): Promise<{ saved: string[]; error?: string }> {
  const parsed = z.array(cartLineSchema).min(1).max(100).safeParse(lines);
  if (!parsed.success) return { saved: [], error: 'The cart could not be read. Try again.' };
  const res = await placeOrder(name, parsed.data.map((l) => ({ categoryId: l.categoryId, sizeId: l.sizeId, qty: l.qty, notes: 'From the store cart' })));
  return res.ok ? { saved: parsed.data.map((l) => `${l.categoryId}|${l.sizeId}`) } : { saved: [], error: res.error };
}

const orderNameSchema = z.string().trim().min(1).max(80);
const orderLineSchema = z.union([
  z.object({ item: uuid, qty: z.number().int().min(1).max(999) }),
  z.object({ categoryId: uuid, sizeId: uuid, qty: z.number().int().min(1).max(999), notes: z.string().max(200).optional() }),
]);

/**
 * Places a named order (one tap = one order): list entries ({item}) and new lines from goal gaps or the cart ({categoryId,
 * sizeId}), all marked ordered together so they count as incoming.
 */
export async function placeOrder(name: unknown, lines: unknown): Promise<{ ok: boolean; error?: string }> {
  const n = orderNameSchema.safeParse(name);
  const ls = z.array(orderLineSchema).min(1).max(100).safeParse(lines);
  if (!n.success) return { ok: false, error: 'Give the order a name (up to 80 characters).' };
  if (!ls.success) return { ok: false, error: 'Choose what was ordered, with quantities of 1 or more.' };
  const ctx = await getContext();
  if (!ctx.active) return { ok: false, error: 'Add a child first.' };
  const payload = ls.data.map((l) => ('item' in l ? { item: l.item, qty: l.qty } : { category_id: l.categoryId, size_id: l.sizeId, qty: l.qty, notes: l.notes ?? 'From goals' }));
  const { error } = await ctx.supabase.rpc('place_order', { p_child: ctx.active.id, p_name: n.data, p_lines: payload });
  if (error) return { ok: false, error: message(error, 'We could not place that order.') };
  refresh();
  return { ok: true };
}

/** Receives some or all of an order as one trip, named after the order ("- part N" when it comes in parts). */
export async function receiveOrder(orderId: unknown, lines: unknown): Promise<{ trip?: string; name?: string; error?: string }> {
  const id = uuid.safeParse(orderId);
  const ls = z.array(z.object({ item: uuid, qty: z.number().int().min(0).max(999) })).min(1).max(100).safeParse(lines);
  if (!id.success || !ls.success) return { error: 'Choose what arrived.' };
  const wanted = ls.data.filter((l) => l.qty > 0);
  if (!wanted.length) return { error: 'Choose what arrived.' };
  const ctx = await getContext();
  const trip = crypto.randomUUID();
  const { data, error } = await ctx.supabase.rpc('receive_order', { p_order: id.data, p_lines: wanted, p_trip: trip });
  if (error) return { error: message(error, 'We could not record that delivery.') };
  refresh();
  return { trip, name: data as string };
}

export async function renameOrder(formData: FormData) {
  const back = backFor(formData);
  const id = uuid.safeParse(formData.get('id'));
  const n = orderNameSchema.safeParse(formData.get('name'));
  if (!id.success || !n.success) return back('Give the order a name (up to 80 characters).');
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('shopping_orders').update({ name: n.data }).eq('id', id.data);
  if (error) return back('We could not rename that order.');
  refresh();
  return back(undefined, 'Order renamed.');
}

export interface ClosetPiece { id: string; name: string; brand: string | null; quantity: number; fits: string; photoUrl: string | null; cutout: boolean }

/**
 * The closet pieces behind "N in closet" for one item type and size: exactly the ones the goal count uses (usable, with a fit
 * range that includes the size). Loaded when asked for, with a small photo each.
 */
export async function closetPieces(categoryId: unknown, sizeId: unknown): Promise<{ pieces: ClosetPiece[]; error?: string }> {
  const cat = uuid.safeParse(categoryId);
  const size = uuid.safeParse(sizeId);
  if (!cat.success || !size.success) return { pieces: [], error: 'That item could not be found.' };
  const ctx = await getContext();
  if (!ctx.active) return { pieces: [], error: 'Add a child first.' };
  const order = ctx.orderOf.get(size.data);
  if (order === undefined) return { pieces: [], error: 'That size could not be found.' };
  const { data, error } = await ctx.supabase.from('inventory_items').select('*').eq('child_id', ctx.active.id).eq('category_id', cat.data);
  if (error) return { pieces: [], error: 'Your closet could not be loaded. Try again.' };
  const rows = (data ?? []) as ItemRow[];
  const items = toInventory(rows, ctx);
  const keep = items.map((i, n) => ({ i, row: rows[n] })).filter(({ i }) => countsTowardSize(i, order));
  if (keep.length === 0) return { pieces: [] };
  const ids = keep.map(({ row }) => row.id);
  const [{ data: photoRows }, { data: brandRows }] = await Promise.all([
    ctx.supabase.from('inventory_photos').select('inventory_item_id, storage_path, sort_order').in('inventory_item_id', ids).order('sort_order'),
    ctx.supabase.from('brands').select('id, name'),
  ]);
  const cover = new Map<string, string>();
  for (const p of (photoRows ?? []) as { inventory_item_id: string; storage_path: string }[]) if (!cover.has(p.inventory_item_id)) cover.set(p.inventory_item_id, p.storage_path);
  const urls = await signedUrls(ctx.supabase, [...cover.values()]);
  const brandById = new Map(((brandRows ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name]));
  const sizeText = (o: number | null) => (o === null ? null : ctx.sizeByOrder.get(o));
  return {
    pieces: keep.map(({ i, row }) => {
      const a = sizeText(i.fitFrom);
      const b = sizeText(i.fitTo);
      const path = cover.get(row.id);
      return {
        id: row.id,
        name: row.name,
        brand: row.brand_id ? (brandById.get(row.brand_id) ?? null) : null,
        quantity: row.quantity,
        fits: a && b ? (a.id === b.id ? sizeName(a) : `${sizeName(a)} to ${sizeName(b)}`) : 'Unknown',
        photoUrl: path ? (urls.get(path) ?? null) : null,
        cutout: Boolean(path?.endsWith('.png')),
      };
    }),
  };
}

/**
 * "Bought & received" for the in-store cart: each line goes on the shopping list as ordered and received at once, all in one
 * trip, so the pieces are in the closet (as placeholders) and can get photos and details together. Returns the lines saved
 * and the trip.
 */
export async function receiveCart(lines: unknown, name?: unknown): Promise<{ saved: string[]; trip: string | null; error?: string }> {
  const parsed = z.array(cartLineSchema).min(1).max(100).safeParse(lines);
  if (!parsed.success) return { saved: [], trip: null, error: 'The cart could not be read. Try again.' };
  const ctx = await getContext();
  if (!ctx.active) return { saved: [], trip: null, error: 'Add a child first.' };
  const known = new Set(ctx.sizes.map((s) => s.id));
  const trip = crypto.randomUUID();
  const saved: string[] = [];
  for (const l of parsed.data) {
    if (!known.has(l.sizeId) || !ctx.catById.has(l.categoryId)) continue;
    const { data, error } = await ctx.supabase
      .from('shopping_items')
      .insert({ child_id: ctx.active.id, category_id: l.categoryId, size_id: l.sizeId, quantity_needed: l.qty, notes: 'Bought in store' })
      .select('id')
      .single();
    if (error || !data) break;
    const { error: e2 } = await ctx.supabase.rpc('order_shopping_item', { p_shopping_item: data.id, p_quantity: l.qty });
    const { error: e3 } = e2 ? { error: e2 } : await ctx.supabase.rpc('receive_shopping_item', { p_shopping_item: data.id, p_quantity: l.qty, p_trip: trip });
    if (e3) {
      await ctx.supabase.from('shopping_items').delete().eq('id', data.id);
      break;
    }
    saved.push(`${l.categoryId}|${l.sizeId}`);
  }
  // The trip's name: the one given, or none (the Home screen then shows its date and time).
  const tripName = orderNameSchema.safeParse(name);
  if (saved.length && tripName.success) await ctx.supabase.from('shopping_receipts').update({ trip_name: tripName.data }).eq('trip_id', trip);
  if (saved.length) refresh();
  const done = saved.length ? trip : null;
  return saved.length === parsed.data.length
    ? { saved, trip: done }
    : { saved, trip: done, error: `${saved.length} of ${parsed.data.length} cart lines were saved. The rest are still in the cart; try again.` };
}
