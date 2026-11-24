import type { Metadata } from 'next';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import Link from 'next/link';
import { SurveyChips as Chips, SurveySelect as Select } from '@/components/survey-fields';
import { btnCls, inputCls, labelCls } from '@/components/ui';
import { sizeName } from '@/lib/db';
import { DAY_OPTS, DRESS_OPTS, SLEEP_OPTS, parseAnswers, type Answers } from '@/lib/domain';
import { applySurvey } from './actions';
import { surveyFor, targetSize } from './compute';

export const metadata: Metadata = { title: 'Goal survey' };

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const yesNo = [['no', 'No'], ['yes', 'Yes']] as const;
const hiddenFor = (a: Answers) => [
  ['laundry', String(a.laundry)], ['changes', String(a.changes)], ['spare', String(a.spare)], ['hot', a.hot ? 'yes' : 'no'], ['cold', a.cold ? 'yes' : 'no'],
  ['season', a.season], ['stash', a.stash ? 'yes' : 'no'], ['outings', a.outings], ['touched', '1'],
  ...a.sleepWear.map((v) => ['sleep', v]), ...a.dayWear.map((v) => ['day', v]), ...a.dressWear.map((v) => ['dress', v]),
];

export default async function SurveyPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const child = ctx.active; // may be null: signed-up visitors can preview suggestions before adding a child
  const answers = parseAnswers((k) => first(sp[k]) ?? null, (k) => {
    const v = sp[k];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  });
  const size = targetSize(ctx, first(sp.size));
  const sizeRow = ctx.sizeByOrder.get(size);
  if (!sizeRow) return <p className="text-muted">Sizes are missing. Run the seed migration in Supabase.</p>;
  const s = await surveyFor(ctx, answers, size);
  const here = `/survey?${new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (k === 'error' || v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x): [string, string] => [k, x])))).toString()}`;
  const total = s.rows.reduce((t, r) => t + r.qty, 0);
  const month = new Date(`${s.wearsFrom}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Goal survey</h1>
        <p className="text-muted">Answer a few questions and get suggested goals{child ? ` for ${child.name}` : ''}. You can change any number afterward on the Goals page.</p>
      </div>
      <FormMessage error={first(sp.error)} />

      <form method="get" className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
        <input type="hidden" name="touched" value="1" />
        <label className={`${labelCls} col-span-full sm:col-span-1`}>Size to plan for
          <select className={inputCls} name="size" defaultValue={String(size)}>
            {ctx.sizes.map((x) => <option key={x.id} value={x.sort_order}>{sizeName(x)}{x.sort_order === ctx.currentSize ? ' (now)' : ''}</option>)}
          </select>
        </label>
        <label className={labelCls}>How many days between laundry loads?
          <input className={inputCls} type="number" name="laundry" min={1} max={14} defaultValue={answers.laundry} />
        </label>
        <label className={labelCls}>Outfit changes on a typical day
          <input className={inputCls} type="number" name="changes" min={1} max={6} defaultValue={answers.changes} />
        </label>
        <label className={labelCls}>Spare days of clothes for delays
          <input className={inputCls} type="number" name="spare" min={0} max={7} defaultValue={answers.spare} />
        </label>
        <Select name="hot" label="Hot summers where you live?" value={answers.hot ? 'yes' : 'no'} options={yesNo} />
        <Select name="cold" label="Cold winters where you live?" value={answers.cold ? 'yes' : 'no'} options={yesNo} />
        <Select name="season" label="Season baby will wear this size" value={answers.season}
          options={[['auto', 'Work it out from the forecast'], ['spring', 'Spring'], ['summer', 'Summer'], ['fall', 'Fall'], ['winter', 'Winter']]} />
        <Select name="outings" label="How often are there dressy occasions?" value={answers.outings} options={[['low', 'Rarely'], ['medium', 'Sometimes'], ['high', 'Often']]} />
        <Select name="stash" label="Keep a spare stash for messes and growth spurts?" value={answers.stash ? 'yes' : 'no'} options={yesNo} />
        <Chips name="sleep" label="What does baby wear to sleep?" options={SLEEP_OPTS} selected={answers.sleepWear} />
        <Chips name="day" label="What does baby wear on an average day?" options={DAY_OPTS} selected={answers.dayWear} />
        <Chips name="dress" label="What does baby wear for a dressy outfit?" options={DRESS_OPTS} selected={answers.dressWear} />
        <div className="col-span-full"><button className={btnCls} type="submit">Update suggestions</button></div>
      </form>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">Suggested goals for {sizeName(sizeRow)}</h2>
        <p className="mb-2 text-sm text-muted">
          Planned for {s.temp} weather ({s.season}).{' '}
          {s.fromForecast ? `Expected from ${month} by the size forecast. ` : ''}
          These are starting suggestions, not rules.
        </p>
        <ul>
          {s.rows.map((r) => (
            <li key={r.key} className="grid grid-cols-[3rem_1fr] gap-x-3 border-t border-line py-2.5 first:border-t-0 sm:grid-cols-[3rem_minmax(150px,1fr)_2fr]">
              <b className="font-display text-xl tabular-nums">{r.qty}</b>
              <span className="font-bold">{r.name}</span>
              <span className="col-span-2 text-sm text-muted sm:col-span-1">{r.why}</span>
            </li>
          ))}
        </ul>
        {child ? (
        <form action={applySurvey} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="size" value={size} />
          {hiddenFor(answers).map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
          <button className={btnCls} type="submit" disabled={total === 0}>Use these goals</button>
          <span className="text-sm text-muted">Sets goals for {sizeName(sizeRow)} wherever the suggestion is above zero. Other goals stay as they are.</span>
        </form>
        ) : (
          <div className="mt-3 flex flex-col gap-2 rounded-lg bg-accent-soft p-4">
            <p>Add your child to save these as goals. You will come straight back here.</p>
            <div><Link className={btnCls} href={`/children?next=${encodeURIComponent(here)}`}>Add a child</Link></div>
          </div>
        )}
      </section>
    </>
  );
}
