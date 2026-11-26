'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CHANGES, FREQ, FREQ_KEYS, MONTH_NAMES, PJ_CHANGE, SPARE, SURVEY_SIZES, answersToParams, cloneStage, displaySize, monthClass, sizeWindow, suggestGear,
  type Answers, type ChangesKey, type Combo, type Freq, type Occasion, type PickOption, type PjKey, type SizeWindow, type SpareKey, type StageAnswers, type MonthClass,
} from '@/lib/domain';
import { buildSteps, nextSizeStart, previousSize, startStepId } from '@/lib/survey-flow';
import { ItemPicker } from '@/components/item-tiles';
import { ItemIcon } from '@/components/item-icon';
import { btnCls as btnBase, btnGhostCls, inputCls, labelCls } from '@/components/ui';

const btnCls = `${btnBase} disabled:opacity-50`;

const MAX_COMBOS = 6;
const MAX_PIECES = 8;
const MAX_GEAR = 12;
const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const LAUNDRY_DAYS = [1, 2, 3, 4, 5, 7, 10, 14];

const OCC_WHY: Record<Occasion, string> = {
  sleep: 'Pajamas and sleep sacks are worn every night, so they usually need the most backups. We use how often they are washed to work out how many.',
  day: 'Everyday outfits are what you go through fastest. Each combination is a set of pieces worn together, and how many days a week it is worn.',
  dressy: 'Optional. Dressy clothes are worn rarely, so we only count a few. Leave it empty if baby does not wear them at this size.',
};

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>
      {children}
    </button>
  );
}

function Screen({ title, why, children }: { title: string; why?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      {why && <p className="rounded-xl bg-accent-soft p-3 text-sm"><b>How this helps. </b>{why}</p>}
      {children}
    </section>
  );
}

/**
 * The goal survey, a few questions at a time. All answers live in this component while the person moves between screens, and the
 * browser's Back button steps back one screen. At the end the answers go into the address of the results page, which works out
 * the suggestions on the server with the same engine as before.
 */
