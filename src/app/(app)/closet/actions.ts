'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext, type Ctx } from '@/lib/context';
import { safeBack, withParams } from '@/lib/back';
import type { CategoryRow } from '@/lib/db';
import { itemSchema, COLOR_VALUES, GENDER_VALUES, STATUS_VALUES } from '@/lib/validation/items';
import { loadTags, parseTags, saveTags } from '@/lib/tags';
import { autoName, parseTagRange, resolveFitRange } from '@/lib/domain';
import { attachPhotos, discardPhotos } from '@/lib/photo-attach';

const failWith = (path: string, message: string, back = '/closet'): never =>
  redirect(`${path}?error=${encodeURIComponent(message)}${back !== '/closet' ? `&back=${encodeURIComponent(back)}` : ''}`);
const fail = (path: string, message: string): never => failWith(path, message);
/** Where to return to after a save: the closet with the filters the person had. */
const backOf = (formData: FormData) => safeBack(formData.get('back'), '/closet');

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

const CUSTOM_ORDER = 1000; // custom item types and item categories sort after the built-in ones

/**
 * The item type a form row asked for. Normally the posted id. When the picker's "+ New item type" was chosen (the field is
 * "__new"), this creates the item type, and the item category too if "+ New item category" was chosen, then returns the new id.
 * A name that matches an item type the person already has is reused instead of failing. Errors go back to the form.
 */
async function typeFor(ctx: Ctx, formData: FormData, field: string, path: string, prefix = ''): Promise<string> {
  const posted = String(formData.get(field) ?? '');
  if (posted !== '__new') return posted;
  const bad = (m: string): never => fail(path, `${prefix}${m}`);
  const name = z.string().trim().min(1).max(60).safeParse(formData.get(`${field}_newType`));
  if (!name.success) return bad('enter a name for the new item type (60 characters or fewer).');
  const same = (a: string) => a.toLowerCase() === name.data.toLowerCase();
  const hit = ctx.categories.find((c) => same(c.name));
  if (hit) return hit.id;
  if (ctx.allCategories.some((c) => same(c.name))) return bad('that name is already used by a hidden item type. Restore it on the Item types page, or pick another name.');

  let groupId = String(formData.get(`${field}_group`) ?? '');
  let groupName = ctx.groups.find((g) => g.id === groupId)?.name ?? '';
  if (groupId === '__new') {
    const gn = z.string().trim().min(1).max(60).safeParse(formData.get(`${field}_newGroup`));
    if (!gn.success) return bad('enter a name for the new item category (60 characters or fewer).');
    const existing = ctx.groups.find((g) => g.name.toLowerCase() === gn.data.toLowerCase());
    if (existing) {
      groupId = existing.id;
      groupName = existing.name;
    } else {
      if (ctx.allGroups.some((g) => g.name.toLowerCase() === gn.data.toLowerCase())) return bad('that name is already used by a hidden item category.');
      const { data: g, error } = await ctx.supabase.from('category_groups').insert({ name: gn.data, owner_id: ctx.user.id, sort_order: CUSTOM_ORDER }).select('id').single();
      if (error || !g) return bad(error?.code === '22023' ? 'you can have up to 30 custom item categories.' : 'we could not add that item category.');
      groupId = g.id as string;
      groupName = gn.data;
    }
  }
  if (!z.string().uuid().safeParse(groupId).success || !groupName) return bad('choose an item category for the new item type.');
  const { data: made, error } = await ctx.supabase.from('categories').insert({ name: name.data, owner_id: ctx.user.id, group_id: groupId, sort_order: CUSTOM_ORDER }).select('id').single();
  if (error || !made) return bad(error?.code === '22023' ? 'you can have up to 60 custom item types.' : error?.code === '23505' ? 'that name is already a built-in item type.' : 'we could not add that item type.');
  // Make it visible to the rest of this request, including later rows of a bulk add.
  const row: CategoryRow = { id: made.id as string, name: name.data, base_name: name.data, sort_order: CUSTOM_ORDER, group_id: groupId, grp: groupName, group_order: CUSTOM_ORDER, owner_id: ctx.user.id, is_default: false, hidden: false };
  ctx.categories.push(row);
  ctx.allCategories.push(row);
  ctx.catById.set(row.id, row);
  return row.id;
}

