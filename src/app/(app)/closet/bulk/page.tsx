import type { Metadata } from 'next';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { NoChild } from '@/components/no-child';
import { BulkBuilder } from '@/components/bulk-builder';
import { inputCls, labelCls } from '@/components/ui';
import { CONDITIONS, GENDERS, SEASONS, STATUSES } from '@/lib/db';
import type { SizeLabelRow } from '@/lib/db';
import { bulkCreate } from '../actions';

export const metadata: Metadata = { title: 'Bulk add' };

export default async function BulkPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
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
        <p className="text-muted">
          Start with photos to get a row for each one, or type rows in by hand. Quantity above 1 makes a group, like a 5-pack.
          Rows with no name, no brand and no photo are skipped.
        </p>
      </div>
      <FormMessage error={error} />
      <form action={bulkCreate} className="flex flex-col gap-4">
        <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
          <label className={labelCls}>Condition
            <select className={inputCls} name="condition" defaultValue="good">{CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className={labelCls}>Season
            <select className={inputCls} name="season" defaultValue="year_round">{SEASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className={labelCls}>Status
            <select className={inputCls} name="status" defaultValue="active">{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className={labelCls}>Gender (optional)
            <select className={inputCls} name="gender" defaultValue=""><option value="">Not set</option>{GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </div>
        <BulkBuilder
          userId={ctx.user.id}
          childId={ctx.active.id}
          categories={ctx.categories}
          labels={labels}
          sizes={ctx.sizes}
          brands={(brands ?? []).map((b: { name: string }) => b.name)}
          defaultTagId={defaultTag ?? ''}
          removeBg={ctx.settings.removeBackground}
        />
      </form>
    </>
  );
}
