'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext, type Ctx } from '@/lib/context';

const fail = (m: string): never => redirect(`/categories?error=${encodeURIComponent(m)}`);
const ok = (m: string): never => redirect(`/categories?ok=${encodeURIComponent(m)}`);
const refresh = () => ['/categories', '/closet', '/goals', '/shopping', '/dashboard', '/survey'].forEach((p) => revalidatePath(p));
const typeName = z.string().trim().min(1, 'Enter an item type name.').max(60, 'Use 60 characters or fewer.');
const groupName = z.string().trim().min(1, 'Enter an item category name.').max(60, 'Use 60 characters or fewer.');
const uuid = z.string().uuid();
const CUSTOM_ORDER = 1000; // custom item types and item categories sort after the built-in ones

/**
 * Terms: an ITEM CATEGORY (Sleep, Outerwear) holds ITEM TYPES (Sleep sack, Coat). In the database an item type is a row of
 * "categories" and an item category is a row of "category_groups". Built-ins are shared, so a person's rename, move or
 * delete of one is stored as a private pref row (user_category_prefs, user_group_prefs) and "delete" means hide.
 */
const dbMessage = (e: { code?: string; message?: string }, fallback: string, what: 'type' | 'category') => {
  if (e.code === '23505') return e.message?.includes('built-in') ? `That name is already a built-in item ${what}.` : `You already have an item ${what} with that name.`;
  if (e.code === '22023') return e.message?.includes('up to') ? (what === 'type' ? 'You can have up to 60 custom item types.' : 'You can have up to 30 custom item categories.') : `That item category is not available.`;
  return fallback;
};

const nameTaken = (ctx: Ctx, rows: readonly { id: string; name: string }[], id: string | null, name: string) =>
  rows.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase());

/* ---- item types ---- */
export async function addCategory(formData: FormData) {
  const n = typeName.safeParse(formData.get('name'));
  const g = uuid.safeParse(formData.get('groupId'));
  if (!n.success) return fail(n.error.issues[0].message);
  if (!g.success) return fail('Choose an item category for the item type.');
  const ctx = await getContext();
  if (nameTaken(ctx, ctx.allCategories, null, n.data)) return fail('You already have an item type with that name.');
  const { error } = await ctx.supabase.from('categories').insert({ name: n.data, owner_id: ctx.user.id, group_id: g.data, sort_order: CUSTOM_ORDER });
  if (error) return fail(dbMessage(error, 'We could not add that item type.', 'type'));
  refresh();
  return ok(`${n.data} added.`);
}

/** Rename and/or move an item type. Built-ins are changed for this person only. */
export async function saveItemType(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  const n = typeName.safeParse(formData.get('name'));
  const g = uuid.safeParse(formData.get('groupId'));
  if (!id.success) return fail('That item type could not be found.');
  if (!n.success) return fail(n.error.issues[0].message);
  if (!g.success) return fail('Choose an item category.');
  const ctx = await getContext();
  const cat = ctx.allCategories.find((c) => c.id === id.data);
  if (!cat) return fail('That item type could not be found.');
  if (nameTaken(ctx, ctx.allCategories, cat.id, n.data)) return fail('You already have an item type with that name.');
  if (cat.is_default) {
    const { error } = await ctx.supabase.from('user_category_prefs').upsert(
      { owner_id: ctx.user.id, category_id: cat.id, name: n.data === cat.base_name ? null : n.data, group_id: g.data },
      { onConflict: 'owner_id,category_id' },
    );
    if (error) return fail('We could not save that change.');
  } else {
    const { data, error } = await ctx.supabase.from('categories').update({ name: n.data, group_id: g.data }).eq('id', cat.id).select('id');
    if (error) return fail(dbMessage(error, 'We could not save that change.', 'type'));
    if (!data?.length) return fail('That item type cannot be changed.');
  }
  refresh();
  return ok('Saved.');
}

