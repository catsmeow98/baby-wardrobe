import type { Metadata } from 'next';
import { getContext } from '@/lib/context';
import { FormMessage } from '@/components/form-message';
import { inputCls, labelCls } from '@/components/ui';
import { deleteAccount } from './actions';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ctx = await getContext();
  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Account</h1>
        <p className="text-muted">Signed in as {ctx.user.email}.</p>
      </div>
      <FormMessage error={error} />
      <section className="flex flex-col gap-3 rounded-xl border border-bad p-4">
        <h2 className="font-display text-lg font-bold text-bad">Delete account</h2>
        <p className="text-sm">
          This permanently deletes your account and everything in it: every child, closet item, photo, goal, shopping entry, measurement and brand.
          It cannot be undone and we cannot recover it afterward.
        </p>
        <form action={deleteAccount} className="flex flex-col gap-3">
          <label className={labelCls}>
            Type DELETE to confirm
            <input className={`${inputCls} max-w-xs`} name="confirm" autoComplete="off" autoCapitalize="characters" required />
          </label>
          <div><button className="rounded-lg bg-bad px-4 py-2 font-bold text-white" type="submit">Delete my account</button></div>
        </form>
      </section>
    </>
  );
}
