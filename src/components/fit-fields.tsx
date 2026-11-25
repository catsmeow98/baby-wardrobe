'use client';

import { useRef, useState } from 'react';
import { inputCls, labelCls } from '@/components/ui';
import { FIT_FEEDBACK, sizeName } from '@/lib/db';
import type { SizeLabelRow, SizeRow } from '@/lib/db';
import { feedbackShift, parseTagRange, shiftRange } from '@/lib/domain';
import { TagSizeField, type TagValue } from '@/components/tag-size-field';

export interface FitDefaults {
  tagId: string;
  customTag: string;
  fitFromId: string;
  fitToId: string;
  fitFeedback: string;
}

/**
 * Tag size, "How did it fit?", "Fits from" and "Fits through", as cells of the form's two-column grid.
 * Choosing "Ran small" or "Ran large" fills the two fit dropdowns from the tag size: a piece that ran small fits like
 * the size below its tag, and one that ran large like the size above. The person can change either dropdown afterwards.
 */
export function FitFields({ labels, sizes, defaults: d }: { labels: SizeLabelRow[]; sizes: SizeRow[]; defaults: FitDefaults }) {
  const [tag, setTag] = useState<TagValue>({ tagId: d.customTag ? '' : d.tagId, custom: Boolean(d.customTag), text: d.customTag.replace(/M$/i, '') });
  const [feedback, setFeedback] = useState(d.fitFeedback);
  const [fromId, setFromId] = useState(d.fitFromId);
  const [toId, setToId] = useState(d.fitToId);
  const [note, setNote] = useState<string | null>(null);
  // Once fit sizes have been chosen by hand (or loaded from a saved item), changing the tag leaves them alone.
  const manual = useRef(Boolean(d.fitFromId || d.fitToId));

  const orderOfSize = new Map(sizes.map((s) => [s.id, s.sort_order]));
  const sizeByOrder = new Map(sizes.map((s) => [s.sort_order, s]));
  const maxOrder = Math.max(0, ...sizes.map((s) => s.sort_order));
  const orderOfLabel = new Map(labels.map((l) => [l.id, orderOfSize.get(l.size_id) ?? null]));

  /** The sizes the tag itself covers: one size for a listed tag, the covered sizes for a custom range. */
  function base(t: TagValue): { from: number; to: number } | null {
    if (t.custom) {
      const r = parseTagRange(t.text);
      return 'error' in r ? null : { from: r.fitFrom, to: r.fitTo };
    }
    const o = t.tagId ? orderOfLabel.get(t.tagId) : null;
    return o === null || o === undefined ? null : { from: o, to: o };
  }

  function fill(t: TagValue, fb: string) {
    const b = base(t);
    const shift = feedbackShift(fb);
    if (shift === 0) {
      setFromId('');
      setToId('');
      setNote(null);
      return;
    }
    if (!b) {
      setNote('Pick a tag size and the fit sizes will fill in.');
      return;
    }
    const r = shiftRange(b.from, b.to, shift, maxOrder);
    setFromId(sizeByOrder.get(r.from)?.id ?? '');
    setToId(sizeByOrder.get(r.to)?.id ?? '');
    setNote(`Filled in from the tag size, since it ran ${shift < 0 ? 'small' : 'large'}. Change it if that is not right.`);
  }

  function onFeedback(v: string) {
    setFeedback(v);
    if (v === '') {
      setNote(null);
      return;
    }
    manual.current = false; // the person just chose a rating, so fill from it
    fill(tag, v);
  }

  function onTag(next: TagValue) {
    setTag(next);
    if (!manual.current) fill(next, feedback);
  }

  const parsed = tag.custom && tag.text.trim() ? parseTagRange(tag.text) : null;
  const covers = parsed && !('error' in parsed) ? `${sizeName(sizeByOrder.get(parsed.fitFrom)!)} through ${sizeName(sizeByOrder.get(parsed.fitTo)!)}` : null;
  const sameSize = <option value="">{tag.custom ? 'Same as the tag range' : 'Same as tag size'}</option>;

  return (
    <>
      <div className="flex flex-col gap-1">
        <TagSizeField labels={labels} value={tag} onChange={onTag} tagName="tagId" customName="customTag" />
        {covers && <span className="text-xs text-muted">A {parsed && !('error' in parsed) ? parsed.label : ''} tag covers {covers}.</span>}
      </div>
      <label className={`${labelCls} sm:col-span-2`}>
        How did it fit?
        <select className={inputCls} name="fitFeedback" value={feedback} onChange={(e) => onFeedback(e.target.value)}>
          <option value="">Not rated</option>
          {FIT_FEEDBACK.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {note && <span role="status" className="text-xs text-muted">{note}</span>}
      </label>
      <label className={labelCls}>
        Fits from
        <select className={inputCls} name="fitFromId" value={fromId} onChange={(e) => { manual.current = true; setFromId(e.target.value); setNote(null); }}>
          {sameSize}
          {sizes.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}
        </select>
      </label>
      <label className={labelCls}>
        Fits through
        <select className={inputCls} name="fitToId" value={toId} onChange={(e) => { manual.current = true; setToId(e.target.value); setNote(null); }}>
          {sameSize}
          {sizes.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}
        </select>
      </label>
    </>
  );
}
