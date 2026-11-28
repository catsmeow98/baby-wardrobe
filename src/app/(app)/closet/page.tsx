import type { Metadata } from 'next';
import Link from 'next/link';
import { getContext, toInventory } from '@/lib/context';
import { NoChild } from '@/components/no-child';
import { Pill } from '@/components/pill';
import { btnCls, btnGhostCls, inputCls } from '@/components/ui';
import { COLORS, FIT_FEEDBACK, FIT_LABELS, GENDERS, STATUSES } from '@/lib/db';
import { loadTags } from '@/lib/tags';
import type { ItemRow, SizeLabelRow } from '@/lib/db';
import { ColorDot } from '@/components/color-dot';
import { TypeFilters } from '@/components/type-filters';
import { MultiSelect } from '@/components/multi-select';
import { listOf } from '@/lib/multi';
import { TypeIcon } from '@/components/item-icon';
import { matchesCategory } from '@/lib/categories';
import { signedUrls } from '@/lib/photos';
import { FilterPanel } from '@/components/filter-panel';
import { currentUrl } from '@/lib/back';
import { filterItems, fitStateFor, parseTagRange, type FitState } from '@/lib/domain';
import { tagFitText } from '@/lib/fit-text';
import { ClosetGrid } from '@/components/closet-grid';

export const metadata: Metadata = { title: 'Closet' };

// Filters can repeat (?cat=a&cat=b). f=1 marks a submitted filter form, so ticking no status means any status, not the default.
type Many = string | string[];
type SP = { q?: string; fit?: Many; cat?: Many; group?: Many; gender?: Many; color?: Many; sort?: string; size?: Many; status?: Many; tag?: Many; f?: string; added?: string; photos?: string; tags?: string; updated?: string; deleted?: string; error?: string };

