-- Migration 20: items keep their trip; Not purchased is counted on the shopping entry.
\set ON_ERROR_STOP on

do $$
declare c uuid; o uuid; s uuid; p uuid; trip uuid := gen_random_uuid(); ids uuid[];
begin
  reset role;
  insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-00000000005a', 'n@example.com');
  insert into t.fx values ('N', 'ffffffff-0000-4000-8000-00000000005a') on conflict (k) do update set v = excluded.v;
  perform t.as_user('N');
  insert into public.children (name, current_size_id) values ('Trip items kid', t.size('0-3M')) returning id into c;
  o := public.place_order(c, 'Carter''s', jsonb_build_array(jsonb_build_object('category_id', t.cat('Pants'), 'size_id', t.size('3-6M'), 'qty', 3)));
  select id into s from public.shopping_items where order_id = o;
  perform public.receive_order(o, jsonb_build_array(jsonb_build_object('item', s, 'qty', 3)), trip);
  select inventory_item_id into p from public.shopping_receipts where trip_id = trip;

  -- One photographed (with its trip), one not purchased, one left for later.
  ids := public.complete_received(
    jsonb_build_array(jsonb_build_object('child_id', c, 'name', 'Blue pants', 'category_id', t.cat('Pants'), 'quantity', 1, 'trip_id', trip)),
    jsonb_build_array(jsonb_build_object('item', p, 'qty', 1)),
    jsonb_build_array(jsonb_build_object('item', p, 'qty', 1)));
  perform t.ok((select trip_id from public.inventory_items where id = ids[1]) = trip, 'the new item keeps its trip');
  perform t.ok((select quantity_cancelled from public.shopping_items where id = s) = 1, 'not purchased is counted on the entry');
  perform t.ok((select quantity from public.inventory_items where id = p) = 1, 'one piece is still waiting');
  perform t.ok((select status from public.shopping_items where id = s) = 'received', 'the entry is not back on order');
  perform t.fails(format($q$select public.complete_received('[]'::jsonb, '[]'::jsonb, %L::jsonb)$q$, jsonb_build_array(jsonb_build_object('item', p, 'qty', 2))),
    'cannot cancel more than is waiting', '22023');
  perform t.ok((select quantity_cancelled from public.shopping_items where id = s) = 1, 'a refused cancel changes nothing');
  -- The two-argument call still works.
  ids := public.complete_received('[]'::jsonb, jsonb_build_array(jsonb_build_object('item', p, 'qty', 1)));
  perform t.ok(not exists (select 1 from public.inventory_items where id = p), 'the last piece finishes the placeholder');
end $$;

select 'TRIP ITEMS TESTS PASSED' as result;
