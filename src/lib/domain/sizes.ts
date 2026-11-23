/**
 * Size model. A range and its top size are the same size (3-6M = 6M, 6-9M = 9M, and so on), so sizes are
 * grouped. Goals, fit ranges, filters and shopping use the group. An item's tag is the exact label printed on it.
 * These values mirror supabase/migrations/..._seed_defaults.sql.
 */
export interface SizeGroup {
  /** Position in the sequence. Fit-range comparisons use this number. */
  order: number;
  label: string;
  alias?: string;
}

export const SIZE_GROUPS: readonly SizeGroup[] = [
  { order: 0, label: 'Newborn' },
  { order: 1, label: '0-3M', alias: '3M' },
  { order: 2, label: '3-6M', alias: '6M' },
  { order: 3, label: '6-9M', alias: '9M' },
  { order: 4, label: '9-12M', alias: '12M' },
  { order: 5, label: '12-18M', alias: '18M' },
  { order: 6, label: '18-24M', alias: '24M' },
  { order: 7, label: '2T' },
  { order: 8, label: '3T' },
  { order: 9, label: '4T' },
];

export interface TagSize {
  /** Exact text printed on the tag. */
  label: string;
  /** The size group this tag belongs to. */
  group: number;
}

/** Every specific tag a parent can pick, in display order. */
export const TAG_SIZES: readonly TagSize[] = SIZE_GROUPS.flatMap((g) => [
  { label: g.label, group: g.order },
  ...(g.alias ? [{ label: g.alias, group: g.order }] : []),
]);

export const groupOfTag = (tag: string): number | undefined =>
  TAG_SIZES.find((t) => t.label.toLowerCase() === tag.trim().toLowerCase())?.group;

/** "6-9M (9M)" for groups that have an alias, otherwise just the label. */
export const displaySize = (order: number): string => {
  const g = SIZE_GROUPS[order];
  if (!g) throw new RangeError(`Unknown size order ${order}`);
  return g.alias ? `${g.label} (${g.alias})` : g.label;
};
