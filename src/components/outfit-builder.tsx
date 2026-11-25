'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ColorDot } from '@/components/color-dot';
import { btnCls, btnGhostCls, inputCls, labelCls } from '@/components/ui';
import { COLORS } from '@/lib/db';
import type { PickItem } from '@/lib/outfit-data';

const MAX_ITEMS = 12;

/**
 * Builds an outfit: choose closet items (filter by item category, item type, color or search), name it, save. Chosen items
 * show in a tray and travel as one hidden "item" field each, in the order they were chosen.
 */
export function OutfitBuilder({ action, items, groups, types, initial }: {
  action: (formData: FormData) => Promise<void>;
  items: PickItem[];
  groups: { id: string; name: string }[];
  types: { id: string; name: string; groupId: string }[];
  initial?: { id: string; name: string; notes: string; itemIds: string[] };
}) {
  const [selected, setSelected] = useState<string[]>(initial?.itemIds ?? []);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [type, setType] = useState('');
  const [color, setColor] = useState('');
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const needle = q.trim().toLowerCase();
  const shown = items.filter((i) =>
    (!group || i.groupId === group) && (!type || i.typeId === type) && (!color || i.color === color) && (!needle || i.name.toLowerCase().includes(needle) || i.typeName.toLowerCase().includes(needle)));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_ITEMS ? [...s, id] : s));

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {selected.map((id) => <input key={id} type="hidden" name="item" value={id} />)}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelCls}>Outfit name
          <input className={inputCls} name="name" maxLength={80} required defaultValue={initial?.name ?? ''} placeholder="Park day" />
        </label>
        <label className={labelCls}>Notes (optional)
          <input className={inputCls} name="notes" maxLength={500} defaultValue={initial?.notes ?? ''} />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-bold">In this outfit ({selected.length} of {MAX_ITEMS})</p>
        {selected.length === 0 ? (
          <p className="text-sm text-muted">Choose items below.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {selected.map((id) => {
              const i = byId.get(id);
              return (
                <li key={id}>
                  <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${i?.name ?? 'item'}`} className="flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft py-1 pl-1 pr-2.5 text-sm">
                    {i?.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.photoUrl} alt="" className={`size-6 rounded-full bg-line ${i.cutout ? 'object-contain' : 'object-cover'}`} />
                    ) : <ColorDot color={i?.color} className="ml-1" />}
                    {i?.name ?? 'Item'} <span aria-hidden="true">×</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="search">
        <input className={`${inputCls} min-w-40 flex-1`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" aria-label="Search items" />
        <select className={`${inputCls} w-auto`} value={group} onChange={(e) => { setGroup(e.target.value); setType(''); }} aria-label="Item category">
          <option value="">All item categories</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className={`${inputCls} w-auto`} value={type} onChange={(e) => setType(e.target.value)} aria-label="Item type">
          <option value="">All item types</option>
          {types.filter((t) => !group || t.groupId === group).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className={`${inputCls} w-auto`} value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color">
          <option value="">Any color</option>
          {COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-muted">Add items to the closet first, then build outfits from them.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">No items match these filters.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((i) => {
            const on = selected.includes(i.id);
            return (
              <li key={i.id}>
                <button type="button" aria-pressed={on} onClick={() => toggle(i.id)}
                  className={`flex w-full flex-col gap-1 rounded-lg border p-1.5 text-left text-xs ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
                  <span className="relative block aspect-square overflow-hidden rounded-md bg-line">
                    {i.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.photoUrl} alt="" loading="lazy" className={`size-full ${i.cutout ? 'object-contain' : 'object-cover'}`} />
                    ) : <span className="flex size-full items-center justify-center text-muted">No photo</span>}
                    {on && <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-accent text-accent-ink" aria-hidden="true">✓</span>}
                  </span>
                  <span className="font-bold [overflow-wrap:anywhere]"><ColorDot color={i.color} className="mr-1" />{i.name}</span>
                  <span className="text-muted">{i.typeName}</span>
                  {i.warn && <span className="text-warn">{i.warn}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button className={btnCls} type="submit">{initial ? 'Save outfit' : 'Create outfit'}</button>
        <Link className={btnGhostCls} href="/outfits">Cancel</Link>
      </div>
    </form>
  );
}
