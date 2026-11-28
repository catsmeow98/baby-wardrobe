'use client';

import { useEffect, useState } from 'react';
import { CopyButton } from '@/components/copy-button';
import { ColorDot } from '@/components/color-dot';
import { StickyActions } from '@/components/sticky-actions';
import { btnCls, inputCls } from '@/components/ui';
import { analyzeBackground, analyzeColor, type ColorAnalysis } from '@/lib/color-detect';
import { createClient } from '@/lib/supabase/client';
import { PHOTO_BUCKET } from '@/lib/photos';
import { COLORS } from '@/lib/db';
import { saveColors } from '@/app/(app)/closet/actions';

interface Item { id: string; name: string; color: string | null; path: string | null; url: string | null }
const colorName = (v: string | null | undefined) => (v ? (COLORS.find(([k]) => k === v)?.[1] ?? v) : 'Not set');

/** Each item's photo, saved color, the guess and what it was based on; a color to pick; one save for all; a report to copy. */
export function ColorCheck({ tagId, tagName, items }: { tagId: string; tagName: string; items: Item[] }) {
  const [found, setFound] = useState<Record<string, ColorAnalysis | null>>({});
  const [bgs, setBgs] = useState<Record<string, Awaited<ReturnType<typeof analyzeBackground>>>>({});
  const [picked, setPicked] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.id, i.color ?? ''])));
  const [busy, setBusy] = useState(false);

  // Read each photo in turn and see what the guesser makes of it.
  useEffect(() => {
    let stop = false;
    (async () => {
      const supabase = createClient();
      for (const i of items) {
        if (stop) return;
        if (!i.path) { setFound((f) => ({ ...f, [i.id]: null })); continue; }
        const { data } = await supabase.storage.from(PHOTO_BUCKET).download(i.path);
        const a = data ? await analyzeColor(data) : null;
        // The original with its background sits beside a cutout ("x.png" and "x-o.jpg"); its background shows the light.
        let bg: Awaited<ReturnType<typeof analyzeBackground>> = null;
        if (data && i.path.endsWith('.png')) {
          const stem = i.path.slice(0, -4);
          const orig = (await supabase.storage.from(PHOTO_BUCKET).download(`${stem}-o.jpg`)).data ?? (await supabase.storage.from(PHOTO_BUCKET).download(`${stem}-o.png`)).data;
          if (orig) bg = await analyzeBackground(data, orig);
        }
        if (!stop) {
          setBgs((b) => ({ ...b, [i.id]: bg }));
          setFound((f) => ({ ...f, [i.id]: a }));
        }
      }
    })();
    return () => { stop = true; };
  }, [items]);

  const done = Object.keys(found).length;
  const report = JSON.stringify(items.map((i) => {
    const a = found[i.id];
    return {
      correct: picked[i.id] || null, guess: a?.color ?? null,
      buckets: a?.buckets.slice(0, 4).map((b) => [b.name, b.share, ...b.rgb]), clusters: a?.clusters.slice(0, 10),
      bg: bgs[i.id] ? [...bgs[i.id]!.mean, ...bgs[i.id]!.median, ...bgs[i.id]!.bright, bgs[i.id]!.share] : null,
    };
  }));
  const changed = items.filter((i) => (picked[i.id] || null) !== i.color).length;

  return (
    <form action={saveColors} onSubmit={() => setBusy(true)} className="flex flex-col gap-3">
      <input type="hidden" name="tag" value={tagId} />
      <input type="hidden" name="colors" value={JSON.stringify(items.map((i) => ({ id: i.id, color: picked[i.id] || null })))} />
      <p className="text-sm text-muted">{done < items.length ? `Reading photos… ${done} of ${items.length}` : `${items.length} items read.`}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((i) => {
          const a = found[i.id];
          return (
            <li key={i.id} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
              {i.url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={i.url} alt="" className="size-24 shrink-0 rounded-lg bg-line object-contain" />
                : <span className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-line text-xs text-muted">No photo</span>}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
                <b className="truncate">{i.name}</b>
                <span className="text-muted">Saved: <ColorDot color={i.color} className="mr-1" />{colorName(i.color)} · Guess now: {a === undefined ? '…' : a ? colorName(a.color) : 'could not read'}</span>
                {a && (
                  <span className="flex h-3 overflow-hidden rounded-full" title={a.buckets.map((b) => `${b.name} ${Math.round(b.share * 100)}%`).join(', ')}>
                    {a.buckets.filter((b) => b.share >= 0.02).map((b) => <span key={b.name} style={{ width: `${b.share * 100}%`, background: `rgb(${b.rgb.join(',')})` }} />)}
                  </span>
                )}
                {a && <span className="text-xs text-muted">{a.buckets.slice(0, 4).map((b) => `${b.name} ${Math.round(b.share * 100)}%`).join(' · ')}</span>}
                <select className={`${inputCls} py-1.5`} aria-label={`Right color for ${i.name}`} value={picked[i.id]} onChange={(e) => setPicked((p) => ({ ...p, [i.id]: e.target.value }))}>
                  <option value="">Not set</option>
                  {COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </li>
          );
        })}
      </ul>
      <StickyActions className="-mx-4 px-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="untag" value="yes" defaultChecked className="size-4 accent-accent" />
          Take the {tagName} tag off
        </label>
        <span className="flex-1" />
        <CopyButton text={report} label="Copy report for Claude" />
        <button type="submit" className={btnCls} disabled={busy}>{busy ? 'Saving…' : `Save colors${changed ? ` (${changed} changed)` : ''}`}</button>
      </StickyActions>
    </form>
  );
}
