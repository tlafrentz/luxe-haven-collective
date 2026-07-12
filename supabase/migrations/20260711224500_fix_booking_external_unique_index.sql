drop index if exists
  public.bookings_external_provider_reservation_id_key;

create unique index
  bookings_external_provider_reservation_id_key
on public.bookings (
  external_provider,
  external_reservation_id
);
