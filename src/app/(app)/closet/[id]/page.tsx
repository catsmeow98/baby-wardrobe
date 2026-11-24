import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import type { ItemRow, SizeLabelRow } from '@/lib/db';
import { PhotoUploader } from '@/components/photo-uploader';
import { MAX_PHOTOS_PER_ITEM, signedUrls } from '@/lib/photos';
import { ItemForm } from '../item-form';
import { deletePhoto } from '../photo-actions';
import { deleteItem, saveItem } from '../actions';

export const metadata: Metadata = { title: 'Edit item' };

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const ctx = await getContext();
  // Row-level security means another account's item comes back empty, exactly like a missing one.
  const { data } = await ctx.supabase.from('inventory_items').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const item = data as ItemRow;
  const [{ data: labels }, { data: brands }] = await Promise.all([
    ctx.supabase.from('size_labels').select('id, size_id, label, sort_order'),
    ctx.supabase.from('brands').select('id, name').order('name'),
  ]);
  const sorted = ((labels ?? []) as SizeLabelRow[]).sort(
    (a, b) => (ctx.orderOf.get(a.size_id) ?? 0) - (ctx.orderOf.get(b.size_id) ?? 0) || a.sort_order - b.sort_order,
  );
  const brandList = (brands ?? []) as { id: string; name: string }[];
  const { data: photoRows } = await ctx.supabase
    .from('inventory_photos').select('id, storage_path').eq('inventory_item_id', item.id).order('sort_order');
  const photos = (photoRows ?? []) as { id: string; storage_path: string }[];
  const urls = await signedUrls(ctx.supabase, photos.map((p) => p.storage_path));
  const brandName = brandList.find((b) => b.id === item.brand_id)?.name ?? '';
  return (
    <>
      <h1 className="font-display text-2xl font-bold">Edit item</h1>
      <FormMessage error={error} />
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Photos</h2>
        {photos.length > 0 && (
          <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id} className="flex flex-col gap-1.5">
                {urls.get(p.storage_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls.get(p.storage_path)} alt={`${item.name}`} className="aspect-square w-full rounded-lg object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-lg bg-line text-sm text-muted">Unavailable</div>
                )}
                <form action={deletePhoto}>
                  <input type="hidden" name="photoId" value={p.id} />
                  <button type="submit" className="text-sm text-bad underline">Delete photo</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <PhotoUploader itemId={item.id} userId={ctx.user.id} childId={item.child_id} remaining={MAX_PHOTOS_PER_ITEM - photos.length} />
      </section>
      <ItemForm
        action={saveItem}
        categories={ctx.categories}
        sizes={ctx.sizes}
        labels={sorted}
        brands={brandList.map((b) => b.name)}
        submitLabel="Save changes"
        defaults={{
          id: item.id, name: item.name, categoryId: item.category_id, brand: brandName, quantity: item.quantity,
          tagId: item.label_id, fitFromId: item.fit_from_size_id, fitToId: item.fit_to_size_id, condition: item.condition,
          season: item.season, status: item.status, fitOverride: item.fit_override, fitFeedback: item.fit_feedback, notes: item.notes,
        }}
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Delete this item</summary>
        <form action={deleteItem} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={item.id} />
          <p className="text-muted">This cannot be undone. To keep a record, set the status to Donated or Sold instead.</p>
          <div><button className="rounded-lg bg-bad-soft px-3 py-1.5 font-bold text-bad" type="submit">Delete item</button></div>
        </form>
      </details>
    </>
  );
}
