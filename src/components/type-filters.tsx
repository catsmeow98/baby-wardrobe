import { MultiSelect } from '@/components/multi-select';
import { groupCategories } from '@/lib/categories';
import { sizeName } from '@/lib/db';
import type { CategoryRow, GroupRow, SizeRow } from '@/lib/db';

/**
 * The three filters used wherever a list can be filtered: item category, item type and size, each taking several choices.
 * Cells for a GET form. Field names are group, cat and size (a size's sort order), repeated once per choice.
 * Pass showSize={false} where size is chosen another way.
 */
export function TypeFilters({ categories, groups, sizes, group = [], cat = [], size = [], sizeLabel = 'Size', showSize = true }: {
  categories: readonly CategoryRow[];
  groups: readonly GroupRow[];
  sizes: readonly SizeRow[];
  group?: readonly string[];
  cat?: readonly string[];
  size?: readonly string[];
  sizeLabel?: string;
  showSize?: boolean;
}) {
  const used = new Set(categories.map((c) => c.group_id));
  return (
    <>
      <MultiSelect label="Item category" name="group" defaultSelected={group}
        options={groups.filter((g) => used.has(g.id)).map((g) => ({ value: g.id, label: g.name }))} />
      <MultiSelect label="Item type" name="cat" defaultSelected={cat}
        options={groupCategories(categories).flatMap((g) => g.items.map((c) => ({ value: c.id, label: c.name, section: g.label })))} />
      {showSize && (
        <MultiSelect label={sizeLabel} name="size" defaultSelected={size}
          options={sizes.map((s) => ({ value: String(s.sort_order), label: sizeName(s) }))} />
      )}
    </>
  );
}
