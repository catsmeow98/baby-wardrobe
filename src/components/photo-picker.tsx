'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { processPhoto, turnWithOriginal } from '@/lib/photo-client';
import { uploadPhoto } from '@/lib/photo-upload';
import { joinPhotoField, pathsOf } from '@/lib/photo-paths';
import { MAX_PHOTOS_PER_ITEM, PHOTO_BUCKET } from '@/lib/photos';
import { btnGhostCls } from '@/components/ui';
import { PhotoEditor } from '@/components/photo-editor';

interface Picked {
  path: string;
  /** Where the original (with its background) is stored, when it was kept. */
  originalPath?: string;
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
  const [status, setStatus] = useState<string | null>(null);
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
        done = await processPhoto(f, removeBg, setStatus);
      } catch {
        setError('That image could not be read. Try a JPEG or PNG photo.');
        continue;
      }
      if (done.failed) setError(`The background could not be removed, so the original photo was used.${done.reason ? ` (${done.reason.slice(0, 160)})` : ''}`);
      const original = done.cutout ? done.original : undefined;
      const ref = await uploadPhoto(supabase, userId, childId, done.blob, original);
      if (!ref) {
        setError('The upload failed. Check your connection and try again.');
        continue;
      }
      added.push({ ...ref, preview: URL.createObjectURL(done.blob), blob: done.blob, original });
    }
    setPicked((p) => [...p, ...added]);
    setBusy(false);
    setStatus(null);
  }

  async function remove(p: Picked) {
    setPicked((list) => list.filter((x) => x.path !== p.path));
    URL.revokeObjectURL(p.preview);
    await createClient().storage.from(PHOTO_BUCKET).remove(pathsOf(p));
  }

  /** Uploads the edited photo (and its matching original), swaps it in, and deletes the files it replaces. */
  async function saveEdit(old: Picked, result: Blob, original?: Blob) {
    const supabase = createClient();
    const ref = await uploadPhoto(supabase, userId, childId, result, original);
    if (!ref) throw new Error('upload');
    URL.revokeObjectURL(old.preview);
    setPicked((list) => list.map((x) => (x.path === old.path ? { ...ref, preview: URL.createObjectURL(result), blob: result, original } : x)));
    setEditing(null);
    await supabase.storage.from(PHOTO_BUCKET).remove(pathsOf(old));
  }

  const [turning, setTurning] = useState<string | null>(null);
  /** A quarter turn clockwise without opening the editor; the kept original turns too. */
  async function turn(p: Picked) {
    setError(null);
    setTurning(p.path);
    try {
      const done = await turnWithOriginal(p.blob, p.original, p.originalPath === p.path);
      await saveEdit(p, done.result, done.original);
    } catch {
      setError('The photo could not be turned. Check your connection and try again.');
    }
    setTurning(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {picked.map((p) => <input key={p.path} type="hidden" name={name} value={joinPhotoField(p.path, p.originalPath)} />)}
      {/* Blocks submit while uploading. Not read-only, because read-only fields skip validation. */}
      <input ref={guard} className="sr-only" tabIndex={-1} aria-hidden="true" value="ok" onChange={() => undefined} required />
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {picked.map((p) => (
            <li key={p.path} className="relative flex flex-col items-start gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="size-16 rounded-lg bg-line object-contain" />
              <span className="flex gap-2">
                <button type="button" className="text-xs text-accent underline" disabled={turning !== null} onClick={() => turn(p)}>{turning === p.path ? 'Turning…' : 'Turn ↻'}</button>
                <button type="button" className="text-xs text-accent underline" disabled={turning !== null} onClick={() => setEditing(p)}>Edit</button>
              </span>
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
            {busy ? (removeBg ? (status ?? 'Processing…') : 'Uploading…') : picked.length ? 'Add more photos' : label}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      {editing && <PhotoEditor blob={editing.blob} original={editing.original} onSave={(r, o) => saveEdit(editing, r, o)} onCancel={() => setEditing(null)} />}
    </div>
  );
}
