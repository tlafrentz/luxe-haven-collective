-- LHS-001 pilot readiness: transactional email ledger for the request-to-book
-- flow (guest + operator notifications).
--
-- One row per (request, template, dedupe key). The row is claimed *before*
-- sending, so a retried webhook, a double click or an overlapping cron run can
-- never send the same email twice (at-most-once). Recipient addresses are NOT
-- stored here — they are resolved from booking_request_guests at send time —
-- so this table holds no additional PII.
begin;

create table public.booking_notifications(
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete cascade,
  template text not null check (template in (
    'request_received','alternate_proposed','payment_ready','request_declined','request_expired',
    'booking_confirmed','refund_issued','operator_new_request','operator_review_overdue')),
  audience text not null check (audience in ('guest','operator')),
  dedupe_key text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  provider_message_id text,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_request_id, template, dedupe_key)
);
create index booking_notifications_request_idx on public.booking_notifications(booking_request_id, created_at desc);
alter table public.booking_notifications enable row level security;
create policy "Admins read booking notifications" on public.booking_notifications for select to authenticated using (public.is_admin());
grant select on public.booking_notifications to authenticated;

commit;
