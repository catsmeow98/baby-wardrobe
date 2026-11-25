import type { CategoryRow } from '@/lib/db';

export interface CategoryGroup {
  label: string;
  items: CategoryRow[];
}

/** Groups categories for display, keeping their order. The person's own categories land in the last group. */
export function groupCategories(categories: readonly CategoryRow[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  const byLabel = new Map<string, CategoryGroup>();
  for (const c of categories) {
    const label = c.grp ?? 'Your categories';
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
