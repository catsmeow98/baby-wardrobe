/**
 * Shapes the shopping gaps into a table: one row per item type, one column per size, each cell the number still needed.
 * Rows follow the order of the item types given (the app's own order); columns run from the smallest size to the largest.
 */
export interface Gap {
  categoryId: string;
  /** Size order (position in the size list). */
  size: number;
  remaining: number;
}

export interface NeedsTable {
  sizes: number[];
  rows: { categoryId: string; cells: Map<number, number>; total: number }[];
  columnTotals: Map<number, number>;
  grandTotal: number;
}

export function buildNeedsTable(gaps: readonly Gap[], categoryOrder: readonly string[]): NeedsTable {
  const rank = new Map(categoryOrder.map((id, i) => [id, i]));
  const sizes = [...new Set(gaps.filter((g) => g.remaining > 0).map((g) => g.size))].sort((a, b) => a - b);
  const byCategory = new Map<string, Map<number, number>>();
  const columnTotals = new Map<number, number>();
  let grandTotal = 0;
  for (const g of gaps) {
    if (!(g.remaining > 0)) continue;
    const cells = byCategory.get(g.categoryId) ?? new Map<number, number>();
    cells.set(g.size, (cells.get(g.size) ?? 0) + g.remaining);
    byCategory.set(g.categoryId, cells);
    columnTotals.set(g.size, (columnTotals.get(g.size) ?? 0) + g.remaining);
    grandTotal += g.remaining;
  }
  const rows = [...byCategory.entries()]
    .map(([categoryId, cells]) => ({ categoryId, cells, total: [...cells.values()].reduce((a, b) => a + b, 0) }))
    .sort((a, b) => (rank.get(a.categoryId) ?? 9999) - (rank.get(b.categoryId) ?? 9999));
  return { sizes, rows, columnTotals, grandTotal };
}
