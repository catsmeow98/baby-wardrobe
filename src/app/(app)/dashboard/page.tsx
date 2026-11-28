import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext, toGoals, toInventory, toShopping } from '@/lib/context';
import { NoChild } from '@/components/no-child';
import { SetupBanner } from '@/components/setup-banner';
import { Pill } from '@/components/pill';
import { ProgressBar } from '@/components/progress-bar';
import { btnCls, btnGhostCls } from '@/components/ui';
import { FIT_LABELS, sizeName } from '@/lib/db';
import type { GoalRow, ItemRow, ShoppingRow } from '@/lib/db';
import { KEPT_STATUSES, countFitting, fitStateFor, goalProgress, sizeProgress, transition, type FitState } from '@/lib/domain';
import { forecastFor, loadMeasurements } from '@/lib/forecast-data';
import { TypeIcon } from '@/components/item-icon';
import { TripCard } from '@/components/trip-card';
import { loadTrips } from '@/lib/trips-data';
import { ReceiveOrder } from '@/components/receive-order';
import { LocalTime } from '@/components/local-time';
import { loadOpenOrders } from '@/lib/orders-data';
import { iconForType } from '@/lib/item-icons';

export const metadata: Metadata = { title: 'Dashboard' };

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="font-display text-3xl font-bold tabular-nums">{value}</span>
      <span className="text-sm text-muted">{note}</span>
    </div>
  );
}

