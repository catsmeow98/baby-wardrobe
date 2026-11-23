import type { Metadata } from 'next';
import Link from 'next/link';
import { signUp } from '../actions';
import { FormMessage } from '@/components/form-message';
import { btnCls, inputCls, labelCls } from '@/components/ui';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form action={signUp} className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold">Create your account</h1>
      <FormMessage error={error} />
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
        Already have an account? <Link className="text-accent underline" href="/login">Sign in</Link>
      </p>
    </form>
  );
}
