alter table public.bookings
  add column if not exists guest_full_name text,
  add column if not exists guest_email text,
  add column if not exists guest_phone text,
  add column if not exists nightly_rate numeric(10,2) not null default 0,
  add column if not exists cleaning_fee numeric(10,2) not null default 0,
  add column if not exists taxes numeric(10,2) not null default 0,
  add column if not exists service_fee numeric(10,2) not null default 0,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists stripe_payment_intent_id text,
  add column if not exists source text not null default 'Direct',
  add column if not exists notes text;

alter table public.bookings
  drop constraint if exists bookings_payment_status_check;

alter table public.bookings
  add constraint bookings_payment_status_check
  check (
    payment_status in (
      'unpaid',
      'authorized',
      'paid',
      'refunded',
      'failed'
    )
  );

create index if not exists bookings_check_in_check_out_idx
on public.bookings (check_in, check_out);

create index if not exists bookings_status_idx
on public.bookings (status);

comment on table public.bookings is
  'Canonical owner-scoped reservation records synchronized from hospitality providers.';

comment on column public.bookings.source is
  'Customer-facing booking channel normalized during provider ingestion.';
