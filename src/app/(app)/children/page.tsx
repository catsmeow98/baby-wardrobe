import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { FormMessage } from '@/components/form-message';
import { safeNext } from '@/lib/auth/redirect';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import type { ChildRow } from '@/lib/db';
import { createChild, deleteChild, updateChild } from './actions';

export const metadata: Metadata = { title: 'Children' };

interface SizeRow { id: string; label: string; alias: string | null; sort_order: number }

const sizeName = (s: SizeRow) => (s.alias ? `${s.label} (${s.alias})` : s.label);

export default async function ChildrenPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const dest = safeNext(next, '');
  const supabase = await createClient();
  // Both queries run as the signed-in user. Row-level security returns only their own children.
  const [{ data: children }, { data: sizes }] = await Promise.all([
    supabase.from('children').select('id, name, birth_date, current_size_id, growth_reference').order('created_at'),
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
      {sizeList.length === 0 && (
        <p role="alert" className="rounded-lg bg-warn-soft p-3 text-sm text-warn">
          The size list is empty, so sizes cannot be chosen. In Supabase, run the file 20260101000002_seed_defaults.sql once.
        </p>
      )}

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
                <details className="w-full text-sm sm:w-auto">
                  <summary className={`${btnGhostCls} cursor-pointer list-none`}>Edit</summary>
                  <form action={updateChild} className="mt-2 flex flex-col gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <label className={labelCls}>Name<input className={inputCls} name="name" defaultValue={c.name} maxLength={80} required /></label>
                    <label className={labelCls}>Current size
                      <select className={inputCls} name="currentSizeId" defaultValue={c.current_size_id ?? ''}>
                        <option value="">Not set</option>
                        {sizeList.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}
                      </select>
                    </label>
                    <label className={labelCls}>Birth date (optional)<input className={inputCls} type="date" name="birthDate" defaultValue={c.birth_date ?? ''} /></label>
                    <label className={labelCls}>Growth reference (for forecasts)
                      <select className={inputCls} name="growthReference" defaultValue={c.growth_reference ?? ''}>
                        <option value="">Not set</option><option value="girls">Girls</option><option value="boys">Boys</option>
                      </select>
                    </label>
                    <div><button className={btnCls} type="submit">Save changes</button></div>
                  </form>
                  <form action={deleteChild} className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
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
        <input type="hidden" name="next" value={dest} />
        {dest && <p className="text-sm text-muted">After you add them, you will go straight back to your suggestions.</p>}
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
            <span className="text-xs">Only used for size forecasts.</span>
          </label>
          <label className={labelCls}>
            Growth reference (optional)
            <select className={inputCls} name="growthReference" defaultValue="">
              <option value="">Not set</option><option value="girls">Girls</option><option value="boys">Boys</option>
            </select>
            <span className="text-xs">Picks which published growth curve the forecast compares against.</span>
          </label>
        </div>
        <div><button className={btnCls} type="submit">Add child</button></div>
      </form>
    </>
  );
}
