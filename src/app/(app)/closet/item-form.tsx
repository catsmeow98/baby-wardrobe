import Link from 'next/link';
import { CategoryOptions } from '@/components/category-options';
import { PhotoPicker } from '@/components/photo-picker';
import { btnCls, inputCls, labelCls } from '@/components/ui';
import { FitFields } from '@/components/fit-fields';
import { CONDITIONS, FIT_LABELS, SEASONS, STATUSES } from '@/lib/db';
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
  /** Shows a photo field. Only for a new item, since existing items add photos from their own Photos section. */
  photos?: { userId: string; childId: string };
}

export function ItemForm({ action, categories, sizes, labels, brands, defaults: d = {}, submitLabel, photos }: Props) {
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      {d.id && <input type="hidden" name="id" value={d.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${labelCls} sm:col-span-2`}>
          Name (optional)
          <input className={inputCls} name="name" maxLength={160} defaultValue={d.name ?? ''} placeholder="Made from brand and category if left blank" />
        </label>
        <label className={labelCls}>
          Category
          <select className={inputCls} name="categoryId" defaultValue={d.categoryId ?? categories[0]?.id} required>
            <CategoryOptions categories={categories} />
          </select>
          <span className="text-xs">Not listed? <Link className="text-accent underline" href="/categories">Add your own category</Link></span>
        </label>
        <label className={labelCls}>
          Brand
          <input className={inputCls} name="brand" maxLength={80} list="brand-list" defaultValue={d.brand ?? ''} />
          <datalist id="brand-list">{brands.map((b) => <option key={b} value={b} />)}</datalist>
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
            <PhotoPicker userId={photos.userId} childId={photos.childId} name="photoPath" />
          </div>
        )}
      </div>
      <div><button className={btnCls} type="submit">{submitLabel}</button></div>
    </form>
  );
}
