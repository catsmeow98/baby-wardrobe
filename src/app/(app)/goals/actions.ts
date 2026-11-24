'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';

export async function saveGoals(formData: FormData) {
  const sizeId = z.string().uuid().safeParse(formData.get('sizeId'));
  if (!sizeId.success) return redirect('/goals?error=' + encodeURIComponent('Choose a size first.'));
  const ctx = await getContext();
  const order = ctx.orderOf.get(sizeId.data);
  const back = (error?: string): never => redirect(`/goals?size=${order ?? 0}${error ? `&error=${encodeURIComponent(error)}` : '&saved=1'}`);
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
