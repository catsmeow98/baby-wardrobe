'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { downloadOriginal, uploadPhoto } from '@/lib/photo-upload';
import { btnGhostCls } from '@/components/ui';
import { PhotoEditor } from '@/components/photo-editor';
import { replacePhoto } from '@/app/(app)/closet/photo-actions';

/** "Edit" for a photo already on an item: opens the editor on it and swaps the saved file for the edited one. */
export function PhotoEditButton({ photoId, url, originalPath, userId, childId }: { photoId: string; url: string; /** Where the stored original is, when the photo has one. */ originalPath?: string; userId: string; childId: string }) {
  const router = useRouter();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [original, setOriginal] = useState<Blob | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch');
      const picture = await res.blob();
      // Fetch the stored original too, so Restore works. If it cannot be fetched, stop: editing without it would lose it.
      let found: Blob | undefined;
      if (originalPath) {
        const got = await downloadOriginal(createClient(), originalPath);
        if (!got) throw new Error('original');
        found = got;
      }
      setOriginal(found);
      setBlob(picture);
    } catch {
      setError('That photo could not be opened for editing.');
    }
    setLoading(false);
  }

  async function save(result: Blob, aligned?: Blob) {
    const ref = await uploadPhoto(createClient(), userId, childId, result, aligned);
    if (!ref) throw new Error('upload');
    const res = await replacePhoto(photoId, ref.path, ref.originalPath);
    if (!res.ok) throw new Error(res.error);
    setBlob(null);
    router.refresh();
  }

  return (
    <>
      <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-sm`} disabled={loading} onClick={open}>{loading ? 'Opening…' : 'Edit'}</button>
      {error && <span role="alert" className="text-xs text-bad">{error}</span>}
      {blob && <PhotoEditor blob={blob} original={original} onSave={save} onCancel={() => setBlob(null)} />}
    </>
  );
}
