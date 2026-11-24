import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { Pill } from '@/components/pill';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { fitWord } from '@/lib/domain';
import { loadBrands } from '@/lib/forecast-data';
import { addBrand, deleteBrand, updateBrand } from './actions';

export const metadata: Metadata = { title: 'Brands' };

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const [brands, { data: used }] = await Promise.all([
    loadBrands(ctx),
    ctx.supabase.from('inventory_items').select('brand_id').not('brand_id', 'is', null),
  ]);
  const itemCount = new Map<string, number>();
  for (const r of (used ?? []) as { brand_id: string }[]) itemCount.set(r.brand_id, (itemCount.get(r.brand_id) ?? 0) + 1);

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Brands</h1>
        <p className="text-muted">
          Brands are created when you add them to an item. Manage them here. A brand&apos;s offset shifts the size chart in the{' '}
          <Link className="text-accent underline" href="/forecast">forecast</Link>: positive for a brand that runs large, negative for one that runs small.
        </p>
      </div>
      <FormMessage error={sp.error} message={sp.ok} />

      <form action={addBrand} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface p-4">
        <label className={labelCls}>New brand<input className={inputCls} name="name" maxLength={80} required /></label>
        <label className={labelCls}>Offset (in)<input className={`${inputCls} w-24`} type="number" name="offset" step="0.25" min={-3} max={3} defaultValue={0} /></label>
        <button className={btnCls} type="submit">Add brand</button>
      </form>

      <section className="rounded-xl border border-line bg-surface p-4">
        {brands.length === 0 ? (
          <p className="py-4 text-center text-muted">No brands yet. Add one above or on an item.</p>
        ) : (
          <ul>
            {brands.map((b) => {
              const n = itemCount.get(b.id) ?? 0;
              return (
                <li key={b.id} className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{b.name}</b>
                    <span className="text-sm text-muted">{n} item{n === 1 ? '' : 's'}</span>
                    {b.stats.n > 0 && <Pill tone={b.stats.adjust <= -0.15 ? 'warn' : b.stats.adjust >= 0.15 ? 'notyet' : 'good'}>{fitWord(b.stats.adjust)} · {b.stats.n} rating{b.stats.n === 1 ? '' : 's'}</Pill>}
                    {!b.editable && <Pill>Shared</Pill>}
                  </div>
                  {b.editable && (
                    <div className="flex flex-wrap items-end gap-2">
                      <form action={updateBrand} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={b.id} />
                        <label className={labelCls}>Name<input className={inputCls} name="name" defaultValue={b.name} maxLength={80} required /></label>
                        <label className={labelCls}>Offset (in)<input className={`${inputCls} w-24`} type="number" name="offset" step="0.25" min={-3} max={3} defaultValue={b.baseOffset} /></label>
                        <button className={btnGhostCls} type="submit">Save</button>
                      </form>
                      <details className="text-sm">
                        <summary className="cursor-pointer py-1.5 text-bad">Delete</summary>
                        <form action={deleteBrand} className="mt-1 flex flex-col gap-2">
                          <input type="hidden" name="id" value={b.id} />
                          <p className="max-w-xs text-muted">{n > 0 ? `${n} item${n === 1 ? '' : 's'} will lose this brand and their fit ratings will stop counting.` : 'This brand has no items.'}</p>
                          <div><button className="rounded-lg bg-bad-soft px-3 py-1.5 font-bold text-bad" type="submit">Delete {b.name}</button></div>
                        </form>
                      </details>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
