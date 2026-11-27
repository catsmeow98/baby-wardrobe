-- "Getting small" is gone as a fit status. An item either fits now, is not yet, or is outgrown. A piece someone had marked
-- "getting small" still fits, so it becomes "fits". Safe to run more than once.
update public.inventory_items set fit_override = 'fits' where fit_override = 'small';
alter table public.inventory_items drop constraint if exists inventory_items_fit_override_check;
alter table public.inventory_items add constraint inventory_items_fit_override_check check (fit_override in ('fits', 'notyet', 'outgrown'));
