-- Item form: the daycare status, the custom tag column, and goals counting daycare spares.
\set ON_ERROR_STOP on

do $$
declare c uuid;
begin
  reset role;
  insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-000000000007', 'g@example.com');
  insert into t.fx values ('G', 'ffffffff-0000-4000-8000-000000000007') on conflict (k) do update set v = excluded.v;
  perform t.as_user('G');
  insert into public.children (name) values ('Kid') returning id into c;

  insert into public.inventory_items (child_id, tracking_type, name, category_id, quantity, status, fit_from_size_id, fit_to_size_id)
    values (c, 'grouped', 'Spare outfits', t.cat('Romper'), 2, 'daycare', t.size('6-9M'), t.size('6-9M'));
  perform t.ok(true, 'daycare status is accepted');
  perform t.fails($q$update public.inventory_items set status = 'lost'$q$, 'an unknown status is rejected', '23514');

  insert into public.wardrobe_goals (child_id, category_id, size_id, target_quantity) values (c, t.cat('Romper'), t.size('6-9M'), 5);
  perform t.ok((select owned from public.goal_progress where child_id = c) = 2, 'daycare spares count as owned');
  perform t.ok((select remaining from public.goal_progress where child_id = c) = 3, 'and reduce what is still needed');

  update public.inventory_items set condition = 'unusable' where child_id = c;
  perform t.ok((select owned from public.goal_progress where child_id = c) = 0, 'unusable daycare spares do not count');
  update public.inventory_items set condition = 'good', status = 'donated' where child_id = c;
  perform t.ok((select owned from public.goal_progress where child_id = c) = 0, 'donated pieces do not count');

  update public.inventory_items set status = 'active', custom_tag = '6-12M' where child_id = c;
  perform t.ok((select custom_tag from public.inventory_items where child_id = c) = '6-12M', 'a custom tag is stored');
  perform t.fails(format($q$update public.inventory_items set custom_tag = %L$q$, repeat('x', 21)), 'a custom tag over 20 characters is rejected', '23514');
  perform t.fails($q$update public.inventory_items set custom_tag = '  '$q$, 'a blank custom tag is rejected', '23514');

  reset role;
  perform t.as_user('D');
  perform t.ok((select count(*) from public.goal_progress) = 0, 'another account never sees these goals');
end $$;
select 'ITEM FORM TESTS PASSED' as result;
