-- Run by run_local_tests.sh on a database that has migrations 01 to 11 only. Sets up one account the way a real one looks,
-- applies migration 12, and checks nothing was lost.
\set ON_ERROR_STOP on
do $$
declare
  u uuid := gen_random_uuid(); v uuid := gen_random_uuid();
  ch uuid; chv uuid; sz uuid; sz2 uuid;
  top_ uuid; sweater uuid; jacket uuid; other_o uuid; other_acc uuid; leg uuid;
  c_over_l uuid; c_over_s uuid; c_card uuid; c_zip uuid; grp_out uuid; grp_out_b uuid;
begin
  insert into auth.users (id, email) values (u, 'a@x.test'), (v, 'b@x.test');
  insert into public.children (owner_id, name) values (u, 'A') returning id into ch;
  insert into public.children (owner_id, name) values (v, 'B') returning id into chv;
  select id into sz from public.sizes order by sort_order limit 1;
  select id into sz2 from public.sizes order by sort_order offset 1 limit 1;
  select id into top_ from public.categories where owner_id is null and name = 'Top';
  select id into sweater from public.categories where owner_id is null and name = 'Sweater';
  select id into jacket from public.categories where owner_id is null and name = 'Light jacket';
  select id into other_o from public.categories where owner_id is null and name = 'Other outfit';
  select id into other_acc from public.categories where owner_id is null and name = 'Other accessory';
  select id into leg from public.categories where owner_id is null and name = 'Leggings';
  select id into grp_out from public.category_groups where owner_id is null and name = 'Outfits';
  select id into grp_out_b from public.category_groups where owner_id is null and name = 'Outerwear';

  -- A's own types, in the Outfits and Outerwear item categories
  insert into public.categories (owner_id, name, group_id) values (u, 'Overalls long', grp_out) returning id into c_over_l;
  insert into public.categories (owner_id, name, group_id) values (u, 'Overalls short', grp_out) returning id into c_over_s;
  insert into public.categories (owner_id, name, group_id) values (u, 'Cardigan', grp_out_b) returning id into c_card;
  insert into public.categories (owner_id, name, group_id) values (u, 'Zip-up jacket', grp_out_b) returning id into c_zip;
  -- A renamed Sweater "Long-sleeve top", Light jacket "Pullover", Top "Short-sleeve top"
  insert into public.user_category_prefs (owner_id, category_id, name) values (u, sweater, 'Long-sleeve top'), (u, jacket, 'Pullover'), (u, top_, 'Short-sleeve top');

  insert into public.inventory_items (child_id, name, category_id) values
    (ch, 'Denim overalls', c_over_l), (ch, 'Summer overalls', c_over_s), (ch, 'Gray cardigan', c_card), (ch, 'Zip jacket', c_zip),
    (ch, 'Blue long sleeve', sweater), (ch, 'Fleece', jacket), (ch, 'Red tee', top_), (ch, 'Misc outfit', other_o), (ch, 'Misc acc', other_acc);
  insert into public.wardrobe_goals (child_id, category_id, size_id, target_quantity) values
    (ch, c_card, sz, 2), (ch, sweater, sz, 4), (ch, top_, sz, 5), (ch, other_o, sz2, 3), (ch, c_over_l, sz, 1);
  insert into public.shopping_items (child_id, category_id, size_id) values (ch, c_over_s, sz2), (ch, other_acc, sz);
  -- B owns an item on Sweater with no rename: it must stay on Sweater, and one on Other outfit
  insert into public.inventory_items (child_id, name, category_id) values (chv, 'B sweater', sweater), (chv, 'B other', other_o);
  create temp table fx as select u as a, v as b, ch as chA, chv as chB, sz, sz2;
end $$;

\i migrations/20260101000012_item_types_update.sql

do $$
declare f record; n int;
  function_ok boolean;
