-- Canonical ownership identity boundary:
--   properties.owner_id -> owners.id (aggregate identity)
--   owners.profile_id   -> profiles.id (authentication/workspace identity)
-- Consumers storing a profiles.id must resolve it through these functions.

begin;

create or replace function public.owner_profile_id(p_owner_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select o.profile_id
  from public.owners o
  where o.id = p_owner_id
$$;

create or replace function public.property_owner_profile_id(p_property_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select public.owner_profile_id(p.owner_id)
  from public.properties p
  where p.id = p_property_id
$$;

comment on function public.owner_profile_id(uuid) is
  'Canonical conversion from owners.id (aggregate identity) to profiles.id (authentication/workspace identity).';
comment on function public.property_owner_profile_id(uuid) is
  'Canonical profiles.id owner resolution for a property.';

-- Replace the trigger function before any booking update can fire it. Queue
-- ownership is profile-scoped, while properties.owner_id is aggregate-scoped.
create or replace function public.queue_booking_quality_re_evaluation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_profile_id uuid;
begin
  select o.profile_id
  into booking_profile_id
  from public.properties p
  join public.owners o
    on o.id = p.owner_id
  where p.id = new.property_id;

  if booking_profile_id is null then
    return new;
  end if;

  insert into public.operational_quality_re_evaluation_queue (
    owner_id,
    record_type,
    record_id,
    reason,
    queued_at
  )
  values (
    booking_profile_id,
    'booking',
    new.id,
    'canonical-booking-changed',
    now()
  )
  on conflict (owner_id, record_type, record_id)
  do update
  set
    reason = excluded.reason,
    queued_at = excluded.queued_at;

  return new;
end;
$$;

-- Repair profile-owned rows written with an aggregate owner id. Updates are
-- intentionally in place: guest and booking ids do not change.
update public.guests g
set owner_id = o.profile_id,
    updated_at = now()
from public.owners o
where g.owner_id = o.id
  and g.owner_id is distinct from o.profile_id;

-- Prefer an existing canonical reference when both aggregate-owned and
-- profile-owned copies exist for the same provider identity.
delete from public.provider_guest_references r
using public.owners o
where r.owner_id = o.id
  and r.owner_id is distinct from o.profile_id
  and exists (
    select 1
    from public.provider_guest_references existing
    where existing.owner_id = o.profile_id
      and existing.provider = r.provider
      and existing.external_guest_id = r.external_guest_id
      and existing.id <> r.id
  );

update public.provider_guest_references r
set owner_id = o.profile_id,
    updated_at = now()
from public.owners o
where r.owner_id = o.id
  and r.owner_id is distinct from o.profile_id;

update public.operational_quality_evaluations q
set owner_id = o.profile_id
from public.owners o
where q.owner_id = o.id
  and q.owner_id is distinct from o.profile_id;

update public.operational_data_quality_issues q
set owner_id = o.profile_id
from public.owners o
where q.owner_id = o.id
  and q.owner_id is distinct from o.profile_id;

update public.operational_record_provenance q
set owner_id = o.profile_id
from public.owners o
where q.owner_id = o.id
  and q.owner_id is distinct from o.profile_id;

update public.operational_sync_summaries q
set owner_id = o.profile_id
from public.owners o
where q.owner_id = o.id
  and q.owner_id is distinct from o.profile_id;

-- Remove aggregate-owned queue entries where the canonical profile-owned entry
-- already exists, then repair every remaining aggregate-owned entry in place.
delete from public.operational_quality_re_evaluation_queue q
using public.owners o
where q.owner_id = o.id
  and q.owner_id is distinct from o.profile_id
  and exists (
    select 1
    from public.operational_quality_re_evaluation_queue existing
    where existing.owner_id = o.profile_id
      and existing.record_type = q.record_type
      and existing.record_id = q.record_id
  );

update public.operational_quality_re_evaluation_queue q
set owner_id = o.profile_id
from public.owners o
where q.owner_id = o.id
  and q.owner_id is distinct from o.profile_id;

-- Backfill one deterministic canonical guest per provider guest, or per booking
-- when no provider identity exists. This inserts only; it never deletes guest data.
insert into public.guests (
  id, owner_id, identity_status, display_name, normalized_name, email, phone,
  language, last_observed_at
)
select
  case
    when b.external_guest_id is not null then
      md5(o.profile_id::text || ':' || b.external_provider || ':' || b.external_guest_id)::uuid
    else md5('booking:' || b.id::text)::uuid
  end,
  o.profile_id,
  case
    when b.external_guest_id is not null then 'resolved'
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
join public.properties p on p.id = b.property_id
join public.owners o on o.id = p.owner_id
where o.profile_id is not null
on conflict (id) do update set
  last_observed_at = greatest(guests.last_observed_at, excluded.last_observed_at),
  updated_at = now();

insert into public.provider_guest_references (
  guest_id, owner_id, provider, external_guest_id, last_observed_at
)
select
  md5(o.profile_id::text || ':' || b.external_provider || ':' || b.external_guest_id)::uuid,
  o.profile_id,
  b.external_provider,
  b.external_guest_id,
  coalesce(b.guest_context_synced_at, b.last_synced_at, now())
from public.bookings b
join public.properties p on p.id = b.property_id
join public.owners o on o.id = p.owner_id
where o.profile_id is not null
  and b.external_provider is not null
  and b.external_guest_id is not null
on conflict (owner_id, provider, external_guest_id) do update set
  last_observed_at = greatest(
    provider_guest_references.last_observed_at,
    excluded.last_observed_at
  ),
  updated_at = now();

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
join public.owners o on o.id = p.owner_id
where p.id = b.property_id
  and o.profile_id is not null
  and (
    (b.external_provider is not null and b.external_guest_id is not null)
    or b.primary_guest_id is null
    or not exists (
      select 1
      from public.guests g
      where g.id = b.primary_guest_id
        and g.owner_id = o.profile_id
    )
  );

-- Re-evaluate every owned operational booking, including bookings whose guest
-- identity was already canonical and therefore did not need an update above.
insert into public.operational_quality_re_evaluation_queue (
  owner_id,
  record_type,
  record_id,
  reason,
  queued_at
)
select
  o.profile_id,
  'booking',
  b.id,
  'owner-identity-repaired',
  now()
from public.bookings b
join public.properties p on p.id = b.property_id
join public.owners o on o.id = p.owner_id
where o.profile_id is not null
on conflict (owner_id, record_type, record_id)
do update
set
  reason = excluded.reason,
  queued_at = excluded.queued_at;

drop policy if exists "Owners can read their properties" on public.properties;
create policy "Owners can read their properties"
on public.properties for select
using (public.owner_profile_id(owner_id) = auth.uid());

drop policy if exists "Owners can view own property media" on public.property_media;
create policy "Owners can view own property media"
on public.property_media for select
using (public.property_owner_profile_id(property_id) = auth.uid());

drop policy if exists "Owners can read property bookings" on public.bookings;
create policy "Owners can read property bookings"
on public.bookings for select
using (public.property_owner_profile_id(property_id) = auth.uid());

drop policy if exists "Owners can read property maintenance" on public.maintenance_requests;
create policy "Owners can read property maintenance"
on public.maintenance_requests for select
using (public.property_owner_profile_id(property_id) = auth.uid());

-- Fail the migration instead of leaving production partially repaired.
do $$
begin
  if exists (
    select 1
    from public.properties p
    left join public.owners o on o.id = p.owner_id
    where p.owner_id is not null
      and o.id is null
  ) then
    raise exception 'Owner identity repair left properties with invalid owners';
  end if;

  if exists (
    select 1
    from public.bookings b
    join public.properties p on p.id = b.property_id
    join public.owners o on o.id = p.owner_id
    where o.profile_id is not null
      and b.primary_guest_id is null
  ) then
    raise exception 'Owner identity repair left orphan bookings';
  end if;

  if exists (
    select 1
    from public.operational_quality_re_evaluation_queue q
    left join public.profiles p on p.id = q.owner_id
    where p.id is null
  ) then
    raise exception 'Owner identity repair left queue rows with invalid profile owners';
  end if;
end;
$$;

commit;
