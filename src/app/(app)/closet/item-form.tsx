import Link from 'next/link';
import { BrandInput, ChoicePills, ColorField } from '@/components/pickers';
import { CategoryPicker } from '@/components/category-picker';
import { FormCard, MoreCard } from '@/components/form-card';
import { btnCls, inputCls, labelCls } from '@/components/ui';
import { FitFields } from '@/components/fit-fields';
import { GENDERS, STATUSES } from '@/lib/db';
import { TagInput } from '@/components/tag-input';
import type { CategoryRow, SizeLabelRow, SizeRow } from '@/lib/db';
import { StickyActions } from '@/components/sticky-actions';

export interface ItemDefaults {
  id?: string;
  name?: string;
  categoryId?: string;
  brand?: string;
  quantity?: number;
  tagId?: string | null;
  customTag?: string | null;
  fitFromId?: string | null;
  fitToId?: string | null;
  gender?: string | null;
  color?: string | null;
  status?: string;
  tags?: string[];
  fitFeedback?: number | null;
  notes?: string | null;
}

interface Props {
  action: (formData: FormData) => Promise<void>;
  categories: CategoryRow[];
  sizes: SizeRow[];
  labels: SizeLabelRow[];
  brands: string[];
  defaults?: ItemDefaults;
  submitLabel: string;
  /** The closet address (filters included) to return to after saving. */
  back?: string;
  /** Recent item types and most-used brands, as shortcuts. */
  hints?: { recentTypeIds: string[]; topBrands: string[] };
  /** The account's tags, offered while typing. */
  tagNames?: string[];
}

export function ItemForm({ action, categories, sizes, labels, brands, defaults: d = {}, submitLabel, back, tagNames = [], hints = { recentTypeIds: [], topBrands: [] } }: Props) {
  const summary = [`Quantity ${d.quantity ?? 1}`, d.tags?.length ? `Tags: ${d.tags.join(', ')}` : null, STATUSES.find(([v]) => v === (d.status ?? 'active'))?.[1]].filter(Boolean).join(' · ');
  return (
    <form action={action} className="flex flex-col gap-3">
      {d.id && <input type="hidden" name="id" value={d.id} />}
      {back && <input type="hidden" name="back" value={back} />}
      <label className={labelCls}>Name
        <input className={inputCls} name="name" maxLength={160} defaultValue={d.name ?? ''} placeholder="Optional: made from brand and item type" />
      </label>
      <FormCard title="What is it">
        <CategoryPicker categories={categories} name="categoryId" defaultId={d.categoryId} allowNew recentIds={hints.recentTypeIds} />
        <span className="-mt-1 text-xs text-muted">Not listed? Tap + New type, or <Link className="text-accent underline" href="/categories">manage your item types</Link>.</span>
        <div className={labelCls}><BrandInput brands={brands} name="brand" defaultValue={d.brand ?? ''} top={hints.topBrands} /></div>
      </FormCard>
      <FormCard title="Size">
        <div className="grid grid-cols-2 gap-2.5">
          <FitFields
            labels={labels}
            sizes={sizes}
            defaults={{
              tagId: d.tagId ?? '',
              customTag: d.customTag ?? '',
              fitFromId: d.fitFromId ?? '',
              fitToId: d.fitToId ?? '',
              fitFeedback: d.fitFeedback === null || d.fitFeedback === undefined ? '' : String(d.fitFeedback),
            }}
          />
        </div>
      </FormCard>
      <FormCard title="How it looks">
        <ColorField name="color" defaultValue={d.color ?? ''} />
      </FormCard>
      {/* Open when editing, since status is what changes most often on an item. */}
      <MoreCard summary={summary} open={Boolean(d.id)}>
        <label className={`${labelCls} w-28`}>Quantity
          <input className={inputCls} type="number" name="quantity" min={1} max={999} defaultValue={d.quantity ?? 1} required />
        </label>
        <span className="-mt-3 text-xs text-muted">Above 1 makes a group, like a 5-pack.</span>
        <ChoicePills name="status" label="Status" options={STATUSES} defaultValue={d.status ?? 'active'} />
        <ChoicePills name="gender" label="Gender" options={[['', 'Not set'], ...GENDERS]} defaultValue={d.gender ?? ''} />
        <TagInput name="tags" suggestions={tagNames} defaultTags={d.tags} className={labelCls}
          hint="Anything you like: a season, a holiday, hand-me-down, stained." />
        <label className={labelCls}>Notes
          <textarea className={inputCls} name="notes" rows={2} maxLength={1000} defaultValue={d.notes ?? ''} placeholder="Runs small, long torso, and so on" />
        </label>
      </MoreCard>
      <StickyActions className="-mx-4 px-4">
        <button className={btnCls} type="submit">{submitLabel}</button>
        {back && <Link className="text-sm text-accent underline" href={back}>Cancel</Link>}
      </StickyActions>
    </form>
  );
}
