'use client';

import { useMemo, useState } from 'react';
import { CATEGORY_NAMES, type CatKey, type PickOption } from '@/lib/domain';
import { inputCls } from '@/components/ui';
import { ItemIcon } from '@/components/item-icon';

const tileCls = (on: boolean) =>
  `flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center text-xs leading-tight ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-accent'}`;
const GRID = 'grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5';

/**
 * Picks item types. Chosen ones show as chips you can remove. Below, a search box and the item categories as collapsed
 * groups (or, when searching, a flat list of matches), so a long list stays short on screen. Pass flat for a short list.
 */
export function ItemPicker({ options, selected, onToggle, flat = false, label }: {
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
