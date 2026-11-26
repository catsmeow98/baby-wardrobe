import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { CategoryRow, ChildRow, GroupRow, ItemRow, ShoppingRow, SizeRow, GoalRow } from '@/lib/db';
import type { ClosetItem, Goal, InventoryItem, ShoppingItem } from '@/lib/domain';

export const CHILD_COOKIE = 'bw_child';

/** Loads who is signed in, their children, the active child, and the shared size and category lists. */
export async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: kids }, { data: sizeData }, { data: catData }, { data: groupData }, { data: catPrefData }, { data: groupPrefData }] = await Promise.all([
    supabase.from('children').select('id, name, birth_date, current_size_id, growth_reference').order('created_at'),
    supabase.from('sizes').select('id, label, alias, sort_order').order('sort_order'),
    supabase.from('categories').select('id, name, sort_order, owner_id, group_id'),
    supabase.from('category_groups').select('id, name, sort_order, owner_id'),
    supabase.from('user_category_prefs').select('category_id, name, group_id, hidden'),
    supabase.from('user_group_prefs').select('group_id, name, hidden'),
  ]);
  const children = (kids ?? []) as ChildRow[];
  const sizes = (sizeData ?? []) as SizeRow[];
  // The person's own renames, moves and hides are applied on top of the shared built-ins here, once, for every page.
  const gPref = new Map(((groupPrefData ?? []) as { group_id: string; name: string | null; hidden: boolean }[]).map((p) => [p.group_id, p]));
  const cPref = new Map(((catPrefData ?? []) as { category_id: string; name: string | null; group_id: string | null; hidden: boolean }[]).map((p) => [p.category_id, p]));
  const allGroups: GroupRow[] = ((groupData ?? []) as { id: string; name: string; sort_order: number; owner_id: string | null }[])
    .map((g) => ({ ...g, base_name: g.name, name: gPref.get(g.id)?.name ?? g.name, hidden: gPref.get(g.id)?.hidden ?? false, is_default: g.owner_id === null }))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const groupById = new Map(allGroups.map((g) => [g.id, g]));
  const allCategories: CategoryRow[] = ((catData ?? []) as { id: string; name: string; sort_order: number; owner_id: string | null; group_id: string }[])
    .map((r) => {
      const p = cPref.get(r.id);
      const gid = p?.group_id && groupById.has(p.group_id) ? p.group_id : r.group_id;
      const g = groupById.get(gid);
      return {
        id: r.id, name: p?.name ?? r.name, base_name: r.name, sort_order: r.sort_order, owner_id: r.owner_id, group_id: gid,
        grp: g?.name ?? 'Other', group_order: g?.sort_order ?? 900, is_default: r.owner_id === null, hidden: p?.hidden ?? false,
      };
    })
    .sort((a, b) => a.group_order - b.group_order || a.grp.localeCompare(b.grp) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  // Pickers and lists show only what is not hidden. Records that already use a hidden item type still show its name.
  const categories = allCategories.filter((c) => !c.hidden && !groupById.get(c.group_id)?.hidden);
  const groups = allGroups.filter((g) => !g.hidden);
  const picked = (await cookies()).get(CHILD_COOKIE)?.value;
  const active = children.find((c) => c.id === picked) ?? children[0] ?? null;

  const orderOf = new Map(sizes.map((s) => [s.id, s.sort_order]));
  const sizeById = new Map(sizes.map((s) => [s.id, s]));
  const sizeByOrder = new Map(sizes.map((s) => [s.sort_order, s]));
  const catById = new Map(allCategories.map((c) => [c.id, c]));
  const currentSize = active?.current_size_id ? (orderOf.get(active.current_size_id) ?? null) : null;

  return { supabase, user, children, active, sizes, categories, allCategories, groups, allGroups, orderOf, sizeById, sizeByOrder, catById, currentSize };
}
export type Ctx = Awaited<ReturnType<typeof getContext>>;

const FIT_OVERRIDES = ['fits', 'notyet', 'small', 'outgrown'];

/** Converts database rows into the shapes the tested domain code uses. */
export function toInventory(rows: ItemRow[], ctx: Pick<Ctx, 'orderOf'>, tagGroupOf?: Map<string, number>): ClosetItem[] {
  return rows.map((r) => ({
    id: r.id,
    childId: r.child_id,
    categoryId: r.category_id,
    quantity: r.quantity,
    status: r.status as InventoryItem['status'],
    condition: r.condition as InventoryItem['condition'],
    fitFrom: r.fit_from_size_id ? (ctx.orderOf.get(r.fit_from_size_id) ?? null) : null,
    fitTo: r.fit_to_size_id ? (ctx.orderOf.get(r.fit_to_size_id) ?? null) : null,
    fitOverride: FIT_OVERRIDES.includes(r.fit_override ?? '') ? (r.fit_override as InventoryItem['fitOverride']) : null,
    name: r.name,
    brand: null,
    notes: r.notes,
    season: r.season,
    tagGroup: r.label_id ? (tagGroupOf?.get(r.label_id) ?? null) : null,
  }));
}

export function toGoals(rows: GoalRow[], ctx: Pick<Ctx, 'orderOf'>): Goal[] {
  return rows.map((g) => ({ childId: g.child_id, categoryId: g.category_id, size: ctx.orderOf.get(g.size_id) ?? 0, target: g.target_quantity }));
}

export function toShopping(rows: ShoppingRow[], ctx: Pick<Ctx, 'orderOf'>): ShoppingItem[] {
  return rows.map((s) => ({
    id: s.id, childId: s.child_id, categoryId: s.category_id, size: ctx.orderOf.get(s.size_id) ?? 0,
    needed: s.quantity_needed, ordered: s.quantity_ordered, received: s.quantity_received,
    status: s.status as ShoppingItem['status'],
  }));
}
