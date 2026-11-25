import { ColorDot } from '@/components/color-dot';
import type { PickItem } from '@/lib/outfit-data';

/** Up to six items as a grid of photo tiles. An item with no photo shows its name and color. */
export function OutfitCollage({ items }: { items: readonly PickItem[] }) {
  const shown = items.slice(0, 6);
  return (
    <ul className={`grid gap-1 ${shown.length <= 1 ? 'grid-cols-1' : shown.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {shown.map((i) => (
        <li key={i.id} className="relative aspect-square overflow-hidden rounded-lg bg-line">
          {i.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={i.photoUrl} alt={i.name} loading="lazy" className={`size-full ${i.cutout ? 'object-contain' : 'object-cover'}`} />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1 p-1 text-center text-xs text-muted">
              <ColorDot color={i.color} />
              <span className="[overflow-wrap:anywhere]">{i.name}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
