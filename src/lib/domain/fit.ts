import type { FitState, InventoryItem } from './types';

/** Active and stored pieces that are not unusable can be worn. */
export const isUsable = (i: Pick<InventoryItem, 'status' | 'condition'>): boolean =>
  (i.status === 'active' || i.status === 'stored') && i.condition !== 'unusable';

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
