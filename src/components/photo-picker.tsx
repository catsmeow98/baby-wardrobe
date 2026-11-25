'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { extOf, processPhoto } from '@/lib/photo-client';
import { MAX_PHOTOS_PER_ITEM, PHOTO_BUCKET } from '@/lib/photos';
import { btnGhostCls } from '@/components/ui';
import { PhotoEditor } from '@/components/photo-editor';

interface Picked {
  path: string;
  preview: string;
  blob: Blob;
  /** The photo with its background, when blob is a cutout. */
  original?: Blob;
}

/**
 * Photo field for a form that creates an item. Each photo is shrunk (and, when removeBg is on, loses its background) and is
 * uploaded as soon as it is chosen. Its storage path is carried in a hidden field, and the server attaches the photos once
 * the item has been created. Each thumbnail has an Edit button for rotating and cropping. The form cannot be submitted
 * while an upload is still running.
 */
export function PhotoPicker({ userId, childId, name, label = 'Add photos', max = MAX_PHOTOS_PER_ITEM, removeBg = false }: { userId: string; childId: string; name: string; label?: string; max?: number; removeBg?: boolean }) {
  const file = useRef<HTMLInputElement>(null);
  const guard = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Picked | null>(null);

  useEffect(() => {
    guard.current?.setCustomValidity(busy ? 'Photos are still uploading. Wait a moment, then try again.' : '');
  }, [busy]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []).slice(0, max - picked.length);
    e.target.value = '';
    if (chosen.length === 0) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const added: Picked[] = [];
    for (const f of chosen) {
      let done;
      try {
        done = await processPhoto(f, removeBg);
      } catch {
        setError('That image could not be read. Try a JPEG or PNG photo.');
        continue;
      }
      if (done.failed) setError(`The background could not be removed, so the original photo was used.${done.reason ? ` (${done.reason.slice(0, 160)})` : ''}`);
      const path = `${userId}/${childId}/${crypto.randomUUID()}.${extOf(done.blob)}`;
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, done.blob, { contentType: done.blob.type });
      if (upErr) {
        setError('The upload failed. Check your connection and try again.');
        continue;
      }
      added.push({ path, preview: URL.createObjectURL(done.blob), blob: done.blob, original: done.cutout ? done.original : undefined });
    }
    setPicked((p) => [...p, ...added]);
    setBusy(false);
  }

  async function remove(p: Picked) {
    setPicked((list) => list.filter((x) => x.path !== p.path));
    URL.revokeObjectURL(p.preview);
    await createClient().storage.from(PHOTO_BUCKET).remove([p.path]);
  }

  /** Uploads the edited photo, swaps it in, and deletes the file it replaces. */
  async function saveEdit(old: Picked, result: Blob) {
    const path = `${userId}/${childId}/${crypto.randomUUID()}.${extOf(result)}`;
    const supabase = createClient();
    const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, result, { contentType: result.type });
    if (upErr) throw new Error('upload');
    URL.revokeObjectURL(old.preview);
    setPicked((list) => list.map((x) => (x.path === old.path ? { path, preview: URL.createObjectURL(result), blob: result, original: old.original } : x)));
    setEditing(null);
    await supabase.storage.from(PHOTO_BUCKET).remove([old.path]);
  }

  return (
    <div className="flex flex-col gap-2">
      {picked.map((p) => <input key={p.path} type="hidden" name={name} value={p.path} />)}
      {/* Blocks submit while uploading. Not read-only, because read-only fields skip validation. */}
      <input ref={guard} className="sr-only" tabIndex={-1} aria-hidden="true" value="ok" onChange={() => undefined} required />
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {picked.map((p) => (
            <li key={p.path} className="relative flex flex-col items-start gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="size-16 rounded-lg bg-line object-contain" />
              <button type="button" className="text-xs text-accent underline" onClick={() => setEditing(p)}>Edit</button>
              <button type="button" onClick={() => remove(p)} aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-xs text-surface">×</button>
            </li>
          ))}
        </ul>
      )}
      {picked.length < max && (
        <div>
          <input ref={file} type="file" accept="image/*" multiple={max > 1} className="sr-only" onChange={onPick} aria-label="Choose photos" />
          <button type="button" className={btnGhostCls} disabled={busy} onClick={() => file.current?.click()}>
            {busy ? (removeBg ? 'Processing…' : 'Uploading…') : picked.length ? 'Add more photos' : label}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      {editing && <PhotoEditor blob={editing.blob} original={editing.original} onSave={(r) => saveEdit(editing, r)} onCancel={() => setEditing(null)} />}
    </div>
  );
}
