import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { NoChild } from '@/components/no-child';
import { Pill } from '@/components/pill';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { sizeName } from '@/lib/db';
import { fitWord, sizeFor, transition, MAX_AGE_MONTHS } from '@/lib/domain';
import { forecastFor, loadBrands, loadMeasurements, todayIso } from '@/lib/forecast-data';
import { ForecastChart } from '@/components/forecast-chart';
import type { Sex } from '@/lib/domain';
import { addMeasurement, clearRatings, deleteMeasurement, saveBrandOffset } from './actions';

export const metadata: Metadata = { title: 'Forecast' };

const month = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}`;
const HORIZONS = [6, 12, 18, 24];

export default async function ForecastPage({ searchParams }: { searchParams: Promise<{ brand?: string; h?: string; error?: string; ok?: string; brandError?: string; brandOk?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  const child = ctx.active;
  const horizon = HORIZONS.includes(Number(sp.h)) ? Number(sp.h) : 12;

  const [measurements, brands] = await Promise.all([loadMeasurements(ctx, child.id), loadBrands(ctx)]);
  const brand = brands.find((b) => b.id === sp.brand) ?? null;
  const offset = brand ? brand.offset : 0;
  const f = forecastFor(ctx, measurements, horizon);
  const t = f ? transition(f, offset) : null;
  const nameOf = (order: number) => {
    const s = ctx.sizeByOrder.get(order);
    return s ? sizeName(s) : '';
  };
  // The charts to compare: the standard one, and each brand whose fit differs from it.
  const charts = f ? [{ id: null as string | null, name: 'Standard US chart', offset: 0 }, ...brands.filter((b) => Math.abs(b.offset) >= 0.01).map((b) => ({ id: b.id as string | null, name: `${b.name}, ${b.offset > 0 ? 'runs large' : 'runs small'}`, offset: b.offset }))] : [];
  const href = (b: string | null, h: number) => `/forecast?${b ? `brand=${b}&` : ''}h=${h}`;
  const ready = Boolean(child.birth_date && child.growth_reference);

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">{child.name}&apos;s size forecast</h1>
        <p className="text-muted">Estimates which sizes {child.name} may need over the coming months.</p>
      </div>
      <FormMessage error={sp.error} message={sp.ok} />

      <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">
        This is an estimate, not a prediction. It uses the WHO growth standard and Carter&apos;s size chart, but children change percentiles and brands size differently. Check fit before buying ahead.
      </p>

      {!ready && (
        <div className="rounded-xl border border-dashed border-line p-5">
          <p className="mb-3">To place measurements on a growth curve, {child.name} needs a birth date and a growth reference.</p>
          <Link className={btnGhostCls} href="/account#children">Edit {child.name}</Link>
        </div>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Measurements</h2>
        <form action={addMeasurement} className="mb-3 flex flex-wrap items-end gap-2">
          <label className={labelCls}>Date<input className={inputCls} type="date" name="date" defaultValue={todayIso()} max={todayIso()} required /></label>
          <label className={labelCls}>Length (inches)<input className={`${inputCls} w-28`} type="number" name="length" min={10} max={60} step="0.25" inputMode="decimal" required /></label>
          <button className={btnCls} type="submit">Add</button>
        </form>
        {measurements.length === 0 ? (
          <p className="text-sm text-muted">No measurements yet. Add at least one to see a forecast. The latest two are used.</p>
        ) : (
          <ul>
            {[...measurements].reverse().map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
                <span>{new Date(`${m.date}T00:00:00Z`).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })} <b className="tabular-nums">{m.lengthIn} in</b></span>
                <form action={deleteMeasurement}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-sm text-bad underline" type="submit">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ready && measurements.length > 0 && !f && (
        <p className="rounded-xl border border-dashed border-line p-5 text-muted">
          None of the measurements fall between birth and {MAX_AGE_MONTHS} months, which is the range the growth reference covers.
        </p>
      )}

      {f && t && (
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold">Where {child.name} is tracking</h2>
            <span className="text-sm text-muted">{f.percentile}th percentile for length</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {charts.map((c) => {
              const ct = transition(f, c.offset);
              const on = (brand?.id ?? null) === c.id;
              return (
                <Link key={c.id ?? 'standard'} href={href(c.id, horizon)} aria-current={on ? 'true' : undefined}
                  className={`flex flex-col gap-1 rounded-xl border p-4 ${on ? 'border-accent ring-1 ring-accent' : 'border-line'}`}>
                  <span className="text-xs uppercase tracking-wide text-muted">{c.name}</span>
                  <b className="font-display text-2xl">{nameOf(ct.now)}</b>
                  <span className="text-sm text-muted">
                    {ct.next ? <>Next: <b className="text-ink">{nameOf(ct.next.size)}</b> around {month(ct.next.date)}</> : <>Stays in this size through {month(ct.end)}</>}
                  </span>
                </Link>
              );
            })}
          </div>
          <ForecastChart f={f} sex={child.growth_reference as Sex} offset={offset} sizeLabel={nameOf} />
          <p className="text-sm text-muted">
            Grey lines are the 3rd, 50th and 97th percentiles. Dots are measurements. The dashed line is the projection and the shaded band its likely range, which widens as time passes since the last measurement. Orange dashed lines show where the {brand ? brand.name : 'standard US'} chart moves up a size; tap a card to switch charts.
          </p>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Brand chart">
            <span className="text-sm text-muted">Size chart</span>
            <Link href={href(null, horizon)} aria-current={!brand ? 'true' : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${!brand ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>Standard</Link>
            {brands.map((b) => (
              <Link key={b.id} href={href(b.id, horizon)} aria-current={brand?.id === b.id ? 'true' : undefined}
                className={`rounded-full border px-3 py-1 text-sm ${brand?.id === b.id ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>{b.name}</Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Months ahead">
            <span className="text-sm text-muted">Look ahead</span>
            {HORIZONS.map((h) => (
              <Link key={h} href={href(brand?.id ?? null, h)} aria-current={h === horizon ? 'true' : undefined}
                className={`rounded-full border px-3 py-1 text-sm ${h === horizon ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>{h} months</Link>
            ))}
          </div>

          <p>
            Length is around the <b>{f.percentile}th percentile</b> on the {child.growth_reference} reference.{' '}
            {t.next
              ? <>On the {brand ? `${brand.name}` : 'standard'} chart, {child.name} is likely to move into <b>{nameOf(t.next.size)}</b> around <b>{month(t.next.date)}</b>.</>
              : <>On the {brand ? `${brand.name}` : 'standard'} chart, {child.name} stays in <b>{nameOf(t.now)}</b> through {month(t.end)}.</>}
          </p>
          {f.rows[f.rows.length - 1].age >= MAX_AGE_MONTHS - 0.01 && <p className="text-sm text-muted">The growth reference ends at {MAX_AGE_MONTHS} months, so the forecast stops there.</p>}

          <details>
          <summary className="cursor-pointer text-sm font-medium text-accent">Month by month</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted"><tr><th className="py-1.5 pr-3 font-medium">Month</th><th className="pr-3 font-medium">Age</th><th className="pr-3 font-medium">Likely length</th><th className="font-medium">Size</th></tr></thead>
              <tbody>
                {f.rows.map((r, i) => {
                  const size = sizeFor(r.mid, offset);
                  const changed = i > 0 && size !== sizeFor(f.rows[i - 1].mid, offset);
                  return (
                    <tr key={r.month} className="border-t border-line">
                      <td className="py-1.5 pr-3">{month(r.date)}{r.month === 0 ? ' (now)' : ''}</td>
                      <td className="pr-3 tabular-nums">{r.age.toFixed(1)} mo</td>
                      <td className="pr-3 tabular-nums">{r.low.toFixed(1)} to {r.high.toFixed(1)} in</td>
                      <td>{nameOf(size)} {changed && <Pill tone="notyet">New size</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </details>
          {child.current_size_id && ctx.currentSize !== null && ctx.currentSize !== t.now && (
            <p className="text-sm text-muted">
              {child.name} is set to {nameOf(ctx.currentSize)}, but this chart puts their current length in {nameOf(t.now)}. Update the measurement or the size if one is out of date.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Brand fit</h2>
        <p className="my-2 text-sm text-muted">
          Rate how items fit on the item page and the forecast adjusts for each brand. Each rating moves a brand by up to 0.75 in, and a brand with only one or two ratings moves less. The base offset is a starting adjustment you set yourself:
          positive for a brand that runs large, negative for one that runs small.
        </p>
        {brands.length === 0 ? (
          <p className="py-3 text-sm text-muted">No brands yet. Add a brand to an item in your closet and it will show up here.</p>
        ) : (
          <ul>
            {brands.map((b) => (
              <li key={b.id} className="grid gap-2 border-t border-line py-3 first:border-t-0 sm:grid-cols-[minmax(130px,1fr)_minmax(160px,1.2fr)_auto] sm:items-center">
                <div>
                  <b>{b.name}</b>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {b.stats.n > 0 ? <Pill tone={b.stats.adjust <= -0.15 ? 'warn' : b.stats.adjust >= 0.15 ? 'notyet' : 'good'}>{fitWord(b.stats.adjust)}</Pill> : <Pill>No ratings</Pill>}
                  </div>
                </div>
                <div className="text-sm text-muted">
                  {b.stats.n > 0 ? <>{b.stats.small} small, {b.stats.true} true, {b.stats.large} large<br />Ratings add {signed(b.stats.adjust)} in</> : 'Rate an item from this brand to start.'}
                  {b.baseOffset !== 0 && <><br />Base offset {signed(b.baseOffset)} in</>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {b.editable ? (
                    <form action={saveBrandOffset} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={b.id} />
                      <input className={`${inputCls} w-20`} type="number" name="offset" step="0.25" min={-3} max={3} defaultValue={b.baseOffset} aria-label={`Base offset for ${b.name} in inches`} />
                      <button className={btnGhostCls} type="submit">Save</button>
                    </form>
                  ) : <span className="text-sm text-muted">Shared brand</span>}
                  {b.stats.n > 0 && (
                    <form action={clearRatings}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-sm text-bad underline" type="submit">Clear ratings</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

    </>
  );
}
