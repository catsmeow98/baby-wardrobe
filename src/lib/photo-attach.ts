import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_PHOTOS_PER_ITEM, PHOTO_BUCKET } from '@/lib/photos';
import { pathsOf, splitPhotoField, validPhotoPath, type PhotoRef } from '@/lib/photo-paths';

/** Reads form values ("path" or "path|originalPath"), keeping only references that sit inside this child's folder, once each. */
export function parsePhotoFields(values: string[], prefix: string): PhotoRef[] {
  const keep: PhotoRef[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const ref = splitPhotoField(value);
    if (seen.has(ref.path)) continue;
    seen.add(ref.path);
    if (!validPhotoPath(ref.path, prefix)) continue; // not ours, so nothing of it is deleted either
    // A bad original is dropped but the picture is still kept; the original file is cleaned up.
    if (ref.originalPath && !validPhotoPath(ref.originalPath, prefix)) {
      keep.push({ path: ref.path });
      continue;
    }
    keep.push(ref);
  }
  return keep;
}

/**
 * Records photos the browser already uploaded for a newly created item, with the stored original of each when there is one.
 * Each path must sit inside the person's own folder for that child. Anything rejected, over the limit, or that fails to
 * save is removed from storage so no stray files are left behind. Returns how many were attached.
 */
export async function attachPhotos(supabase: SupabaseClient, userId: string, childId: string, itemId: string, values: string[]): Promise<number> {
  const prefix = `${userId}/${childId}/`;
  const all = parsePhotoFields(values, prefix);
  const keep = all.slice(0, MAX_PHOTOS_PER_ITEM);
  const discard = all.slice(MAX_PHOTOS_PER_ITEM).flatMap(pathsOf);
  if (discard.length) await supabase.storage.from(PHOTO_BUCKET).remove(discard);
  if (keep.length === 0) return 0;
  const { error } = await supabase
    .from('inventory_photos')
    .insert(keep.map((r, i) => ({ inventory_item_id: itemId, storage_path: r.path, original_path: r.originalPath ?? null, sort_order: i })));
  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove(keep.flatMap(pathsOf));
    return 0;
  }
  return keep.length;
}

/** Removes uploaded files that will never be attached, for example photos picked on a bulk row that was left blank. */
export async function discardPhotos(supabase: SupabaseClient, userId: string, childId: string, values: string[]): Promise<void> {
  const prefix = `${userId}/${childId}/`;
  const own = [...new Set(values.flatMap((v) => pathsOf(splitPhotoField(v))))].filter((p) => p.startsWith(prefix) && !p.includes('..'));
  if (own.length) await supabase.storage.from(PHOTO_BUCKET).remove(own);
}
