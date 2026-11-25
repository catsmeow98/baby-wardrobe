'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PHOTO_BUCKET } from '@/lib/photos';
import { extOf } from '@/lib/photo-client';
import { btnGhostCls } from '@/components/ui';
import { PhotoEditor } from '@/components/photo-editor';
import { replacePhoto } from '@/app/(app)/closet/photo-actions';

/** "Edit" for a photo already on an item: opens the editor on it and swaps the saved file for the edited one. */
export function PhotoEditButton({ photoId, url, userId, childId }: { photoId: string; url: string; userId: string; childId: string }) {
  const router = useRouter();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch');
      setBlob(await res.blob());
    } catch {
      setError('That photo could not be opened for editing.');
    }
    setLoading(false);
  }

  async function save(result: Blob) {
    const path = `${userId}/${childId}/${crypto.randomUUID()}.${extOf(result)}`;
    const { error: upErr } = await createClient().storage.from(PHOTO_BUCKET).upload(path, result, { contentType: result.type });
    if (upErr) throw new Error('upload');
    const res = await replacePhoto(photoId, path);
    if (!res.ok) throw new Error(res.error);
    setBlob(null);
    router.refresh();
  }

  return (
    <>
      <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-sm`} disabled={loading} onClick={open}>{loading ? 'Opening…' : 'Edit'}</button>
      {error && <span role="alert" className="text-xs text-bad">{error}</span>}
      {blob && <PhotoEditor blob={blob} onSave={save} onCancel={() => setBlob(null)} />}
    </>
  );
}
