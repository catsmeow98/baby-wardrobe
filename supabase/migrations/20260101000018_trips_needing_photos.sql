-- 18: Shopping trips needing photos. Receiving a delivery (or "Bought & received" in the in-store cart) puts a placeholder
-- item in the closet so goal counts stay right. Now each receive belongs to a trip (one tap = one trip), the placeholder is
-- flagged as needing details, and complete_received swaps placeholders for real items in one transaction, so counts never
-- double up or drop. Safe to run more than once.

alter table public.shopping_receipts add column if not exists trip_id uuid;
create index if not exists shopping_receipts_trip_idx on public.shopping_receipts (trip_id) where trip_id is not null;

alter table public.inventory_items add column if not exists needs_details boolean not null default false;
comment on column public.inventory_items.needs_details is
  'A placeholder made by receiving a shopping item, waiting for photos and details (see complete_received).';

-- Receive, now with the trip it belongs to. The old two-argument form is replaced (a default third argument would make a
-- two-argument call ambiguous between the two).
drop function if exists public.receive_shopping_item(uuid, int);
create or replace function public.receive_shopping_item(p_shopping_item uuid, p_quantity int, p_trip uuid default null)
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
     quantity, condition, status, notes, needs_details)
  values
    (v.child_id, 'grouped', v_category || ' (received)', v.category_id, v_label, v.size_id, v.size_id,
     p_quantity, 'new', 'active', 'Added from shopping list', true)
  returning id into v_item;

  insert into public.shopping_receipts (shopping_item_id, inventory_item_id, quantity_received, trip_id)
  values (p_shopping_item, v_item, p_quantity, p_trip);

  update public.shopping_items
     set quantity_received = quantity_received + p_quantity,
         status = case when quantity_received + p_quantity >= quantity_ordered then 'received'
                       else 'partially_received' end
   where id = p_shopping_item;
  return v_item;
end $$;
revoke all on function public.receive_shopping_item(uuid, int, uuid) from public;
grant execute on function public.receive_shopping_item(uuid, int, uuid) to authenticated;

-- Replaces received placeholders with real items, all or nothing. p_consume: [{"item": placeholder id, "qty": pieces}],
-- taken off each placeholder (deleted when none are left). p_rows: the new items, as inventory_items columns. Returns the
-- new items' ids in the order given (photos are attached by position). Runs as the caller, so row-level security applies.
create or replace function public.complete_received(p_rows jsonb, p_consume jsonb)
returns uuid[] language plpgsql as $$
declare
  c record;
  e record;
  r record;
  v_left int;
  v_id uuid;
  ids uuid[] := '{}';
begin
  for c in
    select (x ->> 'item')::uuid as item, sum((x ->> 'qty')::int) as qty
      from jsonb_array_elements(coalesce(p_consume, '[]'::jsonb)) x group by 1
  loop
    if c.qty is null or c.qty < 1 then
      raise exception 'pieces to take must be at least 1' using errcode = '22023';
    end if;
    select quantity into v_left from public.inventory_items where id = c.item and needs_details for update;
    if not found then
      raise exception 'those received pieces are already done' using errcode = '22023';
    end if;
    if c.qty > v_left then
      raise exception 'more pieces than were received' using errcode = '22023';
    end if;
    if c.qty = v_left then
      delete from public.inventory_items where id = c.item;
    else
      update public.inventory_items set quantity = quantity - c.qty where id = c.item;
    end if;
  end loop;

  for e in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality order by ordinality loop
    select * into r from jsonb_to_record(e.value) as x(
      child_id uuid, name text, category_id uuid, brand_id uuid, tracking_type text, quantity int, label_id uuid,
      custom_tag text, fit_from_size_id uuid, fit_to_size_id uuid, condition text, season text, gender text, color text, status text);
    insert into public.inventory_items
      (child_id, name, category_id, brand_id, tracking_type, quantity, label_id, custom_tag, fit_from_size_id, fit_to_size_id,
       condition, season, gender, color, status)
    values
      (r.child_id, r.name, r.category_id, r.brand_id, coalesce(r.tracking_type, 'individual'), coalesce(r.quantity, 1), r.label_id,
       r.custom_tag, r.fit_from_size_id, r.fit_to_size_id, coalesce(r.condition, 'good'), coalesce(r.season, 'year_round'),
       r.gender, r.color, coalesce(r.status, 'active'))
    returning id into v_id;
    ids := ids || v_id;
  end loop;
  return ids;
end $$;
revoke all on function public.complete_received(jsonb, jsonb) from public;
grant execute on function public.complete_received(jsonb, jsonb) to authenticated;
