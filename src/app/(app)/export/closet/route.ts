import { getContext } from '@/lib/context';
import { csvResponse, csvRows } from '@/lib/csv';
import { COLORS, CONDITIONS, GENDERS, SEASONS, STATUSES, sizeName } from '@/lib/db';
import type { ItemRow, SizeLabelRow } from '@/lib/db';

export const dynamic = 'force-dynamic';

const label = (list: readonly (readonly [string, string])[], v: string | null) => list.find(([k]) => k === v)?.[1] ?? v ?? '';

/** Every item for every child, as a spreadsheet file. */
export async function GET() {
  const ctx = await getContext();
  const [{ data: items }, { data: labels }, { data: brands }] = await Promise.all([
    ctx.supabase.from('inventory_items').select('*').order('created_at'),
    ctx.supabase.from('size_labels').select('id, size_id, label, sort_order'),
    ctx.supabase.from('brands').select('id, name'),
  ]);
  const labelById = new Map(((labels ?? []) as SizeLabelRow[]).map((l) => [l.id, l.label]));
  const brandById = new Map(((brands ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name]));
  const childName = new Map(ctx.children.map((c) => [c.id, c.name]));
  const size = (id: string | null) => { const s = id ? ctx.sizeById.get(id) : undefined; return s ? sizeName(s) : ''; };
  const rows: unknown[][] = [['Child', 'Name', 'Item type', 'Item category', 'Brand', 'Quantity', 'Tag size', 'Fits from', 'Fits through', 'Condition', 'Gender', 'Color', 'Season', 'Status', 'Notes']];
  for (const i of (items ?? []) as ItemRow[]) {
    const c = ctx.catById.get(i.category_id);
    rows.push([
      childName.get(i.child_id) ?? '', i.name, c?.name ?? '', c?.grp ?? '', brandById.get(i.brand_id ?? '') ?? '', i.quantity,
      i.label_id ? labelById.get(i.label_id) ?? '' : i.custom_tag ?? '', size(i.fit_from_size_id), size(i.fit_to_size_id),
      label(CONDITIONS, i.condition), label(GENDERS, i.gender), label(COLORS.map(([v, l]) => [v, l] as const), i.color), label(SEASONS, i.season), label(STATUSES, i.status), i.notes ?? '',
    ]);
  }
  return csvResponse('baby-wardrobe-closet.csv', csvRows(rows));
}
