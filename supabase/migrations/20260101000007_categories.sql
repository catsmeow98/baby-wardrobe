-- Categories: singular names, individual items instead of "Outfits", "Outerwear" and "Accessories", a display group
-- for each category, and a few guard rails for custom categories (users already own theirs through row-level security).
--
-- Existing rows are renamed in place, so every item, goal and shopping entry that points at a category keeps pointing
-- at it. The three old catch-all categories stay as "Other outfit", "Other outerwear" and "Other accessory", which
-- keeps existing data valid and gives a home to anything the specific categories do not cover.

alter table public.categories add column if not exists grp text;

alter table public.categories drop constraint if exists categories_name_length;
alter table public.categories
  add constraint categories_name_length check (length(btrim(name)) between 1 and 60);

-- old name, new name, display group, order
drop table if exists category_plan;
create temporary table category_plan (old_name text, new_name text, grp text, ord int);
insert into category_plan values
  ('Short-sleeve bodysuits', 'Short-sleeve bodysuit', 'Bodysuits and tops', 1),
  ('Long-sleeve bodysuits',  'Long-sleeve bodysuit',  'Bodysuits and tops', 2),
  ('Tops',                   'Top',                  'Bodysuits and tops', 3),
  (null,                     'Sweater',              'Bodysuits and tops', 4),
  ('Bottoms',                'Pants',                'Bottoms', 5),
  (null,                     'Shorts',               'Bottoms', 6),
  (null,                     'Leggings',             'Bottoms', 7),
  ('Footy sleepers',         'Footy sleeper',        'Sleep', 8),
  ('Footless sleepers',      'Footless sleeper',     'Sleep', 9),
  (null,                     'Pajama set',           'Sleep', 10),
  (null,                     'Sleep gown',           'Sleep', 11),
  ('Other sleepwear',        'Other sleepwear',      'Sleep', 12),
  ('Sleep sacks',            'Sleep sack',           'Sleep', 13),
  ('Swaddles',               'Swaddle',              'Sleep', 14),
  (null,                     'Romper',               'Outfits', 15),
  (null,                     'Dress',                'Outfits', 16),
  (null,                     'Dress shirt',          'Outfits', 17),
  (null,                     'Dress pants',          'Outfits', 18),
  (null,                     'Matching set',         'Outfits', 19),
  ('Outfits',                'Other outfit',         'Outfits', 20),
  (null,                     'Coat',                 'Outerwear', 21),
  (null,                     'Light jacket',         'Outerwear', 22),
  (null,                     'Bunting',              'Outerwear', 23),
  (null,                     'Snowsuit',             'Outerwear', 24),
  ('Outerwear',              'Other outerwear',      'Outerwear', 25),
  (null,                     'Socks',                'Accessories', 26),
  (null,                     'Hat',                  'Accessories', 27),
  (null,                     'Mittens',              'Accessories', 28),
  (null,                     'Bib',                  'Accessories', 29),
  ('Accessories',            'Other accessory',      'Accessories', 30),
  ('Footwear',               'Shoes',                'Footwear', 31),
  (null,                     'Boots',                'Footwear', 32),
  ('Swimwear',               'Swimsuit',             'Swim', 33),
  (null,                     'Rash guard',           'Swim', 34);

update public.categories c
set name = p.new_name, grp = p.grp, sort_order = p.ord
from category_plan p
where c.owner_id is null and c.name = p.old_name;

insert into public.categories (name, grp, sort_order)
select p.new_name, p.grp, p.ord
from category_plan p
where not exists (select 1 from public.categories c where c.owner_id is null and lower(c.name) = lower(p.new_name));

drop table category_plan;

-- Custom categories: a name cannot copy a built-in one, and each person can have up to 60.
create or replace function public.check_custom_category() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null then
    if exists (select 1 from public.categories c where c.owner_id is null and lower(btrim(c.name)) = lower(btrim(new.name))) then
      raise exception 'That name is already a built-in category.' using errcode = '23505';
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.categories c where c.owner_id = new.owner_id) >= 60 then
      raise exception 'You can have up to 60 custom categories.' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists categories_check_custom on public.categories;
create trigger categories_check_custom before insert or update of name on public.categories
  for each row execute function public.check_custom_category();
