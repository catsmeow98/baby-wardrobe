-- Booties: a new built-in item type in Footwear, between Shoes and Boots. A person's own item type called "Booties" (or a
-- built-in they renamed that) is merged into it: items, goals and shopping entries move over, and goals for the same size
-- keep the larger number. Safe to run more than once.

-- Make room in the built-in order: Shoes 34, Booties 35, Boots 36 and so on.
update public.categories set sort_order = sort_order + 1
where owner_id is null and sort_order >= 35
  and not exists (select 1 from public.categories b where b.owner_id is null and b.name = 'Booties');

insert into public.categories (name, group_id, sort_order)
select 'Booties', g.id, 35
from public.category_groups g
where g.owner_id is null and g.name = 'Footwear'
  and not exists (select 1 from public.categories c where c.owner_id is null and lower(c.name) = 'booties');

drop table if exists move13;
create temporary table move13 (owner_id uuid not null, from_id uuid not null, to_id uuid not null, custom boolean not null, primary key (owner_id, from_id));

insert into move13
select c.owner_id, c.id, b.id, true
from public.categories c, public.categories b
where c.owner_id is not null and btrim(c.name) ~* '^(booties|bootie|baby booties)$'
  and b.owner_id is null and b.name = 'Booties';

insert into move13
select p.owner_id, p.category_id, b.id, false
from public.user_category_prefs p
join public.categories x on x.id = p.category_id and x.owner_id is null
join public.categories b on b.owner_id is null and b.name = 'Booties'
where btrim(p.name) ~* '^(booties|bootie|baby booties)$' and x.id <> b.id
on conflict do nothing;

update public.inventory_items i set category_id = m.to_id
from move13 m, public.children ch
where i.category_id = m.from_id and i.child_id = ch.id and ch.owner_id = m.owner_id;

update public.shopping_items s set category_id = m.to_id
from move13 m, public.children ch
where s.category_id = m.from_id and s.child_id = ch.id and ch.owner_id = m.owner_id;

insert into public.wardrobe_goals (child_id, category_id, size_id, target_quantity)
select g.child_id, m.to_id, g.size_id, g.target_quantity
from public.wardrobe_goals g
join move13 m on m.from_id = g.category_id
join public.children ch on ch.id = g.child_id and ch.owner_id = m.owner_id
on conflict (child_id, category_id, size_id) do update set target_quantity = greatest(public.wardrobe_goals.target_quantity, excluded.target_quantity);

delete from public.wardrobe_goals g
using move13 m, public.children ch
where g.category_id = m.from_id and g.child_id = ch.id and ch.owner_id = m.owner_id;

update public.user_category_prefs p set name = null
from move13 m
where not m.custom and p.owner_id = m.owner_id and p.category_id = m.from_id;

delete from public.categories c using move13 m where m.custom and c.id = m.from_id;

drop table move13;
