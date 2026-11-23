-- Row-level security. Every user-owned table is reachable only through children.owner_id = auth.uid().

-- Ownership helpers run as the function owner so policies do not recurse into themselves.
create function public.owns_child(p_child uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.children c where c.id = p_child and c.owner_id = auth.uid())
$$;

create function public.owns_item(p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.inventory_items i join public.children c on c.id = i.child_id
    where i.id = p_item and c.owner_id = auth.uid())
$$;

create function public.owns_shopping_item(p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shopping_items s join public.children c on c.id = s.child_id
    where s.id = p_item and c.owner_id = auth.uid())
$$;

revoke all on function public.owns_child(uuid), public.owns_item(uuid), public.owns_shopping_item(uuid) from public;
grant execute on function public.owns_child(uuid), public.owns_item(uuid), public.owns_shopping_item(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.size_systems enable row level security;
alter table public.sizes enable row level security;
alter table public.size_labels enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.children enable row level security;
alter table public.storage_locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_photos enable row level security;
alter table public.inventory_storage enable row level security;
alter table public.wardrobe_goals enable row level security;
alter table public.shopping_items enable row level security;
alter table public.shopping_receipts enable row level security;

-- Table privileges: signed-in users only. Policies below decide which rows.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- profiles: own row only; created by trigger.
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Shared defaults (owner_id null) are readable by everyone signed in and writable by no one.
create policy size_systems_select on public.size_systems for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
create policy size_systems_write on public.size_systems for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy sizes_select on public.sizes for select to authenticated
  using (exists (select 1 from public.size_systems s where s.id = size_system_id));
create policy sizes_write on public.sizes for all to authenticated
  using (exists (select 1 from public.size_systems s where s.id = size_system_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.size_systems s where s.id = size_system_id and s.owner_id = auth.uid()));

create policy size_labels_select on public.size_labels for select to authenticated
  using (exists (select 1 from public.sizes z where z.id = size_id));
create policy size_labels_write on public.size_labels for all to authenticated
  using (exists (select 1 from public.sizes z join public.size_systems s on s.id = z.size_system_id
                 where z.id = size_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.sizes z join public.size_systems s on s.id = z.size_system_id
                      where z.id = size_id and s.owner_id = auth.uid()));

create policy categories_select on public.categories for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
create policy categories_write on public.categories for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy brands_select on public.brands for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
create policy brands_write on public.brands for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- children
create policy children_all on public.children for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.size_systems s where s.id = size_system_id));

create policy storage_locations_all on public.storage_locations for all to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));

-- Rows that reference categories or brands may only reference ones the user can see.
create policy inventory_items_all on public.inventory_items for all to authenticated
  using (public.owns_child(child_id))
  with check (
    public.owns_child(child_id)
    and exists (select 1 from public.categories c where c.id = category_id)
    and (brand_id is null or exists (select 1 from public.brands b where b.id = brand_id)));

create policy inventory_photos_all on public.inventory_photos for all to authenticated
  using (public.owns_item(inventory_item_id))
  with check (public.owns_item(inventory_item_id) and storage_path like auth.uid()::text || '/%');

create policy inventory_storage_all on public.inventory_storage for all to authenticated
  using (public.owns_item(inventory_item_id)) with check (public.owns_item(inventory_item_id));

create policy wardrobe_goals_all on public.wardrobe_goals for all to authenticated
  using (public.owns_child(child_id))
  with check (public.owns_child(child_id) and exists (select 1 from public.categories c where c.id = category_id));

create policy shopping_items_all on public.shopping_items for all to authenticated
  using (public.owns_child(child_id))
  with check (public.owns_child(child_id) and exists (select 1 from public.categories c where c.id = category_id));

create policy shopping_receipts_all on public.shopping_receipts for all to authenticated
  using (public.owns_shopping_item(shopping_item_id))
  with check (public.owns_shopping_item(shopping_item_id)
              and (inventory_item_id is null or public.owns_item(inventory_item_id)));

