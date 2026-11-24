'use client';

import { useState } from 'react';
import {
  CAT_LABELS, CHIP_ORDER, FREQ, FREQ_KEYS, OCCASIONS, STAGES, comboText, comboToString, stageKey,
  type CatKey, type Combo, type Freq, type Occasion, type StageAnswers, type StageId,
} from '@/lib/domain';
import { btnGhostCls, inputCls } from '@/components/ui';

type Stages = Record<StageId, StageAnswers>;
const MAX_COMBOS = 6;
const HINT: Record<Occasion, string> = {
  sleep: 'Leave empty to use typical sleepwear for this stage.',
  day: 'Leave empty to use typical daytime outfits for this stage.',
  dressy: 'Leave empty if baby does not wear dressy clothes at this stage.',
};

/**
 * Combination builder. For each stage and occasion, build as many combinations as you like by ticking the pieces
 * worn together, such as "long-sleeve bodysuit + pants + socks", and say how often each is worn. Everything is carried
 * in hidden fields (one per combination), so the surrounding form can be a plain GET or POST.
 */
export function SurveyBuilder({ initial }: { initial: Stages }) {
  const [stages, setStages] = useState<Stages>(initial);

  const change = (stage: StageId, occ: Occasion, fn: (list: Combo[]) => Combo[]) =>
    setStages((s) => ({ ...s, [stage]: { ...s[stage], [occ]: fn(s[stage][occ]) } }));
  const toggle = (stage: StageId, occ: Occasion, i: number, cat: CatKey) =>
    change(stage, occ, (list) => list.map((x, j) => (j === i ? { ...x, cats: x.cats.includes(cat) ? x.cats.filter((k) => k !== cat) : [...x.cats, cat] } : x)));
  const copyFrom = (from: StageId, to: StageId) =>
    setStages((s) => ({ ...s, [to]: { sleep: clone(s[from].sleep), day: clone(s[from].day), dressy: clone(s[from].dressy) } }));

  return (
    <div className="col-span-full flex flex-col gap-3">
      {STAGES.map((stage, si) => {
        const st = stages[stage.id];
        const count = st.sleep.length + st.day.length + st.dressy.length;
        return (
          <details key={stage.id} open={si === 0} className="rounded-lg border border-line bg-bg">
            <summary className="cursor-pointer px-3 py-2.5 font-bold">
              {stage.label} <span className="text-sm font-normal text-muted">· {count} combination{count === 1 ? '' : 's'}</span>
            </summary>
            <div className="flex flex-col gap-4 border-t border-line p-3">
              {si > 0 && (
                <div>
                  <button type="button" className={btnGhostCls} onClick={() => copyFrom(STAGES[si - 1].id, stage.id)}>
                    Copy everything from {STAGES[si - 1].label.toLowerCase()}
                  </button>
                </div>
              )}
              {OCCASIONS.map(([occ, question]) => (
                <section key={occ} className="flex flex-col gap-2">
                  <h3 className="font-bold">{question}</h3>
                  {st[occ].length === 0 && <p className="text-sm text-muted">{HINT[occ]}</p>}
                  {st[occ].map((x, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
                      {x.cats.length > 0 && <input type="hidden" name={stageKey(stage.id, occ)} value={comboToString(x)} />}
                      <div role="group" aria-label="Pieces worn together" className="flex flex-wrap gap-1.5">
                        {CHIP_ORDER.map((cat) => {
                          const on = x.cats.includes(cat);
                          return (
                            <button key={cat} type="button" aria-pressed={on} onClick={() => toggle(stage.id, occ, i, cat)}
                              className={`rounded-full border px-2.5 py-1 text-sm ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>
                              {CAT_LABELS[cat]}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-sm">{x.cats.length ? <b>{comboText(x)}</b> : <span className="text-muted">Tick the pieces worn together.</span>}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          How often
                          <select className={`${inputCls} w-auto`} value={x.freq}
                            onChange={(e) => change(stage.id, occ, (list) => list.map((y, j) => (j === i ? { ...y, freq: e.target.value as Freq } : y)))}>
                            {FREQ_KEYS.map((f) => <option key={f} value={f}>{FREQ[f].label}</option>)}
                          </select>
                        </label>
                        <button type="button" className="text-sm text-bad underline" onClick={() => change(stage.id, occ, (list) => list.filter((_, j) => j !== i))}>Remove</button>
                      </div>
                    </div>
                  ))}
                  {st[occ].length < MAX_COMBOS && (
                    <div>
                      <button type="button" className={btnGhostCls} onClick={() => change(stage.id, occ, (list) => [...list, { cats: [], freq: list.length ? 'some' : 'most' }])}>
                        Add a combination
                      </button>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

const clone = (list: Combo[]): Combo[] => list.map((x) => ({ cats: [...x.cats], freq: x.freq }));
