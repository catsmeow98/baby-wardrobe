'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTurnQueue } from '@/components/use-turn-queue';
import { BrandSelect } from '@/components/brand-select';
import { CategoryPicker } from '@/components/category-picker';
import { ItemIcon, TypeIcon } from '@/components/item-icon';
import { LocalTime } from '@/components/local-time';
import { guessLine, piecesLeft } from '@/lib/trips';
import { groupCategories } from '@/lib/categories';
import { PhotoPicker } from '@/components/photo-picker';
import { PhotoEditor } from '@/components/photo-editor';
import { TagSizeField, type TagValue } from '@/components/tag-size-field';
import { createClient } from '@/lib/supabase/client';
import { processPhoto, reasonOf, turnWithOriginal } from '@/lib/photo-client';
import { downloadOriginal, uploadPhoto } from '@/lib/photo-upload';
import { joinPhotoField, pathsOf } from '@/lib/photo-paths';
import { PHOTO_BUCKET } from '@/lib/photos';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { COLORS, sizeName } from '@/lib/db';
import type { CategoryRow, SizeLabelRow, SizeRow } from '@/lib/db';

const MAX_ROWS = 50;
const PHOTOS = 'photos';
const REVIEW = 'review';

/** A line of a shopping trip, as bulk add shows it: the received placeholder and what it holds. */
export interface TripLineView {
  itemId: string;
  categoryId: string;
  sizeId: string | null;
  labelId: string | null;
  qty: number;
  typeName: string;
  sizeLabel: string;
  icon: string;
}
interface Meta { match: string; qty: number }
const NO_META: Meta = { match: '', qty: 1 };

interface Row {
  id: number;
  photo: { path: string; originalPath?: string; preview: string; blob: Blob } | null;
}

/**
 * Bulk add as a step-by-step wizard, like the goal survey. The first screen picks photos (and holds the details shared by every
 * item) and says when they have all loaded; Next then goes through one screen per photo, where the photo can be edited and the item filled in.
 * Every item stays in the one form (screens that are not showing are hidden, not removed), so the last screen's button sends
 * them all to bulkCreate as before. Field names carry the item's position (cat_0, name_1 and so on). The browser's Back button
 * steps back one screen.
 */
