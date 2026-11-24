import { CAT_KEYS, CATEGORY_NAMES, displaySize, type SizeSuggestion } from '@/lib/domain';

const SEASON_LABEL = { spring: 'spring', summer: 'summer', fall: 'fall', winter: 'winter' } as const;

/** Suggested quantities for every size: a grid of categories by size, then the reasoning for each size. */
export function SurveyResults({ results }: { results: SizeSuggestion[] }) {
  const used = CAT_KEYS.filter((k) => results.some((r) => r.rows.find((x) => x.key === k)!.qty > 0));
  const total = (r: SizeSuggestion) => r.rows.reduce((t, x) => t + x.qty, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="text-muted">
              <th className="sticky left-0 bg-surface py-1.5 pr-3 font-medium">Category</th>
              {results.map((r) => <th key={r.size} className="px-2 text-right font-medium">{displaySize(r.size)}</th>)}
            </tr>
          </thead>
          <tbody>
            {used.map((k) => (
              <tr key={k} className="border-t border-line">
                <th className="sticky left-0 bg-surface py-1.5 pr-3 font-medium">{CATEGORY_NAMES[k]}</th>
                {results.map((r) => {
                  const n = r.rows.find((x) => x.key === k)!.qty;
                  return <td key={r.size} className={`px-2 text-right tabular-nums ${n ? 'font-bold' : 'text-muted'}`}>{n || '–'}</td>;
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-line">
              <th className="sticky left-0 bg-surface py-1.5 pr-3">All pieces</th>
              {results.map((r) => <td key={r.size} className="px-2 text-right font-bold tabular-nums">{total(r)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2">
        {results.map((r) => (
          <details key={r.size} className="rounded-lg border border-line">
            <summary className="cursor-pointer px-3 py-2 font-bold">
              {displaySize(r.size)} <span className="text-sm font-normal text-muted">· planned for {SEASON_LABEL[r.season]} ({r.temp} weather)</span>
            </summary>
            <div className="border-t border-line px-3 py-2">
              {r.notes.map((n) => <p key={n} className="mb-1 text-sm text-warn">{n}</p>)}
              <ul>
                {r.rows.filter((x) => x.qty > 0).map((x) => (
                  <li key={x.key} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-t border-line py-2 first:border-t-0 sm:grid-cols-[2.5rem_minmax(140px,1fr)_2fr]">
                    <b className="font-display text-lg tabular-nums">{x.qty}</b>
                    <span className="font-bold">{x.name}</span>
                    <span className="col-span-2 text-sm text-muted sm:col-span-1">{x.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

