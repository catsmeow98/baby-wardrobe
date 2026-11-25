-- Categories (groups) hold items. Built-in categories, custom categories, and custom items inside either.
\set ON_ERROR_STOP on

do $$
declare grp uuid; item uuid; c uuid; other_grp uuid;
begin
  reset role;
  perform t.ok((select count(*) from public.category_groups where owner_id is null) >= 8, 'built-in categories exist');
  perform t.ok(exists (select 1 from public.category_groups where owner_id is null and name in ('Sleep', 'Outerwear', 'Accessories')), 'Sleep, Outerwear and Accessories are categories');
  perform t.ok((select group_id from public.categories where owner_id is null and name = 'Sleep sack') = (select id from public.category_groups where owner_id is null and name = 'Sleep'), 'Sleep sack sits in Sleep');
  perform t.ok((select group_id from public.categories where owner_id is null and name = 'Coat') = (select id from public.category_groups where owner_id is null and name = 'Outerwear'), 'Coat sits in Outerwear');
  perform t.ok(not exists (select 1 from public.categories where group_id is null), 'every item has a category');

  insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-000000000008', 'h@example.com');
  insert into t.fx values ('H', 'ffffffff-0000-4000-8000-000000000008') on conflict (k) do update set v = excluded.v;
  perform t.as_user('H');

  -- a custom category, and a custom item inside it
  insert into public.category_groups (name, owner_id, sort_order) values ('Costumes', auth.uid(), 1000) returning id into grp;
  insert into public.categories (name, owner_id, group_id) values ('Dino costume', auth.uid(), grp) returning id into item;
  perform t.ok((select group_id from public.categories where id = item) = grp, 'a custom item can live in a custom category');
  -- and a custom item inside a built-in category
  insert into public.categories (name, owner_id, group_id) values ('Tutu', auth.uid(), (select id from public.category_groups where owner_id is null and name = 'Outfits'));
  perform t.ok((select count(*) from public.categories where owner_id = auth.uid()) = 2, 'a custom item can live in a built-in category');
  -- left without a category it goes to Other
  insert into public.categories (name, owner_id) values ('Mystery', auth.uid());
  perform t.ok((select g.name from public.categories c join public.category_groups g on g.id = c.group_id where c.name = 'Mystery') = 'Other', 'no category means Other');

  perform t.fails($q$insert into public.category_groups (name, owner_id) values ('sleep', auth.uid())$q$, 'a custom category cannot copy a built-in one', '23505');
  perform t.fails($q$insert into public.category_groups (name, owner_id) values ('COSTUMES', auth.uid())$q$, 'a person cannot repeat a category name', '23505');
  perform t.fails($q$insert into public.category_groups (name, owner_id) values ('  ', auth.uid())$q$, 'a blank category name is rejected', '23514');
  perform t.fails($q$insert into public.category_groups (name, owner_id) values ('Sneaky', null)$q$, 'a person cannot create a built-in category', '42501');
  perform t.ok(t.affected($q$update public.category_groups set name = 'Hacked' where owner_id is null$q$) = 0, 'built-in category rename matches no rows');
  perform t.ok(t.affected($q$update public.category_groups set name = 'Dress-up' where owner_id = auth.uid()$q$) = 1, 'a custom category can be renamed');
  perform t.ok(t.affected($q$update public.categories set group_id = (select id from public.category_groups where name = 'Sleep' and owner_id is null) where name = 'Dino costume'$q$) = 1, 'a custom item can move to another category');

  -- another person's category is not usable
  reset role;
  insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-000000000009', 'i@example.com');
  insert into t.fx values ('I', 'ffffffff-0000-4000-8000-000000000009') on conflict (k) do update set v = excluded.v;
  perform t.as_user('I');
  perform t.ok((select count(*) from public.category_groups where owner_id is not null) = 0, 'another account never sees custom categories');
  perform t.fails(format($q$insert into public.categories (name, owner_id, group_id) values ('Sneak', auth.uid(), %L)$q$, grp), 'an item cannot go in someone else''s category', '22023');

  -- deleting a category removes its items, unless an item is in use
  reset role;
  perform t.as_user('H');
  insert into public.children (name) values ('Kid') returning id into c;
  insert into public.inventory_items (child_id, name, category_id) values (c, 'Wearing the tutu', (select id from public.categories where name = 'Tutu' and owner_id = auth.uid()));
  insert into public.category_groups (name, owner_id) values ('Empty', auth.uid()) returning id into other_grp;
  perform t.ok(t.affected(format($q$delete from public.category_groups where id = %L$q$, other_grp)) = 1, 'an empty custom category can be deleted');
  insert into public.categories (name, owner_id, group_id) values ('Used item', auth.uid(), grp);
  insert into public.inventory_items (child_id, name, category_id) values (c, 'In use', (select id from public.categories where name = 'Used item'));
  perform t.fails(format($q$delete from public.category_groups where id = %L$q$, grp), 'a category holding an item that is in use cannot be deleted', '23503');

  -- cap of 30 custom categories
  for i in 1..30 loop begin insert into public.category_groups (name, owner_id) values ('Cat ' || i, auth.uid()); exception when others then null; end; end loop;
  perform t.fails($q$insert into public.category_groups (name, owner_id) values ('One too many', auth.uid())$q$, 'the 31st custom category is rejected', '22023');
end $$;
select 'CATEGORY GROUP TESTS PASSED' as result;
