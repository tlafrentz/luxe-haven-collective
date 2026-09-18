-- LHS-001 v2.0: Mesa Direct Booking REQUEST pilot.
--
-- Forward migration over the LHS-001 v1 foundation (20260916120000) per
-- LHS-MIG-001/002: checkout_attempts is extended into booking_requests
-- rather than replaced, and every existing row is mapped forward before the
-- status domain changes, so nothing is silently reclassified as confirmed.
--
-- Hospitable Direct's paid widget/checkout/API dependency is dropped
-- entirely (LHS-HOS-001). In its place: a guest submits a request (no
-- payment), an operator records a calendar-block as a server-enforced hard
-- gate (LHS-PR-002/LHS-BLK-003), and only a verified Stripe webhook event —
-- re-checked against that gate at confirmation time, not just invitation
-- time — can atomically create one booking (LHS-CNF-001).
begin;

-- ============================================================
-- 1. checkout_attempts -> booking_requests
-- ============================================================

-- Drop the v1 status constraint before remapping data — some target values
-- (withdrawn, expired) aren't in the v1 domain, so the old constraint would
-- reject the very UPDATE that migrates rows into the new one.
alter table public.checkout_attempts drop constraint if exists checkout_attempts_status_check;

-- Map every existing row forward before the new status domain is enforced.
-- None of the v1 rows represent a genuine v2 submission (the v1 flow never
-- collected guest/contact details), so this is a safe, honest downgrade
-- rather than a promotion to a status it never earned.
update public.checkout_attempts set status = case status
  when 'confirmed' then 'confirmed'
  when 'abandoned' then 'withdrawn'
  else 'expired'
end;

alter table public.checkout_attempts rename to booking_requests;
alter table public.booking_requests rename column attempt_token to request_token;

alter table public.booking_requests
  add column if not exists adults integer,
  add column if not exists children integer not null default 0,
  add column if not exists pets integer not null default 0,
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists sla_due_at timestamptz,
  add column if not exists withdrawn_at timestamptz;

alter table public.booking_requests add constraint booking_requests_status_check check (
  status in ('draft','submitted','under_review','alternate_proposed','approved','awaiting_payment','confirmed','payment_failed','declined','withdrawn','expired')
);
alter table public.booking_requests alter column status set default 'draft';

comment on table public.booking_requests is 'Evolved from checkout_attempts (LHS-001 v1, see 20260916120000). Request lifecycle for the LHS-001 v2.0 assisted request-to-book pilot.';

alter index if exists checkout_attempts_pkey rename to booking_requests_pkey;
alter index if exists checkout_attempts_attempt_token_key rename to booking_requests_request_token_key;
alter index if exists checkout_attempts_property_idx rename to booking_requests_property_idx;
alter index if exists checkout_attempts_status_idx rename to booking_requests_status_idx;
alter policy "Admins read checkout attempts" on public.booking_requests rename to "Admins read booking requests";

-- ============================================================
-- 2. booking_request_guests — PII kept out of the operational row (LHS-DAT-001)
-- ============================================================

