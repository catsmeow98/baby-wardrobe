import type { Metadata } from 'next';
import Link from 'next/link';
import { signIn } from '../actions';
import { FormMessage } from '@/components/form-message';
import { btnCls, inputCls, labelCls } from '@/components/ui';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const { error, message, next } = await searchParams;
  return (
    <form action={signIn} className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold">Sign in</h1>
      <FormMessage error={error} message={message} />
      <input type="hidden" name="next" value={next ?? ''} />
      <label className={labelCls}>
        Email
        <input className={inputCls} type="email" name="email" autoComplete="email" required />
      </label>
      <label className={labelCls}>
        Password
        <input className={inputCls} type="password" name="password" autoComplete="current-password" required />
      </label>
      <button className={btnCls} type="submit">Sign in</button>
      <div className="flex justify-between text-sm">
        <Link className="text-accent underline" href="/signup">Create an account</Link>
        <Link className="text-accent underline" href="/forgot-password">Forgot password?</Link>
      </div>
    </form>
  );
}
