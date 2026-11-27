'use client';

import { useEffect, useRef, useState } from 'react';

export interface MultiOption { value: string; label: string; /** A heading to group options under (item categories, say). */ section?: string }

/**
 * A filter that takes several choices: a button ("Item type: 2") that opens a checklist. Inside a GET form, give it a name:
 * each ticked box submits as name=value, so the page gets ?name=a&name=b. Outside a form, pass value and onChange instead.
 * The boxes stay in the page while closed, so they still submit. Empty means "any".
 */
export function MultiSelect({ label, name, options, defaultSelected = [], value, onChange, className = '' }: {
  label: string;
  name?: string;
  options: readonly MultiOption[];
  defaultSelected?: readonly string[];
  value?: readonly string[];
  onChange?: (next: string[]) => void;
  className?: string;
}) {
  const [own, setOwn] = useState<string[]>([...defaultSelected]);
  const sel = value ? [...value] : own;
  const set = (next: string[]) => (value ? onChange?.(next) : (setOwn(next), onChange?.(next)));
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Close when tapping elsewhere or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const known = sel.filter((v) => options.some((o) => o.value === v));
  const summary = known.length === 0 ? 'Any' : known.length === 1 ? options.find((o) => o.value === known[0])!.label : `${known.length} chosen`;
  const toggle = (v: string) => set(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);
  let lastSection: string | undefined;

  return (
    <div ref={box} className={`relative ${open ? 'col-span-2 md:col-span-1' : ''} ${className}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm md:w-auto ${known.length ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
        <span className="truncate"><span className="text-muted">{label}:</span> {summary}</span>
        <span aria-hidden="true" className="text-muted">▾</span>
      </button>
      <div hidden={!open} role="group" aria-label={label}
        className="z-40 mt-1 w-full rounded-lg border border-line bg-surface p-2 shadow-lg md:absolute md:w-64">
        <div className="max-h-72 overflow-y-auto">
          {options.map((o) => {
            const heading = o.section && o.section !== lastSection ? o.section : null;
            lastSection = o.section;
            return (
              <div key={o.value}>
                {heading && <p className="px-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">{heading}</p>}
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-line/50">
                  <input type="checkbox" name={name} value={o.value} checked={sel.includes(o.value)} onChange={() => toggle(o.value)} className="size-4 accent-accent" />
                  {o.label}
                </label>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between border-t border-line pt-2">
          <button type="button" className="text-sm text-accent underline disabled:opacity-40" disabled={sel.length === 0} onClick={() => set([])}>Clear</button>
          <button type="button" className="text-sm font-medium" onClick={() => setOpen(false)}>Done</button>
        </div>
      </div>
    </div>
  );
}
