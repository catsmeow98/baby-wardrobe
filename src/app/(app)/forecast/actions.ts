'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { todayIso } from '@/lib/forecast-data';

const back = (qs: string): never => redirect(`/forecast${qs}`);
const fail = (m: string): never => back(`?error=${encodeURIComponent(m)}`);
const ok = (m: string): never => back(`?ok=${encodeURIComponent(m)}`);
const refresh = () => ['/forecast', '/survey'].forEach((p) => revalidatePath(p));
const uuid = z.string().uuid();

export async function addMeasurement(formData: FormData) {
  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.'),
      length: z.coerce.number().min(10, 'Enter a length between 10 and 60 inches.').max(60, 'Enter a length between 10 and 60 inches.'),
    })
    .safeParse({ date: formData.get('date'), length: formData.get('length') });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const ctx = await getContext();
  const child = ctx.active;
  if (!child) return fail('Add a child first.');
  const { date, length } = parsed.data;
  if (date > todayIso()) return fail('The measurement date cannot be in the future.');
  if (child.birth_date && date < child.birth_date) return fail('The measurement date cannot be before the birth date.');
  const { error } = await ctx.supabase.from('measurements').insert({ child_id: child.id, measured_on: date, length_in: length });
  if (error) return fail('We could not save that measurement. Try again.');
  refresh();
  return ok('Measurement added.');
}

export async function deleteMeasurement(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return fail('That measurement could not be found.');
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('measurements').delete().eq('id', id.data);
  if (error) return fail('We could not delete that measurement.');
  refresh();
  return ok('Measurement deleted.');
}

export async function saveBrandOffset(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  const offset = z.coerce.number().min(-3).max(3).safeParse(formData.get('offset'));
  if (!id.success || !offset.success) return fail('Enter an offset between -3 and 3 inches.');
  const ctx = await getContext();
  // Row-level security only lets the owner change a brand, so a shared brand simply matches no rows.
  const { data, error } = await ctx.supabase.from('brands').update({ size_offset: Math.round(offset.data * 4) / 4 }).eq('id', id.data).select('id');
  if (error || !data?.length) return fail('We could not change that brand.');
  refresh();
  return ok('Brand offset saved.');
}

export async function clearRatings(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return fail('That brand could not be found.');
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('inventory_items').update({ fit_feedback: null }).eq('brand_id', id.data);
  if (error) return fail('We could not clear those ratings.');
  refresh();
  revalidatePath('/closet');
  return ok('Ratings cleared.');
}
