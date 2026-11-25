-- 1. Per-account settings: whether photo backgrounds are removed, and the person's location for local weather.
-- 2. An optional color on closet items.
-- 3. Outfits: a named set of closet items for one child. Items can be in many outfits. Not counted in goals.
-- Safe to run more than once.

create table if not exists public.user_settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  remove_background boolean not null default true,
  place_name text check (place_name is null or length(btrim(place_name)) between 1 and 120),
  -- Rounded to 0.01 degrees (about 1 km). The postal code the person typed is not kept.
  latitude numeric(5, 2) check (latitude between -90 and 90),
  longitude numeric(5, 2) check (longitude between -180 and 180),
  -- How each calendar month feels at that place, January first: cold, cool, mild or warm.
  month_classes text[] check (month_classes is null or (array_length(month_classes, 1) = 12 and month_classes <@ array['cold', 'cool', 'mild', 'warm'])),
  updated_at timestamptz not null default now(),
  check ((place_name is null) = (month_classes is null))
);
alter table public.user_settings enable row level security;
drop policy if exists user_settings_all on public.user_settings;
create policy user_settings_all on public.user_settings for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update, delete on public.user_settings to authenticated;

alter table public.inventory_items add column if not exists color text;
alter table public.inventory_items drop constraint if exists inventory_items_color_check;
alter table public.inventory_items add constraint inventory_items_color_check check (
  color is null or color in ('white', 'black', 'gray', 'cream', 'brown', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'navy', 'purple', 'multicolor'));

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists outfits_child_idx on public.outfits (child_id, created_at desc);

create table if not exists public.outfit_items (
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  sort_order int not null default 0,
  primary key (outfit_id, item_id)
);
create index if not exists outfit_items_item_idx on public.outfit_items (item_id);

create or replace function public.owns_outfit(p_outfit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.outfits o where o.id = p_outfit and public.owns_child(o.child_id))
$$;

alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
drop policy if exists outfits_all on public.outfits;
create policy outfits_all on public.outfits for all to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));

-- An outfit may only hold items of its own child.
drop policy if exists outfit_items_all on public.outfit_items;
create policy outfit_items_all on public.outfit_items for all to authenticated
  using (public.owns_outfit(outfit_id))
  with check (
    public.owns_outfit(outfit_id)
    and exists (select 1 from public.outfits o join public.inventory_items i on i.child_id = o.child_id where o.id = outfit_id and i.id = item_id));

grant select, insert, update, delete on public.outfits, public.outfit_items to authenticated;

create or replace function public.outfit_items_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.outfit_items where outfit_id = new.outfit_id) >= 12 then
    raise exception 'An outfit can hold up to 12 items' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists outfit_items_limit on public.outfit_items;
create trigger outfit_items_limit before insert on public.outfit_items for each row execute function public.outfit_items_limit();
