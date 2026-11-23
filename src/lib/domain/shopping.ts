import type { ShoppingItem } from './types';

export class ShoppingError extends Error {}

/** Mirrors public.order_shopping_item. */
export function orderItem(item: ShoppingItem, quantity: number): ShoppingItem {
  if (!Number.isInteger(quantity) || quantity < 1) throw new ShoppingError('quantity ordered must be at least 1');
  if (item.status === 'received' || item.status === 'cancelled') throw new ShoppingError(`a ${item.status} item cannot be ordered`);
  if (quantity < item.received) throw new ShoppingError('quantity ordered cannot be below what was already received');
  return {
    ...item,
    ordered: quantity,
    needed: Math.max(item.needed, quantity),
    status: item.received === 0 ? 'ordered' : item.received >= quantity ? 'received' : 'partially_received',
  };
}

export interface Receipt {
  item: ShoppingItem;
  /** Pieces to add to the closet as one grouped record. */
  addToInventory: { categoryId: string; size: number; quantity: number };
}

/** Mirrors public.receive_shopping_item: records a delivery without ever receiving more than is outstanding. */
export function receive(item: ShoppingItem, quantity: number): Receipt {
  if (!Number.isInteger(quantity) || quantity < 1) throw new ShoppingError('quantity received must be at least 1');
  if (item.status !== 'ordered' && item.status !== 'partially_received') throw new ShoppingError('only ordered items can be received');
  if (quantity > item.ordered - item.received) throw new ShoppingError('cannot receive more than is still outstanding');
  const received = item.received + quantity;
  return {
    item: { ...item, received, status: received >= item.ordered ? 'received' : 'partially_received' },
    addToInventory: { categoryId: item.categoryId, size: item.size, quantity },
  };
}
