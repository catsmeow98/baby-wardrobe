import type { MonthClass } from './survey';

/**
 * Labels a month from the average of its daily high temperatures, in degrees Fahrenheit:
 * under 40 cold, 40 to 60 cool, 60 to 75 mild, above 75 warm. These cutoffs are my starting guesses.
 */
export function classifyMonth(avgHighF: number): MonthClass {
  if (avgHighF < 40) return 'cold';
  if (avgHighF < 60) return 'cool';
  if (avgHighF <= 75) return 'mild';
  return 'warm';
}

export interface DailyHigh {
  /** YYYY-MM-DD */
  date: string;
  highF: number | null;
}

/**
 * Turns several years of daily highs into twelve labels, January first. Each month is the average over all of its days in
 * all of the years. Returns null unless every calendar month has at least 20 days of data.
 */
export function monthlyClasses(days: readonly DailyHigh[]): MonthClass[] | null {
  const sum = Array<number>(12).fill(0);
  const n = Array<number>(12).fill(0);
  for (const d of days) {
    const m = Number(d.date.slice(5, 7)) - 1;
    if (d.highF === null || !Number.isFinite(d.highF) || !(m >= 0 && m < 12)) continue;
    sum[m] += d.highF;
    n[m]++;
  }
  if (n.some((c) => c < 20)) return null;
  return sum.map((s, m) => classifyMonth(s / n[m]));
}

/** The label that most months of a window share. A tie goes to the colder one. */
export function dominantClass(classes: readonly MonthClass[]): MonthClass {
  const order: MonthClass[] = ['cold', 'cool', 'mild', 'warm'];
  let best: MonthClass = 'mild';
  let top = -1;
  for (const c of order) {
    const k = classes.filter((x) => x === c).length;
    if (k > top) {
      top = k;
      best = c;
    }
  }
  return best;
}
