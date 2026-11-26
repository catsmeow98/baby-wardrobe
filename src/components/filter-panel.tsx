'use client';

import { useState } from 'react';
import { btnGhostCls } from '@/components/ui';

/**
 * Filter controls that fold away on a phone behind one button (showing how many filters are on) and sit open on wider
 * screens. Put it inside the GET form; the controls inside still submit with the form.
 */
export function FilterPanel({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex w-full flex-col gap-2 md:contents">
      <button type="button" className={`${btnGhostCls} md:hidden`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide filters' : count > 0 ? `Filters (${count} on)` : 'Filters'}
      </button>
      <div className={`${open ? 'grid' : 'hidden'} grid-cols-2 gap-2 md:contents [&_select]:w-full md:[&_select]:w-auto`}>{children}</div>
    </div>
  );
}
