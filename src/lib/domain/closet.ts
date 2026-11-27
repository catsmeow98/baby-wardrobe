import { fitStateFor } from './fit';
import type { FitState, InventoryItem } from './types';

/**
 * Work out an item's fit range from what the parent picked. Everything is a size-group order.
 * - Nothing picked: the fit is unknown (both ends null).
 * - Only a tag size: the item fits that size.
 * - "Fits from" defaults to the tag size, and "fits through" defaults to "fits from".
 * - A custom tag range (tagTo) fills both ends when neither is picked.
 */
export function resolveFitRange(
  tag: number | null,
  from: number | null,
  to: number | null,
  tagTo: number | null = null,
): { fitFrom: number | null; fitTo: number | null } | { error: string } {
  const start = from ?? tag ?? to;
  if (start === null) return { fitFrom: null, fitTo: null };
  const end = to ?? (from === null && tagTo !== null ? tagTo : start);
  if (end < start) return { error: 'Fits through must be the same size as fits from, or larger.' };
  return { fitFrom: start, fitTo: end };
}

/** A blank name falls back to brand plus category, so quick entries still get a readable name. */
export function autoName(name: string, brand: string, categoryName: string): string {
  const typed = name.trim();
  if (typed) return typed;
  const made = [brand.trim(), categoryName.toLowerCase()].filter(Boolean).join(' ') || categoryName;
  return made.charAt(0).toUpperCase() + made.slice(1);
}

export interface ClosetItem extends InventoryItem {
  name: string;
  brand: string | null;
  notes: string | null;
  season: string;
  /** Size group of the tag printed on the item, or null when no tag was entered. */
  tagGroup: number | null;
}

export interface ClosetFilters {
  q?: string;
  fit?: FitState | '';
  categoryId?: string;
  tagGroup?: number | null;
  status?: string;
  season?: string;
}

export function filterItems(items: readonly ClosetItem[], f: ClosetFilters, currentSize: number | null, currentTo?: number | null): ClosetItem[] {
  const q = f.q?.trim().toLowerCase();
  return items.filter((i) => {
    if (q && !`${i.name} ${i.brand ?? ''} ${i.notes ?? ''}`.toLowerCase().includes(q)) return false;
    if (f.fit && fitStateFor(i, currentSize, currentTo) !== f.fit) return false;
    if (f.categoryId && i.categoryId !== f.categoryId) return false;
    if (f.tagGroup !== undefined && f.tagGroup !== null && i.tagGroup !== f.tagGroup) return false;
    if (f.status && i.status !== f.status) return false;
    if (f.season && i.season !== f.season) return false;
    return true;
  });
}
