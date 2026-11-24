'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CHILD_COOKIE } from '@/lib/context';
import { safeNext } from '@/lib/auth/redirect';

/** Remembers which child the person is looking at. The id is checked again by row-level security on every query. */
export async function setActiveChild(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (id.success) {
    (await cookies()).set(CHILD_COOKIE, id.data, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: true });
  }
  redirect(safeNext(String(formData.get('next') ?? ''), '/dashboard'));
}
