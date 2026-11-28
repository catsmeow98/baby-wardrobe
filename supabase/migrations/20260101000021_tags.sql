-- Migration 21: tags. Free-text tags (season, holiday, condition, anything) shared by all of an account's children.
-- Condition, season and the fit override are no longer used by the app; their columns stay so older functions keep working.
-- Safe to run more than once.

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 30),
  created_at timestamptz not null default now()
);
create unique index if not exists tags_owner_name on public.tags (owner_id, lower(name));

create table if not exists public.item_tags (
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (item_id, tag_id)
);
create index if not exists item_tags_tag_idx on public.item_tags (tag_id);

alter table public.tags enable row level security;
alter table public.item_tags enable row level security;
drop policy if exists tags_all on public.tags;
create policy tags_all on public.tags for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists item_tags_all on public.item_tags;
create policy item_tags_all on public.item_tags for all to authenticated
  using (public.owns_item(item_id))
  with check (public.owns_item(item_id) and exists (select 1 from public.tags t where t.id = tag_id and t.owner_id = auth.uid()));
grant select, insert, update, delete on public.tags, public.item_tags to authenticated;

-- Replaces the tags on items: p_items is [{ "item": uuid, "tags": ["Christmas", "Hand-me-down"] }]. Tags are trimmed, matched
-- without regard to case (the first spelling stays), and made when new.
create or replace function public.set_item_tags(p_items jsonb)
returns void language plpgsql as $$
declare
  e jsonb;
  v_item uuid;
  v_name text;
  v_tag uuid;
begin
  for e in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_item := (e ->> 'item')::uuid;
    if not public.owns_item(v_item) then
      raise exception 'that item is not yours' using errcode = '42501';
    end if;
    delete from public.item_tags where item_id = v_item;
    for v_name in
      select distinct on (lower(n)) n from (
        select regexp_replace(btrim(x), '\s+', ' ', 'g') as n from jsonb_array_elements_text(coalesce(e -> 'tags', '[]'::jsonb)) x
      ) s where n <> '' order by lower(n)
    loop
      if length(v_name) > 30 then
        raise exception 'tags are at most 30 characters' using errcode = '22023';
      end if;
      select id into v_tag from public.tags where owner_id = auth.uid() and lower(name) = lower(v_name);
      if v_tag is null then
        insert into public.tags (owner_id, name) values (auth.uid(), v_name)
          on conflict (owner_id, lower(name)) do nothing returning id into v_tag;
        if v_tag is null then
          select id into v_tag from public.tags where owner_id = auth.uid() and lower(name) = lower(v_name);
        end if;
      end if;
      insert into public.item_tags (item_id, tag_id) values (v_item, v_tag) on conflict do nothing;
    end loop;
  end loop;
end $$;
revoke all on function public.set_item_tags(jsonb) from public;
grant execute on function public.set_item_tags(jsonb) to authenticated;

-- Renames a tag. Renaming it to the name of another tag merges the two.
create or replace function public.rename_tag(p_tag uuid, p_name text)
returns uuid language plpgsql as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_other uuid;
begin
  if not exists (select 1 from public.tags where id = p_tag and owner_id = auth.uid()) then
    raise exception 'that tag is not yours' using errcode = '42501';
  end if;
  if length(v_name) not between 1 and 30 then
    raise exception 'a tag is 1 to 30 characters' using errcode = '22023';
  end if;
  select id into v_other from public.tags where owner_id = auth.uid() and lower(name) = lower(v_name) and id <> p_tag;
  if v_other is null then
    update public.tags set name = v_name where id = p_tag;
    return p_tag;
  end if;
  insert into public.item_tags (item_id, tag_id) select item_id, v_other from public.item_tags where tag_id = p_tag on conflict do nothing;
  delete from public.tags where id = p_tag;
  return v_other;
end $$;
revoke all on function public.rename_tag(uuid, text) from public;
grant execute on function public.rename_tag(uuid, text) to authenticated;
