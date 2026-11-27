'use client';

import { useState } from 'react';
import { labelCls, inputCls } from '@/components/ui';
import { groupCategories } from '@/lib/categories';
import type { CategoryRow } from '@/lib/db';
import { TypeIcon } from '@/components/item-icon';

const NEW_TYPE = '__new';
const NEW_GROUP = '__newgroup';

/**
 * Pick the item type (Coat, Sleep sack, ...) and the item category (Outerwear, Sleep, ...) fills in by itself. The type list
 * is grouped by category, so the choices stay easy to scan. The form submits the type's id in a field called name.
 * With allowNew, the list ends with "+ New item type…". Choosing it opens a name box, and the category becomes a list to
 * choose from (or "+ New item category…"); the form then submits name = "__new" plus name_newType, name_group (an item
 * category id, or "__new") and name_newGroup, and the server creates them. Both cells are returned as a fragment, type
 * first, so the form's own grid decides where they sit.
 */
export function CategoryPicker({ categories, name, defaultId, className = labelCls, allowNew = false, onTypeChange }: {
  categories: readonly CategoryRow[];
  name: string;
  defaultId?: string;
  className?: string;
  allowNew?: boolean;
  /** Told the chosen item type when it changes (undefined while making a new one). */
  onTypeChange?: (type: CategoryRow | undefined) => void;
}) {
  const groups = groupCategories(categories);
  const start = categories.find((c) => c.id === defaultId) ?? groups[0]?.items[0];
  const [itemId, setItemId] = useState(start?.id ?? '');
  // Only used while making a new item type: which item category it goes in.
  const [newGroupLabel, setNewGroupLabel] = useState(start?.grp ?? groups[0]?.label ?? '');
  const creating = allowNew && itemId === NEW_TYPE;
  const newGroup = creating && newGroupLabel === NEW_GROUP;
  const chosen = categories.find((c) => c.id === itemId);
  const groupId = newGroup ? '__new' : (groups.find((g) => g.label === newGroupLabel)?.items[0]?.group_id ?? '');

  return (
    <>
      <label className={className}>
        <span className="flex items-center gap-1.5">Item type {chosen && <TypeIcon type={chosen} size={20} className="text-accent" />}</span>
        <select
          className={inputCls}
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value);
            onTypeChange?.(categories.find((c) => c.id === e.target.value));
            // Start a new type in the category of the one the person was just looking at.
            const prev = categories.find((c) => c.id === itemId);
            if (e.target.value === NEW_TYPE && prev) setNewGroupLabel(prev.grp);
          }}
          required
        >
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ))}
          {allowNew && <option value={NEW_TYPE}>+ New item type…</option>}
        </select>
        {creating && <input className={`${inputCls} mt-1.5`} name={`${name}_newType`} maxLength={60} placeholder="New item type name" aria-label="New item type name" required />}
        <input type="hidden" name={name} value={creating ? '__new' : itemId} />
        {creating && <input type="hidden" name={`${name}_group`} value={groupId} />}
      </label>
      <label className={className}>
        Item category
        {creating ? (
          <>
            <select className={inputCls} value={newGroupLabel} onChange={(e) => setNewGroupLabel(e.target.value)}>
              {groups.map((g) => <option key={g.label} value={g.label}>{g.label}</option>)}
              <option value={NEW_GROUP}>+ New item category…</option>
            </select>
            {newGroup && <input className={`${inputCls} mt-1.5`} name={`${name}_newGroup`} maxLength={60} placeholder="New item category name" aria-label="New item category name" required />}
          </>
        ) : (
          <input className={`${inputCls} bg-line/40`} value={chosen?.grp ?? ''} readOnly tabIndex={-1} aria-label="Item category, filled in from the item type" />
        )}
      </label>
    </>
  );
}
