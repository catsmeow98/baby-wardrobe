'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { safeNext } from '@/lib/auth/redirect';

const email = z.string().trim().toLowerCase().email('Enter a valid email address.');
const password = z.string().min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.');

const go = (path: string, params: Record<string, string | undefined>): never => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const qs = q.toString();
  return redirect(qs ? `${path}?${qs}` : path);
};

export async function signIn(formData: FormData) {
  const next = safeNext(String(formData.get('next') ?? ''));
  const parsed = z.object({ email, password: z.string().min(1, 'Enter your password.') }).safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return go('/login', { error: parsed.error.issues[0].message, next });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // One message for every failure, so the form never reveals whether an email has an account.
  if (error) return go('/login', { error: 'Email or password is incorrect.', next });
  return redirect(next);
}

export async function signUp(formData: FormData) {
  // A new account starts in the setup guide unless the sign-up link says where to go.
  const next = safeNext(String(formData.get('next') ?? ''), '/welcome');
  const parsed = z.object({ email, password }).safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return go('/signup', { error: parsed.error.issues[0].message, next: formData.get('next') ? next : undefined });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${env.siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return go('/signup', { error: 'We could not create that account. Try a different email or password.', next: formData.get('next') ? next : undefined });
  if (data.session) return redirect(next); // email confirmation is switched off
  // The next page travels with the sign-in form too, in case the confirmation link opens somewhere that drops it.
  return go('/login', { message: 'Check your email to confirm your account, then sign in.', next: formData.get('next') ? next : undefined });
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = email.safeParse(formData.get('email'));
  if (!parsed.success) return go('/forgot-password', { error: parsed.error.issues[0].message });
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${env.siteUrl()}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the address has an account.
  return go('/forgot-password', { message: 'If that email has an account, a reset link is on its way.' });
}

export async function updatePassword(formData: FormData) {
  const parsed = password.safeParse(formData.get('password'));
  if (!parsed.success) return go('/reset-password', { error: parsed.error.issues[0].message });
  if (formData.get('confirm') !== formData.get('password')) return go('/reset-password', { error: 'The passwords do not match.' });
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return go('/reset-password', { error: 'The reset link has expired. Request a new one.' });
  return redirect('/account');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect('/login');
}
