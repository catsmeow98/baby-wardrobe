import type { CategoryRow } from '@/lib/db';
import { groupCategories } from '@/lib/categories';

/** The options of a category <select>, grouped so a long list stays easy to scan. */
export function CategoryOptions({ categories }: { categories: readonly CategoryRow[] }) {
  return (
    <>
      {groupCategories(categories).map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      ))}
    </>
  );
}
