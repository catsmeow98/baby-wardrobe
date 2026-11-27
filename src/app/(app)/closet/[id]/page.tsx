import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { withCurrent } from '@/lib/categories';
import { FormMessage } from '@/components/form-message';
import type { ItemRow, SizeLabelRow } from '@/lib/db';
import { PhotoUploader } from '@/components/photo-uploader';
import { PhotoEditButton } from '@/components/photo-edit-button';
import { TypeIcon } from '@/components/item-icon';
import { MAX_PHOTOS_PER_ITEM, signedUrls } from '@/lib/photos';
import { ItemForm } from '../item-form';
import { deletePhoto } from '../photo-actions';
import { deleteItem, saveItem } from '../actions';
import { safeBack } from '@/lib/back';

export const metadata: Metadata = { title: 'Edit item' };

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; back?: string }>;
}) {
  const { id } = await params;
  const { error, back: rawBack } = await searchParams;
  const back = safeBack(rawBack, '/closet');
  const bk = encodeURIComponent(back);
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
    .from('inventory_photos').select('id, storage_path, original_path').eq('inventory_item_id', item.id).order('sort_order');
  const photos = (photoRows ?? []) as { id: string; storage_path: string; original_path: string | null }[];
  const urls = await signedUrls(ctx.supabase, photos.map((p) => p.storage_path));
  const { data: inOutfits } = await ctx.supabase.from('outfit_items').select('outfits(id, name)').eq('item_id', item.id);
  const outfitLinks = ((inOutfits ?? []) as unknown as { outfits: { id: string; name: string } | null }[]).flatMap((r) => (r.outfits ? [r.outfits] : []));
  const brandName = brandList.find((b) => b.id === item.brand_id)?.name ?? '';
  return (
    <>
      <p className="text-sm"><Link className="text-accent underline" href={back}>← Back to closet</Link></p>
      <div>
        <h1 className="font-display text-2xl font-bold">Edit item</h1>
        <p className="flex items-center gap-1.5 text-muted">
          <TypeIcon type={ctx.catById.get(item.category_id)} size={24} className="text-accent" />
          {item.name}{ctx.catById.get(item.category_id) ? ` · ${ctx.catById.get(item.category_id)!.name}` : ''}
        </p>
      </div>
      <FormMessage error={error} />
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Photos</h2>
        {photos.length > 0 && (
          <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id} className="flex flex-col gap-1.5">
                {urls.get(p.storage_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls.get(p.storage_path)} alt={`${item.name}`} className={`aspect-square w-full rounded-lg ${p.storage_path.endsWith('.png') ? 'bg-line object-contain' : 'object-cover'}`} />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-lg bg-line text-sm text-muted">Unavailable</div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {urls.get(p.storage_path) && <PhotoEditButton photoId={p.id} url={urls.get(p.storage_path)!} path={p.storage_path} originalPath={p.original_path ?? undefined} userId={ctx.user.id} childId={item.child_id} />}
                  <form action={deletePhoto}>
                    <input type="hidden" name="photoId" value={p.id} />
                    <button type="submit" className="text-sm text-bad underline">Delete photo</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <PhotoUploader itemId={item.id} userId={ctx.user.id} childId={item.child_id} remaining={MAX_PHOTOS_PER_ITEM - photos.length} removeBg={ctx.settings.removeBackground} />
      </section>
      <ItemForm
        action={saveItem}
        categories={withCurrent(ctx.categories, ctx.catById, item.category_id)}
        sizes={ctx.sizes}
        labels={sorted}
        brands={brandList.map((b) => b.name)}
        submitLabel="Save changes"
        back={back}
        defaults={{
          id: item.id, name: item.name, categoryId: item.category_id, brand: brandName, quantity: item.quantity,
          tagId: item.label_id, customTag: item.custom_tag, fitFromId: item.fit_from_size_id, fitToId: item.fit_to_size_id, condition: item.condition, gender: item.gender, color: item.color,
          season: item.season, status: item.status, fitOverride: item.fit_override, fitFeedback: item.fit_feedback, notes: item.notes,
        }}
      />
      <p className="text-sm"><Link className="text-accent underline" href={`/closet/new?from=${item.id}&back=${bk}`}>Add another like this</Link></p>
      {outfitLinks.length > 0 && (
        <p className="text-sm text-muted">
          In outfits: {outfitLinks.map((o, i) => <span key={o.id}>{i > 0 ? ', ' : ''}<Link className="text-accent underline" href={`/outfits/${o.id}`}>{o.name}</Link></span>)}
        </p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Delete this item</summary>
        <form action={deleteItem} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="back" value={back} />
          <p className="text-muted">This cannot be undone. To keep a record, set the status to Donated or Sold instead.</p>
          <div><button className="rounded-lg bg-bad-soft px-3 py-1.5 font-bold text-bad" type="submit">Delete item</button></div>
        </form>
      </details>
    </>
  );
}
