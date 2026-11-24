import type { Metadata } from 'next';
import Link from 'next/link';
import { signUp } from '../actions';
import { FormMessage } from '@/components/form-message';
import { safeNext } from '@/lib/auth/redirect';
import { btnCls, inputCls, labelCls } from '@/components/ui';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const dest = safeNext(next, '');
  return (
    <form action={signUp} className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold">Create your account</h1>
      <FormMessage error={error} />
      {dest && <p className="rounded-lg bg-accent-soft p-3 text-sm">Your suggestions are saved with this link. Create an account and you will pick up where you left off.</p>}
      <input type="hidden" name="next" value={dest} />
      <label className={labelCls}>
        Email
        <input className={inputCls} type="email" name="email" autoComplete="email" required />
      </label>
      <label className={labelCls}>
        Password
        <input className={inputCls} type="password" name="password" autoComplete="new-password" minLength={8} required />
        <span className="text-xs">At least 8 characters.</span>
      </label>
      <button className={btnCls} type="submit">Create account</button>
      <p className="text-sm">
        Already have an account? <Link className="text-accent underline" href={dest ? `/login?next=${encodeURIComponent(dest)}` : '/login'}>Sign in</Link>
      </p>
    </form>
  );
}
