'use client';

import { useState } from 'react';
import { labelCls, inputCls } from '@/components/ui';
import { groupCategories } from '@/lib/categories';
import type { CategoryRow } from '@/lib/db';

const NEW_TYPE = '__new';
const NEW_GROUP = '__newgroup';

/**
 * Two linked dropdowns: first the item category (Sleep, Outerwear, ...), then the item type in it (Sleep sack, Coat, ...).
 * The form submits the type's id in a field called name. With allowNew, each list ends with a "+ New" choice that opens a
 * name box; the form then submits name = "__new" plus name_newType, name_group (an item category id, or "__new") and
 * name_newGroup, and the server creates them. Both cells are returned as a fragment so the form's own grid decides where they sit.
 */
export function CategoryPicker({ categories, name, defaultId, className = labelCls, allowNew = false }: {
  categories: readonly CategoryRow[];
  name: string;
  defaultId?: string;
  className?: string;
  allowNew?: boolean;
}) {
  const groups = groupCategories(categories);
  const start = categories.find((c) => c.id === defaultId) ?? groups[0]?.items[0];
  const [groupLabel, setGroupLabel] = useState(start?.grp ?? '');
  const [itemId, setItemId] = useState(start?.id ?? '');
  const newGroup = groupLabel === NEW_GROUP;
  const items = groups.find((g) => g.label === groupLabel)?.items ?? [];
  const creating = allowNew && (newGroup || itemId === NEW_TYPE);
  const groupId = newGroup ? '__new' : (items[0]?.group_id ?? '');

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
            setItemId(e.target.value === NEW_GROUP ? NEW_TYPE : (next?.items[0]?.id ?? ''));
          }}
        >
          {groups.map((g) => <option key={g.label} value={g.label}>{g.label}</option>)}
          {allowNew && <option value={NEW_GROUP}>+ New item category…</option>}
        </select>
        {allowNew && newGroup && <input className={`${inputCls} mt-1.5`} name={`${name}_newGroup`} maxLength={60} placeholder="New item category name" aria-label="New item category name" required />}
      </label>
      <label className={className}>
        Item type
        {!newGroup && (
          <select className={inputCls} value={itemId} onChange={(e) => setItemId(e.target.value)} required>
            {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {allowNew && <option value={NEW_TYPE}>+ New item type…</option>}
          </select>
        )}
        {creating && <input className={`${inputCls} ${newGroup ? '' : 'mt-1.5'}`} name={`${name}_newType`} maxLength={60} placeholder="New item type name" aria-label="New item type name" required />}
        <input type="hidden" name={name} value={creating ? '__new' : itemId} />
        {creating && <input type="hidden" name={`${name}_group`} value={groupId} />}
      </label>
    </>
  );
}
