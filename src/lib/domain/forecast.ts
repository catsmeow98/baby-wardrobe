/**
 * Size forecast. Places length measurements on a growth curve, projects the child's length forward, and finds when
 * that length crosses into the next size on a brand's chart.
 *
 * The growth reference is the WHO length-for-age standard (see REF), and UPPER is Carter's size chart. A forecast is still
 * an estimate: children cross percentiles, and brands size differently.
 */
export type Sex = 'girls' | 'boys';
export interface Measurement {
  date: string; // YYYY-MM-DD
  lengthIn: number;
}
export interface ForecastRow {
  month: number; // months from today
  age: number; // child's age in months
  date: string; // YYYY-MM-DD, same day-of-month as today where possible
  low: number; // inches
  mid: number;
  high: number;
}
export interface Forecast {
  points: { age: number; lengthIn: number; z: number }[];
  z: number;
  percentile: number;
  rows: ForecastRow[];
}

/**
 * WHO Child Growth Standards, length-for-age: median (M, cm) and coefficient of variation (S) by month; L is 1 throughout, so
 * SD = M x S. Birth to 24 months for both sexes, checked against the WHO LMS tables. 25 to 36 months (both sexes) are WHO
 * height-for-age plus 0.7 cm (WHO's own length-to-height difference), so the curve stays in lying length, the way babies are
 * measured at home.
 */
interface Ref { ages: number[]; m: number[]; s: number[] }
const MONTHS_0_24 = Array.from({ length: 25 }, (_, i) => i);
const REF: Record<Sex, Ref> = {
  girls: {
    ages: [...MONTHS_0_24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
    m: [49.1477, 53.6872, 57.0673, 59.8029, 62.0899, 64.0301, 65.7311, 67.2873, 68.7498, 70.1435, 71.4818, 72.771, 74.015, 75.2176, 76.3817,
      77.5099, 78.6055, 79.671, 80.7079, 81.7182, 82.7036, 83.6654, 84.604, 85.5202, 86.4153,
      87.2904, 88.1462, 88.983, 89.8004, 90.5991, 91.3797, 92.143, 92.8906, 93.6239, 94.3444, 95.0533, 95.7515],
    s: [0.0379, 0.0364, 0.03568, 0.0352, 0.03486, 0.03463, 0.03448, 0.03441, 0.0344, 0.03444, 0.03452, 0.03464, 0.03479, 0.03496, 0.03514,
      0.03534, 0.03555, 0.03576, 0.03598, 0.0362, 0.03643, 0.03666, 0.03688, 0.03711, 0.03734,
      0.03786, 0.03808, 0.0383, 0.03851, 0.03872, 0.03893, 0.03913, 0.03933, 0.03952, 0.03971, 0.03989, 0.04006],
  },
  boys: {
    ages: [...MONTHS_0_24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
    m: [49.8842, 54.7244, 58.4249, 61.4292, 63.886, 65.9026, 67.6236, 69.1645, 70.5994, 71.9687, 73.2812, 74.5388, 75.7488, 76.9186, 78.0497,
      79.1458, 80.2113, 81.2487, 82.2587, 83.2418, 84.1996, 85.1348, 86.0477, 86.941, 87.8161,
      88.672, 89.5065, 90.3197, 91.112, 91.8828, 92.6327, 93.3631, 94.0753, 94.7711, 95.4532, 96.1236, 96.7835],
    s: [0.03795, 0.03557, 0.03424, 0.03328, 0.03257, 0.03204, 0.03165, 0.03139, 0.03124, 0.03117, 0.03118, 0.03125, 0.03137, 0.03154, 0.03174,
      0.03197, 0.03222, 0.0325, 0.03279, 0.0331, 0.03342, 0.03376, 0.0341, 0.03445, 0.03479,
      0.03542, 0.03576, 0.0361, 0.03642, 0.03674, 0.03704, 0.03733, 0.03761, 0.03787, 0.03812, 0.03836, 0.03858],
  },
};
/**
 * Largest length (inches) that fits each size group (order 0 to 9): Carter's current chart (carters.com, checked Nov 2026):
 * NB to 21.5, 3M 21.5-24, 6M 24-27, 9M 27-28.5, 12M 28.5-30, 18M 30-32, 24M 32-34, 2T 35-36.5, 3T 36.5-39, 4T 39-41.5.
 */
export const UPPER = [21.5, 24, 27, 28.5, 30, 32, 34, 36.5, 39, 41.5];
export const MAX_AGE_MONTHS = 36;

const CM_PER_IN = 2.54;
const DAY_MS = 864e5;

function interp(ages: number[], values: number[], age: number): number {
  const a = Math.max(0, Math.min(MAX_AGE_MONTHS, age));
  for (let i = 1; i < ages.length; i++) {
    if (a <= ages[i]) {
      const t = (a - ages[i - 1]) / (ages[i] - ages[i - 1]);
      return values[i - 1] + t * (values[i] - values[i - 1]);
    }
  }
  return values[values.length - 1];
}
const medianCm = (sex: Sex, age: number) => interp(REF[sex].ages, REF[sex].m, age);
const sdCm = (sex: Sex, age: number) => medianCm(sex, age) * interp(REF[sex].ages, REF[sex].s, age);

const utc = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const ageMonths = (dob: string, date: string): number => (utc(date) - utc(dob)) / DAY_MS / 30.4375;

export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const total = m - 1 + n;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return iso(Date.UTC(ty, tm, Math.min(d, last)));
}

const zOf = (sex: Sex, age: number, cm: number): number => (cm - medianCm(sex, age)) / sdCm(sex, age);
const cmAt = (sex: Sex, age: number, z: number): number => medianCm(sex, age) + z * sdCm(sex, age);
/** Length in inches at an age (months) and z-score on the growth reference: z 0 is the 50th percentile, ±1.881 the 3rd and 97th. */
export const lengthAt = (sex: Sex, age: number, z: number): number => cmAt(sex, age, z) / CM_PER_IN;

function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-ax * ax));
}
export const percentileOf = (z: number): number => Math.round(50 * (1 + erf(z / Math.SQRT2)));

