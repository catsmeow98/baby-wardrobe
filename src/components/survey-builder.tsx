'use client';

import { useState } from 'react';

import {
  CAT_LABELS, CHIP_GROUPS, FREQ, FREQ_KEYS, MONTH_NAMES, OCCASIONS, SURVEY_SIZES, comboText, comboToString, displaySize, sizeWindow, stageKey,
  type CatKey, type Combo, type Freq, type Occasion, type StageAnswers,
} from '@/lib/domain';
import { btnGhostCls, inputCls, labelCls } from '@/components/ui';

type Stages = Record<number, StageAnswers>;
const MAX_COMBOS = 6;
const HINT: Record<Occasion, string> = {
  sleep: 'Leave empty to use typical sleepwear for this size.',
  day: 'Leave empty to use typical daytime outfits for this size.',
  dressy: 'Leave empty if baby does not wear dressy clothes at this size.',
};

/**
 * Sizes and combinations. First choose which sizes to plan for (and the birth month, which turns each size's age range
 * into calendar months), then for each chosen size build as many combinations as you like by ticking the pieces worn
 * together, such as "long-sleeve bodysuit + pants + socks", and say how often each is worn. Everything is carried in
 * form fields (the "size" checkboxes, "birth", and one hidden field per combination), so the surrounding form can be a
 * plain GET or POST.
 */
export function SurveyBuilder({ initial, initialSizes, birthMonth, currentSize }: {
  initial: Stages;
  initialSizes: number[];
  birthMonth: number;
  /** The size baby wears now, when known. Used for the "now" tag and the "current size and up" shortcut. */
  currentSize: number | null;
}) {
  const [stages, setStages] = useState<Stages>(initial);
  const [sizes, setSizes] = useState<number[]>(initialSizes);
  const [birth, setBirth] = useState<number>(birthMonth);

  const setSize = (size: number, on: boolean) => setSizes((list) => (on ? [...new Set([...list, size])] : list.filter((x) => x !== size)).sort((x, y) => x - y));
  const change = (size: number, occ: Occasion, fn: (list: Combo[]) => Combo[]) =>
    setStages((s) => ({ ...s, [size]: { ...s[size], [occ]: fn(s[size][occ]) } }));
  const toggle = (size: number, occ: Occasion, i: number, cat: CatKey) =>
    change(size, occ, (list) => list.map((x, j) => (j === i ? { ...x, cats: x.cats.includes(cat) ? x.cats.filter((k) => k !== cat) : [...x.cats, cat] } : x)));
  const copyFrom = (from: number, to: number) =>
    setStages((s) => ({ ...s, [to]: { sleep: clone(s[from].sleep), day: clone(s[from].day), dressy: clone(s[from].dressy) } }));

  return (
    <div className="col-span-full flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-3">
        <label className={labelCls}>Birth month, or due month
          <select className={`${inputCls} sm:w-60`} name="birth" value={birth} onChange={(e) => setBirth(Number(e.target.value))}>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="font-display text-lg font-bold">Which sizes do you want goals for?</legend>
          <p className="mb-2 text-sm text-muted">
            Skip sizes baby has outgrown. Under each size are the months a typical baby wears it, counted from the birth month, so you can see which seasons you are buying for.
          </p>
          <div className="flex flex-wrap gap-2">
            {SURVEY_SIZES.map((size) => (
              <label key={size} className="cursor-pointer">
                <input type="checkbox" name="size" value={size} checked={sizes.includes(size)} onChange={(e) => setSize(size, e.target.checked)} className="peer sr-only" />
                <span className="flex flex-col rounded-lg border border-line bg-surface px-3 py-1.5 text-sm peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  <b>{displaySize(size)}{size === currentSize ? ' (now)' : ''}</b>
                  <span className="text-xs opacity-80">{sizeWindow(birth, size).short}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={btnGhostCls} onClick={() => setSizes([...SURVEY_SIZES])}>All sizes</button>
            {currentSize !== null && (
              <button type="button" className={btnGhostCls} onClick={() => setSizes(SURVEY_SIZES.filter((x) => x >= currentSize))}>Current size and up</button>
            )}
          </div>
        </fieldset>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold">What baby wears, by size</h2>
        <p className="text-sm text-muted">Each size has its own answers, because what baby wears changes as baby grows. Build a combination by ticking the pieces worn together, and say how often it is worn.</p>
      </div>
      {sizes.length === 0 && <p className="rounded-lg bg-accent-soft p-3 text-sm">Pick at least one size above. With none picked, all sizes are used.</p>}
      {sizes.map((size, si) => {
        const st = stages[size];
        const w = sizeWindow(birth, size);
        const prev = si > 0 ? sizes[si - 1] : null;
        const count = st.sleep.length + st.day.length + st.dressy.length;
        return (
          <details key={size} open={si === 0} className="rounded-lg border border-line bg-bg">
            <summary className="cursor-pointer px-3 py-2.5 font-bold">
              {displaySize(size)}{size === currentSize ? ' (now)' : ''}{' '}
              <span className="text-sm font-normal text-muted">· {w.age} · {w.months} · {count} combination{count === 1 ? '' : 's'}</span>
            </summary>
            <div className="flex flex-col gap-4 border-t border-line p-3">
              {prev !== null && (
                <div>
                  <button type="button" className={btnGhostCls} onClick={() => copyFrom(prev, size)}>
                    Copy everything from {displaySize(prev)}
                  </button>
                </div>
              )}
              {OCCASIONS.map(([occ, question]) => (
                <section key={occ} className="flex flex-col gap-2">
                  <h3 className="font-bold">{question}</h3>
                  {st[occ].length === 0 && <p className="text-sm text-muted">{HINT[occ]}</p>}
                  {st[occ].map((x, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
                      {x.cats.length > 0 && <input type="hidden" name={stageKey(size, occ)} value={comboToString(x)} />}
                      <div role="group" aria-label="Pieces worn together" className="flex flex-col gap-1.5">
                        {CHIP_GROUPS.map((group) => (
                          <div key={group.label} className="flex flex-wrap items-center gap-1.5">
                            <span className="w-full text-xs font-medium uppercase tracking-wide text-muted sm:w-36">{group.label}</span>
                            {group.keys.map((cat) => {
                              const on = x.cats.includes(cat);
                              return (
                                <button key={cat} type="button" aria-pressed={on} onClick={() => toggle(size, occ, i, cat)}
                                  className={`rounded-full border px-2.5 py-1 text-sm ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>
                                  {CAT_LABELS[cat]}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <p className="text-sm">{x.cats.length ? <b>{comboText(x)}</b> : <span className="text-muted">Tick the pieces worn together.</span>}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          How often
                          <select className={`${inputCls} w-auto`} value={x.freq}
                            onChange={(e) => change(size, occ, (list) => list.map((y, j) => (j === i ? { ...y, freq: e.target.value as Freq } : y)))}>
                            {FREQ_KEYS.map((f) => <option key={f} value={f}>{FREQ[f].label}</option>)}
                          </select>
                        </label>
                        <button type="button" className="text-sm text-bad underline" onClick={() => change(size, occ, (list) => list.filter((_, j) => j !== i))}>Remove</button>
                      </div>
                    </div>
                  ))}
                  {st[occ].length < MAX_COMBOS && (
                    <div>
                      <button type="button" className={btnGhostCls} onClick={() => change(size, occ, (list) => [...list, { cats: [], freq: list.length ? 'some' : 'most' }])}>
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
