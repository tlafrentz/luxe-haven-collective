-- DEV-REQ Guidebook Studio Canonical Libraries v1
-- Reusable source artifacts are versioned independently from customer guidebooks.

create table if not exists public.guidebook_library_artifacts (
  id uuid primary key default gen_random_uuid(),
  artifact_type text not null check (artifact_type in ('content','component','template','media')),
  ownership_scope text not null default 'luxe_haven' check (ownership_scope in ('luxe_haven','workspace','property')),
  workspace_id uuid references public.owners(id),
  property_id uuid references public.properties(id),
  canonical_key text not null,
  name text not null,
  description text not null default '',
  category text not null default 'general',
  language text not null default 'en',
  tags text[] not null default '{}',
  owner_label text not null default 'Luxe Haven Experience Design',
  current_version_number integer not null default 1 check (current_version_number > 0),
  status text not null default 'draft' check (status in ('draft','under_review','published','deprecated','superseded','archived','processing','needs_review','approved','rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (artifact_type, ownership_scope, workspace_id, property_id, canonical_key),
  check ((ownership_scope='luxe_haven' and workspace_id is null and property_id is null) or (ownership_scope='workspace' and workspace_id is not null and property_id is null) or (ownership_scope='property' and workspace_id is not null and property_id is not null))
);

create table if not exists public.guidebook_library_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.guidebook_library_artifacts(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status text not null check (status in ('draft','under_review','published','deprecated','superseded','archived','processing','needs_review','approved','rejected')),
  payload jsonb not null default '{}'::jsonb,
  change_summary text not null default '',
  supersedes_version_id uuid references public.guidebook_library_versions(id) on delete restrict,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  unique (artifact_id, version_number)
);

create table if not exists public.guidebook_library_usage (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references public.guidebook_library_versions(id) on delete restrict,
  consumer_type text not null check (consumer_type in ('component','template','guidebook','publication')),
  consumer_id text not null,
  consumer_version text,
  workspace_id uuid references public.owners(id),
  property_id uuid references public.properties(id),
  accepted_at timestamptz not null default now(),
  accepted_by uuid references public.profiles(id),
  unique (source_version_id, consumer_type, consumer_id, consumer_version)
);

create table if not exists public.guidebook_media_collections (
  id uuid primary key default gen_random_uuid(),
  ownership_scope text not null default 'luxe_haven' check (ownership_scope in ('luxe_haven','workspace','property')),
  workspace_id uuid references public.owners(id),
  property_id uuid references public.properties(id),
  canonical_key text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (ownership_scope, workspace_id, property_id, canonical_key)
);

create table if not exists public.guidebook_library_media_files (
  version_id uuid primary key references public.guidebook_library_versions(id) on delete restrict,
  collection_id uuid references public.guidebook_media_collections(id),
  storage_bucket text not null default 'guidebook-library-media',
  storage_path text not null unique,
  original_file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/avif','video/mp4','application/pdf','image/svg+xml')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  width integer,
  height integer,
  duration_seconds numeric,
  checksum_sha256 text not null,
  alt_text text,
  processing_state text not null default 'processing' check (processing_state in ('uploading','processing','needs_review','approved','rejected')),
  rejection_reason text,
  scan_status text not null default 'pending' check (scan_status in ('pending','clean','rejected','unavailable')),
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists guidebook_library_artifact_filter_idx on public.guidebook_library_artifacts(artifact_type,status,category,updated_at desc);
create index if not exists guidebook_library_usage_source_idx on public.guidebook_library_usage(source_version_id,consumer_type);
create unique index if not exists guidebook_media_checksum_scope_idx on public.guidebook_library_media_files(checksum_sha256);

create or replace function public.protect_published_guidebook_library_version() returns trigger language plpgsql as $$
begin
  if old.status in ('published','approved') then raise exception 'published_library_version_immutable'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists protect_published_guidebook_library_version on public.guidebook_library_versions;
create trigger protect_published_guidebook_library_version before update or delete on public.guidebook_library_versions for each row execute function public.protect_published_guidebook_library_version();

alter table public.guidebook_library_artifacts enable row level security;
alter table public.guidebook_library_versions enable row level security;
alter table public.guidebook_library_usage enable row level security;
alter table public.guidebook_media_collections enable row level security;
alter table public.guidebook_library_media_files enable row level security;

create policy "Admins manage guidebook library artifacts" on public.guidebook_library_artifacts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage guidebook library versions" on public.guidebook_library_versions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage guidebook library usage" on public.guidebook_library_usage for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage guidebook media collections" on public.guidebook_media_collections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage guidebook media files" on public.guidebook_library_media_files for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select,insert,update,delete on public.guidebook_library_artifacts,public.guidebook_library_versions,public.guidebook_library_usage,public.guidebook_media_collections,public.guidebook_library_media_files to authenticated;
revoke all on public.guidebook_library_artifacts,public.guidebook_library_versions,public.guidebook_library_usage,public.guidebook_media_collections,public.guidebook_library_media_files from anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('guidebook-library-media','guidebook-library-media',false,52428800,array['image/jpeg','image/png','image/webp','image/avif','video/mp4','application/pdf','image/svg+xml'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

with seeded(kind,key,name,description,category,tags,status,payload) as (
  values
  ('content','welcome-home','Welcome Home','Opening welcome content for every guest stay.','welcome',array['welcome','intro'],'published','{"blocks":[{"type":"paragraph","text":"Welcome to {{property_name}}. We are delighted you chose to stay with us."}],"requiredVariables":["property_name"]}'::jsonb),
  ('content','about-your-stay','About Your Stay','Essential context about the property and stay.','property',array['property'],'published','{"blocks":[{"type":"paragraph","text":"Everything guests need for a comfortable stay."}]}'::jsonb),
  ('content','before-you-arrive','Before You Arrive','Pre-arrival preparation and timing.','arrival',array['arrival','pre-stay'],'published','{"blocks":[{"type":"paragraph","text":"Check-in begins at {{check_in_time}}."}],"requiredVariables":["check_in_time"]}'::jsonb),
  ('content','check-in-instructions','Check-in Instructions','Arrival and entry instructions.','arrival',array['arrival','entry'],'published','{"blocks":[{"type":"paragraph","text":"Use {{entry_method}} for arrival."}],"requiredVariables":["entry_method"]}'::jsonb),
  ('content','parking-instructions','Parking Instructions','Property-specific parking guidance.','arrival',array['parking'],'published','{"blocks":[{"type":"paragraph","text":"Park at {{parking_location}}."}],"requiredVariables":["parking_location"]}'::jsonb),
  ('content','wifi-access','Wi-Fi Access','Network access guidance.','property-info',array['wifi','internet'],'published','{"blocks":[{"type":"paragraph","text":"Network: {{wifi_name}}"},{"type":"paragraph","text":"Password: {{wifi_password}}"}],"requiredVariables":["wifi_name","wifi_password"]}'::jsonb),
  ('content','house-rules','House Rules','Approved property standards.','house-rules',array['rules'],'published','{"blocks":[{"type":"paragraph","text":"Please observe quiet hours: {{quiet_hours}}."}],"requiredVariables":["quiet_hours"]}'::jsonb),
  ('content','kitchen-amenities','Kitchen Amenities','Kitchen equipment and use guidance.','amenities',array['kitchen'],'published','{"blocks":[{"type":"paragraph","text":"Kitchen amenities available during your stay."}]}'::jsonb),
  ('content','bathroom-amenities','Bathroom Amenities','Bathroom supplies and amenities.','amenities',array['bathroom'],'published','{"blocks":[{"type":"paragraph","text":"Bathroom essentials are provided."}]}'::jsonb),
  ('content','laundry','Laundry','Laundry location and instructions.','amenities',array['laundry'],'published','{"blocks":[{"type":"paragraph","text":"Laundry instructions for your stay."}]}'::jsonb),
  ('content','emergency-contacts','Emergency Contacts','Emergency and host contact guidance.','safety',array['emergency'],'published','{"blocks":[{"type":"paragraph","text":"Contact your host at {{host_phone}}."}],"requiredVariables":["host_phone"]}'::jsonb),
  ('content','power-outage','Power Outage','Steps to follow during a power interruption.','safety',array['emergency','power'],'published','{"blocks":[{"type":"paragraph","text":"Remain safe and contact your host if service is not restored."}]}'::jsonb),
  ('content','checkout-checklist','Checkout Checklist','Departure tasks for guests.','departure',array['checkout'],'published','{"blocks":[{"type":"checklist","items":["Secure the property","Return keys","Confirm departure"]}],"requiredVariables":["check_out_time"]}'::jsonb)
), inserted as (
  insert into public.guidebook_library_artifacts(artifact_type,canonical_key,name,description,category,tags,status,current_version_number)
  select kind,key,name,description,category,tags,status,1 from seeded
  on conflict (artifact_type,ownership_scope,workspace_id,property_id,canonical_key) do update set name=excluded.name,description=excluded.description,category=excluded.category,tags=excluded.tags,updated_at=now()
  returning id,canonical_key
)
insert into public.guidebook_library_versions(artifact_id,version_number,status,payload,change_summary,published_at)
select a.id,1,s.status,s.payload,'Deterministic starter version',case when s.status='published' then '2026-08-04T00:00:00Z'::timestamptz end
from seeded s join public.guidebook_library_artifacts a on a.artifact_type='content' and a.ownership_scope='luxe_haven' and a.canonical_key=s.key
on conflict (artifact_id,version_number) do nothing;

with seeded(key,name,type_name,category,payload) as (
 values
 ('welcome-banner','Welcome Banner','banner','welcome','{"variant":"luxury","contentKey":"welcome-home","settings":{"showImage":true}}'::jsonb),
 ('wifi-card','Wi-Fi Card','card','property-info','{"variant":"modern","contentKey":"wifi-access","settings":{"copyPassword":true,"helpText":"Need help connecting? Contact your host."},"variables":["wifi_name","wifi_password"]}'::jsonb),
 ('parking-card','Parking Card','card','arrival','{"variant":"minimal","contentKey":"parking-instructions"}'::jsonb),
 ('property-facts','Property Facts','facts','property','{"variant":"compact"}'::jsonb),
 ('image-gallery','Image Gallery','gallery','media','{"variant":"editorial"}'::jsonb),
 ('map','Map','map','location','{"variant":"modern"}'::jsonb),
 ('recommendations','Recommendations','recommendations','local','{"variant":"editorial"}'::jsonb),
 ('emergency-card','Emergency Card','card','safety','{"variant":"minimal","contentKey":"emergency-contacts"}'::jsonb),
 ('house-rules','House Rules','list','house-rules','{"variant":"compact","contentKey":"house-rules"}'::jsonb),
 ('faq','FAQ','accordion','support','{"variant":"minimal"}'::jsonb),
 ('checkout-checklist','Checkout Checklist','checklist','departure','{"variant":"modern","contentKey":"checkout-checklist"}'::jsonb),
 ('contact-host','Contact Host','action','support','{"variant":"compact","variables":["host_phone"]}'::jsonb),
 ('qr-code','QR Code','qr','access','{"variant":"minimal"}'::jsonb),
 ('download-card','Download Card','download','resources','{"variant":"editorial"}'::jsonb)
), artifacts as (
 insert into public.guidebook_library_artifacts(artifact_type,canonical_key,name,description,category,tags,status,current_version_number,metadata)
 select 'component',key,name,'Reusable guest-facing '||lower(name)||'.',category,array[type_name],'published',1,jsonb_build_object('componentType',type_name) from seeded
 on conflict (artifact_type,ownership_scope,workspace_id,property_id,canonical_key) do update set name=excluded.name,description=excluded.description,metadata=excluded.metadata,updated_at=now()
 returning id
)
insert into public.guidebook_library_versions(artifact_id,version_number,status,payload,change_summary,published_at)
select a.id,1,'published',s.payload,'Deterministic starter component','2026-08-04T00:00:00Z' from seeded s join public.guidebook_library_artifacts a on a.artifact_type='component' and a.ownership_scope='luxe_haven' and a.canonical_key=s.key
on conflict (artifact_id,version_number) do nothing;

with seeded(key,name,description,style,property_type) as (
 values ('luxury-coastal','Luxury Coastal','Premium coastal guest experience.','luxury','house'),('mountain-cabin','Mountain Cabin','Warm guidance for four-season cabins.','mountain','cabin'),('urban-modern','Urban Modern','Compact city-first guest experience.','modern','apartment'),('family-vacation','Family Vacation','Practical guidance for group stays.','family','house'),('boutique-stay','Boutique Stay','Editorial experience for distinctive stays.','boutique','custom'),('minimal-essentials','Minimal Essentials','Focused essential stay information.','minimal','custom')
), artifacts as (
 insert into public.guidebook_library_artifacts(artifact_type,canonical_key,name,description,category,tags,status,current_version_number,metadata)
 select 'template',key,name,description,style,array[property_type,style],'published',1,jsonb_build_object('style',style,'propertyType',property_type,'bedroomRange','all') from seeded
 on conflict (artifact_type,ownership_scope,workspace_id,property_id,canonical_key) do update set name=excluded.name,description=excluded.description,metadata=excluded.metadata,updated_at=now()
 returning id
)
insert into public.guidebook_library_versions(artifact_id,version_number,status,payload,change_summary,published_at)
select a.id,1,'published',jsonb_build_object('sections',jsonb_build_array(jsonb_build_object('key','welcome','name','Welcome','required',true,'components',jsonb_build_array('welcome-banner')),jsonb_build_object('key','arrival','name','Before Arrival','required',true,'components',jsonb_build_array('parking-card')),jsonb_build_object('key','property','name','Property Overview','required',true,'components',jsonb_build_array('property-facts')),jsonb_build_object('key','amenities','name','Amenities','required',false,'components',jsonb_build_array('wifi-card')),jsonb_build_object('key','checkout','name','Checkout','required',true,'components',jsonb_build_array('checkout-checklist'))),'design',jsonb_build_object('style',s.style,'tokens',jsonb_build_object('radius','medium','spacing','comfortable'))),'Deterministic starter template','2026-08-04T00:00:00Z'
from seeded s join public.guidebook_library_artifacts a on a.artifact_type='template' and a.ownership_scope='luxe_haven' and a.canonical_key=s.key
on conflict (artifact_id,version_number) do nothing;

insert into public.guidebook_media_collections(canonical_key,name)
select lower(replace(name,' ','-')),name from unnest(array['Hero Images','Living Rooms','Bedrooms','Bathrooms','Kitchens','Outdoor Spaces','Pools','Fireplaces','Dining','Restaurants','Beaches','Mountains','City','Amenities','Icons','Brand Assets']) name
on conflict (ownership_scope,workspace_id,property_id,canonical_key) do update set name=excluded.name;

-- Complete the canonical Modern Apartment 2 Bedroom seed without creating a second package model.
with variant as (
 select v.id from public.furnishing_package_variants v join public.furnishing_packages p on p.id=v.package_id where p.name='Modern Apartment' and v.name='2 Bedroom' limit 1
)
insert into public.furnishing_package_rooms(variant_id,name,position)
select variant.id,room.name,room.position from variant cross join (values ('Bathroom',6),('Workspace',7)) room(name,position)
on conflict (variant_id,name) do update set position=excluded.position;

with room as (
 select r.id from public.furnishing_package_rooms r join public.furnishing_package_variants v on v.id=r.variant_id join public.furnishing_packages p on p.id=v.package_id where p.name='Modern Apartment' and v.name='2 Bedroom' and r.name='Living Room' limit 1
), items(name,category,quantity,position) as (
 values ('Sofa','Furniture',1,1),('Coffee Table','Furniture',1,2),('Side Table','Furniture',2,3),('Television','Technology',1,4),('TV Console','Furniture',1,5),('Rug','Decor and art',1,6),('Floor Lamp','Lighting',1,7),('Accent Chair','Furniture',1,8),('Throw Pillows','Decor and art',4,9),('Throw Blanket','Decor and art',2,10),('Wall Art','Decor and art',2,11),('Plant','Decor and art',2,12)
)
insert into public.furnishing_package_items(room_id,name,category,required,quantity,position)
select room.id,items.name,items.category,true,items.quantity,items.position from room cross join items
where not exists (select 1 from public.furnishing_package_items existing where existing.room_id=room.id and existing.name=items.name);
