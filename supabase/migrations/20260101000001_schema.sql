-- Baby Wardrobe: core schema (build plan phases 1 to 4).
-- Forecast tables (measurements, brand size charts, forecasts) arrive with phase 6.
-- Deviation from the spec: inventory_items.label_id points at size_labels (the exact tag text, such as "9M"),
-- while fit ranges and goals point at sizes (the grouped size, such as 6-9M / 9M).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.size_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users (id) on delete cascade, -- null = shared default
  created_at timestamptz not null default now()
);

create table public.sizes (
  id uuid primary key default gen_random_uuid(),
  size_system_id uuid not null references public.size_systems (id) on delete cascade,
  label text not null,        -- canonical group label, for example "6-9M"
  alias text,                 -- the equal single size, for example "9M"
  sort_order int not null,
  unique (size_system_id, sort_order),
  unique (size_system_id, label)
);

create table public.size_labels (
  id uuid primary key default gen_random_uuid(),
  size_id uuid not null references public.sizes (id) on delete cascade,
  label text not null,        -- exact text printed on a tag
  sort_order int not null default 0,
  unique (size_id, label)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.categories (id) on delete set null,
  owner_id uuid references auth.users (id) on delete cascade, -- null = shared default
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index categories_unique_name on public.categories
  (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  chart_source text,
  active boolean not null default true,
  owner_id uuid references auth.users (id) on delete cascade, -- null = curated brand
  created_at timestamptz not null default now()
);
create unique index brands_unique_name on public.brands
  (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table public.children (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  birth_date date,            -- optional; only needed for forecasts
  growth_reference text check (growth_reference in ('girls', 'boys')),
  size_system_id uuid not null default '00000000-0000-4000-8000-000000000001'
    references public.size_systems (id),
  current_size_id uuid references public.sizes (id),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index children_owner_idx on public.children (owner_id);

create table public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index storage_locations_unique on public.storage_locations (child_id, lower(name));

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  tracking_type text not null default 'individual' check (tracking_type in ('individual', 'grouped')),
  name text not null check (length(btrim(name)) between 1 and 160),
  description text,
  brand_id uuid references public.brands (id) on delete set null,
  category_id uuid not null references public.categories (id),
  label_id uuid references public.size_labels (id),
  fit_from_size_id uuid references public.sizes (id),
  fit_to_size_id uuid references public.sizes (id),
  quantity int not null default 1 check (quantity between 1 and 999),
  condition text not null default 'good' check (condition in ('new', 'like_new', 'good', 'worn', 'unusable')),
  season text not null default 'year_round' check (season in ('year_round', 'spring', 'summer', 'fall', 'winter')),
  status text not null default 'active' check (status in ('active', 'stored', 'outgrown', 'donated', 'sold')),
  fit_override text check (fit_override in ('fits', 'notyet', 'small', 'outgrown')),
  fit_feedback smallint check (fit_feedback in (-1, 0, 1)), -- -1 ran small, 0 true to size, 1 ran large
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint individual_is_one check (tracking_type = 'grouped' or quantity = 1),
  constraint fit_range_complete check ((fit_from_size_id is null) = (fit_to_size_id is null))
);
create index inventory_items_child_idx on public.inventory_items (child_id, status);
create index inventory_items_category_idx on public.inventory_items (child_id, category_id);

create table public.inventory_photos (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  storage_path text not null,  -- {user_id}/{child_id}/{file}; the bucket is private
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index inventory_photos_item_idx on public.inventory_photos (inventory_item_id);

create table public.inventory_storage (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  storage_location_id uuid not null references public.storage_locations (id) on delete cascade,
  quantity int not null check (quantity > 0),
  unique (inventory_item_id, storage_location_id)
);

create table public.wardrobe_goals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  size_id uuid not null references public.sizes (id),
  target_quantity int not null check (target_quantity between 0 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, category_id, size_id)
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  size_id uuid not null references public.sizes (id),
  quantity_needed int not null default 1 check (quantity_needed >= 1),
  quantity_ordered int not null default 0 check (quantity_ordered >= 0),
  quantity_received int not null default 0 check (quantity_received >= 0),
  status text not null default 'needed'
    check (status in ('needed', 'ordered', 'partially_received', 'received', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  estimated_price numeric(10, 2) check (estimated_price >= 0),
  product_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint received_within_ordered check (quantity_received <= quantity_ordered)
);
create index shopping_items_child_idx on public.shopping_items (child_id, status);

create table public.shopping_receipts (
  id uuid primary key default gen_random_uuid(),
  shopping_item_id uuid not null references public.shopping_items (id) on delete cascade,
  inventory_item_id uuid references public.inventory_items (id) on delete set null,
  quantity_received int not null check (quantity_received > 0),
  received_at timestamptz not null default now()
);
create index shopping_receipts_item_idx on public.shopping_receipts (shopping_item_id);

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger children_updated before update on public.children for each row execute function public.set_updated_at();
create trigger inventory_items_updated before update on public.inventory_items for each row execute function public.set_updated_at();
create trigger wardrobe_goals_updated before update on public.wardrobe_goals for each row execute function public.set_updated_at();
create trigger shopping_items_updated before update on public.shopping_items for each row execute function public.set_updated_at();

-- Sizes must belong to the child's size system and be in order. These run as the function owner so they can
-- read sizes and children regardless of the caller's row-level security.
create function public.size_in_system(p_size uuid, p_system uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sizes s where s.id = p_size and s.size_system_id = p_system)
$$;

create function public.check_child_sizes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.current_size_id is not null and not public.size_in_system(new.current_size_id, new.size_system_id) then
    raise exception 'current size is not part of the child''s size system' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger children_check_sizes before insert or update on public.children
  for each row execute function public.check_child_sizes();

create function public.check_item_sizes() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_system uuid;
  v_from int;
  v_to int;
begin
  select size_system_id into v_system from public.children where id = new.child_id;
  if new.fit_from_size_id is not null then
    select sort_order into v_from from public.sizes where id = new.fit_from_size_id and size_system_id = v_system;
    select sort_order into v_to from public.sizes where id = new.fit_to_size_id and size_system_id = v_system;
    if v_from is null or v_to is null then
      raise exception 'fit range sizes must belong to the child''s size system' using errcode = '23514';
    end if;
    if v_from > v_to then
      raise exception 'fit range must run from a smaller size to a larger or equal size' using errcode = '23514';
    end if;
  end if;
  if new.label_id is not null and not exists (
    select 1 from public.size_labels l join public.sizes s on s.id = l.size_id
    where l.id = new.label_id and s.size_system_id = v_system) then
    raise exception 'tag size must belong to the child''s size system' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger inventory_items_check_sizes before insert or update on public.inventory_items
  for each row execute function public.check_item_sizes();

create function public.check_goal_size() returns trigger language plpgsql security definer set search_path = public as $$
declare v_system uuid;
begin
  select size_system_id into v_system from public.children where id = new.child_id;
  if not public.size_in_system(new.size_id, v_system) then
    raise exception 'size must belong to the child''s size system' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger wardrobe_goals_check_size before insert or update on public.wardrobe_goals
  for each row execute function public.check_goal_size();
create trigger shopping_items_check_size before insert or update on public.shopping_items
  for each row execute function public.check_goal_size();

create function public.check_inventory_storage() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select child_id from public.inventory_items where id = new.inventory_item_id)
     is distinct from (select child_id from public.storage_locations where id = new.storage_location_id) then
    raise exception 'storage location belongs to a different child' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger inventory_storage_check before insert or update on public.inventory_storage
  for each row execute function public.check_inventory_storage();

-- New accounts get a profile row.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