/** Looks up the size group (as a sort order) of a tag label id. */
async function tagOrder(ctx: Ctx, tagId: string | undefined): Promise<number | null> {
  if (!tagId) return null;
  const { data } = await ctx.supabase.from('size_labels').select('size_id').eq('id', tagId).maybeSingle();
  return data ? (ctx.orderOf.get(data.size_id as string) ?? null) : null;
}

export async function saveItem(formData: FormData) {
  const backTo = backOf(formData);
  const fail = (p: string, m: string): never => failWith(p, m, backTo);
  const id = z.string().uuid().safeParse(formData.get('id') || undefined);
  const path = id.success ? `/closet/${id.data}` : '/closet/new';
  const ctx = await getContext();
  // A "+ New item type" choice becomes a real item type first, so the rest of the form is checked as usual.
  formData.set('categoryId', await typeFor(ctx, formData, 'categoryId', path));
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(path, parsed.error.issues[0].message);
  const v = parsed.data;

  if (!ctx.active) return fail('/closet', 'Add a child first.');
  const order = (sizeId?: string) => (sizeId ? (ctx.orderOf.get(sizeId) ?? null) : null);
  // A tag from the list wins. Otherwise a custom range such as "6-12" stands in for the tag.
  let tagFrom = await tagOrder(ctx, v.tagId);
  let tagTo: number | null = null;
  let customTag: string | null = null;
  if (!v.tagId && v.customTag) {
    const custom = parseTagRange(v.customTag);
    if ('error' in custom) return fail(path, custom.error);
    tagFrom = custom.fitFrom;
    tagTo = custom.fitTo;
    customTag = custom.label;
  }
  const range = resolveFitRange(tagFrom, order(v.fitFromId), order(v.fitToId), tagTo);
  if ('error' in range) return fail(path, range.error);

  const bId = await brandId(ctx, v.brand);
  const row = {
    name: autoName(v.name, v.brand, ctx.catById.get(v.categoryId)?.name ?? 'Item'),
    category_id: v.categoryId,
    brand_id: bId,
    tracking_type: v.quantity > 1 ? 'grouped' : 'individual',
    quantity: v.quantity,
    label_id: v.tagId ?? null,
    custom_tag: customTag,
    fit_from_size_id: range.fitFrom === null ? null : (ctx.sizeByOrder.get(range.fitFrom)?.id ?? null),
    fit_to_size_id: range.fitTo === null ? null : (ctx.sizeByOrder.get(range.fitTo)?.id ?? null),
    gender: v.gender ?? null,
    color: v.color ?? null,
    status: v.status,
    // Fit always comes from the sizes now, so any fit set by hand before is cleared on save.
    fit_override: null,
    fit_feedback: v.fitFeedback ?? null,
    notes: v.notes || null,
  };

  const tags = parseTags(formData.get('tags'));
  if (id.success) {
    const { error } = await ctx.supabase.from('inventory_items').update(row).eq('id', id.data);
    if (error) return fail(path, 'We could not save that item. Check the sizes and try again.');
    if (!(await saveTags(ctx, [{ item: id.data, tags }]))) return fail(path, 'The item was saved, but its tags could not be. Try again.');
    ['/closet', '/dashboard', '/shopping', '/goals'].forEach((p) => revalidatePath(p));
    return redirect(backTo);
  }
  const { data: made, error } = await ctx.supabase.from('inventory_items').insert({ ...row, child_id: ctx.active.id }).select('id').single();
  if (error || !made) return fail(path, 'We could not save that item. Check the sizes and try again.');
  const tagsSaved = await saveTags(ctx, tags.length ? [{ item: made.id as string, tags }] : []);
  // Photos were uploaded by the browser while the form was open. Attach them now that the item exists.
  const wanted = formData.getAll('photoPath').map(String);
  const attached = wanted.length ? await attachPhotos(ctx.supabase, ctx.user.id, ctx.active.id, made.id as string, wanted) : 0;
  revalidatePath('/closet');
  if (attached < wanted.length || !tagsSaved) {
    return redirect(`/closet/${made.id}?error=${encodeURIComponent(!tagsSaved ? 'The item was saved, but its tags could not be. Add them below.' : 'The item was saved, but some photos could not be added. You can add them below.')}${backTo !== '/closet' ? `&back=${encodeURIComponent(backTo)}` : ''}`);
  }
  return redirect(backTo);
}

