import type { Metadata } from 'next';
import { getContext, toGoals, toInventory, toShopping } from '@/lib/context';
import { CategoryOptions } from '@/components/category-options';
import { FormMessage } from '@/components/form-message';
import { NoChild } from '@/components/no-child';
import { Pill } from '@/components/pill';
import { ProgressBar } from '@/components/progress-bar';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { SHOPPING_STATUS, sizeName } from '@/lib/db';
import type { GoalRow, ItemRow, ShoppingRow } from '@/lib/db';
import { goalProgress } from '@/lib/domain';
import { addShoppingItem, cancelItem, markOrdered, orderFromGap, receiveDelivery } from './actions';

export const metadata: Metadata = { title: 'Shopping' };

export default async function ShoppingPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  const child = ctx.active;

  const [{ data: itemRows }, { data: goalRows }, { data: shopRows }] = await Promise.all([
    ctx.supabase.from('inventory_items').select('*').eq('child_id', child.id),
    ctx.supabase.from('wardrobe_goals').select('*').eq('child_id', child.id),
    ctx.supabase.from('shopping_items').select('*').eq('child_id', child.id).order('created_at', { ascending: false }),
  ]);
  const shopRowsT = (shopRows ?? []) as ShoppingRow[];
  const progress = goalProgress(toGoals((goalRows ?? []) as GoalRow[], ctx), toInventory((itemRows ?? []) as ItemRow[], ctx), toShopping(shopRowsT, ctx));
  const gaps = progress
    .filter((p) => p.remaining > 0 && (ctx.currentSize === null || p.size >= ctx.currentSize))
    .sort((a, b) => a.size - b.size || b.remaining - a.remaining);

  const open = shopRowsT.filter((s) => !['received', 'cancelled'].includes(s.status));
  const done = shopRowsT.filter((s) => ['received', 'cancelled'].includes(s.status));
  const nextSize = ctx.sizeByOrder.get(Math.min((ctx.currentSize ?? 0) + 1, ctx.sizes.length - 1));

  const row = (s: ShoppingRow, finished: boolean) => {
    const out = Math.max(0, s.quantity_ordered - s.quantity_received);
    const size = ctx.sizeById.get(s.size_id);
    return (
      <li key={s.id} className="grid gap-2 border-t border-line py-3 first:border-t-0 sm:grid-cols-[minmax(160px,1.4fr)_auto_minmax(120px,1fr)_auto] sm:items-center">
        <div>
          <b>{ctx.catById.get(s.category_id)?.name}</b> <span className="text-sm text-muted">size {size ? sizeName(size) : ''}</span>
          <div className="text-sm text-muted">{s.notes ?? ''}{s.estimated_price ? ` · $${Number(s.estimated_price).toFixed(2)}` : ''}</div>
        </div>
        <div className="flex gap-1.5">
          <Pill tone={s.status === 'received' ? 'good' : s.status === 'cancelled' ? 'neutral' : s.status === 'needed' ? 'warn' : 'notyet'}>{SHOPPING_STATUS[s.status]}</Pill>
          <Pill tone={s.priority === 'high' ? 'bad' : s.priority === 'medium' ? 'warn' : 'neutral'}>{s.priority}</Pill>
        </div>
        <div className="text-sm text-muted">Need {s.quantity_needed} · ordered {s.quantity_ordered} · received {s.quantity_received}</div>
        {!finished && (
          <div className="flex flex-wrap items-center gap-2">
            {s.status === 'needed' && (
              <form action={markOrdered} className="flex items-center gap-1.5">
                <input type="hidden" name="id" value={s.id} />
                <input className={`${inputCls} w-16`} type="number" name="quantity" min={1} defaultValue={s.quantity_needed} aria-label="Quantity ordered" />
                <button className={btnCls} type="submit">Mark ordered</button>
              </form>
            )}
            {(s.status === 'ordered' || s.status === 'partially_received') && (
              <form action={receiveDelivery} className="flex items-center gap-1.5">
                <input type="hidden" name="id" value={s.id} />
                <input className={`${inputCls} w-16`} type="number" name="quantity" min={1} max={out} defaultValue={out} aria-label="Quantity received" />
                <button className={btnCls} type="submit">Receive</button>
              </form>
            )}
            <form action={cancelItem}>
              <input type="hidden" name="id" value={s.id} />
              <button className={btnGhostCls} type="submit">Cancel</button>
            </form>
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">{child.name}&apos;s shopping list</h1>
        <p className="text-muted">Needs come from your goals. Ordered items count as incoming until you receive them.</p>
      </div>
      <FormMessage error={sp.error} message={sp.ok} />

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Gaps from your goals</h2>
        {gaps.length === 0 ? (
          <p className="py-4 text-center text-muted">No gaps. Raise a goal on the Goals page to see needs here.</p>
        ) : (
          <ul>
            {gaps.map((g) => {
              const size = ctx.sizeByOrder.get(g.size);
              if (!size) return null;
              return (
                <li key={`${g.categoryId}-${g.size}`} className="grid gap-2 border-t border-line py-3 first:border-t-0 sm:grid-cols-[minmax(160px,1.4fr)_auto_minmax(120px,1fr)_auto] sm:items-center">
                  <div>
                    <b>{ctx.catById.get(g.categoryId)?.name}</b> <span className="text-sm text-muted">size {sizeName(size)}</span>
                    <div className="text-sm text-muted">Goal {g.target} · owned {g.owned} · incoming {g.incoming}</div>
                  </div>
                  <Pill tone="warn">Need {g.remaining}</Pill>
                  <ProgressBar owned={g.owned} incoming={g.incoming} goal={g.target} />
                  <form action={orderFromGap} className="flex items-center gap-1.5">
                    <input type="hidden" name="categoryId" value={g.categoryId} />
                    <input type="hidden" name="sizeId" value={size.id} />
                    <input className={`${inputCls} w-16`} type="number" name="quantity" min={1} defaultValue={g.remaining} aria-label="Quantity to order" />
                    <button className={btnCls} type="submit">Mark ordered</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Your list</h2>
        <form action={addShoppingItem} className="my-3 flex flex-wrap items-end gap-2">
          <label className={labelCls}>Category
            <select className={inputCls} name="categoryId"><CategoryOptions categories={ctx.categories} /></select>
          </label>
          <label className={labelCls}>Size
            <select className={inputCls} name="sizeId" defaultValue={nextSize?.id}>{ctx.sizes.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}</select>
          </label>
          <label className={labelCls}>Qty<input className={`${inputCls} w-16`} type="number" name="quantity" min={1} defaultValue={1} /></label>
          <label className={labelCls}>Priority
            <select className={inputCls} name="priority" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
          </label>
          <label className={labelCls}>Price<input className={`${inputCls} w-24`} type="number" name="price" min={0} step="0.01" placeholder="0.00" /></label>
          <label className={labelCls}>Note<input className={inputCls} name="notes" maxLength={500} placeholder="Optional" /></label>
          <button className={btnCls} type="submit">Add</button>
        </form>
        {open.length ? <ul>{open.map((s) => row(s, false))}</ul> : <p className="py-4 text-center text-muted">No open orders. Mark a gap above as ordered, or add an entry.</p>}
      </section>

      {done.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-lg font-bold">Done</h2>
          <ul>{done.map((s) => row(s, true))}</ul>
        </section>
      )}
    </>
  );
}
