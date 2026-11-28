import type { Ctx } from '@/lib/context';
import { forecastWindows, sizeWindow } from '@/lib/domain';
import { forecastFor, loadMeasurements, todayIso } from '@/lib/forecast-data';

/**
 * The months the active child is expected to wear each size (by size order), such as "Oct-Feb", for showing next to sizes.
 * From the size forecast when there is one; otherwise from the birth month and typical ages. Sizes already behind the
 * current one, and every size when there is no birth date, are left out.
 */
export async function loadSizeMonths(ctx: Ctx): Promise<Record<number, string>> {
  const child = ctx.active;
  if (!child) return {};
  const f = forecastFor(ctx, await loadMeasurements(ctx, child.id), 36);
  const orders = ctx.sizes.map((s) => s.sort_order);
  const windows = forecastWindows(f, todayIso(), ctx.currentSize, orders);
  const birthMonth = child.birth_date ? Number(child.birth_date.slice(5, 7)) - 1 : null;
  const out: Record<number, string> = {};
  for (const o of orders) {
    if (ctx.currentSize !== null && o < ctx.currentSize) continue;
    const short = windows[o]?.short ?? (birthMonth !== null ? sizeWindow(birthMonth, o).short : undefined);
    if (short) out[o] = short;
  }
  return out;
}
