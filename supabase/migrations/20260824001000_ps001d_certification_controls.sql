-- PS-001D certification controls. These records authorize verification use only;
-- they never grant application, tenant, capability, or entitlement permissions.

create table public.ps001d_verification_identity_authorizations (
  id uuid primary key default gen_random_uuid(),
  milestone text not null default 'PS-001D' check (milestone = 'PS-001D'),
  scenario text not null check (scenario in ('admin','authorized_operator','authorized_owner','wrong_tenant','anonymous')),
  user_id uuid references public.profiles(id),
  expected_role text not null,
  tenant_id uuid not null,
  tenant_relationship text not null check (tenant_relationship in ('platform_admin','active_member','wrong_tenant','unauthenticated')),
  candidate_commit text not null check (candidate_commit ~ '^[0-9a-f]{40}$'),
  deployment_id text not null check (deployment_id ~ '^dpl_[A-Za-z0-9]+$'),
  correlation_id text not null check (correlation_id ~ '^ps001d-[0-9a-f-]{36}$'),
  issued_by uuid not null references public.profiles(id),
  valid_from timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > valid_from),
  check ((scenario = 'anonymous' and user_id is null and expected_role = 'anonymous' and tenant_relationship = 'unauthenticated') or (scenario <> 'anonymous' and user_id is not null)),
  unique (candidate_commit,deployment_id,tenant_id,correlation_id,scenario)
);

create table public.ps001d_verification_claims (
  id uuid primary key default gen_random_uuid(),
  milestone text not null default 'PS-001D' check (milestone = 'PS-001D'),
  candidate_commit text not null check (candidate_commit ~ '^[0-9a-f]{40}$'),
  deployment_id text not null check (deployment_id ~ '^dpl_[A-Za-z0-9]+$'),
  tenant_id uuid not null,
  correlation_id text not null check (correlation_id ~ '^ps001d-[0-9a-f-]{36}$'),
  operator_id uuid not null references public.profiles(id),
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null check (status in ('acquired','consumed','completed','failed','expired')),
  mutation_started_at timestamptz,
  completed_at timestamptz,
  stable_failure_code text check (stable_failure_code is null or stable_failure_code ~ '^[A-Z0-9_]{1,80}$'),
  check (expires_at > acquired_at),
  unique (candidate_commit,deployment_id,tenant_id,correlation_id),
  unique (correlation_id),
  unique (id,correlation_id)
);

create unique index ps001d_one_active_claim_per_target
  on public.ps001d_verification_claims(candidate_commit,deployment_id,tenant_id)
  where status in ('acquired','consumed');

create table public.ps001d_verification_resource_ledger (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.ps001d_verification_claims(id),
  correlation_id text not null,
  tenant_id uuid not null,
  resource_type text not null check (resource_type in ('auth_identity','workspace_membership','property','booking','guest_communication','report_request','guidebook','furnishing_project')),
  canonical_resource_id text not null check (length(canonical_resource_id) between 1 and 200 and canonical_resource_id !~ '[[:space:]/:]'),
  creating_scenario text not null check (creating_scenario in ('admin','authorized_operator','authorized_owner')),
  dependency_order integer not null check (dependency_order between 0 and 1000),
  status text not null check (status in ('reserved','created','cleanup_pending','cleaned','retained','cleanup_failed')),
  created_at timestamptz not null default now(),
  exposed_at timestamptz,
  cleanup_started_at timestamptz,
  cleaned_at timestamptz,
  cleanup_attempts integer not null default 0 check (cleanup_attempts >= 0),
  stable_failure_code text check (stable_failure_code is null or stable_failure_code ~ '^[A-Z0-9_]{1,80}$'),
  unique (claim_id,resource_type,canonical_resource_id),
  foreign key (claim_id,correlation_id) references public.ps001d_verification_claims(id,correlation_id)
);

alter table public.ps001d_verification_claims
  add constraint ps001d_claim_id_tenant_unique unique(id,tenant_id);
alter table public.ps001d_verification_resource_ledger
  add constraint ps001d_ledger_claim_tenant_fk foreign key(claim_id,tenant_id)
  references public.ps001d_verification_claims(id,tenant_id);

create table public.ps001d_verification_audit (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.ps001d_verification_claims(id),
  correlation_id text not null,
  actor_id uuid references public.profiles(id),
  event_type text not null check (event_type ~ '^ps001d_[a-z0-9_]+$'),
  outcome_code text not null check (outcome_code ~ '^[A-Z0-9_]{1,80}$'),
  safe_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  check (not (safe_metadata ?| array['email','password','token','secret','authorization','sql','url','message']))
);

