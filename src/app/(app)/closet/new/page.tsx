import { redirect } from 'next/navigation';

/** The single-item add screen is gone: adding always uses the step-by-step add (old links and "Add another like this" land there). */
export default async function NewItemPage({ searchParams }: { searchParams: Promise<{ from?: string; back?: string }> }) {
  const { from, back } = await searchParams;
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (back) q.set('back', back);
  redirect(`/closet/bulk${q.size ? `?${q}` : ''}`);
}
