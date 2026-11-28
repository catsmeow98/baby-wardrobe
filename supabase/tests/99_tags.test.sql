-- Migration 21: tags shared across an account's children, set per item, renamed and merged.
\set ON_ERROR_STOP on

do $$
declare c1 uuid; c2 uuid; a uuid; b uuid; x uuid; t1 uuid; t2 uuid; n int;
begin
  reset role;
  insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-00000000006a', 'tg@example.com'), ('ffffffff-0000-4000-8000-00000000006b', 'tg2@example.com');
  insert into t.fx values ('TG', 'ffffffff-0000-4000-8000-00000000006a'), ('TG2', 'ffffffff-0000-4000-8000-00000000006b') on conflict (k) do update set v = excluded.v;
  perform t.as_user('TG');
  insert into public.children (name, current_size_id) values ('Tag kid 1', t.size('0-3M')) returning id into c1;
  insert into public.children (name, current_size_id) values ('Tag kid 2', t.size('0-3M')) returning id into c2;
  insert into public.inventory_items (child_id, name, category_id) values (c1, 'Red onesie', t.cat('Pants')) returning id into a;
  insert into public.inventory_items (child_id, name, category_id) values (c2, 'Elf pajamas', t.cat('Pants')) returning id into b;

  perform public.set_item_tags(jsonb_build_array(
    jsonb_build_object('item', a, 'tags', jsonb_build_array(' Christmas ', 'christmas', 'Hand-me-down')),
    jsonb_build_object('item', b, 'tags', jsonb_build_array('CHRISTMAS', 'Winter  wear'))));
  perform t.ok((select count(*) from public.tags) = 3, 'one tag per name, shared by both children');
  perform t.ok((select count(*) from public.item_tags where item_id = a) = 2, 'duplicates on an item count once');
  perform t.ok(exists (select 1 from public.tags where name = 'Winter wear'), 'spaces are tidied');
  -- Setting again replaces.
  perform public.set_item_tags(jsonb_build_array(jsonb_build_object('item', a, 'tags', jsonb_build_array('Summer'))));
  perform t.ok((select array_agg(t.name) from public.item_tags it join public.tags t on t.id = it.tag_id where it.item_id = a) = array['Summer'], 'tags are replaced');
  perform t.fails(format($q$select public.set_item_tags(%L::jsonb)$q$, jsonb_build_array(jsonb_build_object('item', a, 'tags', jsonb_build_array(repeat('x', 31))))),
    'long tags are refused', '22023');

  -- Rename, and merge into an existing tag.
  select id into t1 from public.tags where name = 'Winter wear';
  perform t.ok(public.rename_tag(t1, 'Winter') = t1, 'a rename keeps the tag');
  perform public.set_item_tags(jsonb_build_array(jsonb_build_object('item', a, 'tags', jsonb_build_array('Summer', 'Cold'))));
  select id into t2 from public.tags where name = 'Cold';
  perform t.ok(public.rename_tag(t2, 'winter') = t1, 'renaming onto another name merges');
  perform t.ok((select count(*) from public.item_tags where tag_id = t1) = 2, 'both items now have Winter');
  perform t.ok(not exists (select 1 from public.tags where id = t2), 'the merged tag is gone');

  -- Another account sees none of it and cannot tag these items.
  perform t.as_user('TG2');
  select count(*) into n from public.tags;
  perform t.ok(n = 0, 'tags are private to the account');
  perform t.fails(format($q$select public.set_item_tags(%L::jsonb)$q$, jsonb_build_array(jsonb_build_object('item', a, 'tags', jsonb_build_array('Mine')))),
    'cannot tag another account''s item', '42501');
  perform t.fails(format($q$select public.rename_tag(%L, 'x')$q$, t1), 'cannot rename another account''s tag', '42501');

  -- Deleting an item or a tag removes its links.
  perform t.as_user('TG');
  delete from public.tags where id = t1;
  perform t.ok((select count(*) from public.item_tags where tag_id = t1) = 0 and (select count(*) from public.item_tags where item_id = b) = 1, 'deleting a tag unlinks only it');
end $$;

select 'TAGS TESTS PASSED' as result;
