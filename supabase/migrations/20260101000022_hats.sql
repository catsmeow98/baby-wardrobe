-- Hats: the built-in "Hat" becomes "Warm hat / beanie" (every item, goal and shopping entry on it stays, now as warm hats),
-- and "Sun hat" is a new built-in right after it in Accessories. Safe to run more than once.

update public.categories set name = 'Warm hat / beanie'
where owner_id is null and name = 'Hat'
  and not exists (select 1 from public.categories x where x.owner_id is null and x.name = 'Warm hat / beanie');

-- Make room in the built-in order after it: Warm hat 31, Sun hat 32, Mittens 33 and so on.
update public.categories set sort_order = sort_order + 1
where owner_id is null and sort_order >= 32
  and not exists (select 1 from public.categories s where s.owner_id is null and s.name = 'Sun hat');

insert into public.categories (name, group_id, sort_order)
select 'Sun hat', g.id, 32
from public.category_groups g
where g.owner_id is null and g.name = 'Accessories'
  and not exists (select 1 from public.categories c where c.owner_id is null and lower(c.name) = 'sun hat');
