-- Every photo that had its background removed keeps the original (cropped to the same area, so the touch-up brush can
-- restore from it). original_path is the storage path of that file, in the owner's own folder. Photos added before this
-- have none. Safe to run more than once.
alter table public.inventory_photos add column if not exists original_path text;
alter table public.inventory_photos drop constraint if exists inventory_photos_original_path_length;
alter table public.inventory_photos add constraint inventory_photos_original_path_length check (original_path is null or length(original_path) <= 200);

drop policy if exists inventory_photos_all on public.inventory_photos;
create policy inventory_photos_all on public.inventory_photos for all to authenticated
  using (public.owns_item(inventory_item_id))
  with check (
    public.owns_item(inventory_item_id)
    and storage_path like auth.uid()::text || '/%'
    and (original_path is null or original_path like auth.uid()::text || '/%'));