export default async function ClosetPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx.active) return <NoChild />;
  // Opening an item or the add pages carries this address along, so finishing there comes back to the same filters.
  const here = currentUrl('/closet', sp);
  const bk = encodeURIComponent(here);

  const [{ data: itemRows }, { data: labelData }, { data: brandData }, tagInfo] = await Promise.all([
    ctx.supabase.from('inventory_items').select('*').eq('child_id', ctx.active.id).order('created_at', { ascending: false }),
    ctx.supabase.from('size_labels').select('id, size_id, label, sort_order'),
    ctx.supabase.from('brands').select('id, name'),
    loadTags(ctx),
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
  const fits = listOf(sp.fit).filter((v): v is FitState => v in FIT_LABELS);
  const cats = listOf(sp.cat);
  const groupIds = listOf(sp.group);
  const tagSizes = listOf(sp.size);
  const genders = listOf(sp.gender);
  const colors = listOf(sp.color);
  // Tags are shared by all children; only ones on this child's items are offered as filters.
  const tagPicks = listOf(sp.tag);
  const usedTagIds = new Set(rows.flatMap((r) => tagInfo.idsByItem.get(r.id) ?? []));
  const tagOptions = tagInfo.tags.filter((t) => usedTagIds.has(t.id) || tagPicks.includes(t.id));
  // Active pieces by default. Once the filters are submitted, no status ticked means any ("all" is from older links).
  const statusPicked = listOf(sp.status).filter((v) => v !== 'all');
  const statuses = statusPicked.length || sp.f === '1' || listOf(sp.status).includes('all') ? statusPicked : ['active'];
  const shown = filterItems(
    items,
    {
      q: sp.q,
      fits,
      categoryIds: cats,
      tagGroups: tagSizes.map(Number).filter(Number.isFinite),
      statuses,
    },
    ctx.currentSize,
    ctx.currentSizeTo,
  );
  const filtered = shown
    .filter((i) => matchesCategory(ctx.catById.get(i.categoryId), { group: groupIds }))
    .filter((i) => !colors.length || colors.includes(colorOf.get(i.id) ?? 'none'))
    .filter((i) => !genders.length || genders.includes(genderOf.get(i.id) ?? 'none'))
    .filter((i) => !tagPicks.length || (tagInfo.idsByItem.get(i.id) ?? []).some((t) => tagPicks.includes(t)));
  const sort = sp.sort ?? 'new';
  const typeName = (id: string) => ctx.catById.get(id)?.name ?? '';
  const ordered = sort === 'new' ? filtered : [...filtered].sort((a, b) =>
    sort === 'name' ? a.name.localeCompare(b.name)
    : sort === 'type' ? typeName(a.categoryId).localeCompare(typeName(b.categoryId)) || a.name.localeCompare(b.name)
    : (a.fitFrom ?? 99) - (b.fitFrom ?? 99) || a.name.localeCompare(b.name));
  const pieces = filtered.reduce((s, i) => s + i.quantity, 0);
  // The sizes a tag covers: one size for a listed tag, the covered sizes for a custom range such as 6-12M.
  const tagRangeOf = (r: ItemRow): { from: number | null; to: number | null } => {
    if (r.label_id) {
      const o = tagGroupOf.get(r.label_id) ?? null;
      return { from: o, to: o };
    }
    if (r.custom_tag) {
      const c = parseTagRange(r.custom_tag.replace(/M$/i, ''));
      if (!('error' in c)) return { from: c.fitFrom, to: c.fitTo };
    }
    return { from: null, to: null };
  };
  const isDefaultStatus = statuses.length === 1 && statuses[0] === 'active';
  const activeFilters = [fits, groupIds, cats, tagSizes, genders, tagPicks, colors].filter((l) => l.length > 0).length + (isDefaultStatus ? 0 : 1) + (sort !== 'new' ? 1 : 0);
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
            {sp.updated ? ` · ${sp.updated} updated` : ''}
            {sp.deleted ? ` · ${sp.deleted} deleted` : ''}
          </p>
          {sp.error && <p role="alert" className="text-sm text-bad">{sp.error}</p>}
          {sp.tags === 'partial' && <p role="status" className="text-sm text-warn">Items were added, but their tags could not be saved. Add them on each item.</p>}
          {sp.photos === 'partial' && <p role="status" className="text-sm text-warn">Items were added, but some photos could not be attached. Open an item to add them again.</p>}
        </div>
        <div className="flex gap-2">
          <Link className={btnCls} href={`/closet/bulk?back=${bk}`}>Add items</Link>
        </div>
      </div>

      <form className="flex flex-wrap items-start gap-2" method="get" role="search">
        <input className={`${inputCls} min-w-48 flex-1`} type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Search name, brand, or notes" aria-label="Search" />
        <input type="hidden" name="f" value="1" />
        <FilterPanel count={activeFilters}>
          <MultiSelect label="Fit" name="fit" defaultSelected={fits} options={Object.entries(FIT_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
          <TypeFilters categories={ctx.categories} groups={ctx.groups} sizes={ctx.sizes} group={groupIds} cat={cats} size={tagSizes} sizeLabel="Tag size" />
          <MultiSelect label="Gender" name="gender" defaultSelected={genders} options={[...GENDERS.map(([v, l]) => ({ value: v, label: l })), { value: 'none', label: 'Not set' }]} />
          <MultiSelect label="Status" name="status" defaultSelected={statuses} options={STATUSES.map(([v, l]) => ({ value: v, label: l }))} />
          {tagOptions.length > 0 && <MultiSelect label="Tags" name="tag" defaultSelected={tagPicks} options={tagOptions.map((t) => ({ value: t.id, label: t.name }))} />}
          <MultiSelect label="Color" name="color" defaultSelected={colors} options={[...COLORS.map(([v, l]) => ({ value: v, label: l })), { value: 'none', label: 'Not set' }]} />
          <select className={`${inputCls} w-auto`} name="sort" defaultValue={sort} aria-label="Sort by">
            <option value="new">Newest first</option>
            <option value="name">Name</option>
            <option value="type">Item type</option>
            <option value="size">Size</option>
          </select>
          <button className={`${btnCls} col-span-2 md:col-span-1`} type="submit">Apply filters</button>
        </FilterPanel>
        {(activeFilters > 0 || sp.q) && <Link className={btnGhostCls} href="/closet">Clear filters</Link>}
      </form>
      {cats.some((id) => ctx.catById.get(id)) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          Showing
          {cats.flatMap((id) => {
            const c = ctx.catById.get(id);
            return c ? [<span key={id} className="flex items-center gap-1"><TypeIcon type={c} size={20} className="text-accent" /><b className="text-ink">{c.name}</b></span>] : [];
          })}
        </p>
      )}

      {ctx.currentSize === null && (
        <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">
          {ctx.active.name} has no current size, so fit shows as unknown. <Link className="underline" href="/account#children">Set a size</Link>.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
          {items.length === 0 ? 'Nothing here yet. Tap Add items to start.' : 'Nothing matches these filters.'}
        </div>
      ) : (
        <ClosetGrid
          back={here}
          tagNames={tagInfo.tags.map((t) => t.name)}
          tagsByItem={Object.fromEntries(ordered.map((i) => [i.id, tagInfo.byItem.get(i.id) ?? []]))}
          cards={ordered.map((i) => {
            const state = fitStateFor(i, ctx.currentSize, ctx.currentSizeTo);
            const raw = rowOf.get(i.id)!;
            const tag = raw.label_id ? labelById.get(raw.label_id)?.label : (raw.custom_tag ?? undefined);
            const fb = fbLabel(feedbackById.get(i.id));
            return {
              id: i.id,
              href: `/closet/${i.id}?back=${bk}`,
              content: (
                <>
                  {coverPath.has(i.id) && coverUrls.get(coverPath.get(i.id)!) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrls.get(coverPath.get(i.id)!)} alt="" loading="lazy" className={`mb-1 aspect-[4/3] w-full rounded-lg ${coverPath.get(i.id)!.endsWith('.png') ? 'bg-line object-contain' : 'object-cover'}`} />
                  ) : (
                    <span className="mb-1 flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-line/60 text-muted">
                      <TypeIcon type={ctx.catById.get(i.categoryId)} size={56} />
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold [overflow-wrap:anywhere]">{i.name}</span>
                    {i.quantity > 1 && <span className="rounded-full bg-line px-2 text-xs">×{i.quantity}</span>}
                  </div>
                  <span className="text-sm text-muted">
                    <ColorDot color={raw.color} className="mr-1.5" />{ctx.catById.get(i.categoryId)?.name}{i.brand ? ` · ${i.brand}` : ''}{raw.gender ? ` · ${GENDERS.find(([v]) => v === raw.gender)?.[1]}` : ''}
                  </span>
                  <span className="text-sm text-muted">{tagFitText(tag, tagRangeOf(raw), { from: i.fitFrom, to: i.fitTo }, (o) => ctx.sizeByOrder.get(o)?.label)}</span>
                  {(tagInfo.byItem.get(i.id)?.length ?? 0) > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {tagInfo.byItem.get(i.id)!.map((t) => <span key={t} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{t}</span>)}
                    </span>
                  )}
                  <span className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    <Pill tone={state}>{FIT_LABELS[state]}</Pill>
                    {i.status !== 'active' && <Pill>{STATUSES.find(([v]) => v === i.status)?.[1]}</Pill>}
                    {fb && <Pill>{fb}</Pill>}
                    {raw.needs_details && <Pill tone="warn">Needs photos</Pill>}
                  </span>
                </>
              ),
            };
          })}
        />
      )}
    </>
  );
}