export function SurveyWizard({ initial, startStep, options, gearOptions, windows, currentSize, monthClasses, placeName, hasBirthDate, childName, back }: {
  initial: Answers;
  startStep?: string;
  options: PickOption[];
  gearOptions: PickOption[];
  windows: Record<number, SizeWindow>;
  currentSize: number | null;
  monthClasses: readonly MonthClass[] | null;
  placeName: string | null;
  hasBirthDate: boolean;
  childName?: string;
  /** Where Exit goes, and where the results page sends the person after saving. */
  back: string;
}) {
  const router = useRouter();
  const [a, setA] = useState<Answers>(initial);
  const steps = useMemo(() => buildSteps(a.sizes, { hasLocation: Boolean(monthClasses) }), [a.sizes, monthClasses]);
  const first = useRef(startStepId(startStep, buildSteps(initial.sizes, { hasLocation: Boolean(monthClasses) })));
  const [stepId, setStepId] = useState<string>(first.current);
  const [picking, setPicking] = useState<{ occ: Occasion; index: number } | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const idx = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const step = steps[idx];
  const size = step.size;
  const who = childName ?? 'baby';
  const labels = useMemo(() => Object.fromEntries([...options, ...gearOptions].map((o) => [o.key, o.name])), [options, gearOptions]);
  const groups = useMemo(() => Object.fromEntries([...options, ...gearOptions].map((o) => [o.key, o.group])), [options, gearOptions]);
  const winOf = (s: number): SizeWindow => windows[s] ?? sizeWindow(a.birthMonth, s);

  // The browser's Back button steps back through the screens.
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, s: first.current }, '');
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { s?: string } | null)?.s;
      if (s) {
        setPicking(null);
        setStepId(s);
        top.current?.parentElement?.scrollTo(0, 0);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = (id: string) => {
    setPicking(null);
    setStepId(id);
    window.history.pushState({ ...window.history.state, s: id }, '');
    top.current?.parentElement?.scrollTo(0, 0);
  };
  const finish = () => {
    const p = answersToParams(a);
    p.set('view', 'results');
    if (back !== '/goals') p.set('back', back);
    router.push(`/survey?${p.toString()}`);
  };
  const last = idx === steps.length - 1;
  const next = () => (last ? finish() : go(steps[idx + 1].id));
  const prev = () => window.history.back();

  const set = (patch: Partial<Answers>) => setA((x) => ({ ...x, ...patch }));
  const patchStage = (s: number, fn: (st: StageAnswers) => StageAnswers) => setA((x) => ({ ...x, stages: { ...x.stages, [s]: fn(x.stages[s]) } }));
  const setCombos = (s: number, occ: Occasion, fn: (list: Combo[]) => Combo[]) => patchStage(s, (st) => ({ ...st, [occ]: fn(st[occ]) }));
  const toggleSize = (s: number) => set({ sizes: (a.sizes.includes(s) ? a.sizes.filter((x) => x !== s) : [...a.sizes, s]).sort((x, y) => x - y) });
  const prevSize = size === undefined ? null : previousSize(a.sizes, size);

  const sectionLabel = size !== undefined ? displaySize(size) : step.kind === 'sizes' ? 'Sizes' : 'Your routine';

  /* ---- screens ---- */
  let body: React.ReactNode = null;
  let canNext = true;
  let extra: React.ReactNode = null;

  if (step.kind === 'laundry') {
    body = (
      <Screen title="How often do you do laundry?" why="The longer between loads, the more of everything you need to get through the gap. This is the biggest factor in the numbers.">
        <p className="text-sm text-muted">Days between loads of baby clothes.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LAUNDRY_DAYS.map((n) => <Choice key={n} on={a.laundry === n} onClick={() => set({ laundry: n })}><b>{n}</b> {n === 1 ? 'day' : 'days'}</Choice>)}
        </div>
      </Screen>
    );
  } else if (step.kind === 'changes') {
    body = (
      <Screen title="Outfit changes and spares" why="More changes a day means more daytime outfits. Spares cover daycare, grandparents' houses and blowouts.">
        <h2 className="font-bold">Outfit changes on a typical day</h2>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CHANGES) as ChangesKey[]).map((k) => <Choice key={k} on={a.changes === k} onClick={() => set({ changes: k })}>{CHANGES[k].label}</Choice>)}
        </div>
        <h2 className="font-bold">Spare outfits to keep on hand</h2>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SPARE) as SpareKey[]).map((k) => <Choice key={k} on={a.spare === k} onClick={() => set({ spare: k })}>{SPARE[k].label}</Choice>)}
        </div>
      </Screen>
    );
  } else if (step.kind === 'climate') {
    body = (
      <Screen title="What is the weather like?" why="Hot summers and cold winters change how many swimsuits, coats and warm layers you need. Set a location in your account to use real local weather instead.">
        <h2 className="font-bold">Hot summers?</h2>
        <div className="grid grid-cols-2 gap-2"><Choice on={!a.hot} onClick={() => set({ hot: false })}>No</Choice><Choice on={a.hot} onClick={() => set({ hot: true })}>Yes</Choice></div>
        <h2 className="font-bold">Cold winters?</h2>
        <div className="grid grid-cols-2 gap-2"><Choice on={!a.cold} onClick={() => set({ cold: false })}>No</Choice><Choice on={a.cold} onClick={() => set({ cold: true })}>Yes</Choice></div>
      </Screen>
    );
  } else if (step.kind === 'sizes') {
    canNext = a.sizes.length > 0;
    body = (
      <Screen title="Which sizes do you want goals for?" why="Each size gets its own numbers, planned for the months baby is expected to wear it. Skip sizes already outgrown.">
        {placeName && <p className="text-sm text-muted">Using the weather for {placeName}.</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SURVEY_SIZES.map((s) => (
            <Choice key={s} on={a.sizes.includes(s)} onClick={() => toggleSize(s)}>
              <b className="block">{displaySize(s)}{s === currentSize ? ' (now)' : ''}</b>
              <span className="text-xs opacity-80">{winOf(s).short}</span>
            </Choice>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhostCls} onClick={() => set({ sizes: [...SURVEY_SIZES] })}>All sizes</button>
          {currentSize !== null && <button type="button" className={btnGhostCls} onClick={() => set({ sizes: SURVEY_SIZES.filter((x) => x >= currentSize) })}>Current size and up</button>}
        </div>
        {!canNext && <p role="status" className="text-sm text-warn">Pick at least one size.</p>}
        {!hasBirthDate && (
          <label className={labelCls}>Birth month, or due month
            <select className={`${inputCls} sm:w-60`} value={a.birthMonth} onChange={(e) => set({ birthMonth: Number(e.target.value) })}>
              {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <span className="text-xs">Turns each size&apos;s age range into calendar months.</span>
          </label>
        )}
      </Screen>
    );
  } else if (step.kind === 'gear' && size !== undefined) {
    const st = a.stages[size];
    const w = winOf(size);
    const toggle = (k: string) => patchStage(size, (x) => ({ ...x, gear: x.gear.includes(k) ? x.gear.filter((y) => y !== k) : x.gear.length < MAX_GEAR ? [...x.gear, k] : x.gear }));
    body = (
      <Screen title={`Coats, hats and seasonal clothing in ${displaySize(size)}?`} why="How many to own depends on how many of the months baby wears this size are in season for each piece: at least 1 of anything you choose, 2 for 3 or more months, 3 for 5 or more.">
        <p className="text-sm text-muted">{w.age} · {w.months}</p>
        <div className="flex flex-wrap gap-1.5" aria-label={`Months ${w.months}`}>
          {w.monthIdx.map((m, k) => <span key={`${m}-${k}`} className="rounded-md bg-line px-2 py-0.5 text-xs">{MONTH_SHORT[m]} · {monthClass(m, a.hot, a.cold, monthClasses)}</span>)}
        </div>
        <ItemPicker label="Outerwear and seasonal clothing" options={gearOptions} selected={st.gear} onToggle={toggle} flat />
        <div>
          <button type="button" className={btnGhostCls}
            onClick={() => patchStage(size, (x) => ({ ...x, gear: [...new Set([...x.gear, ...suggestGear(w.monthIdx, size, a.hot, a.cold, monthClasses).filter((k) => gearOptions.some((o) => o.key === k))])].slice(0, MAX_GEAR) }))}>
            Add suggestions for {w.short}
          </button>
        </div>
      </Screen>
    );
    extra = prevSize !== null && (
      <button type="button" className={btnGhostCls} onClick={() => patchStage(size, (x) => ({ ...x, gear: [...a.stages[prevSize].gear] }))}>Same as {displaySize(prevSize)}</button>
    );
  } else if (size !== undefined && (step.kind === 'sleep' || step.kind === 'day' || step.kind === 'dressy')) {
    const occ = step.kind;
    const st = a.stages[size];
    const list = st[occ];
    const w = winOf(size);
    if (picking && picking.occ === occ && list[picking.index]) {
      const combo = list[picking.index];
      const toggle = (k: string) =>
        setCombos(size, occ, (l) => l.map((x, j) => (j === picking.index ? { ...x, cats: x.cats.includes(k) ? x.cats.filter((y) => y !== k) : x.cats.length < MAX_PIECES ? [...x.cats, k] : x.cats } : x)));
      body = (
        <Screen title="Which pieces are worn together?" why="Pick everything that goes on at once, such as a long-sleeve bodysuit, pants and socks. Each piece is counted.">
          <ItemPicker label="Pieces worn together" options={options} selected={combo.cats} onToggle={toggle} />
        </Screen>
      );
      canNext = false;
      extra = null;
    } else {
      const title = occ === 'sleep' ? `What does ${who} wear to sleep?` : occ === 'day' ? `What does ${who} wear on a typical day?` : `What does ${who} wear for dressy outfits?`;
      body = (
        <Screen title={title} why={OCC_WHY[occ]}>
          <p className="text-sm text-muted">{displaySize(size)} · {w.age} · {w.months}</p>
          {list.length === 0 && <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{occ === 'dressy' ? 'Nothing chosen. That is fine if baby does not wear dressy clothes.' : 'Nothing chosen yet, so typical clothes for this size will be used.'}</p>}
          <ul className="flex flex-col gap-3">
            {list.map((x, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {x.cats.length === 0 && <span className="text-sm text-warn">No pieces chosen. Add some or remove this.</span>}
                  {x.cats.map((k) => (
                    <span key={k} className="flex items-center gap-1 rounded-lg bg-accent-soft px-2 py-1 text-xs text-accent">
                      <ItemIcon itemKey={k} group={groups[k]} size={22} /><span className="text-ink">{labels[k] ?? 'Item'}</span>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">Days a week
                    <select className={`${inputCls} w-auto`} value={x.freq} onChange={(e) => setCombos(size, occ, (l) => l.map((y, j) => (j === i ? { ...y, freq: e.target.value as Freq } : y)))}>
                      {FREQ_KEYS.map((f) => <option key={f} value={f}>{FREQ[f].label}</option>)}
                    </select>
                  </label>
                  <button type="button" className="underline" onClick={() => setPicking({ occ, index: i })}>Change pieces</button>
                  <button type="button" className="text-bad underline" onClick={() => setCombos(size, occ, (l) => l.filter((_, j) => j !== i))}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
          {list.length < MAX_COMBOS && (
            <div>
              <button type="button" className={btnGhostCls} onClick={() => { setCombos(size, occ, (l) => [...l, { cats: [], freq: l.length ? '3-4' : '7' }]); setPicking({ occ, index: list.length }); }}>Add a combination</button>
            </div>
          )}
          {occ === 'sleep' && (
            <label className={`${labelCls} sm:w-80`}>How often are pajamas changed?
              <select className={inputCls} value={st.pj} onChange={(e) => patchStage(size, (x) => ({ ...x, pj: e.target.value as PjKey }))}>
                {(Object.keys(PJ_CHANGE) as PjKey[]).map((k) => <option key={k} value={k}>{PJ_CHANGE[k].label}</option>)}
              </select>
            </label>
          )}
        </Screen>
      );
      extra = prevSize !== null && (
        <button type="button" className={btnGhostCls}
          onClick={() => {
            const from = cloneStage(a.stages[prevSize]);
            patchStage(size, (x) => {
              const copy = cloneStage(x);
              copy[occ] = from[occ];
              if (occ === 'sleep') copy.pj = from.pj;
              return copy;
            });
          }}>
          Same as {displaySize(prevSize)}
        </button>
      );
    }
  }

  const skipTo = size !== undefined && !picking ? nextSizeStart(steps, size) : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div ref={top} className="mx-auto flex max-w-xl flex-col gap-5 px-4 pb-32 pt-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{sectionLabel} · {idx + 1} of {steps.length}</span>
            <Link href={back} className="underline">Exit</Link>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={idx + 1} aria-label="Survey progress" className="h-2 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
        {body}
        {(extra || skipTo) && (
          <div className="flex flex-wrap items-center gap-2">
            {extra}
            {skipTo && <button type="button" className="text-sm text-muted underline" onClick={() => go(skipTo)}>Looks right, skip to the next size</button>}
          </div>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-bg p-3">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {picking ? <span /> : idx > 0 ? <button type="button" className={btnGhostCls} onClick={prev}>Back</button> : <Link className={btnGhostCls} href={back}>Exit</Link>}
          <span className="flex-1" />
          {picking ? (
            <button type="button" className={btnCls} onClick={() => {
              if (size !== undefined && picking && a.stages[size][picking.occ][picking.index]?.cats.length === 0) setCombos(size, picking.occ, (l) => l.filter((_, j) => j !== picking.index));
              setPicking(null);
            }}>Done</button>
          ) : (
            <button type="button" className={btnCls} onClick={next} disabled={!canNext} aria-disabled={!canNext}>{last ? 'See my goals' : 'Next'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