begin
  select * into f from fx;
  create or replace function pg_temp.cat_of(item text) returns text language sql as
    $q$ select c.name || case when c.owner_id is null then ' [built-in]' else ' [own]' end from public.inventory_items i join public.categories c on c.id = i.category_id where i.name = item $q$;
  create or replace function pg_temp.grp_of(cat text) returns text language sql as
    $q$ select g.name from public.categories c join public.category_groups g on g.id = c.group_id where c.owner_id is null and c.name = cat $q$;
  create or replace function pg_temp.chk(ok boolean, msg text) returns void language plpgsql as
    $q$ begin if not coalesce(ok, false) then raise exception 'FAILED: %', msg; end if; raise notice 'ok: %', msg; end $q$;

  perform pg_temp.chk((select count(*) from public.categories where owner_id is null) = 37, '37 built-in item types');
  perform pg_temp.chk((select count(distinct sort_order) from public.categories where owner_id is null) = 37, 'built-in order unique');
  perform pg_temp.chk(not exists (select 1 from public.categories where name like 'Other %' and owner_id is null), 'no built-in Other types left');
  perform pg_temp.chk(not exists (select 1 from public.categories where name = 'Top' and owner_id is null), 'Top is renamed');
  perform pg_temp.chk(pg_temp.grp_of('Sweater') = 'Outerwear', 'Sweater in Outerwear');
  perform pg_temp.chk(pg_temp.grp_of('Dress shirt') = 'Bodysuits and tops', 'Dress shirt in Bodysuits and tops');
  perform pg_temp.chk(pg_temp.grp_of('Dress pants') = 'Bottoms', 'Dress pants in Bottoms');
  perform pg_temp.chk(pg_temp.grp_of('Skirt') = 'Bottoms' and pg_temp.grp_of('Cardigan') = 'Outerwear' and pg_temp.grp_of('Long overalls') = 'Outfits', 'new types placed');

  perform pg_temp.chk(pg_temp.cat_of('Denim overalls') = 'Long overalls [built-in]', 'custom Overalls long merged');
  perform pg_temp.chk(pg_temp.cat_of('Summer overalls') = 'Short overalls [built-in]', 'custom Overalls short merged');
  perform pg_temp.chk(pg_temp.cat_of('Gray cardigan') = 'Cardigan [built-in]', 'custom Cardigan merged');
  perform pg_temp.chk(pg_temp.cat_of('Zip jacket') = 'Zip-up jacket [own]', 'unmatched custom type kept');
  perform pg_temp.chk(pg_temp.cat_of('Blue long sleeve') = 'Long-sleeve top [built-in]', 'renamed Sweater items moved to Long-sleeve top');
  perform pg_temp.chk(pg_temp.cat_of('Fleece') = 'Pullover / hoodie [built-in]', 'renamed Light jacket items moved to Pullover / hoodie');
  perform pg_temp.chk(pg_temp.cat_of('Red tee') = 'Short-sleeve top [built-in]', 'Top items stay on Short-sleeve top');
  perform pg_temp.chk(pg_temp.cat_of('Misc outfit') = 'Other outfit [own]', 'Other outfit becomes own type');
  perform pg_temp.chk(pg_temp.cat_of('Misc acc') = 'Other accessory [own]', 'Other accessory becomes own type');
  perform pg_temp.chk(pg_temp.cat_of('B sweater') = 'Sweater [built-in]', 'another account keeps Sweater');
  perform pg_temp.chk(pg_temp.cat_of('B other') = 'Other outfit [own]', 'another account gets its own Other outfit');
  perform pg_temp.chk((select owner_id from public.categories c join public.inventory_items i on i.category_id = c.id where i.name = 'B other') = f.b, 'and it is theirs, not A''s');
  perform pg_temp.chk((select owner_id from public.categories c join public.inventory_items i on i.category_id = c.id where i.name = 'Misc outfit') = f.a, 'A''s Other outfit is A''s');
  perform pg_temp.chk((select g.name from public.categories c join public.inventory_items i on i.category_id = c.id join public.category_groups g on g.id = c.group_id where i.name = 'Misc outfit') = 'Outfits', 'Other outfit stays in Outfits');

  perform pg_temp.chk((select target_quantity from public.wardrobe_goals g join public.categories c on c.id = g.category_id where g.child_id = f.chA and c.name = 'Cardigan' and c.owner_id is null) = 2, 'cardigan goal moved');
  perform pg_temp.chk((select target_quantity from public.wardrobe_goals g join public.categories c on c.id = g.category_id where g.child_id = f.chA and c.name = 'Long-sleeve top') = 4, 'Sweater goal moved to Long-sleeve top');
  perform pg_temp.chk((select target_quantity from public.wardrobe_goals g join public.categories c on c.id = g.category_id where g.child_id = f.chA and c.name = 'Long overalls') = 1, 'overalls goal moved');
  perform pg_temp.chk((select count(*) from public.wardrobe_goals where child_id = f.chA) = 5, 'no goals lost or duplicated');
  perform pg_temp.chk((select count(*) from public.shopping_items s join public.categories c on c.id = s.category_id where c.name in ('Short overalls', 'Other accessory')) = 2, 'shopping entries moved');
  perform pg_temp.chk(not exists (select 1 from public.categories where owner_id = f.a and name in ('Overalls long', 'Overalls short', 'Cardigan')), 'merged custom types removed');
  perform pg_temp.chk(not exists (select 1 from public.user_category_prefs p join public.categories c on c.id = p.category_id where p.owner_id = f.a and c.name = 'Sweater' and p.name is not null), 'Sweater rename cleared');
  perform pg_temp.chk(exists (select 1 from information_schema.columns where table_name = 'user_settings' and column_name = 'setup_dismissed_at'), 'setup_dismissed_at exists');
  raise notice 'ALL UPGRADE CHECKS PASSED';