create or replace function public.ps001d_reject_audit_change()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'PS001D_AUDIT_IMMUTABLE'; end $$;
create trigger ps001d_audit_immutable before update or delete on public.ps001d_verification_audit
for each row execute function public.ps001d_reject_audit_change();

create or replace function public.ps001d_guard_claim_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if row(new.milestone,new.candidate_commit,new.deployment_id,new.tenant_id,new.correlation_id,new.operator_id,new.acquired_at,new.expires_at)
     is distinct from row(old.milestone,old.candidate_commit,old.deployment_id,old.tenant_id,old.correlation_id,old.operator_id,old.acquired_at,old.expires_at) then
    raise exception 'PS001D_CLAIM_BINDING_IMMUTABLE';
  end if;
  if old.status in ('completed','failed','expired') then raise exception 'PS001D_CLAIM_TERMINAL'; end if;
  if old.status='acquired' and new.status not in ('consumed','completed','failed','expired') then raise exception 'PS001D_CLAIM_TRANSITION_INVALID'; end if;
  if old.status='consumed' and new.status not in ('completed','failed') then raise exception 'PS001D_CLAIM_TRANSITION_INVALID'; end if;
  if old.mutation_started_at is not null and new.mutation_started_at is distinct from old.mutation_started_at then raise exception 'PS001D_CLAIM_CONSUMPTION_IMMUTABLE'; end if;
  return new;
end $$;
create trigger ps001d_claim_immutable before update on public.ps001d_verification_claims
for each row execute function public.ps001d_guard_claim_change();

create or replace function public.ps001d_assert_service_admin(p_actor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'PS001D_SERVICE_BOUNDARY_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin') then raise exception 'PS001D_ADMIN_REQUIRED'; end if;
end $$;

create or replace function public.authorize_ps001d_verification_identity(
  p_actor_id uuid,p_scenario text,p_user_id uuid,p_expected_role text,p_tenant_id uuid,
  p_tenant_relationship text,p_candidate_commit text,p_deployment_id text,p_correlation_id text,
  p_valid_from timestamptz,p_expires_at timestamptz
) returns public.ps001d_verification_identity_authorizations
language plpgsql security definer set search_path = '' as $$
declare v_auth public.ps001d_verification_identity_authorizations; v_membership_role text;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  if p_valid_from > now() or p_expires_at <= now() or p_expires_at > now()+interval '24 hours' then raise exception 'PS001D_AUTHORIZATION_WINDOW_INVALID'; end if;
  if p_scenario='anonymous' then
    if p_user_id is not null or p_expected_role<>'anonymous' or p_tenant_relationship<>'unauthenticated' then raise exception 'PS001D_ANONYMOUS_AUTHORIZATION_INVALID'; end if;
  elsif p_user_id is null then raise exception 'PS001D_IDENTITY_REQUIRED';
  elsif p_scenario='admin' then
    if p_tenant_relationship<>'platform_admin' or not exists(select 1 from public.profiles where id=p_user_id and role='admin') then raise exception 'PS001D_IDENTITY_ROLE_MISMATCH'; end if;
  elsif p_scenario in ('authorized_operator','authorized_owner') then
    select role into v_membership_role from public.workspace_memberships where profile_id=p_user_id and workspace_id=p_tenant_id and status='active';
    if v_membership_role is null or v_membership_role<>p_expected_role or p_tenant_relationship<>'active_member' then raise exception 'PS001D_IDENTITY_ROLE_MISMATCH'; end if;
  elsif p_scenario='wrong_tenant' then
    if p_tenant_relationship<>'wrong_tenant' or exists(select 1 from public.workspace_memberships where profile_id=p_user_id and workspace_id=p_tenant_id and status='active') or not exists(select 1 from public.workspace_memberships where profile_id=p_user_id and workspace_id<>p_tenant_id and status='active') then raise exception 'PS001D_WRONG_TENANT_INVALID'; end if;
  else raise exception 'PS001D_SCENARIO_INVALID'; end if;
  insert into public.ps001d_verification_identity_authorizations(scenario,user_id,expected_role,tenant_id,tenant_relationship,candidate_commit,deployment_id,correlation_id,issued_by,valid_from,expires_at)
  values(p_scenario,p_user_id,p_expected_role,p_tenant_id,p_tenant_relationship,p_candidate_commit,p_deployment_id,p_correlation_id,p_actor_id,p_valid_from,p_expires_at)
  returning * into v_auth;
  return v_auth;
