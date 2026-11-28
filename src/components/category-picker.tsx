'use client';

import { useState } from 'react';
import { labelCls, inputCls } from '@/components/ui';
import { groupCategories } from '@/lib/categories';
import type { CategoryRow } from '@/lib/db';
import { TypeIcon } from '@/components/item-icon';

const NEW_TYPE = '__new';
const NEW_GROUP = '__newgroup';
const RECENT = '__recent';

const tab = (on: boolean) =>
  `shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${on ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-muted'}`;
const tile = (on: boolean) =>
  `flex h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-center text-[11px] leading-tight ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'}`;

/**
 * Pick the item type: a row of item categories to swipe through (Recent first, when there is one), then that category's
 * types as a grid of icon tiles, ending with "+ New type". The form submits the type's id in a field called name. A new type
 * opens a name box and goes in the category showing (or a new one, from "+ New item category"); the form then submits
 * name = "__new" plus name_newType, name_group (an item category id, or "__new") and name_newGroup, and the server creates them.
 */
export function CategoryPicker({ categories, name, defaultId, className = labelCls, allowNew = false, onTypeChange, recentIds = [] }: {
  categories: readonly CategoryRow[];
  name: string;
  defaultId?: string;
  className?: string;
  allowNew?: boolean;
  /** Told the chosen item type when it changes (undefined while making a new one). */
  onTypeChange?: (type: CategoryRow | undefined) => void;
  /** Item types used most recently, newest first: the Recent tab. */
  recentIds?: readonly string[];
}) {
  const groups = groupCategories(categories);
  const recent = recentIds.flatMap((id) => categories.filter((c) => c.id === id));
  const start = categories.find((c) => c.id === defaultId) ?? groups[0]?.items[0];
  const [itemId, setItemId] = useState(start?.id ?? '');
  const [tabId, setTabId] = useState(start?.grp ?? groups[0]?.label ?? '');
  const creating = allowNew && itemId === NEW_TYPE;
  const newGroup = creating && tabId === NEW_GROUP;
  const chosen = categories.find((c) => c.id === itemId);
  const showing = tabId === RECENT ? recent : (groups.find((g) => g.label === tabId)?.items ?? []);
  const groupId = newGroup ? '__new' : (groups.find((g) => g.label === tabId)?.items[0]?.group_id ?? '');
  const pick = (id: string) => {
    setItemId(id);
    onTypeChange?.(categories.find((c) => c.id === id));
    // A new type goes in a real category: leave Recent for the chosen type's category.
    if (id === NEW_TYPE && tabId === RECENT) setTabId(chosen?.grp ?? groups[0]?.label ?? '');
  };

  return (
    <fieldset className={`min-w-0 ${className}`}>
      <legend className="mb-2">Item type {chosen && <span className="font-normal text-muted">· {chosen.name}</span>}</legend>
      <input type="hidden" name={name} value={creating ? '__new' : itemId} />
      {creating && <input type="hidden" name={`${name}_group`} value={groupId} />}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Item category">
        {recent.length > 0 && !creating && <button type="button" aria-pressed={tabId === RECENT} onClick={() => setTabId(RECENT)} className={tab(tabId === RECENT)}>Recent</button>}
        {groups.map((g) => (
          <button key={g.label} type="button" aria-pressed={tabId === g.label} onClick={() => setTabId(g.label)} className={tab(tabId === g.label)}>{g.label}</button>
        ))}
        {creating && <button type="button" aria-pressed={newGroup} onClick={() => setTabId(NEW_GROUP)} className={`${tab(newGroup)} ${newGroup ? '' : 'border-dashed'}`}>+ New item category</button>}
      </div>
      {newGroup ? (
        <input className={`${inputCls} mt-2`} name={`${name}_newGroup`} maxLength={60} placeholder="New item category name" aria-label="New item category name" required />
      ) : (
        <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Item type">
          {showing.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={itemId === c.id} onClick={() => pick(c.id)} className={tile(itemId === c.id)}>
              <TypeIcon type={c} size={22} />
              <span className="line-clamp-2">{c.name}</span>
            </button>
          ))}
          {allowNew && (
            <button type="button" role="radio" aria-checked={creating} onClick={() => pick(NEW_TYPE)}
              className={creating ? tile(true) : 'flex h-16 items-center justify-center rounded-xl border border-dashed border-line px-1 text-center text-[11px] text-accent'}>+ New type</button>
          )}
        </div>
      )}
      {creating && (
        <input className={`${inputCls} mt-2`} name={`${name}_newType`} maxLength={60} placeholder={newGroup ? 'New item type name' : `New item type name, in ${tabId}`} aria-label="New item type name" required />
      )}
    </fieldset>
  );
}
