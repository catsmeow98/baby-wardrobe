import type { Metadata } from 'next';
import Link from 'next/link';
import { SurveyChips as Chips, SurveySelect as Select } from '@/components/survey-fields';
import { btnCls, inputCls, labelCls } from '@/components/ui';
import { DAY_OPTS, DRESS_OPTS, SLEEP_OPTS, displaySize, parseAnswers, seasonOfMonth, suggest, type Season } from '@/lib/domain';

export const metadata: Metadata = {
  title: 'How many baby clothes do you need?',
  description:
    'A free calculator that suggests how many bodysuits, sleepers, pants and more to have in each baby size, based on how often you do laundry, your climate and what your baby wears.',
};

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const SIZES = Array.from({ length: 10 }, (_, i) => i);
const SEASONS = [['spring', 'Spring'], ['summer', 'Summer'], ['fall', 'Fall'], ['winter', 'Winter']] as const;
const yesNo = [['no', 'No'], ['yes', 'Yes']] as const;

export default async function CalculatorPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const answers = parseAnswers((k) => first(sp[k]) ?? null, (k) => {
    const v = sp[k];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  });
  const sizeRaw = Number(first(sp.size));
  const size = Number.isInteger(sizeRaw) && sizeRaw >= 0 && sizeRaw <= 9 && first(sp.size) !== '' ? sizeRaw : 2;
  const season: Season = answers.season === 'auto' ? seasonOfMonth(new Date().getUTCMonth()) : answers.season;
  const { temp, rows } = suggest(answers, size, season);
  const total = rows.reduce((t, r) => t + r.qty, 0);
  const shown = rows.filter((r) => r.qty > 0);

  // The same answers, handed to the signed-in survey so nothing has to be typed twice.
  const carry = new URLSearchParams({
    touched: '1', size: String(size), season, laundry: String(answers.laundry), changes: String(answers.changes), spare: String(answers.spare),
    hot: answers.hot ? 'yes' : 'no', cold: answers.cold ? 'yes' : 'no', outings: answers.outings, stash: answers.stash ? 'yes' : 'no',
  });
  answers.sleepWear.forEach((v) => carry.append('sleep', v));
  answers.dayWear.forEach((v) => carry.append('day', v));
  answers.dressWear.forEach((v) => carry.append('dress', v));
  const signupHref = `/signup?next=${encodeURIComponent(`/survey?${carry.toString()}`)}`;

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold">How many baby clothes do you need?</h1>
        <p className="mt-1 text-muted">
          Answer a few questions about laundry, weather and what your baby wears, and get a suggested count for each type of clothing in one size. No account needed.
        </p>
      </div>

      <form method="get" className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
        <input type="hidden" name="touched" value="1" />
        <label className={labelCls}>Size to plan for
          <select className={inputCls} name="size" defaultValue={String(size)}>
            {SIZES.map((o) => <option key={o} value={o}>{displaySize(o)}</option>)}
          </select>
        </label>
        <Select name="season" label="Season baby will wear this size" value={season} options={SEASONS} />
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
        <Select name="outings" label="How often are there dressy occasions?" value={answers.outings} options={[['low', 'Rarely'], ['medium', 'Sometimes'], ['high', 'Often']]} />
        <Select name="stash" label="Keep a spare stash for messes and growth spurts?" value={answers.stash ? 'yes' : 'no'} options={yesNo} />
        <Chips name="sleep" label="What does baby wear to sleep?" options={SLEEP_OPTS} selected={answers.sleepWear} />
        <Chips name="day" label="What does baby wear on an average day?" options={DAY_OPTS} selected={answers.dayWear} />
        <Chips name="dress" label="What does baby wear for a dressy outfit?" options={DRESS_OPTS} selected={answers.dressWear} />
        <div className="col-span-full"><button className={btnCls} type="submit">Update suggestions</button></div>
      </form>

      <section className="rounded-xl border border-line bg-surface p-4" aria-live="polite">
        <h2 className="font-display text-xl font-bold">Suggested for size {displaySize(size)}</h2>
        <p className="mb-2 text-sm text-muted">Planned for {temp} weather. About <b className="tabular-nums">{total}</b> pieces in all.</p>
        <ul>
          {shown.map((r) => (
            <li key={r.key} className="grid grid-cols-[3rem_1fr] gap-x-3 border-t border-line py-2.5 first:border-t-0 sm:grid-cols-[3rem_minmax(150px,1fr)_2fr]">
              <b className="font-display text-xl tabular-nums">{r.qty}</b>
              <span className="font-bold">{r.name}</span>
              <span className="col-span-2 text-sm text-muted sm:col-span-1">{r.why}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-accent bg-accent-soft p-5">
        <h2 className="font-display text-xl font-bold">Turn these numbers into a plan</h2>
        <p>
          Baby Wardrobe tracks what your baby already owns, compares it with goals like these for every size, and turns the gaps into a shopping list.
          Pieces count toward every size they fit, so you do not buy what you already have. Your answers above come with you.
        </p>
        <div><Link className={btnCls} href={signupHref}>Create a free account and save these</Link></div>
      </section>
    </>
  );
}
