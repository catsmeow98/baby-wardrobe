'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  ['/dashboard', 'Dashboard'],
  ['/closet', 'Closet'],
  ['/goals', 'Goals'],
  ['/survey', 'Goal survey'],
  ['/forecast', 'Forecast'],
  ['/shopping', 'Shopping'],
  ['/children', 'Children'],
  ['/categories', 'Categories'],
  ['/brands', 'Brands'],
  ['/account', 'Account'],
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="mt-3 flex gap-1 overflow-x-auto border-b border-line">
      {links.map(([href, label]) => {
        const on = path === href || path.startsWith(`${href}/`);
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
