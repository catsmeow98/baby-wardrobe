import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { LifestyleFields } from '@/components/survey-fields';
import { SurveyBuilder } from '@/components/survey-builder';
import { SurveyResults } from '@/components/survey-results';
import { btnCls } from '@/components/ui';
import { SURVEY_SIZES, answersToParams, displaySize, parseAnswers } from '@/lib/domain';
import { applySurvey } from './actions';
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
  }, defaultBirthMonth(child?.birth_date));
  const { results, usedForecast } = await surveyAll(ctx, answers);
  const qs = answersToParams(answers).toString();
  const cur = ctx.currentSize ?? 0;

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Goal survey</h1>
        <p className="text-muted">
          Answer a few questions and get suggested goals{child ? ` for ${child.name}` : ''} for every size from newborn to 2T. You can change any number afterward on the Goals page.
        </p>
      </div>
      <FormMessage error={first(sp.error)} />

      <form method="get" className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
        <input type="hidden" name="touched" value="1" />
        <LifestyleFields answers={answers} />
        <div className="col-span-full">
          <h2 className="font-display text-lg font-bold">What baby wears, by stage</h2>
          <p className="text-sm text-muted">Needs change as baby grows, so answer for each stage. Build a combination by ticking the pieces worn together, and say how often it is worn.</p>
        </div>
        <SurveyBuilder initial={answers.stages} />
        <div className="col-span-full"><button className={btnCls} type="submit">Update suggestions</button></div>
      </form>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Suggested goals</h2>
        <p className="text-sm text-muted">
          {usedForecast ? 'Each size is planned for the season the size forecast expects. ' : 'Each size is planned for the season it falls in, estimated from the birth month. '}
          These are starting suggestions, not rules.
        </p>
        <SurveyResults results={results} />
        {child ? (
          <form action={applySurvey} className="flex flex-col gap-3 border-t border-line pt-3">
            <input type="hidden" name="q" value={qs} />
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-1.5 text-sm text-muted">Save goals for these sizes</legend>
              {SURVEY_SIZES.map((s) => (
                <label key={s} className="cursor-pointer">
                  <input type="checkbox" name="save" value={s} defaultChecked={s >= cur} className="peer sr-only" />
                  <span className="inline-block rounded-full border border-line bg-surface px-3 py-1 text-sm peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                    {displaySize(s)}{s === ctx.currentSize ? ' (now)' : ''}
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
            <div><Link className={btnCls} href={`/children?next=${encodeURIComponent(`/survey?${qs}`)}`}>Add a child</Link></div>
          </div>
        )}
      </section>
    </>
  );
}
