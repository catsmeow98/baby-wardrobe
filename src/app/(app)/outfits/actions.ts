'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';

const MAX_ITEMS = 12;
const schema = z.object({
  name: z.string().trim().min(1, 'Give the outfit a name.').max(80, 'Use 80 characters or fewer for the name.'),
  notes: z.string().trim().max(500, 'Use 500 characters or fewer for notes.').default(''),
  items: z.array(z.string().uuid()).min(1, 'Choose at least one item.').max(MAX_ITEMS, `An outfit holds up to ${MAX_ITEMS} items.`),
});

/** Creates an outfit, or updates one when the form carries its id. The items must all belong to the outfit's child. */
export async function saveOutfit(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('id') || undefined);
  const path = id.success ? `/outfits/${id.data}` : '/outfits/new';
  const fail = (m: string): never => redirect(`${path}?error=${encodeURIComponent(m)}`);
  const parsed = schema.safeParse({ name: formData.get('name'), notes: formData.get('notes') ?? '', items: [...new Set(formData.getAll('item').map(String))] });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;
  const ctx = await getContext();

  let childId = ctx.active?.id;
  if (id.success) {
    const { data: existing } = await ctx.supabase.from('outfits').select('child_id').eq('id', id.data).maybeSingle();
    if (!existing) return fail('That outfit could not be found.');
    childId = existing.child_id as string;
  }
  if (!childId) return fail('Add a child first.');
  const { data: owned } = await ctx.supabase.from('inventory_items').select('id').eq('child_id', childId).in('id', v.items);
  if ((owned ?? []).length !== v.items.length) return fail('Some of those items could not be found.');

  let outfitId = id.success ? id.data : '';
  if (id.success) {
    const { error } = await ctx.supabase.from('outfits').update({ name: v.name, notes: v.notes || null }).eq('id', id.data);
    if (error) return fail('We could not save that outfit. Try again.');
    await ctx.supabase.from('outfit_items').delete().eq('outfit_id', id.data);
  } else {
    const { data, error } = await ctx.supabase.from('outfits').insert({ child_id: childId, name: v.name, notes: v.notes || null }).select('id').single();
    if (error || !data) return fail('We could not save that outfit. Try again.');
    outfitId = data.id as string;
  }
  const { error: itemsError } = await ctx.supabase.from('outfit_items').insert(v.items.map((item_id, i) => ({ outfit_id: outfitId, item_id, sort_order: i })));
  if (itemsError) return redirect(`/outfits/${outfitId}?error=${encodeURIComponent('The outfit was saved, but its items could not be. Choose them again.')}`);
  revalidatePath('/outfits');
  return redirect('/outfits?ok=' + encodeURIComponent(`${v.name} saved.`));
}

export async function deleteOutfit(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return redirect('/outfits?error=' + encodeURIComponent('That outfit could not be found.'));
  const ctx = await getContext();
  const { error } = await ctx.supabase.from('outfits').delete().eq('id', id.data);
  if (error) return redirect('/outfits?error=' + encodeURIComponent('We could not delete that outfit. Try again.'));
  revalidatePath('/outfits');
  return redirect('/outfits?ok=' + encodeURIComponent('Outfit deleted.'));
}
