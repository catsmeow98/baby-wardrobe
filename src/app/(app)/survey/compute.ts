import type { Ctx } from '@/lib/context';
import { groupCategories } from '@/lib/categories';
import { CATEGORY_NAMES, GEAR_KEYS, forecastWindows, seasonForSize, suggestAll, type Answers, type CatKey, type Forecast, type PickOption, type Season, type SizeWindow } from '@/lib/domain';
import { forecastFor, loadMeasurements, todayIso } from '@/lib/forecast-data';

const KEY_OF_NAME = new Map<string, CatKey>(Object.entries(CATEGORY_NAMES).map(([k, v]) => [v, k as CatKey]));

/**
 * The item types the survey pickers offer: all of the person's visible item types, grouped by item category. A built-in
 * type is identified by its built-in key (so the rules for it still apply, whatever it is now called), any other type by
 * its id. Outerwear and seasonal clothing offers the built-in weather pieces plus the person's own types in the same item categories.
 */
export function surveyOptions(ctx: Ctx): { options: PickOption[]; gearOptions: PickOption[]; labels: Record<string, string> } {
  const options: PickOption[] = [];
  const gearGroups = new Set<string>();
  const gearKeys = new Set<string>();
  const groupOf = new Map<string, string>();
  for (const g of groupCategories(ctx.categories)) {
    for (const c of g.items) {
      const builtIn = c.is_default ? KEY_OF_NAME.get(c.base_name) : undefined;
      const key = builtIn ?? c.id;
      options.push({ key, name: c.name, group: g.label });
      groupOf.set(key, c.group_id);
      if (builtIn && (GEAR_KEYS as readonly string[]).includes(builtIn)) {
        gearKeys.add(key);
        gearGroups.add(c.group_id);
      }
    }
  }
  const gearOptions = options.filter((o) => gearKeys.has(o.key) || (!(o.key in CATEGORY_NAMES) && gearGroups.has(groupOf.get(o.key) ?? '')));
  return { options, gearOptions, labels: Object.fromEntries(options.map((o) => [o.key, o.name])) };
}

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
  const { options, gearOptions, labels } = surveyOptions(ctx);
  return {
    options,
    gearOptions,
    // The person's own weather (when they set a location) decides how each month is labelled for outerwear and seasonal clothing.
    results: suggestAll({ ...answers, months: ctx.settings.monthClasses }, answers.sizes, seasonOf, (s) => windows[s], labels),
    usedForecast: Boolean(f),
    windows,
    missing,
  };
}

/** The birth month to start the form with: the child's, else this month. */
export const defaultBirthMonth = (birthDate: string | null | undefined): number =>
  birthDate ? Number(birthDate.slice(5, 7)) - 1 : new Date().getUTCMonth();
