'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { childSchema } from '@/lib/validation/children';
import { todayIso } from '@/lib/forecast-data';
import { fetchMonthClasses } from '@/lib/weather';
import { stepPath, type StepId } from '@/lib/setup';

/** Sends the person to a step, with a message when there is one. */
const to = (step: StepId, params: { ok?: string; error?: string } = {}): never => {
  const q = new URLSearchParams();
  if (step !== 'welcome') q.set('step', step);
  if (params.ok) q.set('ok', params.ok);
  if (params.error) q.set('error', params.error);
  const s = q.toString();
  return redirect(s ? `/welcome?${s}` : stepPath('welcome'));
};
const refresh = () => ['/account', '/dashboard', '/closet', '/goals', '/shopping', '/forecast', '/survey', '/welcome'].forEach((p) => revalidatePath(p));

const place = z.object({
  label: z.string().trim().min(1).max(120),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

/** Same as saving a location on the Account page, but returns to the guide. */
export async function saveWelcomeLocation(formData: FormData) {
  const p = place.safeParse({ label: formData.get('label'), latitude: formData.get('latitude'), longitude: formData.get('longitude') });
  if (!p.success) return to('location', { error: 'That place could not be used. Search again.' });
  const ctx = await getContext();
  let months;
  try {
    months = await fetchMonthClasses(p.data.latitude, p.data.longitude);
  } catch {
    return to('location', { error: 'We could not look up the weather just now. Try again in a minute.' });
  }
  if (!months) return to('location', { error: 'There is not enough weather history for that place. Try a larger nearby town.' });
  const round = (n: number) => Math.round(n * 100) / 100;
  const { error } = await ctx.supabase.from('user_settings').upsert(
    { owner_id: ctx.user.id, place_name: p.data.label, latitude: round(p.data.latitude), longitude: round(p.data.longitude), month_classes: months, updated_at: new Date().toISOString() },
    { onConflict: 'owner_id' },
  );
  if (error) return to('location', { error: 'We could not save that place. Try again.' });
  refresh();
  return to('location', { ok: `Location set to ${p.data.label}.` });
}

const childFields = (formData: FormData) =>
  childSchema.safeParse({
    name: formData.get('name'),
    birthDate: formData.get('birthDate'),
    currentSizeId: formData.get('currentSizeId'),
    growthReference: formData.get('growthReference'),
  });

/** Adds a child. "again" stays on the screen to add another, otherwise on to the measurement. */
export async function addWelcomeChild(formData: FormData) {
  const parsed = childFields(formData);
  if (!parsed.success) return to('child', { error: parsed.error.issues[0].message });
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('children').insert({
    name: parsed.data.name,
    birth_date: parsed.data.birthDate ?? null,
    current_size_id: parsed.data.currentSizeId ?? null,
    growth_reference: parsed.data.growthReference ?? null,
  });
  if (error) return to('child', { error: 'We could not save that. Check the size and try again.' });
  refresh();
  return formData.get('again') ? to('child', { ok: `${parsed.data.name} was added.` }) : to('measure');
}

export async function editWelcomeChild(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('id'));
  const parsed = childFields(formData);
  if (!id.success) return to('child', { error: 'That child could not be found.' });
  if (!parsed.success) return to('child', { error: parsed.error.issues[0].message });
  const ctx = await getContext();
  // This form sets only the bottom size. Keep an "up to" size set on the Account page while it is still above the bottom.
  const was = ctx.children.find((c) => c.id === id.data);
  const fromO = parsed.data.currentSizeId ? ctx.orderOf.get(parsed.data.currentSizeId) : undefined;
  const toO = was?.current_size_to_id ? ctx.orderOf.get(was.current_size_to_id) : undefined;
  const keepTo = fromO !== undefined && toO !== undefined && toO > fromO;
  const { error } = await ctx.supabase
    .from('children')
    .update({
      name: parsed.data.name,
      birth_date: parsed.data.birthDate ?? null,
      current_size_id: parsed.data.currentSizeId ?? null,
      ...(keepTo ? {} : { current_size_to_id: null }),
      growth_reference: parsed.data.growthReference ?? null,
    })
    .eq('id', id.data);
  if (error) return to('child', { error: 'We could not save those changes. Try again.' });
  refresh();
  return to('child', { ok: 'Saved.' });
}

/** Adds a length for one child. The same checks as the Forecast page, for any of the person's children. */
export async function addWelcomeMeasurement(formData: FormData) {
  const parsed = z
    .object({
      childId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.'),
      length: z.coerce.number().min(10, 'Enter a length between 10 and 60 inches.').max(60, 'Enter a length between 10 and 60 inches.'),
    })
    .safeParse({ childId: formData.get('childId'), date: formData.get('date'), length: formData.get('length') });
  if (!parsed.success) return to('measure', { error: parsed.error.issues[0].message });
  const ctx = await getContext();
  const child = ctx.children.find((c) => c.id === parsed.data.childId);
  if (!child) return to('measure', { error: 'Add a child first.' });
  const { date, length } = parsed.data;
  if (date > todayIso()) return to('measure', { error: 'The measurement date cannot be in the future.' });
  if (child.birth_date && date < child.birth_date) return to('measure', { error: 'The measurement date cannot be before the birth date.' });
  const { error } = await ctx.supabase.from('measurements').insert({ child_id: child.id, measured_on: date, length_in: length });
  if (error) return to('measure', { error: 'We could not save that measurement. Try again.' });
  refresh();
  return to('goals');
}

/** Hides the guide and its dashboard reminder. It stays available from Account. */
export async function dismissSetup() {
  const ctx = await getContext();
  await ctx.supabase.from('user_settings').upsert({ owner_id: ctx.user.id, setup_dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
  revalidatePath('/dashboard');
  return redirect('/dashboard');
}