export async function deleteItem(formData: FormData) {
  const backTo = backOf(formData);
  const fail = (p: string, m: string): never => failWith(p, m, backTo);
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return fail('/closet', 'That item could not be found.');
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('inventory_items').delete().eq('id', id.data);
  if (error) return fail('/closet', 'We could not delete that item. Try again.');
  revalidatePath('/closet');
  return redirect(backTo);
}

const MAX_BULK_ROWS = 50;

export async function bulkCreate(formData: FormData) {
  const backTo = backOf(formData);
  // A failed save from a shopping trip goes back to that trip.
  const tripQs = z.string().uuid().safeParse(formData.get('trip') || undefined);
  const fail = (p: string, m: string): never =>
    tripQs.success && p === '/closet/bulk' ? redirect(`${p}?trip=${tripQs.data}&error=${encodeURIComponent(m)}${backTo !== '/closet' ? `&back=${encodeURIComponent(backTo)}` : ''}`) : failWith(p, m, backTo);
  const path = '/closet/bulk';
  const shared = z
    .object({ status: z.enum(STATUS_VALUES), gender: z.enum(GENDER_VALUES).nullable() })
    .safeParse({ status: formData.get('status') || 'active', gender: formData.get('gender') || null });
  if (!shared.success) return fail(path, 'Check the status and gender.');
  const sharedTags = parseTags(formData.get('tags_shared'));
  const rowTags: string[][] = []; // each kept row's tags, in the same order as rows
  const count = Math.min(MAX_BULK_ROWS, Math.max(0, Number(formData.get('rows')) || 0));
  // From a shopping trip: rows can say which received placeholder they are (match_i), and "nophoto" lines add pieces with no
  // photo. Everything then goes through complete_received, which swaps the placeholders for these items in one transaction.
  const trip = z.string().uuid().safeParse(formData.get('trip') || undefined);
  const consume: { item: string; qty: number }[] = [];
  // Pieces from the trip that were not purchased after all (taken off with nothing added, counted on the order).
  const cancel: { item: string; qty: number }[] = [];

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
    // Every row was added on purpose (a photo, or Add an item without a photo), so each is kept, even with nothing typed.
    const n = `Item ${i + 1}`;
    const cat = z.string().uuid().safeParse(text('cat') === '__new' ? await typeFor(ctx, formData, `cat_${i}`, path, `${n}: `) : text('cat'));
    if (!cat.success) return fail(path, `${n}: choose an item type.`);
    const qty = z.coerce.number().int().min(1).max(999).safeParse(text('qty') || '1');
    if (!qty.success) return fail(path, `${n}: quantity must be a whole number from 1 to 999.`);
    const tag = z.string().uuid().safeParse(text('tag') || undefined);
    const thru = z.string().uuid().safeParse(text('thru') || undefined);
    let tagO = tag.success ? (labelOrder.get(tag.data) ?? null) : null;
    let tagTo: number | null = null;
    let customTag: string | null = null;
    const customText = text('ctag');
    if (!tag.success && customText) {
      const custom = parseTagRange(customText);
      if ('error' in custom) return fail(path, `${n}: ${custom.error}`);
      tagO = custom.fitFrom;
      tagTo = custom.fitTo;
      customTag = custom.label;
    }
    const thruO = thru.success ? (ctx.orderOf.get(thru.data) ?? null) : null;
    const range = resolveFitRange(tagO, null, thruO, tagTo);
    if ('error' in range) return fail(path, `${n}: ${range.error}`);
    if (brand && !brandCache.has(brand.toLowerCase())) brandCache.set(brand.toLowerCase(), await brandId(ctx, brand));
    const match = z.string().uuid().safeParse(text('match') || undefined);
    if (trip.success && match.success) consume.push({ item: match.data, qty: qty.data });
    sourceRow.push(i);
    rowTags.push(parseTags(formData.get(`tags_${i}`), sharedTags));
    // This item's own status and gender win over the ones for every item ("none" is an explicit Not set).
    const ownStatus = z.enum(STATUS_VALUES).safeParse(text('status'));
    const ownGender = text('gender') === 'none' ? null : (z.enum(GENDER_VALUES).safeParse(text('gender')).data ?? shared.data.gender);
    rows.push({
      child_id: ctx.active.id,
      name: autoName(name, brand, ctx.catById.get(cat.data)?.name ?? 'Item'),
      category_id: cat.data,
      brand_id: brand ? (brandCache.get(brand.toLowerCase()) ?? null) : null,
      tracking_type: qty.data > 1 ? 'grouped' : 'individual',
      quantity: qty.data,
      label_id: tag.success ? tag.data : null,
      custom_tag: customTag,
      fit_from_size_id: range.fitFrom === null ? null : (ctx.sizeByOrder.get(range.fitFrom)?.id ?? null),
      fit_to_size_id: range.fitTo === null ? null : (ctx.sizeByOrder.get(range.fitTo)?.id ?? null),
      gender: ownGender,
      color: z.enum(COLOR_VALUES).safeParse(text('color')).data ?? null,
      status: ownStatus.success ? ownStatus.data : shared.data.status,
    });
  }
  // Photos picked on rows that were left blank will never be used, so delete them.
  const unused: string[] = [];
  for (let i = 0; i < count; i++) if (!sourceRow.includes(i)) unused.push(...formData.getAll(`photo_${i}`).map(String));
  if (unused.length) await discardPhotos(ctx.supabase, ctx.user.id, ctx.active.id, unused);
  if (trip.success) {
    // Pieces from the trip added without a photo: one plain item each, like the placeholder they come from.
    const wanted = formData.getAll('nophoto').map(String).flatMap((v) => {
      const [item, n] = v.split(':');
      const id = z.string().uuid().safeParse(item);
      const k = Number(n);
      return id.success && Number.isInteger(k) && k > 0 && k <= 999 ? [{ item: id.data, n: k }] : [];
    });
    // Pieces not actually bought: taken off their placeholder with nothing added, so they count as needed again.
    for (const v of formData.getAll('notbought').map(String)) {
      const [item, n] = v.split(':');
      const id = z.string().uuid().safeParse(item);
      const k = Number(n);
      if (id.success && Number.isInteger(k) && k > 0 && k <= 999) cancel.push({ item: id.data, qty: k });
    }
    if (wanted.length) {
      const { data: holders } = await ctx.supabase
        .from('inventory_items')
        .select('id, category_id, label_id, fit_from_size_id, fit_to_size_id')
        .in('id', wanted.map((w) => w.item))
        .eq('needs_details', true);
      for (const w of wanted) {
        const h = (holders ?? []).find((x: { id: string }) => x.id === w.item) as
          { id: string; category_id: string; label_id: string | null; fit_from_size_id: string | null; fit_to_size_id: string | null } | undefined;
        if (!h) return fail(path, 'Those received pieces were already added. Reload the trip and try again.');
        for (let k = 0; k < w.n; k++) {
          sourceRow.push(-1);
          rowTags.push(sharedTags);
          rows.push({
            child_id: ctx.active.id,
            name: ctx.catById.get(h.category_id)?.name ?? 'Item',
            category_id: h.category_id,
            tracking_type: 'individual',
            quantity: 1,
            label_id: h.label_id,
            fit_from_size_id: h.fit_from_size_id,
            fit_to_size_id: h.fit_to_size_id,
            gender: shared.data.gender,
            status: shared.data.status,
          });
        }
        consume.push({ item: w.item, qty: w.n });
      }
    }
  }
  if (!rows.length && !consume.length && !cancel.length) return fail(path, 'Add at least one item.');
  // Everything added from a trip remembers it, for the shopping History page.
  if (trip.success) for (const r of rows) r.trip_id = trip.data;
  // One insert, so either every row is saved or none is.
  let made: { id: string }[] | null = null;
  let error: { code?: string; message?: string } | null = null;
  if (trip.success && (consume.length || cancel.length)) {
    // One transaction: the new items in, the received placeholders down (or gone). Ids come back in order.
    const res = await ctx.supabase.rpc('complete_received', { p_rows: rows, p_consume: consume, p_cancel: cancel });
    error = res.error;
    made = ((res.data as string[] | null) ?? []).map((id) => ({ id }));
    if (error?.code === '22023') return fail(path, `${error.message}. Nothing was added; reload the trip and try again.`);
  } else {
    const res = await ctx.supabase.from('inventory_items').insert(rows).select('id');
    error = res.error;
    made = (res.data as { id: string }[] | null) ?? null;
  }
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
  // Tags, once the items exist.
  let tagProblem = false;
  if (made && made.length === rows.length) {
    tagProblem = !(await saveTags(ctx, made.flatMap((m, k) => (rowTags[k]?.length ? [{ item: m.id, tags: rowTags[k] }] : []))));
  } else if (rowTags.some((t) => t.length)) tagProblem = true;
  revalidatePath('/closet');
  return redirect(withParams(backTo, { added: rows.length ? String(rows.length) : undefined, photos: photoProblem ? 'partial' : undefined, tags: tagProblem ? 'partial' : undefined }));
}

