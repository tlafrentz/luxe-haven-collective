-- FS-008C-P2.4B: exactly-once project lineage (activation remains policy-gated).
create table if not exists public.furnishing_onboarding_projects (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, customer_id uuid not null, property_id uuid not null,
 entitlement_id uuid not null, handoff_id uuid not null, session_id uuid not null unique references public.furnishing_onboarding_sessions(id), snapshot_id uuid not null unique references public.furnishing_onboarding_submission_snapshots(id),
 offer_code text not null check(offer_code in('FS-CONSULT','FS-DESIGN')), offer_version integer not null, status text not null check(status in('consultation_intake_complete','design_intake_complete')),
 activated_at timestamptz not null default now(), unique(entitlement_id,handoff_id), unique(session_id,snapshot_id)
);
alter table public.furnishing_onboarding_projects enable row level security;
create policy "customers read own furnishing projects" on public.furnishing_onboarding_projects for select to authenticated using(customer_id=auth.uid() and tenant_id in(select m.tenant_id from public.customer_account_memberships m where m.profile_id=auth.uid() and m.status='active'));
create policy "admins read furnishing projects" on public.furnishing_onboarding_projects for select to authenticated using(public.is_admin());
revoke all on public.furnishing_onboarding_projects from anon;
revoke insert,update,delete on public.furnishing_onboarding_projects from authenticated;
