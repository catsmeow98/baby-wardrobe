import type { SupabaseClient } from '@supabase/supabase-js';

export const PHOTO_BUCKET = 'wardrobe-photos';
export const MAX_PHOTOS_PER_ITEM = 5;

/** Signed links for private photos, keyed by storage path. Links expire after an hour. */
export async function signedUrls(supabase: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

/**
 * Deletes every file in a user's folder of the photo bucket. Returns false when anything could not be listed or removed,
 * so the caller can stop before deleting the account and leaving private files behind.
 */
export async function removeAllPhotos(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const files: string[] = [];
  const queue = [userId];
  while (queue.length) {
    const prefix = queue.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(prefix, { limit: 1000, offset });
      if (error) return false;
      for (const e of data ?? []) {
        if (e.id) files.push(`${prefix}/${e.name}`);
        else queue.push(`${prefix}/${e.name}`); // a folder
      }
      if ((data ?? []).length < 1000) break;
    }
  }
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(files.slice(i, i + 100));
    if (error) return false;
  }
  return true;
}

/**
 * Deletes photo files that no item refers to any more (left behind by a failed upload, say). Files newer than an hour are
 * kept, because an upload in progress has a file before its database row. Returns how many were removed, or null on failure.
 */
export async function removeOrphanPhotos(supabase: SupabaseClient, userId: string): Promise<number | null> {
  const { data: rows, error: rowsError } = await supabase.from('inventory_photos').select('storage_path, original_path');
  if (rowsError) return null;
  const used = new Set((rows ?? []).flatMap((r: { storage_path: string; original_path: string | null }) => (r.original_path ? [r.storage_path, r.original_path] : [r.storage_path])));
  const old: string[] = [];
  const queue = [userId];
  const cutoff = Date.now() - 3_600_000;
  while (queue.length) {
    const prefix = queue.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(prefix, { limit: 1000, offset });
      if (error) return null;
      for (const e of data ?? []) {
        const path = `${prefix}/${e.name}`;
        if (!e.id) queue.push(path);
        else if (!used.has(path) && e.created_at && Date.parse(e.created_at) < cutoff) old.push(path);
      }
      if ((data ?? []).length < 1000) break;
    }
  }
  for (let i = 0; i < old.length; i += 100) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(old.slice(i, i + 100));
    if (error) return null;
  }
  return old.length;
}
