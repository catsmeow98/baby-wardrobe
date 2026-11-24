'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { removeAllPhotos } from '@/lib/photos';

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