exception when unique_violation then raise exception 'PS001D_AUTHORIZATION_ALREADY_EXISTS';
end $$;

create or replace function public.acquire_ps001d_verification_claim(
  p_actor_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text,p_expires_at timestamptz
) returns public.ps001d_verification_claims
language plpgsql security definer set search_path = '' as $$
declare v_claim public.ps001d_verification_claims; v_scenario text;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  if p_expires_at<=now() or p_expires_at>now()+interval '24 hours' then raise exception 'PS001D_CLAIM_EXPIRATION_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_candidate_commit||':'||p_deployment_id||':'||p_tenant_id::text,0));
  update public.ps001d_verification_claims set status='expired',completed_at=now(),stable_failure_code='CLAIM_EXPIRED'
  where candidate_commit=p_candidate_commit and deployment_id=p_deployment_id and tenant_id=p_tenant_id and status='acquired' and expires_at<=now();
  foreach v_scenario in array array['admin','authorized_operator','authorized_owner','wrong_tenant','anonymous'] loop
    if not exists(select 1 from public.ps001d_verification_identity_authorizations a where a.scenario=v_scenario and a.tenant_id=p_tenant_id and a.candidate_commit=p_candidate_commit and a.deployment_id=p_deployment_id and a.correlation_id=p_correlation_id and (v_scenario<>'admin' or a.user_id=p_actor_id) and a.revoked_at is null and a.valid_from<=now() and a.expires_at>now()) then raise exception 'PS001D_IDENTITY_SET_INCOMPLETE'; end if;
  end loop;
  insert into public.ps001d_verification_claims(candidate_commit,deployment_id,tenant_id,correlation_id,operator_id,expires_at,status)
  values(p_candidate_commit,p_deployment_id,p_tenant_id,p_correlation_id,p_actor_id,p_expires_at,'acquired') returning * into v_claim;
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata)
  values(v_claim.id,p_correlation_id,p_actor_id,'ps001d_claim_acquired','CLAIM_ACQUIRED',jsonb_build_object('candidateCommit',p_candidate_commit,'deploymentId',p_deployment_id,'tenantId',p_tenant_id));
  return v_claim;
exception when unique_violation then raise exception 'PS001D_CLAIM_UNAVAILABLE';
end $$;

create or replace function public.revoke_ps001d_verification_identity_authorization(p_actor_id uuid,p_authorization_id uuid)
returns public.ps001d_verification_identity_authorizations language plpgsql security definer set search_path = '' as $$
declare v_auth public.ps001d_verification_identity_authorizations;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  update public.ps001d_verification_identity_authorizations set revoked_at=coalesce(revoked_at,now()) where id=p_authorization_id returning * into v_auth;
  if not found then raise exception 'PS001D_AUTHORIZATION_NOT_FOUND'; end if;
  return v_auth;
end $$;

create or replace function public.consume_ps001d_verification_claim(
  p_actor_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text
) returns public.ps001d_verification_claims
language plpgsql security definer set search_path = '' as $$
declare v_claim public.ps001d_verification_claims;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  select * into v_claim from public.ps001d_verification_claims where id=p_claim_id for update;
  if not found or v_claim.candidate_commit<>p_candidate_commit or v_claim.deployment_id<>p_deployment_id or v_claim.tenant_id<>p_tenant_id or v_claim.correlation_id<>p_correlation_id or v_claim.operator_id<>p_actor_id then raise exception 'PS001D_CLAIM_BINDING_MISMATCH'; end if;
  if v_claim.status<>'acquired' or v_claim.expires_at<=now() then raise exception 'PS001D_CLAIM_NOT_CONSUMABLE'; end if;
  update public.ps001d_verification_claims set status='consumed',mutation_started_at=now() where id=p_claim_id returning * into v_claim;
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code) values(p_claim_id,p_correlation_id,p_actor_id,'ps001d_claim_consumed','CLAIM_CONSUMED');
  return v_claim;
end $$;

