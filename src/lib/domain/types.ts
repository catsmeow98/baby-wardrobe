export type ItemStatus = 'active' | 'stored' | 'daycare' | 'outgrown' | 'donated' | 'sold';
export type Condition = 'new' | 'like_new' | 'good' | 'worn' | 'unusable';
export type FitState = 'fits' | 'notyet' | 'outgrown' | 'unknown';
export type ShoppingStatus = 'needed' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

/** An inventory record. Fit range ends are size-group orders; null when the fit is unknown. */
export interface InventoryItem {
  id: string;
  childId: string;
  categoryId: string;
  quantity: number;
  status: ItemStatus;
  condition: Condition;
  fitFrom: number | null;
  fitTo: number | null;
  fitOverride?: Exclude<FitState, 'unknown'> | null;
}

export interface Goal {
  childId: string;
  categoryId: string;
  size: number;
  target: number;
}

export interface ShoppingItem {
  id: string;
  childId: string;
  categoryId: string;
  size: number;
  needed: number;
  ordered: number;
  received: number;
  status: ShoppingStatus;
}

export interface GoalProgress extends Goal {
  owned: number;
  incoming: number;
  remaining: number;
}
