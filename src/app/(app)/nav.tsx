'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** [path, label, other paths that keep this tab highlighted]. The survey lives under Goals, and brands under Forecast. */
const links: readonly (readonly [string, string, readonly string[]])[] = [
  ['/dashboard', 'Dashboard', []],
  ['/closet', 'Closet', []],
  ['/goals', 'Goals', ['/survey']],
  ['/forecast', 'Forecast', ['/brands']],
  ['/shopping', 'Shopping', []],
  ['/categories', 'Items', []],
  ['/account', 'Account', ['/children']],
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="mt-3 flex gap-1 overflow-x-auto border-b border-line">
      {links.map(([href, label, also]) => {
        const on = [href, ...also].some((p) => path === p || path.startsWith(`${p}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? 'page' : undefined}
            className={`whitespace-nowrap border-b-[3px] px-3.5 py-2.5 text-sm ${on ? 'border-accent font-bold' : 'border-transparent text-muted'}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
