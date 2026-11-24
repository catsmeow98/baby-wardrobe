import Link from 'next/link';
import { btnCls, btnGhostCls } from '@/components/ui';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-4 pb-16 pt-5">
      <header className="flex items-center justify-between gap-3">
        <Link href="/calculator" className="font-display text-xl font-bold">Baby Wardrobe</Link>
        <nav aria-label="Account" className="flex gap-2">
          <Link className={btnGhostCls} href="/login">Sign in</Link>
          <Link className={btnCls} href="/signup">Create account</Link>
        </nav>
      </header>
      {children}
      <footer className="mt-4 border-t border-line pt-4 text-sm text-muted">
        Suggestions are a starting point based on common routines, not medical or sizing advice. Every baby is different.
      </footer>
    </div>
  );
}
