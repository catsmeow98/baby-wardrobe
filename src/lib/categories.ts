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
