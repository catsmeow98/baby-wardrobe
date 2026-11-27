import type { Metadata } from 'next';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { KEPT_STATUSES } from '@/lib/domain';
import { addCategory, addGroup, deleteCategory, deleteGroup, hideGroup, hideItemType, restoreDefaults, saveGroup, saveItemType } from './actions';
import { TypeIcon } from '@/components/item-icon';

export const metadata: Metadata = { title: 'Item types' };

/** Marks a built-in. The person can still rename, move or delete it. */
const Star = () => <span title="Built-in default. You can edit or delete it." aria-label="Built-in default" className="text-warn">★</span>;

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const child = ctx.active;

  // Pieces of each item type in the active child's closet (kept pieces: active, stored, or spares at daycare), and how many
  // records of any kind use each custom item type. A custom item type that is in use cannot be deleted.
  const [{ data: closet }, { data: items }, { data: goals }, { data: shop }] = await Promise.all([
    child
      ? ctx.supabase.from('inventory_items').select('category_id, quantity').eq('child_id', child.id).in('status', [...KEPT_STATUSES])
      : Promise.resolve({ data: [] as { category_id: string; quantity: number }[] }),
    ctx.supabase.from('inventory_items').select('category_id'),
    ctx.supabase.from('wardrobe_goals').select('category_id'),
    ctx.supabase.from('shopping_items').select('category_id'),
  ]);
  const pieces = new Map<string, number>();
  for (const r of (closet ?? []) as { category_id: string; quantity: number }[]) pieces.set(r.category_id, (pieces.get(r.category_id) ?? 0) + r.quantity);
  const uses = new Map<string, number>();
  for (const r of [...(items ?? []), ...(goals ?? []), ...(shop ?? [])] as { category_id: string }[]) uses.set(r.category_id, (uses.get(r.category_id) ?? 0) + 1);

  const typesIn = (groupId: string) => ctx.categories.filter((c) => c.group_id === groupId);
  const piecesIn = (groupId: string) => typesIn(groupId).reduce((n, c) => n + (pieces.get(c.id) ?? 0), 0);
  const total = ctx.categories.reduce((n, c) => n + (pieces.get(c.id) ?? 0), 0);
  const hiddenTypes = ctx.allCategories.filter((c) => c.hidden && c.is_default);
  const hiddenGroups = ctx.allGroups.filter((g) => g.hidden && g.is_default);
  const edited = ctx.allCategories.some((c) => c.is_default && (c.name !== c.base_name || c.hidden)) || ctx.allGroups.some((g) => g.is_default && (g.name !== g.base_name || g.hidden));

  const groupSelect = (name: string, value?: string) => (
    <select className={inputCls} name={name} defaultValue={value ?? ctx.groups[0]?.id} required>
      {ctx.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  );

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Item types and categories</h1>
        <p className="text-muted">
          An item category, like Sleep, holds item types, like Sleep sack. The built-in ones (<Star />) are a starting point: rename, move or delete any of them,
          and add your own. Changes are yours alone. The goal survey plans for the built-in item types you have not deleted.
        </p>
      </div>
      <FormMessage error={sp.error} message={sp.ok} />

      <div className="grid gap-4 sm:grid-cols-2">
        <form action={addCategory} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-lg font-bold">Add an item type</h2>
          <label className={labelCls}>Item type<input className={inputCls} name="name" maxLength={60} placeholder="For example, Costume" required /></label>
          <label className={labelCls}>In item category{groupSelect('groupId')}</label>
          <div><button className={btnCls} type="submit">Add item type</button></div>
        </form>
        <form action={addGroup} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-lg font-bold">Add an item category</h2>
          <label className={labelCls}>Item category<input className={inputCls} name="name" maxLength={60} placeholder="For example, Special occasions" required /></label>
          <p className="text-xs text-muted">A new item category starts empty. Add item types to it with the form on the left.</p>
          <div><button className={btnCls} type="submit">Add item category</button></div>
        </form>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-bold">Your item categories and item types</h2>
        {ctx.groups.map((g) => {
          const types = typesIn(g.id);
          return (
            <details key={g.id} className="rounded-xl border border-line bg-surface">
              <summary className="cursor-pointer px-4 py-3 font-bold">
                {g.is_default && <Star />} {g.name}{' '}
                <span className="text-sm font-normal text-muted">· {types.length} item type{types.length === 1 ? '' : 's'} · {piecesIn(g.id)} piece{piecesIn(g.id) === 1 ? '' : 's'} in the closet</span>
              </summary>
              <div className="flex flex-col gap-3 border-t border-line p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <form action={saveGroup} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={g.id} />
                    <label className={labelCls}>Item category name<input className={inputCls} name="name" defaultValue={g.name} maxLength={60} required /></label>
                    <button className={btnGhostCls} type="submit">Rename</button>
                  </form>
                  {g.is_default ? (
                    <form action={hideGroup}>
                      <input type="hidden" name="id" value={g.id} />
                      <button className="pb-2 text-sm text-bad underline" type="submit">Delete (hides its item types too)</button>
                    </form>
                  ) : types.length === 0 ? (
                    <form action={deleteGroup}>
                      <input type="hidden" name="id" value={g.id} />
                      <button className="pb-2 text-sm text-bad underline" type="submit">Delete</button>
                    </form>
                  ) : null}
                </div>
                <ul>
                  {types.map((c) => {
                    const n = pieces.get(c.id) ?? 0;
                    const used = uses.get(c.id) ?? 0;
                    return (
                      <li key={c.id} className="flex flex-col gap-2 border-t border-line py-3">
                        <div className="flex flex-wrap items-end gap-2">
                          <span className="flex size-10 shrink-0 items-center justify-center self-end rounded-lg bg-line/60 text-accent" title="Icon for this item type"><TypeIcon type={c} size={28} /></span>
                          <form action={saveItemType} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="id" value={c.id} />
                            <label className={labelCls}>{c.is_default ? <><Star /> Item type</> : 'Item type'}<input className={inputCls} name="name" defaultValue={c.name} maxLength={60} required /></label>
                            <label className={labelCls}>Item category{groupSelect('groupId', c.group_id)}</label>
                            <button className={btnGhostCls} type="submit">Save</button>
                          </form>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="font-medium">{n} piece{n === 1 ? '' : 's'} in the closet</span>
                          {c.is_default ? (
                            <form action={hideItemType}>
                              <input type="hidden" name="id" value={c.id} />
                              <button className="text-bad underline" type="submit">Delete</button>
                            </form>
                          ) : used === 0 ? (
                            <form action={deleteCategory}>
                              <input type="hidden" name="id" value={c.id} />
                              <button className="text-bad underline" type="submit">Delete</button>
                            </form>
                          ) : (
                            <span className="text-muted">Used by {used} record{used === 1 ? '' : 's'}, so it cannot be deleted</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {types.length === 0 && <li className="border-t border-line py-3 text-sm text-muted">No item types yet.</li>}
                </ul>
              </div>
            </details>
          );
        })}
      </section>

      {(hiddenTypes.length > 0 || hiddenGroups.length > 0 || edited) && (
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-lg font-bold">Deleted built-ins</h2>
          {hiddenGroups.length + hiddenTypes.length === 0 && <p className="text-sm text-muted">None deleted. You have renamed or moved some built-ins.</p>}
          <ul>
            {hiddenGroups.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 border-t border-line py-2 first:border-t-0">
                <span><Star /> {g.name} <span className="text-sm text-muted">(item category)</span></span>
                <form action={hideGroup}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="restore" value="1" /><button className="text-sm text-accent underline" type="submit">Restore</button></form>
              </li>
            ))}
            {hiddenTypes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 border-t border-line py-2 first:border-t-0">
                <span><Star /> {c.name} <span className="text-sm text-muted">(item type)</span></span>
                <form action={hideItemType}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="restore" value="1" /><button className="text-sm text-accent underline" type="submit">Restore</button></form>
              </li>
            ))}
          </ul>
          <form action={restoreDefaults} className="flex flex-col gap-1">
            <div><button className={btnGhostCls} type="submit">Restore all built-ins to the originals</button></div>
            <p className="text-xs text-muted">This undoes every rename, move and delete of a built-in. Your own item types and categories stay.</p>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-1 font-display text-lg font-bold">Summary</h2>
        <p className="mb-3 text-sm text-muted">
          {ctx.groups.length} item categor{ctx.groups.length === 1 ? 'y' : 'ies'}, {ctx.categories.length} item type{ctx.categories.length === 1 ? '' : 's'}
          {child ? `, ${total} piece${total === 1 ? '' : 's'} in ${child.name}'s closet` : ''}.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {ctx.groups.map((g) => {
            const types = typesIn(g.id);
            const withPieces = types.filter((c) => (pieces.get(c.id) ?? 0) > 0);
            const empty = types.length - withPieces.length;
            return (
              <div key={g.id}>
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{g.name} · {types.length} type{types.length === 1 ? '' : 's'} · {piecesIn(g.id)} piece{piecesIn(g.id) === 1 ? '' : 's'}</h3>
                <p className="text-sm">
                  {withPieces.map((c) => `${c.name} ${pieces.get(c.id)}`).join(', ')}
                  {withPieces.length > 0 && empty > 0 ? ' · ' : ''}
                  {empty > 0 ? <span className="text-muted">{empty} with none yet</span> : null}
                  {types.length === 0 ? <span className="text-muted">No item types yet</span> : null}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
