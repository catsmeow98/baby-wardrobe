-- Migration 17: a current size range on children.
\set ON_ERROR_STOP on

do $$
declare c uuid;
begin
  reset role;
  insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-00000000002a', 'r@example.com');
  insert into t.fx values ('R', 'ffffffff-0000-4000-8000-00000000002a') on conflict (k) do update set v = excluded.v;
  perform t.as_user('R');

  insert into public.children (name, current_size_id) values ('Range', t.size('3-6M')) returning id into c;
  perform t.ok((select current_size_to_id from public.children where id = c) is null, 'a single current size has no top');
  update public.children set current_size_to_id = t.size('6-9M') where id = c;
  perform t.ok((select current_size_to_id from public.children where id = c) = t.size('6-9M'), 'a range can be saved');
  update public.children set current_size_to_id = t.size('3-6M') where id = c;
  perform t.ok(true, 'a range of one size is allowed');
  perform t.fails(format($q$update public.children set current_size_to_id = %L where id = %L$q$, t.size('0-3M'), c), 'the top cannot be below the bottom', '23514');
  perform t.fails(format($q$insert into public.children (name, current_size_to_id) values ('No bottom', %L)$q$, t.size('6-9M')), 'a top needs a bottom', '23514');
  update public.children set current_size_to_id = null where id = c;
  perform t.ok((select current_size_to_id from public.children where id = c) is null, 'the range can go back to one size');
end $$;
select 'CURRENT SIZE RANGE TESTS PASSED' as result;
