'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Sheet } from '@/components/sheet';
import { StickyActions } from '@/components/sticky-actions';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { COLORS, GENDERS, STATUSES } from '@/lib/db';
import { bulkUpdate } from '@/app/(app)/closet/actions';

export interface ClosetCard { id: string; href: string; content: ReactNode }

type Field = 'status' | 'addTag' | 'removeTag' | 'gender' | 'color' | 'delete';
const FIELDS: [Field, string][] = [
  ['status', 'Set status'], ['addTag', 'Add a tag'], ['removeTag', 'Remove a tag'], ['gender', 'Set gender'], ['color', 'Set color'], ['delete', 'Delete items'],
];

/**
 * The closet's item cards. Select turns taps into ticks instead of opening items; the bar at the bottom then changes the ticked
 * items all at once (status, tags, gender, color, or delete).
 */
export function ClosetGrid({ cards, tagNames, tagsByItem, back }: {
  cards: ClosetCard[];
  /** The account's tags, offered when adding one. */
  tagNames: string[];
  /** Each shown item's tags, for offering only tags the ticked items have when removing one. */
  tagsByItem: Record<string, string[]>;
  back: string;
}) {
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<Field>('status');
  const [busy, setBusy] = useState(false);
  const n = picked.size;
  const toggle = (id: string) => setPicked((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const stop = () => { setSelecting(false); setPicked(new Set()); setOpen(false); setBusy(false); };
  // A change saved (the page comes back with fresh cards): start over, out of selecting.
  useEffect(() => stop(), [cards]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickedTags = [...new Set([...picked].flatMap((id) => tagsByItem[id] ?? []))].sort((a, b) => a.localeCompare(b));
  const plural = `${n} item${n === 1 ? '' : 's'}`;

  return (
    <>
      <div className="-mt-2 flex justify-end">
        {selecting
          ? <button type="button" className="text-sm text-accent underline" onClick={stop}>Cancel selecting</button>
          : <button type="button" className="text-sm text-accent underline" onClick={() => setSelecting(true)}>Select items</button>}
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        {cards.map((c) => {
          const on = picked.has(c.id);
          const cls = `relative flex h-full w-full flex-col gap-1.5 rounded-xl border bg-surface p-2.5 text-left sm:p-3 ${on ? 'border-accent ring-2 ring-accent' : 'border-line hover:border-accent'}`;
          return (
            <li key={c.id}>
              {selecting ? (
                <button type="button" className={cls} aria-pressed={on} onClick={() => toggle(c.id)}>
                  <span aria-hidden="true" className={`absolute left-2 top-2 z-10 flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-bg/90'}`}>{on ? '✓' : ''}</span>
                  {c.content}
                </button>
              ) : (
                <Link href={c.href} className={cls}>{c.content}</Link>
              )}
            </li>
          );
        })}
      </ul>

      {selecting && (
        <StickyActions className="-mx-4 px-4">
          <span className="text-sm font-medium">{n} selected</span>
          <button type="button" className="text-sm text-accent underline" onClick={() => setPicked(n === cards.length ? new Set() : new Set(cards.map((c) => c.id)))}>
            {n === cards.length ? 'Select none' : `Select all ${cards.length}`}
          </button>
          <span className="flex-1" />
          <button type="button" className={btnCls} disabled={n === 0} onClick={() => setOpen(true)}>Change {plural}</button>
        </StickyActions>
      )}

      {open && (
        <Sheet label={`Change ${plural}`} onClose={() => setOpen(false)}>
          <form action={bulkUpdate} onSubmit={() => setBusy(true)} className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold">Change {plural}</h2>
            <input type="hidden" name="ids" value={JSON.stringify([...picked])} />
            <input type="hidden" name="back" value={back} />
            <label className={labelCls}>What to change
              <select className={inputCls} name="field" value={field} onChange={(e) => setField(e.target.value as Field)}>
                {FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            {field === 'status' && (
              <label className={labelCls}>Status
                <select className={inputCls} name="value" defaultValue="stored">{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
            )}
            {field === 'gender' && (
              <label className={labelCls}>Gender
                <select className={inputCls} name="value" defaultValue="none"><option value="none">Not set</option>{GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
            )}
            {field === 'color' && (
              <label className={labelCls}>Color
                <select className={inputCls} name="value" defaultValue="none"><option value="none">Not set</option>{COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
            )}
            {field === 'addTag' && (
              <label className={labelCls}>Tag
                <input className={inputCls} name="value" list="bulk-tag-list" maxLength={30} required autoComplete="off" placeholder="Type or pick a tag" />
                <datalist id="bulk-tag-list">{tagNames.map((t) => <option key={t} value={t} />)}</datalist>
              </label>
            )}
            {field === 'removeTag' && (pickedTags.length ? (
              <label className={labelCls}>Tag
                <select className={inputCls} name="value" required>{pickedTags.map((t) => <option key={t} value={t}>{t}</option>)}</select>
              </label>
            ) : <p className="text-sm text-muted">None of the selected items have tags.</p>)}
            {field === 'delete' && (
              <label className="flex items-start gap-2 rounded-lg bg-bad-soft p-3 text-sm text-bad">
                <input type="checkbox" name="confirm" value="yes" required className="mt-0.5 size-4" />
                Delete {plural}. This cannot be undone. To keep a record, set the status to Donated or Sold instead.
              </label>
            )}
            <div className="flex gap-3">
              <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className={field === 'delete' ? 'rounded-lg bg-bad-soft px-4 py-2 font-bold text-bad disabled:opacity-50' : btnCls}
                disabled={busy || (field === 'removeTag' && !pickedTags.length)}>
                {busy ? 'Saving…' : field === 'delete' ? `Delete ${plural}` : `Apply to ${plural}`}
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </>
  );
}
