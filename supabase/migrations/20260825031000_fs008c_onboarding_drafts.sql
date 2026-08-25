-- FS-008C-P2.3A: versioned, tenant-bound step drafts.
create table if not exists public.furnishing_onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.furnishing_onboarding_sessions(id),
  tenant_id uuid not null,
  schema_id text not null check (schema_id in ('FS-CONSULT','FS-DESIGN')),
  schema_version integer not null check (schema_version > 0),
  step_id text not null,
  values jsonb not null default '{}',
  completed boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  actor_id uuid not null references public.profiles(id),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, step_id, revision)
);
alter table public.furnishing_onboarding_drafts enable row level security;
create policy "customers read own furnishing drafts" on public.furnishing_onboarding_drafts for select to authenticated using (actor_id = auth.uid() and tenant_id in (select m.tenant_id from public.customer_account_memberships m where m.profile_id = auth.uid() and m.status = 'active'));
create policy "admins read furnishing drafts" on public.furnishing_onboarding_drafts for select to authenticated using (public.is_admin());
revoke all on public.furnishing_onboarding_drafts from anon;
revoke insert, update, delete on public.furnishing_onboarding_drafts from authenticated;
