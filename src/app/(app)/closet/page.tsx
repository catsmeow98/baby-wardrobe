import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext, toInventory } from '@/lib/context';
import { NoChild } from '@/components/no-child';
import { Pill } from '@/components/pill';
import { btnCls, btnGhostCls, inputCls } from '@/components/ui';
import { COLORS, CONDITIONS, FIT_FEEDBACK, FIT_LABELS, GENDERS, SEASONS, STATUSES, sizeName } from '@/lib/db';
import type { ItemRow, SizeLabelRow } from '@/lib/db';
import { ColorDot } from '@/components/color-dot';
import { TypeFilters } from '@/components/type-filters';
import { matchesCategory } from '@/lib/categories';
import { signedUrls } from '@/lib/photos';
import { FilterPanel } from '@/components/filter-panel';
import { currentUrl } from '@/lib/back';
import { filterItems, fitStateFor, type FitState } from '@/lib/domain';

export const metadata: Metadata = { title: 'Closet' };

type SP = { q?: string; fit?: string; cat?: string; group?: string; gender?: string; color?: string; sort?: string; size?: string; status?: string; season?: string; added?: string; photos?: string };

export default async function ClosetPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  // Opening an item or the add pages carries this address along, so finishing there comes back to the same filters.
  const here = currentUrl('/closet', sp);
  const bk = encodeURIComponent(here);

  const [{ data: itemRows }, { data: labelData }, { data: brandData }] = await Promise.all([
    ctx.supabase.from('inventory_items').select('*').eq('child_id', ctx.active.id).order('created_at', { ascending: false }),
    ctx.supabase.from('size_labels').select('id, size_id, label, sort_order'),
    ctx.supabase.from('brands').select('id, name'),
  ]);
  const labels = (labelData ?? []) as SizeLabelRow[];
  const labelById = new Map(labels.map((l) => [l.id, l]));
  const tagGroupOf = new Map(labels.map((l) => [l.id, ctx.orderOf.get(l.size_id) ?? 0]));
  const brandById = new Map(((brandData ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name]));
  const rows = (itemRows ?? []) as ItemRow[];
  const { data: photoData } = rows.length
    ? await ctx.supabase.from('inventory_photos').select('inventory_item_id, storage_path, sort_order').in('inventory_item_id', rows.map((r) => r.id)).order('sort_order')
    : { data: [] };
  const coverPath = new Map<string, string>();
  for (const p of (photoData ?? []) as { inventory_item_id: string; storage_path: string }[]) {
    if (!coverPath.has(p.inventory_item_id)) coverPath.set(p.inventory_item_id, p.storage_path);
  }
  const coverUrls = await signedUrls(ctx.supabase, [...coverPath.values()]);
  const feedbackById = new Map(rows.map((r) => [r.id, r.fit_feedback]));
  const items = toInventory(rows, ctx, tagGroupOf).map((i, n) => ({ ...i, brand: brandById.get(rows[n].brand_id ?? '') ?? null }));

  const genderOf = new Map(rows.map((r) => [r.id, r.gender]));
  const colorOf = new Map(rows.map((r) => [r.id, r.color]));
  const status = sp.status ?? 'active';
  const shown = filterItems(
    items,
    {
      q: sp.q,
      fit: (sp.fit as FitState | undefined) ?? '',
      categoryId: sp.cat,
      tagGroup: sp.size !== undefined && sp.size !== '' ? Number(sp.size) : undefined,
      status: status === 'all' ? '' : status,
      season: sp.season,
    },
    ctx.currentSize,
  );
  const filtered = shown
    .filter((i) => matchesCategory(ctx.catById.get(i.categoryId), { group: sp.group }))
    .filter((i) => !sp.color || (sp.color === 'none' ? !colorOf.get(i.id) : colorOf.get(i.id) === sp.color))
    .filter((i) => !sp.gender || (sp.gender === 'none' ? !genderOf.get(i.id) : genderOf.get(i.id) === sp.gender));
  const sort = sp.sort ?? 'new';
  const typeName = (id: string) => ctx.catById.get(id)?.name ?? '';
  const ordered = sort === 'new' ? filtered : [...filtered].sort((a, b) =>
    sort === 'name' ? a.name.localeCompare(b.name)
    : sort === 'type' ? typeName(a.categoryId).localeCompare(typeName(b.categoryId)) || a.name.localeCompare(b.name)
    : (a.fitFrom ?? 99) - (b.fitFrom ?? 99) || a.name.localeCompare(b.name));
  const pieces = filtered.reduce((s, i) => s + i.quantity, 0);
  const rangeText = (from: number | null, to: number | null) => {
    if (from === null || to === null) return 'Unknown';
    const a = ctx.sizeByOrder.get(from);
    const b = ctx.sizeByOrder.get(to);
    if (!a || !b) return 'Unknown';
    return from === to ? sizeName(a) : `${sizeName(a)} to ${sizeName(b)}`;
  };
  const activeFilters = [sp.fit, sp.group, sp.cat, sp.size, sp.gender, sp.season, sp.color, status !== 'active' ? status : '', sort !== 'new' ? sort : ''].filter(Boolean).length;
  const rowOf = new Map(rows.map((r) => [r.id, r]));
  const fbLabel = (v: number | null | undefined) => FIT_FEEDBACK.find(([k]) => Number(k) === v)?.[1];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{ctx.active.name}&apos;s closet</h1>
          <p className="text-muted">
            {filtered.length} record{filtered.length === 1 ? '' : 's'}, {pieces} piece{pieces === 1 ? '' : 's'}
            {sp.added ? ` · ${sp.added} added` : ''}
          </p>
          {sp.photos === 'partial' && <p role="status" className="text-sm text-warn">Items were added, but some photos could not be attached. Open an item to add them again.</p>}
        </div>
        <div className="flex gap-2">
          <Link className={btnGhostCls} href={`/closet/bulk?back=${bk}`}>Bulk add</Link>
          <Link className={btnCls} href={`/closet/new?back=${bk}`}>Add item</Link>
        </div>
      </div>

      <form className="flex flex-wrap items-start gap-2" method="get" role="search">
        <input className={`${inputCls} min-w-48 flex-1`} type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Search name, brand, or notes" aria-label="Search" />
        <FilterPanel count={activeFilters}>
        <select className={`${inputCls} w-auto`} name="fit" defaultValue={sp.fit ?? ''} aria-label="Fit">
          <option value="">Any fit</option>
          {Object.entries(FIT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <TypeFilters categories={ctx.categories} groups={ctx.groups} sizes={ctx.sizes} group={sp.group} cat={sp.cat} size={sp.size} sizeLabel="Tag size" />
        <select className={`${inputCls} w-auto`} name="gender" defaultValue={sp.gender ?? ''} aria-label="Gender">
          <option value="">Any gender</option>
          {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          <option value="none">Not set</option>
        </select>
        <select className={`${inputCls} w-auto`} name="status" defaultValue={status} aria-label="Status">
          <option value="all">Any status</option>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className={`${inputCls} w-auto`} name="season" defaultValue={sp.season ?? ''} aria-label="Season">
          <option value="">Any season</option>
          {SEASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
 <select className={`${inputCls} w-auto`} name="color" defaultValue={sp.color ?? ''} aria-label="Color">
          <option value="">Any color</option>
          {COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          <option value="none">Not set</option>
        </select>
        <select className={`${inputCls} w-auto`} name="sort" defaultValue={sort} aria-label="Sort by">
          <option value="new">Newest first</option>
          <option value="name">Name</option>
          <option value="type">Item type</option>
          <option value="size">Size</option>
        </select>
        </FilterPanel>
        <button className={btnGhostCls} type="submit">Filter</button>
        <Link className={btnGhostCls} href="/closet">Clear</Link>
      </form>

      {ctx.currentSize === null && (
        <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">
          {ctx.active.name} has no current size, so fit shows as unknown. <Link className="underline" href="/account#children">Set a size</Link>.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
          {items.length === 0 ? 'Nothing here yet. Add your first item or use bulk add.' : 'Nothing matches these filters.'}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
          {ordered.map((i) => {
            const state = fitStateFor(i, ctx.currentSize);
            const raw = rowOf.get(i.id)!;
            const tag = raw.label_id ? labelById.get(raw.label_id)?.label : (raw.custom_tag ?? undefined);
            const fb = fbLabel(feedbackById.get(i.id));
            return (
              <li key={i.id}>
                <Link href={`/closet/${i.id}?back=${bk}`} className="flex h-full flex-col gap-1.5 rounded-xl border border-line bg-surface p-2.5 hover:border-accent sm:p-3">
                  {coverPath.has(i.id) && coverUrls.get(coverPath.get(i.id)!) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrls.get(coverPath.get(i.id)!)} alt="" loading="lazy" className={`mb-1 aspect-[4/3] w-full rounded-lg ${coverPath.get(i.id)!.endsWith('.png') ? 'bg-line object-contain' : 'object-cover'}`} />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold [overflow-wrap:anywhere]">{i.name}</span>
                    {i.quantity > 1 && <span className="rounded-full bg-line px-2 text-xs">×{i.quantity}</span>}
                  </div>
                  <span className="text-sm text-muted">
                    <ColorDot color={raw.color} className="mr-1.5" />{ctx.catById.get(i.categoryId)?.name}{i.brand ? ` · ${i.brand}` : ''}{raw.gender ? ` · ${GENDERS.find(([v]) => v === raw.gender)?.[1]}` : ''}
                  </span>
                  <span className="text-sm text-muted">Tag {tag ?? 'not set'} · Fits {rangeText(i.fitFrom, i.fitTo)}</span>
                  <span className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    <Pill tone={state}>{FIT_LABELS[state]}</Pill>
                    {i.status !== 'active' && <Pill>{STATUSES.find(([v]) => v === i.status)?.[1]}</Pill>}
                    {i.condition === 'unusable' && <Pill tone="bad">{CONDITIONS.find(([v]) => v === i.condition)?.[1]}</Pill>}
                    {fb && <Pill>{fb}</Pill>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
