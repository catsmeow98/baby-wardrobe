/**
 * Custom tag ranges. A tag can say "6-12" (months) even though no size group is called that. The range maps onto
 * the size groups it covers: 6-12 months covers 6-9M and 9-12M. Newborn is never chosen from months, because a
 * range starting at 0 begins at 0-3M. Everything returned is a size-group order (see sizes.ts).
 */
const GROUPS: readonly { order: number; lo: number; hi: number }[] = [
  { order: 1, lo: 0, hi: 3 },
  { order: 2, lo: 3, hi: 6 },
  { order: 3, lo: 6, hi: 9 },
  { order: 4, lo: 9, hi: 12 },
  { order: 5, lo: 12, hi: 18 },
  { order: 6, lo: 18, hi: 24 },
  { order: 7, lo: 24, hi: 36 },
  { order: 8, lo: 36, hi: 48 },
  { order: 9, lo: 48, hi: 60 },
];
export const MAX_TAG_MONTHS = 60;

export interface TagRange {
  /** Normalised text, such as "6-12M". */
  label: string;
  fitFrom: number;
  fitTo: number;
}

export function parseTagRange(text: string): TagRange | { error: string } {
  const m = /^\s*(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s*(?:m|mo|mos|month|months)?\s*$/i.exec(text);
  if (!m) return { error: 'Enter the tag range in months, like 6-12 or 0-9.' };
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (b <= a) return { error: 'The end of the tag range must be larger than the start.' };
  if (b > MAX_TAG_MONTHS) return { error: `Tag ranges go up to ${MAX_TAG_MONTHS} months.` };
  const from = GROUPS.find((g) => g.lo <= a && a < g.hi);
  const to = GROUPS.find((g) => g.lo < b && b <= g.hi);
  if (!from || !to) return { error: 'That range is outside the sizes in this app.' };
  return { label: `${a}-${b}M`, fitFrom: from.order, fitTo: to.order };
}

/**
 * Moves a fit range up or down by whole sizes, staying inside 0 to max. A piece that "ran small" fits like the size
 * below its tag (delta -1), and one that "ran large" fits like the size above it (delta 1).
 */
export function shiftRange(from: number, to: number, delta: number, max: number): { from: number; to: number } {
  const clamp = (n: number) => Math.max(0, Math.min(max, n));
  return { from: clamp(from + delta), to: clamp(to + delta) };
}

/** The shift a fit rating asks for: "-1" ran small, "1" ran large, anything else none. */
export const feedbackShift = (feedback: string): number => (feedback === '-1' ? -1 : feedback === '1' ? 1 : 0);
