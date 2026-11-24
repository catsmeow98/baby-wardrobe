import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext, toGoals, toInventory, toShopping } from '@/lib/context';
import { NoChild } from '@/components/no-child';
import { ProgressBar } from '@/components/progress-bar';
import { btnGhostCls } from '@/components/ui';
import { sizeName } from '@/lib/db';
import type { GoalRow, ItemRow, ShoppingRow } from '@/lib/db';
import { fitStateFor, goalProgress, sizeProgress } from '@/lib/domain';

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

export default async function DashboardPage() {
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  const child = ctx.active;
  const [{ data: itemRows }, { data: goalRows }, { data: shopRows }] = await Promise.all([
    ctx.supabase.from('inventory_items').select('*').eq('child_id', child.id),
    ctx.supabase.from('wardrobe_goals').select('*').eq('child_id', child.id),
    ctx.supabase.from('shopping_items').select('*').eq('child_id', child.id),
  ]);
  const items = toInventory((itemRows ?? []) as ItemRow[], ctx);
  const shopRowsT = (shopRows ?? []) as ShoppingRow[];
  const progress = goalProgress(toGoals((goalRows ?? []) as GoalRow[], ctx), items, toShopping(shopRowsT, ctx));

  const cur = ctx.currentSize;
  const active = items.filter((i) => i.status === 'active');
  const fitsNow = active.filter((i) => ['fits', 'small'].includes(fitStateFor(i, cur))).reduce((s, i) => s + i.quantity, 0);
  const small = active.filter((i) => fitStateFor(i, cur) === 'small').reduce((s, i) => s + i.quantity, 0);
  const upcoming = active.filter((i) => fitStateFor(i, cur) === 'notyet').reduce((s, i) => s + i.quantity, 0);
  const nextOrder = cur === null ? null : Math.min(cur + 1, ctx.sizes.length - 1);
  const nextSize = nextOrder === null ? null : ctx.sizeByOrder.get(nextOrder);
  const curSize = cur === null ? null : ctx.sizeByOrder.get(cur);
  const comp = cur === null ? null : sizeProgress(progress, child.id, cur);
  const gaps = progress.filter((p) => p.remaining > 0 && (cur === null || p.size >= cur)).sort((a, b) => b.remaining - a.remaining);
  const openNeeds = gaps.length + shopRowsT.filter((s) => s.status === 'needed').length;

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">{child.name}&apos;s wardrobe</h1>
        <p className="text-muted">
          {curSize ? `Size ${sizeName(curSize)} now.${nextSize ? ` Next size up is ${sizeName(nextSize)}.` : ''}` : 'No current size set.'}
          {cur === null && <> <Link className="text-accent underline" href="/children">Set a size</Link> to see fit and goal progress.</>}
        </p>
      </div>

      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-6 text-center">
          <p className="mb-3 text-muted">Your closet is empty. Add what {child.name} already has, then set goals.</p>
          <Link className={btnGhostCls} href="/closet/bulk">Bulk add items</Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Fits now" value={cur === null ? '–' : fitsNow} note={small ? `${small} getting small` : 'pieces in active use'} />
        <Stat label="Not yet" value={cur === null ? '–' : upcoming} note="pieces for larger sizes" />
        <Stat label={curSize ? `${curSize.label} goals` : 'Goals'} value={comp?.percent == null ? 'None' : `${comp.percent}%`}
          note={comp && comp.goalTotal ? `${comp.ownedTowardGoal} of ${comp.goalTotal} target pieces` : 'Set goals to track this size'} />
        <Stat label="Open needs" value={openNeeds} note={`${gaps.length} goal gaps`} />
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Largest gaps</h2>
          <Link className="text-sm text-accent underline" href="/shopping">Open shopping list</Link>
        </div>
        {gaps.length === 0 ? (
          <p className="py-4 text-center text-muted">{progress.length ? 'Every goal is covered.' : 'No goals yet. Set some on the Goals page.'}</p>
        ) : (
          <ul>
            {gaps.slice(0, 6).map((g) => {
              const s = ctx.sizeByOrder.get(g.size);
              return (
                <li key={`${g.categoryId}-${g.size}`} className="grid grid-cols-[1fr_auto] items-center gap-2 border-t border-line py-2.5 first:border-t-0">
                  <div className="flex flex-col gap-1.5">
                    <span><b>{ctx.catById.get(g.categoryId)?.name}</b> <span className="text-sm text-muted">in {s ? sizeName(s) : ''}</span></span>
                    <ProgressBar owned={g.owned} incoming={g.incoming} goal={g.target} />
                  </div>
                  <span className="text-right"><b className="font-display text-xl tabular-nums">{g.remaining}</b><span className="block text-xs text-muted">to buy</span></span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
