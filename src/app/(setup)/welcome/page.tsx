import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { loadSetupFacts } from '@/lib/setup-data';
import { todayIso } from '@/lib/forecast-data';
import { sizeName, type SizeRow } from '@/lib/db';
import { searchPlaces, type Place } from '@/lib/weather';
import { STEP_ORDER, STEP_TITLE, STEP_WHY, TASK_STEPS, neighbours, parseStep, setupState, stepFraction, stepPath, type StepId, type TaskStep } from '@/lib/setup';
import { FormMessage } from '@/components/form-message';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { addWelcomeChild, addWelcomeMeasurement, editWelcomeChild, saveWelcomeLocation } from './actions';

export const metadata: Metadata = { title: 'Set up' };

type SP = { step?: string; place?: string; ok?: string; error?: string; saved?: string };
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GOALS_BACK = encodeURIComponent('/welcome?step=goals');

/** The bar fixed to the bottom of every screen. Next either links on or submits the form with the given id. */
function Bar({ back, skip, next }: { back: StepId | null; skip?: StepId | null; next: { label: string; href: string } | { label: string; formId: string } }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg px-3 pt-3 pb-[calc(0.75rem+var(--safe-bottom))]">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        {back ? <Link href={stepPath(back)} className={btnGhostCls}>Back</Link> : <span />}
        <span className="flex-1" />
        {skip && <Link href={stepPath(skip)} className="text-sm text-muted underline">Skip this step</Link>}
        {'href' in next ? (
          <Link href={next.href} className={btnCls}>{next.label}</Link>
        ) : (
          <button type="submit" form={next.formId} className={btnCls}>{next.label}</button>
        )}
      </div>
    </div>
  );
}

function Why({ step }: { step: TaskStep }) {
  return <p className="rounded-xl bg-accent-soft p-3 text-sm"><b>How this helps. </b>{STEP_WHY[step]}</p>;
}

