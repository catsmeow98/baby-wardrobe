import type { Metadata } from 'next';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { NoChild } from '@/components/no-child';
import { OutfitBuilder } from '@/components/outfit-builder';
import type { ItemRow } from '@/lib/db';
import { pickItems } from '@/lib/outfit-data';
import { saveOutfit } from '../actions';

export const metadata: Metadata = { title: 'New outfit' };

export default async function NewOutfitPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  const { data } = await ctx.supabase.from('inventory_items').select('*').eq('child_id', ctx.active.id).order('created_at', { ascending: false });
  const items = await pickItems(ctx, (data ?? []) as ItemRow[]);
  return (
    <>
      <h1 className="font-display text-2xl font-bold">New outfit for {ctx.active.name}</h1>
      <FormMessage error={error} />
      <OutfitBuilder action={saveOutfit} items={items} groups={ctx.groups.map((g) => ({ id: g.id, name: g.name }))}
        types={ctx.categories.map((c) => ({ id: c.id, name: c.name, groupId: c.group_id }))} />
    </>
  );
}
