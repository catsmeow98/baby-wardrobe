'use client';

import { useState } from 'react';
import { labelCls, inputCls } from '@/components/ui';
import { groupCategories } from '@/lib/categories';
import type { CategoryRow } from '@/lib/db';

/**
 * Two linked dropdowns: first the category (Sleep, Outerwear, ...), then the item in it (Sleep sack, Coat, ...).
 * Only the item dropdown has a name, so the form submits the item's id. Both cells are returned as a fragment so the
 * form's own grid decides where they sit.
 */
export function CategoryPicker({ categories, name, defaultId, className = labelCls }: {
  categories: readonly CategoryRow[];
  name: string;
  defaultId?: string;
  className?: string;
}) {
  const groups = groupCategories(categories);
  const start = categories.find((c) => c.id === defaultId) ?? groups[0]?.items[0];
  const [groupLabel, setGroupLabel] = useState(start?.grp ?? '');
  const [itemId, setItemId] = useState(start?.id ?? '');
  const items = groups.find((g) => g.label === groupLabel)?.items ?? [];

  return (
    <>
      <label className={className}>
        Item category
        <select
          className={inputCls}
          value={groupLabel}
          onChange={(e) => {
            const next = groups.find((g) => g.label === e.target.value);
            setGroupLabel(e.target.value);
            setItemId(next?.items[0]?.id ?? '');
          }}
        >
          {groups.map((g) => <option key={g.label} value={g.label}>{g.label}</option>)}
        </select>
      </label>
      <label className={className}>
        Item type
        <select className={inputCls} name={name} value={itemId} onChange={(e) => setItemId(e.target.value)} required>
          {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
    </>
  );
}
