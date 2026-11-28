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
 * Color as a grid of swatches (no words; each has its name for screen readers and on hover). Colors the photo suggests
 * (hints) come first with a thin ring, and the chosen color's name shows by the label. Tapping the chosen swatch clears it.
 * The form gets the value in a hidden field. Controlled: the parent keeps the value.
 */
export function ColorPills({ name, value, onChange, hints = [], note }: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  hints?: readonly string[];
  /** Said after the chosen color, such as "from the photo". */
  note?: string;
}) {
  const ordered = [...hints.flatMap((h) => COLORS.filter((c) => c[0] === h)), ...COLORS.filter((c) => !hints.includes(c[0]))];
  const chosen = COLORS.find((c) => c[0] === value);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">Color <span className="font-normal text-muted">· {chosen ? `${chosen[1]}${note ? `, ${note}` : ''}` : hints.length ? 'pick one; the ringed ones match the photo' : 'not set'}</span></legend>
      <input type="hidden" name={name} value={value} />
      <div className="grid grid-cols-7 justify-items-center gap-2" role="radiogroup" aria-label="Color">
        {ordered.map((c) => {
          const on = value === c[0];
          const hinted = hints.includes(c[0]);
          return (
            <button key={c[0]} type="button" role="radio" aria-checked={on} aria-label={`${c[1]}${hinted ? ', suggested by the photo' : ''}`} title={c[1]}
              onClick={() => onChange(on ? '' : c[0])}
              className={`size-10 rounded-full ${on ? 'border-[3px] border-accent shadow-[inset_0_0_0_2px_#fff]' : 'border border-line'} ${!on && hinted ? 'ring-2 ring-muted/50 ring-offset-2 ring-offset-surface' : ''}`}
              style={{ background: swatch(c) }} />
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Brand: type a name, and brands already used that match are offered to tap, like tags. A new name becomes a new brand when
 * the form is saved (the server matches names without regard to case).
 */
export function BrandInput({ brands, name, defaultValue = '', top = [] }: { brands: readonly string[]; name: string; defaultValue?: string; /** Most-used brands, offered as pills while the box is empty. */ top?: readonly string[] }) {
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
      {!q && top.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Most-used brands">
          {top.map((b) => <button key={b} type="button" onClick={() => setText(b)} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">{b}</button>)}
        </div>
      )}
      {q !== '' && (focused || !exact) && (offers.length > 0 || !exact) && (
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
