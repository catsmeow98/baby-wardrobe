import type { CategoryRow } from '@/lib/db';

export interface CategoryGroup {
  label: string;
  items: CategoryRow[];
}

/** Groups items by category for display, keeping their order. Categories with no items are not listed. */
export function groupCategories(categories: readonly CategoryRow[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  const byLabel = new Map<string, CategoryGroup>();
  for (const c of categories) {
    const label = c.grp;
    let g = byLabel.get(label);
    if (!g) {
      g = { label, items: [] };
      byLabel.set(label, g);
      groups.push(g);
    }
    g.items.push(c);
  }
  return groups;
}

/** Does an item type pass the item category and item type filters? An empty filter passes everything. */
export function matchesCategory(c: CategoryRow | undefined, f: { group?: string; cat?: string }): boolean {
  if (!c) return !f.group && !f.cat;
  if (f.cat && c.id !== f.cat) return false;
  if (f.group && c.group_id !== f.group) return false;
  return true;
}

/** The pickable item types, plus the one a record already uses even if the person has since deleted it, so editing never changes it silently. */
export function withCurrent(visible: readonly CategoryRow[], all: ReadonlyMap<string, CategoryRow>, currentId: string | undefined): CategoryRow[] {
  const cur = currentId ? all.get(currentId) : undefined;
  return cur && !visible.some((c) => c.id === cur.id) ? [...visible, cur] : [...visible];
}
