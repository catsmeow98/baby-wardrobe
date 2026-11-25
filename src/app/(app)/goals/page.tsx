import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext, toGoals, toInventory, toShopping } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { NoChild } from '@/components/no-child';
import { ProgressBar } from '@/components/progress-bar';
import { btnCls, inputCls } from '@/components/ui';
import { groupCategories } from '@/lib/categories';
import { sizeName } from '@/lib/db';
import type { GoalRow, ItemRow, ShoppingRow } from '@/lib/db';
import { goalProgress, incomingFor, ownedFor, sizeProgress } from '@/lib/domain';
import { saveGoals } from './actions';

export const metadata: Metadata = { title: 'Goals' };

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ size?: string; error?: string; saved?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  const child = ctx.active;

  const [{ data: itemRows }, { data: goalRows }, { data: shopRows }] = await Promise.all([
    ctx.supabase.from('inventory_items').select('*').eq('child_id', child.id),
    ctx.supabase.from('wardrobe_goals').select('*').eq('child_id', child.id),
    ctx.supabase.from('shopping_items').select('*').eq('child_id', child.id),
  ]);
  const items = toInventory((itemRows ?? []) as ItemRow[], ctx);
  const goals = toGoals((goalRows ?? []) as GoalRow[], ctx);
  const shopping = toShopping((shopRows ?? []) as ShoppingRow[], ctx);
  const progress = goalProgress(goals, items, shopping);

  const sizeOrder = sp.size !== undefined && ctx.sizeByOrder.has(Number(sp.size)) ? Number(sp.size) : (ctx.currentSize ?? 0);
  const size = ctx.sizeByOrder.get(sizeOrder);
  if (!size) return <p className="text-muted">Sizes are missing. Run the seed migration in Supabase.</p>;
  const completion = sizeProgress(progress, child.id, sizeOrder);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{child.name}&apos;s goals</h1>
          <p className="text-muted">Set how many pieces {child.name} should have in each category for a size.</p>
        </div>
        <Link className={btnCls} href="/survey">{goals.length > 0 ? 'Retake survey' : 'Take survey'}</Link>
      </div>
      <FormMessage error={sp.error} message={sp.saved ? 'Goals saved.' : undefined} />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Target size">
        {ctx.sizes.map((s) => (
          <Link
            key={s.id}
            href={`/goals?size=${s.sort_order}`}
            aria-current={s.sort_order === sizeOrder ? 'true' : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${s.sort_order === sizeOrder ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}
          >
            {s.alias ? `${s.label} / ${s.alias}` : s.label}{s.sort_order === ctx.currentSize ? ' (now)' : ''}
          </Link>
        ))}
      </div>

      <form action={saveGoals} className="rounded-xl border border-line bg-surface p-4">
        <input type="hidden" name="sizeId" value={size.id} />
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold">{sizeName(size)} goals</h2>
          <span className="text-sm text-muted">{completion.percent === null ? 'No goals set yet' : `${completion.percent}% of target pieces owned`}</span>
        </div>
        <ul>
          {groupCategories(ctx.categories).map((g) => (
            <li key={g.label} className="border-t border-line first:border-t-0">
              <h3 className="pt-3 text-xs font-medium uppercase tracking-wide text-muted">{g.label}</h3>
              <ul>
            {g.items.map((c) => {
            const goal = goals.find((x) => x.categoryId === c.id && x.size === sizeOrder);
            const owned = ownedFor(items, child.id, c.id, sizeOrder);
            const incoming = incomingFor(shopping, child.id, c.id, sizeOrder);
            const remaining = goal ? Math.max(0, goal.target - owned - incoming) : null;
            return (
              <li key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-t border-line py-3 first:border-t-0 sm:grid-cols-[minmax(150px,1.2fr)_90px_minmax(180px,1fr)_minmax(90px,1fr)]">
                <span className="font-bold">{c.name}</span>
                <input className={`${inputCls} w-20`} type="number" min={0} max={99} inputMode="numeric" name={`goal_${c.id}`}
                  defaultValue={goal?.target ?? ''} placeholder="Not set" aria-label={`Goal for ${c.name}`} />
                <span className="col-span-2 flex gap-4 text-sm text-muted tabular-nums sm:col-span-1">
                  <span><b className="block text-base text-ink">{owned}</b>owned</span>
                  <span><b className="block text-base text-ink">{incoming}</b>incoming</span>
                  <span><b className="block text-base text-ink">{remaining ?? '–'}</b>to buy</span>
                </span>
                <span className="col-span-2 sm:col-span-1">
                  {goal && goal.target > 0 ? <ProgressBar owned={owned} incoming={incoming} goal={goal.target} /> : <span className="text-sm text-muted">Not tracked</span>}
                </span>
              </li>
            );
            })}
              </ul>
            </li>
          ))}
        </ul>
        <p className="my-3 text-sm text-muted">
          An item counts toward every size in its fit range, so a 6-9M to 9-12M piece counts for both. Stored items count. Outgrown, donated,
          sold and unusable items do not, and neither do items with an unknown fit. Leave a box empty to stop tracking a category.
        </p>
        <button className={btnCls} type="submit">Save goals</button>
      </form>
    </>
  );
}
