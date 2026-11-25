import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { OutfitBuilder } from '@/components/outfit-builder';
import type { ItemRow } from '@/lib/db';
import { pickItems } from '@/lib/outfit-data';
import { deleteOutfit, saveOutfit } from '../actions';

export const metadata: Metadata = { title: 'Edit outfit' };

export default async function EditOutfitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const ctx = await getContext();
  // Row-level security means another account's outfit comes back empty, exactly like a missing one.
  const { data: outfit } = await ctx.supabase.from('outfits').select('id, child_id, name, notes').eq('id', id).maybeSingle();
  if (!outfit) notFound();
  const [{ data: links }, { data: rows }] = await Promise.all([
    ctx.supabase.from('outfit_items').select('item_id, sort_order').eq('outfit_id', id).order('sort_order'),
    ctx.supabase.from('inventory_items').select('*').eq('child_id', outfit.child_id as string).order('created_at', { ascending: false }),
  ]);
  const items = await pickItems(ctx, (rows ?? []) as ItemRow[]);
  return (
    <>
      <h1 className="font-display text-2xl font-bold">Edit outfit</h1>
      <FormMessage error={error} />
      <OutfitBuilder
        action={saveOutfit}
        items={items}
        groups={ctx.groups.map((g) => ({ id: g.id, name: g.name }))}
        types={ctx.categories.map((c) => ({ id: c.id, name: c.name, groupId: c.group_id }))}
        initial={{ id, name: outfit.name as string, notes: (outfit.notes as string | null) ?? '', itemIds: ((links ?? []) as { item_id: string }[]).map((l) => l.item_id) }}
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Delete this outfit</summary>
        <form action={deleteOutfit} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={id} />
          <p className="text-muted">This deletes the outfit only. The items stay in the closet.</p>
          <div><button className="rounded-lg bg-bad-soft px-3 py-1.5 font-bold text-bad" type="submit">Delete outfit</button></div>
        </form>
      </details>
    </>
  );
}
