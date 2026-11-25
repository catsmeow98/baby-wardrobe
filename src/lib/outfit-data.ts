import { toInventory, type Ctx } from '@/lib/context';
import type { ItemRow } from '@/lib/db';
import { fitStateFor } from '@/lib/domain';
import { signedUrls } from '@/lib/photos';

/** An item as the outfit picker and collage show it. */
export interface PickItem {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  groupId: string;
  color: string | null;
  photoUrl: string | null;
  /** A cutout photo is a PNG: it is shown whole on a plain tile, not cropped to fill. */
  cutout: boolean;
  /** Why this item may not suit right now, if so. */
  warn: string | null;
}

/** Turns closet rows into picker items, with a cover photo link and a warning when the item no longer fits or is not in use. */
export async function pickItems(ctx: Ctx, rows: readonly ItemRow[]): Promise<PickItem[]> {
  if (rows.length === 0) return [];
  const { data: photoData } = await ctx.supabase
    .from('inventory_photos').select('inventory_item_id, storage_path, sort_order').in('inventory_item_id', rows.map((r) => r.id)).order('sort_order');
  const cover = new Map<string, string>();
  for (const p of (photoData ?? []) as { inventory_item_id: string; storage_path: string }[]) if (!cover.has(p.inventory_item_id)) cover.set(p.inventory_item_id, p.storage_path);
  const urls = await signedUrls(ctx.supabase, [...cover.values()]);
  const inv = new Map(toInventory([...rows], ctx).map((i) => [i.id, i]));
  return rows.map((r) => {
    const t = ctx.catById.get(r.category_id);
    const state = inv.get(r.id) ? fitStateFor(inv.get(r.id)!, ctx.currentSize) : 'unknown';
    const path = cover.get(r.id);
    return {
      id: r.id,
      name: r.name,
      typeId: r.category_id,
      typeName: t?.name ?? 'Item',
      groupId: t?.group_id ?? '',
      color: r.color,
      photoUrl: path ? (urls.get(path) ?? null) : null,
      cutout: Boolean(path?.endsWith('.png')),
      warn: r.status !== 'active' ? `Not in use (${r.status})` : state === 'small' || state === 'outgrown' ? 'No longer fits' : null,
    };
  });
}
