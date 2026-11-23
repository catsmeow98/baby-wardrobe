import type { Metadata } from 'next';
import Link from 'next/link';
import { requestPasswordReset } from '../actions';
import { FormMessage } from '@/components/form-message';
import { btnCls, inputCls, labelCls } from '@/components/ui';

export const metadata: Metadata = { title: 'Reset password' };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;
  return (
    <form action={requestPasswordReset} className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold">Reset your password</h1>
      <FormMessage error={error} message={message} />
      <label className={labelCls}>
        Email
        <input className={inputCls} type="email" name="email" autoComplete="email" required />
      </label>
      <button className={btnCls} type="submit">Send reset link</button>
      <Link className="text-sm text-accent underline" href="/login">Back to sign in</Link>
    </form>
  );
}
