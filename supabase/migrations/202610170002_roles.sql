alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Users may edit their own display name, but cannot update their role.
revoke update on public.profiles from anon, authenticated;
grant update (name) on public.profiles to authenticated;

create policy "admins read profiles" on public.profiles
  for select to authenticated using (public.is_admin());
create policy "admins manage books" on public.books
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage chapters" on public.chapters
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage covers" on storage.objects
  for all to authenticated using (bucket_id = 'covers' and public.is_admin()) with check (bucket_id = 'covers' and public.is_admin());