const BULK_FIELDS = ['status', 'gender', 'color', 'addTag', 'removeTag', 'delete'] as const;

/** Changes one thing on many items at once, from Select in the closet. Row-level security keeps it to the person's own items. */
export async function bulkUpdate(formData: FormData) {
  const backTo = backOf(formData);
  const stop = (m: string): never => redirect(withParams(backTo, { error: m }));
  let raw: unknown = [];
  try {
    raw = JSON.parse(String(formData.get('ids') ?? '[]'));
  } catch {
    raw = [];
  }
  const ids = z.array(z.string().uuid()).min(1).max(500).safeParse(raw);
  if (!ids.success) return stop('Select at least one item.');
  const field = z.enum(BULK_FIELDS).safeParse(formData.get('field'));
  if (!field.success) return stop('Choose what to change.');
  const value = String(formData.get('value') ?? '').trim();
  const ctx = await getContext();
  const n = ids.data.length;
  const done = (key: 'updated' | 'deleted') => {
    ['/closet', '/dashboard', '/shopping', '/goals'].forEach((p) => revalidatePath(p));
    return redirect(withParams(backTo, { [key]: String(n), error: undefined }));
  };

  if (field.data === 'delete') {
    if (formData.get('confirm') !== 'yes') return stop('Tick the box to confirm deleting.');
    const { error } = await ctx.supabase.from('inventory_items').delete().in('id', ids.data);
    if (error) return stop('Those items could not be deleted. Try again.');
    return done('deleted');
  }
  if (field.data === 'addTag' || field.data === 'removeTag') {
    const tag = parseTags(JSON.stringify([value]))[0];
    if (!tag) return stop('Type a tag.');
    const { byItem } = await loadTags(ctx, ids.data);
    const entries = ids.data.flatMap((id) => {
      const now = byItem.get(id) ?? [];
      const has = now.some((t) => t.toLowerCase() === tag.toLowerCase());
      if (field.data === 'addTag') return has ? [] : [{ item: id, tags: [...now, tag] }];
      return has ? [{ item: id, tags: now.filter((t) => t.toLowerCase() !== tag.toLowerCase()) }] : [];
    });
    if (!(await saveTags(ctx, entries))) return stop('The tags could not be saved. Try again.');
    return done('updated');
  }
  let patch: Record<string, string | null>;
  if (field.data === 'status') {
    const s = z.enum(STATUS_VALUES).safeParse(value);
    if (!s.success) return stop('Choose a status.');
    patch = { status: s.data };
  } else if (field.data === 'gender') {
    patch = { gender: value === 'none' ? null : (z.enum(GENDER_VALUES).safeParse(value).data ?? stop('Choose a gender.')) };
  } else {
    patch = { color: value === 'none' ? null : (z.enum(COLOR_VALUES).safeParse(value).data ?? stop('Choose a color.')) };
  }
  const { error } = await ctx.supabase.from('inventory_items').update(patch).in('id', ids.data);
  if (error) return stop('Those items could not be changed. Try again.');
  return done('updated');
}

