import { getContext } from '@/lib/context';
import { csvResponse, csvRows } from '@/lib/csv';
import { sizeName } from '@/lib/db';
import type { GoalRow } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Every goal for every child, as a spreadsheet file. */
export async function GET() {
  const ctx = await getContext();
  const { data } = await ctx.supabase.from('wardrobe_goals').select('*');
  const childName = new Map(ctx.children.map((c) => [c.id, c.name]));
  const rows: unknown[][] = [['Child', 'Size', 'Item category', 'Item type', 'Goal']];
  const list = ((data ?? []) as GoalRow[])
    .map((g) => ({ g, order: ctx.orderOf.get(g.size_id) ?? 0, c: ctx.catById.get(g.category_id) }))
    .sort((a, b) => (childName.get(a.g.child_id) ?? '').localeCompare(childName.get(b.g.child_id) ?? '') || a.order - b.order || (a.c?.group_order ?? 0) - (b.c?.group_order ?? 0) || (a.c?.sort_order ?? 0) - (b.c?.sort_order ?? 0));
  for (const { g, c } of list) {
    const s = ctx.sizeById.get(g.size_id);
    rows.push([childName.get(g.child_id) ?? '', s ? sizeName(s) : '', c?.grp ?? '', c?.name ?? '', g.target_quantity]);
  }
  return csvResponse('baby-wardrobe-goals.csv', csvRows(rows));
}
