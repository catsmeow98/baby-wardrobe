'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CATEGORY_NAMES, parseAnswers } from '@/lib/domain';
import { getContext } from '@/lib/context';
import { surveyFor, targetSize } from './compute';

/** Saves the suggested goals for one size. Recomputes from the answers on the server rather than trusting posted numbers. */
export async function applySurvey(formData: FormData) {
  const ctx = await getContext();
  const size = targetSize(ctx, String(formData.get('size') ?? ''));
  const keep = new URLSearchParams();
  for (const [k, v] of formData.entries()) if (typeof v === 'string' && k !== '$ACTION_ID' && !k.startsWith('$ACTION')) keep.append(k, v);
  const qs = (extra: string) => `/survey?${new URLSearchParams([...keep.entries()].filter(([k]) => k !== 'size')).toString()}&size=${size}&${extra}`;
  const stop = (m: string): never => redirect(qs(`error=${encodeURIComponent(m)}`));
  if (!ctx.active) return stop('Add a child first.');
  const sizeRow = ctx.sizeByOrder.get(size);
  if (!sizeRow) return stop('That size could not be found.');

  const answers = parseAnswers((k) => formData.get(k) as string | null, (k) => formData.getAll(k).map(String));
  const { rows } = await surveyFor(ctx, answers, size);
  const goals = rows
    .filter((r) => r.qty > 0)
    .flatMap((r) => {
      const cat = ctx.categories.find((c) => c.name === CATEGORY_NAMES[r.key]);
      return cat ? [{ child_id: ctx.active!.id, category_id: cat.id, size_id: sizeRow.id, target_quantity: r.qty }] : [];
    });
  if (goals.length === 0) return stop('There were no suggestions to save.');
  const { error } = await ctx.supabase.from('wardrobe_goals').upsert(goals, { onConflict: 'child_id,category_id,size_id' });
  if (error) return stop('We could not save those goals. Try again.');
  ['/goals', '/shopping', '/dashboard', '/survey'].forEach((p) => revalidatePath(p));
  return redirect(`/goals?size=${size}&saved=1`);
}
