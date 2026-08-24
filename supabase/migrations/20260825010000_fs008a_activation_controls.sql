-- FS-008A: Furnishing activation controls. Safe defaults are globally disabled;
-- this migration does not activate offers, entitlements, projects, or catalog.
create table public.furnishing_activation_releases(
 id uuid primary key default gen_random_uuid(), milestone text not null default 'FS-008A' check(milestone='FS-008A'), release_status text not null default 'draft' check(release_status in('draft','candidate','ready','active','paused','retired')), policy_version text not null, global_state text not null default 'disabled' check(global_state in('disabled','internal','limited','enabled','paused')), global_kill_switch boolean not null default true, configuration_valid boolean not null default false, optimistic_version bigint not null default 1, reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(milestone,policy_version));
create table public.furnishing_activation_workspaces(
 id uuid primary key default gen_random_uuid(), release_id uuid not null references public.furnishing_activation_releases(id), workspace_id uuid not null, enabled boolean not null default false, kill_switch boolean not null default true, cohort text check(cohort in('internal','founding_partner','limited_customer','general_availability')), effective_from timestamptz, expires_at timestamptz, revoked_at timestamptz, approved_by uuid references public.profiles(id), reason text, optimistic_version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(release_id,workspace_id));
create table public.furnishing_activation_capabilities(
 id uuid primary key default gen_random_uuid(), release_id uuid not null references public.furnishing_activation_releases(id), capability text not null check(capability in('offer_discovery','checkout','entitlement_activation','onboarding','project_creation','catalog_viewing','design_workspace','budgeting','procurement_readiness','installation_readiness','customer_notifications','retailer_ordering')), enabled boolean not null default false, optimistic_version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(release_id,capability));
create table public.furnishing_activation_audit_events(
 id uuid primary key default gen_random_uuid(), release_id uuid references public.furnishing_activation_releases(id), workspace_id uuid, actor_id uuid references public.profiles(id), actor_role text, event_type text not null, reason_code text not null, correlation_id text not null, policy_version text not null, candidate_commit text, deployment_id text, before_state jsonb not null default '{}'::jsonb, after_state jsonb not null default '{}'::jsonb, safe_metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now());
alter table public.furnishing_activation_releases enable row level security; alter table public.furnishing_activation_workspaces enable row level security; alter table public.furnishing_activation_capabilities enable row level security; alter table public.furnishing_activation_audit_events enable row level security;
create policy "admins read furnishing activation releases" on public.furnishing_activation_releases for select to authenticated using(public.is_admin());
create policy "admins read furnishing activation workspaces" on public.furnishing_activation_workspaces for select to authenticated using(public.is_admin() or exists(select 1 from public.workspace_memberships m where m.workspace_id=furnishing_activation_workspaces.workspace_id and m.profile_id=auth.uid() and m.status='active'));
create policy "admins read furnishing activation capabilities" on public.furnishing_activation_capabilities for select to authenticated using(public.is_admin());
create policy "admins read furnishing activation audit" on public.furnishing_activation_audit_events for select to authenticated using(public.is_admin());
revoke all on public.furnishing_activation_releases,public.furnishing_activation_workspaces,public.furnishing_activation_capabilities,public.furnishing_activation_audit_events from anon;
revoke insert,update,delete on public.furnishing_activation_releases,public.furnishing_activation_workspaces,public.furnishing_activation_capabilities,public.furnishing_activation_audit_events from authenticated;
insert into public.furnishing_activation_releases(milestone,release_status,policy_version,global_state,global_kill_switch,configuration_valid,reason) values('FS-008A','candidate','fs008a-v1','disabled',true,false,'FS-008A safe disabled baseline') on conflict(milestone,policy_version) do nothing;

-- Database-level ceiling: no commercial, publication, project, notification,
-- installation, or retailer-order mutation can bypass the disabled policy.
create or replace function public.fs008a_deny_furnishing_effect() returns trigger language plpgsql security definer set search_path='' as $$
begin
  raise exception 'FURNISHING_ACTIVATION_DISABLED' using errcode='42501';
end $$;
create or replace function public.fs008a_furnishing_effects_disabled() returns boolean language sql security definer set search_path='' as $$
  select exists(select 1 from public.furnishing_activation_releases where milestone='FS-008A' and (global_kill_switch or global_state='disabled' or not configuration_valid));
$$;
-- These triggers are intentionally explicit and forward-only. Reads remain available.
do $$ declare t text; begin
  foreach t in array array['commercial_catalog_publications','furnishing_projects','furnishing_procurement_orders','furnishing_purchase_batches','furnishing_installation_projects'] loop
    execute format('drop trigger if exists fs008a_disabled_effect on public.%I',t);
    execute format('create trigger fs008a_disabled_effect before insert or update on public.%I for each row when (public.fs008a_furnishing_effects_disabled()) execute function public.fs008a_deny_furnishing_effect()',t);
  end loop;
end $$;
revoke all on function public.fs008a_deny_furnishing_effect(),public.fs008a_furnishing_effects_disabled() from public,anon,authenticated;
grant execute on function public.fs008a_furnishing_effects_disabled() to service_role;
