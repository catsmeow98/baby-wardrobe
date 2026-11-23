import type { Metadata } from 'next';
import { updatePassword } from '../actions';
import { FormMessage } from '@/components/form-message';
import { btnCls, inputCls, labelCls } from '@/components/ui';

export const metadata: Metadata = { title: 'Choose a new password' };

// Reached from the emailed link through /auth/callback, which signs the user in with a one-time code first.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form action={updatePassword} className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold">Choose a new password</h1>
      <FormMessage error={error} />
      <label className={labelCls}>
        New password
        <input className={inputCls} type="password" name="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label className={labelCls}>
        Confirm password
        <input className={inputCls} type="password" name="confirm" autoComplete="new-password" minLength={8} required />
      </label>
      <button className={btnCls} type="submit">Save password</button>
    </form>
  );
}
