grant select, insert, update, delete on public.property_media to authenticated;
grant select on public.property_media to anon;

alter table public.property_media enable row level security;

drop policy if exists "Anyone can view property media" on public.property_media;
drop policy if exists "Admins can manage property media" on public.property_media;

create policy "Anyone can view property media"
on public.property_media
for select
to anon, authenticated
using (true);

create policy "Admins can manage property media"
on public.property_media
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
