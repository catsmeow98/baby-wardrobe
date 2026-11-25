import type { Metadata } from 'next';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { groupCategories } from '@/lib/categories';
import { addCategory, deleteCategory, renameCategory } from './actions';

export const metadata: Metadata = { title: 'Categories' };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const mine = ctx.categories.filter((c) => c.owner_id !== null);
  const builtIn = ctx.categories.filter((c) => c.owner_id === null);

  // How many records use each of the person's own categories. A category in use cannot be deleted.
  const [{ data: items }, { data: goals }, { data: shop }] = await Promise.all([
    ctx.supabase.from('inventory_items').select('category_id'),
    ctx.supabase.from('wardrobe_goals').select('category_id'),
    ctx.supabase.from('shopping_items').select('category_id'),
  ]);
  const uses = new Map<string, number>();
  for (const r of [...(items ?? []), ...(goals ?? []), ...(shop ?? [])] as { category_id: string }[]) uses.set(r.category_id, (uses.get(r.category_id) ?? 0) + 1);

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Categories</h1>
        <p className="text-muted">Add your own for anything the built-in list does not cover. Yours appear in every picker and on the Goals page. The goal survey only plans for the built-in ones.</p>
      </div>
      <FormMessage error={sp.error} message={sp.ok} />

      <form action={addCategory} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface p-4">
        <label className={labelCls}>New category<input className={inputCls} name="name" maxLength={60} placeholder="For example, Costume" required /></label>
        <button className={btnCls} type="submit">Add category</button>
      </form>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-1 font-display text-lg font-bold">Your categories</h2>
        {mine.length === 0 ? (
          <p className="py-3 text-sm text-muted">None yet.</p>
        ) : (
          <ul>
            {mine.map((c) => {
              const n = uses.get(c.id) ?? 0;
              return (
                <li key={c.id} className="flex flex-wrap items-end gap-2 border-t border-line py-3 first:border-t-0">
                  <form action={renameCategory} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <label className={labelCls}>Name<input className={inputCls} name="name" defaultValue={c.name} maxLength={60} required /></label>
                    <button className={btnGhostCls} type="submit">Rename</button>
                  </form>
                  <span className="pb-2 text-sm text-muted">{n === 0 ? 'Not used yet' : `Used by ${n} record${n === 1 ? '' : 's'}`}</span>
                  {n === 0 && (
                    <form action={deleteCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="pb-2 text-sm text-bad underline" type="submit">Delete</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Built-in categories</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {groupCategories(builtIn).map((g) => (
            <div key={g.label}>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{g.label}</h3>
              <p className="text-sm">{g.items.map((c) => c.name).join(', ')}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
