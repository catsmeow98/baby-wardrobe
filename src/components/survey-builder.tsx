'use client';

import { useMemo, useState } from 'react';

import {
  CATEGORY_NAMES, FREQ, FREQ_KEYS, MONTH_NAMES, OCCASIONS, PJ_CHANGE, SURVEY_SIZES, cloneStage, comboText, comboToString, defaultGearOptions, defaultOptions,
  displaySize, gearKey, monthClass, pjKey, sizeWindow, stageKey, suggestGear,
  type CatKey, type Combo, type Freq, type MonthClass, type Occasion, type PickOption, type PjKey, type SizeWindow, type StageAnswers,
} from '@/lib/domain';
import { btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { ItemIcon } from '@/components/item-icon';

type Stages = Record<number, StageAnswers>;
const MAX_COMBOS = 6;
const MAX_PIECES = 8;
const MAX_GEAR = 12;
const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

const HINT: Record<Occasion, string> = {
  sleep: 'Leave empty to use typical sleepwear for this size.',
  day: 'Leave empty to use typical daytime outfits for this size.',
  dressy: 'Leave empty if baby does not wear dressy clothes at this size.',
};
const SHORT_TITLE: Record<Occasion, string> = { sleep: 'Sleep', day: 'Day', dressy: 'Dressy' };

const tileCls = (on: boolean) =>
  `flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center text-xs leading-tight ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-accent'}`;
const GRID = 'grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5';

/**
 * Picks item types. Chosen ones show as chips you can remove. Below, a search box and the item categories as collapsed
 * groups (or, when searching, a flat list of matches), so a long list stays short on screen. Pass flat for a short list.
 */
function ItemPicker({ options, selected, onToggle, flat = false, label }: {
  options: PickOption[];
  selected: string[];
  onToggle: (key: string) => void;
  flat?: boolean;
  label: string;
}) {
  const [q, setQ] = useState('');
  const nameOf = (k: string) => options.find((o) => o.key === k)?.name ?? (k in CATEGORY_NAMES ? CATEGORY_NAMES[k as CatKey] : 'Item');
  const groupOf = (k: string) => options.find((o) => o.key === k)?.group;
  const groups = useMemo(() => {
    const m = new Map<string, PickOption[]>();
    for (const o of options) m.set(o.group, [...(m.get(o.group) ?? []), o]);
    return [...m];
  }, [options]);
  const needle = q.trim().toLowerCase();
  const button = (o: PickOption) => (
    <button key={o.key} type="button" aria-pressed={selected.includes(o.key)} onClick={() => onToggle(o.key)} className={tileCls(selected.includes(o.key))}>
      <ItemIcon itemKey={o.key} group={o.group} size={40} />
      <span className={selected.includes(o.key) ? '' : 'text-ink'}>{o.name}</span>
    </button>
  );
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((k) => (
            <button key={k} type="button" onClick={() => onToggle(k)} aria-label={`Remove ${nameOf(k)}`} className="flex items-center gap-1 rounded-full border border-accent bg-accent px-2.5 py-1 text-sm text-accent-ink">
              <ItemIcon itemKey={k} group={groupOf(k)} size={16} />{nameOf(k)} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      {flat ? (
        <div className={GRID}>{options.map(button)}</div>
      ) : (
        <>
          <input className={`${inputCls} sm:w-64`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item types" aria-label={`Search ${label.toLowerCase()}`} />
          {needle ? (
            <div className={GRID}>
              {options.filter((o) => o.name.toLowerCase().includes(needle)).map(button)}
              {options.every((o) => !o.name.toLowerCase().includes(needle)) && <span className="text-sm text-muted">No item type matches.</span>}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {groups.map(([group, list]) => {
                const n = list.filter((o) => selected.includes(o.key)).length;
                return (
                  <details key={group} className="rounded-lg border border-line bg-surface">
                    <summary className="cursor-pointer px-2.5 py-1.5 text-sm">{group}{n > 0 ? ` (${n} chosen)` : ''}</summary>
                    <div className={`${GRID} border-t border-line p-2`}>{list.map(button)}</div>
                  </details>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Sizes and answers. First choose which sizes to plan for (and the birth month, which turns each size's age range into
 * calendar months). Then answer one size at a time, in tabs: sleep, day and dressy combinations (each with days per week),
 * pajama change, and outerwear and seasonal clothing. Every tab stays in the page, so everything is submitted together as
 * form fields (the "size" checkboxes, "birth", and hidden fields per answer) and the form can be a plain GET or POST.
 */
export function SurveyBuilder({ initial, initialSizes, birthMonth, currentSize, windows, options = defaultOptions(), gearOptions = defaultGearOptions(), hot = false, cold = false, monthClasses = null }: {
  initial: Stages;
  initialSizes: number[];
  birthMonth: number;
  /** The size baby wears now, when known. Used for the "now" tag and the "current size and up" shortcut. */
  currentSize: number | null;
  /** Months worked out from the size forecast. Sizes not listed use the live age-based guide. */
  windows?: Record<number, SizeWindow>;
  /** Every item type the person can pick, grouped by item category. Defaults to the built-in list. */
  options?: PickOption[];
  /** The item types offered for outerwear and seasonal clothing. */
  gearOptions?: PickOption[];
  hot?: boolean;
  cold?: boolean;
  /** How each calendar month feels at the person's location, January first. Replaces the fixed calendar when set. */
  monthClasses?: readonly MonthClass[] | null;
}) {
  const [stages, setStages] = useState<Stages>(initial);
  const [sizes, setSizes] = useState<number[]>(initialSizes);
  const [birth, setBirth] = useState<number>(birthMonth);
  const [active, setActive] = useState<number>(initialSizes[0] ?? SURVEY_SIZES[0]);
  const winOf = (size: number): SizeWindow => windows?.[size] ?? sizeWindow(birth, size);
  const labels = useMemo(() => Object.fromEntries(options.map((o) => [o.key, o.name])), [options]);

  const setSize = (size: number, on: boolean) => setSizes((list) => (on ? [...new Set([...list, size])] : list.filter((x) => x !== size)).sort((x, y) => x - y));
  const patch = (size: number, fn: (st: StageAnswers) => StageAnswers) => setStages((s) => ({ ...s, [size]: fn(s[size]) }));
  const change = (size: number, occ: Occasion, fn: (list: Combo[]) => Combo[]) => patch(size, (st) => ({ ...st, [occ]: fn(st[occ]) }));
  const toggle = (size: number, occ: Occasion, i: number, cat: string) =>
    change(size, occ, (list) => list.map((x, j) => (j === i ? { ...x, cats: x.cats.includes(cat) ? x.cats.filter((k) => k !== cat) : x.cats.length < MAX_PIECES ? [...x.cats, cat] : x.cats } : x)));
  const toggleGear = (size: number, cat: string) =>
    patch(size, (st) => ({ ...st, gear: st.gear.includes(cat) ? st.gear.filter((k) => k !== cat) : st.gear.length < MAX_GEAR ? [...st.gear, cat] : st.gear }));
  const copyFrom = (from: number, to: number) => setStages((s) => ({ ...s, [to]: cloneStage(s[from]) }));

  const shown = sizes.includes(active) ? active : sizes[0];
  const answered = (size: number) => stages[size].sleep.length + stages[size].day.length + stages[size].dressy.length + stages[size].gear.length > 0;

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
            Skip sizes baby has outgrown. Under each size are the months baby is expected to wear it, so you can see which seasons you are buying for.
          </p>
          <div className="flex flex-wrap gap-2">
            {SURVEY_SIZES.map((size) => (
              <label key={size} className="cursor-pointer">
                <input type="checkbox" name="size" value={size} checked={sizes.includes(size)} onChange={(e) => setSize(size, e.target.checked)} className="peer sr-only" />
                <span className="flex flex-col rounded-lg border border-line bg-surface px-3 py-1.5 text-sm peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  <b>{displaySize(size)}{size === currentSize ? ' (now)' : ''}</b>
                  <span className="text-xs opacity-80">{winOf(size).short}</span>
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
        <h2 className="font-display text-lg font-bold">What baby wears, one size at a time</h2>
        <p className="text-sm text-muted">Pick a size, then open each part. Build a combination by choosing the pieces worn together, and say how many days a week it is worn.</p>
      </div>
      {sizes.length === 0 && <p className="rounded-lg bg-accent-soft p-3 text-sm">Pick at least one size above. With none picked, all sizes are used.</p>}

      {sizes.length > 0 && (
        <div role="tablist" aria-label="Sizes" className="flex flex-wrap gap-2">
          {sizes.map((size) => (
            <button key={size} type="button" role="tab" id={`tab-${size}`} aria-selected={size === shown} aria-controls={`panel-${size}`} onClick={() => setActive(size)}
              className={`flex flex-col rounded-lg border px-3 py-1.5 text-left text-sm ${size === shown ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>
              <b>{displaySize(size)}{size === currentSize ? ' (now)' : ''}{answered(size) ? ' ✓' : ''}</b>
              <span className="text-xs opacity-80">{winOf(size).short}</span>
            </button>
          ))}
        </div>
      )}

      {sizes.map((size, si) => {
        const st = stages[size];
        const w = winOf(size);
        const prev = si > 0 ? sizes[si - 1] : null;
        return (
          <div key={size} role="tabpanel" id={`panel-${size}`} aria-labelledby={`tab-${size}`} hidden={size !== shown} className="flex flex-col gap-3 rounded-lg border border-line bg-bg p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">{displaySize(size)} <span className="text-sm font-normal text-muted">· {w.age} · {w.months}</span></p>
              {prev !== null && <button type="button" className={btnGhostCls} onClick={() => copyFrom(prev, size)}>Copy everything from {displaySize(prev)}</button>}
            </div>

            {OCCASIONS.map(([occ, question]) => (
              <details key={occ} open={occ === 'sleep'} className="rounded-lg border border-line bg-surface">
                <summary className="cursor-pointer px-3 py-2 font-bold">
                  {SHORT_TITLE[occ]} <span className="text-sm font-normal text-muted">· {st[occ].length} combination{st[occ].length === 1 ? '' : 's'}</span>
                </summary>
                <div className="flex flex-col gap-2 border-t border-line p-3">
                  <h3 className="text-sm text-muted">{question}</h3>
                  {occ === 'sleep' && (
                    <label className={`${labelCls} sm:w-80`}>Pajama changes
                      <select className={inputCls} name={pjKey(size)} value={st.pj} onChange={(e) => patch(size, (x) => ({ ...x, pj: e.target.value as PjKey }))}>
                        {(Object.keys(PJ_CHANGE) as PjKey[]).map((k) => <option key={k} value={k}>{PJ_CHANGE[k].label}</option>)}
                      </select>
                    </label>
                  )}
                  {st[occ].length === 0 && <p className="text-sm text-muted">{HINT[occ]}</p>}
                  {st[occ].map((x, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-lg border border-line bg-bg p-3">
                      {x.cats.length > 0 && <input type="hidden" name={stageKey(size, occ)} value={comboToString(x)} />}
                      <p className="text-sm">{x.cats.length ? <b>{comboText(x, labels)}</b> : <span className="text-muted">Choose the pieces worn together.</span>}</p>
                      <ItemPicker label="Pieces worn together" options={options} selected={x.cats} onToggle={(k) => toggle(size, occ, i, k)} />
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          Days per week
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
                      <button type="button" className={btnGhostCls} onClick={() => change(size, occ, (list) => [...list, { cats: [], freq: list.length ? '3-4' : '7' }])}>
                        Add a combination
                      </button>
                    </div>
                  )}
                </div>
              </details>
            ))}

            <details className="rounded-lg border border-line bg-surface">
              <summary className="cursor-pointer px-3 py-2 font-bold">
                Outerwear and seasonal clothing <span className="text-sm font-normal text-muted">· {st.gear.length} chosen</span>
              </summary>
              <div className="flex flex-col gap-2 border-t border-line p-3">
                <h3 className="text-sm text-muted">What outerwear and seasonal clothing will baby wear in {displaySize(size)}?</h3>
                <div className="flex flex-wrap gap-1.5" aria-label={`Months ${w.months}`}>
                  {w.monthIdx.map((m, k) => (
                    <span key={`${m}-${k}`} className="rounded-md bg-line px-2 py-0.5 text-xs">{MONTH_SHORT[m]} · {monthClass(m, hot, cold, monthClasses)}</span>
                  ))}
                </div>
                <p className="text-sm text-muted">
                  How many to own depends on how many of these months a piece is in season: at least 1 of anything you choose, 2 for 3 or more months, 3 for 5 or more.
                </p>
                {st.gear.map((k) => <input key={k} type="hidden" name={gearKey(size)} value={k} />)}
                <ItemPicker label="Outerwear and seasonal clothing" options={gearOptions} selected={st.gear} onToggle={(k) => toggleGear(size, k)} flat />
                <div>
                  <button type="button" className={btnGhostCls}
                    onClick={() => patch(size, (x) => ({ ...x, gear: [...new Set([...x.gear, ...suggestGear(w.monthIdx, size, hot, cold, monthClasses).filter((k) => gearOptions.some((o) => o.key === k))])].slice(0, MAX_GEAR) }))}>
                    Add suggestions for {w.short}
                  </button>
                </div>
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