/** Size group order for a length, given a brand's offset in inches. Beyond the chart it stays in the largest size. */
export function sizeFor(lengthIn: number, offset = 0): number {
  for (let g = 0; g < UPPER.length; g++) if (lengthIn <= UPPER[g] + offset) return g;
  return UPPER.length - 1;
}

/**
 * Projects length month by month. Uses the average z-score of the two latest measurements, widens the range the
 * further past the last measurement it looks, and stops at 36 months, where the reference ends.
 */
export function forecast(sex: Sex, dob: string, measurements: readonly Measurement[], today: string, horizon: number): Forecast | null {
  const points = [...measurements]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .filter((m) => m.lengthIn > 0)
    .map((m) => {
      const age = ageMonths(dob, m.date);
      return { age, lengthIn: m.lengthIn, z: zOf(sex, age, m.lengthIn * CM_PER_IN) };
    })
    .filter((p) => p.age >= 0 && p.age <= MAX_AGE_MONTHS);
  if (points.length === 0) return null;

  const recent = points.slice(-2);
  const z = recent.reduce((s, p) => s + p.z, 0) / recent.length;
  const lastAge = points[points.length - 1].age;
  const nowAge = Math.max(0, ageMonths(dob, today));
  const rows: ForecastRow[] = [];
  for (let h = 0; h <= horizon; h++) {
    const age = nowAge + h;
    if (age > MAX_AGE_MONTHS) break;
    const w = 0.4 + 0.05 * Math.max(0, age - lastAge);
    const at = (zz: number) => cmAt(sex, age, zz) / CM_PER_IN;
    rows.push({ month: h, age, date: addMonths(today, h), low: at(z - w), mid: at(z), high: at(z + w) });
  }
  return { points, z, percentile: percentileOf(z), rows };
}

export interface Transition {
  now: number;
  next: { size: number; date: string } | null;
  end: string;
}

/** The size the child is projected to wear now, and the first month the projection reaches a larger one. */
export function transition(f: Forecast, offset = 0): Transition {
  const first = sizeFor(f.rows[0].mid, offset);
  const hit = f.rows.find((r) => sizeFor(r.mid, offset) > first);
  return { now: first, next: hit ? { size: sizeFor(hit.mid, offset), date: hit.date } : null, end: f.rows[f.rows.length - 1].date };
}

/** First date the projection reaches a size, or null when the forecast does not get there. */
export function dateAtSize(f: Forecast, offset: number, size: number): string | null {
  const hit = f.rows.find((r) => sizeFor(r.mid, offset) >= size);
  return hit ? hit.date : null;
}

/* ---- brand fit feedback ---- */

/** Each rating moves a brand by up to this many inches. My own starting guess, not measured data. */
export const FEEDBACK_STEP = 0.75;
const MAX_ADJUST = 2;

export interface BrandStats {
  n: number;
  small: number;
  true: number;
  large: number;
  /** Inches to add to the brand's offset. Shrunk toward zero while there are few ratings. */
  adjust: number;
}

/** ratings: -1 ran small, 0 true to size, 1 ran large. */
export function brandStats(ratings: readonly number[]): BrandStats {
  const n = ratings.length;
  const sum = ratings.reduce((s, r) => s + r, 0);
  const adjust = n ? Math.max(-MAX_ADJUST, Math.min(MAX_ADJUST, (sum / n) * FEEDBACK_STEP * (n / (n + 2)))) : 0;
  return {
    n,
    small: ratings.filter((r) => r < 0).length,
    true: ratings.filter((r) => r === 0).length,
    large: ratings.filter((r) => r > 0).length,
    adjust,
  };
}

export const effectiveOffset = (baseOffset: number, stats: BrandStats): number => baseOffset + stats.adjust;
export const fitWord = (adjust: number): string => (adjust <= -0.15 ? 'Runs small' : adjust >= 0.15 ? 'Runs large' : 'True to size');
