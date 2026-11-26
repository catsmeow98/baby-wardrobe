-- Cross-account access and wardrobe rule tests. Run with run_local_tests.sh.
\set ON_ERROR_STOP on

create schema t;
grant usage on schema t to anon, authenticated;
create table t.fx (k text primary key, v uuid);
grant all on t.fx to anon, authenticated;

create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', msg; end if; end $$;

create function t.fails(stmt text, msg text, code text default null) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if code is not null and sqlstate <> code then
      raise exception 'FAIL: % (expected %, got % %)', msg, code, sqlstate, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAIL: % (statement succeeded)', msg;
end $$;

create function t.affected(stmt text) returns int language plpgsql as $$
declare n int; begin execute stmt; get diagnostics n = row_count; return n; end $$;

create function t.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select v::text from t.fx where k = u), true);
  execute 'set local role authenticated';
end $$;

create function t.cat(n text) returns uuid language sql stable as $$ select id from public.categories where name = n and owner_id is null $$;
create function t.size(l text) returns uuid language sql stable as $$ select id from public.sizes where label = l $$;
create function t.fxv(k text) returns uuid language sql stable as $$ select v from t.fx where k = $1 $$;
grant execute on all functions in schema t to anon, authenticated;

-- 0. Seed defaults and signup trigger -----------------------------------------------------------------
do $$ begin
  insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-000000000001', 'a@example.com'),
                                            ('bbbbbbbb-0000-4000-8000-000000000002', 'b@example.com');
  insert into t.fx values ('A', 'aaaaaaaa-0000-4000-8000-000000000001'), ('B', 'bbbbbbbb-0000-4000-8000-000000000002');
  perform t.ok((select count(*) from public.profiles) = 2, 'profile rows are created for new users');
  perform t.ok((select count(*) from public.categories) = 38, '38 default categories');
  perform t.ok((select count(*) from public.sizes) = 10, '10 size groups');
  perform t.ok((select count(*) from public.size_labels) = 16, '16 tag labels (10 groups, 6 aliases)');
  perform t.ok((select count(*) from public.size_labels l join public.sizes s on s.id = l.size_id
                where s.label = '6-9M' and l.label in ('6-9M', '9M')) = 2, '6-9M and 9M are the same size');
end $$;

