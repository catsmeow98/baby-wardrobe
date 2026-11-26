'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { safeBack, withParams } from '@/lib/back';

export async function saveGoals(formData: FormData) {
  const sizeId = z.string().uuid().safeParse(formData.get('sizeId'));
  if (!sizeId.success) return redirect('/goals?error=' + encodeURIComponent('Choose a size first.'));
  const ctx = await getContext();
  const order = ctx.orderOf.get(sizeId.data);
  const keepQs = ['group', 'cat'].map((k) => { const v = z.string().uuid().safeParse(formData.get(k)); return v.success ? `&${k}=${v.data}` : ''; }).join('');
  const back = (error?: string): never => redirect(`/goals?size=${order ?? 0}${keepQs}${error ? `&error=${encodeURIComponent(error)}` : '&saved=1'}`);
  if (!ctx.active) return back('Add a child first.');
  if (order === undefined) return back('That size could not be found.');

  const keep: { child_id: string; category_id: string; size_id: string; target_quantity: number }[] = [];
  const clear: string[] = [];
  for (const c of ctx.categories) {
    const raw = String(formData.get(`goal_${c.id}`) ?? '').trim();
    if (raw === '') {
      clear.push(c.id);
      continue;
    }
    const n = z.coerce.number().int().min(0).max(99).safeParse(raw);
    if (!n.success) return back(`${c.name}: use a whole number from 0 to 99.`);
    keep.push({ child_id: ctx.active.id, category_id: c.id, size_id: sizeId.data, target_quantity: n.data });
  }
  if (keep.length) {
    const { error } = await ctx.supabase.from('wardrobe_goals').upsert(keep, { onConflict: 'child_id,category_id,size_id' });
    if (error) return back('We could not save your goals. Try again.');
  }
  if (clear.length) {
    await ctx.supabase.from('wardrobe_goals').delete().eq('child_id', ctx.active.id).eq('size_id', sizeId.data).in('category_id', clear);
  }
  revalidatePath('/goals');
  revalidatePath('/dashboard');
  revalidatePath('/shopping');
  return back();
}

/** Copies goals from another size into this one, only where this size has none yet. */
export async function copyGoals(formData: FormData) {
  const to = z.string().uuid().safeParse(formData.get('sizeId'));
  const from = z.string().uuid().safeParse(formData.get('fromSizeId'));
  if (!to.success || !from.success) return redirect('/goals?error=' + encodeURIComponent('Choose a size to copy from.'));
  const ctx = await getContext();
  const order = ctx.orderOf.get(to.data) ?? 0;
  const back = (error?: string): never =>
    redirect(withParams(safeBack(formData.get('back'), '/goals'), { size: String(order), error, saved: error ? undefined : '1' }));
  if (!ctx.active) return back('Add a child first.');
  const { data: src } = await ctx.supabase.from('wardrobe_goals').select('category_id, target_quantity').eq('child_id', ctx.active.id).eq('size_id', from.data);
  const { data: have } = await ctx.supabase.from('wardrobe_goals').select('category_id').eq('child_id', ctx.active.id).eq('size_id', to.data);
  const taken = new Set((have ?? []).map((r: { category_id: string }) => r.category_id));
  const rows = ((src ?? []) as { category_id: string; target_quantity: number }[])
    .filter((r) => !taken.has(r.category_id))
    .map((r) => ({ child_id: ctx.active!.id, category_id: r.category_id, size_id: to.data, target_quantity: r.target_quantity }));
  if (!rows.length) return back('Nothing to copy. This size already has a goal for every item type that the other size has.');
  const { error } = await ctx.supabase.from('wardrobe_goals').upsert(rows, { onConflict: 'child_id,category_id,size_id' });
  if (error) return back('We could not copy the goals. Try again.');
  revalidatePath('/goals');
  revalidatePath('/dashboard');
  revalidatePath('/shopping');
  return back();
}
