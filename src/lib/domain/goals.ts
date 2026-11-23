import { countsTowardSize } from './fit';
import type { Goal, GoalProgress, InventoryItem, ShoppingItem } from './types';

/** Pieces still on the way: ordered minus received, for orders that are open. */
export const incomingFor = (shopping: readonly ShoppingItem[], childId: string, categoryId: string, size: number): number =>
  shopping
    .filter(
      (s) =>
        s.childId === childId &&
        s.categoryId === categoryId &&
        s.size === size &&
        (s.status === 'ordered' || s.status === 'partially_received'),
    )
    .reduce((sum, s) => sum + Math.max(0, s.ordered - s.received), 0);

export const ownedFor = (items: readonly InventoryItem[], childId: string, categoryId: string, size: number): number =>
  items
    .filter((i) => i.childId === childId && i.categoryId === categoryId && countsTowardSize(i, size))
    .reduce((sum, i) => sum + i.quantity, 0);

/** remaining = max(0, target - owned - incoming). A piece that fits several sizes counts toward each. */
export function goalProgress(
  goals: readonly Goal[],
  items: readonly InventoryItem[],
  shopping: readonly ShoppingItem[],
): GoalProgress[] {
  return goals.map((g) => {
    const owned = ownedFor(items, g.childId, g.categoryId, g.size);
    const incoming = incomingFor(shopping, g.childId, g.categoryId, g.size);
    return { ...g, owned, incoming, remaining: Math.max(0, g.target - owned - incoming) };
  });
}

export interface SizeProgress {
  size: number;
  goalTotal: number;
  ownedTowardGoal: number;
  /** Whole percent, or null when the size has no goals above zero. */
  percent: number | null;
}

/**
 * Completion for one size, built from the underlying goals. Each goal is capped at its target, so a surplus in one
 * category never hides a gap in another, and overlapping sizes are never summed together.
 */
export function sizeProgress(progress: readonly GoalProgress[], childId: string, size: number): SizeProgress {
  const rows = progress.filter((p) => p.childId === childId && p.size === size && p.target > 0);
  const goalTotal = rows.reduce((s, p) => s + p.target, 0);
  const ownedTowardGoal = rows.reduce((s, p) => s + Math.min(p.target, p.owned), 0);
  return { size, goalTotal, ownedTowardGoal, percent: goalTotal ? Math.round((100 * ownedTowardGoal) / goalTotal) : null };
}