const monthOf = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const FIT_ORDER: FitState[] = ['fits', 'notyet', 'outgrown', 'unknown'];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ trip?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <><SetupBanner ctx={ctx} /><NoChild /></>;
  const child = ctx.active;
  const [trips, orders] = await Promise.all([loadTrips(ctx, child.id), loadOpenOrders(ctx, child.id)]);
  // Just received an order from here: offer photos for it (Later leaves it in the list below).
  const justReceived = sp.trip ? trips.find((t) => t.id === sp.trip) : undefined;
  const typeName = (id: string) => ctx.catById.get(id)?.name ?? 'Item';
  const [{ data: itemRows }, { data: goalRows }, { data: shopRows }] = await Promise.all([
    ctx.supabase.from('inventory_items').select('*').eq('child_id', child.id),
    ctx.supabase.from('wardrobe_goals').select('*').eq('child_id', child.id),
    ctx.supabase.from('shopping_items').select('*').eq('child_id', child.id),
  ]);
  const rawItems = (itemRows ?? []) as ItemRow[];
  const items = toInventory(rawItems, ctx);
  const shopRowsT = (shopRows ?? []) as ShoppingRow[];
  const progress = goalProgress(toGoals((goalRows ?? []) as GoalRow[], ctx), items, toShopping(shopRowsT, ctx));

  const cur = ctx.currentSize;
  // The top of the current size range (the same as cur for a single size): the next size is the one above it.
  const curTo = ctx.currentSizeTo;
  const active = items.filter((i) => i.status === 'active');
  const fitsNow = active.filter((i) => fitStateFor(i, cur, curTo) === 'fits').reduce((s, i) => s + i.quantity, 0);
  const upcoming = active.filter((i) => fitStateFor(i, cur, curTo) === 'notyet').reduce((s, i) => s + i.quantity, 0);
  const nextOrder = curTo === null || curTo + 1 >= ctx.sizes.length ? null : curTo + 1;
  const nextSize = nextOrder === null ? null : ctx.sizeByOrder.get(nextOrder);
  const curSize = cur === null ? null : ctx.sizeByOrder.get(cur);
  const comp = cur === null ? null : sizeProgress(progress, child.id, cur);
  // Next size: pieces that fit it (overlapping ranges count, so a 6-12M and a 9-18M piece both count toward 9-12M) and goal completion.
  const nextFit = nextOrder === null ? null : countFitting(items, nextOrder);
  const nextComp = nextOrder === null ? null : sizeProgress(progress, child.id, nextOrder);
  const gaps = progress.filter((p) => p.remaining > 0 && (cur === null || p.size >= cur)).sort((a, b) => b.remaining - a.remaining);
  const openNeeds = gaps.length + shopRowsT.filter((s) => s.status === 'needed').length;

  // Fit breakdown across everything being kept (active or stored), by number of pieces.
  const kept = items.filter((i) => KEPT_STATUSES.includes(i.status));
  const byFit = new Map<FitState, number>();
  for (const i of kept) byFit.set(fitStateFor(i, cur, curTo), (byFit.get(fitStateFor(i, cur, curTo)) ?? 0) + i.quantity);
  const unknownFit = items.filter((i) => KEPT_STATUSES.includes(i.status) && i.fitFrom === null && !i.fitOverride).length;
  const unusable = items.filter((i) => i.condition === 'unusable' && KEPT_STATUSES.includes(i.status)).length;

  // Progress for each size that has goals.
  const goalSizes = [...new Set(progress.filter((p) => p.target > 0).map((p) => p.size))].sort((a, b) => a - b);

  // Orders on the way.
  const onTheWay = shopRowsT.filter((s) => s.status === 'ordered' || s.status === 'partially_received');
  const arriving = onTheWay.reduce((t, s) => t + Math.max(0, s.quantity_ordered - s.quantity_received), 0);

  // Next size from the forecast, on the standard chart.
  const f = child.birth_date && child.growth_reference ? forecastFor(ctx, await loadMeasurements(ctx, child.id), 12) : null;
  const t = f ? transition(f, 0) : null;
  const projected = t?.next ? ctx.sizeByOrder.get(t.next.size) : null;

  return (
    <>
      <SetupBanner ctx={ctx} />
      <div>
        <h1 className="font-display text-2xl font-bold">{child.name}&apos;s wardrobe</h1>
        <p className="text-muted">
          {curSize
            ? `${curTo !== null && curTo !== cur ? `Sizes ${sizeName(curSize)} to ${sizeName(ctx.sizeByOrder.get(curTo) ?? curSize)}` : `Size ${sizeName(curSize)}`} now.${nextSize ? ` Next size up is ${sizeName(nextSize)}.` : ''}`
            : 'No current size set.'}
          {cur === null && <> <Link className="text-accent underline" href="/account#children">Set a size</Link> to see fit and goal progress.</>}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className={btnCls} href="/closet/new">Add item</Link>
        <Link className={btnGhostCls} href="/closet/bulk">Bulk add</Link>
        <Link className={btnGhostCls} href="/survey">Goal survey</Link>
        <Link className={btnGhostCls} href="/goals">Set goals</Link>
      </div>

      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-6 text-center">
          <p className="mb-3 text-muted">Your closet is empty. Add what {child.name} already has, then set goals.</p>
          <Link className={btnGhostCls} href="/closet/bulk">Bulk add items</Link>
        </div>
      )}

      {justReceived && <TripCard trip={justReceived} typeName={typeName} back="/dashboard" prompt laterHref="/dashboard" />}

      {orders.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">Orders on the way</h2>
          {orders.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
              <div>
                <b>{o.name}</b> <span className="text-sm text-muted">· ordered <LocalTime iso={o.orderedAt} /></span>
                <p className="text-sm text-muted">{o.outstanding} piece{o.outstanding === 1 ? '' : 's'} to come: {o.lines.filter((l) => l.ordered > l.received).map((l) => typeName(l.categoryId)).join(', ')}</p>
              </div>
              <ReceiveOrder orderId={o.id} name={o.name} returnTo="/dashboard"
                lines={o.lines.filter((l) => l.ordered > l.received && ['ordered', 'partially_received'].includes(l.status)).map((l) => {
                  const z = ctx.sizeById.get(l.sizeId);
                  return { item: l.item, typeName: typeName(l.categoryId), sizeLabel: z ? sizeName(z) : '', icon: iconForType(ctx.catById.get(l.categoryId)), outstanding: l.ordered - l.received };
                })} />
            </div>
          ))}
        </section>
      )}

      {trips.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">Shopping trips needing photos</h2>
          {trips.filter((t) => t.id !== justReceived?.id).slice(0, 5).map((t) => <TripCard key={t.id} trip={t} typeName={typeName} back="/dashboard" />)}
          {trips.length > 5 && <p className="text-sm text-muted">And {trips.length - 5} more.</p>}
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Fits now" value={cur === null ? '–' : fitsNow} note="pieces in active use" />
        <Stat label={curSize ? `${curSize.label} goals` : 'Goals'} value={comp?.percent == null ? 'None' : `${comp.percent}%`}
          note={comp && comp.goalTotal ? `${comp.ownedTowardGoal} of ${comp.goalTotal} target pieces` : 'Set goals to track this size'} />
        {nextSize && nextFit !== null && nextComp && (
          <>
            <Stat label={`${nextSize.label} closet`} value={nextFit} note="pieces that fit next size, including overlaps" />
            <Stat label={`${nextSize.label} goals`} value={nextComp.percent == null ? 'None' : `${nextComp.percent}%`}
              note={nextComp.goalTotal ? `${nextComp.ownedTowardGoal} of ${nextComp.goalTotal} target pieces` : 'Set goals to track next size'} />
          </>
        )}
        <Stat label="Not yet" value={cur === null ? '–' : upcoming} note="pieces for larger sizes" />
        <Stat label="Open needs" value={openNeeds} note={`${gaps.length} goal gaps`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-1 font-display text-lg font-bold">Next size</h2>
          {t && f ? (
            <>
              <p>
                {projected && t.next
                  ? <>{child.name} is likely to move into <b>{sizeName(projected)}</b> around <b>{monthOf(t.next.date)}</b>.</>
                  : <>{child.name} is likely to stay in the current size through {monthOf(t.end)}.</>}
              </p>
              <p className="mt-1 text-sm text-muted">An estimate on the standard chart. <Link className="text-accent underline" href="/forecast">See the forecast</Link></p>
            </>
          ) : (
            <p className="text-sm text-muted">
              Add a birth date, a growth reference and a measurement to see when {child.name} is likely to need the next size.{' '}
              <Link className="text-accent underline" href="/forecast">Open the forecast</Link>
            </p>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-1 font-display text-lg font-bold">On the way</h2>
          {onTheWay.length === 0 ? (
            <p className="text-sm text-muted">No open orders. <Link className="text-accent underline" href="/shopping">Open the shopping list</Link></p>
          ) : (
            <>
              <p><b className="tabular-nums">{arriving}</b> piece{arriving === 1 ? '' : 's'} across {onTheWay.length} order{onTheWay.length === 1 ? '' : 's'} still to arrive.</p>
              <ul className="mt-1 text-sm text-muted">
                {onTheWay.slice(0, 4).map((s) => (
                  <li key={s.id}>{Math.max(0, s.quantity_ordered - s.quantity_received)} × {ctx.catById.get(s.category_id)?.name} in {sizeName(ctx.sizeById.get(s.size_id) ?? { label: '' , alias: null })}</li>
                ))}
              </ul>
              <Link className="mt-1 inline-block text-sm text-accent underline" href="/shopping">Record a delivery</Link>
            </>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Largest gaps</h2>
          <Link className="text-sm text-accent underline" href="/shopping">Open shopping list</Link>
        </div>
        {gaps.length === 0 ? (
          <p className="py-4 text-center text-muted">{progress.length ? 'Every goal is covered.' : 'No goals yet. Set some on the Goals page or take the goal survey.'}</p>
        ) : (
          <ul>
            {gaps.slice(0, 6).map((g) => {
              const s = ctx.sizeByOrder.get(g.size);
              return (
                <li key={`${g.categoryId}-${g.size}`} className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-line py-2.5 first:border-t-0">
                  <div className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-1.5"><TypeIcon type={ctx.catById.get(g.categoryId)} size={22} className="shrink-0 text-accent" /><span><b>{ctx.catById.get(g.categoryId)?.name}</b> <span className="text-sm text-muted">in {s ? sizeName(s) : ''}</span></span></span>
                    <ProgressBar owned={g.owned} incoming={g.incoming} goal={g.target} />
                  </div>
                  <span className="text-right"><b className="font-display text-xl tabular-nums">{g.remaining}</b><span className="block text-xs text-muted">to buy</span></span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {goalSizes.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-2 font-display text-lg font-bold">Progress by size</h2>
          <ul>
            {goalSizes.map((order) => {
              const s = ctx.sizeByOrder.get(order);
              const p = sizeProgress(progress, child.id, order);
              return (
                <li key={order} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 border-t border-line py-2 first:border-t-0">
                  <Link className="text-accent underline" href={`/goals?size=${order}`}>{s ? sizeName(s) : ''}{order === cur ? ' (now)' : ''}</Link>
                  <ProgressBar owned={p.ownedTowardGoal} incoming={0} goal={p.goalTotal} />
                  <span className="text-right text-sm tabular-nums">{p.percent ?? 0}%</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {kept.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-2 font-display text-lg font-bold">Closet by fit</h2>
          <div className="flex flex-wrap gap-2">
            {FIT_ORDER.filter((k) => byFit.get(k)).map((k) => (
              <Pill key={k} tone={k}>{FIT_LABELS[k]}: {byFit.get(k)}</Pill>
            ))}
          </div>
          {(unknownFit > 0 || unusable > 0) && (
            <ul className="mt-3 text-sm">
              {unknownFit > 0 && (
                <li>
                  <b>{unknownFit}</b> item{unknownFit === 1 ? ' has' : 's have'} no fit range, so {unknownFit === 1 ? 'it does' : 'they do'} not count toward goals.{' '}
                  <Link className="text-accent underline" href="/closet?fit=unknown">Review</Link>
                </li>
              )}
              {unusable > 0 && (
                <li>
                  <b>{unusable}</b> item{unusable === 1 ? ' is' : 's are'} marked unusable but still in your closet.{' '}
                  <Link className="text-accent underline" href="/closet">Review</Link>
                </li>
              )}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
