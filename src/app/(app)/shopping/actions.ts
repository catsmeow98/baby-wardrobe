'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';
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
  const { error } = await ctx.supabase.rpc('receive_shopping_item', { p_shopping_item: id.data, p_quantity: qty.data });
  if (error) return back(message(error, 'We could not record that delivery.'));
  refresh();
  return back(undefined, `${qty.data} added to your closet.`);
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
