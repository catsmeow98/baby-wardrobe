import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../(auth)/actions';
import { setActiveChild } from './actions';
import { getContext } from '@/lib/context';
import { btnGhostCls } from '@/components/ui';
import { Nav } from './nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The middleware already redirects signed-out visitors. This is the second check, close to the data.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const ctx = await getContext();

  const switcher = (idSuffix: string) =>
    ctx.children.length > 1 && (
      <form action={setActiveChild} className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`child-switch-${idSuffix}`}>Child</label>
        <select id={`child-switch-${idSuffix}`} name="id" defaultValue={ctx.active?.id} className="rounded-lg border border-line bg-surface px-2 py-1.5">
          {ctx.children.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className={btnGhostCls} type="submit">Switch</button>
      </form>
    );

  return (
    <div className="mx-auto max-w-4xl px-4 pb-[calc(7rem+var(--safe-bottom))] md:pb-16">
      <header className="flex items-center justify-between gap-3 pt-3">
        <Link href="/dashboard" className="font-display text-xl font-bold">Baby Wardrobe</Link>
        <div className="flex items-center gap-3 text-sm">
          <div className="hidden md:block">{switcher('top')}</div>
          <span className="hidden text-muted md:inline">{user.email}</span>
          <form action={signOut} className="hidden md:block">
            <button className={btnGhostCls} type="submit">Sign out</button>
          </form>
          {ctx.active && ctx.children.length > 0 && <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold md:hidden">{ctx.active.name}</span>}
        </div>
      </header>
      <Nav>
        {switcher('sheet')}
        <span className="text-muted">{user.email}</span>
        <form action={signOut}>
          <button className={btnGhostCls} type="submit">Sign out</button>
        </form>
      </Nav>
      <main className="flex flex-col gap-6 pt-4 md:pt-6">{children}</main>
    </div>
  );
}
