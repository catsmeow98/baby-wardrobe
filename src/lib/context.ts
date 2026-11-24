import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { CategoryRow, ChildRow, ItemRow, ShoppingRow, SizeRow, GoalRow } from '@/lib/db';
import type { ClosetItem, Goal, InventoryItem, ShoppingItem } from '@/lib/domain';

export const CHILD_COOKIE = 'bw_child';

/** Loads who is signed in, their children, the active child, and the shared size and category lists. */
export async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: kids }, { data: sizeData }, { data: catData }] = await Promise.all([
    supabase.from('children').select('id, name, birth_date, current_size_id').order('created_at'),
    supabase.from('sizes').select('id, label, alias, sort_order').order('sort_order'),
    supabase.from('categories').select('id, name, sort_order').order('sort_order'),
  ]);
  const children = (kids ?? []) as ChildRow[];
  const sizes = (sizeData ?? []) as SizeRow[];
  const categories = (catData ?? []) as CategoryRow[];
  const picked = (await cookies()).get(CHILD_COOKIE)?.value;
  const active = children.find((c) => c.id === picked) ?? children[0] ?? null;

  const orderOf = new Map(sizes.map((s) => [s.id, s.sort_order]));
  const sizeById = new Map(sizes.map((s) => [s.id, s]));
  const sizeByOrder = new Map(sizes.map((s) => [s.sort_order, s]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const currentSize = active?.current_size_id ? (orderOf.get(active.current_size_id) ?? null) : null;

  return { supabase, user, children, active, sizes, categories, orderOf, sizeById, sizeByOrder, catById, currentSize };
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
