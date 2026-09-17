-- LHS-001: Mesa direct booking pilot foundation.
-- Canonicalizes the Mesa property route, and adds the tables needed to run a
-- guest-initiated Hospitable-backed checkout without becoming a second
-- reservation system: checkout attempts (LHS-UX-021/LHS-AN-002), a Hospitable
-- reservation-webhook idempotency ledger (LHS-INT-013/014), and a booking
-- exception queue (LHS-OPS-005). Hospitable remains the sole write authority
-- for reservation state (LHS-PR-001) — every table here is written only by
-- server code via the service role; RLS exists solely to gate admin reads,
-- matching the admin_audit_events/sync_attempts convention.
begin;

-- LHS-IA-005: canonical route is /stays/mesa. Flag the property as eligible
-- for the direct-booking flow via metadata rather than hardcoding its slug
-- into page components (see src/lib/direct-booking.ts).
update public.properties
  set slug = 'mesa',
      metadata = metadata || '{"direct_booking_enabled": true}'::jsonb
  where slug = 'mesa-downtown-retreat';

create table public.checkout_attempts(
  id uuid primary key default gen_random_uuid(),
  attempt_token text not null unique,
  property_id uuid not null references public.properties(id) on delete restrict,
  external_property_id text,
  arrival date,
  departure date,
  guest_count integer check (guest_count is null or guest_count > 0),
  status text not null default 'started'
    check (status in ('started','redirected','verification_pending','confirmed','abandoned','failed')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referral_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours')
);
create index checkout_attempts_property_idx on public.checkout_attempts(property_id, created_at desc);
create index checkout_attempts_status_idx on public.checkout_attempts(status, created_at desc);

-- Mirrors the commerce_webhook_receipts shape (20260725235900) for the same
-- reason: a unique (environment, provider_event_id) ledger row per inbound
-- event is the idempotency mechanism, and provider_created_at is what lets
-- the consumer refuse an out-of-order event instead of overwriting newer
-- provider state.
create table public.hospitable_reservation_events(
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'live' check (environment in ('test','live')),
  provider_event_id text not null,
  provider_event_type text not null,
  provider_created_at timestamptz,
  status text not null default 'received'
    check (status in ('received','processed','duplicate','unresolved','ignored','failed')),
  related_property_id uuid references public.properties(id) on delete set null,
  related_reservation_external_id text,
  normalized_event jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error_code text,
  last_error_message text,
  unique (environment, provider_event_id),
  constraint hospitable_reservation_events_normalized_object check (jsonb_typeof(normalized_event) = 'object')
);
create index hospitable_reservation_events_reservation_idx on public.hospitable_reservation_events(related_reservation_external_id);
create index hospitable_reservation_events_received_idx on public.hospitable_reservation_events(received_at desc);

create table public.booking_exceptions(
  id uuid primary key default gen_random_uuid(),
  reservation_external_id text,
  property_id uuid references public.properties(id) on delete set null,
  issue_type text not null,
  detected_at timestamptz not null default now(),
  provider_evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewing','resolved')),
  next_action text,
  owner_id uuid references public.profiles(id) on delete set null,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_exceptions_evidence_object check (jsonb_typeof(provider_evidence) = 'object')
);
create index booking_exceptions_status_idx on public.booking_exceptions(status, detected_at desc);
create index booking_exceptions_reservation_idx on public.booking_exceptions(reservation_external_id);

-- Attribution join from a confirmed projection back to the checkout attempt
-- that started it (LHS-AN-002/003), without making bookings depend on
-- checkout_attempts for anything authoritative.
alter table public.bookings
  add column if not exists checkout_attempt_id uuid references public.checkout_attempts(id) on delete set null;
create index if not exists bookings_checkout_attempt_idx on public.bookings(checkout_attempt_id);

alter table public.checkout_attempts enable row level security;
alter table public.hospitable_reservation_events enable row level security;
alter table public.booking_exceptions enable row level security;

create policy "Admins read checkout attempts" on public.checkout_attempts for select to authenticated using (public.is_admin());
create policy "Admins read hospitable reservation events" on public.hospitable_reservation_events for select to authenticated using (public.is_admin());
create policy "Admins read booking exceptions" on public.booking_exceptions for select to authenticated using (public.is_admin());
grant select on public.checkout_attempts, public.hospitable_reservation_events, public.booking_exceptions to authenticated;

-- Identity/timestamp fields are append-only once received; status/processed_at
-- may still progress as the webhook handler works the row (LHS-INT-013).
create trigger hospitable_reservation_events_core_immutable
  before update of provider_event_id, provider_event_type, provider_created_at, received_at, environment or delete
  on public.hospitable_reservation_events
  for each row execute function public.reject_append_only_change();

commit;
