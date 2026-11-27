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
/** Whether an item type passes the item category and item type filters. Each takes one id or several (any of them); empty means any. */
export function matchesCategory(c: CategoryRow | undefined, f: { group?: string | readonly string[]; cat?: string | readonly string[] }): boolean {
  const groups = typeof f.group === 'string' ? (f.group ? [f.group] : []) : (f.group ?? []);
  const cats = typeof f.cat === 'string' ? (f.cat ? [f.cat] : []) : (f.cat ?? []);
  if (!c) return groups.length === 0 && cats.length === 0;
  if (cats.length && !cats.includes(c.id)) return false;
  if (groups.length && !groups.includes(c.group_id)) return false;
  return true;
}

/** The pickable item types, plus the one a record already uses even if the person has since deleted it, so editing never changes it silently. */
export function withCurrent(visible: readonly CategoryRow[], all: ReadonlyMap<string, CategoryRow>, currentId: string | undefined): CategoryRow[] {
  const cur = currentId ? all.get(currentId) : undefined;
  return cur && !visible.some((c) => c.id === cur.id) ? [...visible, cur] : [...visible];
}
