import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext, toGoals, toInventory, toShopping } from '@/lib/context';
import { CopyButton } from '@/components/copy-button';
import { TypeFilters } from '@/components/type-filters';
import { listOf } from '@/lib/multi';
import { matchesCategory } from '@/lib/categories';
import { FormMessage } from '@/components/form-message';
import { NoChild } from '@/components/no-child';
import { btnGhostCls, inputCls } from '@/components/ui';
import { sizeName } from '@/lib/db';
import type { GoalRow, ItemRow, ShoppingRow } from '@/lib/db';
import { goalProgress } from '@/lib/domain';
import { currentUrl } from '@/lib/back';
import { buildNeedsTable } from '@/lib/needs-table';
import { cancelOrderRest, renameOrder } from './actions';
import { NeedsCart } from '@/components/needs-cart';
import { TripCard } from '@/components/trip-card';
import { ReceiveOrder } from '@/components/receive-order';
import { LocalTime } from '@/components/local-time';
import { loadOpenOrders } from '@/lib/orders-data';
import { loadHistory } from '@/lib/history-data';
import { loadTrips } from '@/lib/trips-data';
import { iconForType } from '@/lib/item-icons';

export const metadata: Metadata = { title: 'Shopping' };

export default async function ShoppingPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; trip?: string; group?: string | string[]; cat?: string | string[]; size?: string | string[] }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  const here = currentUrl('/shopping', sp);
  const child = ctx.active;

  const [{ data: itemRows }, { data: goalRows }, { data: shopRows }] = await Promise.all([
    ctx.supabase.from('inventory_items').select('*').eq('child_id', child.id),
    ctx.supabase.from('wardrobe_goals').select('*').eq('child_id', child.id),
    ctx.supabase.from('shopping_items').select('*').eq('child_id', child.id).order('created_at', { ascending: false }),
  ]);
  const shopRowsT = (shopRows ?? []) as ShoppingRow[];
  // Just received (a Receive, or Bought & received in the cart): offer to add photos for that trip.
  const tripId = sp.trip && /^[0-9a-f-]{36}$/i.test(sp.trip) ? sp.trip : undefined;
  const justReceived = tripId ? (await loadTrips(ctx, child.id, tripId))[0] : undefined;
  const progress = goalProgress(toGoals((goalRows ?? []) as GoalRow[], ctx), toInventory((itemRows ?? []) as ItemRow[], ctx), toShopping(shopRowsT, ctx));
  const visibleIds = new Set(ctx.categories.map((c) => c.id));
  const groupIds = listOf(sp.group);
  const cats = listOf(sp.cat);
  const sizeList = listOf(sp.size);
  const sizeOrders = sizeList.map(Number).filter(Number.isFinite);
  const typeOk = (categoryId: string) => visibleIds.has(categoryId) && matchesCategory(ctx.catById.get(categoryId), { group: groupIds, cat: cats });
  const sizeOk = (order: number | undefined) => sizeOrders.length === 0 || (order !== undefined && sizeOrders.includes(order));
  const filtering = groupIds.length > 0 || cats.length > 0 || sizeOrders.length > 0;
  const gaps = progress
    .filter((p) => p.remaining > 0 && (ctx.currentSize === null || p.size >= ctx.currentSize) && typeOk(p.categoryId) && sizeOk(p.size))
    .sort((a, b) => a.size - b.size || b.remaining - a.remaining);

  const passes = (s: ShoppingRow) => typeOk(s.category_id) || (!visibleIds.has(s.category_id) && !groupIds.length && !cats.length) ? sizeOk(ctx.orderOf.get(s.size_id)) : false;
  // Ordered entries that belong to an order show under Orders; Your list keeps what is still to order (and older loose orders).
  const open = shopRowsT.filter((s) => !['received', 'cancelled'].includes(s.status) && !(s.order_id && s.status !== 'needed') && passes(s));
  const [orders, history] = await Promise.all([loadOpenOrders(ctx, child.id), loadHistory(ctx, child.id)]);
  // Plain text for pasting into a note or message: what is still to buy, from the gaps and from entries not yet ordered.
  const wanted = [
    ...gaps.map((g) => ({ n: g.remaining, type: ctx.catById.get(g.categoryId)?.name ?? 'Item', size: ctx.sizeByOrder.get(g.size) })),
    ...open.filter((s) => s.status === 'needed').map((s) => ({ n: s.quantity_needed, type: ctx.catById.get(s.category_id)?.name ?? 'Item', size: ctx.sizeById.get(s.size_id) })),
  ];
  const listText = wanted.map((w) => `${w.n}× ${w.type}, size ${w.size ? sizeName(w.size) : '?'}`).join('\n');
  const needs = buildNeedsTable(gaps, ctx.categories.map((c) => c.id));

  const typeName = (id: string) => ctx.catById.get(id)?.name ?? 'Item';
  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">{child.name}&apos;s shopping list</h1>
        <p className="text-muted">Needs come from your goals. Ordered items count as incoming until you receive them.</p>
      </div>
      <FormMessage error={sp.error} message={sp.ok} />
      {justReceived && (
        <TripCard trip={justReceived} typeName={(id) => ctx.catById.get(id)?.name ?? 'Item'} sizeName={(id) => { const z = ctx.sizeById.get(id); return z ? sizeName(z) : ''; }} back={currentUrl('/shopping', { ...sp, trip: undefined, ok: undefined })} prompt
          laterHref={currentUrl('/shopping', { ...sp, trip: undefined, ok: undefined })} />
      )}

      <form className="flex flex-wrap items-center gap-2" method="get" role="search">
        <TypeFilters categories={ctx.categories} groups={ctx.groups} sizes={ctx.sizes} group={groupIds} cat={cats} size={sizeList} />
        <button className={btnGhostCls} type="submit">Filter</button>
        {filtering && <Link className={btnGhostCls} href="/shopping">Clear</Link>}
        <CopyButton text={listText} label="Copy list" />
      </form>

      <section id="orders" className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Orders</h2>
        {orders.length === 0 ? (
          <p className="py-3 text-sm text-muted">Nothing on order. Put things in the cart below, then Mark ordered in the cart.</p>
        ) : (
          <ul className="flex flex-col">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <b>{o.name}</b> <span className="text-sm text-muted">· ordered <LocalTime iso={o.orderedAt} /></span>
                    <ul className="text-sm text-muted">
                      {o.lines.map((l) => {
                        const z = ctx.sizeById.get(l.sizeId);
                        return <li key={l.item}>{typeName(l.categoryId)} {z ? sizeName(z) : ''}: {l.received} of {l.ordered} arrived</li>;
                      })}
                    </ul>
                  </div>
                  <ReceiveOrder orderId={o.id} name={o.name} returnTo={currentUrl('/shopping', { ...sp, trip: undefined, ok: undefined })}
                    lines={o.lines.filter((l) => l.ordered > l.received && ['ordered', 'partially_received'].includes(l.status)).map((l) => {
                      const z = ctx.sizeById.get(l.sizeId);
                      return { item: l.item, typeName: typeName(l.categoryId), sizeLabel: z ? sizeName(z) : '', icon: iconForType(ctx.catById.get(l.categoryId)), outstanding: l.ordered - l.received };
                    })} />
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-accent">Rename or cancel</summary>
                  <form action={renameOrder} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="back" value={here} />
                    <input type="hidden" name="id" value={o.id} />
                    <input className={inputCls} name="name" defaultValue={o.name} maxLength={80} required aria-label="Order name" />
                    <button className={btnGhostCls} type="submit">Save name</button>
                  </form>
                  <form action={cancelOrderRest} className="mt-2">
                    <input type="hidden" name="back" value={here} />
                    <input type="hidden" name="id" value={o.id} />
                    <button className="text-bad underline" type="submit">Cancel what&apos;s left of this order</button>
                    <span className="ml-2 text-xs text-muted">Anything already received stays.</span>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Needs by item and size</h2>
        <p className="text-sm text-muted">What is still to buy: each goal minus what you own and what is already on order. Sizes start at {child.name}&apos;s current size.</p>
        {needs.rows.length === 0 && (
          <p className="py-4 text-center text-muted">{filtering ? 'Nothing is needed for these filters.' : 'Nothing is needed right now.'}</p>
        )}
        {/* Always there, so extras can go in the cart even when nothing is needed. */}
        {(
          <NeedsCart
            childId={child.id}
            columns={needs.sizes.flatMap((n) => { const z = ctx.sizeByOrder.get(n); return z ? [{ order: n, sizeId: z.id, label: sizeName(z) }] : []; })}
            rows={needs.rows.map((r) => ({ categoryId: r.categoryId, cells: Object.fromEntries(r.cells), info: Object.fromEntries(gaps.filter((g) => g.categoryId === r.categoryId).map((g) => [g.size, { goal: g.target, owned: g.owned, incoming: g.incoming }])) }))}
            types={Object.fromEntries(ctx.categories.map((c) => [c.id, { name: c.name, icon: iconForType(c) }]))}
            sizeLabels={Object.fromEntries(ctx.sizes.map((z) => [z.id, sizeName(z)]))}
            allSizes={ctx.sizes.map((z) => ({ sizeId: z.id, label: sizeName(z) }))}
            list={gaps.flatMap((g) => {
              const z = ctx.sizeByOrder.get(g.size);
              return z ? [{ categoryId: g.categoryId, sizeId: z.id, sizeLabel: sizeName(z), goal: g.target, owned: g.owned, incoming: g.incoming, need: g.remaining }] : [];
            })}
          />
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">History</h2>
        {history.length === 0 ? (
          <p className="py-3 text-sm text-muted">Finished orders and store trips show here.</p>
        ) : (
          <ul className="flex flex-col">
            {history.map((h) => (
              <li key={h.key} className="border-t border-line py-3 first:border-t-0">
                <p>
                  <b>{h.name ?? (h.kind === 'store' ? 'In store' : 'Earlier')}</b>{' '}
                  <span className="text-sm text-muted">· {h.kind === 'order' ? 'order' : h.kind === 'store' ? 'in store' : 'list'} · <LocalTime iso={h.at} /></span>
                </p>
                <p className="text-sm text-muted">
                  {h.lines.map((l, i) => {
                    const z = ctx.sizeById.get(l.sizeId);
                    const label = `${typeName(l.categoryId)} ${z ? sizeName(z) : ''}`;
                    return (
                      <span key={i}>
                        {i > 0 && ', '}
                        {l.qty > 0 && `${label}${l.qty > 1 ? ` ×${l.qty}` : ''}`}
                        {l.cancelled > 0 && <span className="line-through">{l.qty > 0 ? ` (${l.cancelled} cancelled)` : `${label}${l.cancelled > 1 ? ` ×${l.cancelled}` : ''}`}</span>}
                      </span>
                    );
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
