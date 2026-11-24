import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { NoChild } from '@/components/no-child';
import type { SizeLabelRow } from '@/lib/db';
import { ItemForm } from '../item-form';
import { saveItem } from '../actions';

export const metadata: Metadata = { title: 'Add item' };

export default async function NewItemPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  const [{ data: labels }, { data: brands }] = await Promise.all([
    ctx.supabase.from('size_labels').select('id, size_id, label, sort_order'),
    ctx.supabase.from('brands').select('name').order('name'),
  ]);
  const sorted = ((labels ?? []) as SizeLabelRow[]).sort(
    (a, b) => (ctx.orderOf.get(a.size_id) ?? 0) - (ctx.orderOf.get(b.size_id) ?? 0) || a.sort_order - b.sort_order,
  );
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">Add an item for {ctx.active.name}</h1>
        <Link className="text-sm text-accent underline" href="/closet/bulk">Add many at once</Link>
      </div>
      <FormMessage error={error} />
      <ItemForm action={saveItem} categories={ctx.categories} sizes={ctx.sizes} labels={sorted}
        brands={(brands ?? []).map((b: { name: string }) => b.name)} submitLabel="Add item"
        photos={{ userId: ctx.user.id, childId: ctx.active.id }} />
    </>
  );
}
