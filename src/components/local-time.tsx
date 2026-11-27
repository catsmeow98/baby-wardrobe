'use client';

import { useEffect, useState } from 'react';

/** A moment shown in the person's own time zone ("Fri, Nov 27, 1:20 PM"). The server cannot know the zone, so the first
 * paint shows the date alone and the time fills in once the page runs in the browser. */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState(iso.slice(0, 10));
  useEffect(() => {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) setText(new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d));
  }, [iso]);
  return <time dateTime={iso}>{text}</time>;
}