/** Deleting a built-in item type hides it for this person. Their records that use it are untouched. */
export async function hideItemType(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return fail('That item type could not be found.');
  const ctx = await getContext();
  const hidden = formData.get('restore') === null;
  const { error } = await ctx.supabase.from('user_category_prefs').upsert({ owner_id: ctx.user.id, category_id: id.data, hidden }, { onConflict: 'owner_id,category_id' });
  if (error) return fail('We could not do that.');
  refresh();
  return ok(hidden ? 'Deleted. You can restore it below.' : 'Restored.');
}

export async function deleteCategory(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return fail('That item type could not be found.');
  const ctx = await getContext();
  const { data, error } = await ctx.supabase.from('categories').delete().eq('id', id.data).select('id');
  if (error?.code === '23503') return fail('Closet items, goals or shopping entries still use that item type. Move or delete them first.');
  if (error || !data?.length) return fail('We could not delete that item type.');
  refresh();
  return ok('Item type deleted.');
}

/* ---- item categories ---- */
export async function addGroup(formData: FormData) {
  const n = groupName.safeParse(formData.get('name'));
  if (!n.success) return fail(n.error.issues[0].message);
  const ctx = await getContext();
  if (nameTaken(ctx, ctx.allGroups, null, n.data)) return fail('You already have an item category with that name.');
  const { error } = await ctx.supabase.from('category_groups').insert({ name: n.data, owner_id: ctx.user.id, sort_order: CUSTOM_ORDER });
  if (error) return fail(dbMessage(error, 'We could not add that item category.', 'category'));
  refresh();
  return ok(`${n.data} added. Now add item types to it.`);
}

export async function saveGroup(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  const n = groupName.safeParse(formData.get('name'));
  if (!id.success) return fail('That item category could not be found.');
  if (!n.success) return fail(n.error.issues[0].message);
  const ctx = await getContext();
  const g = ctx.allGroups.find((x) => x.id === id.data);
  if (!g) return fail('That item category could not be found.');
  if (nameTaken(ctx, ctx.allGroups, g.id, n.data)) return fail('You already have an item category with that name.');
  if (g.is_default) {
    const { error } = await ctx.supabase.from('user_group_prefs').upsert(
      { owner_id: ctx.user.id, group_id: g.id, name: n.data === g.base_name ? null : n.data },
      { onConflict: 'owner_id,group_id' },
    );
    if (error) return fail('We could not save that change.');
  } else {
    const { data, error } = await ctx.supabase.from('category_groups').update({ name: n.data }).eq('id', g.id).select('id');
    if (error) return fail(dbMessage(error, 'We could not rename that item category.', 'category'));
    if (!data?.length) return fail('That item category cannot be changed.');
  }
  refresh();
  return ok('Saved.');
}

/** Deleting a built-in item category hides it, with its item types, for this person. */
export async function hideGroup(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return fail('That item category could not be found.');
  const ctx = await getContext();
  const hidden = formData.get('restore') === null;
  const { error } = await ctx.supabase.from('user_group_prefs').upsert({ owner_id: ctx.user.id, group_id: id.data, hidden }, { onConflict: 'owner_id,group_id' });
  if (error) return fail('We could not do that.');
  refresh();
  return ok(hidden ? 'Deleted. You can restore it below.' : 'Restored.');
}

export async function deleteGroup(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return fail('That item category could not be found.');
  const ctx = await getContext();
  // Only an empty item category is deleted here, so no item type is removed by accident.
  if (ctx.allCategories.some((c) => c.group_id === id.data)) return fail('Move or delete the item types in that item category first.');
  const { data, error } = await ctx.supabase.from('category_groups').delete().eq('id', id.data).select('id');
  if (error || !data?.length) return fail('We could not delete that item category.');
  refresh();
  return ok('Item category deleted.');
}

/** Puts every built-in item category and item type back to its original name, place and visibility. */
export async function restoreDefaults() {
  const ctx = await getContext();
  await Promise.all([
    ctx.supabase.from('user_category_prefs').delete().eq('owner_id', ctx.user.id),
    ctx.supabase.from('user_group_prefs').delete().eq('owner_id', ctx.user.id),
  ]);
  refresh();
  return ok('The built-in item categories and item types are back to their originals.');
}
