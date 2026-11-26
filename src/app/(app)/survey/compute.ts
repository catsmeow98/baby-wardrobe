import type { Ctx } from '@/lib/context';
import { forecastWindows, seasonForSize, suggestAll, type Answers, type Forecast, type Season, type SizeWindow } from '@/lib/domain';
import { forecastFor, loadMeasurements, todayIso } from '@/lib/forecast-data';

/**
 * Suggestions for the sizes picked in the answers. When the child has a birth date, a growth reference and a length
 * measurement, each size's months and season come from the size forecast. Sizes the forecast cannot place, and
 * everything when there is no forecast, fall back to the age-based guide from the birth month.
 * missing lists what is needed for a forecast (only when a child exists).
 */
export async function surveyAll(ctx: Ctx, answers: Answers) {
  const child = ctx.active;
  const measurements = child ? await loadMeasurements(ctx, child.id) : [];
  const f: Forecast | null = child ? forecastFor(ctx, measurements, 36) : null;
  const windows: Record<number, SizeWindow & { season: Season }> = forecastWindows(f, todayIso(), ctx.currentSize);
  const seasonOf = (size: number): Season => windows[size]?.season ?? seasonForSize(answers.birthMonth, size);
  const missing: string[] = [];
  if (child && !f) {
    if (!child.birth_date) missing.push('a birth date');
    if (!child.growth_reference) missing.push('a growth chart choice');
    if (!measurements.some((m) => m.lengthIn > 0)) missing.push('a length measurement');
    if (missing.length === 0) missing.push('a recent length measurement');
  }
  return {
    results: suggestAll(answers, answers.sizes, seasonOf, (s) => windows[s]),
    usedForecast: Boolean(f),
    windows,
    missing,
  };
}

/** The birth month to start the form with: the child's, else this month. */
export const defaultBirthMonth = (birthDate: string | null | undefined): number =>
  birthDate ? Number(birthDate.slice(5, 7)) - 1 : new Date().getUTCMonth();
