'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext, type Ctx } from '@/lib/context';
import { itemSchema, CONDITION_VALUES, SEASON_VALUES, STATUS_VALUES } from '@/lib/validation/items';
import { autoName, resolveFitRange } from '@/lib/domain';
import { attachPhotos, discardPhotos } from '@/lib/photo-attach';

const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);

/** Finds the person's brand by name, ignoring case, or creates it. Returns its id. */
async function brandId(ctx: Ctx, name: string): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;
  const { data } = await ctx.supabase.from('brands').select('id, name');
  const hit = (data ?? []).find((b: { id: string; name: string }) => b.name.toLowerCase() === clean.toLowerCase());
  if (hit) return hit.id;
  const { data: made, error } = await ctx.supabase.from('brands').insert({ name: clean, owner_id: ctx.user.id }).select('id').single();
  return error || !made ? null : (made.id as string);
}

/** Looks up the size group (as a sort order) of a tag label id. */
async function tagOrder(ctx: Ctx, tagId: string | undefined): Promise<number | null> {
  if (!tagId) return null;
  const { data } = await ctx.supabase.from('size_labels').select('size_id').eq('id', tagId).maybeSingle();
  return data ? (ctx.orderOf.get(data.size_id as string) ?? null) : null;
}

export async function saveItem(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('id') || undefined);
  const path = id.success ? `/closet/${id.data}` : '/closet/new';
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(path, parsed.error.issues[0].message);
  const v = parsed.data;

  const ctx = await getContext();
  if (!ctx.active) return fail('/closet', 'Add a child first.');
  const order = (sizeId?: string) => (sizeId ? (ctx.orderOf.get(sizeId) ?? null) : null);
  const range = resolveFitRange(await tagOrder(ctx, v.tagId), order(v.fitFromId), order(v.fitToId));
  if ('error' in range) return fail(path, range.error);

  const bId = await brandId(ctx, v.brand);
  const row = {
    name: autoName(v.name, v.brand, ctx.catById.get(v.categoryId)?.name ?? 'Item'),
    category_id: v.categoryId,
    brand_id: bId,
    tracking_type: v.quantity > 1 ? 'grouped' : 'individual',
    quantity: v.quantity,
    label_id: v.tagId ?? null,
    fit_from_size_id: range.fitFrom === null ? null : (ctx.sizeByOrder.get(range.fitFrom)?.id ?? null),
    fit_to_size_id: range.fitTo === null ? null : (ctx.sizeByOrder.get(range.fitTo)?.id ?? null),
    condition: v.condition,
    season: v.season,
    status: v.status,
    fit_override: v.fitOverride ?? null,
    fit_feedback: v.fitFeedback ?? null,
    notes: v.notes || null,
  };

  if (id.success) {
    const { error } = await ctx.supabase.from('inventory_items').update(row).eq('id', id.data);
    if (error) return fail(path, 'We could not save that item. Check the sizes and try again.');
    revalidatePath('/closet');
    return redirect('/closet');
  }
  const { data: made, error } = await ctx.supabase.from('inventory_items').insert({ ...row, child_id: ctx.active.id }).select('id').single();
  if (error || !made) return fail(path, 'We could not save that item. Check the sizes and try again.');
  // Photos were uploaded by the browser while the form was open. Attach them now that the item exists.
  const wanted = formData.getAll('photoPath').map(String);
  const attached = wanted.length ? await attachPhotos(ctx.supabase, ctx.user.id, ctx.active.id, made.id as string, wanted) : 0;
  revalidatePath('/closet');
  if (attached < wanted.length) {
    return redirect(`/closet/${made.id}?error=${encodeURIComponent('The item was saved, but some photos could not be added. You can add them below.')}`);
  }
  return redirect('/closet');
}

export async function deleteItem(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return fail('/closet', 'That item could not be found.');
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('inventory_items').delete().eq('id', id.data);
  if (error) return fail('/closet', 'We could not delete that item. Try again.');
  revalidatePath('/closet');
  return redirect('/closet');
}

const MAX_BULK_ROWS = 50;

