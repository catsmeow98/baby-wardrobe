import type { Metadata } from 'next';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { safeNext } from '@/lib/auth/redirect';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { sizeName } from '@/lib/db';
import { createChild, deleteChild, updateChild } from '../children/actions';
import { deleteAccount } from './actions';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const dest = safeNext(next, '');
  const ctx = await getContext();
  const bySize = new Map(ctx.sizes.map((s) => [s.id, s]));

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Account</h1>
        <p className="text-muted">Signed in as {ctx.user.email}.</p>
      </div>
      <FormMessage error={error} />

      <section id="children" className="flex scroll-mt-4 flex-col gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Children</h2>
          <p className="text-sm text-muted">Each child has their own closet, goals, and shopping list.</p>
        </div>
        {ctx.sizes.length === 0 && (
          <p role="alert" className="rounded-lg bg-warn-soft p-3 text-sm text-warn">
            The size list is empty, so sizes cannot be chosen. In Supabase, run the file 20260101000002_seed_defaults.sql once.
          </p>
        )}

        {ctx.children.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {ctx.children.map((c) => {
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
                          {ctx.sizes.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}
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
          <h3 className="font-display text-lg font-bold">Add a child</h3>
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
                {ctx.sizes.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}
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
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-bad p-4">
        <h2 className="font-display text-lg font-bold text-bad">Delete account</h2>
        <p className="text-sm">
          This permanently deletes your account and everything in it: every child, closet item, photo, goal, shopping entry, measurement and brand.
          It cannot be undone and we cannot recover it afterward.
        </p>
        <form action={deleteAccount} className="flex flex-col gap-3">
          <label className={labelCls}>
            Type DELETE to confirm
            <input className={`${inputCls} max-w-xs`} name="confirm" autoComplete="off" autoCapitalize="characters" required />
          </label>
          <div><button className="rounded-lg bg-bad px-4 py-2 font-bold text-white" type="submit">Delete my account</button></div>
        </form>
      </section>
    </>
  );
}