-- 1. User A builds a closet and the goal rules hold ----------------------------------------------------
do $$
declare c uuid; i uuid; s uuid; p record;
begin
  perform t.as_user('A');
  insert into public.children (name, current_size_id) values ('Juniper', t.size('3-6M')) returning id into c;
  insert into t.fx values ('childA', c);
  perform t.ok((select owner_id from public.children where id = c) = t.fxv('A'), 'owner defaults to the signed-in user');

  -- fit 3-6M to 6-9M, qty 5, active
  insert into public.inventory_items (child_id, tracking_type, name, category_id, quantity, fit_from_size_id, fit_to_size_id)
    values (c, 'grouped', 'White bodysuits', t.cat('Short-sleeve bodysuit'), 5, t.size('3-6M'), t.size('6-9M'));
  -- fits only 6-9M
  insert into public.inventory_items (child_id, name, category_id, fit_from_size_id, fit_to_size_id)
    values (c, 'Printed bodysuit', t.cat('Short-sleeve bodysuit'), t.size('6-9M'), t.size('6-9M'));
  -- stored counts
  insert into public.inventory_items (child_id, tracking_type, name, category_id, quantity, status, fit_from_size_id, fit_to_size_id)
    values (c, 'grouped', 'Stored bodysuits', t.cat('Short-sleeve bodysuit'), 2, 'stored', t.size('3-6M'), t.size('6-9M'));
  -- do not count: outgrown, unusable, unknown fit, other category
  insert into public.inventory_items (child_id, tracking_type, name, category_id, quantity, status, fit_from_size_id, fit_to_size_id)
    values (c, 'grouped', 'Outgrown', t.cat('Short-sleeve bodysuit'), 3, 'outgrown', t.size('3-6M'), t.size('6-9M'));
  insert into public.inventory_items (child_id, tracking_type, name, category_id, quantity, condition, fit_from_size_id, fit_to_size_id)
    values (c, 'grouped', 'Stained', t.cat('Short-sleeve bodysuit'), 4, 'unusable', t.size('3-6M'), t.size('6-9M'));
  insert into public.inventory_items (child_id, tracking_type, name, category_id, quantity)
    values (c, 'grouped', 'No fit info', t.cat('Short-sleeve bodysuit'), 6);
  insert into public.inventory_items (child_id, tracking_type, name, category_id, quantity, fit_from_size_id, fit_to_size_id)
    values (c, 'grouped', 'Leggings', t.cat('Pants'), 9, t.size('3-6M'), t.size('3-6M'));

  insert into public.wardrobe_goals (child_id, category_id, size_id, target_quantity) values
    (c, t.cat('Short-sleeve bodysuit'), t.size('3-6M'), 12),
    (c, t.cat('Short-sleeve bodysuit'), t.size('6-9M'), 12),
    (c, t.cat('Pants'), t.size('3-6M'), 4);

  select * into p from public.goal_progress where child_id = c and category_id = t.cat('Short-sleeve bodysuit') and size_id = t.size('3-6M');
  perform t.ok(p.owned = 7, format('3-6M owned counts active and stored in range, got %s', p.owned));
  perform t.ok(p.remaining = 5, 'remaining = 12 - 7');
  select * into p from public.goal_progress where child_id = c and category_id = t.cat('Short-sleeve bodysuit') and size_id = t.size('6-9M');
  perform t.ok(p.owned = 8, format('a piece counts toward every size in its range, got %s', p.owned));
  select * into p from public.goal_progress where child_id = c and category_id = t.cat('Pants');
  perform t.ok(p.owned = 9 and p.remaining = 0, 'remaining never goes below zero');

  -- progress is computed from goals, capped per goal, never from summed overlapping totals
  select * into p from public.size_progress where child_id = c and size_id = t.size('3-6M');
  perform t.ok(p.goal_total = 16 and p.owned_toward_goal = 11 and p.percent_complete = 69,
               format('size progress caps each goal: %s/%s = %s%%', p.owned_toward_goal, p.goal_total, p.percent_complete));

  -- constraints
  perform t.fails($q$insert into public.inventory_items (child_id, name, category_id, quantity) values ('$q$ || c || $q$', 'x', $q$ || quote_literal(t.cat('Short-sleeve top')) || $q$, 2)$q$,
                  'individual items must have quantity 1', '23514');
  perform t.fails(format($q$insert into public.inventory_items (child_id, name, category_id, fit_from_size_id, fit_to_size_id) values (%L, 'x', %L, %L, %L)$q$,
                  c, t.cat('Short-sleeve top'), t.size('6-9M'), t.size('3-6M')), 'fit range cannot run backwards', '23514');
  perform t.fails(format($q$insert into public.inventory_items (child_id, name, category_id, fit_from_size_id) values (%L, 'x', %L, %L)$q$,
                  c, t.cat('Short-sleeve top'), t.size('6-9M')), 'fit range needs both ends', '23514');
  perform t.fails(format($q$insert into public.wardrobe_goals (child_id, category_id, size_id, target_quantity) values (%L, %L, %L, 3)$q$,
                  c, t.cat('Pants'), t.size('3-6M')), 'one goal per child, category and size', '23505');
end $$;

