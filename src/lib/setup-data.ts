import type { Ctx } from '@/lib/context';
import type { SetupFacts } from '@/lib/setup';

/** What the setup guide needs to know about the account. Row-level security limits each count to the signed-in person. */
export async function loadSetupFacts(ctx: Ctx): Promise<SetupFacts> {
  const count = (table: 'measurements' | 'wardrobe_goals' | 'inventory_items') => ctx.supabase.from(table).select('id', { count: 'exact', head: true });
  const [m, g, i] = await Promise.all([count('measurements'), count('wardrobe_goals'), count('inventory_items')]);
  return {
    placeName: ctx.settings.placeName,
    children: ctx.children.length,
    measurements: m.count ?? 0,
    goals: g.count ?? 0,
    items: i.count ?? 0,
    dismissed: ctx.settings.setupDismissedAt !== null,
  };
}
