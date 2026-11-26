-- Item types update.
--  * New built-in item types: Long-sleeve top, Skirt, Long-sleeve dress, Long overalls, Short overalls, Cardigan, Pullover / hoodie.
--  * "Top" is now "Short-sleeve top". Sweater moves to Outerwear, Dress shirt to Bodysuits and tops, Dress pants to Bottoms.
--  * The four "Other ..." built-ins are retired. A person who still has items, goals or shopping entries on one gets an
--    item type of their own with the same name in the same item category, so nothing is lost.
--  * A person's own item type (or a renamed built-in) that matches a new built-in, such as "Cardigan", is merged into it:
--    their items, goals and shopping entries move over, and goals for the same size are merged (the larger number is kept).
--  * Account setting for the setup guide: when the person dismissed it.
-- Safe to run more than once.

alter table public.user_settings add column if not exists setup_dismissed_at timestamptz;

-- The final built-in list: name, item category, order. old_name is the name to rename from, when there is one.
drop table if exists plan12;
create temporary table plan12 (name text, grp text, ord int, old_name text);
insert into plan12 values
  ('Short-sleeve bodysuit', 'Bodysuits and tops', 1, null),
  ('Long-sleeve bodysuit',  'Bodysuits and tops', 2, null),
  ('Short-sleeve top',      'Bodysuits and tops', 3, 'Top'),
  ('Long-sleeve top',       'Bodysuits and tops', 4, null),
  ('Dress shirt',           'Bodysuits and tops', 5, null),
  ('Pants',                 'Bottoms', 6, null),
  ('Shorts',                'Bottoms', 7, null),
  ('Leggings',              'Bottoms', 8, null),
  ('Skirt',                 'Bottoms', 9, null),
  ('Dress pants',           'Bottoms', 10, null),
  ('Footy sleeper',         'Sleep', 11, null),
  ('Footless sleeper',      'Sleep', 12, null),
  ('Pajama set',            'Sleep', 13, null),
  ('Sleep gown',            'Sleep', 14, null),
  ('Sleep sack',            'Sleep', 15, null),
  ('Swaddle',               'Sleep', 16, null),
  ('Romper',                'Outfits', 17, null),
  ('Dress',                 'Outfits', 18, null),
  ('Long-sleeve dress',     'Outfits', 19, null),
  ('Long overalls',         'Outfits', 20, null),
  ('Short overalls',        'Outfits', 21, null),
  ('Matching set',          'Outfits', 22, null),
  ('Sweater',               'Outerwear', 23, null),
  ('Cardigan',              'Outerwear', 24, null),
  ('Pullover / hoodie',     'Outerwear', 25, null),
  ('Coat',                  'Outerwear', 26, null),
  ('Light jacket',          'Outerwear', 27, null),
  ('Bunting',               'Outerwear', 28, null),
  ('Snowsuit',              'Outerwear', 29, null),
  ('Socks',                 'Accessories', 30, null),
  ('Hat',                   'Accessories', 31, null),
  ('Mittens',               'Accessories', 32, null),
  ('Bib',                   'Accessories', 33, null),
  ('Shoes',                 'Footwear', 34, null),
  ('Boots',                 'Footwear', 35, null),
  ('Swimsuit',              'Swim', 36, null),
  ('Rash guard',            'Swim', 37, null);

-- 1. Rename Top.
update public.categories c set name = p.name
from plan12 p
where p.old_name is not null and c.owner_id is null and c.name = p.old_name
  and not exists (select 1 from public.categories x where x.owner_id is null and lower(x.name) = lower(p.name));

-- 2. Add the new built-ins, then place and order every built-in.
insert into public.categories (name, group_id, sort_order)
select p.name, g.id, p.ord
from plan12 p
join public.category_groups g on g.owner_id is null and g.name = p.grp
where not exists (select 1 from public.categories c where c.owner_id is null and lower(c.name) = lower(p.name));

update public.categories c set group_id = g.id, sort_order = p.ord
from plan12 p, public.category_groups g
where c.owner_id is null and c.name = p.name and g.owner_id is null and g.name = p.grp;

-- A person's own rename that now matches the built-in name adds nothing.
update public.user_category_prefs u set name = null
from public.categories c
where u.category_id = c.id and c.owner_id is null and lower(btrim(u.name)) = lower(c.name);

-- 3. Move map: for one person, everything on item type "from" belongs on built-in "to".
drop table if exists move12;
create temporary table move12 (owner_id uuid not null, from_id uuid not null, to_id uuid not null, custom boolean not null, primary key (owner_id, from_id));

