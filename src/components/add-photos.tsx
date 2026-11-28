'use client';

import { useRef, useState } from 'react';
import { CameraCapture } from '@/components/camera-capture';
import { ItemIcon } from '@/components/item-icon';
import { StickyActions } from '@/components/sticky-actions';
import { btnCls, btnGhostCls, inputCls } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { processPhoto, reasonOf } from '@/lib/photo-client';
import { uploadPhoto } from '@/lib/photo-upload';
import { joinPhotoField } from '@/lib/photo-paths';
import { detectColor } from '@/lib/color-detect';
import { attachItemPhotos } from '@/app/(app)/closet/actions';

export interface PhotoLessItem { id: string; name: string; typeName: string; icon: string; size: string; hasColor: boolean }
interface Shot { key: number; field: string; preview: string; item: string; color: string | null }

/**
 * Photos for items that have none: snap or choose photos, then pick which item each one is (each item once). Saving puts the
 * photos on those items; photos not matched to an item are deleted.
 */
export function AddPhotos({ items, userId, childId, removeBg, back }: { items: PhotoLessItem[]; userId: string; childId: string; removeBg: boolean; back: string }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const nextKey = useRef(0);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  const add = (files: File[]) => {
    queue.current = queue.current.then(async () => {
      const supabase = createClient();
      for (let k = 0; k < files.length; k++) {
        setBusy(`${removeBg ? 'Processing' : 'Uploading'} photo ${k + 1} of ${files.length}…`);
        try {
          const done = await processPhoto(files[k], removeBg, (t) => setBusy(`Photo ${k + 1} of ${files.length}: ${t}`));
          const ref = await uploadPhoto(supabase, userId, childId, done.blob, done.cutout ? done.original : undefined);
          if (!ref) throw new Error('The photo could not be uploaded.');
          const guess = await detectColor(done.blob);
          // Starts on the first item not yet matched, in list order.
          const taken = new Set(shotsRef.current.map((s) => s.item));
          const first = items.find((i) => !taken.has(i.id))?.id ?? '';
          const shot = { key: nextKey.current++, field: joinPhotoField(ref.path, ref.originalPath), preview: URL.createObjectURL(done.blob), item: first, color: guess.color };
          shotsRef.current = [...shotsRef.current, shot];
          setShots((l) => [...l, shot]);
        } catch (e) {
          setError(`Photo ${k + 1} could not be added (${reasonOf(e).slice(0, 120)}).`);
        }
      }
      setBusy(null);
    });
  };
  const usedBy = (itemId: string, except: number) => shots.some((s) => s.item === itemId && s.key !== except);
  const matched = shots.filter((s) => s.item);

  return (
    <form action={attachItemPhotos} onSubmit={() => setSaving(true)} className="flex flex-col gap-4">
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="matches" value={JSON.stringify(matched.map((s) => ({ item: s.item, photo: s.field, color: items.find((i) => i.id === s.item)?.hasColor ? null : s.color })))} />
      <input type="hidden" name="unused" value={JSON.stringify(shots.filter((s) => !s.item).map((s) => s.field))} />

      <ul className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-3 text-sm">
        {items.map((i) => {
          const done = shots.some((s) => s.item === i.id);
          return (
            <li key={i.id} className="flex items-center gap-2">
              <ItemIcon itemKey={i.icon} size={20} className="shrink-0 text-accent" />
              <span className="flex-1">{i.typeName} <span className="text-muted">{i.size}{i.name !== i.typeName ? ` · ${i.name}` : ''}</span></span>
              <span className={`text-xs ${done ? 'text-good' : 'text-muted'}`}>{done ? '✓ Photo' : 'No photo'}</span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-3">
        <input ref={file} type="file" accept="image/*" multiple className="sr-only" aria-label="Choose photos"
          onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; if (f.length) add(f); }} />
        <button type="button" className={btnCls} disabled={busy !== null} onClick={() => setCamera(true)}>Take photos</button>
        <button type="button" className={btnGhostCls} disabled={busy !== null} onClick={() => file.current?.click()}>Choose photos</button>
      </div>
      {busy && <p role="status" className="text-sm text-muted">{busy}</p>}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}

      {shots.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shots.map((s) => (
            <li key={s.key} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.preview} alt="" className="size-24 shrink-0 rounded-lg bg-line object-contain" />
              <label className="flex flex-1 flex-col gap-1 text-sm font-medium">Which item is this?
                <select className={inputCls} value={s.item} onChange={(e) => setShots((l) => l.map((x) => (x.key === s.key ? { ...x, item: e.target.value } : x)))}>
                  <option value="">Skip this photo</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id} disabled={usedBy(i.id, s.key)}>
                      {i.typeName} {i.size}{i.name !== i.typeName ? ` · ${i.name}` : ''}{usedBy(i.id, s.key) ? ' (has a photo)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}

      {camera && <CameraCapture status={busy} planned={items.length} already={shots.length} onShot={(f) => add([f])} onClose={() => setCamera(false)} />}

      <StickyActions className="-mx-4 px-4">
        <span className="text-sm text-muted">{matched.length} of {items.length} matched</span>
        <span className="flex-1" />
        <button type="submit" className={btnCls} disabled={saving || busy !== null || matched.length === 0}>{saving ? 'Saving…' : `Save ${matched.length} photo${matched.length === 1 ? '' : 's'}`}</button>
      </StickyActions>
    </form>
  );
}
