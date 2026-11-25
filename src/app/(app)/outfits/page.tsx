import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { NoChild } from '@/components/no-child';
import { OutfitCollage } from '@/components/outfit-collage';
import { Pill } from '@/components/pill';
import { btnCls } from '@/components/ui';
import type { ItemRow } from '@/lib/db';
import { pickItems } from '@/lib/outfit-data';

export const metadata: Metadata = { title: 'Outfits' };

export default async function OutfitsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;

  const { data: outfitData } = await ctx.supabase.from('outfits').select('id, name, notes').eq('child_id', ctx.active.id).order('created_at', { ascending: false });
  const outfits = (outfitData ?? []) as { id: string; name: string; notes: string | null }[];
  const { data: linkData } = outfits.length
    ? await ctx.supabase.from('outfit_items').select('outfit_id, item_id, sort_order').in('outfit_id', outfits.map((o) => o.id)).order('sort_order')
    : { data: [] };
  const links = (linkData ?? []) as { outfit_id: string; item_id: string }[];
  const ids = [...new Set(links.map((l) => l.item_id))];
  const { data: itemRows } = ids.length ? await ctx.supabase.from('inventory_items').select('*').in('id', ids) : { data: [] };
  const picks = new Map((await pickItems(ctx, (itemRows ?? []) as ItemRow[])).map((p) => [p.id, p]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{ctx.active.name}&apos;s outfits</h1>
          <p className="text-muted">Mix and match closet items into outfits. Outfits do not count toward goals.</p>
        </div>
        <Link className={btnCls} href="/outfits/new">New outfit</Link>
      </div>
      <FormMessage error={sp.error} message={sp.ok} />

      {outfits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-muted">No outfits yet. Make your first one from the closet.</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {outfits.map((o) => {
            const items = links.filter((l) => l.outfit_id === o.id).map((l) => picks.get(l.item_id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
            const warned = items.filter((i) => i.warn).length;
            return (
              <li key={o.id}>
                <Link href={`/outfits/${o.id}`} className="flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-3 hover:border-accent">
                  <OutfitCollage items={items} />
                  <span className="font-bold [overflow-wrap:anywhere]">{o.name}</span>
                  <span className="text-sm text-muted">{items.length} item{items.length === 1 ? '' : 's'}{o.notes ? ` · ${o.notes}` : ''}</span>
                  {warned > 0 && <span className="mt-auto"><Pill tone="warn">{warned} may not fit or be in use</Pill></span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
