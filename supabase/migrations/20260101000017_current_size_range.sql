-- 17: A current size range. A baby does not move from 3-6M to 6-9M overnight, so a child's current size can span sizes:
-- current_size_id is the bottom of the range and the new current_size_to_id the top (null means a single size).
-- An item "fits now" when its fit range overlaps the current range. Safe to run more than once.

alter table public.children
  add column if not exists current_size_to_id uuid references public.sizes(id) on delete set null;

comment on column public.children.current_size_to_id is
  'Top of the current size range (null: the current size is a single size). Never below current_size_id.';

-- The size check now covers the top of the range too: in the child's size system, and not below the bottom.
create or replace function public.check_child_sizes() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_from int;
  v_to int;
begin
  if new.current_size_id is not null and not public.size_in_system(new.current_size_id, new.size_system_id) then
    raise exception 'current size is not part of the child''s size system' using errcode = '23514';
  end if;
  if new.current_size_to_id is not null then
    if not public.size_in_system(new.current_size_to_id, new.size_system_id) then
      raise exception 'the top of the current size range is not part of the child''s size system' using errcode = '23514';
    end if;
    if new.current_size_id is null then
      raise exception 'set the bottom of the current size range first' using errcode = '23514';
    end if;
    select sort_order into v_from from public.sizes where id = new.current_size_id;
    select sort_order into v_to from public.sizes where id = new.current_size_to_id;
    if v_to < v_from then
      raise exception 'the top of the current size range is below the bottom' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
