/**
 * Size forecast. Places length measurements on a growth curve, projects the child's length forward, and finds when
 * that length crosses into the next size on a brand's chart.
 *
 * IMPORTANT: the reference table below is an approximation of published length-for-age medians, and UPPER is a
 * generic size chart. Both must be checked against the official WHO tables and real brand charts before this is
 * presented as anything more than an estimate.
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

const REF_AGES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 24, 30, 36];
const REF: Record<Sex, number[]> = {
  girls: [49.1, 53.7, 57.1, 59.8, 62.1, 64.0, 65.7, 67.3, 68.7, 70.1, 71.5, 72.8, 74.0, 77.5, 80.7, 83.7, 86.4, 91.2, 95.1],
  boys: [49.9, 54.7, 58.4, 61.4, 63.9, 65.9, 67.6, 69.2, 70.6, 72.0, 73.3, 74.5, 75.7, 79.1, 82.3, 85.1, 87.1, 91.9, 96.1],
};
const REF_SD = [1.9, 1.9, 2.0, 2.1, 2.2, 2.3, 2.3, 2.4, 2.5, 2.6, 2.6, 2.7, 2.7, 2.9, 3.0, 3.2, 3.3, 3.5, 3.7];
/** Largest length (inches) that fits each size group (order 0 to 9) on the standard chart. */
export const UPPER = [21.5, 24, 26.5, 28.5, 30, 32, 34, 36.5, 39, 42];
export const MAX_AGE_MONTHS = 36;

const CM_PER_IN = 2.54;
const DAY_MS = 864e5;

function interp(values: number[], age: number): number {
  const a = Math.max(0, Math.min(MAX_AGE_MONTHS, age));
  for (let i = 1; i < REF_AGES.length; i++) {
    if (a <= REF_AGES[i]) {
      const t = (a - REF_AGES[i - 1]) / (REF_AGES[i] - REF_AGES[i - 1]);
      return values[i - 1] + t * (values[i] - values[i - 1]);
    }
  }
  return values[values.length - 1];
}

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

const zOf = (sex: Sex, age: number, cm: number): number => (cm - interp(REF[sex], age)) / interp(REF_SD, age);
const cmAt = (sex: Sex, age: number, z: number): number => interp(REF[sex], age) + z * interp(REF_SD, age);

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
