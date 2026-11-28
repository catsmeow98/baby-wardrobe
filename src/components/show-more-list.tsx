'use client';

import { useState, type ReactNode } from 'react';

/** Shows the first `initial` items, with a button to show the rest. */
export function ShowMoreList({ items, initial = 5, className }: { items: ReactNode[]; initial?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const hidden = items.length - initial;
  return (
    <>
      <ul className={className}>{open || hidden <= 0 ? items : items.slice(0, initial)}</ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-2 w-full rounded-lg border border-line py-2 text-sm font-bold text-accent"
        >
          {open ? 'Show less' : `Show more (${hidden})`}
        </button>
      )}
    </>
  );
}
