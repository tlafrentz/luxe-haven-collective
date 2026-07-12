create or replace function public.prevent_overlapping_confirmed_bookings()
returns trigger
language plpgsql
as $$
begin
  /*
   * Only active, inventory-blocking reservations should be
   * checked for overlaps.
   */
  if new.status not in ('confirmed', 'completed') then
    return new;
  end if;

  if exists (
    select 1
    from public.bookings existing
    where existing.property_id = new.property_id

      /*
       * Exclude the row currently being updated.
       * Without this, an upserted reservation overlaps itself.
       */
      and existing.id <> new.id

      /*
       * Cancelled and pending reservations do not block inventory.
       */
      and existing.status in ('confirmed', 'completed')

      /*
       * Half-open date ranges:
       * checkout day does not count as an occupied night.
       */
      and existing.check_in < new.check_out
      and existing.check_out > new.check_in
  ) then
    raise exception
      'Property is already booked for the selected dates.';
  end if;

  return new;
end;
$$;
