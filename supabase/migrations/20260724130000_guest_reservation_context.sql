alter table public.properties
  add column if not exists timezone text,
  add column if not exists guidebook_available boolean not null default false;

update public.properties
set timezone = nullif(metadata #>> '{hospitable,timezone}', '')
where timezone is null;

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  identity_status text not null default 'provisional',
  display_name text not null default 'Guest',
  normalized_name text,
  email text,
  phone text,
  language text,
  last_observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guests_identity_status_check
    check (identity_status in ('resolved', 'provisional', 'ambiguous', 'unidentified'))
);

create index if not exists guests_owner_id_idx on public.guests (owner_id);

create table if not exists public.provider_guest_references (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  external_guest_id text not null,
  last_observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider, external_guest_id)
);

create index if not exists provider_guest_references_guest_id_idx
on public.provider_guest_references (guest_id);

alter table public.bookings
  add column if not exists primary_guest_id uuid references public.guests(id) on delete set null,
  add column if not exists party_adults integer,
  add column if not exists party_children integer,
  add column if not exists party_infants integer,
  add column if not exists party_pets integer,
  add column if not exists guest_language text,
  add column if not exists guest_context_synced_at timestamptz;

-- Create a deterministic provisional guest for every owned booking that
-- does not already resolve through a provider guest reference.
insert into public.guests (
  id,
  owner_id,
  identity_status,
  display_name,
  normalized_name,
  email,
  phone,
  language,
  last_observed_at
)
select
  md5('booking:' || b.id::text)::uuid,
  o.profile_id,
  case
    when nullif(trim(b.guest_full_name), '') is null then 'unidentified'
    else 'provisional'
  end,
  coalesce(nullif(trim(b.guest_full_name), ''), 'Guest'),
  lower(nullif(trim(b.guest_full_name), '')),
  b.guest_email,
  b.guest_phone,
  b.guest_language,
  coalesce(b.guest_context_synced_at, b.last_synced_at, now())
from public.bookings b
join public.properties p
  on p.id = b.property_id
join public.owners o
  on o.id = p.owner_id
left join public.provider_guest_references r
  on r.owner_id = o.profile_id
 and r.provider = b.external_provider
 and r.external_guest_id = b.external_guest_id
where o.profile_id is not null
  and b.primary_guest_id is null
  and r.guest_id is null
on conflict (id) do nothing;

-- Link each owned booking either to its resolved provider guest or to the
-- deterministic provisional guest created above.
update public.bookings b
set primary_guest_id = coalesce(
  (
    select r.guest_id
    from public.provider_guest_references r
    where r.owner_id = o.profile_id
      and r.provider = b.external_provider
      and r.external_guest_id = b.external_guest_id
  ),
  md5('booking:' || b.id::text)::uuid
)
from public.properties p
join public.owners o
  on o.id = p.owner_id
where p.id = b.property_id
  and o.profile_id is not null
  and b.primary_guest_id is null;

insert into public.provider_guest_references (
  guest_id,
  owner_id,
  provider,
  external_guest_id,
  last_observed_at
)
select
  b.primary_guest_id,
  o.profile_id,
  b.external_provider,
  b.external_guest_id,
  coalesce(b.guest_context_synced_at, b.last_synced_at, now())
from public.bookings b
join public.properties p on p.id = b.property_id
join public.owners o on o.id = p.owner_id
where b.primary_guest_id is not null
  and b.external_provider is not null
  and b.external_guest_id is not null
on conflict (owner_id, provider, external_guest_id) do update
  set guest_id = excluded.guest_id,
      last_observed_at = excluded.last_observed_at,
      updated_at = now();

alter table public.guests enable row level security;
alter table public.provider_guest_references enable row level security;

create policy "Owners read own guests"
on public.guests for select using (owner_id = auth.uid());
create policy "Owners read own provider guest references"
on public.provider_guest_references for select using (owner_id = auth.uid());
create policy "Admins manage guests"
on public.guests for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage provider guest references"
on public.provider_guest_references for all
using (public.is_admin()) with check (public.is_admin());

grant select on public.guests to authenticated;
grant select on public.provider_guest_references to authenticated;
