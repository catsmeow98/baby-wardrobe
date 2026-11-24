/**
 * Only allow redirects to a path on this site. Blocks open redirects such as "//evil.example", "https://evil.example"
 * and backslash tricks.
 */
export function safeNext(next: string | null | undefined, fallback = '/children'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}

export const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/calculator'];

export const isPublicPath = (pathname: string): boolean =>
  PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/auth/');
