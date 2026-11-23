import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../(auth)/actions';
import { btnGhostCls } from '@/components/ui';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The middleware already redirects signed-out visitors. This is the second check, close to the data.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
        <Link href="/children" className="font-display text-xl font-bold">Baby Wardrobe</Link>
        <nav aria-label="Main" className="flex items-center gap-4 text-sm">
          <Link href="/children" className="font-medium">Children</Link>
          <span className="hidden text-muted sm:inline">{user.email}</span>
          <form action={signOut}>
            <button className={btnGhostCls} type="submit">Sign out</button>
          </form>
        </nav>
      </header>
      <main className="flex flex-col gap-6 pt-6">{children}</main>
    </div>
  );
}
