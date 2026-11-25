import data from '@/data/places.json';

/**
 * Place search over a list of cities bundled with the app (src/data/places.json, built from GeoNames by
 * scripts/build-places.mjs). No outside service is called. GeoNames data is CC BY 4.0: the Account page shows the credit.
 */
export interface Place {
  label: string;
  latitude: number;
  longitude: number;
}

/** [name, asciiName, region, regionCode, country, latitude, longitude, population] */
export type PlaceRow = readonly [string, string, string, string, string, number, number, number];

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Cities whose name starts with the text before the first comma, biggest first. Text after the comma narrows by state,
 * province or country, so "Boston, MA", "Boston, Massachusetts" and "Boston, United States" all work. At most 5.
 */
export function searchIn(rows: readonly PlaceRow[], query: string, limit = 5): Place[] {
  const parts = query.trim().slice(0, 80).split(',');
  const city = norm(parts[0] ?? '');
  const where = norm(parts.slice(1).join(' '));
  if (city.length < 2) return [];
  const hits: { row: PlaceRow; exact: boolean }[] = [];
  for (const row of rows) {
    const [name, ascii, region, code, country] = row;
    const n = norm(ascii || name);
    const exact = n === city || norm(name) === city;
    if (!exact && !n.startsWith(city) && !norm(name).startsWith(city)) continue;
    if (where) {
      const w = where;
      const ok = norm(code) === w || norm(region).startsWith(w) || norm(country).startsWith(w);
      if (!ok) continue;
    }
    hits.push({ row, exact });
  }
  hits.sort((a, b) => Number(b.exact) - Number(a.exact) || b.row[7] - a.row[7]);
  return hits.slice(0, limit).map(({ row }) => ({
    label: [row[0], row[2], row[4]].filter(Boolean).join(', '),
    latitude: row[5],
    longitude: row[6],
  }));
}

export const searchPlaces = async (query: string): Promise<Place[]> => searchIn(data as unknown as PlaceRow[], query);
