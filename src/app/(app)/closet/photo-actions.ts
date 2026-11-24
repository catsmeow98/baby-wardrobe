'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { MAX_PHOTOS_PER_ITEM, PHOTO_BUCKET } from '@/lib/photos';

type Result = { ok: true } | { ok: false; error: string };

const refresh = (itemId: string) => {
  revalidatePath(`/closet/${itemId}`);
  revalidatePath('/closet');
};

/** Records a photo the browser already uploaded. Checks the item is yours, the path is in your folder, and the limit. */
export async function addPhoto(itemId: string, path: string): Promise<Result> {
  const id = z.string().uuid().safeParse(itemId);
  if (!id.success) return { ok: false, error: 'That item could not be found.' };
  const ctx = await getContext();
  const { data: item } = await ctx.supabase.from('inventory_items').select('id, child_id').eq('id', id.data).maybeSingle();
  if (!item) return { ok: false, error: 'That item could not be found.' };
  const prefix = `${ctx.user.id}/${item.child_id}/`;
  if (!path.startsWith(prefix) || path.includes('..') || path.length > 200) return { ok: false, error: 'That upload was not accepted.' };
  const { count } = await ctx.supabase.from('inventory_photos').select('id', { count: 'exact', head: true }).eq('inventory_item_id', id.data);
  if ((count ?? 0) >= MAX_PHOTOS_PER_ITEM) {
    await ctx.supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return { ok: false, error: `You can add up to ${MAX_PHOTOS_PER_ITEM} photos per item.` };
  }
  const { error } = await ctx.supabase
    .from('inventory_photos')
    .insert({ inventory_item_id: id.data, storage_path: path, sort_order: count ?? 0 });
  if (error) {
    await ctx.supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return { ok: false, error: 'We could not save that photo. Try again.' };
  }
  refresh(id.data);
  return { ok: true };
}

export async function deletePhoto(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get('photoId'));
  if (!id.success) return;
  const ctx = await getContext();
  const { data: photo } = await ctx.supabase.from('inventory_photos').select('id, inventory_item_id, storage_path').eq('id', id.data).maybeSingle();
  if (!photo) return;
  await ctx.supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path as string]);
  await ctx.supabase.from('inventory_photos').delete().eq('id', id.data);
  refresh(photo.inventory_item_id as string);
}
