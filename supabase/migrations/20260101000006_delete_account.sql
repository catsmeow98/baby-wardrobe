-- Lets a signed-in user delete their own account. Deleting the auth user cascades to their profile, children, items,
-- goals, shopping, photos rows, brands and categories. Files in storage are removed by the app before this runs,
-- because deleting rows from storage.objects does not remove the underlying files.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
