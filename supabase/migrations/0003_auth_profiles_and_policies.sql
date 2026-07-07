create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'guest')::public.user_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create policy "Admins can read all profiles" on public.profiles for select using (public.is_admin());
create policy "Admins can update profiles" on public.profiles for update using (public.is_admin());
create policy "Admins can manage properties" on public.properties for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage bookings" on public.bookings for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage messages" on public.messages for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins can manage maintenance" on public.maintenance_requests for all using (public.is_admin()) with check (public.is_admin());

create policy "Owners can read property bookings" on public.bookings for select using (
  exists (
    select 1 from public.properties
    where properties.id = bookings.property_id
    and properties.owner_id = auth.uid()
  )
);

create policy "Owners can read property maintenance" on public.maintenance_requests for select using (
  exists (
    select 1 from public.properties
    where properties.id = maintenance_requests.property_id
    and properties.owner_id = auth.uid()
  )
);
