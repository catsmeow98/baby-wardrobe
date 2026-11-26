import Link from 'next/link';
import type { Ctx } from '@/lib/context';
import { loadSetupFacts } from '@/lib/setup-data';
import { setupState, showSetupBanner, stepPath } from '@/lib/setup';
import { dismissSetup } from '@/app/(setup)/welcome/actions';
import { btnCls } from '@/components/ui';

/** A nudge on the dashboard until the setup guide is finished or dismissed. */
export async function SetupBanner({ ctx }: { ctx: Ctx }) {
  const facts = await loadSetupFacts(ctx);
  if (!showSetupBanner(facts)) return null;
  const s = setupState(facts);
  return (
    <section aria-label="Setup" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft p-4">
      <div>
        <p className="font-bold">Finish setting up · {s.doneCount} of {s.total} done</p>
        <p className="text-sm text-muted">A few quick steps make the forecast and goals fit your family.</p>
      </div>
      <div className="flex items-center gap-3">
        <Link className={btnCls} href={stepPath(s.next ?? 'welcome')}>Continue</Link>
        <form action={dismissSetup}><button type="submit" className="text-sm text-muted underline">Hide</button></form>
      </div>
    </section>
  );
}