-- 2. Shopping: order, partial receipt, over-receipt ----------------------------------------------------
do $$
declare c uuid := t.fxv('childA'); sh uuid; inv uuid; p record; v public.shopping_items;
begin
  perform t.as_user('A');
  insert into public.shopping_items (child_id, category_id, size_id, quantity_needed)
    values (c, t.cat('Short-sleeve bodysuit'), t.size('3-6M'), 3) returning id into sh;
  insert into t.fx values ('shop', sh);

  perform t.ok((select incoming from public.goal_progress where child_id = c and category_id = t.cat('Short-sleeve bodysuit') and size_id = t.size('3-6M')) = 0,
               'a needed item is not incoming yet');
  perform t.fails(format('select public.receive_shopping_item(%L, 1)', sh), 'cannot receive before ordering', '22023');

  v := public.order_shopping_item(sh, 3);
  perform t.ok(v.status = 'ordered' and v.quantity_ordered = 3, 'ordering sets status');
  select * into p from public.goal_progress where child_id = c and category_id = t.cat('Short-sleeve bodysuit') and size_id = t.size('3-6M');
  perform t.ok(p.incoming = 3 and p.remaining = 2, format('incoming 3 reduces remaining to 2, got %s', p.remaining));
  -- incoming only counts for the matching size
  perform t.ok((select incoming from public.goal_progress where child_id = c and category_id = t.cat('Short-sleeve bodysuit') and size_id = t.size('6-9M')) = 0,
               'incoming does not count for other sizes');

  inv := public.receive_shopping_item(sh, 2);
  select * into v from public.shopping_items where id = sh;
  perform t.ok(v.status = 'partially_received' and v.quantity_received = 2, 'partial receipt');
  select * into p from public.goal_progress where child_id = c and category_id = t.cat('Short-sleeve bodysuit') and size_id = t.size('3-6M');
  perform t.ok(p.owned = 9 and p.incoming = 1 and p.remaining = 2, format('after partial: owned 9, incoming 1, remaining 2, got %s/%s/%s', p.owned, p.incoming, p.remaining));
  perform t.ok((select quantity from public.inventory_items where id = inv) = 2, 'received pieces become inventory');
  perform t.ok((select count(*) from public.shopping_receipts where shopping_item_id = sh) = 1, 'a receipt row is kept');
  perform t.fails(format('select public.receive_shopping_item(%L, 2)', sh), 'cannot receive more than outstanding', '22023');

  perform public.receive_shopping_item(sh, 1);
  select * into v from public.shopping_items where id = sh;
  select * into p from public.goal_progress where child_id = c and category_id = t.cat('Short-sleeve bodysuit') and size_id = t.size('3-6M');
  perform t.ok(v.status = 'received' and p.owned = 10 and p.incoming = 0, 'fully received: no double counting');
  perform t.ok((select count(*) from public.shopping_receipts where shopping_item_id = sh) = 2, 'receipt history is kept');
  perform t.fails(format('select public.order_shopping_item(%L, 5)', sh), 'received items cannot be re-ordered', '22023');
end $$;

-- 3. Storage location must match the item's child ------------------------------------------------------
do $$
declare c2 uuid; loc1 uuid; loc2 uuid; it uuid;
begin
  perform t.as_user('A');
  insert into public.children (name) values ('Second') returning id into c2;
  insert into public.storage_locations (child_id, name) values (t.fxv('childA'), 'Bin 1') returning id into loc1;
  insert into public.storage_locations (child_id, name) values (c2, 'Bin 2') returning id into loc2;
  select id into it from public.inventory_items where child_id = t.fxv('childA') limit 1;
  insert into public.inventory_storage (inventory_item_id, storage_location_id, quantity) values (it, loc1, 1);
  perform t.fails(format('insert into public.inventory_storage (inventory_item_id, storage_location_id, quantity) values (%L, %L, 1)', it, loc2),
                  'storage location from another child is rejected', '23514');
  insert into public.inventory_photos (inventory_item_id, storage_path) values (it, t.fxv('A')::text || '/child/photo.jpg');
  perform t.fails(format($q$insert into public.inventory_photos (inventory_item_id, storage_path) values (%L, 'someone-else/photo.jpg')$q$, it),
                  'photo path must start with the user id', '42501');
  insert into public.inventory_photos (inventory_item_id, storage_path, original_path) values (it, t.fxv('A')::text || '/child/p2.png', t.fxv('A')::text || '/child/p2-o.jpg');
  perform t.fails(format($q$insert into public.inventory_photos (inventory_item_id, storage_path, original_path) values (%L, %L, 'someone-else/o.jpg')$q$, it, t.fxv('A')::text || '/child/p3.png'),
                  'original path must start with the user id', '42501');
  insert into t.fx values ('itemA', it);
end $$;

