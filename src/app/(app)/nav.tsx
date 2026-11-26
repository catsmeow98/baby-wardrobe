'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/** [path, label, other paths that keep this tab highlighted]. The survey lives under Goals, and brands under Forecast. */
type Entry = readonly [string, string, readonly string[]];
const MAIN: readonly Entry[] = [
  ['/dashboard', 'Home', []],
  ['/closet', 'Closet', []],
  ['/outfits', 'Outfits', []],
  ['/goals', 'Goals', ['/survey']],
];
const MORE: readonly Entry[] = [
  ['/shopping', 'Shopping', []],
  ['/forecast', 'Forecast', ['/brands']],
  ['/categories', 'Item types', []],
  ['/account', 'Account', ['/children']],
];

const isOn = (path: string, [href, , also]: Entry) => [href, ...also].some((p) => path === p || path.startsWith(`${p}/`));

const ICONS: Record<string, string> = {
  Home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  Closet: 'M8 3l4 3 4-3 5 4-3 3v11H6V10L3 7z',
  Outfits: 'M4 6h16M4 12h16M4 18h16',
  Goals: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  More: 'M5 12h.01M12 12h.01M19 12h.01',
};

function Icon({ name }: { name: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/**
 * Wide screens: tabs across the top. Phones: a bar of four main places and "More" along the bottom, where "More" opens a
 * sheet with the rest plus whatever the layout passes in (child switch, sign out).
 */
export function Nav({ children }: { children?: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const moreOn = MORE.some((e) => isOn(path, e));

  const tab = 'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px]';
  return (
    <>
      <nav aria-label="Main" className="mt-3 hidden gap-1 overflow-x-auto border-b border-line md:flex">
        {[...MAIN, ...MORE].map((e) => (
          <Link
            key={e[0]}
            href={e[0]}
            aria-current={isOn(path, e) ? 'page' : undefined}
            className={`whitespace-nowrap border-b-[3px] px-3.5 py-2.5 text-sm ${isOn(path, e) ? 'border-accent font-bold' : 'border-transparent text-muted'}`}
          >
            {e[1]}
          </Link>
        ))}
      </nav>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {MAIN.map((e) => (
          <Link key={e[0]} href={e[0]} aria-current={isOn(path, e) ? 'page' : undefined} className={`${tab} ${isOn(path, e) ? 'font-bold text-accent' : 'text-muted'}`}>
            <Icon name={e[1]} />
            {e[1]}
          </Link>
        ))}
        <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)} className={`${tab} ${open || moreOn ? 'font-bold text-accent' : 'text-muted'}`}>
          <Icon name="More" />
          More
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col gap-4 overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-4 pb-24">
            <ul className="grid grid-cols-2 gap-2">
              {MORE.map((e) => (
                <li key={e[0]}>
                  <Link href={e[0]} aria-current={isOn(path, e) ? 'page' : undefined} className={`block rounded-xl border px-4 py-3 text-center ${isOn(path, e) ? 'border-accent font-bold' : 'border-line'}`}>
                    {e[1]}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 border-t border-line pt-3 text-sm">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
