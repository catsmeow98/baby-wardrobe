import Link from 'next/link';
import { BrandSelect } from '@/components/brand-select';
import { CategoryPicker } from '@/components/category-picker';
import { PhotoPicker } from '@/components/photo-picker';
import { btnCls, inputCls, labelCls } from '@/components/ui';
import { FitFields } from '@/components/fit-fields';
import { COLORS, CONDITIONS, FIT_LABELS, GENDERS, SEASONS, STATUSES } from '@/lib/db';
import type { CategoryRow, SizeLabelRow, SizeRow } from '@/lib/db';

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
  condition?: string;
  gender?: string | null;
  color?: string | null;
  season?: string;
  status?: string;
  fitOverride?: string | null;
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
  /** Shows a photo field. Only for a new item, since existing items add photos from their own Photos section. */
  photos?: { userId: string; childId: string; removeBg?: boolean };
}

export function ItemForm({ action, categories, sizes, labels, brands, defaults: d = {}, submitLabel, photos, back }: Props) {
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      {d.id && <input type="hidden" name="id" value={d.id} />}
      {back && <input type="hidden" name="back" value={back} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${labelCls} sm:col-span-2`}>
          Name (optional)
          <input className={inputCls} name="name" maxLength={160} defaultValue={d.name ?? ''} placeholder="Made from brand and item type if left blank" />
        </label>
        <CategoryPicker categories={categories} name="categoryId" defaultId={d.categoryId} allowNew />
        <span className="text-xs text-muted sm:col-span-2">Not listed? Choose &quot;+ New item type&quot; above, or <Link className="text-accent underline" href="/categories">manage your item types</Link>.</span>
        <label className={labelCls}>
          Brand
          <BrandSelect brands={brands} name="brand" defaultValue={d.brand ?? ''} />
        </label>
        <label className={labelCls}>
          Quantity
          <input className={inputCls} type="number" name="quantity" min={1} max={999} defaultValue={d.quantity ?? 1} required />
          <span className="text-xs">Above 1 makes a group, like a 5-pack.</span>
        </label>
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
        <label className={labelCls}>
          Condition
          <select className={inputCls} name="condition" defaultValue={d.condition ?? 'good'}>
            {CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Gender (optional)
          <select className={inputCls} name="gender" defaultValue={d.gender ?? ''}>
            <option value="">Not set</option>
            {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Color (optional)
          <select className={inputCls} name="color" defaultValue={d.color ?? ''}>
            <option value="">Not set</option>
            {COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Season
          <select className={inputCls} name="season" defaultValue={d.season ?? 'year_round'}>
            {SEASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Status
          <select className={inputCls} name="status" defaultValue={d.status ?? 'active'}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Fit status
          <select className={inputCls} name="fitOverride" defaultValue={d.fitOverride ?? ''}>
            <option value="">Work it out from the child&apos;s size</option>
            {['fits', 'notyet', 'small', 'outgrown'].map((v) => <option key={v} value={v}>{FIT_LABELS[v]}</option>)}
          </select>
        </label>
        <label className={`${labelCls} sm:col-span-2`}>
          Notes
          <textarea className={inputCls} name="notes" rows={2} maxLength={1000} defaultValue={d.notes ?? ''} placeholder="Runs small, long torso, and so on" />
        </label>
        {photos && (
          <div className={`${labelCls} sm:col-span-2`}>
            Photos (optional)
            <PhotoPicker userId={photos.userId} childId={photos.childId} name="photoPath" removeBg={photos.removeBg} />
          </div>
        )}
      </div>
      <div className="sticky bottom-[4.5rem] z-10 -mx-4 -mb-4 flex items-center gap-3 rounded-b-xl border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:static md:m-0 md:border-0 md:bg-transparent md:p-0">
        <button className={btnCls} type="submit">{submitLabel}</button>
        {back && <Link className="text-sm text-accent underline" href={back}>Cancel</Link>}
      </div>
    </form>
  );
}
