'use client';

import { useState } from 'react';
import { labelCls, inputCls } from '@/components/ui';
import { groupCategories } from '@/lib/categories';
import type { CategoryRow } from '@/lib/db';
import { TypeIcon } from '@/components/item-icon';

const NEW_TYPE = '__new';
const NEW_GROUP = '__newgroup';

const pill = (on: boolean) =>
  `flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'}`;

/**
 * Pick the item type with pills: first the item category (Bodysuits and tops, Outerwear...), then its item types, each with
 * its icon. The form submits the type's id in a field called name. With allowNew, the types end with "+ New item type": it
 * opens a name box, and the item category pills choose where it goes (or "+ New item category"); the form then submits
 * name = "__new" plus name_newType, name_group (an item category id, or "__new") and name_newGroup, and the server creates them.
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
  const [groupLabel, setGroupLabel] = useState(start?.grp ?? groups[0]?.label ?? '');
  const creating = allowNew && itemId === NEW_TYPE;
  const newGroup = creating && groupLabel === NEW_GROUP;
  const chosen = categories.find((c) => c.id === itemId);
  const shown = groups.find((g) => g.label === groupLabel);
  const groupId = newGroup ? '__new' : (shown?.items[0]?.group_id ?? '');
  const pick = (id: string) => {
    setItemId(id);
    onTypeChange?.(categories.find((c) => c.id === id));
  };

  return (
    <fieldset className={className}>
      <legend className="mb-1.5 flex items-center gap-1.5">Item type {chosen && <span className="text-sm font-normal text-muted">· {chosen.name}</span>}</legend>
      <input type="hidden" name={name} value={creating ? '__new' : itemId} />
      {creating && <input type="hidden" name={`${name}_group`} value={groupId} />}
      {/* Item categories: choosing one shows its types (and, while making a new type, is where it goes). */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Item category">
        {groups.map((g) => (
          <button key={g.label} type="button" aria-pressed={groupLabel === g.label} onClick={() => setGroupLabel(g.label)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${groupLabel === g.label ? 'border-ink bg-ink text-bg' : 'border-line bg-bg text-muted'}`}>
            {g.label}
          </button>
        ))}
        {creating && (
          <button type="button" aria-pressed={newGroup} onClick={() => setGroupLabel(NEW_GROUP)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${newGroup ? 'border-ink bg-ink text-bg' : 'border-dashed border-line bg-bg text-muted'}`}>+ New item category</button>
        )}
      </div>
      {newGroup && <input className={`${inputCls} mt-2`} name={`${name}_newGroup`} maxLength={60} placeholder="New item category name" aria-label="New item category name" required />}
      {!newGroup && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Item type">
          {(shown?.items ?? []).map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={itemId === c.id} onClick={() => pick(c.id)} className={pill(itemId === c.id)}>
              <TypeIcon type={c} size={20} />{c.name}
            </button>
          ))}
          {allowNew && (
            <button type="button" role="radio" aria-checked={creating} onClick={() => pick(NEW_TYPE)} className={`${pill(creating)} ${creating ? '' : 'border-dashed'}`}>+ New item type</button>
          )}
        </div>
      )}
      {creating && (
        <input className={`${inputCls} mt-2`} name={`${name}_newType`} maxLength={60} placeholder={`New item type name${newGroup ? '' : `, in ${groupLabel}`}`} aria-label="New item type name" required />
      )}
      {/* The chosen type sits in another item category than the one showing: say so, so it is not lost from view. */}
      {chosen && chosen.grp !== groupLabel && !creating && <p className="mt-1.5 text-xs font-normal text-muted">Chosen: {chosen.name} ({chosen.grp})</p>}
    </fieldset>
  );
}
