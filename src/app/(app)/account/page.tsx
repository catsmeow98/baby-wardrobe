import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { safeNext } from '@/lib/auth/redirect';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { sizeName } from '@/lib/db';
import { createChild, deleteChild, updateChild } from '../children/actions';
import { searchPlaces, type Place } from '@/lib/weather';
import { clearLocation, cleanupPhotos, deleteAccount, markOutgrown, saveLocation, savePhotoSettings } from './actions';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; next?: string; outgrown?: string; place?: string }> }) {
  const { error, ok, next, outgrown, place } = await searchParams;
  const dest = safeNext(next, '');
  const ctx = await getContext();
  const bySize = new Map(ctx.sizes.map((s) => [s.id, s]));

  let matches: Place[] = [];
  let searchError = '';
  if (place?.trim()) {
    try {
      matches = await searchPlaces(place);
      if (matches.length === 0) searchError = 'No places matched. Try a city name, like Boston or Boston, MA. Only cities of about 15,000 people or more are listed, so try a larger nearby town.';
    } catch {
      searchError = 'The place search is not available right now. Try again in a minute.';
    }
  }
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // After a size increase: active items whose fit range ends below the new current size.
  const grown = outgrown && z.string().uuid().safeParse(outgrown).success ? ctx.children.find((c) => c.id === outgrown) : undefined;
  const grownSize = grown?.current_size_id ? bySize.get(grown.current_size_id) : undefined;
  let tooSmall = 0;
  if (grown && grownSize) {
    const below = new Set(ctx.sizes.filter((s) => s.sort_order < grownSize.sort_order).map((s) => s.id));
    const { data } = await ctx.supabase.from('inventory_items').select('fit_to_size_id').eq('child_id', grown.id).eq('status', 'active');
    tooSmall = ((data ?? []) as { fit_to_size_id: string | null }[]).filter((r) => r.fit_to_size_id && below.has(r.fit_to_size_id)).length;
  }

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Account</h1>
        <p className="text-muted">Signed in as {ctx.user.email}.</p>
      </div>
      <FormMessage error={error} message={ok} />

      <section id="setup" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <div>
          <h2 className="font-display text-lg font-bold">Setup guide</h2>
          <p className="text-sm text-muted">Location, children, a first measurement, goals and your closet, one question at a time. Run it again any time to change your answers.</p>
        </div>
        <Link className={btnGhostCls} href="/welcome">Open the setup guide</Link>
      </section>

      {grown && grownSize && tooSmall > 0 && (
        <section role="status" className="flex flex-col gap-3 rounded-xl border border-accent bg-accent-soft p-4">
          <h2 className="font-display text-lg font-bold">{grown.name} moved up to {sizeName(grownSize)}</h2>
          <p className="text-sm">
            {tooSmall} active item{tooSmall === 1 ? '' : 's'} only fit{tooSmall === 1 ? 's' : ''} smaller sizes. Tidy {tooSmall === 1 ? 'it' : 'them'} now, or leave {tooSmall === 1 ? 'it' : 'them'} as is. You can change any item later.
          </p>
          <div className="flex flex-wrap gap-2">
            {(['outgrown', 'stored'] as const).map((mode) => (
              <form key={mode} action={markOutgrown}>
                <input type="hidden" name="childId" value={grown.id} />
                <input type="hidden" name="mode" value={mode} />
                <button className={mode === 'outgrown' ? btnCls : btnGhostCls} type="submit">{mode === 'outgrown' ? 'Mark as outgrown' : 'Move to stored'}</button>
              </form>
            ))}
            <a className={btnGhostCls} href="/account#children">Leave as is</a>
          </div>
        </section>
      )}

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

      <section id="photos" className="flex scroll-mt-4 flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Photos</h2>
        <form action={savePhotoSettings} className="flex flex-col gap-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="removeBackground" defaultChecked={ctx.settings.removeBackground} className="mt-1" />
            <span>
              Remove the background from new photos
              <span className="block text-muted">Done on your device when you add a photo, so the item stands out. The first photo downloads about 200 MB of tools, once (best on Wi-Fi). You can still go back to the original while editing a photo.</span>
            </span>
          </label>
          <div><button className={btnGhostCls} type="submit">Save</button></div>
        </form>
        <p className="text-sm"><Link className="text-accent underline" href="/cutout-lab">Test background removal (Cutout lab)</Link></p>
      </section>

      <section id="location" className="flex scroll-mt-4 flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Location</h2>
        <p className="text-sm text-muted">Used to tell cold, cool, mild and warm months apart when the survey plans outerwear and seasonal clothing. Only the place name, a rounded location and twelve labels are saved. One location for the whole account.</p>
        {ctx.settings.placeName && ctx.settings.monthClasses ? (
          <div className="flex flex-col gap-2">
            <p className="font-bold">{ctx.settings.placeName}</p>
            <ul className="flex flex-wrap gap-1.5" aria-label="How each month feels">
              {ctx.settings.monthClasses.map((c, i) => <li key={MONTH_SHORT[i]} className="rounded-md bg-line px-2 py-0.5 text-xs">{MONTH_SHORT[i]} · {c}</li>)}
            </ul>
            <form action={clearLocation}><button className={btnGhostCls} type="submit">Remove location</button></form>
          </div>
        ) : (
          <p className="text-sm">No location set. The survey asks about hot summers and cold winters instead.</p>
        )}
        <form method="get" action="/account#location" className="flex flex-wrap items-end gap-2">
          <label className={labelCls}>City
            <input className={inputCls} type="search" name="place" defaultValue={place ?? ''} maxLength={80} placeholder="Boston, or Boston, MA" />
          </label>
          <button className={btnGhostCls} type="submit">Search</button>
        </form>
        {searchError && <p role="status" className="text-sm text-muted">{searchError}</p>}
        {matches.length > 0 && (
          <ul className="flex flex-col gap-2">
            {matches.map((m) => (
              <li key={`${m.latitude},${m.longitude}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2">
                <span className="text-sm">{m.label}</span>
                <form action={saveLocation}>
                  <input type="hidden" name="label" value={m.label} />
                  <input type="hidden" name="latitude" value={m.latitude} />
                  <input type="hidden" name="longitude" value={m.longitude} />
                  <button className={btnCls} type="submit">Use this place</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">Places from <a className="underline" href="https://www.geonames.org/" rel="noreferrer">GeoNames</a> (CC BY 4.0). Past weather from <a className="underline" href="https://power.larc.nasa.gov/" rel="noreferrer">NASA POWER</a> (CC BY 4.0). Neither endorses this app.</p>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Your data</h2>
        <p className="text-sm text-muted">Download everything as spreadsheet files, for every child.</p>
        <div className="flex flex-wrap gap-2">
          <a className={btnGhostCls} href="/export/closet" download>Download closet (CSV)</a>
          <a className={btnGhostCls} href="/export/goals" download>Download goals (CSV)</a>
        </div>
        <form action={cleanupPhotos} className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <button className={btnGhostCls} type="submit">Clean up unused photos</button>
          <span className="text-sm text-muted">Removes photo files that no item uses, such as ones left by an upload that failed.</span>
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
