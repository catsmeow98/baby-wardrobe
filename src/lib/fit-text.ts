/**
 * Short size wording for closet cards. Sizes are named like "6-9M", "Newborn" or "2T".
 * compactRange("6-9M", "9-12M") is "6-12M": the start of the first size and the end of the last, not "6-9M to 9-12M".
 */
export function compactRange(from: string, to: string): string {
  if (from === to) return from;
  const a = /^(\d+)-\d+M$/.exec(from);
  const b = /^\d+-(\d+)M$/.exec(to);
  const end = b ? `${b[1]}M` : to;
  if (!a) return `${from}-${end}`;
  return b ? `${a[1]}-${end}` : `${a[1]}M-${end}`;
}

/**
 * "Tag 6-9M, true to size" when the fit matches what the tag covers, otherwise "Tag 6-9M, fits 6-12M".
 * tagFrom/tagTo are the size orders the tag covers (one size for a listed tag); fitFrom/fitTo the item's fit range.
 */
export function tagFitText(
  tag: string | undefined,
  tagRange: { from: number | null; to: number | null },
  fit: { from: number | null; to: number | null },
  nameOf: (order: number) => string | undefined,
): string {
  const tagPart = tag ? `Tag ${tag}` : 'Tag not set';
  if (fit.from === null || fit.to === null) return `${tagPart}, fit unknown`;
  if (tag && tagRange.from === fit.from && tagRange.to === fit.to) return `${tagPart}, true to size`;
  const a = nameOf(fit.from);
  const b = nameOf(fit.to);
  if (!a || !b) return `${tagPart}, fit unknown`;
  return `${tagPart}, fits ${compactRange(a, b)}`;
}
