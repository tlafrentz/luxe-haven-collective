grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;

drop policy if exists "Users can view own profile" on public.profiles;

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);
