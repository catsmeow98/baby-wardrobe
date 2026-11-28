'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btnGhostCls } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { detectColor } from '@/lib/color-detect';
import { PHOTO_BUCKET } from '@/lib/photos';

const TAG = 'color test';

/**
 * One-time: guesses a color for every item that has none, from its first photo, and tags those items "color test" so they
 * are easy to check. Runs in the browser (the photos are private, and the guesser reads the picture itself). An item whose
 * photo cannot be read, or whose color cannot be told, is left alone.
 */
export function ColorBackfill({ count }: { count: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const supabase = createClient();
    try {
      setStatus('Finding items without a color…');
      const { data: items, error } = await supabase.from('inventory_items').select('id').is('color', null);
      if (error) throw error;
      const ids = ((items ?? []) as { id: string }[]).map((i) => i.id);
      if (!ids.length) {
        setStatus('Every item already has a color.');
        return;
      }
      const cover = new Map<string, string>();
      const tagsOf = new Map<string, string[]>();
      for (let k = 0; k < ids.length; k += 100) {
        const part = ids.slice(k, k + 100);
        const [{ data: photos }, { data: links }] = await Promise.all([
          supabase.from('inventory_photos').select('inventory_item_id, storage_path, sort_order').in('inventory_item_id', part).order('sort_order'),
          supabase.from('item_tags').select('item_id, tag:tags(name)').in('item_id', part),
        ]);
        for (const p of (photos ?? []) as { inventory_item_id: string; storage_path: string }[]) {
          if (!cover.has(p.inventory_item_id)) cover.set(p.inventory_item_id, p.storage_path);
        }
        for (const l of (links ?? []) as unknown as { item_id: string; tag: { name: string } | null }[]) {
          if (l.tag) tagsOf.set(l.item_id, [...(tagsOf.get(l.item_id) ?? []), l.tag.name]);
        }
      }

      let done = 0;
      let colored = 0;
      let unsure = 0;
      const tagged: { item: string; tags: string[] }[] = [];
      const flush = async () => {
        if (!tagged.length) return;
        const batch = tagged.splice(0);
        const { error: tagError } = await supabase.rpc('set_item_tags', { p_items: batch });
        if (tagError) console.error('Could not tag items', tagError);
      };
      for (const id of ids) {
        done++;
        setStatus(`Checking photo ${done} of ${ids.length}…`);
        const path = cover.get(id);
        if (!path) { unsure++; continue; }
        const { data: blob } = await supabase.storage.from(PHOTO_BUCKET).download(path);
        // Only a sure guess is filled in; muted colors (white, cream, gray, beige) are left for you to pick.
        const color = blob ? (await detectColor(blob)).color : null;
        if (!color) { unsure++; continue; }
        // Only fills a color that is still empty, in case one was set meanwhile.
        const { error: upError } = await supabase.from('inventory_items').update({ color }).eq('id', id).is('color', null);
        if (upError) { unsure++; continue; }
        colored++;
        tagged.push({ item: id, tags: [...(tagsOf.get(id) ?? []), TAG] });
        if (tagged.length >= 20) await flush();
      }
      await flush();
      setStatus(`Done: ${colored} item${colored === 1 ? '' : 's'} got a color and the tag “${TAG}”.${unsure ? ` ${unsure} were left as they were: their color is muted (white, cream, gray or beige) or could not be told, so pick it yourself.` : ''}`);
      router.refresh();
    } catch (e) {
      console.error('Color backfill failed', e);
      setStatus('Something went wrong partway. Items done so far keep their color; tap again to carry on with the rest.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
      <button type="button" className={btnGhostCls} disabled={running || count === 0} onClick={run}>
        {running ? 'Guessing colors…' : `Guess colors for ${count} item${count === 1 ? '' : 's'}`}
      </button>
      <span role="status" className="text-sm text-muted">
        {status ?? `Items with no color get one from their photo, tagged “${TAG}” so you can check them in Closet.`}
      </span>
    </div>
  );
}
