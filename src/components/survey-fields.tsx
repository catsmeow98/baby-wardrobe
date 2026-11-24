import { inputCls, labelCls } from '@/components/ui';

export function SurveyChips({ name, label, options, selected }: { name: string; label: string; options: readonly (readonly [string, string])[]; selected: string[] }) {
  return (
    <fieldset className="col-span-full">
      <legend className="mb-1.5 text-sm text-muted">{label} Pick all that apply.</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, l]) => (
          <label key={v} className="cursor-pointer">
            <input type="checkbox" name={name} value={v} defaultChecked={selected.includes(v)} className="peer sr-only" />
            <span className="inline-block rounded-full border border-line bg-surface px-3 py-1 text-sm peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{l}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SurveySelect({ name, label, value, options }: { name: string; label: string; value: string; options: readonly (readonly [string, string])[] }) {
  return (
    <label className={labelCls}>{label}
      <select className={inputCls} name={name} defaultValue={value}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );
}
