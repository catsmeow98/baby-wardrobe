import Link from 'next/link';
import { dismissSetup } from './welcome/actions';

/** The setup guide has no tab bar: one question at a time, with a way out on every screen. */
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-[calc(7rem+var(--safe-bottom))] pt-3">
      <header className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="font-display text-xl font-bold">Baby Wardrobe</Link>
        <form action={dismissSetup}>
          <button type="submit" className="text-sm text-muted underline">Skip setup</button>
        </form>
      </header>
      <main className="flex flex-1 flex-col gap-5 pt-4">{children}</main>
    </div>
  );
}
