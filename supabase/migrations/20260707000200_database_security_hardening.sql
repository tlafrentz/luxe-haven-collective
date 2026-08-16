-- Luxe Haven Collective
-- Database security hardening

grant usage on schema public to anon, authenticated, service_role;

grant select on public.properties to anon;
grant select, insert, update on public.properties to authenticated;

grant select, update on public.profiles to authenticated;

grant select, insert, update on public.owners to authenticated;
grant select, insert, update on public.bookings to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, insert, update on public.maintenance_requests to authenticated;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'contact_inquiries'
  ) then
    grant select, insert, update on public.contact_inquiries to authenticated;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'lead_magnet_downloads'
  ) then
    grant select, insert, update on public.lead_magnet_downloads to authenticated;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'property_media'
  ) then
    grant select, insert, update, delete on public.property_media to authenticated;
    grant select on public.property_media to anon;
  end if;
end $$;

alter table public.profiles enable row level security;
alter table public.properties enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Admins can manage profiles"
on public.profiles
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Anyone can view active properties" on public.properties;
drop policy if exists "Admins can view all properties" on public.properties;
drop policy if exists "Admins can insert properties" on public.properties;
drop policy if exists "Admins can update properties" on public.properties;

create policy "Anyone can view active properties"
on public.properties
for select
to anon, authenticated
using (status = 'active');

create policy "Admins can view all properties"
on public.properties
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create policy "Admins can insert properties"
on public.properties
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create policy "Admins can update properties"
on public.properties
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
