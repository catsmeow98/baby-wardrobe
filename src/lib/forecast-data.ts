import type { Ctx } from '@/lib/context';
import type { BrandRow, MeasurementRow } from '@/lib/db';
import { brandStats, effectiveOffset, forecast, type Forecast, type Measurement, type Sex } from '@/lib/domain';

/** Today as YYYY-MM-DD in UTC. The server runs in UTC, so dates near midnight can read a day ahead of local time. */
export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export async function loadMeasurements(ctx: Ctx, childId: string): Promise<(Measurement & { id: string })[]> {
  const { data } = await ctx.supabase.from('measurements').select('id, child_id, measured_on, length_in').eq('child_id', childId).order('measured_on');
  return ((data ?? []) as MeasurementRow[]).map((m) => ({ id: m.id, date: m.measured_on, lengthIn: Number(m.length_in) }));
}

export interface BrandView {
  id: string;
  name: string;
  editable: boolean;
  baseOffset: number;
  stats: ReturnType<typeof brandStats>;
  offset: number; // base plus what the ratings add
}

/** Brands with their base offset and what the user's fit ratings add on top. Ratings come from all of the user's items. */
export async function loadBrands(ctx: Ctx): Promise<BrandView[]> {
  const [{ data: brands }, { data: rated }] = await Promise.all([
    ctx.supabase.from('brands').select('id, name, owner_id, size_offset').order('name'),
    ctx.supabase.from('inventory_items').select('brand_id, fit_feedback').not('brand_id', 'is', null).not('fit_feedback', 'is', null),
  ]);
  const ratings = new Map<string, number[]>();
  for (const r of (rated ?? []) as { brand_id: string; fit_feedback: number }[]) {
    ratings.set(r.brand_id, [...(ratings.get(r.brand_id) ?? []), r.fit_feedback]);
  }
  return ((brands ?? []) as BrandRow[]).map((b) => {
    const stats = brandStats(ratings.get(b.id) ?? []);
    const baseOffset = Number(b.size_offset);
    return { id: b.id, name: b.name, editable: b.owner_id === ctx.user.id, baseOffset, stats, offset: effectiveOffset(baseOffset, stats) };
  });
}

export function forecastFor(ctx: Ctx, measurements: Measurement[], horizon: number): Forecast | null {
  const c = ctx.active;
  if (!c || !c.birth_date || !c.growth_reference) return null;
  return forecast(c.growth_reference as Sex, c.birth_date, measurements, todayIso(), horizon);
}
