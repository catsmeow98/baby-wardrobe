import type { FitState, InventoryItem } from './types';

/** Statuses of pieces being kept: in the closet, in storage, or spares at daycare. */
export const KEPT_STATUSES: readonly string[] = ['active', 'stored', 'daycare'];

/** Kept pieces that are not unusable can be worn, and count toward goals. */
export const isUsable = (i: Pick<InventoryItem, 'status' | 'condition'>): boolean =>
  KEPT_STATUSES.includes(i.status) && i.condition !== 'unusable';

/** True when the item's fit range includes the size. Items with an unknown fit never count. */
export const fitsSize = (i: Pick<InventoryItem, 'fitFrom' | 'fitTo'>, size: number): boolean =>
  i.fitFrom !== null && i.fitTo !== null && i.fitFrom <= size && size <= i.fitTo;

/** How many usable pieces fit a size, counting overlapping ranges (a 6-12M piece and a 9-18M piece both count toward 9-12M). */
export const countFitting = (items: readonly InventoryItem[], size: number): number =>
  items.filter((i) => countsTowardSize(i, size)).reduce((sum, i) => sum + i.quantity, 0);

/** Counts toward a goal at this size. */
export const countsTowardSize = (i: InventoryItem, size: number): boolean => isUsable(i) && fitsSize(i, size);

/**
 * How an item relates to the child's current size, which can be a range (currentSize up to currentTo, for a baby between
 * sizes). It fits when its fit range overlaps the current range, is not yet when it starts above the top, and is outgrown
 * when it ends below the bottom. A parent's override wins.
 */
export function fitState(i: InventoryItem, currentSize: number, currentTo: number = currentSize): FitState {
  if (i.fitOverride) return i.fitOverride;
  if (i.fitFrom === null || i.fitTo === null) return 'unknown';
  const top = Math.max(currentSize, currentTo);
  if (top < i.fitFrom) return 'notyet';
  if (currentSize > i.fitTo) return 'outgrown';
  return 'fits';
}

/** Like fitState, but a child with no current size set gets 'unknown' (unless a parent override applies). */
export function fitStateFor(i: InventoryItem, currentSize: number | null, currentTo?: number | null): FitState {
  if (i.fitOverride) return i.fitOverride;
  return currentSize === null ? 'unknown' : fitState(i, currentSize, currentTo ?? currentSize);
}
