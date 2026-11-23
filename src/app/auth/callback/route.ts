import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth/redirect';

/** Email confirmation and password-reset links land here with a one-time code. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  const login = new URL('/login', request.url);
  login.searchParams.set('error', 'That link is invalid or has expired. Try again.');
  return NextResponse.redirect(login);
}