export async function bulkCreate(formData: FormData) {
  const path = '/closet/bulk';
  const shared = z
    .object({ condition: z.enum(CONDITION_VALUES), season: z.enum(SEASON_VALUES), status: z.enum(STATUS_VALUES) })
    .safeParse({ condition: formData.get('condition'), season: formData.get('season'), status: formData.get('status') });
  if (!shared.success) return fail(path, 'Check the condition, season and status.');
  const count = Math.min(MAX_BULK_ROWS, Math.max(1, Number(formData.get('rows')) || 0));

  const ctx = await getContext();
  if (!ctx.active) return fail('/closet', 'Add a child first.');
  const { data: labelData } = await ctx.supabase.from('size_labels').select('id, size_id');
  const labelOrder = new Map((labelData ?? []).map((l: { id: string; size_id: string }) => [l.id, ctx.orderOf.get(l.size_id) ?? null]));
  const brandCache = new Map<string, string | null>();

  const rows: Record<string, unknown>[] = [];
  const sourceRow: number[] = []; // which form row each kept row came from, so photos find their item
  for (let i = 0; i < count; i++) {
    const text = (k: string) => String(formData.get(`${k}_${i}`) ?? '').trim();
    const name = text('name');
    const brand = text('brand');
    if (!name && !brand) continue; // an untouched row
    const n = `Row ${i + 1}`;
    const cat = z.string().uuid().safeParse(text('cat'));
    if (!cat.success) return fail(path, `${n}: choose a category.`);
    const qty = z.coerce.number().int().min(1).max(999).safeParse(text('qty') || '1');
    if (!qty.success) return fail(path, `${n}: quantity must be a whole number from 1 to 999.`);
    const tag = z.string().uuid().safeParse(text('tag') || undefined);
    const thru = z.string().uuid().safeParse(text('thru') || undefined);
    const tagO = tag.success ? (labelOrder.get(tag.data) ?? null) : null;
    const thruO = thru.success ? (ctx.orderOf.get(thru.data) ?? null) : null;
    const range = resolveFitRange(tagO, null, thruO);
    if ('error' in range) return fail(path, `${n}: ${range.error}`);
    if (brand && !brandCache.has(brand.toLowerCase())) brandCache.set(brand.toLowerCase(), await brandId(ctx, brand));
    sourceRow.push(i);
    rows.push({
      child_id: ctx.active.id,
      name: autoName(name, brand, ctx.catById.get(cat.data)?.name ?? 'Item'),
      category_id: cat.data,
      brand_id: brand ? (brandCache.get(brand.toLowerCase()) ?? null) : null,
      tracking_type: qty.data > 1 ? 'grouped' : 'individual',
      quantity: qty.data,
      label_id: tag.success ? tag.data : null,
      fit_from_size_id: range.fitFrom === null ? null : (ctx.sizeByOrder.get(range.fitFrom)?.id ?? null),
      fit_to_size_id: range.fitTo === null ? null : (ctx.sizeByOrder.get(range.fitTo)?.id ?? null),
      condition: shared.data.condition,
      season: shared.data.season,
      status: shared.data.status,
    });
  }
  // Photos picked on rows that were left blank will never be used, so delete them.
  const unused: string[] = [];
  for (let i = 0; i < count; i++) if (!sourceRow.includes(i)) unused.push(...formData.getAll(`photo_${i}`).map(String));
  if (unused.length) await discardPhotos(ctx.supabase, ctx.user.id, ctx.active.id, unused);
  if (!rows.length) return fail(path, 'Fill in at least one row. Add a name or a brand.');
  // One insert, so either every row is saved or none is.
  const { data: made, error } = await ctx.supabase.from('inventory_items').insert(rows).select('id');
  if (error) return fail(path, 'We could not save those items. Nothing was added. Try again.');
  // Attach each row's photos. Rows come back in the order they were sent, so index i matches sourceRow[i].
  let photoProblem = false;
  if (made && made.length === rows.length) {
    for (let k = 0; k < made.length; k++) {
      const wanted = formData.getAll(`photo_${sourceRow[k]}`).map(String);
      if (!wanted.length) continue;
      const attached = await attachPhotos(ctx.supabase, ctx.user.id, ctx.active.id, made[k].id as string, wanted);
      if (attached < wanted.length) photoProblem = true;
    }
  } else if ([...formData.keys()].some((key) => key.startsWith('photo_'))) photoProblem = true;
  revalidatePath('/closet');
  return redirect(`/closet?added=${rows.length}${photoProblem ? '&photos=partial' : ''}`);
}
