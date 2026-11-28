'use client';

import { useEffect } from 'react';

/** A panel that slides up from the bottom, over the page and its navigation. Tapping outside closes it. */
export function Sheet({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-3 rounded-t-2xl bg-bg p-4 pb-[calc(1rem+var(--safe-bottom))] shadow-xl">
        {children}
      </div>
    </div>
  );
}
