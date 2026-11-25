'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';

const fail = (m: string): never => redirect(`/categories?error=${encodeURIComponent(m)}`);
const ok = (m: string): never => redirect(`/categories?ok=${encodeURIComponent(m)}`);
const refresh = () => ['/categories', '/closet', '/goals', '/shopping', '/dashboard'].forEach((p) => revalidatePath(p));
const itemName = z.string().trim().min(1, 'Enter an item name.').max(60, 'Use 60 characters or fewer.');
const groupName = z.string().trim().min(1, 'Enter a category name.').max(60, 'Use 60 characters or fewer.');
const uuid = z.string().uuid();
const CUSTOM_ORDER = 1000; // custom items and categories sort after the built-in ones

/**
 * Terms: a CATEGORY (Sleep, Outerwear) holds ITEMS (Sleep sack, Coat). In the database an item is a row of
 * "categories" and a category is a row of "category_groups". The database refuses duplicate and built-in names and
 * caps the counts; its messages are written for people.
 */
const dbMessage = (e: { code?: string; message?: string }, fallback: string, what: 'item' | 'category') => {
  if (e.code === '23505') return e.message?.includes('built-in') ? e.message : `You already have a${what === 'item' ? 'n item' : ' category'} with that name.`;
  if (e.code === '22023' && e.message) return e.message;
  return fallback;
};

/* ---- items ---- */
export async function addCategory(formData: FormData) {
  const n = itemName.safeParse(formData.get('name'));
  const g = uuid.safeParse(formData.get('groupId'));
  if (!n.success) return fail(n.error.issues[0].message);
  if (!g.success) return fail('Choose a category for the item.');
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('categories').insert({ name: n.data, owner_id: ctx.user.id, group_id: g.data, sort_order: CUSTOM_ORDER });
  if (error) return fail(dbMessage(error, 'We could not add that item.', 'item'));
  refresh();
  return ok(`${n.data} added.`);
}

export async function renameCategory(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  const n = itemName.safeParse(formData.get('name'));
  if (!id.success) return fail('That item could not be found.');
  if (!n.success) return fail(n.error.issues[0].message);
  const ctx = await getContext();
  // Row-level security only lets the owner change an item, so a built-in one matches no rows.
  const { data, error } = await ctx.supabase.from('categories').update({ name: n.data }).eq('id', id.data).select('id');
  if (error) return fail(dbMessage(error, 'We could not rename that item.', 'item'));
  if (!data?.length) return fail('That item cannot be changed.');
  refresh();
  return ok('Item renamed.');
}

export async function moveCategory(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  const g = uuid.safeParse(formData.get('groupId'));
  if (!id.success || !g.success) return fail('That item or category could not be found.');
  const ctx = await getContext();
  const { data, error } = await ctx.supabase.from('categories').update({ group_id: g.data }).eq('id', id.data).select('id');
  if (error) return fail(dbMessage(error, 'We could not move that item.', 'item'));
  if (!data?.length) return fail('That item cannot be changed.');
  refresh();
  return ok('Item moved.');
}

export async function deleteCategory(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return fail('That item could not be found.');
  const ctx = await getContext();
  const { data, error } = await ctx.supabase.from('categories').delete().eq('id', id.data).select('id');
  if (error?.code === '23503') return fail('Closet items, goals or shopping entries still use that item. Move or delete them first.');
  if (error || !data?.length) return fail('We could not delete that item.');
  refresh();
  return ok('Item deleted.');
}

/* ---- categories ---- */
export async function addGroup(formData: FormData) {
  const n = groupName.safeParse(formData.get('name'));
  if (!n.success) return fail(n.error.issues[0].message);
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('category_groups').insert({ name: n.data, owner_id: ctx.user.id, sort_order: CUSTOM_ORDER });
  if (error) return fail(dbMessage(error, 'We could not add that category.', 'category'));
  refresh();
  return ok(`${n.data} added. Now add items to it.`);
}

export async function renameGroup(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  const n = groupName.safeParse(formData.get('name'));
  if (!id.success) return fail('That category could not be found.');
  if (!n.success) return fail(n.error.issues[0].message);
  const ctx = await getContext();
  const { data, error } = await ctx.supabase.from('category_groups').update({ name: n.data }).eq('id', id.data).select('id');
  if (error) return fail(dbMessage(error, 'We could not rename that category.', 'category'));
  if (!data?.length) return fail('That category cannot be changed.');
  refresh();
  return ok('Category renamed.');
}

export async function deleteGroup(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return fail('That category could not be found.');
  const ctx = await getContext();
  // Only an empty category is deleted here, so no item is removed by accident.
  if (ctx.categories.some((c) => c.group_id === id.data)) return fail('Move or delete the items in that category first.');
  const { data, error } = await ctx.supabase.from('category_groups').delete().eq('id', id.data).select('id');
  if (error || !data?.length) return fail('We could not delete that category.');
  refresh();
  return ok('Category deleted.');
}
