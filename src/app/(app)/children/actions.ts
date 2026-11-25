'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { childSchema } from '@/lib/validation/children';
import { safeNext } from '@/lib/auth/redirect';

const back = (error?: string): never => redirect(error ? `/account?error=${encodeURIComponent(error)}#children` : '/account#children');
const refresh = () => ['/account', '/dashboard', '/closet', '/goals', '/shopping', '/forecast', '/survey'].forEach((p) => revalidatePath(p));

export async function createChild(formData: FormData) {
  // Where to go afterward, for example back to survey suggestions. Only same-site paths are accepted.
  const dest = formData.get('next') ? safeNext(String(formData.get('next'))) : null;
  const fail = (m: string): never => redirect(`/account?error=${encodeURIComponent(m)}${dest ? `&next=${encodeURIComponent(dest)}` : ''}#children`);
  const parsed = childSchema.safeParse({
    name: formData.get('name'),
    birthDate: formData.get('birthDate'),
    currentSizeId: formData.get('currentSizeId'),
    growthReference: formData.get('growthReference'),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  // owner_id defaults to auth.uid() in the database, and row-level security rejects anything else.
  const { error } = await supabase.from('children').insert({
    name: parsed.data.name,
    birth_date: parsed.data.birthDate ?? null,
    current_size_id: parsed.data.currentSizeId ?? null,
    growth_reference: parsed.data.growthReference ?? null,
  });
  if (error) return fail('We could not save that. Check the size and try again.');
  refresh();
  return dest ? redirect(dest) : back();
}

export async function updateChild(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('id'));
  const parsed = childSchema.safeParse({
    name: formData.get('name'),
    birthDate: formData.get('birthDate'),
    currentSizeId: formData.get('currentSizeId'),
    growthReference: formData.get('growthReference'),
  });
  if (!id.success) return back('That child could not be found.');
  if (!parsed.success) return back(parsed.error.issues[0].message);
  const supabase = await createClient();
  const [{ data: before }, { data: sizes }] = await Promise.all([
    supabase.from('children').select('current_size_id').eq('id', id.data).maybeSingle(),
    supabase.from('sizes').select('id, sort_order'),
  ]);
  const orderOf = new Map(((sizes ?? []) as { id: string; sort_order: number }[]).map((s) => [s.id, s.sort_order]));
  const { error } = await supabase
    .from('children')
    .update({
      name: parsed.data.name,
      birth_date: parsed.data.birthDate ?? null,
      current_size_id: parsed.data.currentSizeId ?? null,
      growth_reference: parsed.data.growthReference ?? null,
    })
    .eq('id', id.data);
  if (error) return back('We could not save those changes. Try again.');
  refresh();
  // A bigger current size usually means some clothes no longer fit: offer to tidy them (see the Account page).
  const was = before?.current_size_id ? orderOf.get(before.current_size_id) : undefined;
  const now = parsed.data.currentSizeId ? orderOf.get(parsed.data.currentSizeId) : undefined;
  if (was !== undefined && now !== undefined && now > was) return redirect(`/account?outgrown=${id.data}#children`);
  return back();
}

export async function deleteChild(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return back('That child could not be found.');
  const supabase = await createClient();
  // Deleting a child removes their items, goals, and shopping list through cascading foreign keys.
  const { error } = await supabase.from('children').delete().eq('id', id.data);
  if (error) return back('We could not remove that child. Try again.');
  refresh();
  return back();
}
