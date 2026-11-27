/**
 * The in-store cart: how many of each item type and size are in the trolley right now. It lives on the device only (browser
 * storage, one cart per child), so it survives a lost signal or closing the app. Pure helpers here; the page does the storage.
 */
export type Cart = Record<string, number>;

export const MAX_IN_CART = 99;

/** One key per item type and size (the size's id, which never changes). */
export const cartKey = (categoryId: string, sizeId: string) => `${categoryId}|${sizeId}`;

export function splitKey(key: string): { categoryId: string; sizeId: string } | null {
  const [categoryId, sizeId, extra] = key.split('|');
  return categoryId && sizeId && extra === undefined ? { categoryId, sizeId } : null;
}

/** A copy of the cart with one line set to n (clamped to 0..MAX_IN_CART; 0 removes the line). */
export function setInCart(cart: Cart, key: string, n: number): Cart {
  const next = { ...cart };
  const q = Math.max(0, Math.min(MAX_IN_CART, Math.round(Number.isFinite(n) ? n : 0)));
  if (q === 0) delete next[key];
  else next[key] = q;
  return next;
}

/** What is still to find in the store: the need less what is in the cart, never below zero. */
export const leftToFind = (need: number, inCart: number) => Math.max(0, need - inCart);

export const cartPieces = (cart: Cart) => Object.values(cart).reduce((t, n) => t + n, 0);

/** The cart's lines, for sending to the server: only well-formed keys with a quantity of 1 or more. */
export function cartLines(cart: Cart): { categoryId: string; sizeId: string; qty: number }[] {
  return Object.entries(cart).flatMap(([k, qty]) => {
    const p = splitKey(k);
    return p && qty > 0 ? [{ ...p, qty }] : [];
  });
}

/** Reads a stored cart, dropping anything malformed. */
export function parseCart(raw: string | null): Cart {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    let cart: Cart = {};
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) if (splitKey(k) && typeof n === 'number') cart = setInCart(cart, k, n);
    return cart;
  } catch {
    return {};
  }
}

export const cartStorageKey = (childId: string) => `bw-cart:${childId}`;
