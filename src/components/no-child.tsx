import Link from 'next/link';
import { btnCls } from '@/components/ui';

export function NoChild() {
  return (
    <div className="rounded-xl border border-dashed border-line p-8 text-center">
      <p className="mb-3 text-muted">Add a child first. Each child has their own closet, goals, and shopping list.</p>
      <Link className={btnCls} href="/children">Add a child</Link>
    </div>
  );
}