export function BulkBuilder({ userId, childId, categories, labels, sizes, brands, defaultTagId, removeBg = false, back, error: serverError, trip, tripGone = false, children }: {
  userId: string;
  childId: string;
  categories: CategoryRow[];
  labels: SizeLabelRow[];
  sizes: SizeRow[];
  brands: string[];
  defaultTagId: string;
  removeBg?: boolean;
  /** Where Exit goes. */
  back: string;
  /** A message from a failed save. */
  error?: string;
  /**
   * From a shopping trip: what was received. Each photo is matched to a line ("Which one is this?"), and a last screen asks
   * for a photo or a No photo tick for every piece, so the trip is done in one save.
   */
  trip?: { id: string; at: string; lines: TripLineView[] };
  /** The trip in the address is already done (or not this child's). */
  tripGone?: boolean;
  /** The details shared by every item, shown on the first screen. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const nextId = useRef(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [stepId, setStepId] = useState<string>(PHOTOS);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  // Items with a photo turn not saved yet: saving the batch waits for them, since a turn replaces the photo's file.
  const [turningRows, setTurningRows] = useState<number[]>([]);
  const rowCount = useRef(0);
  rowCount.current = rows.length;
  const file = useRef<HTMLInputElement>(null);
  const guard = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const sets = useRef(new Map<number, HTMLFieldSetElement>());
  // Trip matching: which received line each item is, and how many pieces it takes (one photo = one piece unless it is a pack).
  const lines = trip?.lines ?? [];
  const [meta, setMeta] = useState<Record<number, Meta>>({});
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const usesOf = (rs: readonly Row[], m: Record<number, Meta>) => rs.map((r) => ({ itemId: m[r.id]?.match ?? '', qty: m[r.id]?.qty ?? 1 }));
  const left = piecesLeft(lines, usesOf(rows, meta));
  const [noPhoto, setNoPhoto] = useState<Record<string, boolean>>({});
  /**
   * "Which one is this?" for an item, as one piece. When that line has no pieces left, it is swapped: the latest other item
   * on it takes this item's old answer (or Something else), so a wrong guess can always be fixed in one tap.
   */
  function choose(rowId: number, lineId: string) {
    setMeta((all) => {
      const mine = all[rowId] ?? NO_META;
      if (mine.match === lineId) return all;
      const next = { ...all, [rowId]: { match: lineId, qty: 1 } };
      const after = piecesLeft(lines, usesOf(rowsRef.current, next));
      if ((after.get(lineId) ?? 0) < 0) {
        const other = [...rowsRef.current].reverse().find((r) => r.id !== rowId && (all[r.id]?.match ?? '') === lineId);
        if (other) next[other.id] = { match: mine.match, qty: 1 };
      }
      return next;
    });
  }
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    guard.current?.setCustomValidity(busy || turningRows.length ? 'Photos are still uploading. Wait a moment, then try again.' : '');
  }, [busy, turningRows.length]);

  // Screens: the photo screen, then one per item. A screen for an item that was removed falls back to the photo screen.
  const steps = [PHOTOS, ...rows.map((r) => String(r.id)), ...(trip ? [REVIEW] : [])];
  const idx = Math.max(0, steps.indexOf(stepId));
  const current = steps[idx];
  const last = idx === steps.length - 1 && idx > 0;

  // The browser's Back button steps back through the screens.
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, b: PHOTOS }, '');
    const onPop = (e: PopStateEvent) => {
      const b = (e.state as { b?: string } | null)?.b;
      if (b) {
        setStepId(b);
        top.current?.parentElement?.scrollTo(0, 0);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = (id: string) => {
    setStepId(id);
    window.history.pushState({ ...window.history.state, b: id }, '');
    top.current?.parentElement?.scrollTo(0, 0);
  };

  const firstInvalid = (fs: HTMLFieldSetElement | undefined) =>
    fs ? Array.from(fs.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')).find((el) => !el.checkValidity()) : undefined;
  /** Checks the fields on the screen showing now. Hidden screens cannot show the browser's message, so each is checked on Next. */
  const screenOk = () => {
    const bad = current === PHOTOS ? undefined : firstInvalid(sets.current.get(Number(current)));
    bad?.reportValidity();
    return !bad;
  };
  /** Before saving, finds any item still missing something (one reached by a thumbnail skips the checks) and shows it. */
  const allOk = () => {
    if (trip) {
      const over = lines.find((l) => (left.get(l.itemId) ?? 0) < 0);
      const open = lines.find((l) => (left.get(l.itemId) ?? 0) > 0 && !noPhoto[l.itemId]);
      const bad = over
        ? `More ${over.typeName} (${over.sizeLabel}) are matched than were bought. Change one of those photos to Something else, or untick its pack.`
        : open
          ? `${open.typeName} (${open.sizeLabel}) still has ${left.get(open.itemId)} without a photo: tick No photo, or go back and match a photo.`
          : null;
      setReviewError(bad);
      if (bad) {
        if (current !== REVIEW) go(REVIEW);
        return false;
      }
    }
    for (const r of rows) {
      const bad = firstInvalid(sets.current.get(r.id));
      if (!bad) continue;
      if (String(r.id) !== current) go(String(r.id));
      setTimeout(() => bad.reportValidity(), 50);
      return false;
    }
    return true;
  };
  const next = () => {
    if (screenOk()) go(steps[idx + 1]);
  };

  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);
    setDone(null);
    const supabase = createClient();
    let skipped = 0;
    const problems: string[] = [];
    let added = 0;
    const startRows = rowCount.current;
    // From a trip, each new photo starts as the next piece still to match, in the trip's order.
    const guessLeft = piecesLeft(lines, usesOf(rowsRef.current, metaRef.current));
    for (let k = 0; k < files.length; k++) {
      if (startRows + added >= MAX_ROWS) {
        setError(`A bulk add holds up to ${MAX_ROWS} items, so the rest of the photos were skipped.`);
        break;
      }
      setBusy(`${removeBg ? 'Processing' : 'Uploading'} photo ${k + 1} of ${files.length}…`);
      let blob: Blob;
      let original: Blob | undefined;
      try {
        const done = await processPhoto(files[k], removeBg, (text) => setBusy(`Photo ${k + 1} of ${files.length}: ${text}`));
        blob = done.blob;
        if (done.cutout) original = done.original;
      } catch (err) {
        console.error('Photo could not be read', err);
        problems.push(`Photo ${k + 1}: could not be read (${reasonOf(err).slice(0, 160)})`);
        skipped++;
        continue;
      }
      // The original is stored with the cutout, so Restore works later. It is not kept in memory.
      const ref = await uploadPhoto(supabase, userId, childId, blob, original, (m) => problems.push(`Photo ${k + 1}: ${m.slice(0, 200)}`));
      if (!ref) {
        if (problems.length < skipped + 1) problems.push(`Photo ${k + 1}: upload failed`);
        skipped++;
        continue;
      }
      const id = nextId.current++;
      added++;
      const g = guessLine(lines, guessLeft);
      if (g) {
        guessLeft.set(g, (guessLeft.get(g) ?? 0) - 1);
        setMeta((m) => ({ ...m, [id]: { match: g, qty: 1 } }));
      }
      setRows((list) => [...list, { id, photo: { ...ref, preview: URL.createObjectURL(blob), blob } }]);
    }
    setBusy(null);
    if (skipped) setError(`${skipped} photo${skipped > 1 ? 's' : ''} could not be added. ${problems.join(' · ')}`);
    // Say they are all in and wait for Next, rather than jumping ahead.
    else if (added) setDone(`${added === 1 ? 'Your photo is uploaded.' : `All ${added} photos are uploaded.`} Tap Next to ${trip ? 'match each one to what you bought' : added === 1 ? 'fill in its details' : 'fill in the details'}.`);
  }

  const addBlank = () => {
    if (rowCount.current >= MAX_ROWS) return;
    const id = nextId.current++;
    setRows((list) => [...list, { id, photo: null }]);
    go(String(id));
  };

  async function removeRow(row: Row) {
    const at = rows.findIndex((r) => r.id === row.id);
    const rest = rows.filter((r) => r.id !== row.id);
    setRows(rest);
    // Stay in place: show the item that takes its spot, or the one before it, or the photo screen.
    const stay = rest[at] ?? rest[at - 1];
    setStepId(stay ? String(stay.id) : PHOTOS);
    window.history.replaceState({ ...window.history.state, b: stay ? String(stay.id) : PHOTOS }, '');
    if (row.photo) {
      URL.revokeObjectURL(row.photo.preview);
      await createClient().storage.from(PHOTO_BUCKET).remove(pathsOf(row.photo));
    }
  }

  /** Uploads the edited photo for an item (and its matching original), swaps it in, and deletes the files it replaces. */
  async function savePhoto(row: Row, result: Blob, original?: Blob) {
    if (!row.photo) return;
    const supabase = createClient();
    const ref = await uploadPhoto(supabase, userId, childId, result, original);
    if (!ref) throw new Error('upload');
    const old = row.photo;
    URL.revokeObjectURL(old.preview);
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, photo: { ...ref, preview: URL.createObjectURL(result), blob: result } } : r)));
    await supabase.storage.from(PHOTO_BUCKET).remove(pathsOf(old));
  }

  /** Leaving throws the batch away, so ask first when there is something to lose, and delete its uploaded photos. */
  async function exit(e: React.MouseEvent) {
    e.preventDefault();
    if (busy !== null || rows.length > 0) {
      if (!window.confirm(trip
        ? 'Leave for now? This trip stays on your Home screen to finish later. Photos added here are not kept.'
        : 'Leave bulk add? Your progress will be lost and nothing will be added to the closet.')) return;
      const paths = rows.flatMap((r) => (r.photo ? pathsOf(r.photo) : []));
      if (paths.length) await createClient().storage.from(PHOTO_BUCKET).remove(paths).catch(() => undefined);
    }
    router.push(back);
  }

  const label = current === PHOTOS ? 'Photos' : current === REVIEW ? 'Check the trip' : `Item ${idx} of ${rows.length}`;
  // The keyboard's Enter (Go) key never saves the batch; it closes the keyboard. Only the save button saves.
  const noEnter = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (e.key === 'Enter' && t instanceof HTMLInputElement && t.type !== 'submit' && t.type !== 'button') {
      e.preventDefault();
      t.blur();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg pt-[var(--safe-top)]" onKeyDown={noEnter}>
      <div ref={top} className="mx-auto flex max-w-xl flex-col gap-5 px-4 pb-[calc(8rem+var(--safe-bottom))] pt-3">
        <input type="hidden" name="rows" value={rows.length} />
        {/* Blocks submit while photos upload. Not read-only, because read-only fields skip validation. */}
        <input ref={guard} className="sr-only" tabIndex={-1} aria-hidden="true" value="ok" onChange={() => undefined} required />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>Bulk add · {label}</span>
            <Link href={back} className="underline" onClick={exit}>Exit</Link>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={idx + 1} aria-label="Bulk add progress" className="h-2 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        <section hidden={current !== PHOTOS} className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Add photos</h1>
            <p className="text-muted">Choose photos of your items, one photo per item. When they have loaded you go through them one at a time to fill in the details. Quantity above 1 makes a group, like a 5-pack.</p>
          </div>
          {serverError && <p role="alert" className="text-sm font-medium text-bad">{serverError}</p>}
          {tripGone && <p role="status" className="rounded-lg bg-warn-soft p-3 text-sm text-warn">That shopping trip is already done, so this is a plain bulk add.</p>}
          {trip && (
            <div className="rounded-xl border border-accent bg-accent-soft p-3">
              <p className="text-sm">Shopping trip · <b><LocalTime iso={trip.at} /></b></p>
              <ul className="mt-1 flex flex-col gap-1">
                {lines.map((l) => (
                  <li key={l.itemId} className="flex items-center gap-2 text-sm">
                    <ItemIcon itemKey={l.icon} size={20} className="shrink-0 text-accent" />
                    <span className="flex-1">{l.qty} × {l.typeName} <span className="text-muted">{l.sizeLabel}</span></span>
                    <span className="text-xs text-muted tabular-nums">{l.qty - Math.max(0, left.get(l.itemId) ?? 0)} of {l.qty} matched</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted">One photo per piece. A pack in one photo can be marked as the whole pack. Anything without a photo gets a No photo tick at the end.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <input ref={file} type="file" accept="image/*" multiple className="sr-only" onChange={onPhotos} aria-label="Choose photos, one per item" />
            <button type="button" className={btnCls} disabled={busy !== null || rows.length >= MAX_ROWS} onClick={() => file.current?.click()}>
              {busy ?? (rows.length ? 'Choose more photos' : 'Choose photos')}
            </button>
            {busy === null && rows.length < MAX_ROWS && <button type="button" className="text-sm text-accent underline" onClick={addBlank}>Add an item without a photo</button>}
          </div>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          {done && !busy && <p role="status" className="rounded-lg bg-good-soft p-3 text-sm font-medium text-good">✓ {done}</p>}
          {rows.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Items so far">
              {rows.map((r, pos) => (
                <li key={r.id}>
                  <button type="button" className="flex size-16 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface text-xs text-muted" onClick={() => go(String(r.id))} aria-label={`Go to item ${pos + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.photo ? <img src={r.photo.preview} alt="" className="size-full object-cover" /> : `Item ${pos + 1}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <details className="rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer font-medium">Details for every item <span className="text-sm font-normal text-muted">(condition, season, status, gender)</span></summary>
            <div className="mt-3">{children}</div>
          </details>
        </section>

        {rows.map((row, pos) => (
          <BulkRow key={row.id} row={row} pos={pos} hidden={current !== String(row.id)} onRemove={() => removeRow(row)} onSavePhoto={(r, o) => savePhoto(row, r, o)}
            onEditor={setEditorOpen} onTurning={(on) => setTurningRows((l) => (on ? (l.includes(row.id) ? l : [...l, row.id]) : l.filter((x) => x !== row.id)))} setRef={(el) => (el ? sets.current.set(row.id, el) : sets.current.delete(row.id))} userId={userId} childId={childId}
            categories={categories} labels={labels} sizes={sizes} defaultTagId={defaultTagId} brands={brands} removeBg={removeBg}
            tripLines={trip ? lines : undefined} left={left} meta={meta[row.id] ?? NO_META} onMeta={(m) => setMeta((all) => ({ ...all, [row.id]: m }))}
            onChoose={(lineId) => choose(row.id, lineId)} />
        ))}

        {trip && (
          <section hidden={current !== REVIEW} className="flex flex-col gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold">Check the trip</h1>
              <p className="text-muted">Every piece from the trip needs a photo, or a tick to add it without one.</p>
            </div>
            <ul className="flex flex-col gap-2">
              {lines.map((l) => {
                const n = left.get(l.itemId) ?? 0;
                return (
                  <li key={l.itemId} className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
                    <span className="flex items-center gap-2">
                      <ItemIcon itemKey={l.icon} size={22} className="shrink-0 text-accent" />
                      <b className="flex-1">{l.qty} × {l.typeName} <span className="font-normal text-muted">{l.sizeLabel}</span></b>
                    </span>
                    {n === 0 && <span className="text-sm text-good">✓ Every piece has a photo</span>}
                    {n < 0 && <span className="text-sm text-bad">{-n} more matched than were bought</span>}
                    {n > 0 && (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="nophoto" value={`${l.itemId}:${n}`} checked={Boolean(noPhoto[l.itemId])}
                          onChange={(e) => { setNoPhoto((x) => ({ ...x, [l.itemId]: e.target.checked })); setReviewError(null); }} className="size-4 accent-accent" />
                        {n} without a photo: add {n === 1 ? 'it' : 'them'} with no photo
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
            {reviewError && <p role="alert" className="text-sm text-bad">{reviewError}</p>}
          </section>
        )}
      </div>

      {/* Hidden while the photo editor is open, so it does not cover the editor's buttons. */}
      <div hidden={editorOpen} className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-bg px-3 pt-3 pb-[calc(0.75rem+var(--safe-bottom))]">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {idx > 0 ? <button type="button" className={btnGhostCls} onClick={() => window.history.back()}>Back</button> : <Link className={btnGhostCls} href={back} onClick={exit}>Exit</Link>}
          <span className="flex-1" />
          {last ? (
            // Not a submit button: a tap on Next that lands here would otherwise finish as a save, because the browser decides what
            // a tap does after React has already swapped the button. This one saves only from its own tap, through requestSubmit.
            <button key="save" type="button" className={btnCls} onClick={(e) => { if (allOk()) e.currentTarget.form?.requestSubmit(); }}>{trip ? 'Save to closet' : `Add ${rows.length} item${rows.length === 1 ? '' : 's'} to closet`}</button>
          ) : (
            <button key="next" type="button" className={btnCls} onClick={next} disabled={steps.length <= 1 || busy !== null}>Next</button>
          )}
        </div>
      </div>
    </div>
  );
}

function BulkRow({ row, pos, hidden, onRemove, onSavePhoto, onEditor, onTurning, setRef, userId, childId, categories, labels, sizes, defaultTagId, brands, removeBg, tripLines, left, meta, onMeta, onChoose }: {
  row: Row;
  pos: number;
  hidden: boolean;
  onRemove: () => void;
  onEditor: (open: boolean) => void;
  onTurning: (on: boolean) => void;
  setRef: (el: HTMLFieldSetElement | null) => void;
  onSavePhoto: (result: Blob, original?: Blob) => Promise<void>;
  userId: string;
  childId: string;
  categories: CategoryRow[];
  labels: SizeLabelRow[];
  sizes: SizeRow[];
  defaultTagId: string;
  brands: string[];
  removeBg: boolean;
  /** From a shopping trip: its lines, the pieces left on each, and which line this item is. */
  tripLines?: TripLineView[];
  left: ReadonlyMap<string, number>;
  meta: Meta;
  onMeta: (m: Meta) => void;
  onChoose: (lineId: string) => void;
}) {
  const line = tripLines?.find((l) => l.itemId === meta.match);
  const [tag, setTag] = useState<TagValue>(() => ({ tagId: line?.labelId ?? defaultTagId, custom: false, text: '' }));
  const [editing, setEditingState] = useState(false);
  const setEditing = (open: boolean) => {
    setEditingState(open);
    onEditor(open);
  };
  const [original, setOriginal] = useState<Blob | undefined>();
  const [opening, setOpening] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // The chosen item type, for the placeholder icon of an item without a photo. Starts where the picker starts.
  const [type, setType] = useState<CategoryRow | undefined>(() => (line && categories.find((c) => c.id === line.categoryId)) || groupCategories(categories)[0]?.items[0]);
  // Whenever this item's trip line changes (its own tap, or a swap from another item), fill in that type and tag size.
  const firstMatch = useRef(true);
  useEffect(() => {
    if (firstMatch.current) {
      firstMatch.current = false;
      return;
    }
    if (!line) return;
    setTag({ tagId: line.labelId ?? defaultTagId, custom: false, text: '' });
    setType(categories.find((c) => c.id === line.categoryId));
  }, [meta.match]); // eslint-disable-line react-hooks/exhaustive-deps
  // Pieces this item could take on its line: what is left there plus what it already holds.
  const avail = line ? (left.get(line.itemId) ?? 0) + meta.qty : 0;

  // Turns show at once; quick taps are saved together once they stop. The stored original turns too, so Restore lines up.
  const turns = useTurnQueue(async (q) => {
    if (!row.photo) return;
    const { path, originalPath, blob } = row.photo;
    const sameFile = originalPath === path;
    let original: Blob | undefined;
    if (originalPath && !sameFile) {
      original = (await downloadOriginal(createClient(), originalPath)) ?? undefined;
      if (!original) throw new Error('original');
    }
    const done = await turnWithOriginal(blob, original, sameFile, q);
    await onSavePhoto(done.result, done.original);
  });
  const turning = turns.saving || turns.shown !== 0;
  useEffect(() => onTurning(turning), [turning]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Opens the editor. The stored original (if there is one) is fetched first, so Restore works. */
  async function openEditor() {
    if (!row.photo) return;
    setEditError(null);
    setOpening(true);
    let found: Blob | null = null;
    if (row.photo.originalPath) found = await downloadOriginal(createClient(), row.photo.originalPath);
    setOpening(false);
    if (row.photo.originalPath && !found) {
      setEditError('The original photo could not be loaded. Check your connection and try again.');
      return;
    }
    setOriginal(found ?? undefined);
    setEditing(true);
  }
  return (
    <fieldset ref={setRef} hidden={hidden} className="grid gap-3 sm:grid-cols-6">
      <legend className="mb-1 font-display text-2xl font-bold">Item {pos + 1}</legend>
      {row.photo && (
        <div className="relative flex flex-col items-center gap-1 sm:col-span-6">
          <input type="hidden" name={`photo_${pos}`} value={joinPhotoField(row.photo.path, row.photo.originalPath)} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.photo.preview} alt={`Photo for item ${pos + 1}`} style={turns.style} className="max-h-72 w-full rounded-xl border border-line bg-surface object-contain" />
          <div className="flex gap-4">
            <button type="button" className="text-sm text-accent underline" disabled={opening} onClick={() => turns.turn(-1)} aria-label="Turn left">↺ Left</button>
            <button type="button" className="text-sm text-accent underline" disabled={opening} onClick={() => turns.turn(1)} aria-label="Turn right">Right ↻</button>
            <button type="button" className="text-sm text-accent underline" disabled={opening || turning} onClick={openEditor}>{opening ? 'Opening…' : 'Edit photo'}</button>
          </div>
          {turns.saving && <p role="status" className="text-xs text-muted">Saving the turn…</p>}
          {(editError ?? turns.error) && <p role="alert" className="text-sm text-bad">{editError ?? turns.error}</p>}
          {editing && <PhotoEditor blob={row.photo.blob} original={original} onSave={async (r, o) => { await onSavePhoto(r, o); setEditing(false); }} onCancel={() => setEditing(false)} />}
        </div>
      )}
      {tripLines && (
        <div className="flex flex-col gap-2 rounded-xl border border-accent bg-accent-soft p-3 sm:col-span-6">
          <input type="hidden" name={`match_${pos}`} value={meta.match} />
          <p className="font-medium">Which one is this?</p>
          <div className="flex flex-wrap gap-2">
            {tripLines.map((l) => {
              const on = meta.match === l.itemId;
              const free = (left.get(l.itemId) ?? 0) + (on ? meta.qty : 0);
              return (
                <button key={l.itemId} type="button" aria-pressed={on} onClick={() => onChoose(l.itemId)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>
                  <ItemIcon itemKey={l.icon} size={18} />
                  {l.typeName} {l.sizeLabel}
                  <span className="text-xs opacity-80">· {on ? `${Math.max(0, left.get(l.itemId) ?? 0)} left` : free > 0 ? `${free} left` : 'swap'}</span>
                </button>
              );
            })}
            <button type="button" aria-pressed={!meta.match} onClick={() => onMeta({ match: '', qty: meta.qty })}
              className={`rounded-full border px-3 py-1.5 text-sm ${!meta.match ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>Something else</button>
          </div>
          {line && avail > 1 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={meta.qty > 1} onChange={(e) => onMeta({ match: meta.match, qty: e.target.checked ? avail : 1 })} className="size-4 accent-accent" />
              This photo is the whole pack ({avail} pieces)
            </label>
          )}
        </div>
      )}
      {!row.photo && (
        <div className="flex justify-center sm:col-span-6">
          <span className="flex size-32 items-center justify-center rounded-xl border border-line bg-surface text-accent"><TypeIcon type={type} size={72} /></span>
        </div>
      )}
      {/* Re-made when the trip line changes, so the item type follows "Which one is this?". */}
      <CategoryPicker key={`${row.id}:${meta.match}`} categories={categories} name={`cat_${pos}`} defaultId={line?.categoryId ?? type?.id} className={`${labelCls} sm:col-span-2`} allowNew onTypeChange={setType} />
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
        <input className={inputCls} type="number" name={`qty_${pos}`} min={1} max={999} value={meta.qty || ''}
          onChange={(e) => onMeta({ match: meta.match, qty: Math.max(0, Math.min(999, Math.round(Number(e.target.value) || 0))) })} />
      </label>
      {!row.photo && (
        <div className={`${labelCls} sm:col-span-6`}>
          Photo (optional)
          <PhotoPicker userId={userId} childId={childId} name={`photo_${pos}`} max={1} label="Add a photo" removeBg={removeBg} />
        </div>
      )}
      <div className="sm:col-span-6">
        <button type="button" className="text-sm text-bad underline" onClick={onRemove}>Remove this item</button>
      </div>
    </fieldset>
  );
}
