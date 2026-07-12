create or replace function public.prevent_overlapping_confirmed_bookings()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('confirmed', 'completed') then
    return new;
  end if;

  if exists (
    select 1
    from public.bookings existing
    where existing.property_id = new.property_id

      -- Ignore the same database row during ordinary updates.
      and existing.id is distinct from new.id

      -- Ignore the same external reservation during an upsert.
      and (
        existing.external_provider
          is distinct from new.external_provider
        or existing.external_reservation_id
          is distinct from new.external_reservation_id
      )

      -- Only inventory-blocking reservations cause conflicts.
      and existing.status in ('confirmed', 'completed')

      -- Checkout dates are non-occupied.
      and existing.check_in < new.check_out
      and existing.check_out > new.check_in
  ) then
    raise exception
      'Property is already booked for the selected dates.';
  end if;

  return new;
end;
$$;