/** Saves colors picked on the color check page, and (if asked) takes the tag being checked off those items. */
export async function saveColors(formData: FormData) {
  const tagId = z.string().uuid().safeParse(formData.get('tag'));
  const page = `/closet/color-check${tagId.success ? `?tag=${tagId.data}` : ''}`;
  const stop = (m: string): never => redirect(withParams(page, { error: m }));
  let raw: unknown = [];
  try {
    raw = JSON.parse(String(formData.get('colors') ?? '[]'));
  } catch {
    raw = [];
  }
  const rows = z.array(z.object({ id: z.string().uuid(), color: z.enum(COLOR_VALUES).nullable() })).max(500).safeParse(raw);
  if (!rows.success) return stop('Those colors could not be read. Try again.');
  const ctx = await getContext();
  // One update per color, for every item given that color.
  const byColor = new Map<string | null, string[]>();
  for (const r of rows.data) byColor.set(r.color, [...(byColor.get(r.color) ?? []), r.id]);
  for (const [color, ids] of byColor) {
    const { error } = await ctx.supabase.from('inventory_items').update({ color }).in('id', ids);
    if (error) return stop('Some colors could not be saved. Try again.');
  }
  let untagged = 0;
  if (tagId.success && formData.get('untag') === 'yes' && rows.data.length) {
    const ids = rows.data.map((r) => r.id);
    const { error } = await ctx.supabase.from('item_tags').delete().eq('tag_id', tagId.data).in('item_id', ids);
    if (error) return stop('The colors were saved, but the tag could not be taken off. Try again.');
    untagged = ids.length;
  }
  ['/closet', '/account'].forEach((p) => revalidatePath(p));
  return redirect(withParams(page, { ok: `${rows.data.length} color${rows.data.length === 1 ? '' : 's'} saved${untagged ? ', tag taken off' : ''}.` }));
}

