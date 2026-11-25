import type { FitState, InventoryItem } from './types';

/** Statuses of pieces being kept: in the closet, in storage, or spares at daycare. */
export const KEPT_STATUSES: readonly string[] = ['active', 'stored', 'daycare'];

/** Kept pieces that are not unusable can be worn, and count toward goals. */
export const isUsable = (i: Pick<InventoryItem, 'status' | 'condition'>): boolean =>
  KEPT_STATUSES.includes(i.status) && i.condition !== 'unusable';

/** True when the item's fit range includes the size. Items with an unknown fit never count. */
export const fitsSize = (i: Pick<InventoryItem, 'fitFrom' | 'fitTo'>, size: number): boolean =>
  i.fitFrom !== null && i.fitTo !== null && i.fitFrom <= size && size <= i.fitTo;

/** Counts toward a goal at this size. */
export const countsTowardSize = (i: InventoryItem, size: number): boolean => isUsable(i) && fitsSize(i, size);

/** How an item relates to the child's current size. A parent's override wins. */
export function fitState(i: InventoryItem, currentSize: number): FitState {
  if (i.fitOverride) return i.fitOverride;
  if (i.fitFrom === null || i.fitTo === null) return 'unknown';
  if (currentSize < i.fitFrom) return 'notyet';
  if (currentSize > i.fitTo) return 'outgrown';
  if (currentSize === i.fitTo && i.fitFrom < i.fitTo) return 'small';
  return 'fits';
}

/** Like fitState, but a child with no current size set gets 'unknown' (unless a parent override applies). */
export function fitStateFor(i: InventoryItem, currentSize: number | null): FitState {
  if (i.fitOverride) return i.fitOverride;
  return currentSize === null ? 'unknown' : fitState(i, currentSize);
}
