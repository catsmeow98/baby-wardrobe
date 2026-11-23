import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { FormMessage } from '@/components/form-message';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { createChild, deleteChild } from './actions';

export const metadata: Metadata = { title: 'Children' };

interface SizeRow { id: string; label: string; alias: string | null; sort_order: number }
interface ChildRow { id: string; name: string; birth_date: string | null; current_size_id: string | null }

const sizeName = (s: SizeRow) => (s.alias ? `${s.label} (${s.alias})` : s.label);

export default async function ChildrenPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  // Both queries run as the signed-in user. Row-level security returns only their own children.
  const [{ data: children }, { data: sizes }] = await Promise.all([
    supabase.from('children').select('id, name, birth_date, current_size_id').order('created_at'),
    supabase.from('sizes').select('id, label, alias, sort_order').order('sort_order'),
  ]);
  const sizeList = (sizes ?? []) as SizeRow[];
  const bySize = new Map(sizeList.map((s) => [s.id, s]));
  const kids = (children ?? []) as ChildRow[];

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Children</h1>
        <p className="text-muted">Each child has their own closet, goals, and shopping list.</p>
      </div>
      <FormMessage error={error} />

      {kids.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {kids.map((c) => {
            const size = c.current_size_id ? bySize.get(c.current_size_id) : undefined;
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
                <div>
                  <p className="font-bold">{c.name}</p>
                  <p className="text-sm text-muted">
                    {size ? `Size ${sizeName(size)}` : 'Size not set'}
                    {c.birth_date ? ` · born ${c.birth_date}` : ''}
                  </p>
                </div>
                <details className="text-sm">
                  <summary className={`${btnGhostCls} cursor-pointer list-none`}>Remove</summary>
                  <form action={deleteChild} className="mt-2 flex flex-col gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <p className="max-w-xs text-muted">This deletes {c.name}&apos;s items, goals, and shopping list. It cannot be undone.</p>
                    <button className="rounded-lg bg-bad-soft px-3 py-1.5 font-bold text-bad" type="submit">Delete {c.name}</button>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">No children yet. Add your first below.</p>
      )}

      <form action={createChild} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Add a child</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>
            Name
            <input className={inputCls} name="name" maxLength={80} required />
          </label>
          <label className={labelCls}>
            Current size
            <select className={inputCls} name="currentSizeId" defaultValue="">
              <option value="">Not set</option>
              {sizeList.map((s) => (
                <option key={s.id} value={s.id}>{sizeName(s)}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Birth date (optional)
            <input className={inputCls} type="date" name="birthDate" />
            <span className="text-xs">Only used if you turn on size forecasts.</span>
          </label>
        </div>
        <div><button className={btnCls} type="submit">Add child</button></div>
      </form>
    </>
  );
}