-- ---------------------------------------------------------------------------
-- Goal progress. Security invoker, so the caller's row-level security applies to every table read.
-- owned     = usable inventory whose fit range includes the goal size (active or stored, not unusable)
-- incoming  = ordered minus received on shopping items for the same category and size
-- A piece that fits several sizes counts toward each of them.
-- ---------------------------------------------------------------------------
create view public.goal_progress with (security_invoker = true) as
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
    and it.status in ('active', 'stored') and it.condition <> 'unusable'
    and f.sort_order <= gs.sort_order and gs.sort_order <= t.sort_order
) o on true
left join lateral (
  select sum(si.quantity_ordered - si.quantity_received) as incoming
  from public.shopping_items si
  where si.child_id = g.child_id and si.category_id = g.category_id and si.size_id = g.size_id
    and si.status in ('ordered', 'partially_received')
) i on true;

-- Completion per size, computed from the underlying goals so overlapping sizes are never summed together.
create view public.size_progress with (security_invoker = true) as
select child_id, size_id,
       sum(target_quantity)::int as goal_total,
       sum(least(target_quantity, owned))::int as owned_toward_goal,
       case when sum(target_quantity) > 0
            then round(100.0 * sum(least(target_quantity, owned)) / sum(target_quantity))::int end as percent_complete
from public.goal_progress
where target_quantity > 0
group by child_id, size_id;

grant select on public.goal_progress, public.size_progress to authenticated;

-- ---------------------------------------------------------------------------
-- Shopping workflow functions. Security invoker, so row-level security decides who may call them.
-- ---------------------------------------------------------------------------
create function public.order_shopping_item(p_shopping_item uuid, p_quantity int)
returns public.shopping_items language plpgsql as $$
declare v public.shopping_items;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity ordered must be at least 1' using errcode = '22023';
  end if;
  select * into v from public.shopping_items where id = p_shopping_item for update;
  if not found then raise exception 'shopping item not found' using errcode = 'P0002'; end if;
  if v.status in ('received', 'cancelled') then
    raise exception 'a % item cannot be ordered', v.status using errcode = '22023';
  end if;
  if p_quantity < v.quantity_received then
    raise exception 'quantity ordered cannot be below what was already received' using errcode = '22023';
  end if;
  update public.shopping_items
     set quantity_ordered = p_quantity,
         quantity_needed = greatest(quantity_needed, p_quantity),
         status = case when quantity_received = 0 then 'ordered'
                       when quantity_received >= p_quantity then 'received' else 'partially_received' end
   where id = p_shopping_item returning * into v;
  return v;
end $$;

-- Record a delivery: adds the pieces to the closet, keeps a receipt, and updates the shopping item atomically.
create function public.receive_shopping_item(p_shopping_item uuid, p_quantity int)
returns uuid language plpgsql as $$
declare
  v public.shopping_items;
  v_item uuid;
  v_label uuid;
  v_category text;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity received must be at least 1' using errcode = '22023';
  end if;
  select * into v from public.shopping_items where id = p_shopping_item for update;
  if not found then raise exception 'shopping item not found' using errcode = 'P0002'; end if;
  if v.status not in ('ordered', 'partially_received') then
    raise exception 'only ordered items can be received' using errcode = '22023';
  end if;
  if p_quantity > v.quantity_ordered - v.quantity_received then
    raise exception 'cannot receive more than is still outstanding' using errcode = '22023';
  end if;

  select name into v_category from public.categories where id = v.category_id;
  select id into v_label from public.size_labels where size_id = v.size_id order by sort_order desc limit 1;

  insert into public.inventory_items
    (child_id, tracking_type, name, category_id, label_id, fit_from_size_id, fit_to_size_id,
     quantity, condition, status, notes)
  values
    (v.child_id, 'grouped', v_category || ' (received)', v.category_id, v_label, v.size_id, v.size_id,
     p_quantity, 'new', 'active', 'Added from shopping list')
  returning id into v_item;

  insert into public.shopping_receipts (shopping_item_id, inventory_item_id, quantity_received)
  values (p_shopping_item, v_item, p_quantity);

  update public.shopping_items
     set quantity_received = quantity_received + p_quantity,
         status = case when quantity_received + p_quantity >= quantity_ordered then 'received'
                       else 'partially_received' end
   where id = p_shopping_item;
  return v_item;
end $$;

revoke all on function public.order_shopping_item(uuid, int), public.receive_shopping_item(uuid, int) from public;
grant execute on function public.order_shopping_item(uuid, int), public.receive_shopping_item(uuid, int) to authenticated;
