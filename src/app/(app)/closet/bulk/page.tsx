import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { NoChild } from '@/components/no-child';
import { PhotoPicker } from '@/components/photo-picker';
import { btnCls, inputCls, labelCls } from '@/components/ui';
import { CONDITIONS, SEASONS, STATUSES, sizeName } from '@/lib/db';
import type { SizeLabelRow } from '@/lib/db';
import { bulkCreate } from '../actions';

export const metadata: Metadata = { title: 'Bulk add' };

export default async function BulkPage({ searchParams }: { searchParams: Promise<{ error?: string; rows?: string }> }) {
  const { error, rows } = await searchParams;
  const count = Math.min(50, Math.max(5, Number(rows) || 10));
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  const [{ data: labelData }, { data: brands }] = await Promise.all([
    ctx.supabase.from('size_labels').select('id, size_id, label, sort_order'),
    ctx.supabase.from('brands').select('name').order('name'),
  ]);
  const labels = ((labelData ?? []) as SizeLabelRow[]).sort(
    (a, b) => (ctx.orderOf.get(a.size_id) ?? 0) - (ctx.orderOf.get(b.size_id) ?? 0) || a.sort_order - b.sort_order,
  );
  const defaultTag = ctx.active.current_size_id ? labels.filter((l) => l.size_id === ctx.active!.current_size_id).sort((a, b) => b.sort_order - a.sort_order)[0]?.id : '';

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Bulk add for {ctx.active.name}</h1>
        <p className="text-muted">One row per kind of item. Quantity above 1 makes a group, like a 5-pack. Rows with no name and no brand are skipped.</p>
      </div>
      <FormMessage error={error} />
      <form action={bulkCreate} className="flex flex-col gap-4">
        <input type="hidden" name="rows" value={count} />
        <datalist id="brand-list">{(brands ?? []).map((b: { name: string }) => <option key={b.name} value={b.name} />)}</datalist>
        <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3">
          <label className={labelCls}>Condition
            <select className={inputCls} name="condition" defaultValue="good">{CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className={labelCls}>Season
            <select className={inputCls} name="season" defaultValue="year_round">{SEASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className={labelCls}>Status
            <select className={inputCls} name="status" defaultValue="active">{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </div>
        {Array.from({ length: count }, (_, i) => (
          <fieldset key={i} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-6">
            <legend className="px-1 text-xs text-muted">Row {i + 1}</legend>
            <label className={`${labelCls} sm:col-span-2`}>Category
              <select className={inputCls} name={`cat_${i}`} defaultValue={ctx.categories[0]?.id}>
                {ctx.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className={`${labelCls} sm:col-span-2`}>Name (optional)
              <input className={inputCls} name={`name_${i}`} maxLength={160} />
            </label>
            <label className={`${labelCls} sm:col-span-2`}>Brand
              <input className={inputCls} name={`brand_${i}`} maxLength={80} list="brand-list" />
            </label>
            <label className={labelCls}>Tag size
              <select className={inputCls} name={`tag_${i}`} defaultValue={defaultTag ?? ''}>
                <option value="">Not set</option>
                {labels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <label className={`${labelCls} sm:col-span-2`}>Fits through
              <select className={inputCls} name={`thru_${i}`} defaultValue="">
                <option value="">Same as tag size</option>
                {ctx.sizes.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}
              </select>
            </label>
            <label className={labelCls}>Quantity
              <input className={inputCls} type="number" name={`qty_${i}`} min={1} max={999} defaultValue={1} />
            </label>
            <div className={`${labelCls} sm:col-span-6`}>
              Photos (optional)
              <PhotoPicker userId={ctx.user.id} childId={ctx.active.id} name={`photo_${i}`} />
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center gap-4">
          <button className={btnCls} type="submit">Add to closet</button>
          {count < 50 && <Link className="text-sm text-accent underline" href={`/closet/bulk?rows=${Math.min(50, count + 10)}`}>Show 10 more rows (before you type)</Link>}
        </div>
      </form>
    </>
  );
}
