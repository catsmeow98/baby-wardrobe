-- Size forecast: length measurements per child, and a base size offset per brand.
-- Children already carry birth_date and growth_reference; item fit ratings already live on inventory_items.fit_feedback.

alter table public.brands
  add column size_offset numeric(4, 2) not null default 0 check (size_offset between -3 and 3);
comment on column public.brands.size_offset is
  'Inches added to the standard size chart. Positive means the brand runs large, so a taller child still fits.';

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  measured_on date not null,
  length_in numeric(5, 2) not null check (length_in between 10 and 60),
  created_at timestamptz not null default now()
);
create index measurements_child_idx on public.measurements (child_id, measured_on);

alter table public.measurements enable row level security;
create policy measurements_all on public.measurements for all to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));

grant select, insert, update, delete on public.measurements to authenticated;
