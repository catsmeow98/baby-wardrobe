import { dateAtSize, type Forecast } from './forecast';
import { MONTH_NAMES, seasonOfMonth, sizeWindow, SURVEY_SIZES, type Season, type SizeWindow } from './survey';

const SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const monthIndex = (iso: string) => Number(iso.slice(5, 7)) - 1;
const yearOf = (iso: string) => Number(iso.slice(0, 4));
const total = (iso: string) => yearOf(iso) * 12 + monthIndex(iso);
const dayBefore = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
const stamp = (iso: string, long: boolean) => `${(long ? MONTH_NAMES : SHORT)[monthIndex(iso)]} ${yearOf(iso)}`;

/**
 * A size window built from real dates: the day baby is expected to start the size and the day baby is expected to
 * start the next one. The last day of the window is the day before. A span of 12 months or more is "All year".
 */
export function windowFromDates(startIso: string, endIso: string, isNow = false): SizeWindow & { season: Season } {
  const last = endIso > startIso ? dayBefore(endIso) : startIso;
  const first = monthIndex(startIso);
  const lastM = monthIndex(last);
  const span = total(last) - total(startIso) + 1;
  const mid = (((Math.floor((total(startIso) + total(last)) / 2)) % 12) + 12) % 12;
  const from = isNow ? 'Now' : stamp(startIso, false);
  const age = `Expected ${from} to ${stamp(endIso, false)}`;
  const monthIdx = Array.from({ length: Math.min(span, 12) }, (_, k) => (first + k) % 12);
  const base = { startAge: 0, endAge: 0, age, monthIdx, source: 'forecast' as const, season: seasonOfMonth(mid) };
  if (span >= 12) return { ...base, months: 'All year', short: 'All year' };
  if (span <= 1) return { ...base, months: MONTH_NAMES[first], short: SHORT[first] };
  return { ...base, months: `${MONTH_NAMES[first]} to ${MONTH_NAMES[lastM]}`, short: `${SHORT[first]}-${SHORT[lastM]}` };
}

/**
 * Windows from the size forecast, for each size the forecast can place. A size is left out (so the age-based guide is
 * used for it) when it is already behind the current size or the forecast does not reach it.
 */
export function forecastWindows(
  f: Forecast | null,
  today: string,
  currentSize: number | null,
  sizes: readonly number[] = SURVEY_SIZES,
): Record<number, SizeWindow & { season: Season }> {
  const out: Record<number, SizeWindow & { season: Season }> = {};
  if (!f) return out;
  const cur = currentSize ?? Math.min(...sizes);
  for (const size of sizes) {
    if (size < cur) continue;
    const isNow = size === cur;
    const start = isNow ? today : dateAtSize(f, 0, size);
    if (!start) continue;
    const end = dateAtSize(f, 0, size + 1);
    // Past the end of the forecast the size's end is unknown: assume the typical length of the size.
    const typical = sizeWindow(0, size);
    const months = Math.max(1, typical.endAge - typical.startAge);
    const fallbackEnd = new Date(Date.UTC(yearOf(start), monthIndex(start) + months, 1)).toISOString().slice(0, 10);
    out[size] = windowFromDates(start, end ?? fallbackEnd, isNow);
  }
  return out;
}
