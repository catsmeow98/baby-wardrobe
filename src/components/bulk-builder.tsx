'use client';

import { useEffect, useRef, useState } from 'react';
import { BrandSelect } from '@/components/brand-select';
import { CategoryPicker } from '@/components/category-picker';
import { PhotoPicker } from '@/components/photo-picker';
import { TagSizeField, type TagValue } from '@/components/tag-size-field';
import { createClient } from '@/lib/supabase/client';
import { extOf, processPhoto } from '@/lib/photo-client';
import { PHOTO_BUCKET } from '@/lib/photos';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { COLORS, sizeName } from '@/lib/db';
import type { CategoryRow, SizeLabelRow, SizeRow } from '@/lib/db';

const MAX_ROWS = 50;
const START_ROWS = 5;

interface Row {
  id: number;
  photo: { path: string; preview: string } | null;
}

/**
 * Rows for the bulk add form. Choose a batch of photos and a row is made for each one, with its photo already attached.
 * Or add blank rows and type them in, each with an optional photo of its own. Photos upload as soon as they are chosen.
 * Field names carry the row's position (cat_0, name_1 and so on), which is what the server action reads.
 */
export function BulkBuilder({ userId, childId, categories, labels, sizes, brands, defaultTagId, removeBg = false }: {
  userId: string;
  childId: string;
  categories: CategoryRow[];
  labels: SizeLabelRow[];
  sizes: SizeRow[];
  brands: string[];
  defaultTagId: string;
  removeBg?: boolean;
}) {
  const nextId = useRef(START_ROWS);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: START_ROWS }, (_, id) => ({ id, photo: null })));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rowCount = useRef(START_ROWS);
  rowCount.current = rows.length;
  const file = useRef<HTMLInputElement>(null);
  const guard = useRef<HTMLInputElement>(null);

  useEffect(() => {
    guard.current?.setCustomValidity(busy ? 'Photos are still uploading. Wait a moment, then try again.' : '');
  }, [busy]);

  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);
    const supabase = createClient();
    let skipped = 0;
    let added = 0;
    const startRows = rowCount.current;
    for (let k = 0; k < files.length; k++) {
      if (startRows + added >= MAX_ROWS) {
        setError(`A bulk add holds up to ${MAX_ROWS} rows, so the rest of the photos were skipped.`);
        skipped = 0;
        break;
      }
      setBusy(`${removeBg ? 'Processing' : 'Uploading'} photo ${k + 1} of ${files.length}…`);
      let blob: Blob;
      try {
        blob = (await processPhoto(files[k], removeBg)).blob;
      } catch {
        skipped++;
        continue;
      }
      const path = `${userId}/${childId}/${crypto.randomUUID()}.${extOf(blob)}`;
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type });
      if (upErr) {
        skipped++;
        continue;
      }
      const photo = { path, preview: URL.createObjectURL(blob) };
      added++;
      setRows((list) => {
        // New photo rows go after the last row that already has a photo, ahead of the blank rows.
        const at = list.reduce((last, r, i) => (r.photo ? i : last), -1) + 1;
        return [...list.slice(0, at), { id: nextId.current++, photo }, ...list.slice(at)];
      });
    }
    if (skipped) setError(`${skipped} photo${skipped > 1 ? 's' : ''} could not be added. Check your connection or try a JPEG or PNG.`);
    setBusy(null);
  }

  async function removeRow(row: Row) {
    setRows((list) => list.filter((r) => r.id !== row.id));
    if (row.photo) {
      URL.revokeObjectURL(row.photo.preview);
      await createClient().storage.from(PHOTO_BUCKET).remove([row.photo.path]);
    }
  }

  const addBlank = () => setRows((list) => (list.length >= MAX_ROWS ? list : [...list, { id: nextId.current++, photo: null }]));

  return (
    <>
      <input type="hidden" name="rows" value={rows.length} />
      {/* Blocks submit while photos upload. Not read-only, because read-only fields skip validation. */}
      <input ref={guard} className="sr-only" tabIndex={-1} aria-hidden="true" value="ok" onChange={() => undefined} required />

      <section className="flex flex-col gap-2 rounded-xl border border-accent bg-accent-soft p-4">
        <h2 className="font-display text-lg font-bold">Start with photos</h2>
        <p className="text-sm text-muted">Choose photos of your items, one photo per item. A row is made for each photo, and you fill in the details below.</p>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={file} type="file" accept="image/*" multiple className="sr-only" onChange={onPhotos} aria-label="Choose photos, one per item" />
          <button type="button" className={btnCls} disabled={busy !== null || rows.length >= MAX_ROWS} onClick={() => file.current?.click()}>
            {busy ?? 'Choose photos'}
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      </section>

      {rows.map((row, pos) => (
        <BulkRow key={row.id} row={row} pos={pos} onRemove={() => removeRow(row)} userId={userId} childId={childId}
          categories={categories} labels={labels} sizes={sizes} defaultTagId={defaultTagId} brands={brands} removeBg={removeBg} />
      ))}

      <div className="flex flex-wrap items-center gap-4">
        <button className={btnCls} type="submit">Add to closet</button>
        {rows.length < MAX_ROWS && <button type="button" className={btnGhostCls} onClick={addBlank}>Add a blank row</button>}
        <span className="text-sm text-muted">{rows.length} row{rows.length === 1 ? '' : 's'}</span>
      </div>
    </>
  );
}

