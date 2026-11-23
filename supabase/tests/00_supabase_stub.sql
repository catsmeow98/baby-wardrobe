-- Minimal stand-ins for the parts of Supabase that the migrations rely on. For local test runs only.
create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant select on auth.users to authenticated;

create schema if not exists storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
                              name text not null, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/') $$;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
