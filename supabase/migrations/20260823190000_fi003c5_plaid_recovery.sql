-- FI-003C5: durable recovery state, idempotent webhook receipts, and safe audit.
alter table public.financial_provider_connections
  drop constraint if exists financial_provider_connections_status_check;
update public.financial_provider_connections set status=case status
  when 'active' then 'healthy'
  when 'selecting-accounts' then 'syncing'
  when 'attention' then 'reauth_required'
  else status end;
alter table public.financial_provider_connections
  alter column status set default 'syncing',
  add constraint financial_provider_connections_status_check
    check(status in('healthy','syncing','reauth_required','provider_degraded','disconnected','failed')),
  add column if not exists disconnected_at timestamptz,
  add column if not exists sync_started_at timestamptz;

create table if not exists public.financial_provider_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null check(provider='plaid'),
  delivery_key text not null,
  body_sha256 text not null,
  provider_item_ref text,
  connection_id uuid references public.financial_provider_connections(id) on delete set null,
  webhook_type text not null,
  webhook_code text not null,
  status text not null check(status in('processing','processed','ignored','failed')),
  attempts integer not null default 1,
  last_error_code text,
  safe_metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider,delivery_key)
);
create table if not exists public.financial_provider_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  connection_id uuid references public.financial_provider_connections(id) on delete set null,
  event_type text not null,
  correlation_id text not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  actor_profile_id uuid references public.profiles(id),
  occurred_at timestamptz not null default now()
);
create index if not exists financial_provider_receipts_status_idx on public.financial_provider_webhook_receipts(status,received_at);
create index if not exists financial_provider_audit_connection_idx on public.financial_provider_audit_events(connection_id,occurred_at desc);
alter table public.financial_provider_webhook_receipts enable row level security;
alter table public.financial_provider_audit_events enable row level security;
revoke all on public.financial_provider_webhook_receipts from anon,authenticated;
revoke all on public.financial_provider_audit_events from anon,authenticated;
grant all on public.financial_provider_webhook_receipts to service_role;
grant all on public.financial_provider_audit_events to service_role;
