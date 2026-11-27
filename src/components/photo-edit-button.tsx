'use client';

import { useState } from 'react';
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
export function PhotoEditButton({ photoId, url, path, originalPath, userId, childId, onSaved }: {
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
}) {
  const router = useRouter();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [original, setOriginal] = useState<Blob | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turning, setTurning] = useState(false);
  const [cutting, setCutting] = useState<string | null>(null);
  // A photo saved with its background (a JPEG; cutouts are PNGs) can have it removed now.
  const hasBackground = Boolean(path && !path.toLowerCase().endsWith('.png'));
  const sameFile = Boolean(originalPath && path && originalPath === path);

  /** The picture and its stored original. If the original cannot be fetched, stop: changing the photo without it would lose it. */
  async function fetchBoth(): Promise<{ picture: Blob; found?: Blob }> {
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
      const res = await fetch(url);
      if (!res.ok) throw new Error('the photo could not be loaded');
      const picture = await res.blob();
      setCutting('Removing background…');
      const small = await shrinkImage(picture, CUTOUT_SIDE);
      const { removeBackgroundFrom } = await import('@/lib/bg-remove');
      const cutout = await removeBackgroundFrom(small, setCutting);
      setCutting('Saving…');
      // Only the cutout is uploaded: the photo's current file is already stored and becomes its original as it is.
      const ref = await uploadPhoto(createClient(), userId, childId, cutout);
      if (!ref || !path) throw new Error('the upload failed');
      const done = await replacePhoto(photoId, ref.path, path);
      if (!done.ok) throw new Error(done.error);
      onSaved?.(cutout);
      router.refresh();
    } catch (e) {
      setError(`The background could not be removed (${reasonOf(e).slice(0, 120)}). The photo is unchanged.`);
    }
    setCutting(null);
  }

  async function turn(dir: 1 | -1) {
    setTurning(true);
    setError(null);
    try {
      const { picture, found } = await fetchBoth();
      const done = await turnWithOriginal(picture, found, sameFile, dir);
      await save(done.result, done.original);
    } catch {
      setError('That photo could not be turned. Check your connection and try again.');
    }
    setTurning(false);
  }

  async function save(result: Blob, aligned?: Blob) {
    const ref = await uploadPhoto(createClient(), userId, childId, result, aligned);
    if (!ref) throw new Error('upload');
    const res = await replacePhoto(photoId, ref.path, ref.originalPath);
    if (!res.ok) throw new Error(res.error);
    setBlob(null);
    onSaved?.(result);
    router.refresh();
  }

  return (
    <>
      <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-sm`} disabled={loading || turning || cutting !== null} onClick={() => turn(-1)} aria-label="Turn photo left">{turning ? '…' : '↺'}</button>
      <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-sm`} disabled={loading || turning || cutting !== null} onClick={() => turn(1)} aria-label="Turn photo right">{turning ? '…' : '↻'}</button>
      <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-sm`} disabled={loading || turning || cutting !== null} onClick={open}>{loading ? 'Opening…' : 'Edit'}</button>
      {hasBackground && (
        <button type="button" className={`${btnGhostCls} !px-2 !py-1 text-sm`} disabled={loading || turning || cutting !== null} onClick={removeBackground}>
          {cutting ?? 'Remove background'}
        </button>
      )}
      {error && <span role="alert" className="text-xs text-bad">{error}</span>}
      {blob && <PhotoEditor blob={blob} original={original} onSave={save} onCancel={() => setBlob(null)} />}
    </>
  );
}
