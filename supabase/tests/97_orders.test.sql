-- Migration 19: named orders, received whole or in parts, each delivery a named trip.
\set ON_ERROR_STOP on

do $$
declare c uuid; s1 uuid; o uuid; o2 uuid; trip uuid := gen_random_uuid(); trip2 uuid := gen_random_uuid(); trip3 uuid := gen_random_uuid(); nm text; b uuid; p uuid;
begin
  reset role;
  insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-00000000004a', 'o@example.com'), ('ffffffff-0000-4000-8000-00000000004b', 'q@example.com');
  insert into t.fx values ('O', 'ffffffff-0000-4000-8000-00000000004a'), ('Q', 'ffffffff-0000-4000-8000-00000000004b') on conflict (k) do update set v = excluded.v;
  perform t.as_user('O');
  insert into public.children (name, current_size_id) values ('Order kid', t.size('0-3M')) returning id into c;
  insert into public.shopping_items (child_id, category_id, size_id, quantity_needed) values (c, t.cat('Pants'), t.size('3-6M'), 2) returning id into s1;

  -- An order from a list entry and a new line (as from a gap).
  o := public.place_order(c, 'Old Navy sale', jsonb_build_array(
    jsonb_build_object('item', s1, 'qty', 2),
    jsonb_build_object('category_id', t.cat('Short-sleeve bodysuit'), 'size_id', t.size('0-3M'), 'qty', 3, 'notes', 'From goals')));
  perform t.ok((select count(*) from public.shopping_items where order_id = o and status = 'ordered') = 2, 'both lines are ordered in the order');
  perform t.ok((select quantity_ordered from public.shopping_items where id = s1) = 2, 'the list entry is ordered');
  perform t.fails(format($q$select public.place_order(%L, '  ', %L::jsonb)$q$, c, jsonb_build_array(jsonb_build_object('item', s1, 'qty', 1))), 'an order needs a name', '22023');
  perform t.fails(format($q$select public.place_order(%L, 'x', '[]'::jsonb)$q$, c), 'an order needs something in it', '22023');

  -- Part 1: one pair of pants.
  nm := public.receive_order(o, jsonb_build_array(jsonb_build_object('item', s1, 'qty', 1)), trip);
  perform t.ok(nm = 'Old Navy sale – part 1', 'a partial delivery is part 1');
  perform t.ok((select trip_name from public.shopping_receipts where trip_id = trip limit 1) = nm, 'the trip carries the name');
  -- Part 2: everything else.
  select id into b from public.shopping_items where order_id = o and id <> s1;
  nm := public.receive_order(o, jsonb_build_array(jsonb_build_object('item', s1, 'qty', 1), jsonb_build_object('item', b, 'qty', 3)), trip2);
  perform t.ok(nm = 'Old Navy sale – part 2', 'the next delivery is part 2');
  perform t.ok((select count(*) from public.shopping_items where order_id = o and status = 'received') = 2, 'the order is all received');
  perform t.ok((select count(*) from public.shopping_receipts where trip_id = trip2) = 2, 'one trip for the delivery');

  -- A whole order in one go keeps its name.
  o2 := public.place_order(c, 'Target', jsonb_build_array(jsonb_build_object('category_id', t.cat('Hat'), 'size_id', t.size('0-3M'), 'qty', 1)));
  select id into b from public.shopping_items where order_id = o2;
  perform t.fails(format($q$select public.receive_order(%L, %L::jsonb, %L)$q$, o2, jsonb_build_array(jsonb_build_object('item', s1, 'qty', 1)), trip3), 'an item from another order is refused', '22023');
  perform t.fails(format($q$select public.receive_order(%L, %L::jsonb, %L)$q$, o2, jsonb_build_array(jsonb_build_object('item', b, 'qty', 2)), trip3), 'more than ordered is refused', '22023');
  perform t.ok((select parts_received from public.shopping_orders where id = o2) = 0, 'a refused delivery changes nothing');
  nm := public.receive_order(o2, jsonb_build_array(jsonb_build_object('item', b, 'qty', 1)), trip3);
  perform t.ok(nm = 'Target', 'a whole order keeps its name');

  -- Another account sees none of it.
  perform t.as_user('Q');
  perform t.ok((select count(*) from public.shopping_orders) = 0, 'orders are private');
  perform t.fails(format($q$select public.receive_order(%L, %L::jsonb, gen_random_uuid())$q$, o2, jsonb_build_array(jsonb_build_object('item', b, 'qty', 1))), 'another account cannot receive', 'P0002');
end $$;

select 'ORDERS TESTS PASSED' as result;
