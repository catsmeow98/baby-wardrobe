-- Private bucket for clothing and child photos. Objects live under {user_id}/..., and only that user can touch them.
-- Skipped when the storage schema does not exist (plain Postgres test runs).
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not found, skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public) values ('wardrobe-photos', 'wardrobe-photos', false)
  on conflict (id) do nothing;

  execute $p$create policy "wardrobe photos select own" on storage.objects for select to authenticated
    using (bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "wardrobe photos insert own" on storage.objects for insert to authenticated
    with check (bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "wardrobe photos update own" on storage.objects for update to authenticated
    using (bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "wardrobe photos delete own" on storage.objects for delete to authenticated
    using (bucket_id = 'wardrobe-photos' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
end $$;
