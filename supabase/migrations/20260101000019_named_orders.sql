-- 19: Named orders. Several shopping list entries can be ordered together as one order with a name (or the date and time).
-- An order can arrive all at once or in parts; each arrival is a trip for photos, named after the order ("Name - part 2"
-- when it comes in parts). Safe to run more than once.

create table if not exists public.shopping_orders (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  ordered_at timestamptz not null default now(),
  -- How many deliveries have come in, for naming the next one "part N".
  parts_received int not null default 0 check (parts_received >= 0),
  created_at timestamptz not null default now()
);
create index if not exists shopping_orders_child_idx on public.shopping_orders (child_id);
alter table public.shopping_orders enable row level security;
drop policy if exists shopping_orders_all on public.shopping_orders;
create policy shopping_orders_all on public.shopping_orders for all to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));
grant select, insert, update, delete on public.shopping_orders to authenticated;

alter table public.shopping_items add column if not exists order_id uuid references public.shopping_orders (id) on delete set null;
create index if not exists shopping_items_order_idx on public.shopping_items (order_id) where order_id is not null;

-- A trip's name: the order's name (with "part N"), or the name given to an in-store "Bought & received".
alter table public.shopping_receipts add column if not exists trip_name text check (trip_name is null or char_length(trip_name) <= 100);

-- Entries already ordered and not fully received become an order each, named by the day they were ordered.
do $$
declare r record; o uuid;
begin
  for r in select * from public.shopping_items where status in ('ordered', 'partially_received') and order_id is null loop
    insert into public.shopping_orders (child_id, name, ordered_at, parts_received)
    values (r.child_id, 'Order of ' || to_char(r.updated_at, 'Mon FMDD, YYYY'), r.updated_at, case when r.quantity_received > 0 then 1 else 0 end)
    returning id into o;
    update public.shopping_items set order_id = o where id = r.id;
  end loop;
end $$;

-- Places an order: p_lines [{"item": shopping item id, "qty": n}] for list entries, or [{"category_id", "size_id", "qty",
-- "notes"}] for new ones (from a goal gap or the in-store cart). All or nothing. Returns the order's id.
create or replace function public.place_order(p_child uuid, p_name text, p_lines jsonb)
returns uuid language plpgsql as $$
declare
  v_order uuid;
  l record;
  v_item uuid;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if v_name is null then raise exception 'give the order a name' using errcode = '22023'; end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then raise exception 'choose something to order' using errcode = '22023'; end if;
  insert into public.shopping_orders (child_id, name) values (p_child, left(v_name, 80)) returning id into v_order;
  for l in
    select (x ->> 'item')::uuid as item, (x ->> 'category_id')::uuid as category_id, (x ->> 'size_id')::uuid as size_id,
           (x ->> 'qty')::int as qty, nullif(x ->> 'notes', '') as notes
      from jsonb_array_elements(p_lines) x
  loop
    if l.qty is null or l.qty < 1 then raise exception 'quantity must be at least 1' using errcode = '22023'; end if;
    if l.item is not null then
      v_item := l.item;
      if not exists (select 1 from public.shopping_items where id = v_item and child_id = p_child) then
        raise exception 'that list entry is not this child''s' using errcode = '22023';
      end if;
    else
      insert into public.shopping_items (child_id, category_id, size_id, quantity_needed, notes)
      values (p_child, l.category_id, l.size_id, l.qty, l.notes) returning id into v_item;
    end if;
    perform public.order_shopping_item(v_item, l.qty);
    update public.shopping_items set order_id = v_order where id = v_item;
  end loop;
  return v_order;
end $$;
revoke all on function public.place_order(uuid, text, jsonb) from public;
grant execute on function public.place_order(uuid, text, jsonb) to authenticated;

-- Receives some or all of an order: p_lines [{"item": shopping item id, "qty": n}], all in one trip (p_trip). The trip is
-- named after the order; when the order comes in parts, "part N" (the first part is part 1). All or nothing. Returns the name.
create or replace function public.receive_order(p_order uuid, p_lines jsonb, p_trip uuid)
returns text language plpgsql as $$
declare
  o public.shopping_orders;
  l record;
  v_total int;
  v_outstanding int;
  v_name text;
begin
  select * into o from public.shopping_orders where id = p_order for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then raise exception 'choose something that arrived' using errcode = '22023'; end if;

  select coalesce(sum((x ->> 'qty')::int), 0) into v_total from jsonb_array_elements(p_lines) x;
  if v_total < 1 then raise exception 'choose something that arrived' using errcode = '22023'; end if;
  select coalesce(sum(quantity_ordered - quantity_received), 0) into v_outstanding
    from public.shopping_items where order_id = p_order and status in ('ordered', 'partially_received');

  -- The whole order in one go keeps its name; anything else is a part.
  v_name := case when o.parts_received = 0 and v_total >= v_outstanding then o.name
                 else o.name || ' – part ' || (o.parts_received + 1) end;

  for l in select (x ->> 'item')::uuid as item, (x ->> 'qty')::int as qty from jsonb_array_elements(p_lines) x loop
    if l.qty is null or l.qty < 1 then continue; end if;
    if not exists (select 1 from public.shopping_items where id = l.item and order_id = p_order) then
      raise exception 'that item is not in this order' using errcode = '22023';
    end if;
    perform public.receive_shopping_item(l.item, l.qty, p_trip);
  end loop;

  update public.shopping_orders set parts_received = parts_received + 1 where id = p_order;
  update public.shopping_receipts set trip_name = v_name where trip_id = p_trip;
  return v_name;
end $$;
revoke all on function public.receive_order(uuid, jsonb, uuid) from public;
grant execute on function public.receive_order(uuid, jsonb, uuid) to authenticated;
