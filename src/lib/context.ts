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

  const [{ data: kids }, { data: sizeData }, { data: catData }, { data: groupData }] = await Promise.all([
    supabase.from('children').select('id, name, birth_date, current_size_id, growth_reference').order('created_at'),
    supabase.from('sizes').select('id, label, alias, sort_order').order('sort_order'),
    supabase.from('categories').select('id, name, sort_order, owner_id, group_id, category_groups(name, sort_order)'),
    supabase.from('category_groups').select('id, name, sort_order, owner_id').order('sort_order').order('name'),
  ]);
  const children = (kids ?? []) as ChildRow[];
  const sizes = (sizeData ?? []) as SizeRow[];
  const groups = (groupData ?? []) as GroupRow[];
  // Each item carries its category's name and order, so pickers and lists can group items without another lookup.
  type Raw = { id: string; name: string; sort_order: number; owner_id: string | null; group_id: string; category_groups: { name: string; sort_order: number } | { name: string; sort_order: number }[] | null };
  const categories: CategoryRow[] = ((catData ?? []) as unknown as Raw[])
    .map((r) => {
      const g = Array.isArray(r.category_groups) ? r.category_groups[0] : r.category_groups;
      return { id: r.id, name: r.name, sort_order: r.sort_order, owner_id: r.owner_id, group_id: r.group_id, grp: g?.name ?? 'Other', group_order: g?.sort_order ?? 900 };
    })
    .sort((a, b) => a.group_order - b.group_order || a.grp.localeCompare(b.grp) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const picked = (await cookies()).get(CHILD_COOKIE)?.value;
  const active = children.find((c) => c.id === picked) ?? children[0] ?? null;

  const orderOf = new Map(sizes.map((s) => [s.id, s.sort_order]));
  const sizeById = new Map(sizes.map((s) => [s.id, s]));
  const sizeByOrder = new Map(sizes.map((s) => [s.sort_order, s]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const currentSize = active?.current_size_id ? (orderOf.get(active.current_size_id) ?? null) : null;

  return { supabase, user, children, active, sizes, categories, groups, orderOf, sizeById, sizeByOrder, catById, currentSize };
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
