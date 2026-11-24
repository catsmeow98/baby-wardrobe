-- Forecast tables: measurements are private to the child's owner, and brand offsets are bounded.
-- Runs after 10_rls_and_rules.test.sql in the same database and reuses its helpers.
\set ON_ERROR_STOP on

do $$
declare cF uuid; cG uuid; b uuid;
begin
  reset role;
  insert into auth.users (id, email) values ('cccccccc-0000-4000-8000-000000000003', 'c@example.com'),
                                            ('dddddddd-0000-4000-8000-000000000004', 'd@example.com');
  insert into t.fx values ('C', 'cccccccc-0000-4000-8000-000000000003'), ('D', 'dddddddd-0000-4000-8000-000000000004')
  on conflict (k) do update set v = excluded.v;

  perform t.as_user('C');
  insert into public.children (name, birth_date, growth_reference) values ('Fern', '2026-01-01', 'girls') returning id into cF;
  insert into public.measurements (child_id, measured_on, length_in) values (cF, '2026-07-01', 26.5);
  perform t.ok((select count(*) from public.measurements) = 1, 'owner sees their measurement');
  perform t.fails(format($q$insert into public.measurements (child_id, measured_on, length_in) values (%L, '2026-07-01', 5)$q$, cF),
    'a length of 5 inches is rejected', '23514');
  insert into public.brands (name, owner_id, size_offset) values ('Offset Co', t.fxv('C'), 1.25) returning id into b;
  perform t.fails(format($q$update public.brands set size_offset = 9 where id = %L$q$, b), 'an offset of 9 inches is rejected', '23514');

  reset role;
  perform t.as_user('D');
  insert into public.children (name) values ('Other') returning id into cG;
  perform t.ok((select count(*) from public.measurements) = 0, 'D cannot see C''s measurements');
  perform t.fails(format($q$insert into public.measurements (child_id, measured_on, length_in) values (%L, '2026-07-02', 27)$q$, cF),
    'D cannot add a measurement to C''s child', '42501');
  perform t.ok(t.affected(format($q$delete from public.measurements where child_id = %L$q$, cF)) = 0, 'D cannot delete C''s measurements');
  perform t.ok(t.affected(format($q$update public.brands set size_offset = 0 where id = %L$q$, b)) = 0, 'D cannot change C''s brand offset');
  perform t.ok((select count(*) from public.brands where name = 'Offset Co') = 0, 'D cannot see C''s brand');

  reset role;
  delete from auth.users where id = t.fxv('C');
  perform t.ok((select count(*) from public.measurements) = 0, 'measurements are removed with the account');
end $$;

-- delete_my_account: removes only the caller, and only when signed in.
do $$
declare cD uuid;
begin
  reset role;
  insert into auth.users (id, email) values ('eeeeeeee-0000-4000-8000-000000000005', 'e@example.com');
  insert into t.fx values ('E', 'eeeeeeee-0000-4000-8000-000000000005') on conflict (k) do update set v = excluded.v;

  perform t.as_user('D');
  insert into public.children (name) values ('Doomed') returning id into cD;
  reset role;

  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  perform t.fails('select public.delete_my_account()', 'signed-out users cannot delete accounts', '42501');
  reset role;

  perform t.as_user('D');
  perform public.delete_my_account();
  reset role;
  perform t.ok((select count(*) from auth.users where id = t.fxv('D')) = 0, 'the caller is deleted');
  perform t.ok((select count(*) from public.children where id = cD) = 0, 'their children are deleted with them');
  perform t.ok((select count(*) from auth.users where id = t.fxv('E')) = 1, 'other accounts are untouched');
end $$;

select 'FORECAST TESTS PASSED' as result;
