'use client';

import { useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { alignOriginal, cropBlob, rotateBlob } from '@/lib/photo-client';
import { PhotoTouchUp } from '@/components/photo-touchup';
import { btnCls, btnGhostCls } from '@/components/ui';

/**
 * Full-screen editor for one photo: rotate, crop, and (when there is one) switch between the cutout and the original.
 * onSave gets the finished image. "Whole photo" keeps everything, so saving without touching the crop changes nothing.
 */
export function PhotoEditor({ blob, original, onSave, onCancel }: {
  blob: Blob;
  /** The photo with its background, when blob is a cutout. */
  original?: Blob;
  /** The finished picture, and its original turned and cropped to match (when there is one), to be stored with it. */
  onSave: (result: Blob, original?: Blob) => Promise<void>;
  onCancel: () => void;
}) {
  const [cur, setCur] = useState<Blob>(blob);
  const [src, setSrc] = useState('');
  const [natural, setNatural] = useState(1);
  const [aspect, setAspect] = useState<'whole' | number>('whole');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [touching, setTouching] = useState(false);
  /** Quarter turns applied to the current picture, so the original can be turned to match before restoring. */
  const [turns, setTurns] = useState(0);
  const [matched, setMatched] = useState<Blob | undefined>(original);
  /** True while the picture on screen is the original with its background (even after turning it). */
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(cur);
    setSrc(url);
    createImageBitmap(cur).then((b) => {
      setNatural(b.width / b.height);
      b.close();
    }).catch(() => undefined);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    return () => URL.revokeObjectURL(url);
  }, [cur]);

  const turn = async (n: number) => {
    setBusy(true);
    try {
      setCur(await rotateBlob(cur, n));
      setTurns((t) => t + n);
    } catch {
      setError('That photo could not be rotated.');
    }
    setBusy(false);
  };

  const openTouchUp = async () => {
    setBusy(true);
    setError(null);
    try {
      setMatched(original ? await rotateBlob(original, turns) : undefined);
      setTouching(true);
    } catch {
      setError('Touch-up could not start for that photo.');
    }
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = area ? await cropBlob(cur, area) : cur;
      let aligned: Blob | undefined;
      if (original) {
        if (showingOriginal) aligned = result; // the saved picture is the original itself
        else {
          const size = await createImageBitmap(cur);
          aligned = await alignOriginal(original, turns, area, { width: size.width, height: size.height });
          size.close();
        }
      }
      await onSave(result, aligned);
    } catch {
      setError('We could not save that photo. Try again.');
      setBusy(false);
    }
  };

  const options: [string, 'whole' | number][] = [['Whole photo', 'whole'], ['Square', 1], ['4:3', 4 / 3], ['3:4', 3 / 4]];

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit photo" className="fixed inset-0 z-50 flex flex-col bg-black/80 p-3">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl">
        {src && (
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect === 'whole' ? natural : aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            style={{ containerStyle: { background: '#d4d4d8' } }}
          />
        )}
      </div>
      <div className="mt-3 flex flex-col gap-3 rounded-xl bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnGhostCls} disabled={busy} onClick={() => turn(3)}>Rotate left</button>
          <button type="button" className={btnGhostCls} disabled={busy} onClick={() => turn(1)}>Rotate right</button>
          {original && (
            <button type="button" className={btnGhostCls} disabled={busy} onClick={() => { setTurns(0); setCur(showingOriginal ? blob : original); setShowingOriginal(!showingOriginal); }}>
              {showingOriginal ? 'Use cutout' : 'Use original (with background)'}
            </button>
          )}
          {!showingOriginal && (
            <button type="button" className={btnGhostCls} disabled={busy} onClick={openTouchUp}>Touch up</button>
          )}
          <label className="ml-auto flex items-center gap-2 text-sm">
            Zoom
            <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Crop shape">
          <span className="text-sm text-muted">Crop</span>
          {options.map(([label, value]) => (
            <button key={label} type="button" aria-pressed={aspect === value} onClick={() => setAspect(value)}
              className={`rounded-full border px-3 py-1 text-sm ${aspect === value ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>{label}</button>
          ))}
        </div>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className={btnCls} disabled={busy} onClick={save}>{busy ? 'Working…' : 'Save photo'}</button>
          <button type="button" className={btnGhostCls} disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
      </div>
      {touching && (
        <PhotoTouchUp blob={cur} original={matched} onCancel={() => setTouching(false)} onDone={(b) => { setCur(b); setTouching(false); }} />
      )}
    </div>
  );
}
