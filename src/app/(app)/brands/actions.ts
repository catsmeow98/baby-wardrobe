'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';

const fail = (m: string): never => redirect(`/forecast?brandError=${encodeURIComponent(m)}#brands`);
const ok = (m: string): never => redirect(`/forecast?brandOk=${encodeURIComponent(m)}#brands`);
const refresh = () => ['/forecast', '/closet', '/survey', '/dashboard'].forEach((p) => revalidatePath(p));
const uuid = z.string().uuid();
const name = z.string().trim().min(1, 'Enter a brand name.').max(80, 'Use 80 characters or fewer.');
const offset = z.coerce.number().min(-3).max(3);
const DUPLICATE = '23505';

export async function addBrand(formData: FormData) {
  const n = name.safeParse(formData.get('name'));
  const o = offset.safeParse(formData.get('offset') || 0);
  if (!n.success) return fail(n.error.issues[0].message);
  if (!o.success) return fail('Enter an offset between -3 and 3 inches.');
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('brands').insert({ name: n.data, owner_id: ctx.user.id, size_offset: Math.round(o.data * 4) / 4 });
  if (error) return fail(error.code === DUPLICATE ? `You already have a brand called ${n.data}.` : 'We could not add that brand.');
  refresh();
  return ok(`${n.data} added.`);
}

export async function updateBrand(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  const n = name.safeParse(formData.get('name'));
  const o = offset.safeParse(formData.get('offset') || 0);
  if (!id.success) return fail('That brand could not be found.');
  if (!n.success) return fail(n.error.issues[0].message);
  if (!o.success) return fail('Enter an offset between -3 and 3 inches.');
  const ctx = await getContext();
  // Row-level security only lets the owner change a brand, so a shared brand matches no rows.
  const { data, error } = await ctx.supabase.from('brands').update({ name: n.data, size_offset: Math.round(o.data * 4) / 4 }).eq('id', id.data).select('id');
  if (error) return fail(error.code === DUPLICATE ? `You already have a brand called ${n.data}.` : 'We could not save that brand.');
  if (!data?.length) return fail('That brand cannot be changed.');
  refresh();
  return ok('Brand saved.');
}

export async function deleteBrand(formData: FormData) {
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return fail('That brand could not be found.');
  const ctx = await getContext();
  // Items that used the brand keep everything else and simply show no brand.
  const { data, error } = await ctx.supabase.from('brands').delete().eq('id', id.data).select('id');
  if (error || !data?.length) return fail('We could not delete that brand.');
  refresh();
  return ok('Brand deleted. Its items now have no brand.');
}
