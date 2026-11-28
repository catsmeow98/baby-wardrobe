import type { Ctx } from '@/lib/context';

export const MAX_TAG_LENGTH = 30;
export const MAX_TAGS_PER_ITEM = 20;

/** Tidies a tag as typed: trimmed, inner spaces collapsed. */
export const cleanTag = (t: string): string => t.trim().replace(/\s+/g, ' ');

/**
 * Reads a tags field (a JSON list of names) into clean, distinct names (case-insensitive; the first spelling wins), keeping
 * at most MAX_TAGS_PER_ITEM. Anything unreadable gives no tags; overlong names are cut to MAX_TAG_LENGTH.
 */
export function parseTags(raw: unknown, ...more: string[][]): string[] {
  let list: unknown = [];
  try {
    list = typeof raw === 'string' && raw ? JSON.parse(raw) : [];
  } catch {
    list = [];
  }
  const names = [...(Array.isArray(list) ? list : []), ...more.flat()];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (typeof n !== 'string') continue;
    const t = cleanTag(n).slice(0, MAX_TAG_LENGTH).trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= MAX_TAGS_PER_ITEM) break;
  }
  return out;
}

export interface TagRow { id: string; name: string }

/** The account's tags (sorted by name) and each item's tag names. */
export async function loadTags(ctx: Pick<Ctx, 'supabase'>, itemIds?: string[]): Promise<{ tags: TagRow[]; byItem: Map<string, string[]>; idsByItem: Map<string, string[]> }> {
  const [{ data: tagData }, { data: linkData }] = await Promise.all([
    ctx.supabase.from('tags').select('id, name'),
    itemIds && itemIds.length === 0
      ? Promise.resolve({ data: [] as { item_id: string; tag_id: string }[] })
      : itemIds && itemIds.length <= 300
        ? ctx.supabase.from('item_tags').select('item_id, tag_id').in('item_id', itemIds)
        : ctx.supabase.from('item_tags').select('item_id, tag_id'),
  ]);
  const tags = ((tagData ?? []) as TagRow[]).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const nameOf = new Map(tags.map((t) => [t.id, t.name]));
  const byItem = new Map<string, string[]>();
  const idsByItem = new Map<string, string[]>();
  for (const l of (linkData ?? []) as { item_id: string; tag_id: string }[]) {
    const n = nameOf.get(l.tag_id);
    if (!n) continue;
    byItem.set(l.item_id, [...(byItem.get(l.item_id) ?? []), n]);
    idsByItem.set(l.item_id, [...(idsByItem.get(l.item_id) ?? []), l.tag_id]);
  }
  for (const v of byItem.values()) v.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return { tags, byItem, idsByItem };
}

/** Replaces the tags on each listed item. Returns false if it could not be saved. */
export async function saveTags(ctx: Pick<Ctx, 'supabase'>, entries: { item: string; tags: string[] }[]): Promise<boolean> {
  if (!entries.length) return true;
  const { error } = await ctx.supabase.rpc('set_item_tags', { p_items: entries });
  if (error) console.error('Tags could not be saved', error);
  return !error;
}
