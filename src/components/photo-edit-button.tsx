'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTurnQueue } from '@/components/use-turn-queue';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { downloadOriginal, uploadPhoto } from '@/lib/photo-upload';
import { btnGhostCls } from '@/components/ui';
import { PhotoEditor } from '@/components/photo-editor';
import { CUTOUT_SIDE, reasonOf, shrinkImage, turnWithOriginal } from '@/lib/photo-client';
import { replacePhoto } from '@/app/(app)/closet/photo-actions';

/**
 * Turn left, turn right and "Edit" for a photo already on an item. A turn is a quarter turn, saved straight away; Edit opens the editor.
 * Either way the saved file (and its original, turned to match) is swapped for the new one.
 */
export function PhotoEditButton({ photoId, url, path, originalPath, userId, childId, onSaved, onTurnStyle }: {
  photoId: string;
  url: string;
  /** The photo's storage path, to tell when it is its own original. */
  path?: string;
  /** Where the stored original is, when the photo has one. */
  originalPath?: string;
  userId: string;
  childId: string;
  /** Told the new picture as soon as it is saved, so the page can show it before it reloads. */
  onSaved?: (picture: Blob) => void;
  /** Told the rotation to show on the picture while turns are waiting to be saved. */
  onTurnStyle?: (style: CSSProperties | undefined) => void;
}) {
  const router = useRouter();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [original, setOriginal] = useState<Blob | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cutting, setCutting] = useState<string | null>(null);
  // A photo saved with its background (a JPEG; cutouts are PNGs) can have it removed now.
  // The picture as last saved from here. The page catches up a moment later; until then the old address may be gone, and
  // keeping it also saves downloading it again for the next change.
  const latest = useRef<{ picture: Blob; found?: Blob; path: string; sameFile: boolean } | null>(null);
  const curPath = latest.current?.path ?? path;
  const hasBackground = Boolean(curPath && !curPath.toLowerCase().endsWith('.png'));
  const sameFile = latest.current ? latest.current.sameFile : Boolean(originalPath && path && originalPath === path);

  /** The picture and its stored original. If the original cannot be fetched, stop: changing the photo without it would lose it. */
  async function fetchBoth(): Promise<{ picture: Blob; found?: Blob }> {
    if (latest.current) return { picture: latest.current.picture, found: latest.current.found };
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch');
    const picture = await res.blob();
    if (!originalPath || sameFile) return { picture, found: sameFile ? picture : undefined };
    const got = await downloadOriginal(createClient(), originalPath);
    if (!got) throw new Error('original');
    return { picture, found: got };
  }

  async function open() {
    setLoading(true);
    setError(null);
    try {
      const { picture, found } = await fetchBoth();
      setOriginal(found);
      setBlob(picture);
    } catch {
      setError('That photo could not be opened for editing.');
    }
    setLoading(false);
  }

  /** Removes the background from a photo that kept it: the cutout replaces it, and the photo as it was becomes its original. */
  async function removeBackground() {
    setCutting('Loading photo…');
    setError(null);
    try {
      const { picture } = await fetchBoth();
      setCutting('Removing background…');
      const small = await shrinkImage(picture, CUTOUT_SIDE);
      const { removeBackgroundFrom } = await import('@/lib/bg-remove');
      const cutout = await removeBackgroundFrom(small, setCutting);
      setCutting('Saving…');
      // Only the cutout is uploaded: the photo's current file is already stored and becomes its original as it is.
      const ref = await uploadPhoto(createClient(), userId, childId, cutout);
      if (!ref || !curPath) throw new Error('the upload failed');
      const done = await replacePhoto(photoId, ref.path, curPath);
      if (!done.ok) throw new Error(done.error);
      latest.current = { picture: cutout, found: picture, path: ref.path, sameFile: false };
      onSaved?.(cutout);
      router.refresh();
    } catch (e) {
      setError(`The background could not be removed (${reasonOf(e).slice(0, 120)}). The photo is unchanged.`);
    }
    setCutting(null);
  }

  // Turns show on the picture at once; quick taps are saved together once they stop.
  const turns = useTurnQueue(async (q) => {
    const { picture, found } = await fetchBoth();
    const done = await turnWithOriginal(picture, found, sameFile, q);
    await save(done.result, done.original);
  });
  useEffect(() => onTurnStyle?.(turns.style), [turns.style?.transform]); // eslint-disable-line react-hooks/exhaustive-deps
  const turning = turns.saving;

  async function save(result: Blob, aligned?: Blob) {
    const ref = await uploadPhoto(createClient(), userId, childId, result, aligned);
    if (!ref) throw new Error('upload');
    const res = await replacePhoto(photoId, ref.path, ref.originalPath);
    if (!res.ok) throw new Error(res.error);
    latest.current = { picture: result, found: aligned, path: ref.path, sameFile: Boolean(aligned && aligned === result) };
    setBlob(null);
    onSaved?.(result);
    router.refresh();
  }

  return (
    <>
      <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-sm`} disabled={loading || cutting !== null} onClick={() => turns.turn(-1)} aria-label="Turn photo left">↺</button>
      <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-sm`} disabled={loading || cutting !== null} onClick={() => turns.turn(1)} aria-label="Turn photo right">↻</button>
      <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-sm`} disabled={loading || turning || turns.shown !== 0 || cutting !== null} onClick={open}>{loading ? 'Opening…' : 'Edit'}</button>
      {hasBackground && (
        <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-sm`} disabled={loading || turning || turns.shown !== 0 || cutting !== null} onClick={removeBackground}>
          {cutting ?? 'Remove background'}
        </button>
      )}
      {turning && <span className="text-xs text-muted" role="status">Saving…</span>}
      {(error ?? turns.error) && <span role="alert" className="text-xs text-bad">{error ?? turns.error}</span>}
      {blob && <PhotoEditor blob={blob} original={original} onSave={save} onCancel={() => setBlob(null)} />}
    </>
  );
}
