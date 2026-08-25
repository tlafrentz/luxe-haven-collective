-- FS-008C-P2.3B: onboarding-only room and design profile drafts.
create table if not exists public.furnishing_onboarding_rooms (
  id uuid primary key, session_id uuid not null references public.furnishing_onboarding_sessions(id), tenant_id uuid not null, property_id uuid not null,
  room_type text not null, display_name text not null, instance_number integer not null, draft jsonb not null default '{}', revision integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(session_id, room_type, instance_number)
);
create table if not exists public.furnishing_onboarding_design_profiles (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.furnishing_onboarding_sessions(id), tenant_id uuid not null,
  schema_id text not null check(schema_id in ('FS-CONSULT','FS-DESIGN')), schema_version integer not null, revision integer not null, profile jsonb not null,
  created_at timestamptz not null default now(), unique(session_id, revision)
);
alter table public.furnishing_onboarding_rooms enable row level security; alter table public.furnishing_onboarding_design_profiles enable row level security;
create policy "customers read own furnishing room drafts" on public.furnishing_onboarding_rooms for select to authenticated using (tenant_id in (select m.tenant_id from public.customer_account_memberships m where m.profile_id=auth.uid() and m.status='active'));
create policy "customers read own furnishing profile drafts" on public.furnishing_onboarding_design_profiles for select to authenticated using (tenant_id in (select m.tenant_id from public.customer_account_memberships m where m.profile_id=auth.uid() and m.status='active'));
create policy "admins read furnishing draft rooms" on public.furnishing_onboarding_rooms for select to authenticated using(public.is_admin());
create policy "admins read furnishing draft profiles" on public.furnishing_onboarding_design_profiles for select to authenticated using(public.is_admin());
revoke all on public.furnishing_onboarding_rooms, public.furnishing_onboarding_design_profiles from anon;
revoke insert,update,delete on public.furnishing_onboarding_rooms, public.furnishing_onboarding_design_profiles from authenticated;
