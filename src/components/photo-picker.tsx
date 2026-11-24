'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { shrinkImage } from '@/lib/photo-client';
import { MAX_PHOTOS_PER_ITEM, PHOTO_BUCKET } from '@/lib/photos';
import { btnGhostCls } from '@/components/ui';

interface Picked {
  path: string;
  preview: string;
}

/**
 * Photo field for a form that creates an item. Each photo is shrunk and uploaded as soon as it is chosen, and its
 * storage path is carried in a hidden field. The server attaches the photos once the item has been created.
 * The form cannot be submitted while an upload is still running.
 */
export function PhotoPicker({ userId, childId, name, label = 'Add photos' }: { userId: string; childId: string; name: string; label?: string }) {
  const file = useRef<HTMLInputElement>(null);
  const guard = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    guard.current?.setCustomValidity(busy ? 'Photos are still uploading. Wait a moment, then try again.' : '');
  }, [busy]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS_PER_ITEM - picked.length);
    e.target.value = '';
    if (chosen.length === 0) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const added: Picked[] = [];
    for (const f of chosen) {
      let blob: Blob;
      try {
        blob = await shrinkImage(f);
      } catch {
        setError('That image could not be read. Try a JPEG or PNG photo.');
        continue;
      }
      const path = `${userId}/${childId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) {
        setError('The upload failed. Check your connection and try again.');
        continue;
      }
      added.push({ path, preview: URL.createObjectURL(blob) });
    }
    setPicked((p) => [...p, ...added]);
    setBusy(false);
  }

  async function remove(p: Picked) {
    setPicked((list) => list.filter((x) => x.path !== p.path));
    URL.revokeObjectURL(p.preview);
    await createClient().storage.from(PHOTO_BUCKET).remove([p.path]);
  }

  return (
    <div className="flex flex-col gap-2">
      {picked.map((p) => <input key={p.path} type="hidden" name={name} value={p.path} />)}
      {/* Blocks submit while uploading. Not read-only, because read-only fields skip validation. */}
      <input ref={guard} className="sr-only" tabIndex={-1} aria-hidden="true" value="ok" onChange={() => undefined} required />
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {picked.map((p) => (
            <li key={p.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="size-16 rounded-lg object-cover" />
              <button type="button" onClick={() => remove(p)} aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-xs text-surface">×</button>
            </li>
          ))}
        </ul>
      )}
      {picked.length < MAX_PHOTOS_PER_ITEM && (
        <div>
          <input ref={file} type="file" accept="image/*" multiple className="sr-only" onChange={onPick} aria-label="Choose photos" />
          <button type="button" className={btnGhostCls} disabled={busy} onClick={() => file.current?.click()}>
            {busy ? 'Uploading…' : picked.length ? 'Add more photos' : label}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