-- 4. User B cannot see or change anything of A's ------------------------------------------------------
do $$
declare cA uuid := t.fxv('childA'); itA uuid := t.fxv('itemA'); shA uuid := t.fxv('shop'); cB uuid; brandB uuid; catB uuid;
begin
  perform t.as_user('B');
  perform t.ok((select count(*) from public.children) = 0, 'B sees no children');
  perform t.ok((select count(*) from public.inventory_items) = 0, 'B sees no inventory');
  perform t.ok((select count(*) from public.wardrobe_goals) = 0, 'B sees no goals');
  perform t.ok((select count(*) from public.shopping_items) = 0, 'B sees no shopping');
  perform t.ok((select count(*) from public.shopping_receipts) = 0, 'B sees no receipts');
  perform t.ok((select count(*) from public.inventory_photos) = 0, 'B sees no photos');
  perform t.ok((select count(*) from public.storage_locations) = 0, 'B sees no storage locations');
  perform t.ok((select count(*) from public.goal_progress) = 0, 'B sees no goal progress (view respects RLS)');
  perform t.ok((select count(*) from public.size_progress) = 0, 'B sees no size progress');
  perform t.ok((select count(*) from public.profiles) = 1, 'B sees only their own profile');

  perform t.ok(t.affected(format($q$update public.children set name = 'hacked' where id = %L$q$, cA)) = 0, 'B cannot update A child');
  perform t.ok(t.affected(format($q$delete from public.children where id = %L$q$, cA)) = 0, 'B cannot delete A child');
  perform t.ok(t.affected(format($q$update public.inventory_items set quantity = 999, tracking_type = 'grouped' where id = %L$q$, itA)) = 0, 'B cannot update A item');
  perform t.ok(t.affected(format($q$delete from public.shopping_items where id = %L$q$, shA)) = 0, 'B cannot delete A shopping');

  perform t.fails(format($q$insert into public.inventory_items (child_id, name, category_id) values (%L, 'x', %L)$q$, cA, t.cat('Short-sleeve top')), 'B cannot add items to A child', '42501');
  perform t.fails(format($q$insert into public.wardrobe_goals (child_id, category_id, size_id, target_quantity) values (%L, %L, %L, 1)$q$, cA, t.cat('Short-sleeve top'), t.size('3-6M')), 'B cannot add goals to A child', '42501');
  perform t.fails(format($q$insert into public.shopping_items (child_id, category_id, size_id) values (%L, %L, %L)$q$, cA, t.cat('Short-sleeve top'), t.size('3-6M')), 'B cannot add shopping to A child', '42501');
  perform t.fails(format($q$insert into public.storage_locations (child_id, name) values (%L, 'x')$q$, cA), 'B cannot add locations to A child', '42501');
  perform t.fails(format($q$insert into public.inventory_photos (inventory_item_id, storage_path) values (%L, %L)$q$, itA, t.fxv('B')::text || '/x.jpg'), 'B cannot attach photos to A item', '42501');
  perform t.fails(format('select public.receive_shopping_item(%L, 1)', shA), 'B cannot receive A shopping', 'P0002');
  perform t.fails(format('select public.order_shopping_item(%L, 1)', shA), 'B cannot order A shopping', 'P0002');
  perform t.fails(format($q$insert into public.children (owner_id, name) values (%L, 'forged')$q$, t.fxv('A')), 'B cannot create a child owned by A', '42501');

  -- shared defaults are read-only
  perform t.fails($q$insert into public.categories (name, owner_id) values ('Shared forgery', null)$q$, 'users cannot create shared categories', '42501');
  perform t.ok(t.affected($q$update public.categories set name = 'renamed' where owner_id is null$q$) = 0, 'users cannot edit shared categories');
  perform t.ok(t.affected($q$delete from public.sizes$q$) = 0, 'users cannot delete shared sizes');
  perform t.fails($q$insert into public.size_systems (name, owner_id) values ('forgery', null)$q$, 'users cannot create shared size systems', '42501');
  perform t.fails(format($q$insert into public.sizes (size_system_id, label, sort_order) values (%L, 'Huge', 99)$q$, '00000000-0000-4000-8000-000000000001'::uuid), 'users cannot add sizes to the shared system', '42501');

  -- B's own data works, and cannot be referenced by A
  insert into public.children (name) values ('Kid B') returning id into cB;
  insert into public.brands (name, owner_id) values ('BrandB', t.fxv('B')) returning id into brandB;
  insert into public.categories (name, owner_id) values ('B custom', t.fxv('B')) returning id into catB;
  insert into public.inventory_items (child_id, name, category_id, brand_id) values (cB, 'B item', catB, brandB);
  insert into t.fx values ('brandB', brandB), ('catB', catB), ('childB', cB);
  -- B cannot use A's size... sizes are shared; but B cannot point a fit range at a size outside the child's system
  perform t.fails(format($q$insert into public.inventory_items (child_id, name, category_id, fit_from_size_id, fit_to_size_id) values (%L, 'x', %L, %L, %L)$q$,
                  cB, t.cat('Short-sleeve top'), gen_random_uuid(), gen_random_uuid()), 'unknown sizes are rejected', '23514');
  declare v_sys uuid; v_sz uuid;
  begin
    insert into public.size_systems (name, owner_id) values ('B system', t.fxv('B')) returning id into v_sys;
    insert into public.sizes (size_system_id, label, sort_order) values (v_sys, 'B-size', 1) returning id into v_sz;
    perform t.fails(format($q$insert into public.inventory_items (child_id, name, category_id, fit_from_size_id, fit_to_size_id) values (%L, 'x', %L, %L, %L)$q$,
                    cB, t.cat('Short-sleeve top'), v_sz, v_sz), 'sizes from a different size system are rejected', '23514');
    insert into t.fx values ('sysB', v_sys);
  end;
