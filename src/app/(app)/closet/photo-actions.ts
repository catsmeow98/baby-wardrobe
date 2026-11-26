'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { MAX_PHOTOS_PER_ITEM, PHOTO_BUCKET } from '@/lib/photos';
import { pathsOf, validPhotoPath } from '@/lib/photo-paths';

type Result = { ok: true } | { ok: false; error: string };

const refresh = (itemId: string) => {
  revalidatePath(`/closet/${itemId}`);
  revalidatePath('/closet');
};

/** Records a photo the browser already uploaded. Checks the item is yours, the path is in your folder, and the limit. */
export async function addPhoto(itemId: string, path: string, originalPath?: string): Promise<Result> {
  const id = z.string().uuid().safeParse(itemId);
  if (!id.success) return { ok: false, error: 'That item could not be found.' };
  const ctx = await getContext();
  const { data: item } = await ctx.supabase.from('inventory_items').select('id, child_id').eq('id', id.data).maybeSingle();
  if (!item) return { ok: false, error: 'That item could not be found.' };
  const prefix = `${ctx.user.id}/${item.child_id}/`;
  if (!validPhotoPath(path, prefix)) return { ok: false, error: 'That upload was not accepted.' };
  // A bad original is ignored (and cleaned up if it is ours); the picture is still saved.
  const original = originalPath && validPhotoPath(originalPath, prefix) ? originalPath : undefined;
  const files = pathsOf({ path, originalPath: original });
  const { count } = await ctx.supabase.from('inventory_photos').select('id', { count: 'exact', head: true }).eq('inventory_item_id', id.data);
  if ((count ?? 0) >= MAX_PHOTOS_PER_ITEM) {
    await ctx.supabase.storage.from(PHOTO_BUCKET).remove(files);
    return { ok: false, error: `You can add up to ${MAX_PHOTOS_PER_ITEM} photos per item.` };
  }
  const { error } = await ctx.supabase
    .from('inventory_photos')
    .insert({ inventory_item_id: id.data, storage_path: path, original_path: original ?? null, sort_order: count ?? 0 });
  if (error) {
    await ctx.supabase.storage.from(PHOTO_BUCKET).remove(files);
    return { ok: false, error: 'We could not save that photo. Try again.' };
  }
  refresh(id.data);
  return { ok: true };
}

export async function deletePhoto(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get('photoId'));
  if (!id.success) return;
  const ctx = await getContext();
  const { data: photo } = await ctx.supabase.from('inventory_photos').select('id, inventory_item_id, storage_path, original_path').eq('id', id.data).maybeSingle();
  if (!photo) return;
  await ctx.supabase.storage.from(PHOTO_BUCKET).remove(pathsOf({ path: photo.storage_path as string, originalPath: (photo.original_path as string | null) ?? undefined }));
  await ctx.supabase.from('inventory_photos').delete().eq('id', id.data);
  refresh(photo.inventory_item_id as string);
}

/** Swaps a saved photo for an edited file the browser already uploaded, then deletes the old file. */
export async function replacePhoto(photoId: string, path: string, originalPath?: string): Promise<Result> {
  const id = z.string().uuid().safeParse(photoId);
  if (!id.success) return { ok: false, error: 'That photo could not be found.' };
  const ctx = await getContext();
  const { data: photo } = await ctx.supabase.from('inventory_photos').select('id, inventory_item_id, storage_path, original_path').eq('id', id.data).maybeSingle();
  if (!photo) return { ok: false, error: 'That photo could not be found.' };
  const { data: item } = await ctx.supabase.from('inventory_items').select('child_id').eq('id', photo.inventory_item_id as string).maybeSingle();
  const prefix = `${ctx.user.id}/${item?.child_id}/`;
  if (!item || !validPhotoPath(path, prefix)) return { ok: false, error: 'That upload was not accepted.' };
  const original = originalPath && validPhotoPath(originalPath, prefix) ? originalPath : undefined;
  const newFiles = pathsOf({ path, originalPath: original });
  const { error } = await ctx.supabase.from('inventory_photos').update({ storage_path: path, original_path: original ?? null }).eq('id', id.data);
  if (error) {
    await ctx.supabase.storage.from(PHOTO_BUCKET).remove(newFiles);
    return { ok: false, error: 'We could not save that photo. Try again.' };
  }
  const oldFiles = pathsOf({ path: photo.storage_path as string, originalPath: (photo.original_path as string | null) ?? undefined }).filter((f) => !newFiles.includes(f));
  await ctx.supabase.storage.from(PHOTO_BUCKET).remove(oldFiles);
  refresh(photo.inventory_item_id as string);
  return { ok: true };
}
