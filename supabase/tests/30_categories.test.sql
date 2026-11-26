-- Categories: the built-in list, and the rules for custom categories.
\set ON_ERROR_STOP on

do $$
declare cF uuid; custom uuid; ch uuid;
begin
  reset role;
  perform t.ok((select count(*) from public.categories where owner_id is null) = 37, '37 built-in categories');
  perform t.ok((select count(*) from public.categories where owner_id is null and group_id is null) = 0, 'every built-in item has a category');
  perform t.ok((select count(distinct sort_order) from public.categories where owner_id is null) = 37, 'built-in order is unique');
  perform t.ok(exists (select 1 from public.categories where owner_id is null and name in ('Sleep sack', 'Footy sleeper', 'Dress shirt', 'Bunting', 'Snowsuit', 'Socks', 'Hat', 'Coat')), 'individual items exist');
  perform t.ok(not exists (select 1 from public.categories where owner_id is null and name in ('Outfits', 'Outerwear', 'Accessories', 'Swaddles', 'Sleep sacks')), 'grouped and plural names are gone');
  perform t.ok((select count(*) from public.categories where owner_id is null and name like 'Other %') = 0, 'the catch-all Other types are retired');

  insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-000000000006', 'f@example.com');
  insert into t.fx values ('F', 'ffffffff-0000-4000-8000-000000000006') on conflict (k) do update set v = excluded.v;
  perform t.as_user('F');
  insert into public.categories (name, owner_id, sort_order) values ('Costume', t.fxv('F'), 1000) returning id into custom;
  perform t.ok((select count(*) from public.categories where owner_id = t.fxv('F')) = 1, 'a person can add a custom category');
  perform t.fails($q$insert into public.categories (name, owner_id) values ('hat', auth.uid())$q$, 'a custom name cannot copy a built-in item, even in another case', '23505');
  perform t.fails($q$insert into public.categories (name, owner_id) values ('COSTUME', auth.uid())$q$, 'a person cannot add the same custom name twice', '23505');
  perform t.fails($q$update public.categories set name = 'Dress' where owner_id = auth.uid()$q$, 'renaming to a built-in name is rejected', '23505');
  perform t.fails($q$insert into public.categories (name, owner_id) values ('   ', auth.uid())$q$, 'a blank name is rejected', '23514');
  perform t.fails(format($q$insert into public.categories (name, owner_id) values (%L, auth.uid())$q$, repeat('x', 61)), 'a name over 60 characters is rejected', '23514');

  -- a custom category works for items, and cannot be deleted while it is in use
  insert into public.children (name) values ('Kid') returning id into cF;
  insert into public.inventory_items (child_id, name, category_id) values (cF, 'Dino costume', custom) returning child_id into ch;
  perform t.fails(format($q$delete from public.categories where id = %L$q$, custom), 'a category in use cannot be deleted', '23503');
  delete from public.inventory_items where child_id = cF;
  delete from public.categories where id = custom;
  perform t.ok((select count(*) from public.categories where owner_id = t.fxv('F')) = 0, 'an unused custom category can be deleted');

  -- the cap
  for i in 1..60 loop insert into public.categories (name, owner_id) values ('Custom ' || i, t.fxv('F')); end loop;
  perform t.fails($q$insert into public.categories (name, owner_id) values ('One too many', auth.uid())$q$, 'the 61st custom category is rejected', '22023');

  reset role;
  perform t.as_user('D');
  perform t.ok((select count(*) from public.categories where owner_id is not null) = 0, 'another account never sees custom categories');
end $$;

select 'CATEGORY TESTS PASSED' as result;
