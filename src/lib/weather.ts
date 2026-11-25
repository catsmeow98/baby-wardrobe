import { monthlyClasses, type DailyHigh } from '@/lib/domain/climate';
import type { MonthClass } from '@/lib/domain';

/**
 * Past weather from NASA POWER (https://power.larc.nasa.gov), whose data is listed as CC BY 4.0 with no sign-in or key:
 * the Account page shows the credit. Server only. Place search is separate, in places.ts.
 */
export { searchPlaces, type Place } from '@/lib/places';

const MISSING = -990; // POWER marks a missing value as -999

/** Reads POWER's daily T2M_MAX (degrees Celsius, keyed YYYYMMDD) into daily highs in Fahrenheit. */
export function powerToDaily(json: unknown): DailyHigh[] {
  const series = (json as { properties?: { parameter?: { T2M_MAX?: Record<string, number> } } })?.properties?.parameter?.T2M_MAX ?? {};
  return Object.entries(series).map(([k, c]) => ({
    date: `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`,
    highF: typeof c === 'number' && c > MISSING ? (c * 9) / 5 + 32 : null,
  }));
}

const getYear = async (year: number, latitude: number, longitude: number): Promise<DailyHigh[]> => {
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point?start=${year}0101&end=${year}1231` +
    `&latitude=${latitude}&longitude=${longitude}&community=re&parameters=T2M_MAX&format=json`;
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  return powerToDaily(await res.json());
};

/** How each calendar month feels at a place, from the last five full years of daily highs. Null when the data is not enough. */
export async function fetchMonthClasses(latitude: number, longitude: number): Promise<MonthClass[] | null> {
  const last = new Date().getUTCFullYear() - 1;
  const years = await Promise.all([0, 1, 2, 3, 4].map((i) => getYear(last - i, latitude, longitude)));
  return monthlyClasses(years.flat());
}
