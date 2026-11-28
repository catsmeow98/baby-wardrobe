import type { Metadata } from 'next';
import { getContext } from '@/lib/context';
import { NoChild } from '@/components/no-child';
import { BulkBuilder } from '@/components/bulk-builder';
import { inputCls, labelCls } from '@/components/ui';
import { GENDERS, STATUSES } from '@/lib/db';
import { TagInput } from '@/components/tag-input';
import { loadTags } from '@/lib/tags';
import type { SizeLabelRow } from '@/lib/db';
import { bulkCreate } from '../actions';
import { safeBack, safeBackAny } from '@/lib/back';
import { loadTrips } from '@/lib/trips-data';
import { iconForType } from '@/lib/item-icons';
import { sizeName } from '@/lib/db';

export const metadata: Metadata = { title: 'Bulk add' };

export default async function BulkPage({ searchParams }: { searchParams: Promise<{ error?: string; back?: string; trip?: string }> }) {
  const { error, back: rawBack, trip: rawTrip } = await searchParams;
  // After saving, the closet (to see the new items); Exit goes back wherever bulk add was opened from.
  const back = safeBack(rawBack, '/closet');
  const exitTo = safeBackAny(rawBack, ['/closet', '/shopping', '/dashboard'], '/closet');
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  // From a shopping trip: what was received and still needs photos and details.
  const tripId = rawTrip && /^[0-9a-f-]{36}$/i.test(rawTrip) ? rawTrip : undefined;
  const found = tripId ? (await loadTrips(ctx, ctx.active.id, tripId))[0] : undefined;
  const trip = found && {
    id: found.id,
    at: found.at,
    lines: found.lines.map((l) => {
      const c = ctx.catById.get(l.categoryId);
      const z = l.sizeId ? ctx.sizeById.get(l.sizeId) : undefined;
      return { itemId: l.itemId, categoryId: l.categoryId, sizeId: l.sizeId, labelId: l.labelId, qty: l.qty, typeName: c?.name ?? 'Item', sizeLabel: z ? sizeName(z) : '', icon: iconForType(c) };
    }),
  };
  const [{ data: labelData }, { data: brands }, { tags }] = await Promise.all([
    ctx.supabase.from('size_labels').select('id, size_id, label, sort_order'),
    ctx.supabase.from('brands').select('name').order('name'),
    loadTags(ctx, []),
  ]);
  const tagNames = tags.map((t) => t.name);
  const labels = ((labelData ?? []) as SizeLabelRow[]).sort(
    (a, b) => (ctx.orderOf.get(a.size_id) ?? 0) - (ctx.orderOf.get(b.size_id) ?? 0) || a.sort_order - b.sort_order,
  );
  const defaultTag = ctx.active.current_size_id ? labels.filter((l) => l.size_id === ctx.active!.current_size_id).sort((a, b) => b.sort_order - a.sort_order)[0]?.id : '';

  return (
    <form action={bulkCreate}>
      <input type="hidden" name="back" value={back} />
      {trip && <input type="hidden" name="trip" value={trip.id} />}
      <BulkBuilder
        userId={ctx.user.id}
        childId={ctx.active.id}
        categories={ctx.categories}
        labels={labels}
        sizes={ctx.sizes}
        brands={(brands ?? []).map((b: { name: string }) => b.name)}
        defaultTagId={defaultTag ?? ''}
        removeBg={ctx.settings.removeBackground}
        back={exitTo}
        trip={trip}
        tripGone={Boolean(tripId && !found)}
        error={error}
        tagNames={tagNames}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TagInput name="tags_shared" suggestions={tagNames} label="Tags for every item" hint="Added to each item, on top of its own tags." className={`${labelCls} sm:col-span-2`} />
          <label className={labelCls}>Status
            <select className={inputCls} name="status" defaultValue="active">{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className={labelCls}>Gender (optional)
            <select className={inputCls} name="gender" defaultValue=""><option value="">Not set</option>{GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </div>
      </BulkBuilder>
    </form>
  );
}