create table public.booking_request_guests(
  booking_request_id uuid primary key references public.booking_requests(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  visit_purpose text,
  accessibility_needs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.booking_request_guests enable row level security;
create policy "Admins read booking request guests" on public.booking_request_guests for select to authenticated using (public.is_admin());
grant select on public.booking_request_guests to authenticated;

-- ============================================================
-- 3. request_quotes — versioned, immutable once superseded
-- ============================================================

create table public.request_quotes(
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete cascade,
  version integer not null,
  status text not null default 'accepted' check (status in ('draft','superseded','accepted','expired')),
  nights integer not null check (nights > 0),
  nightly_rate_minor bigint not null check (nightly_rate_minor >= 0),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  cleaning_fee_minor bigint not null default 0 check (cleaning_fee_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  rate_config_version text not null,
  calculated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (booking_request_id, version)
);
create index request_quotes_request_idx on public.request_quotes(booking_request_id, version desc);
alter table public.request_quotes enable row level security;
create policy "Admins read request quotes" on public.request_quotes for select to authenticated using (public.is_admin());
grant select on public.request_quotes to authenticated;

-- ============================================================
-- 4. request_reviews — append-only operator decisions
-- ============================================================

create table public.request_reviews(
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete cascade,
  decision text not null check (decision in ('approved','alternate_proposed','declined','withdrawn')),
  actor_id uuid references public.profiles(id) on delete set null,
  decided_at timestamptz not null default now(),
  conflict_check_evidence jsonb not null default '{}'::jsonb,
  quote_id uuid references public.request_quotes(id) on delete set null,
  superseded_quote_id uuid references public.request_quotes(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  constraint request_reviews_evidence_object check (jsonb_typeof(conflict_check_evidence) = 'object')
);
create index request_reviews_request_idx on public.request_reviews(booking_request_id, decided_at desc);
alter table public.request_reviews enable row level security;
create policy "Admins read request reviews" on public.request_reviews for select to authenticated using (public.is_admin());
grant select on public.request_reviews to authenticated;
create trigger request_reviews_append_only before update or delete on public.request_reviews for each row execute function public.reject_append_only_change();

-- ============================================================
-- 5. calendar_blocks — the hard gate (LHS-BLK-001..006)
-- ============================================================

create table public.calendar_blocks(
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  arrival date not null,
  departure date not null,
  quote_id uuid not null references public.request_quotes(id) on delete restrict,
  environment text not null default 'live' check (environment in ('test','live')),
  calendar_system text not null,
  external_reference text,
  attestation text,
  artifact_reference text,
  operator_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  release_operator_id uuid references public.profiles(id) on delete set null,
  release_reference text,
  release_outcome text,
  status text not null default 'active' check (status in ('active','released','consumed','expired','superseded')),
  check (departure > arrival)
);
create index calendar_blocks_request_idx on public.calendar_blocks(booking_request_id, status);
-- At most one ACTIVE block per request — enforces LHS-BLK-001's "linked to
-- the exact request" at the database level, not just in application code.
create unique index calendar_blocks_active_per_request on public.calendar_blocks(booking_request_id) where status = 'active';
alter table public.calendar_blocks enable row level security;
create policy "Admins read calendar blocks" on public.calendar_blocks for select to authenticated using (public.is_admin());
grant select on public.calendar_blocks to authenticated;

-- ============================================================
-- 6. payment_invitations — Stripe Checkout Session tracking
-- ============================================================

create table public.payment_invitations(
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete cascade,
  quote_id uuid not null references public.request_quotes(id) on delete restrict,
  calendar_block_id uuid not null references public.calendar_blocks(id) on delete restrict,
  environment text not null default 'live' check (environment in ('test','live')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'created' check (status in ('created','started','succeeded','failed','expired','superseded')),
  idempotency_key text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payment_invitations_session_uidx on public.payment_invitations(environment, stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create index payment_invitations_intent_idx on public.payment_invitations(environment, stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index payment_invitations_request_idx on public.payment_invitations(booking_request_id, status);
-- At most one active invitation per request (LHS-PAY-006).
create unique index payment_invitations_active_per_request on public.payment_invitations(booking_request_id) where status in ('created','started');
alter table public.payment_invitations enable row level security;
create policy "Admins read payment invitations" on public.payment_invitations for select to authenticated using (public.is_admin());
grant select on public.payment_invitations to authenticated;

-- ============================================================
-- 7. booking_payment_events — Stripe webhook idempotency ledger,
--    dedicated to the booking domain (mirrors commerce_webhook_receipts'
--    shape but isolated from the SaaS commerce webhook boundary).
-- ============================================================

create table public.booking_payment_events(
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'live' check (environment in ('test','live')),
  provider_event_id text not null,
  provider_event_type text not null,
  provider_created_at timestamptz,
  status text not null default 'received' check (status in ('received','processed','duplicate','ignored','failed')),
  related_payment_invitation_id uuid references public.payment_invitations(id) on delete set null,
  related_booking_request_id uuid references public.booking_requests(id) on delete set null,
  normalized_event jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error_code text,
  last_error_message text,
  unique (environment, provider_event_id),
  constraint booking_payment_events_normalized_object check (jsonb_typeof(normalized_event) = 'object')
);
create index booking_payment_events_request_idx on public.booking_payment_events(related_booking_request_id);
alter table public.booking_payment_events enable row level security;
create policy "Admins read booking payment events" on public.booking_payment_events for select to authenticated using (public.is_admin());
grant select on public.booking_payment_events to authenticated;
create trigger booking_payment_events_core_immutable
  before update of provider_event_id, provider_event_type, provider_created_at, received_at, environment or delete
  on public.booking_payment_events
  for each row execute function public.reject_append_only_change();

-- ============================================================
-- 8. bookings — direct-booking authority linkage
-- ============================================================

alter table public.bookings rename column checkout_attempt_id to booking_request_id;
alter index if exists bookings_checkout_attempt_idx rename to bookings_booking_request_idx;
alter table public.bookings add column if not exists payment_invitation_id uuid references public.payment_invitations(id) on delete set null;
-- One confirmed booking per request (LHS-NFR-001).
create unique index if not exists bookings_booking_request_uidx on public.bookings(booking_request_id) where booking_request_id is not null;

-- ============================================================
-- 9. booking_exceptions — add a direct join to the new domain
-- ============================================================

alter table public.booking_exceptions add column if not exists booking_request_id uuid references public.booking_requests(id) on delete set null;
create index if not exists booking_exceptions_request_idx on public.booking_exceptions(booking_request_id);

-- ============================================================
-- 10. confirm_booking_from_payment — the atomic confirmation transaction.
--     Modeled directly on process_commerce_provider_event
--     (20260725235900_commerce_payments_webhooks.sql): idempotent receipt,
--     row lock for the duration of the transaction, defense-in-depth
--     mismatch checks before ever mutating state, never raises to the
--     caller — an unreconcilable event becomes a booking_exceptions row,
--     not a thrown error and not a silent confirmation (LHS-PR-006/
--     LHS-CNF-002).
-- ============================================================

create or replace function public.confirm_booking_from_payment(p_event jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_environment text := p_event->>'environment';
  v_event_type text := p_event->>'providerEventType';
  v_provider_event_id text := p_event->>'providerEventId';
  v_session_id text := nullif(p_event->>'providerCheckoutSessionId','');
  v_intent_id text := nullif(p_event->>'providerPaymentIntentId','');
  v_amount bigint := nullif(p_event->>'amountMinor','')::bigint;
  v_currency text := upper(nullif(p_event->>'currency',''));
  v_receipt_id uuid;
  v_existing_status text;
  v_invitation public.payment_invitations%rowtype;
  v_request public.booking_requests%rowtype;
  v_block public.calendar_blocks%rowtype;
  v_quote public.request_quotes%rowtype;
  v_guest public.booking_request_guests%rowtype;
  v_booking_id uuid;
  v_exception_id uuid;
begin
  insert into public.booking_payment_events(environment, provider_event_id, provider_event_type, provider_created_at, status, normalized_event)
  values (v_environment, v_provider_event_id, v_event_type, nullif(p_event->>'providerCreatedAt','')::timestamptz, 'received', p_event)
  on conflict (environment, provider_event_id) do nothing
  returning id into v_receipt_id;

  if v_receipt_id is null then
    select id, status into v_receipt_id, v_existing_status from public.booking_payment_events
      where environment = v_environment and provider_event_id = v_provider_event_id;
    if v_existing_status in ('processed','ignored') then
      return jsonb_build_object('status','duplicate','receiptId',v_receipt_id);
    end if;
  end if;

  if v_event_type not in ('checkout.completed','payment.succeeded','payment.failed','payment.cancelled','checkout.expired') then
    update public.booking_payment_events set status='ignored', processed_at=now() where id=v_receipt_id;
    return jsonb_build_object('status','ignored','receiptId',v_receipt_id);
  end if;

  select * into v_invitation from public.payment_invitations
    where environment = v_environment
      and (
        (v_session_id is not null and stripe_checkout_session_id = v_session_id)
        or (v_intent_id is not null and stripe_payment_intent_id = v_intent_id)
      )
    for update;

  if not found then
    update public.booking_payment_events set status='failed', last_error_code='payment_invitation_not_found', processed_at=now() where id=v_receipt_id;
    insert into public.booking_exceptions(issue_type, status, provider_evidence, next_action)
      values ('payment_invitation_not_found', 'open', jsonb_build_object('providerEventId', v_provider_event_id, 'sessionId', v_session_id, 'intentId', v_intent_id), 'Reconcile against Stripe dashboard; no local invitation matched this event.')
      returning id into v_exception_id;
    return jsonb_build_object('status','review_required','receiptId',v_receipt_id,'exceptionId',v_exception_id);
  end if;

  -- Idempotent re-delivery of an already-succeeded invitation.
  if v_invitation.status = 'succeeded' then
    select id into v_booking_id from public.bookings where payment_invitation_id = v_invitation.id;
    update public.booking_payment_events set status='processed', related_payment_invitation_id=v_invitation.id, related_booking_request_id=v_invitation.booking_request_id, processed_at=now() where id=v_receipt_id;
    return jsonb_build_object('status','processed','receiptId',v_receipt_id,'bookingId',v_booking_id,'duplicate',true);
  end if;

  if v_event_type in ('payment.failed','payment.cancelled') then
    update public.payment_invitations set status='failed', stripe_payment_intent_id=coalesce(v_intent_id, stripe_payment_intent_id), updated_at=now() where id=v_invitation.id;
    update public.booking_requests set status='payment_failed', updated_at=now() where id=v_invitation.booking_request_id and status='awaiting_payment';
    update public.booking_payment_events set status='processed', related_payment_invitation_id=v_invitation.id, related_booking_request_id=v_invitation.booking_request_id, processed_at=now() where id=v_receipt_id;
    return jsonb_build_object('status','processed','receiptId',v_receipt_id,'outcome','payment_failed');
  end if;

  if v_event_type = 'checkout.expired' then
    update public.payment_invitations set status='expired', updated_at=now() where id=v_invitation.id and status in ('created','started');
    update public.booking_requests set status='expired', updated_at=now() where id=v_invitation.booking_request_id and status='awaiting_payment';
    update public.booking_payment_events set status='processed', related_payment_invitation_id=v_invitation.id, related_booking_request_id=v_invitation.booking_request_id, processed_at=now() where id=v_receipt_id;
    return jsonb_build_object('status','processed','receiptId',v_receipt_id,'outcome','expired');
  end if;

  -- checkout.completed / payment.succeeded: the confirmation path.
  if v_intent_id is not null then
    update public.payment_invitations set stripe_payment_intent_id = v_intent_id where id = v_invitation.id and stripe_payment_intent_id is null;
  end if;

  select * into v_request from public.booking_requests where id = v_invitation.booking_request_id for update;
  select * into v_block from public.calendar_blocks where id = v_invitation.calendar_block_id for update;
  select * into v_quote from public.request_quotes where id = v_invitation.quote_id;
  select * into v_guest from public.booking_request_guests where booking_request_id = v_request.id;

  -- Defense in depth: re-check the hard gate at confirmation time, not just
  -- invitation-creation time (LHS-CNF-001 "confirm eligibility").
  if v_request.status <> 'awaiting_payment'
     or v_block.status <> 'active'
     or v_block.expires_at <= now()
     or v_block.booking_request_id <> v_request.id
     or v_block.quote_id <> v_invitation.quote_id
     or (v_amount is not null and v_amount <> v_invitation.amount_minor)
     or (v_currency is not null and v_currency <> upper(v_invitation.currency))
  then
    update public.booking_payment_events set status='failed', last_error_code='gate_invalid_at_confirmation', processed_at=now() where id=v_receipt_id;
    insert into public.booking_exceptions(issue_type, property_id, booking_request_id, status, provider_evidence, next_action)
      values ('payment_verified_gate_invalid', v_request.property_id, v_request.id, 'open',
        jsonb_build_object('providerEventId', v_provider_event_id, 'requestStatus', v_request.status, 'blockStatus', v_block.status, 'eventAmount', v_amount, 'invitationAmount', v_invitation.amount_minor),
        'Payment was verified by Stripe but the calendar-block gate was no longer valid. Reconcile manually — do not confirm without re-establishing the block.')
      returning id into v_exception_id;
    return jsonb_build_object('status','review_required','receiptId',v_receipt_id,'exceptionId',v_exception_id);
  end if;

  insert into public.bookings(
    property_id, guest_id, check_in, check_out, guests, total_amount, currency, status,
    source, external_provider, booking_code, guest_full_name, guest_email, guest_phone,
    nightly_rate, cleaning_fee, taxes,
    payment_status, stripe_payment_intent_id, booking_request_id, payment_invitation_id
  ) values (
    v_request.property_id, null, v_request.arrival, v_request.departure, coalesce(v_request.guest_count, 1),
    v_invitation.amount_minor / 100.0, v_invitation.currency, 'confirmed',
    'Luxe Haven Direct', null, 'LHS-MESA-' || upper(substr(v_invitation.id::text, 1, 8)),
    v_guest.full_name, v_guest.email, v_guest.phone,
    coalesce(v_quote.nightly_rate_minor, 0) / 100.0, coalesce(v_quote.cleaning_fee_minor, 0) / 100.0, coalesce(v_quote.tax_minor, 0) / 100.0,
    'paid', v_intent_id, v_request.id, v_invitation.id
  ) returning id into v_booking_id;

  update public.payment_invitations set status='succeeded', updated_at=now() where id = v_invitation.id;
  update public.booking_requests set status='confirmed', updated_at=now() where id = v_request.id;
  update public.calendar_blocks set status='consumed' where id = v_block.id;
  update public.booking_payment_events set status='processed', related_payment_invitation_id=v_invitation.id, related_booking_request_id=v_request.id, processed_at=now() where id=v_receipt_id;

  return jsonb_build_object('status','processed','receiptId',v_receipt_id,'bookingId',v_booking_id,'outcome','confirmed');
exception when others then
  update public.booking_payment_events set status='failed', last_error_code=sqlerrm, last_error_message='Booking payment event requires operational review.', processed_at=now() where id=v_receipt_id;
  insert into public.booking_exceptions(issue_type, status, provider_evidence, next_action)
    values ('booking_confirmation_failed', 'open', jsonb_build_object('providerEventId', v_provider_event_id, 'sqlError', sqlerrm), 'A verified payment could not be atomically confirmed. Reconcile Stripe and the booking_requests/bookings tables manually.');
  return jsonb_build_object('status','failed','receiptId',v_receipt_id,'errorCode',sqlerrm);
end $$;
revoke all on function public.confirm_booking_from_payment(jsonb) from public,anon,authenticated;
grant execute on function public.confirm_booking_from_payment(jsonb) to service_role;

commit;
