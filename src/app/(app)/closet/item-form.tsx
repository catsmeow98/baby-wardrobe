import { btnCls, inputCls, labelCls } from '@/components/ui';
import { CONDITIONS, FIT_FEEDBACK, FIT_LABELS, SEASONS, STATUSES, sizeName } from '@/lib/db';
import type { CategoryRow, SizeLabelRow, SizeRow } from '@/lib/db';

export interface ItemDefaults {
  id?: string;
  name?: string;
  categoryId?: string;
  brand?: string;
  quantity?: number;
  tagId?: string | null;
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
}

export function ItemForm({ action, categories, sizes, labels, brands, defaults: d = {}, submitLabel }: Props) {
  const sameSize = <option value="">Same as tag size</option>;
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
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Brand
          <input className={inputCls} name="brand" maxLength={80} list="brand-list" defaultValue={d.brand ?? ''} />
          <datalist id="brand-list">{brands.map((b) => <option key={b} value={b} />)}</datalist>
        </label>
        <label className={labelCls}>
          Tag size (as printed)
          <select className={inputCls} name="tagId" defaultValue={d.tagId ?? ''}>
            <option value="">Not set</option>
            {labels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Quantity
          <input className={inputCls} type="number" name="quantity" min={1} max={999} defaultValue={d.quantity ?? 1} required />
          <span className="text-xs">Above 1 makes a group, like a 5-pack.</span>
        </label>
        <label className={labelCls}>
          Fits from
          <select className={inputCls} name="fitFromId" defaultValue={d.fitFromId ?? ''}>
            {sameSize}
            {sizes.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Fits through
          <select className={inputCls} name="fitToId" defaultValue={d.fitToId ?? ''}>
            {sameSize}
            {sizes.map((s) => <option key={s.id} value={s.id}>{sizeName(s)}</option>)}
          </select>
        </label>
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
        <label className={labelCls}>
          How did it fit?
          <select className={inputCls} name="fitFeedback" defaultValue={d.fitFeedback === null || d.fitFeedback === undefined ? '' : String(d.fitFeedback)}>
            <option value="">Not rated</option>
            {FIT_FEEDBACK.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className={`${labelCls} sm:col-span-2`}>
          Notes
          <textarea className={inputCls} name="notes" rows={2} maxLength={1000} defaultValue={d.notes ?? ''} placeholder="Runs small, long torso, and so on" />
        </label>
      </div>
      <div><button className={btnCls} type="submit">{submitLabel}</button></div>
    </form>
  );
}