function BulkRow({ row, pos, onRemove, userId, childId, categories, labels, sizes, defaultTagId, brands, removeBg }: {
  row: Row;
  pos: number;
  onRemove: () => void;
  userId: string;
  childId: string;
  categories: CategoryRow[];
  labels: SizeLabelRow[];
  sizes: SizeRow[];
  defaultTagId: string;
  brands: string[];
  removeBg: boolean;
}) {
  const [tag, setTag] = useState<TagValue>({ tagId: defaultTagId, custom: false, text: '' });
  return (
    <fieldset className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-6">
      <legend className="px-1 text-xs text-muted">Row {pos + 1}</legend>
      {row.photo && (
        <div className="relative sm:col-span-6">
          <input type="hidden" name={`photo_${pos}`} value={row.photo.path} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.photo.preview} alt={`Photo for row ${pos + 1}`} className="size-24 rounded-lg object-cover" />
        </div>
      )}
      <CategoryPicker categories={categories} name={`cat_${pos}`} className={`${labelCls} sm:col-span-2`} allowNew />
      <label className={`${labelCls} sm:col-span-2`}>Name (optional)
        <input className={inputCls} name={`name_${pos}`} maxLength={160} />
      </label>
      <label className={`${labelCls} sm:col-span-2`}>Brand
        <BrandSelect brands={brands} name={`brand_${pos}`} />
      </label>
      <label className={`${labelCls} sm:col-span-2`}>Color
        <select className={inputCls} name={`color_${pos}`} defaultValue="">
          <option value="">Not set</option>
          {COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <TagSizeField labels={labels} value={tag} onChange={setTag} tagName={`tag_${pos}`} customName={`ctag_${pos}`} className={`${labelCls} sm:col-span-2`} />
      <label className={`${labelCls} sm:col-span-2`}>Fits through
        <select className={inputCls} name={`thru_${pos}`} defaultValue="">
          <option value="">{tag.custom ? 'Same as the tag range' : 'Same as tag size'}</option>
          {sizes.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}
        </select>
      </label>
      <label className={labelCls}>Quantity
        <input className={inputCls} type="number" name={`qty_${pos}`} min={1} max={999} defaultValue={1} />
      </label>
      {!row.photo && (
        <div className={`${labelCls} sm:col-span-6`}>
          Photo (optional)
          <PhotoPicker userId={userId} childId={childId} name={`photo_${pos}`} max={1} label="Add a photo" removeBg={removeBg} />
        </div>
      )}
      <div className="sm:col-span-6">
        <button type="button" className="text-sm text-bad underline" onClick={onRemove}>Remove this row</button>
      </div>
    </fieldset>
  );
}
