'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { processPhoto } from '@/lib/photo-client';
import { CameraCapture } from '@/components/camera-capture';
import { uploadPhoto } from '@/lib/photo-upload';
import { btnGhostCls } from '@/components/ui';
import { addPhoto } from '@/app/(app)/closet/photo-actions';

export function PhotoUploader({ itemId, userId, childId, remaining, removeBg = false }: { itemId: string; userId: string; childId: string; remaining: number; removeBg?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Photos are processed in order, so camera shots taken quickly queue up instead of overlapping.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [camera, setCamera] = useState(false);
  const added = useRef(0);
  // The page's own count catches up after each refresh, so count afresh from there.
  useEffect(() => { added.current = 0; }, [remaining]);
  const addFiles = (files: File[]) => {
    queue.current = queue.current.then(() => processFiles(files)).catch((err) => console.error('Photo batch failed', err));
  };
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) addFiles(files);
  }

  async function processFiles(picked: File[]) {
    const files = picked.slice(0, Math.max(0, remaining - added.current));
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    for (const file of files) {
      let blob: Blob;
      let original: Blob | undefined;
      try {
        const done = await processPhoto(file, removeBg, setStatus);
        blob = done.blob;
        if (done.cutout) original = done.original;
        if (done.failed) setError(`The background could not be removed, so the original photo was used.${done.reason ? ` (${done.reason.slice(0, 160)})` : ''}`);
      } catch {
        setError('That image could not be read. Try a JPEG or PNG photo.');
        continue;
      }
      const ref = await uploadPhoto(supabase, userId, childId, blob, original);
      if (!ref) {
        setError('The upload failed. Check your connection and try again.');
        continue;
      }
      const res = await addPhoto(itemId, ref.path, ref.originalPath);
      if (!res.ok) setError(res.error);
      else added.current += 1;
    }
    setBusy(false);
    setStatus(null);
    router.refresh();
  }

  if (remaining <= 0) return <p className="text-sm text-muted">Photo limit reached. Delete one to add another.</p>;
  return (
    <div className="flex flex-col gap-2">
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" onChange={onPick} aria-label="Choose photos" />
      <div>
        <span className="flex flex-wrap gap-2">
          <button type="button" className={btnGhostCls} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? (removeBg ? (status ?? 'Processing…') : 'Uploading…') : 'Add photos'}
          </button>
          <button type="button" className={btnGhostCls} onClick={() => setCamera(true)}>Take photos</button>
        </span>
        {camera && <CameraCapture multiple={remaining - added.current > 1} status={busy ? (status ?? 'Processing…') : null} onShot={(f) => addFiles([f])} onClose={() => setCamera(false)} />}
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
