'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { processPhoto, turnWithOriginal } from '@/lib/photo-client';
import { useTurnQueue } from '@/components/use-turn-queue';
import { CameraCapture } from '@/components/camera-capture';
import { uploadPhoto } from '@/lib/photo-upload';
import { joinPhotoField, pathsOf } from '@/lib/photo-paths';
import { MAX_PHOTOS_PER_ITEM, PHOTO_BUCKET } from '@/lib/photos';
import { btnGhostCls } from '@/components/ui';
import { PhotoEditor } from '@/components/photo-editor';

interface Picked {
  path: string;
  /** Where the original (with its background) is stored, when it was kept. */
  originalPath?: string;
  /** Stays the same when the photo is edited or turned (its paths change), so a turn waiting to be saved is kept. */
  uid: number;
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
  const nextUid = useRef(0);
  // Photos with a turn not saved yet: the form waits for them, since saving replaces the photo's file.
  const [turningUids, setTurningUids] = useState<number[]>([]);
  const setTurning = (uid: number, on: boolean) => setTurningUids((l) => (on ? (l.includes(uid) ? l : [...l, uid]) : l.filter((x) => x !== uid)));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Picked | null>(null);

  useEffect(() => {
    guard.current?.setCustomValidity(busy || turningUids.length ? 'Photos are still uploading. Wait a moment, then try again.' : '');
  }, [busy, turningUids.length]);

  // Photos are processed in order, so camera shots taken quickly queue up instead of overlapping.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [camera, setCamera] = useState(false);
  const count = useRef(0);
  count.current = picked.length;
  const addFiles = (files: File[]) => {
    queue.current = queue.current.then(() => processFiles(files)).catch((err) => console.error('Photo batch failed', err));
  };
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) addFiles(files);
  }

  async function processFiles(files: File[]) {
    const chosen = files.slice(0, Math.max(0, max - count.current));
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
      added.push({ ...ref, uid: nextUid.current++, preview: URL.createObjectURL(done.blob), blob: done.blob, original });
    }
    count.current += added.length;
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
    setPicked((list) => list.map((x) => (x.path === old.path ? { ...ref, uid: x.uid, preview: URL.createObjectURL(result), blob: result, original } : x)));
    setEditing(null);
    await supabase.storage.from(PHOTO_BUCKET).remove(pathsOf(old));
  }

  return (
    <div className="flex flex-col gap-2">
      {picked.map((p) => <input key={p.path} type="hidden" name={name} value={joinPhotoField(p.path, p.originalPath)} />)}
      {/* Blocks submit while uploading. Not read-only, because read-only fields skip validation. */}
      <input ref={guard} className="sr-only" tabIndex={-1} aria-hidden="true" value="ok" onChange={() => undefined} required />
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {picked.map((p) => (
            <Thumb key={p.uid} p={p} onEdit={() => setEditing(p)} onRemove={() => remove(p)} onError={setError} onBusy={(on) => setTurning(p.uid, on)}
              onTurn={async (q) => {
                const done = await turnWithOriginal(p.blob, p.original, p.originalPath === p.path, q);
                await saveEdit(p, done.result, done.original);
              }} />
          ))}
        </ul>
      )}
      {picked.length < max && (
        <div>
          <input ref={file} type="file" accept="image/*" multiple={max > 1} className="sr-only" onChange={onPick} aria-label="Choose photos" />
          <span className="flex flex-wrap gap-2">
            <button type="button" className={btnGhostCls} disabled={busy} onClick={() => file.current?.click()}>
              {busy ? (removeBg ? (status ?? 'Processing…') : 'Uploading…') : picked.length ? 'Add more photos' : label}
            </button>
            <button type="button" className={btnGhostCls} onClick={() => setCamera(true)}>{max > 1 ? 'Take photos' : 'Take photo'}</button>
          </span>
          {camera && <CameraCapture multiple={max - picked.length > 1} status={busy ? (status ?? 'Processing…') : null} onShot={(f) => addFiles([f])} onClose={() => setCamera(false)} />}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      {editing && <PhotoEditor blob={editing.blob} original={editing.original} onSave={(r, o) => saveEdit(editing, r, o)} onCancel={() => setEditing(null)} />}
    </div>
  );
}

/** One picked photo: turns show at once and quick taps are saved together (see useTurnQueue). */
function Thumb({ p, onTurn, onEdit, onRemove, onError, onBusy }: {
  p: Picked;
  onBusy: (on: boolean) => void;
  onTurn: (quarterTurns: number) => Promise<void>;
  onEdit: () => void;
  onRemove: () => void;
  onError: (message: string | null) => void;
}) {
  const turns = useTurnQueue(onTurn);
  useEffect(() => {
    if (turns.error) onError(turns.error);
  }, [turns.error]); // eslint-disable-line react-hooks/exhaustive-deps
  const still = turns.saving || turns.shown !== 0;
  useEffect(() => onBusy(still), [still]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <li className="relative flex flex-col items-start gap-1">
      <div className="size-16 overflow-hidden rounded-lg bg-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.preview} alt="" style={turns.style} className="size-full object-contain" />
      </div>
      <span className="flex gap-2">
        <button type="button" className="text-xs text-accent underline" onClick={() => turns.turn(-1)} aria-label="Turn left">↺</button>
        <button type="button" className="text-xs text-accent underline" onClick={() => turns.turn(1)} aria-label="Turn right">↻</button>
        <button type="button" className="text-xs text-accent underline" disabled={still} onClick={onEdit}>Edit</button>
      </span>
      {turns.saving && <span className="text-[11px] text-muted" role="status">Saving…</span>}
      <button type="button" onClick={onRemove} aria-label="Remove photo" disabled={still}
        className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-xs text-surface">×</button>
    </li>
  );
}
