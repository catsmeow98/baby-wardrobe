-- Item form updates: a custom tag range (such as "6-12M") and the "Spare at daycare" status.
-- Safe to run more than once.

-- 1. A tag size typed by hand when it is not on the tag list. The fit range is still stored in the fit columns.
alter table public.inventory_items add column if not exists custom_tag text;
alter table public.inventory_items drop constraint if exists inventory_items_custom_tag_length;
alter table public.inventory_items add constraint inventory_items_custom_tag_length
  check (custom_tag is null or length(btrim(custom_tag)) between 1 and 20);

-- 2. The new status. Replaces whichever check constraint currently limits status.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.inventory_items'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%donated%'
  loop
    execute format('alter table public.inventory_items drop constraint %I', c);
  end loop;
end $$;
alter table public.inventory_items add constraint inventory_items_status_check
  check (status in ('active', 'stored', 'daycare', 'outgrown', 'donated', 'sold'));

-- 3. Spares at daycare still count as owned toward goals, so the goal view includes them.
create or replace view public.goal_progress with (security_invoker = true) as
select
  g.id as goal_id, g.child_id, g.category_id, g.size_id, g.target_quantity,
  coalesce(o.owned, 0)::int as owned,
  coalesce(i.incoming, 0)::int as incoming,
  greatest(0, g.target_quantity - coalesce(o.owned, 0) - coalesce(i.incoming, 0))::int as remaining
from public.wardrobe_goals g
join public.sizes gs on gs.id = g.size_id
left join lateral (
  select sum(it.quantity) as owned
  from public.inventory_items it
  join public.sizes f on f.id = it.fit_from_size_id
  join public.sizes t on t.id = it.fit_to_size_id
  where it.child_id = g.child_id and it.category_id = g.category_id
    and it.status in ('active', 'stored', 'daycare') and it.condition <> 'unusable'
    and f.sort_order <= gs.sort_order and gs.sort_order <= t.sort_order
) o on true
left join lateral (
  select sum(si.quantity_ordered - si.quantity_received) as incoming
  from public.shopping_items si
  where si.child_id = g.child_id and si.category_id = g.category_id and si.size_id = g.size_id
    and si.status in ('ordered', 'partially_received')
) i on true;
