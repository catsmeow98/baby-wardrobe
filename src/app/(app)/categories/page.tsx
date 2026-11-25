import type { Metadata } from 'next';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { addCategory, addGroup, deleteCategory, deleteGroup, moveCategory, renameCategory, renameGroup } from './actions';

export const metadata: Metadata = { title: 'Items and categories' };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const myItems = ctx.categories.filter((c) => c.owner_id !== null);
  const myGroups = ctx.groups.filter((g) => g.owner_id !== null);
  const builtInGroups = ctx.groups.filter((g) => g.owner_id === null);

  // How many records use each of the person's own items. An item in use cannot be deleted.
  const [{ data: items }, { data: goals }, { data: shop }] = await Promise.all([
    ctx.supabase.from('inventory_items').select('category_id'),
    ctx.supabase.from('wardrobe_goals').select('category_id'),
    ctx.supabase.from('shopping_items').select('category_id'),
  ]);
  const uses = new Map<string, number>();
  for (const r of [...(items ?? []), ...(goals ?? []), ...(shop ?? [])] as { category_id: string }[]) uses.set(r.category_id, (uses.get(r.category_id) ?? 0) + 1);
  const itemsIn = (groupId: string) => ctx.categories.filter((c) => c.group_id === groupId);

  const groupSelect = (name: string, value?: string) => (
    <select className={inputCls} name={name} defaultValue={value ?? builtInGroups[0]?.id} required>
      {ctx.groups.map((g) => <option key={g.id} value={g.id}>{g.name}{g.owner_id ? ' (yours)' : ''}</option>)}
    </select>
  );

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Items and categories</h1>
        <p className="text-muted">
          A category, like Sleep, holds items, like Sleep sack. Add your own items to any category, or add your own categories. Yours appear in every picker
          and on the Goals page. The goal survey only plans for the built-in items.
        </p>
      </div>
      <FormMessage error={sp.error} message={sp.ok} />

      <div className="grid gap-4 sm:grid-cols-2">
        <form action={addCategory} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-lg font-bold">Add an item</h2>
          <label className={labelCls}>Item<input className={inputCls} name="name" maxLength={60} placeholder="For example, Costume" required /></label>
          <label className={labelCls}>In category{groupSelect('groupId')}</label>
          <div><button className={btnCls} type="submit">Add item</button></div>
        </form>
        <form action={addGroup} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-lg font-bold">Add a category</h2>
          <label className={labelCls}>Category<input className={inputCls} name="name" maxLength={60} placeholder="For example, Special occasions" required /></label>
          <p className="text-xs text-muted">A new category starts empty. Add items to it with the form on the left.</p>
          <div><button className={btnCls} type="submit">Add category</button></div>
        </form>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-1 font-display text-lg font-bold">Your categories</h2>
        {myGroups.length === 0 ? (
          <p className="py-3 text-sm text-muted">None yet.</p>
        ) : (
          <ul>
            {myGroups.map((g) => {
              const n = itemsIn(g.id).length;
              return (
                <li key={g.id} className="flex flex-wrap items-end gap-2 border-t border-line py-3 first:border-t-0">
                  <form action={renameGroup} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={g.id} />
                    <label className={labelCls}>Name<input className={inputCls} name="name" defaultValue={g.name} maxLength={60} required /></label>
                    <button className={btnGhostCls} type="submit">Rename</button>
                  </form>
                  <span className="pb-2 text-sm text-muted">{n === 0 ? 'No items' : `${n} item${n === 1 ? '' : 's'}`}</span>
                  {n === 0 && (
                    <form action={deleteGroup}>
                      <input type="hidden" name="id" value={g.id} />
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
        <h2 className="mb-1 font-display text-lg font-bold">Your items</h2>
        {myItems.length === 0 ? (
          <p className="py-3 text-sm text-muted">None yet.</p>
        ) : (
          <ul>
            {myItems.map((c) => {
              const n = uses.get(c.id) ?? 0;
              return (
                <li key={c.id} className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0">
                  <div className="flex flex-wrap items-end gap-2">
                    <form action={renameCategory} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <label className={labelCls}>Name<input className={inputCls} name="name" defaultValue={c.name} maxLength={60} required /></label>
                      <button className={btnGhostCls} type="submit">Rename</button>
                    </form>
                    <form action={moveCategory} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <label className={labelCls}>Category{groupSelect('groupId', c.group_id)}</label>
                      <button className={btnGhostCls} type="submit">Move</button>
                    </form>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted">{n === 0 ? 'Not used yet' : `Used by ${n} record${n === 1 ? '' : 's'}`}</span>
                    {n === 0 && (
                      <form action={deleteCategory}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-bad underline" type="submit">Delete</button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Built-in categories and items</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {builtInGroups.map((g) => (
            <div key={g.id}>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{g.name}</h3>
              <p className="text-sm">{itemsIn(g.id).filter((c) => c.owner_id === null).map((c) => c.name).join(', ') || 'No built-in items'}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
