alter table public.bookings
  add column if not exists external_provider text,
  add column if not exists external_reservation_id text,
  add column if not exists external_property_id text,
  add column if not exists external_platform text,
  add column if not exists booking_code text,
  add column if not exists external_guest_id text,
  add column if not exists currency text,
  add column if not exists host_revenue numeric,
  add column if not exists host_service_fee numeric,
  add column if not exists discount_amount numeric,
  add column if not exists last_synced_at timestamptz,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

alter table public.bookings
  add constraint bookings_external_provider_check
  check (
    external_provider is null
    or external_provider in ('hospitable')
  )
  not valid;

alter table public.bookings
  validate constraint bookings_external_provider_check;

create unique index if not exists
  bookings_external_provider_reservation_id_key
on public.bookings (
  external_provider,
  external_reservation_id
)
where
  external_provider is not null
  and external_reservation_id is not null;

create index if not exists
  bookings_external_property_id_idx
on public.bookings (external_property_id);

create index if not exists
  bookings_booking_code_idx
on public.bookings (booking_code);

create index if not exists
  bookings_property_check_in_idx
on public.bookings (
  property_id,
  check_in
);

comment on column public.bookings.external_provider is
  'External PMS or reservation provider that supplied the booking.';

comment on column public.bookings.external_reservation_id is
  'Stable reservation identifier from the external provider.';

comment on column public.bookings.external_property_id is
  'External property identifier supplied by the reservation provider.';

comment on column public.bookings.external_platform is
  'Original booking channel reported by the provider, such as airbnb, booking, direct, or vrbo-official.';

comment on column public.bookings.booking_code is
  'Guest-facing reservation or confirmation code.';

comment on column public.bookings.external_guest_id is
  'Stable guest identifier supplied by the external provider.';

comment on column public.bookings.host_revenue is
  'Net host revenue reported by the external provider.';

comment on column public.bookings.host_service_fee is
  'Service fees charged to the host. Stored as a positive expense amount.';

comment on column public.bookings.discount_amount is
  'Total reservation discounts. Stored as a positive amount.';

comment on column public.bookings.raw_payload is
  'Original external reservation payload retained for reconciliation and future mappings.';
