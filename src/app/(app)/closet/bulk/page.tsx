import type { Metadata } from 'next';
import { getContext } from '@/lib/context';
import { NoChild } from '@/components/no-child';
import { BulkBuilder, type BulkSeed } from '@/components/bulk-builder';
import { labelCls } from '@/components/ui';
import { GENDERS, STATUSES } from '@/lib/db';
import { TagInput } from '@/components/tag-input';
import { ChoicePills } from '@/components/pickers';
import { loadTags } from '@/lib/tags';
import { loadPickerHints } from '@/lib/picker-hints';
import type { ItemRow, SizeLabelRow } from '@/lib/db';
import { bulkCreate } from '../actions';
import { safeBack, safeBackAny } from '@/lib/back';
import { loadTrips } from '@/lib/trips-data';
import { iconForType } from '@/lib/item-icons';
import { sizeName } from '@/lib/db';
import { withCurrent } from '@/lib/categories';

export const metadata: Metadata = { title: 'Add items' };

export default async function BulkPage({ searchParams }: { searchParams: Promise<{ error?: string; back?: string; trip?: string; from?: string }> }) {
  const { error, back: rawBack, trip: rawTrip, from } = await searchParams;
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
  const [{ data: labelData }, { data: brands }, { tags }, pickerHints] = await Promise.all([
    ctx.supabase.from('size_labels').select('id, size_id, label, sort_order'),
    ctx.supabase.from('brands').select('name').order('name'),
    loadTags(ctx, []),
    loadPickerHints(ctx),
  ]);
  const tagNames = tags.map((t) => t.name);
  // A trip's name becomes a tag on everything added from it ("Old Navy sale", the same for every part of an order). A name
  // that is only the date and time it was made (nothing was typed) is skipped.
  const tripName = found?.name?.replace(/\s*[–-]\s*part \d+$/i, '').trim();
  const tripTag = tripName && !/\d{1,2}:\d{2}/.test(tripName) ? tripName.slice(0, 30).trim() : undefined;
  // "Add another like this": one item filled in from an existing one (row-level security hides anyone else's).
  const fromId = !trip && from && /^[0-9a-f-]{36}$/i.test(from) ? from : undefined;
  const src = fromId ? ((await ctx.supabase.from('inventory_items').select('*').eq('id', fromId).maybeSingle()).data as ItemRow | null) : null;
  const seed: BulkSeed | undefined = src ? {
    categoryId: src.category_id,
    name: src.name,
    brand: src.brand_id ? (((await ctx.supabase.from('brands').select('name').eq('id', src.brand_id).maybeSingle()).data as { name: string } | null)?.name ?? '') : '',
    tagId: src.label_id,
    customTag: src.custom_tag,
    thruId: src.fit_to_size_id,
    color: src.color,
    tags: (await loadTags(ctx, [src.id])).byItem.get(src.id) ?? [],
  } : undefined;
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
        categories={src ? withCurrent(ctx.categories, ctx.catById, src.category_id) : ctx.categories}
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
        seed={seed}
        pickerHints={pickerHints}
        sharedNote={tripTag ? `Every item gets the tag ${tripTag}.` : undefined}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TagInput name="tags_shared" suggestions={tagNames} label="Tags for every item" defaultTags={tripTag ? [tripTag] : []}
            hint={tripTag ? 'Added to each item, on top of its own tags. The trip’s name is here so you can find these later.' : 'Added to each item, on top of its own tags.'}
            className={`${labelCls} sm:col-span-2`} />
          <div className="sm:col-span-2"><ChoicePills name="gender" label="Gender" options={[['', 'Not set'], ...GENDERS]} defaultValue={src?.gender ?? ''} /></div>
          <div className="sm:col-span-2"><ChoicePills name="status" label="Status" options={STATUSES} defaultValue="active" /></div>
        </div>
      </BulkBuilder>
    </form>
  );
}