end $$;

-- 5. A cannot reference B's private brands or categories -----------------------------------------------
do $$
begin
  perform t.as_user('A');
  perform t.ok((select count(*) from public.brands) = 0, 'A cannot see B brands');
  perform t.ok((select count(*) from public.size_systems where owner_id is not null) = 0, 'A cannot see B size systems');
  perform t.ok((select count(*) from public.sizes where label = 'B-size') = 0, 'A cannot see B sizes');
  perform t.ok((select count(*) from public.categories where owner_id is not null) = 0, 'A cannot see B categories');
  perform t.fails(format($q$insert into public.inventory_items (child_id, name, category_id, brand_id) values (%L, 'x', %L, %L)$q$,
                  t.fxv('childA'), t.cat('Short-sleeve top'), t.fxv('brandB')), 'A cannot reference B brand', '42501');
  perform t.fails(format($q$insert into public.inventory_items (child_id, name, category_id) values (%L, 'x', %L)$q$,
                  t.fxv('childA'), t.fxv('catB')), 'A cannot reference B category', '42501');
  perform t.fails(format($q$insert into public.wardrobe_goals (child_id, category_id, size_id, target_quantity) values (%L, %L, %L, 1)$q$,
                  t.fxv('childA'), t.fxv('catB'), t.size('6-9M')), 'A cannot set goals on B category', '42501');
  perform t.ok(t.affected(format($q$update public.inventory_items set name = 'x' where child_id = %L$q$, t.fxv('childB'))) = 0, 'A cannot update B items');
end $$;

-- 6. Private photo bucket -------------------------------------------------------------------------------
do $$
begin
  perform t.as_user('A');
  insert into storage.objects (bucket_id, name) values ('wardrobe-photos', t.fxv('A')::text || '/childA/a.jpg');
  perform t.fails(format($q$insert into storage.objects (bucket_id, name) values ('wardrobe-photos', %L)$q$, t.fxv('B')::text || '/childB/b.jpg'),
                  'A cannot write into B folder', '42501');
  perform t.fails($q$insert into storage.objects (bucket_id, name) values ('other-bucket', 'x/y.jpg')$q$, 'only the private bucket is writable', null);
end $$;
do $$
begin
  perform t.as_user('B');
  perform t.ok((select count(*) from storage.objects) = 0, 'B cannot list A photos');
  perform t.ok(t.affected($q$delete from storage.objects$q$) = 0, 'B cannot delete A photos');
end $$;

-- 7. Signed-out users get nothing -------------------------------------------------------------------------
do $$
begin
  execute 'set local role anon';
  perform t.fails('select * from public.children', 'anon cannot read children', '42501');
  perform t.fails('select * from public.categories', 'anon cannot read categories', '42501');
  perform t.fails('select * from public.goal_progress', 'anon cannot read goal progress', '42501');
  perform t.fails($q$select public.receive_shopping_item(gen_random_uuid(), 1)$q$, 'anon cannot call receive', '42501');
end $$;

-- 8. Account deletion removes everything the user owned ----------------------------------------------------
do $$
declare v uuid := t.fxv('A');
begin
  perform t.ok((select count(*) from public.inventory_items where child_id = t.fxv('childA')) > 0, 'precondition: A has inventory');
  delete from auth.users where id = v;
  perform t.ok((select count(*) from public.children where owner_id = v) = 0, 'children are deleted with the account');
  perform t.ok((select count(*) from public.inventory_items i where i.child_id in (select id from public.children where owner_id = v)) = 0, 'inventory is deleted');
  perform t.ok((select count(*) from public.shopping_receipts) = 0, 'receipts are deleted');
  perform t.ok((select count(*) from public.wardrobe_goals) = 0, 'goals are deleted');
  perform t.ok((select count(*) from public.profiles where id = v) = 0, 'profile is deleted');
  perform t.ok((select count(*) from public.children where owner_id = t.fxv('B')) = 1, 'other accounts are untouched');
end $$;

select 'ALL TESTS PASSED' as result;
