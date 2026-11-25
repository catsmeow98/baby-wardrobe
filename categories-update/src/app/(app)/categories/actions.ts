'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';

const fail = (m: string): never => redirect(`/categories?error=${encodeURIComponent(m)}`);
const ok = (m: string): never => redirect(`/categories?ok=${encodeURIComponent(m)}`);
const refresh = () => ['/categories', '/closet', '/goals', '/shopping', '/dashboard'].forEach((p) => revalidatePath(p));
const name = z.string().trim().min(1, 'Enter a category name.').max(60, 'Use 60 characters or fewer.');
const uuid = z.string().uuid();
const CUSTOM_ORDER = 1000; // custom categories sort after the built-in ones

/** The database refuses duplicate and built-in names and caps the count; its messages are written for people. */
const dbMessage = (e: { code?: string; message?: string }, fallback: string) => {
  if (e.code === '23505') return e.message?.includes('built-in') ? `${e.message}` : 'You already have a category with that name.';
  if (e.code === '22023' && e.message) return e.message;
  return fallback;
};

export async function addCategory(formData: FormData) {
  const n = name.safeParse(formData.get('name'));
  if (!n.success) return fail(n.error.issues[0].message);
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('categories').insert({ name: n.data, owner_id: ctx.user.id, sort_order: CUSTOM_ORDER });
  if (error) return fail(dbMessage(error, 'We could not add that category.'));
  refresh();
  return ok(`${n.data} added.`);
}

export async function renameCategory(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  const n = name.safeParse(formData.get('name'));
  if (!id.success) return fail('That category could not be found.');
  if (!n.success) return fail(n.error.issues[0].message);
  const ctx = await getContext();
  // Row-level security only lets the owner change a category, so a built-in one matches no rows.
  const { data, error } = await ctx.supabase.from('categories').update({ name: n.data }).eq('id', id.data).select('id');
  if (error) return fail(dbMessage(error, 'We could not rename that category.'));
  if (!data?.length) return fail('That category cannot be changed.');
  refresh();
  return ok('Category renamed.');
}

export async function deleteCategory(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return fail('That category could not be found.');
  const ctx = await getContext();
  const { data, error } = await ctx.supabase.from('categories').delete().eq('id', id.data).select('id');
  if (error?.code === '23503') return fail('Items, goals or shopping entries still use that category. Move or delete them first.');
  if (error || !data?.length) return fail('We could not delete that category.');
  refresh();
  return ok('Category deleted.');
}
