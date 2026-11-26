-- Account settings, item color and outfits.
\set ON_ERROR_STOP on

do $$
declare c1 uuid; c2 uuid; i1 uuid; i2 uuid; i3 uuid; o uuid;
begin
  reset role;
  insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-00000000001a', 'm@example.com'), ('ffffffff-0000-4000-8000-00000000001b', 'n@example.com');
  insert into t.fx values ('M', 'ffffffff-0000-4000-8000-00000000001a'), ('N', 'ffffffff-0000-4000-8000-00000000001b') on conflict (k) do update set v = excluded.v;

  perform t.as_user('M');
  -- settings
  insert into public.user_settings (owner_id) values (auth.uid());
  perform t.ok((select remove_background from public.user_settings) = true, 'background removal is on by default');
  update public.user_settings set place_name = 'Boston, Massachusetts, United States', latitude = 42.36, longitude = -71.06,
    month_classes = array['cold','cold','cool','cool','mild','warm','warm','warm','mild','cool','cool','cold'];
  perform t.ok((select place_name from public.user_settings) like 'Boston%', 'a location can be saved');
  perform t.fails($q$update public.user_settings set month_classes = array['cold','cool']$q$, 'month labels must be twelve', '23514');
  perform t.fails($q$update public.user_settings set month_classes = array['cold','cold','cool','cool','mild','warm','warm','warm','mild','cool','cool','tropical']$q$, 'an unknown month label is rejected', '23514');
  perform t.fails($q$update public.user_settings set place_name = null$q$, 'a place and its months go together', '23514');
  perform t.fails(format($q$insert into public.user_settings (owner_id) values (%L)$q$, t.fxv('N')), 'settings cannot be written for another account', '42501');

  -- color
  insert into public.children (name) values ('One') returning id into c1;
  insert into public.children (name) values ('Two') returning id into c2;
  insert into public.inventory_items (child_id, name, category_id, color) values (c1, 'Blue top', t.cat('Short-sleeve top'), 'blue') returning id into i1;
  insert into public.inventory_items (child_id, name, category_id, color) values (c1, 'Striped top', t.cat('Short-sleeve top'), 'multicolor') returning id into i2;
  insert into public.inventory_items (child_id, name, category_id) values (c2, 'Other child top', t.cat('Short-sleeve top')) returning id into i3;
  perform t.ok((select color from public.inventory_items where id = i2) = 'multicolor', 'multicolor is a color');
  perform t.ok((select color from public.inventory_items where name = 'Other child top') is null, 'color is optional');
  perform t.fails(format($q$update public.inventory_items set color = 'chartreuse' where id = %L$q$, i1), 'an unknown color is rejected', '23514');

  -- outfits
  insert into public.outfits (child_id, name) values (c1, 'Park day') returning id into o;
  insert into public.outfit_items (outfit_id, item_id, sort_order) values (o, i1, 0), (o, i2, 1);
  perform t.ok((select count(*) from public.outfit_items where outfit_id = o) = 2, 'an outfit holds items');
  insert into public.outfits (child_id, name) values (c1, 'Second') returning id into o;
  insert into public.outfit_items (outfit_id, item_id) values (o, i1);
  perform t.ok((select count(*) from public.outfit_items where item_id = i1) = 2, 'an item can be in several outfits');
  perform t.fails(format($q$insert into public.outfit_items (outfit_id, item_id) values (%L, %L)$q$, o, i3), 'an outfit cannot hold another child''s item', '42501');
  perform t.fails($q$insert into public.outfits (child_id, name) values (gen_random_uuid(), 'x')$q$, 'an outfit needs a child of yours', '42501');
  perform t.fails(format($q$insert into public.outfits (child_id, name) values (%L, '  ')$q$, c1), 'an outfit needs a name', '23514');
end $$;

do $$
declare c1 uuid; o uuid; i uuid; n int;
begin
  perform t.as_user('M');
  select id into c1 from public.children where name = 'One';
  insert into public.outfits (child_id, name) values (c1, 'Big') returning id into o;
  for n in 1..12 loop
    insert into public.inventory_items (child_id, name, category_id) values (c1, 'Piece ' || n, t.cat('Socks')) returning id into i;
    insert into public.outfit_items (outfit_id, item_id, sort_order) values (o, i, n);
  end loop;
  insert into public.inventory_items (child_id, name, category_id) values (c1, 'Piece 13', t.cat('Socks')) returning id into i;
  perform t.fails(format($q$insert into public.outfit_items (outfit_id, item_id) values (%L, %L)$q$, o, i), 'an outfit holds at most 12 items', '22023');

  -- deleting an item removes it from its outfits, not the outfit
  perform t.ok(t.affected(format($q$delete from public.inventory_items where id = %L$q$, (select item_id from public.outfit_items where outfit_id = o limit 1))) = 1, 'an item can be deleted');
  perform t.ok((select count(*) from public.outfit_items where outfit_id = o) = 11, 'it leaves its outfit');
  perform t.ok((select count(*) from public.outfits where id = o) = 1, 'the outfit stays');

  -- privacy
  reset role; perform t.as_user('N');
  perform t.ok((select count(*) from public.outfits) = 0 and (select count(*) from public.outfit_items) = 0 and (select count(*) from public.user_settings) = 0, 'another account sees none of it');

  -- deleting a child removes its outfits
  reset role; perform t.as_user('M');
  perform t.ok(t.affected(format($q$delete from public.children where id = %L$q$, c1)) = 1, 'a child can be deleted');
  perform t.ok((select count(*) from public.outfits) = 0, 'its outfits go with it');
end $$;
select 'SETTINGS COLOR OUTFITS TESTS PASSED' as result;
