-- FS-008C-P2.1: entitlement-bound, resumable onboarding sessions.
create table if not exists public.furnishing_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  tenant_id uuid not null,
  entitlement_id uuid not null unique references public.commercial_entitlements(id),
  handoff_id uuid not null unique,
  offer_code text not null check (offer_code in ('FS-CONSULT','FS-DESIGN')),
  offer_version integer not null check (offer_version > 0),
  schema_version integer not null check (schema_version > 0),
  project_type text not null check (project_type in ('consultation','design')),
  status text not null default 'in_progress' check (status in ('not_started','in_progress','ready_to_submit','submitted','activated','blocked','canceled','superseded')),
  current_step text not null default 'service_confirmation',
  completed_steps jsonb not null default '[]',
  property_path text not null default 'not_selected' check (property_path in ('not_selected','existing','new')),
  draft jsonb not null default '{}',
  optimistic_version integer not null default 1 check (optimistic_version > 0),
  idempotency_key text not null unique,
  correlation_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  activated_at timestamptz
);
create index if not exists furnishing_onboarding_sessions_tenant_idx on public.furnishing_onboarding_sessions(tenant_id, customer_id, status);

create table if not exists public.furnishing_onboarding_audit (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.furnishing_onboarding_sessions(id),
  event_type text not null,
  reason_code text not null,
  correlation_id text not null,
  occurred_at timestamptz not null default now()
);
alter table public.furnishing_onboarding_sessions enable row level security;
alter table public.furnishing_onboarding_audit enable row level security;
create policy "customers read own furnishing onboarding" on public.furnishing_onboarding_sessions for select to authenticated using (customer_id = auth.uid() and exists (select 1 from public.customer_account_memberships m where m.profile_id = auth.uid() and m.tenant_id = furnishing_onboarding_sessions.tenant_id and m.status = 'active'));
create policy "admins read furnishing onboarding" on public.furnishing_onboarding_sessions for select to authenticated using (public.is_admin());
create policy "admins read furnishing onboarding audit" on public.furnishing_onboarding_audit for select to authenticated using (public.is_admin());
revoke all on public.furnishing_onboarding_sessions, public.furnishing_onboarding_audit from anon;
revoke insert, update, delete on public.furnishing_onboarding_sessions, public.furnishing_onboarding_audit from authenticated;
