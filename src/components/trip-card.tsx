import Link from 'next/link';
import { LocalTime } from '@/components/local-time';
import { btnCls, btnGhostCls } from '@/components/ui';
import { tripSummary, type Trip } from '@/lib/trips';

/** A name that is itself the date and time (the default, "Nov 27, 8:03 PM"), so the time need not be shown again. */
const looksLikeTime = (name: string) => /\d{1,2}:\d{2}\s?(AM|PM|am|pm)?/.test(name);

/** A shopping trip whose pieces still need photos and details, with a button into bulk add set up for it. */
export function TripCard({ trip, typeName, sizeName, back, prompt = false, laterHref }: {
  trip: Trip;
  typeName: (categoryId: string) => string;
  /** A size's name by id, so the summary can say which sizes. */
  sizeName?: (sizeId: string) => string;
  /** Where bulk add returns to. */
  back: string;
  /** Right after receiving: ask, with a Later button. */
  prompt?: boolean;
  laterHref?: string;
}) {
  const href = `/closet/bulk?trip=${trip.id}&back=${encodeURIComponent(back)}`;
  return (
    <div className={`flex flex-col gap-2 rounded-xl p-4 ${prompt ? 'border border-accent bg-accent-soft' : 'border border-line bg-surface'}`}>
      <p>
        {prompt ? <>{trip.name && <><b>{trip.name}</b>: </>}<b>{trip.pieces} piece{trip.pieces === 1 ? '' : 's'}</b> {trip.pieces === 1 ? 'is' : 'are'} in your closet. Add photos and details now?</>
          : <><b>{trip.name ?? <LocalTime iso={trip.at} />}</b>{trip.name && !looksLikeTime(trip.name) && <span className="text-sm text-muted"> · <LocalTime iso={trip.at} /></span>} · {trip.pieces} piece{trip.pieces === 1 ? '' : 's'}</>}
      </p>
      <p className="text-sm text-muted">{tripSummary(trip, typeName, sizeName)}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Link className={btnCls} href={href}>Add photos</Link>
        {prompt && laterHref && <Link className={btnGhostCls} href={laterHref}>Later</Link>}
        {prompt && <span className="text-xs text-muted">Later keeps this trip on the Home screen.</span>}
      </div>
    </div>
  );
}
