-- Migration 18: trips needing photos (receive into a trip, then replace the placeholders with real items).
\set ON_ERROR_STOP on

do $$
declare
  c uuid; s1 uuid; s2 uuid; trip uuid := gen_random_uuid(); p1 uuid; p2 uuid; ids uuid[]; n int;
begin
  reset role;
  insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-00000000003a', 't@example.com'), ('ffffffff-0000-4000-8000-00000000003b', 'u@example.com');
  insert into t.fx values ('T', 'ffffffff-0000-4000-8000-00000000003a'), ('U', 'ffffffff-0000-4000-8000-00000000003b') on conflict (k) do update set v = excluded.v;
  perform t.as_user('T');

  insert into public.children (name, current_size_id) values ('Trip kid', t.size('0-3M')) returning id into c;
  insert into public.shopping_items (child_id, category_id, size_id, quantity_needed) values (c, t.cat('Short-sleeve bodysuit'), t.size('0-3M'), 3) returning id into s1;
  insert into public.shopping_items (child_id, category_id, size_id, quantity_needed) values (c, t.cat('Pants'), t.size('3-6M'), 2) returning id into s2;
  perform public.order_shopping_item(s1, 3);
  perform public.order_shopping_item(s2, 2);
  p1 := public.receive_shopping_item(s1, 3, trip);
  p2 := public.receive_shopping_item(s2, 2, trip);
  perform t.ok((select count(*) from public.shopping_receipts where trip_id = trip) = 2, 'both receipts are in the trip');
  perform t.ok((select needs_details from public.inventory_items where id = p1), 'a received placeholder needs details');
end $$;

do $$
declare
  c uuid; trip uuid; p1 uuid; p2 uuid; ids uuid[]; rows jsonb;
begin
  perform t.as_user('T');
  select r.trip_id into trip from public.shopping_receipts r where r.trip_id is not null limit 1;
  select i.id into p1 from public.inventory_items i join public.shopping_receipts r on r.inventory_item_id = i.id where r.trip_id = trip and i.quantity = 3;
  select i.id into p2 from public.inventory_items i join public.shopping_receipts r on r.inventory_item_id = i.id where r.trip_id = trip and i.quantity = 2;
  select child_id into c from public.inventory_items where id = p1;

  -- Two photographed bodysuits; the third stays waiting.
  rows := jsonb_build_array(
    jsonb_build_object('child_id', c, 'name', 'Green bodysuit', 'category_id', t.cat('Short-sleeve bodysuit'), 'quantity', 1,
      'fit_from_size_id', t.size('0-3M'), 'fit_to_size_id', t.size('0-3M'), 'condition', 'new'),
    jsonb_build_object('child_id', c, 'name', 'Yellow bodysuit', 'category_id', t.cat('Short-sleeve bodysuit'), 'quantity', 1,
      'fit_from_size_id', t.size('0-3M'), 'fit_to_size_id', t.size('0-3M'), 'condition', 'new'));
  ids := public.complete_received(rows, jsonb_build_array(jsonb_build_object('item', p1, 'qty', 2)));
  perform t.ok(array_length(ids, 1) = 2, 'two items made');
  perform t.ok((select name from public.inventory_items where id = ids[1]) = 'Green bodysuit', 'ids come back in order');
  perform t.ok((select quantity from public.inventory_items where id = p1) = 1, 'the placeholder keeps the piece not done');
  perform t.ok((select tracking_type from public.inventory_items where id = ids[1]) = 'individual', 'one piece is an individual item');

  -- Too many pieces: nothing changes at all.
  perform t.fails(format($q$select public.complete_received(%L::jsonb, %L::jsonb)$q$,
    jsonb_build_array(jsonb_build_object('child_id', c, 'name', 'Extra', 'category_id', t.cat('Pants'), 'quantity', 1)),
    jsonb_build_array(jsonb_build_object('item', p2, 'qty', 3))), 'more pieces than received are refused', '22023');
  perform t.ok((select count(*) from public.inventory_items where name = 'Extra') = 0, 'a refused completion adds nothing');
  perform t.ok((select quantity from public.inventory_items where id = p2) = 2, 'a refused completion leaves the placeholder');

  -- The pants as a pack, and the last bodysuit with no photo: both placeholders go, the receipts lose their item.
  ids := public.complete_received(jsonb_build_array(
      jsonb_build_object('child_id', c, 'name', 'Pants 2-pack', 'category_id', t.cat('Pants'), 'tracking_type', 'grouped', 'quantity', 2),
      jsonb_build_object('child_id', c, 'name', 'Short-sleeve bodysuit', 'category_id', t.cat('Short-sleeve bodysuit'), 'quantity', 1)),
    jsonb_build_array(jsonb_build_object('item', p2, 'qty', 2), jsonb_build_object('item', p1, 'qty', 1)));
  perform t.ok(not exists (select 1 from public.inventory_items where id in (p1, p2)), 'finished placeholders are removed');
  perform t.ok((select count(*) from public.shopping_receipts where trip_id = trip and inventory_item_id is null) = 2, 'the trip has nothing left to do');
  perform t.fails(format($q$select public.complete_received('[]'::jsonb, %L::jsonb)$q$, jsonb_build_array(jsonb_build_object('item', p1, 'qty', 1))),
    'a finished placeholder cannot be taken again', '22023');
end $$;

do $$
declare c uuid; s uuid; p uuid;
begin
  perform t.as_user('T');
  select id into c from public.children where name = 'Trip kid';
  insert into public.shopping_items (child_id, category_id, size_id, quantity_needed) values (c, t.cat('Warm hat / beanie'), t.size('0-3M'), 1) returning id into s;
  perform public.order_shopping_item(s, 1);
  p := public.receive_shopping_item(s, 1);
  perform t.ok((select trip_id from public.shopping_receipts where inventory_item_id = p) is null, 'receive without a trip still works');
  -- Another account cannot take this placeholder.
  perform t.as_user('U');
  perform t.fails(format($q$select public.complete_received('[]'::jsonb, %L::jsonb)$q$, jsonb_build_array(jsonb_build_object('item', p, 'qty', 1))),
    'another account cannot complete these pieces', '22023');
end $$;

select 'TRIPS TESTS PASSED' as result;
