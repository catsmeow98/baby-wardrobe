-- Shared defaults: one size system and the starter categories. Users cannot edit rows with a null owner.
insert into public.size_systems (id, name, owner_id)
values ('00000000-0000-4000-8000-000000000001', 'US baby and toddler', null);

-- Size groups. A range and its top size are the same size, so each pair is one group with two tag labels.
with g(sort_order, label, alias) as (values
  (0, 'Newborn', null), (1, '0-3M', '3M'), (2, '3-6M', '6M'), (3, '6-9M', '9M'), (4, '9-12M', '12M'),
  (5, '12-18M', '18M'), (6, '18-24M', '24M'), (7, '2T', null), (8, '3T', null), (9, '4T', null)),
ins as (
  insert into public.sizes (size_system_id, label, alias, sort_order)
  select '00000000-0000-4000-8000-000000000001', label, alias, sort_order from g
  returning id, label, alias
)
insert into public.size_labels (size_id, label, sort_order)
select id, label, 0 from ins
union all
select id, alias, 1 from ins where alias is not null;

insert into public.categories (name, sort_order) values
  ('Short-sleeve bodysuits', 1), ('Long-sleeve bodysuits', 2), ('Tops', 3), ('Bottoms', 4),
  ('Footy sleepers', 5), ('Footless sleepers', 6), ('Other sleepwear', 7), ('Swaddles', 8),
  ('Sleep sacks', 9), ('Outfits', 10), ('Outerwear', 11), ('Accessories', 12),
  ('Footwear', 13), ('Swimwear', 14);
