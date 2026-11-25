-- Per-user edits of built-in item types and categories, and the item gender field.
\set ON_ERROR_STOP on

do $$
declare c uuid; me uuid; grp uuid; mine uuid;
begin
  reset role;
  insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-00000000000a', 'j@example.com'), ('ffffffff-0000-4000-8000-00000000000b', 'k@example.com');
  insert into t.fx values ('J', 'ffffffff-0000-4000-8000-00000000000a'), ('K', 'ffffffff-0000-4000-8000-00000000000b') on conflict (k) do update set v = excluded.v;

  perform t.as_user('J');
  me := auth.uid();
  -- rename, move and hide a built-in item type for this person only
  insert into public.user_category_prefs (owner_id, category_id, name) values (me, t.cat('Sleep sack'), 'Wearable blanket');
  insert into public.user_category_prefs (owner_id, category_id, group_id, hidden) values (me, t.cat('Bib'), (select id from public.category_groups where owner_id is null and name = 'Outfits'), true);
  insert into public.user_group_prefs (owner_id, group_id, name) values (me, (select id from public.category_groups where owner_id is null and name = 'Sleep'), 'Bedtime');
  perform t.ok((select count(*) from public.user_category_prefs) = 2, 'a person can keep prefs for built-in item types');
  perform t.ok((select name from public.categories where id = t.cat('Sleep sack')) = 'Sleep sack', 'the shared item type itself is unchanged');
  perform t.ok(t.affected($q$update public.categories set name = 'Hacked' where owner_id is null$q$) = 0, 'a person still cannot edit shared item types');

  -- a prefs row cannot belong to someone else
  perform t.fails(format($q$insert into public.user_category_prefs (owner_id, category_id, name) values (%L, %L, 'x')$q$, (select v from t.fx where k = 'K'), t.cat('Coat')), 'prefs cannot be written for another account', '42501');
  perform t.fails(format($q$insert into public.user_category_prefs (owner_id, category_id, name) values (%L, %L, '')$q$, me, t.cat('Coat')), 'a blank name is rejected', '23514');

  -- moving into another person's custom category is refused
  reset role; perform t.as_user('K');
  insert into public.category_groups (name, owner_id) values ('K only', auth.uid()) returning id into grp;
  reset role; perform t.as_user('J');
  perform t.fails(format($q$insert into public.user_category_prefs (owner_id, category_id, group_id) values (auth.uid(), %L, %L)$q$, t.cat('Coat'), grp), 'cannot move an item type into someone else''s category', '42501');

  -- privacy
  reset role; perform t.as_user('K');
  perform t.ok((select count(*) from public.user_category_prefs) = 0 and (select count(*) from public.user_group_prefs) = 0, 'another account sees none of these prefs');

  -- restoring defaults is deleting the rows
  reset role; perform t.as_user('J');
  perform t.ok(t.affected($q$delete from public.user_category_prefs$q$) = 2, 'restoring defaults removes the prefs');

  -- gender
  insert into public.children (name) values ('Kid') returning id into c;
  insert into public.inventory_items (child_id, name, category_id, gender) values (c, 'Blue romper', t.cat('Romper'), 'boy');
  perform t.ok((select gender from public.inventory_items where child_id = c) = 'boy', 'gender is stored');
  perform t.ok(t.affected(format($q$update public.inventory_items set gender = null where child_id = %L$q$, c)) = 1, 'gender can be cleared');
  perform t.fails(format($q$update public.inventory_items set gender = 'robot' where child_id = %L$q$, c), 'an unknown gender is rejected', '23514');
end $$;
select 'PREFS AND GENDER TESTS PASSED' as result;