end $$;

-- Migration 13: booties. A custom "Booties" type with an item, a goal and a shopping entry is merged into the new built-in.
do $$
declare f record; own uuid; grp uuid;
begin
  select * into f from fx;
  select id into grp from public.category_groups where owner_id is null and name = 'Footwear';
  insert into public.categories (owner_id, name, group_id) values (f.a, 'Booties', grp) returning id into own;
  insert into public.inventory_items (child_id, name, category_id) values (f.chA, 'Wool booties', own);
  insert into public.wardrobe_goals (child_id, category_id, size_id, target_quantity) values (f.chA, own, f.sz, 3);
  insert into public.shopping_items (child_id, category_id, size_id) values (f.chA, own, f.sz2);
end $$;

\i migrations/20260101000013_booties.sql
\i migrations/20260101000013_booties.sql

do $$
declare f record;
begin
  select * into f from fx;
  if (select count(*) from public.categories where owner_id is null) <> 38 then raise exception 'FAILED: 38 built-in types'; end if;
  if (select count(distinct sort_order) from public.categories where owner_id is null) <> 38 then raise exception 'FAILED: order unique'; end if;
  if (select string_agg(c.name, ',' order by c.sort_order) from public.categories c join public.category_groups g on g.id = c.group_id where c.owner_id is null and g.name = 'Footwear') <> 'Shoes,Booties,Boots' then raise exception 'FAILED: footwear order'; end if;
  if not exists (select 1 from public.inventory_items i join public.categories c on c.id = i.category_id where i.name = 'Wool booties' and c.owner_id is null and c.name = 'Booties') then raise exception 'FAILED: item merged into Booties'; end if;
  if (select target_quantity from public.wardrobe_goals g join public.categories c on c.id = g.category_id where g.child_id = f.chA and c.name = 'Booties') <> 3 then raise exception 'FAILED: goal merged'; end if;
  if not exists (select 1 from public.shopping_items s join public.categories c on c.id = s.category_id where c.owner_id is null and c.name = 'Booties') then raise exception 'FAILED: shopping merged'; end if;
  if exists (select 1 from public.categories where owner_id is not null and name = 'Booties') then raise exception 'FAILED: custom Booties removed'; end if;
  raise notice 'BOOTIES CHECKS PASSED (migration 13 also ran twice)';
end $$;
