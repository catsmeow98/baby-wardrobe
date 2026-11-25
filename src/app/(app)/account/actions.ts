'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { removeAllPhotos, removeOrphanPhotos } from '@/lib/photos';

const stop = (m: string): never => redirect(`/account?error=${encodeURIComponent(m)}`);

/** Permanently deletes the signed-in account and everything it owns. The person must type DELETE. */
export async function deleteAccount(formData: FormData) {
  if (String(formData.get('confirm') ?? '').trim() !== 'DELETE') return stop('Type DELETE in capital letters to confirm.');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  // Files first: deleting the account removes database rows but not the files behind them.
  if (!(await removeAllPhotos(supabase, user.id))) return stop('We could not remove your photos, so nothing was deleted. Try again.');
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return stop('We could not delete your account. Nothing else was changed. Try again.');
  await supabase.auth.signOut().catch(() => undefined);
  return redirect(`/login?message=${encodeURIComponent('Your account and all of its data were deleted.')}`);
}

/** Removes photo files no item uses. Safe to run any time; recent uploads are left alone. */
export async function cleanupPhotos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');
  const n = await removeOrphanPhotos(supabase, user.id);
  if (n === null) return stop('We could not finish the cleanup. Nothing that is in use was touched. Try again.');
  return redirect(`/account?ok=${encodeURIComponent(n === 0 ? 'No unused photo files found.' : `Removed ${n} unused photo file${n === 1 ? '' : 's'}.`)}`);
}

/** After a size increase: mark active items that no longer fit as outgrown or stored, for the sizes below the new current size. */
export async function markOutgrown(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('childId'));
  const mode = z.enum(['outgrown', 'stored']).safeParse(formData.get('mode'));
  if (!id.success || !mode.success) return stop('Choose what to do with the old items.');
  const supabase = await createClient();
  const { data: child } = await supabase.from('children').select('current_size_id').eq('id', id.data).maybeSingle();
  const { data: sizes } = await supabase.from('sizes').select('id, sort_order');
  const list = (sizes ?? []) as { id: string; sort_order: number }[];
  const cur = list.find((s) => s.id === child?.current_size_id);
  if (!cur) return stop('Set the current size first.');
  const below = list.filter((s) => s.sort_order < cur.sort_order).map((s) => s.id);
  if (below.length) {
    const { error } = await supabase.from('inventory_items').update({ status: mode.data }).eq('child_id', id.data).eq('status', 'active').in('fit_to_size_id', below);
    if (error) return stop('We could not update those items. Try again.');
  }
  for (const p of ['/closet', '/goals', '/dashboard', '/shopping']) revalidatePath(p);
  return redirect(`/account?ok=${encodeURIComponent(mode.data === 'outgrown' ? 'Marked as outgrown.' : 'Moved to stored.')}#children`);
}