export default async function WelcomePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const step = parseStep(sp.step);
  const ctx = await getContext();
  const facts = await loadSetupFacts(ctx);
  const state = setupState(facts);
  const { prev, next } = neighbours(step);
  const index = STEP_ORDER.indexOf(step);
  const bySize = new Map(ctx.sizes.map((s) => [s.id, s]));
  const nextOpen: StepId = next ?? 'closet';
  // The label on a step's Next button: it reads "Skip" when the step has nothing saved yet.
  const nextLabel = (done: boolean) => (done ? 'Next' : 'Skip');

  let matches: Place[] = [];
  let searchError = '';
  if (step === 'location' && sp.place?.trim()) {
    try {
      matches = await searchPlaces(sp.place);
      if (matches.length === 0) searchError = 'No places matched. Try a city name, like Boston or Boston, MA. Only cities of about 15,000 people or more are listed, so try a larger nearby town.';
    } catch {
      searchError = 'The place search is not available right now. Try again in a minute.';
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Step {index + 1} of {STEP_ORDER.length} · {STEP_TITLE[step]}</span>
          <details className="relative text-right">
            <summary className="cursor-pointer list-none underline">All steps</summary>
            <ul className="absolute right-0 z-10 mt-1 flex w-56 flex-col gap-1 rounded-lg border border-line bg-surface p-2 text-left text-sm shadow">
              {STEP_ORDER.map((s) => (
                <li key={s}>
                  <Link href={stepPath(s)} className={`flex justify-between rounded px-2 py-1 hover:bg-accent-soft ${s === step ? 'font-bold' : ''}`}>
                    <span>{STEP_TITLE[s]}</span>
                    <span aria-label={s !== 'welcome' && state.done[s as TaskStep] ? 'done' : undefined}>{s !== 'welcome' && state.done[s as TaskStep] ? '✓' : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={STEP_ORDER.length} aria-valuenow={index + 1} aria-label="Setup progress" className="h-2 overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${stepFraction(step) * 100}%` }} />
        </div>
      </div>

      <FormMessage error={sp.error} message={sp.ok} />

      {step === 'welcome' && (
        <>
          <div>
            <h1 className="font-display text-2xl font-bold">Let&apos;s set up your baby wardrobe</h1>
            <p className="mt-1 text-muted">About three minutes. Every step is optional, and you can come back any time from Account.</p>
          </div>
          <ul className="flex flex-col gap-2">
            {TASK_STEPS.map((s) => (
              <li key={s} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
                <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${state.done[s] ? 'bg-accent text-accent-ink' : 'border border-line text-muted'}`}>{state.done[s] ? '✓' : TASK_STEPS.indexOf(s) + 1}</span>
                <span>
                  <b>{STEP_TITLE[s]}</b>{state.done[s] ? <span className="text-sm text-muted"> · done</span> : null}
                  <span className="block text-sm text-muted">{STEP_WHY[s]}</span>
                </span>
              </li>
            ))}
          </ul>
          <Bar back={null} next={{ label: state.doneCount === 0 ? 'Start' : 'Continue', href: stepPath(state.next ?? 'location') }} />
        </>
      )}

      {step === 'location' && (
        <>
          <h1 className="font-display text-2xl font-bold">Where do you live?</h1>
          <Why step="location" />
          {ctx.settings.placeName && ctx.settings.monthClasses ? (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
              <p className="font-bold">{ctx.settings.placeName}</p>
              <ul className="flex flex-wrap gap-1.5" aria-label="How each month feels">
                {ctx.settings.monthClasses.map((c, i) => <li key={MONTH_SHORT[i]} className="rounded-md bg-line px-2 py-0.5 text-xs">{MONTH_SHORT[i]} · {c}</li>)}
              </ul>
              <p className="text-sm text-muted">Search below to change it.</p>
            </div>
          ) : null}
          <form method="get" action="/welcome" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="step" value="location" />
            <label className={`${labelCls} flex-1`}>City
              <input className={inputCls} type="search" name="place" defaultValue={sp.place ?? ''} maxLength={80} placeholder="Boston, or Boston, MA" />
            </label>
            <button className={btnGhostCls} type="submit">Search</button>
          </form>
          <p className="text-xs text-muted">Only the place name, a rounded location and twelve month labels are saved.</p>
          {searchError && <p role="status" className="text-sm text-muted">{searchError}</p>}
          {matches.length > 0 && (
            <ul className="flex flex-col gap-2">
              {matches.map((m) => (
                <li key={`${m.latitude},${m.longitude}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2">
                  <span className="text-sm">{m.label}</span>
                  <form action={saveWelcomeLocation}>
                    <input type="hidden" name="label" value={m.label} />
                    <input type="hidden" name="latitude" value={m.latitude} />
                    <input type="hidden" name="longitude" value={m.longitude} />
                    <button className={btnCls} type="submit">Use this</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <Bar back={prev} next={{ label: nextLabel(state.done.location), href: stepPath(nextOpen) }} />
        </>
      )}

      {step === 'child' && (
        <>
          <h1 className="font-display text-2xl font-bold">{ctx.children.length === 0 ? 'Tell us about your child' : 'Your children'}</h1>
          <Why step="child" />
          {ctx.sizes.length === 0 && (
            <p role="alert" className="rounded-lg bg-warn-soft p-3 text-sm text-warn">The size list is empty, so sizes cannot be chosen. In Supabase, run the file 20260101000002_seed_defaults.sql once.</p>
          )}
          {ctx.children.length > 0 && (
            <ul className="flex flex-col gap-2">
              {ctx.children.map((c) => {
                const size = c.current_size_id ? bySize.get(c.current_size_id) : undefined;
                return (
                  <li key={c.id} className="rounded-xl border border-line bg-surface p-3">
                    <p className="font-bold">{c.name}</p>
                    <p className="text-sm text-muted">{size ? `Size ${sizeName(size)}` : 'Size not set'}{c.birth_date ? ` · born ${c.birth_date}` : ''}{c.growth_reference ? ` · ${c.growth_reference} growth chart` : ''}</p>
                    <details className="mt-2 text-sm">
                      <summary className={`${btnGhostCls} cursor-pointer list-none`}>Edit</summary>
                      <form action={editWelcomeChild} className="mt-2 flex flex-col gap-3">
                        <input type="hidden" name="id" value={c.id} />
                        <label className={labelCls}>Name<input className={inputCls} name="name" defaultValue={c.name} maxLength={80} required /></label>
                        <label className={labelCls}>Birth date<input className={inputCls} type="date" name="birthDate" defaultValue={c.birth_date ?? ''} /></label>
                        <label className={labelCls}>Growth chart
                          <select className={inputCls} name="growthReference" defaultValue={c.growth_reference ?? ''}>
                            <option value="">Not set</option><option value="girls">Girls</option><option value="boys">Boys</option>
                          </select>
                        </label>
                        <label className={labelCls}>Current size
                          <select className={inputCls} name="currentSizeId" defaultValue={c.current_size_id ?? ''}>
                            <option value="">Not set</option>
                            {ctx.sizes.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}
                          </select>
                        </label>
                        <div><button className={btnCls} type="submit">Save changes</button></div>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
          {ctx.children.length === 0 ? (
            <form id="step-form" action={addWelcomeChild} className="flex flex-col gap-4">
              <ChildFields sizes={ctx.sizes} />
            </form>
          ) : (
            <details className="rounded-xl border border-line bg-surface p-3">
              <summary className="cursor-pointer font-bold">Add another child</summary>
              <form action={addWelcomeChild} className="mt-3 flex flex-col gap-4">
                <input type="hidden" name="again" value="1" />
                <ChildFields sizes={ctx.sizes} />
                <div><button className={btnCls} type="submit">Add child</button></div>
              </form>
            </details>
          )}
          <Bar
            back={prev}
            skip={ctx.children.length === 0 ? next : null}
            next={ctx.children.length === 0 ? { label: 'Save and continue', formId: 'step-form' } : { label: 'Next', href: stepPath(nextOpen) }}
          />
        </>
      )}

      {step === 'measure' && (
        <>
          <h1 className="font-display text-2xl font-bold">How long is your baby?</h1>
          <Why step="measure" />
          {ctx.children.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Add a child first, then come back for this step. <Link className="underline" href={stepPath('child')}>Add a child</Link></p>
          ) : (
            <>
              {ctx.children.some((c) => !c.birth_date || !c.growth_reference) && (
                <p role="status" className="rounded-lg bg-warn-soft p-3 text-sm text-warn">
                  The forecast also needs a birth date and a growth chart for each child. <Link className="underline" href={stepPath('child')}>Add them on the child step</Link>.
                </p>
              )}
              <form id="step-form" action={addWelcomeMeasurement} className="flex flex-col gap-4">
                {ctx.children.length > 1 ? (
                  <label className={labelCls}>Child
                    <select className={inputCls} name="childId" defaultValue={ctx.active?.id}>
                      {ctx.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                ) : (
                  <input type="hidden" name="childId" value={ctx.children[0].id} />
                )}
                <label className={labelCls}>Length (inches)
                  <input className={inputCls} type="number" name="length" min={10} max={60} step="0.25" inputMode="decimal" required />
                  <span className="text-xs">From the latest checkup is fine. You can add more later on the Forecast page.</span>
                </label>
                <label className={labelCls}>Measured on
                  <input className={inputCls} type="date" name="date" defaultValue={todayIso()} max={todayIso()} required />
                </label>
              </form>
              {facts.measurements > 0 && <p className="text-sm text-muted">You already have {facts.measurements} measurement{facts.measurements === 1 ? '' : 's'}. Adding another is fine.</p>}
            </>
          )}
          <Bar
            back={prev}
            skip={next}
            next={ctx.children.length > 0 ? { label: 'Save and continue', formId: 'step-form' } : { label: 'Next', href: stepPath(nextOpen) }}
          />
        </>
      )}

      {step === 'goals' && (
        <>
          <h1 className="font-display text-2xl font-bold">How many of everything?</h1>
          <Why step="goals" />
          {sp.saved === '1' && <p role="status" className="rounded-lg bg-accent-soft p-3 text-sm">Goals saved. You can go on to the next step.</p>}
          {facts.goals > 0 && sp.saved !== '1' && <p className="text-sm text-muted">You already have {facts.goals} goals. Retaking the survey updates the sizes you tick.</p>}
          {ctx.children.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Add a child first. <Link className="underline" href={stepPath('child')}>Add a child</Link></p>
          ) : (
            <div className="flex flex-col gap-2">
              <Link href={`/survey?back=${GOALS_BACK}`} className={btnCls}>{facts.goals > 0 ? 'Retake the goal survey' : 'Open the goal survey'}</Link>
              <p className="text-xs text-muted">It takes a few minutes. When you save, you come straight back here.</p>
            </div>
          )}
          <Bar back={prev} next={{ label: nextLabel(state.done.goals), href: stepPath(nextOpen) }} />
        </>
      )}

      {step === 'closet' && (
        <>
          <h1 className="font-display text-2xl font-bold">Add what you have</h1>
          <Why step="closet" />
          <ul className="flex flex-col gap-3">
            <li className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
              <b>Add one item</b>
              <span className="text-sm text-muted">Pick an item type from the icons, say what size it fits, and add a photo if you like.</span>
              <Link href="/closet/new" className={`${btnGhostCls} self-start`}>Add an item</Link>
            </li>
            <li className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
              <b>Add many at once</b>
              <span className="text-sm text-muted">A pile of similar clothes, such as ten pairs of socks, goes in as one entry with a quantity.</span>
              <Link href="/closet/bulk" className={`${btnGhostCls} self-start`}>Add several items</Link>
            </li>
            <li className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
              <b>Photos</b>
              <span className="text-sm text-muted">Photos help you find things fast. The background is removed on your device so the item stands out, and you can turn that off in Account.</span>
            </li>
          </ul>
          {facts.items > 0 && <p className="text-sm text-muted">Your closet already has items.</p>}
          <Bar back={prev} next={{ label: 'Go to my dashboard', href: '/dashboard' }} />
        </>
      )}
    </>
  );
}

function ChildFields({ sizes }: { sizes: SizeRow[] }) {
  return (
    <>
      <label className={labelCls}>Name
        <input className={inputCls} name="name" maxLength={80} required />
      </label>
      <label className={labelCls}>Birth date, or due date
        <input className={inputCls} type="date" name="birthDate" />
        <span className="text-xs">Used for size forecasts.</span>
      </label>
      <label className={labelCls}>Growth chart
        <select className={inputCls} name="growthReference" defaultValue="">
          <option value="">Not set</option><option value="girls">Girls</option><option value="boys">Boys</option>
        </select>
        <span className="text-xs">Picks which published growth curve the forecast compares against.</span>
      </label>
      <label className={labelCls}>Current size
        <select className={inputCls} name="currentSizeId" defaultValue="">
          <option value="">Not set</option>
          {sizes.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}
        </select>
        <span className="text-xs">Used to skip sizes already outgrown in the goal survey.</span>
      </label>
    </>
  );
}
