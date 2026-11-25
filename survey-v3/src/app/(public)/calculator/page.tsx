import type { Metadata } from 'next';
import Link from 'next/link';
import { LifestyleFields } from '@/components/survey-fields';
import { SurveyBuilder } from '@/components/survey-builder';
import { SurveyResults } from '@/components/survey-results';
import { btnCls } from '@/components/ui';
import { answersToParams, parseAnswers, seasonForSize, suggestAll } from '@/lib/domain';

export const metadata: Metadata = {
  title: 'How many baby clothes do you need?',
  description:
    'A free calculator that suggests how many bodysuits, sleepers, pants and more to have in every baby size from newborn to 2T, based on laundry, climate and what your baby wears.',
};

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CalculatorPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const answers = parseAnswers((k) => first(sp[k]) ?? null, (k) => {
    const v = sp[k];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  }, new Date().getUTCMonth());
  const results = suggestAll(answers, answers.sizes, (size) => seasonForSize(answers.birthMonth, size));

  // The same answers, handed to the signed-in survey so nothing has to be typed twice.
  const signupHref = `/signup?next=${encodeURIComponent(`/survey?${answersToParams(answers).toString()}`)}`;

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold">How many baby clothes do you need?</h1>
        <p className="mt-1 text-muted">
          Answer a few questions about laundry, weather and what your baby wears, and get a suggested count for each type of clothing in every size from newborn to 2T. No account needed.
        </p>
      </div>

      <form method="get" className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
        <input type="hidden" name="touched" value="1" />
        <LifestyleFields answers={answers} />
        <SurveyBuilder initial={answers.stages} initialSizes={answers.sizes} birthMonth={answers.birthMonth} currentSize={null} />
        <div className="col-span-full"><button className={btnCls} type="submit">Update suggestions</button></div>
      </form>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4" aria-live="polite">
        <h2 className="font-display text-xl font-bold">Suggested for each size</h2>
        <p className="text-sm text-muted">Each size is planned for the season it is likely to fall in, estimated from the birth or due month.</p>
        <SurveyResults results={results} />
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
