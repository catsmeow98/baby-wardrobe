import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_BUCKET } from '@/lib/photos';
import { extOf } from '@/lib/photo-client';
import type { PhotoRef } from '@/lib/photo-paths';

/**
 * Uploads a photo and, when there is one, its original (the picture with its background, cropped to the same area). The
 * original goes first. If the picture then fails to upload, the original is removed again. If only the original fails,
 * the picture is still saved, just without a way back. Returns the paths, or null when the picture itself did not upload.
 */
export async function uploadPhoto(supabase: SupabaseClient, userId: string, childId: string, blob: Blob, original?: Blob): Promise<PhotoRef | null> {
  const stem = `${userId}/${childId}/${crypto.randomUUID()}`;
  const store = supabase.storage.from(PHOTO_BUCKET);
  let originalPath: string | undefined;
  // The picture is its own original (it was saved with its background): one file serves as both.
  if (original && original !== blob) {
    const candidate = `${stem}-o.${extOf(original)}`;
    const { error } = await store.upload(candidate, original, { contentType: original.type });
    if (!error) originalPath = candidate;
  }
  const path = `${stem}.${extOf(blob)}`;
  const { error } = await store.upload(path, blob, { contentType: blob.type });
  if (error) {
    if (originalPath) await store.remove([originalPath]);
    return null;
  }
  if (original === blob) return { path, originalPath: path };
  return originalPath ? { path, originalPath } : { path };
}

/** Downloads a stored original for the editor. Null when it cannot be fetched (the editor then just offers Erase). */
export async function downloadOriginal(supabase: SupabaseClient, originalPath: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(originalPath);
  return error ? null : data;
}
