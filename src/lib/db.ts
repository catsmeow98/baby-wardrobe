// Row shapes for the tables the pages read. Replace with `supabase gen types` output when convenient.
export interface SizeRow { id: string; label: string; alias: string | null; sort_order: number }
export interface SizeLabelRow { id: string; size_id: string; label: string; sort_order: number }
export interface CategoryRow { id: string; name: string; sort_order: number }
export interface ChildRow { id: string; name: string; birth_date: string | null; current_size_id: string | null }
export interface ItemRow {
  id: string; child_id: string; tracking_type: 'individual' | 'grouped'; name: string; brand_id: string | null;
  category_id: string; label_id: string | null; fit_from_size_id: string | null; fit_to_size_id: string | null;
  quantity: number; condition: string; season: string; status: string; fit_override: string | null;
  fit_feedback: number | null; notes: string | null;
}
export interface GoalRow { id: string; child_id: string; category_id: string; size_id: string; target_quantity: number }
export interface ShoppingRow {
  id: string; child_id: string; category_id: string; size_id: string; quantity_needed: number; quantity_ordered: number;
  quantity_received: number; status: string; priority: string; estimated_price: number | null; notes: string | null;
}

export const CONDITIONS: [string, string][] = [['new', 'New'], ['like_new', 'Like new'], ['good', 'Good'], ['worn', 'Worn'], ['unusable', 'Unusable']];
export const SEASONS: [string, string][] = [['year_round', 'Year-round'], ['spring', 'Spring'], ['summer', 'Summer'], ['fall', 'Fall'], ['winter', 'Winter']];
export const STATUSES: [string, string][] = [['active', 'Active'], ['stored', 'Stored'], ['outgrown', 'Outgrown'], ['donated', 'Donated'], ['sold', 'Sold']];
export const FIT_LABELS: Record<string, string> = { fits: 'Fits now', small: 'Getting small', notyet: 'Not yet', outgrown: 'Outgrown', unknown: 'Fit unknown' };
export const FIT_FEEDBACK: [string, string][] = [['-1', 'Ran small'], ['0', 'True to size'], ['1', 'Ran large']];
export const SHOPPING_STATUS: Record<string, string> = {
  needed: 'Needed', ordered: 'Ordered', partially_received: 'Partly received', received: 'Received', cancelled: 'Cancelled',
};

export const sizeName = (s: Pick<SizeRow, 'label' | 'alias'>) => (s.alias ? `${s.label} (${s.alias})` : s.label);
