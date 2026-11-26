import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { LifestyleFields } from '@/components/survey-fields';
import { SurveyBuilder } from '@/components/survey-builder';
import { SurveyResults } from '@/components/survey-results';
import { btnCls } from '@/components/ui';
import { answersToParams, defaultSizes, displaySize, parseAnswers, sizeWindow } from '@/lib/domain';
import { applySurvey } from './actions';
import { safeBackAny } from '@/lib/back';
import { defaultBirthMonth, surveyAll } from './compute';

export const metadata: Metadata = { title: 'Goal survey' };

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SurveyPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const child = ctx.active; // may be null: new accounts can preview suggestions before adding a child
  const answers = parseAnswers((k) => first(sp[k]) ?? null, (k) => {
    const v = sp[k];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  }, defaultBirthMonth(child?.birth_date), defaultSizes(ctx.currentSize));
  const { results, usedForecast, windows, missing, options, gearOptions } = await surveyAll(ctx, answers);
  const qs = answersToParams(answers).toString();
  const back = safeBackAny(first(sp.back), ['/goals', '/welcome'], '/goals');

  return (
    <>
      <div>
        <p className="mb-1 text-sm"><Link className="text-accent underline" href={back}>{back.startsWith('/welcome') ? '← Back to setup' : '← Back to goals'}</Link></p>
        <h1 className="font-display text-2xl font-bold">Goal survey</h1>
        <p className="text-muted">
          Answer a few questions and get suggested goals{child ? ` for ${child.name}` : ''} for the sizes you pick (they start at the current size). You can change any number afterward on the Goals page.
        </p>
      </div>
      <FormMessage error={first(sp.error)} />
      {child && !usedForecast && (
        <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warn-soft p-3 text-sm text-warn">
          <span>Complete the forecast for better size and season accuracy. Months and seasons below are estimated from age. Missing: {missing.join(', ')}.</span>
          <Link className={btnCls} href="/forecast">Go to forecast</Link>
        </div>
      )}

      <form method="get" className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
        <input type="hidden" name="touched" value="1" />
        <input type="hidden" name="back" value={back} />
        <LifestyleFields answers={answers} hideClimate={Boolean(ctx.settings.monthClasses)} />
        {ctx.settings.monthClasses && (
          <p className="col-span-full text-sm text-muted">Using the weather for {ctx.settings.placeName} to tell cold, cool, mild and warm months apart. <Link className="text-accent underline" href="/account#location">Change location</Link></p>
        )}
        <SurveyBuilder initial={answers.stages} initialSizes={answers.sizes} birthMonth={answers.birthMonth} currentSize={ctx.currentSize} windows={windows}
          options={options} gearOptions={gearOptions} hot={answers.hot} cold={answers.cold} monthClasses={ctx.settings.monthClasses} />
        <div className="col-span-full"><button className={btnCls} type="submit">Update suggestions</button></div>
      </form>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Suggested goals</h2>
        <p className="text-sm text-muted">
          {usedForecast ? 'Months and seasons come from the size forecast where it reaches a size, and from age elsewhere. ' : 'Each size is planned for the season it falls in, estimated from the birth month. '}
          These are starting suggestions, not rules.
        </p>
        <SurveyResults results={results} />
        {child ? (
          <form action={applySurvey} className="flex flex-col gap-3 border-t border-line pt-3">
            <input type="hidden" name="q" value={qs} />
            <input type="hidden" name="back" value={back} />
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-1.5 text-sm text-muted">Save goals for these sizes</legend>
              {answers.sizes.map((s) => (
                <label key={s} className="cursor-pointer">
                  <input type="checkbox" name="save" value={s} defaultChecked className="peer sr-only" />
                  <span className="inline-block rounded-full border border-line bg-surface px-3 py-1 text-sm peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                    {displaySize(s)}{s === ctx.currentSize ? ' (now)' : ''} · {(windows[s] ?? sizeWindow(answers.birthMonth, s)).short}
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              <button className={btnCls} type="submit">Use these goals</button>
              <span className="text-sm text-muted">Sets goals wherever the suggestion is above zero. Other goals stay as they are.</span>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg bg-accent-soft p-4">
            <p>Add your child to save these as goals. You will come straight back here.</p>
            <div><Link className={btnCls} href={`/account?next=${encodeURIComponent(`/survey?${qs}`)}`}>Add a child</Link></div>
          </div>
        )}
      </section>
    </>
  );
}
