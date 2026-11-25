-- 1. Per-user changes to the built-in item categories and item types. The built-ins stay shared and unchanged. A row here
--    renames one for one person, moves an item type to another item category, or hides it. Deleting the row restores it.
-- 2. An optional gender on closet items: boy, girl or neutral.
-- Safe to run more than once.

create table if not exists public.user_group_prefs (
  owner_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid not null references public.category_groups (id) on delete cascade,
  name text check (name is null or length(btrim(name)) between 1 and 60),
  hidden boolean not null default false,
  primary key (owner_id, group_id)
);

create table if not exists public.user_category_prefs (
  owner_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  name text check (name is null or length(btrim(name)) between 1 and 60),
  group_id uuid references public.category_groups (id) on delete cascade, -- moved to this item category
  hidden boolean not null default false,
  primary key (owner_id, category_id)
);

alter table public.user_group_prefs enable row level security;
alter table public.user_category_prefs enable row level security;

drop policy if exists user_group_prefs_all on public.user_group_prefs;
create policy user_group_prefs_all on public.user_group_prefs for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- A moved item type must go to an item category the person can see (a built-in one or their own).
drop policy if exists user_category_prefs_all on public.user_category_prefs;
create policy user_category_prefs_all on public.user_category_prefs for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (group_id is null or exists (select 1 from public.category_groups g where g.id = group_id)));

grant select, insert, update, delete on public.user_group_prefs, public.user_category_prefs to authenticated;

alter table public.inventory_items add column if not exists gender text;
alter table public.inventory_items drop constraint if exists inventory_items_gender_check;
alter table public.inventory_items add constraint inventory_items_gender_check check (gender is null or gender in ('boy', 'girl', 'neutral'));
