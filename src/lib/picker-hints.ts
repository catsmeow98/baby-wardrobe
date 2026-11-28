import type { Ctx } from '@/lib/context';

/**
 * Shortcuts for the item form: the item types used most recently (up to 8, newest first) and the three most-used brands,
 * across all of the account's children.
 */
export async function loadPickerHints(ctx: Pick<Ctx, 'supabase'>): Promise<{ recentTypeIds: string[]; topBrands: string[] }> {
  const [{ data: recent }, { data: used }, { data: brands }] = await Promise.all([
    ctx.supabase.from('inventory_items').select('category_id, created_at').order('created_at', { ascending: false }).limit(200),
    ctx.supabase.from('inventory_items').select('brand_id').not('brand_id', 'is', null),
    ctx.supabase.from('brands').select('id, name'),
  ]);
  const recentTypeIds: string[] = [];
  for (const r of (recent ?? []) as { category_id: string }[]) {
    if (!recentTypeIds.includes(r.category_id)) recentTypeIds.push(r.category_id);
    if (recentTypeIds.length >= 8) break;
  }
  const count = new Map<string, number>();
  for (const r of (used ?? []) as { brand_id: string }[]) count.set(r.brand_id, (count.get(r.brand_id) ?? 0) + 1);
  const nameOf = new Map(((brands ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name]));
  const topBrands = [...count.entries()].sort((a, b) => b[1] - a[1]).flatMap(([id]) => (nameOf.has(id) ? [nameOf.get(id)!] : [])).slice(0, 3);
  return { recentTypeIds, topBrands };
}
