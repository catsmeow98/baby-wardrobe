import { CategoryOptions } from '@/components/category-options';
import { inputCls } from '@/components/ui';
import { sizeName } from '@/lib/db';
import type { CategoryRow, GroupRow, SizeRow } from '@/lib/db';

/**
 * The three filters used wherever a list can be filtered: item category, item type and size. Cells for a GET form.
 * Field names are group, cat and size (a size's sort order). Pass showSize={false} where size is chosen another way.
 */
export function TypeFilters({ categories, groups, sizes, group, cat, size, sizeLabel = 'Size', showSize = true }: {
  categories: readonly CategoryRow[];
  groups: readonly GroupRow[];
  sizes: readonly SizeRow[];
  group?: string;
  cat?: string;
  size?: string;
  sizeLabel?: string;
  showSize?: boolean;
}) {
  const used = new Set(categories.map((c) => c.group_id));
  return (
    <>
      <select className={`${inputCls} w-auto`} name="group" defaultValue={group ?? ''} aria-label="Item category">
        <option value="">All item categories</option>
        {groups.filter((g) => used.has(g.id)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <select className={`${inputCls} w-auto`} name="cat" defaultValue={cat ?? ''} aria-label="Item type">
        <option value="">All item types</option>
        <CategoryOptions categories={categories} />
      </select>
      {showSize && (
        <select className={`${inputCls} w-auto`} name="size" defaultValue={size ?? ''} aria-label={sizeLabel}>
          <option value="">Any {sizeLabel.toLowerCase()}</option>
          {sizes.map((s) => <option key={s.id} value={s.sort_order}>{sizeName(s)}</option>)}
        </select>
      )}
    </>
  );
}
