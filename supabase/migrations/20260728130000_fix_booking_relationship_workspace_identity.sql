-- GC-001: booking relationship events inherit the property's canonical owners.id.
begin;

create or replace function public.capture_guest_booking_relationship_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  workspace uuid;
  event_name text;
  occurred timestamptz;
begin
  if new.primary_guest_id is null then
    return new;
  end if;

  select property.owner_id
  into workspace
  from public.properties property
  where property.id = new.property_id;

  if workspace is null then
    return new;
  end if;

  event_name := case
    when tg_op = 'INSERT' then 'reservation-created'
    when new.status = 'cancelled'
      and old.status is distinct from new.status then 'reservation-cancelled'
    when new.status = 'completed'
      and old.status is distinct from new.status then 'checkout'
    when new.check_in = current_date
      and old.status is distinct from new.status then 'check-in'
    else 'reservation-updated'
  end;

  occurred := coalesce(new.updated_at,new.created_at,now());

  insert into public.guest_relationship_events(
    workspace_id,
    guest_id,
    occurred_at,
    event_type,
    category,
    visibility,
    actor_type,
    summary,
    reservation_id,
    booking_id,
    property_id,
    source_type,
    source_id,
    source_version,
    metadata
  )
  values(
    workspace,
    new.primary_guest_id,
    occurred,
    event_name,
    'reservations',
    'operational',
    'provider',
    case
      when event_name = 'reservation-created' then 'Reservation created.'
      when event_name = 'reservation-cancelled' then 'Reservation cancelled.'
      when event_name = 'checkout' then 'Guest checked out.'
      when event_name = 'check-in' then 'Guest checked in.'
      else 'Reservation details updated.'
    end,
    coalesce(new.external_reservation_id,new.booking_code,new.id::text),
    new.id,
    new.property_id,
    'booking',
    new.id::text,
    case
      when tg_op = 'INSERT' then 'created'
      else 'updated:' || occurred::text
    end,
    jsonb_build_object(
      'arrival',new.check_in,
      'departure',new.check_out,
      'status',new.status,
      'bookingSource',new.source,
      'nights',new.check_out-new.check_in
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

commit;
