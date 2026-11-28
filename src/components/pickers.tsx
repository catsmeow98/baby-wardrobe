'use client';

import { useId, useState } from 'react';
import { inputCls } from '@/components/ui';
import { COLORS } from '@/lib/db';

const pill = (on: boolean) =>
  `flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'}`;

/** One choice from a few, as pills. The form gets the value in a hidden field. Uncontrolled unless value/onChange are given. */
export function ChoicePills({ name, label, options, defaultValue = '', value, onChange }: {
  name: string;
  label: string;
  /** [value, label]; a value of '' is a "none" or "same as" choice. */
  options: readonly (readonly [string, string])[];
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [own, setOwn] = useState(defaultValue);
  const v = value ?? own;
  const set = (x: string) => (onChange ? onChange(x) : setOwn(x));
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-medium">{label}</legend>
      <input type="hidden" name={name} value={v} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map(([k, l]) => (
          <button key={k || 'none'} type="button" role="radio" aria-checked={v === k} onClick={() => set(k)} className={pill(v === k)}>{l}</button>
        ))}
      </div>
    </fieldset>
  );
}

const swatch = (c: readonly [string, string, string]) =>
  c[0] === 'multicolor' ? 'conic-gradient(#ef4444, #facc15, #22c55e, #3b82f6, #8b5cf6, #ef4444)' : c[2];

/**
 * Color as pills with swatches. Colors the photo suggests (hints) come first, marked "Looks like". The form gets the value
 * in a hidden field. Controlled: the parent keeps the value.
 */
export function ColorPills({ name, value, onChange, hints = [], note }: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  hints?: readonly string[];
  /** A line under the label, such as "Guessed from the photo". */
  note?: string;
}) {
  const first = hints.flatMap((h) => COLORS.filter((c) => c[0] === h));
  const rest = COLORS.filter((c) => !hints.includes(c[0]));
  const item = (c: readonly [string, string, string]) => (
    <button key={c[0]} type="button" role="radio" aria-checked={value === c[0]} onClick={() => onChange(value === c[0] ? '' : c[0])} className={pill(value === c[0])}>
      <span aria-hidden="true" className="inline-block size-3.5 rounded-full border border-line" style={{ background: swatch(c) }} />{c[1]}
    </button>
  );
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-medium">Color {note && <span className="text-xs font-normal text-muted">· {note}</span>}</legend>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Color">
        {first.length > 0 && !value && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Looks like:</span>
            {first.map(item)}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">{(value ? COLORS : rest).map(item)}</div>
      </div>
    </fieldset>
  );
}

/**
 * Brand: type a name, and brands already used that match are offered to tap, like tags. A new name becomes a new brand when
 * the form is saved (the server matches names without regard to case).
 */
export function BrandInput({ brands, name, defaultValue = '' }: { brands: readonly string[]; name: string; defaultValue?: string }) {
  const id = useId();
  const [text, setText] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const q = text.trim().toLowerCase();
  const exact = brands.some((b) => b.toLowerCase() === q);
  const offers = brands.filter((b) => (!q || b.toLowerCase().includes(q)) && b.toLowerCase() !== q).slice(0, 8);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">Brand</label>
      <input id={id} className={inputCls} name={name} value={text} maxLength={80} autoComplete="off" placeholder="Type a brand, or leave blank"
        onChange={(e) => setText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); (e.target as HTMLInputElement).blur(); } }} />
      {(focused || (q && !exact)) && (offers.length > 0 || (q && !exact)) && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Brand suggestions">
          {offers.map((b) => (
            <button key={b} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setText(b); setFocused(false); }}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm">{b}</button>
          ))}
          {q && !exact && <span className="text-xs text-muted">New brand: “{text.trim()}”</span>}
        </div>
      )}
    </div>
  );
}

/** ColorPills that keep their own value, for forms rendered on the server. */
export function ColorField({ name, defaultValue = '' }: { name: string; defaultValue?: string }) {
  const [v, setV] = useState(defaultValue);
  return <ColorPills name={name} value={v} onChange={setV} />;
}
