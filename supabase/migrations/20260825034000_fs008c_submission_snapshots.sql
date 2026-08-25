-- FS-008C-P2.4A: immutable sanitized intake submission snapshots.
create table if not exists public.furnishing_onboarding_submission_snapshots (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.furnishing_onboarding_sessions(id), tenant_id uuid not null,
 offer_code text not null check(offer_code in('FS-CONSULT','FS-DESIGN')), offer_version integer not null, schema_version integer not null,
 snapshot jsonb not null, content_hash text not null, created_at timestamptz not null default now(), unique(session_id), unique(session_id,content_hash)
);
alter table public.furnishing_onboarding_submission_snapshots enable row level security;
create policy "customers read own furnishing snapshots" on public.furnishing_onboarding_submission_snapshots for select to authenticated using(tenant_id in(select m.tenant_id from public.customer_account_memberships m where m.profile_id=auth.uid() and m.status='active'));
create policy "admins read furnishing snapshots" on public.furnishing_onboarding_submission_snapshots for select to authenticated using(public.is_admin());
revoke all on public.furnishing_onboarding_submission_snapshots from anon;
revoke insert,update,delete on public.furnishing_onboarding_submission_snapshots from authenticated;
