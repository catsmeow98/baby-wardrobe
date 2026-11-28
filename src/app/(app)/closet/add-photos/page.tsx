import type { Metadata } from 'next';
import { getContext } from '@/lib/context';
import { NoChild } from '@/components/no-child';
import { FormMessage } from '@/components/form-message';
import { AddPhotos, type PhotoLessItem } from '@/components/add-photos';
import { sizeName, type ItemRow, type SizeLabelRow } from '@/lib/db';
import { iconForType } from '@/lib/item-icons';
import { safeBack } from '@/lib/back';
import { loadTags } from '@/lib/tags';
import { withCurrent } from '@/lib/categories';

export const metadata: Metadata = { title: 'Add photos' };

/** Items with no photo: take or choose photos, then say which item each one is, like adding photos after a shopping trip. */
export default async function AddPhotosPage({ searchParams }: { searchParams: Promise<{ error?: string; back?: string }> }) {
  const { error, back: rawBack } = await searchParams;
  const back = safeBack(rawBack, '/dashboard');
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  const [{ data: rows }, { data: photoRows }, { data: labelData }, { data: brandData }, tagInfo] = await Promise.all([
    ctx.supabase.from('inventory_items').select('*').eq('child_id', ctx.active.id).eq('needs_details', false).order('created_at'),
    ctx.supabase.from('inventory_photos').select('inventory_item_id'),
    ctx.supabase.from('size_labels').select('id, size_id, label, sort_order'),
    ctx.supabase.from('brands').select('id, name').order('name'),
    loadTags(ctx),
  ]);
  const labels = ((labelData ?? []) as SizeLabelRow[]).sort(
    (a, b) => (ctx.orderOf.get(a.size_id) ?? 0) - (ctx.orderOf.get(b.size_id) ?? 0) || a.sort_order - b.sort_order,
  );
  const brands = (brandData ?? []) as { id: string; name: string }[];
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const withPhoto = new Set(((photoRows ?? []) as { inventory_item_id: string }[]).map((p) => p.inventory_item_id));
  const labelById = new Map(((labelData ?? []) as SizeLabelRow[]).map((l) => [l.id, l.label]));
  const items: PhotoLessItem[] = ((rows ?? []) as ItemRow[]).filter((r) => !withPhoto.has(r.id)).map((r) => {
    const c = ctx.catById.get(r.category_id);
    const from = r.fit_from_size_id ? ctx.sizeById.get(r.fit_from_size_id) : undefined;
    return {
      id: r.id,
      name: r.name,
      typeName: c?.name ?? 'Item',
      icon: iconForType(c),
      size: r.label_id ? (labelById.get(r.label_id) ?? '') : (r.custom_tag ?? (from ? sizeName(from) : '')),
      hasColor: Boolean(r.color),
      categoryId: r.category_id,
      brand: r.brand_id ? (brandName.get(r.brand_id) ?? '') : '',
      color: r.color,
      labelId: r.label_id,
      customTag: r.custom_tag,
      thruId: r.fit_to_size_id,
      tags: tagInfo.byItem.get(r.id) ?? [],
    };
  });
  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Add photos</h1>
        <p className="text-muted">{items.length ? `${items.length} item${items.length === 1 ? ' has' : 's have'} no photo. Take or choose photos, then say which item each one is.` : 'Every item has a photo.'}</p>
      </div>
      <FormMessage error={error} />
      {items.length > 0 && (
        <AddPhotos items={items} userId={ctx.user.id} childId={ctx.active.id} removeBg={ctx.settings.removeBackground} back={back}
          categories={items.reduce((cs, i) => withCurrent(cs, ctx.catById, i.categoryId), ctx.categories)} labels={labels} sizes={ctx.sizes}
          brands={brands.map((b) => b.name)} tagNames={tagInfo.tags.map((t) => t.name)} />
      )}
    </>
  );
}