drop table if exists alias12;
create temporary table alias12 (target text, pattern text);
insert into alias12 values
  ('Long-sleeve top',   '^long[- ]?sleeved?\s+(top|shirt|tee)s?$'),
  ('Skirt',             '^skirts?$'),
  ('Long-sleeve dress', '^long[- ]?sleeved?\s+dress(es)?$'),
  ('Long overalls',     '^(long\s+overalls?|overalls?\W+long\W*)$'),
  ('Short overalls',    '^(short\s+overalls?|overalls?\W+short\W*)$'),
  ('Cardigan',          '^cardigans?$'),
  ('Pullover / hoodie', '^(pullovers?|hoodies?|pullover\s*(/|and|&)\s*hoodie|hooded\s+sweatshirt)$');

-- 3a. A person's own item types with a matching name.
insert into move12
select c.owner_id, c.id, b.id, true
from public.categories c
join alias12 a on btrim(c.name) ~* a.pattern
join public.categories b on b.owner_id is null and b.name = a.target
where c.owner_id is not null;

-- 3b. A built-in the person renamed to a matching name (Sweater called "Long-sleeve top", say).
insert into move12
select p.owner_id, p.category_id, b.id, false
from public.user_category_prefs p
join public.categories x on x.id = p.category_id and x.owner_id is null
join alias12 a on btrim(p.name) ~* a.pattern
join public.categories b on b.owner_id is null and b.name = a.target
where b.id <> x.id
on conflict do nothing;

-- 3c. Retire the "Other ..." built-ins. Each person who still uses one gets an item type of their own.
update public.categories set name = name || ' (retired)'
where owner_id is null and name in ('Other outfit', 'Other outerwear', 'Other accessory', 'Other sleepwear');

drop table if exists uses12;
create temporary table uses12 as
select ch.owner_id, i.category_id from public.inventory_items i join public.children ch on ch.id = i.child_id
union select ch.owner_id, g.category_id from public.wardrobe_goals g join public.children ch on ch.id = g.child_id
union select ch.owner_id, s.category_id from public.shopping_items s join public.children ch on ch.id = s.child_id;

insert into public.categories (owner_id, name, group_id, sort_order)
select u.owner_id, replace(o.name, ' (retired)', ''), coalesce(p.group_id, o.group_id), 1000
from uses12 u
join public.categories o on o.id = u.category_id and o.owner_id is null and o.name like '% (retired)'
left join public.user_category_prefs p on p.owner_id = u.owner_id and p.category_id = o.id;

insert into move12
select u.owner_id, o.id, c.id, false
from uses12 u
join public.categories o on o.id = u.category_id and o.owner_id is null and o.name like '% (retired)'
join public.categories c on c.owner_id = u.owner_id and lower(c.name) = lower(replace(o.name, ' (retired)', ''))
on conflict do nothing;

-- 4. Apply the moves. Rows are only touched for children the person owns.
update public.inventory_items i set category_id = m.to_id
from move12 m, public.children ch
where i.category_id = m.from_id and i.child_id = ch.id and ch.owner_id = m.owner_id;

update public.shopping_items s set category_id = m.to_id
from move12 m, public.children ch
where s.category_id = m.from_id and s.child_id = ch.id and ch.owner_id = m.owner_id;

insert into public.wardrobe_goals (child_id, category_id, size_id, target_quantity)
select g.child_id, m.to_id, g.size_id, g.target_quantity
from public.wardrobe_goals g
join move12 m on m.from_id = g.category_id
join public.children ch on ch.id = g.child_id and ch.owner_id = m.owner_id
on conflict (child_id, category_id, size_id) do update set target_quantity = greatest(public.wardrobe_goals.target_quantity, excluded.target_quantity);

delete from public.wardrobe_goals g
using move12 m, public.children ch
where g.category_id = m.from_id and g.child_id = ch.id and ch.owner_id = m.owner_id;

-- 5. Clean up: merged custom types go (their preferences go with them), a merged rename is cleared, retired built-ins go.
update public.user_category_prefs p set name = null
from move12 m
where not m.custom and p.owner_id = m.owner_id and p.category_id = m.from_id
  and exists (select 1 from public.categories x where x.id = m.from_id and x.owner_id is null and x.name not like '% (retired)');

delete from public.categories c using move12 m where m.custom and c.id = m.from_id;
delete from public.categories where owner_id is null and name like '% (retired)';

drop table move12; drop table alias12; drop table uses12; drop table plan12;
