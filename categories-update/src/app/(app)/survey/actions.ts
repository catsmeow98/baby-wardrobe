'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CATEGORY_NAMES, SURVEY_SIZES, parseAnswers } from '@/lib/domain';
import { getContext } from '@/lib/context';
import { defaultBirthMonth, surveyAll } from './compute';

/**
 * Saves the suggested goals for the sizes that were ticked. It recomputes from the answers on the server rather than
 * trusting posted numbers. Goals are set wherever the suggestion is above zero. Other goals stay as they are.
 */
export async function applySurvey(formData: FormData) {
  const q = String(formData.get('q') ?? '');
  const stop = (m: string): never => redirect(`/survey?${q}${q ? '&' : ''}error=${encodeURIComponent(m)}`);
  const ctx = await getContext();
  if (!ctx.active) return stop('Add a child first.');
  const child = ctx.active;

  const chosen = [...new Set(formData.getAll('save').map(Number))].filter((n) => (SURVEY_SIZES as readonly number[]).includes(n)).sort((a, b) => a - b);
  if (chosen.length === 0) return stop('Tick at least one size to save.');

  const p = new URLSearchParams(q);
  const answers = parseAnswers((k) => p.get(k), (k) => p.getAll(k), defaultBirthMonth(child.birth_date));
  const { results } = await surveyAll(ctx, answers);

  const goals = results
    .filter((r) => chosen.includes(r.size))
    .flatMap((r) => {
      const size = ctx.sizeByOrder.get(r.size);
      if (!size) return [];
      return r.rows
        .filter((x) => x.qty > 0)
        .flatMap((x) => {
          const cat = ctx.categories.find((c) => c.owner_id === null && c.name === CATEGORY_NAMES[x.key]);
          return cat ? [{ child_id: child.id, category_id: cat.id, size_id: size.id, target_quantity: x.qty }] : [];
        });
    });
  if (goals.length === 0) return stop('There were no suggestions to save.');
  const { error } = await ctx.supabase.from('wardrobe_goals').upsert(goals, { onConflict: 'child_id,category_id,size_id' });
  if (error) return stop('We could not save those goals. Try again.');
  ['/goals', '/shopping', '/dashboard', '/survey'].forEach((path) => revalidatePath(path));
  return redirect(`/goals?size=${chosen[0]}&saved=1`);
}
