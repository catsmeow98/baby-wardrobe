'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CATEGORY_NAMES, answersToParams, defaultSizes, parseAnswers, type CatKey } from '@/lib/domain';
import { getContext } from '@/lib/context';
import { safeBackAny, withParams } from '@/lib/back';
import { defaultBirthMonth, surveyAll } from './compute';

/**
 * Saves the suggested goals for the sizes that were ticked. It recomputes from the answers on the server rather than
 * trusting posted numbers. For each ticked size the survey's answer is the whole plan: goals are set wherever the suggestion
 * is above zero, and every other goal for that size (an item type not picked this time) is set to 0. Sizes not ticked are
 * left alone. Everything goes in one upsert, so either all of it is saved or none of it.
 */
export async function applySurvey(formData: FormData) {
  const q = String(formData.get('q') ?? '');
  const back = safeBackAny(formData.get('back'), ['/goals', '/welcome'], '/goals');
  const backQs = back !== '/goals' ? `&back=${encodeURIComponent(back)}` : '';
  const stop = (m: string): never => redirect(`/survey?${q}${q ? '&' : ''}view=results&error=${encodeURIComponent(m)}${backQs}`);
  const ctx = await getContext();
  if (!ctx.active) return stop('Add a child first.');
  const child = ctx.active;

  const p = new URLSearchParams(q);
  const answers = parseAnswers((k) => p.get(k), (k) => p.getAll(k), defaultBirthMonth(child.birth_date), defaultSizes(ctx.currentSize));
  const chosen = [...new Set(formData.getAll('save').map(Number))].filter((n) => answers.sizes.includes(n)).sort((a, b) => a - b);
  if (chosen.length === 0) return stop('Tick at least one size to save.');
  const { results } = await surveyAll(ctx, answers);

  const goals = results
    .filter((r) => chosen.includes(r.size))
    .flatMap((r) => {
      const size = ctx.sizeByOrder.get(r.size);
      if (!size) return [];
      return r.rows
        .filter((x) => x.qty > 0)
        .flatMap((x) => {
          // A built-in is matched on its built-in name, so a person's own rename of it does not matter. Their own types are matched
          // by id. An item type they deleted is skipped.
          const cat = x.key in CATEGORY_NAMES
            ? ctx.categories.find((c) => c.is_default && c.base_name === CATEGORY_NAMES[x.key as CatKey])
            : ctx.categories.find((c) => c.id === x.key);
          return cat ? [{ child_id: child.id, category_id: cat.id, size_id: size.id, target_quantity: x.qty }] : [];
        });
    });
  if (goals.length === 0) return stop('There were no suggestions to save.');
  // Item types not picked this time: their goals for the ticked sizes drop to 0.
  const sizeIds = chosen.map((n) => ctx.sizeByOrder.get(n)?.id).filter((id): id is string => Boolean(id));
  const { data: existing, error: readError } = await ctx.supabase
    .from('wardrobe_goals')
    .select('category_id, size_id, target_quantity')
    .eq('child_id', child.id)
    .in('size_id', sizeIds);
  if (readError) return stop('We could not read your current goals. Try again.');
  const kept = new Set(goals.map((g) => `${g.category_id}|${g.size_id}`));
  const cleared = (existing ?? [])
    .filter((g: { category_id: string; size_id: string; target_quantity: number }) => g.target_quantity > 0 && !kept.has(`${g.category_id}|${g.size_id}`))
    .map((g: { category_id: string; size_id: string }) => ({ child_id: child.id, category_id: g.category_id, size_id: g.size_id, target_quantity: 0 }));
  // Remember the answers for this child, so the next retake opens pre-filled. A failure here never blocks saving goals.
  const remembered = answersToParams(answers).toString();
  if (remembered.length <= 8000) await ctx.supabase.from('children').update({ survey_answers: remembered }).eq('id', child.id);
  const { error } = await ctx.supabase.from('wardrobe_goals').upsert([...goals, ...cleared], { onConflict: 'child_id,category_id,size_id' });
  if (error) return stop('We could not save those goals. Try again.');
  ['/goals', '/shopping', '/dashboard', '/survey'].forEach((path) => revalidatePath(path));
  return redirect(withParams(back, { size: String(chosen[0]), saved: '1' }));
}
