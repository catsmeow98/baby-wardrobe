/** A query parameter that may appear more than once (?cat=a&cat=b) as a clean list: no blanks, no repeats. */
export function listOf(v: string | string[] | undefined | null): string[] {
  const all = v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
  return [...new Set(all.map((x) => x.trim()).filter(Boolean))];
}

/** The query string for a list (each value repeated under the key), with a leading & when not empty. */
export const listQs = (key: string, values: readonly string[]) => values.map((v) => `&${key}=${encodeURIComponent(v)}`).join('');
