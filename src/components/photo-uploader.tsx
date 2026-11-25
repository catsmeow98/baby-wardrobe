'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PHOTO_BUCKET } from '@/lib/photos';
import { extOf, processPhoto } from '@/lib/photo-client';
import { btnGhostCls } from '@/components/ui';
import { addPhoto } from '@/app/(app)/closet/photo-actions';

export function PhotoUploader({ itemId, userId, childId, remaining, removeBg = false }: { itemId: string; userId: string; childId: string; remaining: number; removeBg?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    for (const file of files) {
      let blob: Blob;
      try {
        const done = await processPhoto(file, removeBg);
        blob = done.blob;
        if (done.failed) setError(`The background could not be removed, so the original photo was used.${done.reason ? ` (${done.reason.slice(0, 160)})` : ''}`);
      } catch {
        setError('That image could not be read. Try a JPEG or PNG photo.');
        continue;
      }
      const path = `${userId}/${childId}/${crypto.randomUUID()}.${extOf(blob)}`;
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type });
      if (upErr) {
        setError('The upload failed. Check your connection and try again.');
        continue;
      }
      const res = await addPhoto(itemId, path);
      if (!res.ok) setError(res.error);
    }
    setBusy(false);
    router.refresh();
  }

  if (remaining <= 0) return <p className="text-sm text-muted">Photo limit reached. Delete one to add another.</p>;
  return (
    <div className="flex flex-col gap-2">
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" onChange={onPick} aria-label="Choose photos" />
      <div>
        <button type="button" className={btnGhostCls} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? (removeBg ? 'Processing…' : 'Uploading…') : 'Add photos'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
