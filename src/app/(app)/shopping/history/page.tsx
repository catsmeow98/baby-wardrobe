import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext } from '@/lib/context';
import { NoChild } from '@/components/no-child';
import { LocalTime } from '@/components/local-time';
import { TypeIcon } from '@/components/item-icon';
import { Pill } from '@/components/pill';
import { sizeName } from '@/lib/db';
import { loadHistory } from '@/lib/history-data';
import { signedUrls } from '@/lib/photos';

export const metadata: Metadata = { title: 'Shopping history' };

const isId = (v: string | undefined) => Boolean(v && /^[0-9a-f-]{36}$/i.test(v));

/**
 * One History entry (an order, ?o=, or a store trip, ?t=): what was bought, with anything not purchased crossed out, and the
 * closet items that came from it, with their photos. Items are linked to their trip when a trip's photos are saved; older
 * ones were not, so they cannot be shown.
 */
export default async function HistoryEntryPage({ searchParams }: { searchParams: Promise<{ o?: string; t?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  const child = ctx.active;
  const orderId = isId(sp.o) ? sp.o! : undefined;
  const tripId = !orderId && isId(sp.t) ? sp.t! : undefined;
  if (!orderId && !tripId) return <Missing />;

  const history = await loadHistory(ctx, child.id, 500);
  const entry = history.find((h) => h.key === (orderId ? `o:${orderId}` : `t:${tripId}`));
  if (!entry) return <Missing />;

  // The trips (deliveries) behind it, and any pieces still waiting for photos.
  let receipts: { trip_id: string | null; inventory_item_id: string | null }[] = [];
  if (orderId) {
    const { data: its } = await ctx.supabase.from('shopping_items').select('id').eq('order_id', orderId);
    const ids = ((its ?? []) as { id: string }[]).map((i) => i.id);
    if (ids.length) {
      const { data } = await ctx.supabase.from('shopping_receipts').select('trip_id, inventory_item_id').in('shopping_item_id', ids);
      receipts = (data ?? []) as typeof receipts;
    }
  } else {
    const { data } = await ctx.supabase.from('shopping_receipts').select('trip_id, inventory_item_id').eq('trip_id', tripId!);
    receipts = (data ?? []) as typeof receipts;
  }
  const trips = [...new Set(receipts.map((r) => r.trip_id).filter((x): x is string => Boolean(x)))];
  const waiting = receipts.map((r) => r.inventory_item_id).filter((x): x is string => Boolean(x));

  type Item = { id: string; name: string; category_id: string; quantity: number; fit_from_size_id: string | null; fit_to_size_id: string | null; status: string; needs_details: boolean };
  const items: Item[] = [];
  if (trips.length) {
    const { data } = await ctx.supabase.from('inventory_items').select('id, name, category_id, quantity, fit_from_size_id, fit_to_size_id, status, needs_details').eq('child_id', child.id).in('trip_id', trips);
    items.push(...((data ?? []) as Item[]));
  }
  if (waiting.length) {
    const { data } = await ctx.supabase.from('inventory_items').select('id, name, category_id, quantity, fit_from_size_id, fit_to_size_id, status, needs_details').eq('child_id', child.id).in('id', waiting);
    for (const i of (data ?? []) as Item[]) if (!items.some((x) => x.id === i.id)) items.push(i);
  }
  const { data: photoRows } = items.length
    ? await ctx.supabase.from('inventory_photos').select('inventory_item_id, storage_path, sort_order').in('inventory_item_id', items.map((i) => i.id)).order('sort_order')
    : { data: [] };
  const cover = new Map<string, string>();
  for (const p of (photoRows ?? []) as { inventory_item_id: string; storage_path: string }[]) if (!cover.has(p.inventory_item_id)) cover.set(p.inventory_item_id, p.storage_path);
  const urls = await signedUrls(ctx.supabase, [...cover.values()]);
  const here = `/shopping/history?${orderId ? `o=${orderId}` : `t=${tripId}`}`;
  const sizeText = (id: string | null) => { const z = id ? ctx.sizeById.get(id) : undefined; return z ? sizeName(z) : null; };

  return (
    <>
      <Link href="/shopping" className="text-sm text-accent underline">← Shopping</Link>
      <div>
        <h1 className="font-display text-2xl font-bold">{entry.name ?? (entry.kind === 'store' ? 'In store' : 'Shopping')}</h1>
        <p className="text-muted">{entry.kind === 'order' ? 'Order' : 'Bought in store'} · <LocalTime iso={entry.at} /></p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">What was bought</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {entry.lines.map((l, i) => {
            const z = ctx.sizeById.get(l.sizeId);
            return (
              <li key={i} className="flex items-center gap-2">
                <TypeIcon type={ctx.catById.get(l.categoryId)} size={22} className="shrink-0 text-accent" />
                <span>
                  {l.qty > 0 && <>{l.qty} × {ctx.catById.get(l.categoryId)?.name ?? 'Item'} <span className="text-sm text-muted">{z ? sizeName(z) : ''}</span></>}
                  {l.cancelled > 0 && (
                    <span className="text-muted line-through">{l.qty > 0 ? ' ' : ''}{l.cancelled} × {ctx.catById.get(l.categoryId)?.name ?? 'Item'} {z ? sizeName(z) : ''}</span>
                  )}
                  {l.cancelled > 0 && <span className="text-sm text-muted"> (not purchased or cancelled)</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">In the closet</h2>
        {items.length === 0 ? (
          <p className="py-3 text-sm text-muted">
            No closet items are linked to this. Items are linked when a trip&apos;s photos are saved, so ones added before that started are not shown.
          </p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((i) => {
              const path = cover.get(i.id);
              const url = path ? urls.get(path) : undefined;
              const from = sizeText(i.fit_from_size_id);
              const to = sizeText(i.fit_to_size_id);
              return (
                <li key={i.id}>
                  <Link href={`/closet/${i.id}?back=${encodeURIComponent(here)}`} className="flex h-full flex-col gap-1 rounded-xl border border-line bg-bg p-2">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" loading="lazy" className={`aspect-[4/3] w-full rounded-lg ${path!.endsWith('.png') ? 'bg-line object-contain' : 'object-cover'}`} />
                    ) : (
                      <span className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-line/60 text-accent"><TypeIcon type={ctx.catById.get(i.category_id)} size={48} /></span>
                    )}
                    <b className="truncate">{i.name}</b>
                    <span className="text-xs text-muted">
                      {ctx.catById.get(i.category_id)?.name ?? 'Item'}{from ? ` · Fits ${from}${to && to !== from ? ` to ${to}` : ''}` : ''}{i.quantity > 1 ? ` · ×${i.quantity}` : ''}
                    </span>
                    {i.needs_details && <Pill tone="warn">Needs photos</Pill>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Missing() {
  return (
    <>
      <Link href="/shopping" className="text-sm text-accent underline">← Shopping</Link>
      <p className="text-muted">That shopping entry could not be found.</p>
    </>
  );
}
