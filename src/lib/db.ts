// Row shapes for the tables the pages read. Replace with `supabase gen types` output when convenient.
export interface SizeRow { id: string; label: string; alias: string | null; sort_order: number }
export interface SizeLabelRow { id: string; size_id: string; label: string; sort_order: number }
/**
 * An item category such as Sleep, which holds item types. Built-in ones (is_default) have a null owner and are shared,
 * but each person can rename or hide them. name is what that person sees, base_name is the built-in name, and hidden is the person's choice.
 */
export interface GroupRow { id: string; name: string; sort_order: number; owner_id: string | null; base_name: string; hidden: boolean; is_default: boolean }
/**
 * An item type such as Sleep sack. group_id is its item category (after any move the person made) and grp is that category's name.
 * The table is still called categories. name is the person's name for it, base_name the built-in one (the survey matches on that).
 */
export interface CategoryRow { id: string; name: string; sort_order: number; group_id: string; grp: string; group_order: number; owner_id: string | null; base_name: string; hidden: boolean; is_default: boolean }
export interface ChildRow { id: string; name: string; birth_date: string | null; current_size_id: string | null; current_size_to_id?: string | null; growth_reference: 'girls' | 'boys' | null; survey_answers?: string | null }
export interface MeasurementRow { id: string; child_id: string; measured_on: string; length_in: number | string }
export interface BrandRow { id: string; name: string; owner_id: string | null; size_offset: number | string }
export interface ItemRow {
  id: string; child_id: string; tracking_type: 'individual' | 'grouped'; name: string; brand_id: string | null;
  category_id: string; label_id: string | null; fit_from_size_id: string | null; fit_to_size_id: string | null;
  quantity: number; condition: string; season: string; status: string; fit_override: string | null;
  fit_feedback: number | null; notes: string | null; needs_details?: boolean; custom_tag: string | null; gender: string | null; color: string | null;
}
export interface GoalRow { id: string; child_id: string; category_id: string; size_id: string; target_quantity: number }
export interface ShoppingRow {
  id: string; child_id: string; category_id: string; size_id: string; quantity_needed: number; quantity_ordered: number;
  quantity_received: number; status: string; priority: string; estimated_price: number | null; notes: string | null;
  order_id?: string | null;
}

export const CONDITIONS: [string, string][] = [['new', 'New'], ['like_new', 'Like new'], ['good', 'Good'], ['worn', 'Worn'], ['unusable', 'Unusable']];
export const SEASONS: [string, string][] = [['year_round', 'Year-round'], ['spring', 'Spring'], ['summer', 'Summer'], ['fall', 'Fall'], ['winter', 'Winter']];
/** Item colors: stored value, label, and swatch. Multicolor has no single swatch (it is drawn as a color wheel). */
export const COLORS: readonly (readonly [string, string, string])[] = [
  ['white', 'White', '#ffffff'], ['black', 'Black', '#1f1f1f'], ['gray', 'Gray', '#9ca3af'], ['cream', 'Cream or beige', '#f3e9d2'],
  ['brown', 'Brown', '#8b5a2b'], ['red', 'Red', '#dc2626'], ['pink', 'Pink', '#f9a8d4'], ['orange', 'Orange', '#f97316'],
  ['yellow', 'Yellow', '#facc15'], ['green', 'Green', '#22c55e'], ['blue', 'Blue', '#3b82f6'], ['navy', 'Navy', '#1e3a8a'],
  ['purple', 'Purple', '#8b5cf6'], ['multicolor', 'Multicolor or pattern', '#cccccc'],
];
export const GENDERS = [['boy', 'Boy'], ['girl', 'Girl'], ['neutral', 'Neutral']] as const;
export const STATUSES: [string, string][] = [['active', 'Active'], ['stored', 'Stored'], ['daycare', 'Spare at daycare'], ['outgrown', 'Outgrown'], ['donated', 'Donated'], ['sold', 'Sold']];
export const FIT_LABELS: Record<string, string> = { fits: 'Fits now', notyet: 'Not yet', outgrown: 'Outgrown', unknown: 'Fit unknown' };
export const FIT_FEEDBACK: [string, string][] = [['-1', 'Ran small'], ['0', 'True to size'], ['1', 'Ran large']];
export const SHOPPING_STATUS: Record<string, string> = {
  needed: 'Needed', ordered: 'Ordered', partially_received: 'Partly received', received: 'Received', cancelled: 'Cancelled',
};

export const sizeName = (s: Pick<SizeRow, 'label' | 'alias'>) => (s.alias ? `${s.label} (${s.alias})` : s.label);
