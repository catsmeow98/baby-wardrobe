/**
 * Remembering where a person came from. A list page (closet, goals, shopping) puts its own address, filters included, in a
 * "back" value; the page or action that finishes the job sends the person back to it. Only addresses inside the given base
 * path are accepted, so the value cannot be used to send anyone to another site or section.
 */
const ONE_SHOT = new Set(['error', 'ok', 'saved', 'added', 'photos', 'back']);
// Room for many repeated filters (?cat=<id>&cat=<id>…); an id is 36 characters.
const MAX = 4000;

type Params = Record<string, string | string[] | undefined>;

/** The page's own address with its filters, minus one-time messages. */
export function currentUrl(base: string, sp: Params): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (ONE_SHOT.has(k) || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) q.append(k, x);
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/** The address to return to: raw when it belongs under base, otherwise base itself. One-time messages are dropped. */
export function safeBack(raw: unknown, base: string): string {
  if (typeof raw !== 'string' || raw.length > MAX || /[\u0000-\u001f\\]/.test(raw)) return base;
  if (raw !== base && !raw.startsWith(`${base}?`)) return base;
  // Keep every value of a repeated filter (?cat=a&cat=b), not just one of them.
  const sp: Record<string, string[]> = {};
  for (const [k, v] of new URLSearchParams(raw.slice(base.length + 1))) (sp[k] ??= []).push(v);
  return currentUrl(base, sp);
}

/** The address with these query values set, replacing any it already has. */
export function withParams(url: string, params: Record<string, string | undefined>): string {
  const [path, query = ''] = url.split('?');
  const q = new URLSearchParams(query);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Like safeBack, for a page that can be reached from more than one section. The first base the address belongs under wins. */
export function safeBackAny(raw: unknown, bases: readonly string[], fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const base = bases.find((b) => raw === b || raw.startsWith(`${b}?`));
  return base ? safeBack(raw, base) : fallback;
}
