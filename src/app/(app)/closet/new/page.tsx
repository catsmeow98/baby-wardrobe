import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { NoChild } from '@/components/no-child';
import { z } from 'zod';
import { withCurrent } from '@/lib/categories';
import type { ItemRow, SizeLabelRow } from '@/lib/db';
import { ItemForm } from '../item-form';
import { saveItem } from '../actions';

export const metadata: Metadata = { title: 'Add item' };

export default async function NewItemPage({ searchParams }: { searchParams: Promise<{ error?: string; from?: string }> }) {
  const { error, from } = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  const [{ data: labels }, { data: brands }] = await Promise.all([
    ctx.supabase.from('size_labels').select('id, size_id, label, sort_order'),
    ctx.supabase.from('brands').select('name').order('name'),
  ]);
  const sorted = ((labels ?? []) as SizeLabelRow[]).sort(
    (a, b) => (ctx.orderOf.get(a.size_id) ?? 0) - (ctx.orderOf.get(b.size_id) ?? 0) || a.sort_order - b.sort_order,
  );
  // "Add another like this": start from a copy of an existing item (row-level security hides anyone else's).
  let src: ItemRow | null = null;
  if (from && z.string().uuid().safeParse(from).success) {
    const { data } = await ctx.supabase.from('inventory_items').select('*').eq('id', from).maybeSingle();
    src = (data as ItemRow | null) ?? null;
  }
  const srcBrand = src?.brand_id
    ? ((await ctx.supabase.from('brands').select('name').eq('id', src.brand_id).maybeSingle()).data as { name: string } | null)?.name ?? ''
    : '';
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">Add an item for {ctx.active.name}</h1>
        <Link className="text-sm text-accent underline" href="/closet/bulk">Add many at once</Link>
      </div>
      <FormMessage error={error} />
      <ItemForm action={saveItem} categories={withCurrent(ctx.categories, ctx.catById, src?.category_id)} sizes={ctx.sizes} labels={sorted}
        brands={(brands ?? []).map((b: { name: string }) => b.name)} submitLabel="Add item"
        defaults={src ? {
          name: src.name, categoryId: src.category_id, brand: srcBrand, quantity: 1, tagId: src.label_id, customTag: src.custom_tag,
          fitFromId: src.fit_from_size_id, fitToId: src.fit_to_size_id, condition: src.condition, gender: src.gender,
          season: src.season, status: 'active',
        } : undefined}
        photos={{ userId: ctx.user.id, childId: ctx.active.id }} />
    </>
  );
}
