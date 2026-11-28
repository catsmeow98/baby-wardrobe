-- 20: Items remember the shopping trip they came from (for the History detail page), and pieces marked "Not purchased"
-- while adding a trip's photos are counted on their shopping entry, so the order shows them crossed out. Safe to run twice.

alter table public.inventory_items add column if not exists trip_id uuid;
create index if not exists inventory_items_trip_idx on public.inventory_items (trip_id) where trip_id is not null;

alter table public.shopping_items add column if not exists quantity_cancelled int not null default 0;
do $$ begin
  alter table public.shopping_items add constraint shopping_items_cancelled_ok check (quantity_cancelled >= 0 and quantity_cancelled <= quantity_ordered);
exception when duplicate_object then null; end $$;

-- complete_received, now also taking p_cancel: [{"item": placeholder id, "qty": pieces}] that were not purchased after all.
-- They come off the placeholder like p_consume, with nothing added, and are counted on the placeholder's shopping entry.
-- New items may carry "trip_id". The two-argument form is replaced (a default third argument would make it ambiguous).
drop function if exists public.complete_received(jsonb, jsonb);
create or replace function public.complete_received(p_rows jsonb, p_consume jsonb, p_cancel jsonb default '[]'::jsonb)
returns uuid[] language plpgsql as $$
declare
  c record;
  e record;
  r record;
  v_left int;
  v_id uuid;
  v_shop uuid;
  ids uuid[] := '{}';
begin
  -- Everything that comes off a placeholder, with how much of it was not purchased.
  for c in
    select item, sum(qty) as qty, sum(cancel) as cancel from (
      select (x ->> 'item')::uuid as item, (x ->> 'qty')::int as qty, 0 as cancel from jsonb_array_elements(coalesce(p_consume, '[]'::jsonb)) x
      union all
      select (x ->> 'item')::uuid, (x ->> 'qty')::int, (x ->> 'qty')::int from jsonb_array_elements(coalesce(p_cancel, '[]'::jsonb)) x
    ) t group by item
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
    if c.cancel > 0 then
      select shopping_item_id into v_shop from public.shopping_receipts where inventory_item_id = c.item limit 1;
      if v_shop is not null then
        update public.shopping_items set quantity_cancelled = least(quantity_ordered, quantity_cancelled + c.cancel) where id = v_shop;
      end if;
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
      custom_tag text, fit_from_size_id uuid, fit_to_size_id uuid, condition text, season text, gender text, color text, status text,
      trip_id uuid);
    insert into public.inventory_items
      (child_id, name, category_id, brand_id, tracking_type, quantity, label_id, custom_tag, fit_from_size_id, fit_to_size_id,
       condition, season, gender, color, status, trip_id)
    values
      (r.child_id, r.name, r.category_id, r.brand_id, coalesce(r.tracking_type, 'individual'), coalesce(r.quantity, 1), r.label_id,
       r.custom_tag, r.fit_from_size_id, r.fit_to_size_id, coalesce(r.condition, 'good'), coalesce(r.season, 'year_round'),
       r.gender, r.color, coalesce(r.status, 'active'), r.trip_id)
    returning id into v_id;
    ids := ids || v_id;
  end loop;
  return ids;
end $$;
revoke all on function public.complete_received(jsonb, jsonb, jsonb) from public;
grant execute on function public.complete_received(jsonb, jsonb, jsonb) to authenticated;
