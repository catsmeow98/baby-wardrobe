import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { ColorCheck } from '@/components/color-check';
import { signedUrls } from '@/lib/photos';

export const metadata: Metadata = { title: 'Check colors' };

/** Items with one tag (Recolor, say): each photo with its saved color and what the guesser sees, to fix colors and tune the guesser. */
export default async function ColorCheckPage({ searchParams }: { searchParams: Promise<{ tag?: string; ok?: string; error?: string }> }) {
  const { tag: rawTag, ok, error } = await searchParams;
  const ctx = await getContext();
  const { data: tagRows } = await ctx.supabase.from('tags').select('id, name').order('name');
  const tags = (tagRows ?? []) as { id: string; name: string }[];
  const tag = (z.string().uuid().safeParse(rawTag).success ? tags.find((t) => t.id === rawTag) : undefined)
    ?? tags.find((t) => t.name.toLowerCase() === 'recolor');

  let items: { id: string; name: string; color: string | null; path: string | null; url: string | null }[] = [];
  if (tag) {
    const { data: links } = await ctx.supabase.from('item_tags').select('item_id').eq('tag_id', tag.id);
    const ids = ((links ?? []) as { item_id: string }[]).map((l) => l.item_id);
    if (ids.length) {
      const [{ data: rows }, { data: photos }] = await Promise.all([
        ctx.supabase.from('inventory_items').select('id, name, color').in('id', ids).order('created_at'),
        ctx.supabase.from('inventory_photos').select('inventory_item_id, storage_path, sort_order').in('inventory_item_id', ids).order('sort_order'),
      ]);
      const cover = new Map<string, string>();
      for (const p of (photos ?? []) as { inventory_item_id: string; storage_path: string }[]) if (!cover.has(p.inventory_item_id)) cover.set(p.inventory_item_id, p.storage_path);
      const urls = await signedUrls(ctx.supabase, [...cover.values()]);
      items = ((rows ?? []) as { id: string; name: string; color: string | null }[]).map((r) => {
        const path = cover.get(r.id) ?? null;
        return { ...r, path, url: path ? (urls.get(path) ?? null) : null };
      });
    }
  }

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Check colors</h1>
        <p className="text-muted">
          {tag ? <>Items tagged <b>{tag.name}</b>. Pick the right color for each, then save. Copy the report for Claude to tune the color guessing.</> : 'Choose a tag to check.'}
        </p>
      </div>
      <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">Tag
          <select name="tag" defaultValue={tag?.id ?? ''} className="rounded-lg border border-line bg-surface px-2 py-1">
            {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <button type="submit" className="text-accent underline">Show</button>
        <Link href={tag ? `/closet?tag=${tag.id}&f=1` : '/closet'} className="ml-auto text-accent underline">Open in Closet</Link>
      </form>
      <FormMessage error={error} message={ok} />
      {tag && (items.length ? <ColorCheck key={items.map((i) => `${i.id}:${i.color}`).join(',')} tagId={tag.id} tagName={tag.name} items={items} />
        : <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">No items have this tag.</p>)}
    </>
  );
}
