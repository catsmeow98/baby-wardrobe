import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_PHOTOS_PER_ITEM, PHOTO_BUCKET } from '@/lib/photos';

/**
 * Records photos the browser already uploaded for a newly created item. Each path must sit inside the person's own
 * folder for that child. Anything rejected, over the limit, or that fails to save is removed from storage so no
 * stray files are left behind. Returns how many were attached.
 */
export async function attachPhotos(supabase: SupabaseClient, userId: string, childId: string, itemId: string, paths: string[]): Promise<number> {
  const prefix = `${userId}/${childId}/`;
  const unique = [...new Set(paths)].filter((p) => p.startsWith(prefix));
  const ok = unique.filter((p) => !p.includes('..') && p.length <= 200 && p.endsWith('.jpg'));
  const keep = ok.slice(0, MAX_PHOTOS_PER_ITEM);
  const discard = unique.filter((p) => !keep.includes(p));
  if (discard.length) await supabase.storage.from(PHOTO_BUCKET).remove(discard);
  if (keep.length === 0) return 0;
  const { error } = await supabase
    .from('inventory_photos')
    .insert(keep.map((storage_path, i) => ({ inventory_item_id: itemId, storage_path, sort_order: i })));
  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove(keep);
    return 0;
  }
  return keep.length;
}

/** Removes uploaded files that will never be attached, for example photos picked on a bulk row that was left blank. */
export async function discardPhotos(supabase: SupabaseClient, userId: string, childId: string, paths: string[]): Promise<void> {
  const prefix = `${userId}/${childId}/`;
  const own = [...new Set(paths)].filter((p) => p.startsWith(prefix) && !p.includes('..'));
  if (own.length) await supabase.storage.from(PHOTO_BUCKET).remove(own);
}
