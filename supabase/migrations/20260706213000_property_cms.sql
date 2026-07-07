-- Property CMS expansion for Luxe Haven Collective
-- Adds publish-ready content fields, storage, and admin/owner policies.

alter table public.properties
  add column if not exists short_description text,
  add column if not exists headline text,
  add column if not exists property_type text not null default 'home',
  add column if not exists neighborhood text,
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists cleaning_fee numeric(10,2) not null default 0,
  add column if not exists service_fee numeric(10,2) not null default 0,
  add column if not exists tax_rate numeric(5,4) not null default 0,
  add column if not exists minimum_nights int not null default 2,
  add column if not exists check_in_time text not null default '4:00 PM',
  add column if not exists check_out_time text not null default '10:00 AM',
  add column if not exists house_rules text[] not null default '{}',
  add column if not exists highlights text[] not null default '{}',
  add column if not exists featured_image text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists published_at timestamptz;

create index if not exists properties_status_idx on public.properties(status);
create index if not exists properties_owner_id_idx on public.properties(owner_id);
create index if not exists properties_city_state_idx on public.properties(city, state);
create index if not exists properties_slug_idx on public.properties(slug);

create table if not exists public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text,
  url text not null,
  alt_text text,
  sort_order int not null default 0,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists property_media_property_id_idx on public.property_media(property_id);
create index if not exists property_media_sort_order_idx on public.property_media(property_id, sort_order);

alter table public.property_media enable row level security;

drop policy if exists "Anyone can view active property media" on public.property_media;
create policy "Anyone can view active property media"
on public.property_media for select
using (
  exists (
    select 1 from public.properties p
    where p.id = property_media.property_id and p.status = 'active'
  )
);

drop policy if exists "Owners can view own property media" on public.property_media;
create policy "Owners can view own property media"
on public.property_media for select
using (
  exists (
    select 1 from public.properties p
    where p.id = property_media.property_id and p.owner_id = auth.uid()
  )
);

drop policy if exists "Admins can manage property media" on public.property_media;
create policy "Admins can manage property media"
on public.property_media for all
using (public.is_admin())
with check (public.is_admin());

-- Storage bucket for property photos. Public read keeps marketing pages fast and simple.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-images',
  'property-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read property images" on storage.objects;
create policy "Public can read property images"
on storage.objects for select
using (bucket_id = 'property-images');

drop policy if exists "Admins can upload property images" on storage.objects;
create policy "Admins can upload property images"
on storage.objects for insert
with check (bucket_id = 'property-images' and public.is_admin());

drop policy if exists "Admins can update property images" on storage.objects;
create policy "Admins can update property images"
on storage.objects for update
using (bucket_id = 'property-images' and public.is_admin())
with check (bucket_id = 'property-images' and public.is_admin());

drop policy if exists "Admins can delete property images" on storage.objects;
create policy "Admins can delete property images"
on storage.objects for delete
using (bucket_id = 'property-images' and public.is_admin());

-- Refresh updated_at automatically for property CMS edits.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_properties_updated_at on public.properties;
create trigger set_properties_updated_at
before update on public.properties
for each row execute function public.set_updated_at();
