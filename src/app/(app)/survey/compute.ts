import type { Ctx } from '@/lib/context';
import { SURVEY_SIZES, dateAtSize, seasonForSize, seasonOfMonth, suggestAll, type Answers, type Forecast, type Season } from '@/lib/domain';
import { forecastFor, loadMeasurements, todayIso } from '@/lib/forecast-data';

const monthOf = (iso: string) => Number(iso.slice(5, 7)) - 1;

/**
 * Suggestions for every size from newborn to 2T. A size's season comes from the size forecast when the child has a
 * current size and measurements, otherwise from the birth month.
 */
export async function surveyAll(ctx: Ctx, answers: Answers) {
  const cur = ctx.currentSize;
  const f: Forecast | null = ctx.active && cur !== null ? forecastFor(ctx, await loadMeasurements(ctx, ctx.active.id), 24) : null;
  const today = todayIso();
  const seasonOf = (size: number): Season => {
    if (cur !== null && size === cur) return seasonOfMonth(monthOf(today));
    if (cur !== null && size > cur && f) {
      const d = dateAtSize(f, 0, size);
      if (d) return seasonOfMonth(monthOf(d));
    }
    return seasonForSize(answers.birthMonth, size);
  };
  return { results: suggestAll(answers, SURVEY_SIZES, seasonOf), usedForecast: Boolean(f) };
}

/** The birth month to start the form with: the child's, else this month. */
export const defaultBirthMonth = (birthDate: string | null | undefined): number =>
  birthDate ? Number(birthDate.slice(5, 7)) - 1 : new Date().getUTCMonth();
