import { redirect } from 'next/navigation';

/** Children are managed on the Account page now. Old links and bookmarks land there, keeping any message or "next" address. */
export default async function ChildrenRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) qs.append(k, x);
  const q = qs.toString();
  return redirect(`/account${q ? `?${q}` : ''}#children`);
}
