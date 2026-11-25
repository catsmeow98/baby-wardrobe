-- Two levels: a CATEGORY (Sleep, Outerwear, ...) holds ITEMS (Sleep sack, Coat, ...). Until now the item list lived in
-- public.categories with a text label for its group. This makes the group a real table so people can add their own
-- categories as well as their own items. Existing data is kept. Safe to run more than once.

create table if not exists public.category_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade, -- null for the built-in categories
  name text not null check (length(btrim(name)) between 1 and 60),
  sort_order int not null default 1000,
  created_at timestamptz not null default now()
);
create unique index if not exists category_groups_name_unique
  on public.category_groups (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

alter table public.category_groups enable row level security;
drop policy if exists category_groups_select on public.category_groups;
create policy category_groups_select on public.category_groups for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
drop policy if exists category_groups_write on public.category_groups;
create policy category_groups_write on public.category_groups for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update, delete on public.category_groups to authenticated;

-- Built-in categories, taken from the group labels already on the items, in the order they first appear.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'categories' and column_name = 'grp') then
    insert into public.category_groups (name, sort_order)
    select g, (row_number() over (order by m))::int * 10
    from (select grp as g, min(sort_order) as m from public.categories where owner_id is null and grp is not null group by grp) s
    on conflict do nothing;
  end if;
end $$;
-- Where a custom item has no category yet, it goes here.
insert into public.category_groups (name, sort_order) values ('Other', 900) on conflict do nothing;

alter table public.categories add column if not exists group_id uuid references public.category_groups (id) on delete cascade;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'categories' and column_name = 'grp') then
    update public.categories c set group_id = g.id
    from public.category_groups g
    where c.group_id is null and g.owner_id is null and lower(g.name) = lower(coalesce(c.grp, 'Other'));
  end if;
end $$;
update public.categories c set group_id = (select id from public.category_groups where owner_id is null and name = 'Other')
where c.group_id is null;

alter table public.categories alter column group_id set not null;
alter table public.categories drop column if exists grp;
create index if not exists categories_group_idx on public.categories (group_id);

-- Items: a custom item needs a category it can see (a built-in one, or the person's own); names cannot copy built-in
-- items; and each person can have up to 60 custom items.
create or replace function public.check_custom_category() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null then
    if new.group_id is null then
      select id into new.group_id from public.category_groups where owner_id is null and name = 'Other';
    end if;
    if not exists (select 1 from public.category_groups g where g.id = new.group_id and (g.owner_id is null or g.owner_id = new.owner_id)) then
      raise exception 'That category is not available.' using errcode = '22023';
    end if;
    if exists (select 1 from public.categories c where c.owner_id is null and lower(btrim(c.name)) = lower(btrim(new.name))) then
      raise exception 'That name is already a built-in item.' using errcode = '23505';
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.categories c where c.owner_id = new.owner_id) >= 60 then
      raise exception 'You can have up to 60 custom items.' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists categories_check_custom on public.categories;
create trigger categories_check_custom before insert or update of name, group_id on public.categories
  for each row execute function public.check_custom_category();

-- Categories: a custom name cannot copy a built-in one, and each person can have up to 30.
create or replace function public.check_custom_group() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null then
    if exists (select 1 from public.category_groups g where g.owner_id is null and lower(btrim(g.name)) = lower(btrim(new.name))) then
      raise exception 'That name is already a built-in category.' using errcode = '23505';
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.category_groups g where g.owner_id = new.owner_id) >= 30 then
      raise exception 'You can have up to 30 custom categories.' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists category_groups_check_custom on public.category_groups;
create trigger category_groups_check_custom before insert or update of name on public.category_groups
  for each row execute function public.check_custom_group();
