'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { childSchema } from '@/lib/validation/children';

const back = (error?: string): never => redirect(error ? `/children?error=${encodeURIComponent(error)}` : '/children');

export async function createChild(formData: FormData) {
  const parsed = childSchema.safeParse({
    name: formData.get('name'),
    birthDate: formData.get('birthDate'),
    currentSizeId: formData.get('currentSizeId'),
  });
  if (!parsed.success) return back(parsed.error.issues[0].message);

  const supabase = await createClient();
  // owner_id defaults to auth.uid() in the database, and row-level security rejects anything else.
  const { error } = await supabase.from('children').insert({
    name: parsed.data.name,
    birth_date: parsed.data.birthDate ?? null,
    current_size_id: parsed.data.currentSizeId ?? null,
  });
  if (error) return back('We could not save that. Check the size and try again.');
  revalidatePath('/children');
  return back();
}

export async function deleteChild(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return back('That child could not be found.');
  const supabase = await createClient();
  // Deleting a child removes their items, goals, and shopping list through cascading foreign keys.
  const { error } = await supabase.from('children').delete().eq('id', id.data);
  if (error) return back('We could not remove that child. Try again.');
  revalidatePath('/children');
  return back();
}
