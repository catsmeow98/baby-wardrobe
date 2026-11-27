import { ITEM_ICONS, iconForType, iconKeyFor } from '@/lib/item-icons';

/** A line icon for an item type. Decorative: always put the item's name next to it. */
export function ItemIcon({ itemKey, group, size = 28, className }: { itemKey: string; group?: string; size?: number; className?: string }) {
  const paths = ITEM_ICONS[iconKeyFor(itemKey, group)];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {paths.map((d, i) => (d.startsWith('~') ? <path key={i} d={d.slice(1)} strokeWidth="1.2" strokeDasharray="0.1 2.1" /> : <path key={i} d={d} />))}
    </svg>
  );
}

/** The icon for an item type row (from ctx.catById and the like). Decorative, like ItemIcon. */
export function TypeIcon({ type, size = 20, className }: { type: Parameters<typeof iconForType>[0]; size?: number; className?: string }) {
  return <ItemIcon itemKey={iconForType(type)} size={size} className={className} />;
}