/**
 * Puts photos on items that had none, from Add photos, and saves each item's details as changed there (type, name, brand,
 * color, tag size, fits through, tags). Field names carry the photo's key. Photos left unmatched are deleted.
 */
export async function attachItemPhotos(formData: FormData) {
  const back = safeBack(formData.get('back'), '/dashboard');
  const path = '/closet/add-photos';
  const stop = (m: string): never => redirect(withParams(path, { error: m }));
  const json = (k: string): unknown => {
    try {
      return JSON.parse(String(formData.get(k) ?? '[]'));
    } catch {
      return [];
    }
  };
  const parsed = z.array(z.object({ key: z.number().int().min(0), item: z.string().uuid(), photo: z.string().min(1).max(420) })).max(100).safeParse(json('matches'));
  if (!parsed.success) return stop('Those photos could not be read. Try again.');
  const unused = z.array(z.string().max(420)).max(200).safeParse(json('unused'));
  const ctx = await getContext();
  if (!ctx.active) return stop('Add a child first.');
  const { data: labelData } = await ctx.supabase.from('size_labels').select('id, size_id');
  const labelOrder = new Map((labelData ?? []).map((l: { id: string; size_id: string }) => [l.id, ctx.orderOf.get(l.size_id) ?? null]));

  // Check every item's details first, so nothing is half saved.
  const updates: { item: string; photo: string; row: Record<string, unknown>; tags: string[] }[] = [];
  for (const [n, m] of parsed.data.entries()) {
    const text = (f: string) => String(formData.get(`${f}_${m.key}`) ?? '').trim();
    const label = `Photo ${n + 1}: `;
    const cat = z.string().uuid().safeParse(text('cat') === '__new' ? await typeFor(ctx, formData, `cat_${m.key}`, path, label) : text('cat'));
    if (!cat.success) return stop(`${label}choose an item type.`);
    const tag = z.string().uuid().safeParse(text('tag') || undefined);
    const thru = z.string().uuid().safeParse(text('thru') || undefined);
    let tagO = tag.success ? (labelOrder.get(tag.data) ?? null) : null;
    let tagTo: number | null = null;
    let customTag: string | null = null;
    if (!tag.success && text('ctag')) {
      const custom = parseTagRange(text('ctag'));
      if ('error' in custom) return stop(`${label}${custom.error}`);
      tagO = custom.fitFrom;
      tagTo = custom.fitTo;
      customTag = custom.label;
    }
    const range = resolveFitRange(tagO, null, thru.success ? (ctx.orderOf.get(thru.data) ?? null) : null, tagTo);
    if ('error' in range) return stop(`${label}${range.error}`);
    const brand = text('brand');
    updates.push({
      item: m.item,
      photo: m.photo,
      tags: parseTags(formData.get(`tags_${m.key}`)),
      row: {
        name: autoName(text('name'), brand, ctx.catById.get(cat.data)?.name ?? 'Item'),
        category_id: cat.data,
        brand_id: await brandId(ctx, brand),
        color: z.enum(COLOR_VALUES).safeParse(text('color')).data ?? null,
        label_id: tag.success ? tag.data : null,
        custom_tag: customTag,
        fit_from_size_id: range.fitFrom === null ? null : (ctx.sizeByOrder.get(range.fitFrom)?.id ?? null),
        fit_to_size_id: range.fitTo === null ? null : (ctx.sizeByOrder.get(range.fitTo)?.id ?? null),
      },
    });
  }
  if (unused.success && unused.data.length) await discardPhotos(ctx.supabase, ctx.user.id, ctx.active.id, unused.data);
  let attached = 0;
  for (const u of updates) {
    const { error } = await ctx.supabase.from('inventory_items').update(u.row).eq('id', u.item);
    if (error) return stop(`${attached} of ${updates.length} saved. An item's details could not be saved; check its sizes and try again.`);
    await saveTags(ctx, [{ item: u.item, tags: u.tags }]);
    if (await attachPhotos(ctx.supabase, ctx.user.id, ctx.active.id, u.item, [u.photo])) attached++;
  }
  ['/closet', '/dashboard'].forEach((p) => revalidatePath(p));
  if (attached < updates.length) return stop(`${attached} of ${updates.length} photos were added. Try the rest again.`);
  return redirect(withParams(back, { ok: `${attached} photo${attached === 1 ? '' : 's'} added.` }));
}
