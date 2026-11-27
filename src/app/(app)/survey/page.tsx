import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { FocusShell } from '@/components/focus-shell';
import { FormMessage } from '@/components/form-message';
import { SurveyResults } from '@/components/survey-results';
import { SurveyWizard } from '@/components/survey-wizard';
import { btnCls, btnGhostCls } from '@/components/ui';
import { answersToParams, defaultSizes, displaySize, parseAnswers, sizeWindow } from '@/lib/domain';
import { SIZE_KINDS, sizeStepId } from '@/lib/survey-flow';
import { applySurvey } from './actions';
import { safeBackAny } from '@/lib/back';
import { defaultBirthMonth, surveyAll } from './compute';
import { StickyActions } from '@/components/sticky-actions';

export const metadata: Metadata = { title: 'Goal survey' };

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const KIND_LABEL = { sleep: 'Sleep', day: 'Day', dressy: 'Dressy', gear: 'Outerwear' } as const;

export default async function SurveyPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const child = ctx.active; // may be null: new accounts can preview suggestions before adding a child
  const back = safeBackAny(first(sp.back), ['/goals', '/welcome'], '/goals');
  const backLabel = back.startsWith('/welcome') ? 'Back to setup' : 'Back to goals';

  // Where the answers come from: this address when the survey has been touched, else what this child's survey last saved, else typical answers.
  const saved = child?.survey_answers ? new URLSearchParams(child.survey_answers) : null;
  const fromUrl = first(sp.touched) !== undefined || !saved;
  const get = (k: string): string | null => (fromUrl ? first(sp[k]) ?? null : saved!.get(k));
  const getAll = (k: string): string[] => {
    if (!fromUrl) return saved!.getAll(k);
    const v = sp[k];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  };
  const answers = parseAnswers(get, getAll, defaultBirthMonth(child?.birth_date), defaultSizes(ctx.currentSize));
  const { results, usedForecast, windows, missing, options, gearOptions } = await surveyAll(ctx, answers);

  if (first(sp.view) !== 'results') {
    return (
      <SurveyWizard
        initial={answers}
        startStep={first(sp.step)}
        options={options}
        gearOptions={gearOptions}
        windows={windows}
        currentSize={ctx.currentSize}
        monthClasses={ctx.settings.monthClasses}
        placeName={ctx.settings.placeName}
        hasBirthDate={Boolean(child?.birth_date)}
        childName={child?.name}
        back={back}
      />
    );
  }

  const qs = answersToParams(answers).toString();
  const edit = (extra: Record<string, string>) => `/survey?${qs}${back !== '/goals' ? `&back=${encodeURIComponent(back)}` : ''}&${new URLSearchParams(extra).toString()}`;

  return (
    <FocusShell wide>
      <div>
        <p className="mb-1 text-sm"><Link className="text-accent underline" href={back}>← {backLabel}</Link></p>
        <h1 className="font-display text-2xl font-bold">Your suggested goals</h1>
        <p className="text-muted">
          {child ? `For ${child.name}. ` : ''}These are starting suggestions. You can change any number afterward on the Goals page.
        </p>
      </div>
      <FormMessage error={first(sp.error)} />
      {child && !usedForecast && (
        <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warn-soft p-3 text-sm text-warn">
          <span>Complete the forecast for better size and season accuracy. Months and seasons below are estimated from age. Missing: {missing.join(', ')}.</span>
          <Link className={btnCls} href="/forecast">Go to forecast</Link>
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm text-muted">
          {usedForecast ? 'Months and seasons come from the size forecast where it reaches a size, and from age elsewhere. ' : 'Each size is planned for the season it falls in, estimated from the birth month. '}
        </p>
        <SurveyResults results={results} groups={Object.fromEntries(options.map((o) => [o.key, o.group]))} />
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Change an answer</h2>
        <div className="flex flex-wrap gap-2">
          <Link className={btnGhostCls} href={edit({})}>Start from the beginning</Link>
          <Link className={btnGhostCls} href={edit({ step: 'laundry' })}>Laundry and outfit changes</Link>
          <Link className={btnGhostCls} href={edit({ step: 'sizes' })}>Sizes</Link>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          {answers.sizes.map((s) => (
            <li key={s} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <b className="w-24">{displaySize(s)}</b>
              {SIZE_KINDS.map((k) => <Link key={k} className="text-accent underline" href={edit({ step: sizeStepId(s, k) })}>{KIND_LABEL[k as keyof typeof KIND_LABEL]}</Link>)}
              <span className="text-muted">{(windows[s] ?? sizeWindow(answers.birthMonth, s)).short}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        {child ? (
          <form id="survey-save" action={applySurvey} className="flex flex-col gap-3">
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
            <p className="text-sm text-muted">Replaces the goals for the ticked sizes: item types you did not pick are set to 0. Sizes you leave unticked keep their goals. Your answers are remembered for next time.</p>
          </form>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg bg-accent-soft p-4">
            <p>Add your child to save these as goals. You will come straight back here.</p>
            <div><Link className={btnCls} href={`/account?next=${encodeURIComponent(`/survey?${qs}&view=results`)}`}>Add a child</Link></div>
          </div>
        )}
      </section>
      {child && (
        <StickyActions full>
          <button className={btnCls} type="submit" form="survey-save">Use these goals</button>
        </StickyActions>
      )}
    </FocusShell>
  );
}