create or replace function public.reserve_ps001d_verification_resource(
  p_actor_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text,
  p_resource_type text,p_resource_id text,p_scenario text,p_dependency_order integer
) returns public.ps001d_verification_resource_ledger
language plpgsql security definer set search_path = '' as $$
declare v_claim public.ps001d_verification_claims; v_resource public.ps001d_verification_resource_ledger;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  select * into v_claim from public.ps001d_verification_claims where id=p_claim_id for update;
  if not found or v_claim.candidate_commit<>p_candidate_commit or v_claim.deployment_id<>p_deployment_id or v_claim.tenant_id<>p_tenant_id or v_claim.correlation_id<>p_correlation_id then raise exception 'PS001D_CLAIM_BINDING_MISMATCH'; end if;
  if v_claim.status<>'consumed' then raise exception 'PS001D_CLAIM_NOT_CONSUMED'; end if;
  insert into public.ps001d_verification_resource_ledger(claim_id,correlation_id,tenant_id,resource_type,canonical_resource_id,creating_scenario,dependency_order,status)
  values(p_claim_id,p_correlation_id,p_tenant_id,p_resource_type,p_resource_id,p_scenario,p_dependency_order,'reserved') returning * into v_resource;
  return v_resource;
exception when unique_violation then raise exception 'PS001D_RESOURCE_ALREADY_LEDGERED';
end $$;

create or replace function public.mark_ps001d_verification_resource_created(p_actor_id uuid,p_ledger_id uuid,p_claim_id uuid)
returns public.ps001d_verification_resource_ledger language plpgsql security definer set search_path = '' as $$
declare v_resource public.ps001d_verification_resource_ledger;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  update public.ps001d_verification_resource_ledger l set status='created',exposed_at=now()
  from public.ps001d_verification_claims c where l.id=p_ledger_id and l.claim_id=p_claim_id and c.id=l.claim_id and c.operator_id=p_actor_id and c.status='consumed' and l.status='reserved'
  returning l.* into v_resource;
  if not found then raise exception 'PS001D_RESOURCE_NOT_RESERVED'; end if;
  return v_resource;
end $$;

create or replace function public.record_ps001d_cleanup_result(
  p_actor_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text,
  p_ledger_id uuid,p_result text,p_failure_code text default null
) returns public.ps001d_verification_resource_ledger language plpgsql security definer set search_path = '' as $$
declare v_claim public.ps001d_verification_claims; v_resource public.ps001d_verification_resource_ledger;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  select * into v_claim from public.ps001d_verification_claims where id=p_claim_id for update;
  if not found or v_claim.candidate_commit<>p_candidate_commit or v_claim.deployment_id<>p_deployment_id or v_claim.tenant_id<>p_tenant_id or v_claim.correlation_id<>p_correlation_id then raise exception 'PS001D_CLAIM_BINDING_MISMATCH'; end if;
  if v_claim.status<>'consumed' then raise exception 'PS001D_CLAIM_NOT_CONSUMED'; end if;
  if p_result not in ('cleaned','retained','cleanup_failed') then raise exception 'PS001D_CLEANUP_RESULT_INVALID'; end if;
  update public.ps001d_verification_resource_ledger set status=p_result,cleanup_started_at=coalesce(cleanup_started_at,now()),cleaned_at=case when p_result in('cleaned','retained') then now() else null end,cleanup_attempts=cleanup_attempts+1,stable_failure_code=case when p_result='cleanup_failed' then coalesce(p_failure_code,'CLEANUP_FAILED') else null end
  where id=p_ledger_id and claim_id=p_claim_id and tenant_id=p_tenant_id and status in('reserved','created','cleanup_pending','cleanup_failed') returning * into v_resource;
  if not found then raise exception 'PS001D_LEDGER_RESOURCE_UNAVAILABLE'; end if;
  return v_resource;
end $$;

create or replace function public.complete_ps001d_verification_claim(
  p_actor_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text
) returns public.ps001d_verification_claims language plpgsql security definer set search_path = '' as $$
declare v_claim public.ps001d_verification_claims;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  select * into v_claim from public.ps001d_verification_claims where id=p_claim_id for update;
  if not found or v_claim.candidate_commit<>p_candidate_commit or v_claim.deployment_id<>p_deployment_id or v_claim.tenant_id<>p_tenant_id or v_claim.correlation_id<>p_correlation_id then raise exception 'PS001D_CLAIM_BINDING_MISMATCH'; end if;
  if v_claim.status not in('acquired','consumed') or exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and status not in('cleaned','retained')) then raise exception 'PS001D_RECONCILIATION_INCOMPLETE'; end if;
  update public.ps001d_verification_identity_authorizations set revoked_at=coalesce(revoked_at,now()) where candidate_commit=p_candidate_commit and deployment_id=p_deployment_id and tenant_id=p_tenant_id and correlation_id=p_correlation_id;
  update public.ps001d_verification_claims set status='completed',completed_at=now() where id=p_claim_id returning * into v_claim;
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata) values(p_claim_id,p_correlation_id,p_actor_id,'ps001d_claim_completed','CLAIM_COMPLETED',jsonb_build_object('ledgerResolved',true));
  return v_claim;
