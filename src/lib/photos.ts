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
