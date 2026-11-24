import type { Ctx } from '@/lib/context';
import { addMonths, dateAtSize, seasonOfMonth, suggest, type Answers, type Season } from '@/lib/domain';
import { forecastFor, loadMeasurements, todayIso } from '@/lib/forecast-data';

/** Which size group the survey is for: a size the person picked, else the child's current size, else the first. */
export function targetSize(ctx: Ctx, raw: string | null | undefined): number {
  const n = Number(raw);
  if (raw !== null && raw !== undefined && raw !== '' && ctx.sizeByOrder.has(n)) return n;
  return ctx.currentSize ?? 0;
}

/**
 * Suggestions for one size. When the season is "auto" it works out when the child will wear that size: today for the
 * current size or smaller, otherwise the month the standard-chart forecast reaches it, otherwise three months per size.
 */
export async function surveyFor(ctx: Ctx, answers: Answers, size: number) {
  const today = todayIso();
  let wearsFrom = today;
  let fromForecast = false;
  if (ctx.currentSize !== null && size > ctx.currentSize) {
    const f = ctx.active ? forecastFor(ctx, await loadMeasurements(ctx, ctx.active.id), 24) : null;
    const hit = f ? dateAtSize(f, 0, size) : null;
    if (hit) {
      wearsFrom = hit;
      fromForecast = true;
    } else wearsFrom = addMonths(today, 3 * (size - ctx.currentSize));
  }
  const season: Season = answers.season === 'auto' ? seasonOfMonth(Number(wearsFrom.slice(5, 7)) - 1) : answers.season;
  const { temp, rows } = suggest(answers, size, season);
  return { size, season, temp, wearsFrom, fromForecast, rows };
}