end $$;

create or replace function public.fail_ps001d_verification_claim(
  p_actor_id uuid,p_claim_id uuid,p_candidate_commit text,p_deployment_id text,p_tenant_id uuid,p_correlation_id text,p_failure_code text
) returns public.ps001d_verification_claims language plpgsql security definer set search_path = '' as $$
declare v_claim public.ps001d_verification_claims;
begin
  perform public.ps001d_assert_service_admin(p_actor_id);
  update public.ps001d_verification_claims set status='failed',completed_at=now(),stable_failure_code=p_failure_code where id=p_claim_id and candidate_commit=p_candidate_commit and deployment_id=p_deployment_id and tenant_id=p_tenant_id and correlation_id=p_correlation_id and status in('acquired','consumed') returning * into v_claim;
  if not found then raise exception 'PS001D_CLAIM_BINDING_MISMATCH'; end if;
  update public.ps001d_verification_identity_authorizations set revoked_at=coalesce(revoked_at,now()) where candidate_commit=p_candidate_commit and deployment_id=p_deployment_id and tenant_id=p_tenant_id and correlation_id=p_correlation_id;
  insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code) values(p_claim_id,p_correlation_id,p_actor_id,'ps001d_claim_failed',p_failure_code);
  return v_claim;
end $$;

alter table public.ps001d_verification_identity_authorizations enable row level security;
alter table public.ps001d_verification_claims enable row level security;
alter table public.ps001d_verification_resource_ledger enable row level security;
alter table public.ps001d_verification_audit enable row level security;
create policy "admins read ps001d identity authorizations" on public.ps001d_verification_identity_authorizations for select to authenticated using(public.is_admin());
create policy "admins read ps001d claims" on public.ps001d_verification_claims for select to authenticated using(public.is_admin());
create policy "admins read ps001d ledger" on public.ps001d_verification_resource_ledger for select to authenticated using(public.is_admin());
create policy "admins read ps001d audit" on public.ps001d_verification_audit for select to authenticated using(public.is_admin());

revoke all on public.ps001d_verification_identity_authorizations,public.ps001d_verification_claims,public.ps001d_verification_resource_ledger,public.ps001d_verification_audit from anon,authenticated;
grant select on public.ps001d_verification_identity_authorizations,public.ps001d_verification_claims,public.ps001d_verification_resource_ledger,public.ps001d_verification_audit to authenticated;
grant select on public.ps001d_verification_identity_authorizations,public.ps001d_verification_claims,public.ps001d_verification_resource_ledger,public.ps001d_verification_audit to service_role;
revoke all on function public.ps001d_assert_service_admin(uuid),public.authorize_ps001d_verification_identity(uuid,text,uuid,text,uuid,text,text,text,text,timestamptz,timestamptz),public.acquire_ps001d_verification_claim(uuid,text,text,uuid,text,timestamptz),public.revoke_ps001d_verification_identity_authorization(uuid,uuid),public.consume_ps001d_verification_claim(uuid,uuid,text,text,uuid,text),public.reserve_ps001d_verification_resource(uuid,uuid,text,text,uuid,text,text,text,text,integer),public.mark_ps001d_verification_resource_created(uuid,uuid,uuid),public.record_ps001d_cleanup_result(uuid,uuid,text,text,uuid,text,uuid,text,text),public.complete_ps001d_verification_claim(uuid,uuid,text,text,uuid,text),public.fail_ps001d_verification_claim(uuid,uuid,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.authorize_ps001d_verification_identity(uuid,text,uuid,text,uuid,text,text,text,text,timestamptz,timestamptz),public.acquire_ps001d_verification_claim(uuid,text,text,uuid,text,timestamptz),public.revoke_ps001d_verification_identity_authorization(uuid,uuid),public.consume_ps001d_verification_claim(uuid,uuid,text,text,uuid,text),public.reserve_ps001d_verification_resource(uuid,uuid,text,text,uuid,text,text,text,text,integer),public.mark_ps001d_verification_resource_created(uuid,uuid,uuid),public.record_ps001d_cleanup_result(uuid,uuid,text,text,uuid,text,uuid,text,text),public.complete_ps001d_verification_claim(uuid,uuid,text,text,uuid,text),public.fail_ps001d_verification_claim(uuid,uuid,text,text,uuid,text,text) to service_role;
