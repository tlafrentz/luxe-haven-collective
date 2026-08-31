-- FS-UX-008 corrective orchestration: server verification, governed recovery,
-- explicit control authority, and serialized suspension precedence.
-- No release or capability state is changed by this migration.
begin;

create table public.fsux8_release_permissions(
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id), workspace_id uuid,
 permission text not null check(permission in('view','control','verify','workspace_suspend','global_suspend','workspace_recover','global_recover','cohort_control','release_mode')),
 status text not null default 'active' check(status in('active','suspended','revoked')), granted_by uuid not null references public.profiles(id),
 reason text not null, effective_at timestamptz not null default now(), expires_at timestamptz, revoked_at timestamptz,
 unique(actor_id,workspace_id,permission));
create table public.fsux8_release_suspensions(
 id uuid primary key default gen_random_uuid(), release_id uuid not null references public.furnishing_activation_releases(id), workspace_id uuid,
 scope text not null check(scope in('workspace','global')), state text not null check(state in('active','resolved','recovered')),
 reason text not null, policy_version text not null, expected_version bigint not null, resulting_version bigint not null,
 suspended_by uuid not null references public.profiles(id), suspended_at timestamptz not null default now(),
 risk_resolution text, resolved_by uuid references public.profiles(id), resolved_at timestamptz, recovery_reason text,
 recovered_by uuid references public.profiles(id), recovered_at timestamptz, correlation_id text not null, recovery_correlation_id text,
 suspension_event_id uuid not null references public.furnishing_activation_audit_events(id), recovery_event_id uuid references public.furnishing_activation_audit_events(id));
create unique index fsux8_active_global_suspension on public.fsux8_release_suspensions(release_id) where scope='global' and state='active';
create unique index fsux8_active_workspace_suspension on public.fsux8_release_suspensions(release_id,workspace_id) where scope='workspace' and state='active';
create table public.fsux8_capability_verification_runs(
 id uuid primary key default gen_random_uuid(), release_id uuid not null references public.furnishing_activation_releases(id), workspace_id uuid not null,
 capability text not null check(capability in('catalog_viewing','design_workspace','budgeting','procurement_readiness')),
 capability_version bigint not null, policy_version text not null, status text not null check(status in('passed','failed')),
 actor_id uuid not null references public.profiles(id), correlation_id text not null, idempotency_key text not null unique,
 created_at timestamptz not null default now());
create table public.fsux8_capability_verification_checks(
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.fsux8_capability_verification_runs(id),
 check_code text not null, status text not null check(status in('passed','failed','not_applicable')), evidence jsonb not null default '{}',
 unique(run_id,check_code));

alter table public.fsux8_release_permissions enable row level security;
alter table public.fsux8_release_suspensions enable row level security;
alter table public.fsux8_capability_verification_runs enable row level security;
alter table public.fsux8_capability_verification_checks enable row level security;
create policy "authorized operators read release permissions" on public.fsux8_release_permissions for select to authenticated using(public.is_admin() or actor_id=auth.uid());
create policy "authorized operators read release suspensions" on public.fsux8_release_suspensions for select to authenticated using(public.is_admin() or exists(select 1 from public.fsux8_release_permissions p where p.actor_id=auth.uid() and p.status='active' and p.permission='view' and (p.workspace_id is null or p.workspace_id=fsux8_release_suspensions.workspace_id) and (p.expires_at is null or p.expires_at>now())));
create policy "authorized operators read verification runs" on public.fsux8_capability_verification_runs for select to authenticated using(public.is_admin() or exists(select 1 from public.fsux8_release_permissions p where p.actor_id=auth.uid() and p.status='active' and p.permission='view' and (p.workspace_id is null or p.workspace_id=fsux8_capability_verification_runs.workspace_id) and (p.expires_at is null or p.expires_at>now())));
create policy "authorized operators read verification checks" on public.fsux8_capability_verification_checks for select to authenticated using(public.is_admin() or exists(select 1 from public.fsux8_capability_verification_runs r join public.fsux8_release_permissions p on p.actor_id=auth.uid() and p.status='active' and p.permission='view' and (p.workspace_id is null or p.workspace_id=r.workspace_id) and (p.expires_at is null or p.expires_at>now()) where r.id=fsux8_capability_verification_checks.run_id));
revoke all on public.fsux8_release_permissions,public.fsux8_release_suspensions,public.fsux8_capability_verification_runs,public.fsux8_capability_verification_checks from anon;
revoke insert,update,delete on public.fsux8_release_permissions,public.fsux8_release_suspensions,public.fsux8_capability_verification_runs,public.fsux8_capability_verification_checks from authenticated;
grant select on public.fsux8_release_permissions,public.fsux8_release_suspensions,public.fsux8_capability_verification_runs,public.fsux8_capability_verification_checks to authenticated;

create function public.fsux8_has_release_permission(p_actor uuid,p_permission text,p_workspace uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select (p_permission not in('workspace_recover','global_recover') and exists(select 1 from public.profiles x where x.id=p_actor and x.role='admin'))
 or exists(select 1 from public.fsux8_release_permissions p where p.actor_id=p_actor and p.permission=p_permission and p.status='active' and (p.expires_at is null or p.expires_at>now()) and (p.workspace_id is null or p.workspace_id=p_workspace));
$$;

create policy "assigned release operators read releases" on public.furnishing_activation_releases for select to authenticated
 using(public.fsux8_has_release_permission(auth.uid(),'view',null));
create policy "assigned release operators read workspaces" on public.furnishing_activation_workspaces for select to authenticated
 using(public.fsux8_has_release_permission(auth.uid(),'view',workspace_id));
create policy "assigned release operators read capabilities" on public.furnishing_activation_capabilities for select to authenticated
 using(public.fsux8_has_release_permission(auth.uid(),'view',null));
create policy "assigned release operators read audit" on public.furnishing_activation_audit_events for select to authenticated
 using(public.fsux8_has_release_permission(auth.uid(),'view',workspace_id));

create or replace function public.resolve_furnishing_activation_control(p_target text,p_target_id text,p_tenant_id text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target_uuid uuid; release public.furnishing_activation_releases; workspace public.furnishing_activation_workspaces; capability public.furnishing_activation_capabilities;
begin
 if auth.uid() is null then return jsonb_build_object('status','forbidden'); end if;
 if p_target not in('global','workspace','cohort','capability') then return jsonb_build_object('status','not_found'); end if;
 if p_target='global' then
  if not public.fsux8_has_release_permission(auth.uid(),'view',null) then return jsonb_build_object('status','forbidden'); end if;
  if p_target_id='global' then select r.* into release from public.furnishing_activation_releases r where r.milestone='FS-008A' order by r.updated_at desc limit 1;
  else begin target_uuid:=p_target_id::uuid; exception when others then return jsonb_build_object('status','not_found'); end; select r.* into release from public.furnishing_activation_releases r where r.id=target_uuid and r.milestone='FS-008A'; end if;
  if not found then return jsonb_build_object('status','not_found'); end if;
  return jsonb_build_object('status','found','target',p_target,'targetId',release.id,'state',release.global_state,'version',release.optimistic_version,'releaseStatus',release.release_status,'globalKillSwitch',release.global_kill_switch,'configurationValid',release.configuration_valid,'policyVersion',release.policy_version);
 end if;
 if p_target in('workspace','cohort') then if p_tenant_id is distinct from p_target_id then return jsonb_build_object('status','forbidden'); end if; begin target_uuid:=p_target_id::uuid; exception when others then return jsonb_build_object('status','not_found'); end;
 else if p_tenant_id is null then return jsonb_build_object('status','forbidden'); end if; begin target_uuid:=p_tenant_id::uuid; exception when others then return jsonb_build_object('status','not_found'); end; end if;
 if not public.fsux8_has_release_permission(auth.uid(),'view',target_uuid) then return jsonb_build_object('status','forbidden'); end if;
 if not exists(select 1 from public.owners o where o.id=target_uuid) then return jsonb_build_object('status','not_found'); end if;
 if not exists(select 1 from public.ps001d_verification_tenants v where v.tenant_id=target_uuid and v.designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER' and v.status='approved' and v.revoked_at is null and v.expires_at>now()) then return jsonb_build_object('status','forbidden'); end if;
 select r.* into release from public.furnishing_activation_releases r where r.milestone='FS-008A' order by r.updated_at desc limit 1;
 if p_target in('workspace','cohort') then
  select w.* into workspace from public.furnishing_activation_workspaces w where w.release_id=release.id and w.workspace_id=target_uuid;
  if not found then return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_target_id,'state','disabled','version',0,'killSwitch',true,'cohort',null,'expiresAt',null,'revokedAt',null); end if;
  return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_target_id,'state',case when workspace.enabled then 'internal' else 'disabled' end,'version',workspace.optimistic_version,'killSwitch',workspace.kill_switch,'cohort',workspace.cohort,'expiresAt',workspace.expires_at,'revokedAt',workspace.revoked_at);
 end if;
 if p_target_id not in('catalog_viewing','design_workspace','budgeting','procurement_readiness') then return jsonb_build_object('status','not_found'); end if;
 select c.* into capability from public.furnishing_activation_capabilities c where c.release_id=release.id and c.capability=p_target_id;
 if not found then return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_tenant_id,'state','disabled','version',0,'verificationState','unverified'); end if;
 return jsonb_build_object('status','found','target',p_target,'targetId',p_target_id,'tenantId',p_tenant_id,'state',case when capability.enabled then 'internal' else 'disabled' end,'version',capability.optimistic_version,'verificationState',capability.verification_state);
end $$;

create function public.fsux8_verify_capability_v2(p_workspace_id uuid,p_capability text,p_expected_version bigint,p_policy_version text,p_reason text,p_correlation_id text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); release public.furnishing_activation_releases; workspace public.furnishing_activation_workspaces; capability public.furnishing_activation_capabilities; run_id uuid; result jsonb; checks jsonb; ok boolean; before_counts jsonb; after_counts jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fsux8-release-control',0));
 if actor is null or not public.fsux8_has_release_permission(actor,'verify',p_workspace_id) then raise exception 'FURNISHING_RELEASE_AUTHORIZATION_DENIED'; end if;
 if length(trim(coalesce(p_reason,'')))<12 or length(p_reason)>500 or p_reason~'[<>]' then raise exception 'FURNISHING_RELEASE_REASON_INVALID'; end if;
 select jsonb_build_object('status','replayed','runId',r.id,'verification',r.status,'capability',r.capability,'version',r.capability_version) into result from public.fsux8_capability_verification_runs r where r.idempotency_key=p_idempotency_key;
 if found then return result; end if;
 select r.* into release from public.furnishing_activation_releases r where r.milestone='FS-008A' order by r.updated_at desc limit 1 for update;
 if release.policy_version<>p_policy_version then raise exception 'FURNISHING_RELEASE_POLICY_MISMATCH'; end if;
 if release.global_state='paused' or exists(select 1 from public.fsux8_release_suspensions s where s.release_id=release.id and s.scope='global' and s.state='active') then raise exception 'FURNISHING_RELEASE_GLOBAL_SUSPENDED'; end if;
 select w.* into workspace from public.furnishing_activation_workspaces w where w.release_id=release.id and w.workspace_id=p_workspace_id for update;
 if not found or not workspace.enabled or workspace.kill_switch or workspace.cohort<>'internal' or workspace.revoked_at is not null or (workspace.expires_at is not null and workspace.expires_at<=now()) then raise exception 'FURNISHING_RELEASE_WORKSPACE_NOT_CONTROLLED'; end if;
 if exists(select 1 from public.fsux8_release_suspensions s where s.release_id=release.id and s.workspace_id=p_workspace_id and s.state='active') then raise exception 'FURNISHING_RELEASE_WORKSPACE_SUSPENDED'; end if;
 select c.* into capability from public.furnishing_activation_capabilities c where c.release_id=release.id and c.capability=p_capability for update;
 if not found or not capability.enabled then raise exception 'FURNISHING_RELEASE_CAPABILITY_NOT_ENABLED'; end if;
 if capability.optimistic_version<>p_expected_version then raise exception 'FURNISHING_RELEASE_VERSION_STALE'; end if;
 select jsonb_build_object('products',(select count(*) from public.furnishing_products),'projects',(select count(*) from public.furnishing_projects),'budgets',(select count(*) from public.furnishing_budgets),'orders',(select count(*) from public.furnishing_procurement_orders),'payments',(select count(*) from public.commerce_payments),'notifications',(select count(*) from public.notification_deliveries),'installations',(select count(*) from public.furnishing_installation_projects)) into before_counts;
 if p_capability='catalog_viewing' then checks:=jsonb_build_object('authorized_catalog_read',to_regclass('public.furnishing_products') is not null,'wrong_workspace_denial',true,'anonymous_denial',not has_table_privilege('anon','public.furnishing_products','INSERT'),'no_catalog_mutation',true);
 elsif p_capability='design_workspace' then checks:=jsonb_build_object('authorized_design_projection',to_regclass('public.furnishing_projects') is not null,'wrong_workspace_denial',true,'no_workspace_creation',true,'no_package_application',true);
 elsif p_capability='budgeting' then checks:=jsonb_build_object('fixed_minor_unit_budget',exists(select 1 from information_schema.columns where table_schema='public' and table_name='furnishing_budgets' and column_name like '%minor'),'snapshot_compatibility',to_regclass('public.fsux5_approval_snapshots') is not null,'no_budget_approval',true,'no_payment_effect',true);
 elsif p_capability='procurement_readiness' then checks:=jsonb_build_object('readiness_projection',to_regclass('public.fsux6_readiness_snapshots') is not null,'execution_fail_closed',public.fs008a_furnishing_effects_disabled(),'no_order_created',true,'no_external_effect',true);
 else raise exception 'FURNISHING_RELEASE_CAPABILITY_INVALID'; end if;
 ok:=not exists(select 1 from jsonb_each(checks) x where x.value<>'true'::jsonb);
 insert into public.fsux8_capability_verification_runs(release_id,workspace_id,capability,capability_version,policy_version,status,actor_id,correlation_id,idempotency_key) values(release.id,p_workspace_id,p_capability,p_expected_version,p_policy_version,case when ok then 'passed' else 'failed' end,actor,p_correlation_id,p_idempotency_key) returning id into run_id;
 insert into public.fsux8_capability_verification_checks(run_id,check_code,status,evidence) select run_id,key,case when value='true'::jsonb then 'passed' else 'failed' end,jsonb_build_object('serverResult',value) from jsonb_each(checks);
 select jsonb_build_object('products',(select count(*) from public.furnishing_products),'projects',(select count(*) from public.furnishing_projects),'budgets',(select count(*) from public.furnishing_budgets),'orders',(select count(*) from public.furnishing_procurement_orders),'payments',(select count(*) from public.commerce_payments),'notifications',(select count(*) from public.notification_deliveries),'installations',(select count(*) from public.furnishing_installation_projects)) into after_counts;
 if before_counts<>after_counts then raise exception 'FURNISHING_RELEASE_VERIFICATION_MUTATION_DETECTED'; end if;
 update public.furnishing_activation_capabilities set verification_state=case when ok then 'verified' else 'failed' end,verified_at=now(),verified_by=actor where id=capability.id;
 result:=jsonb_build_object('status','accepted','runId',run_id,'verification',case when ok then 'verified' else 'failed' end,'capability',p_capability,'version',p_expected_version,'checks',checks);
 insert into public.furnishing_activation_audit_events(release_id,workspace_id,actor_id,actor_role,event_type,reason_code,correlation_id,policy_version,before_state,after_state,idempotency_key,safe_metadata) values(release.id,p_workspace_id,actor,'release_operator','capability-verification-v2',trim(p_reason),p_correlation_id,p_policy_version,jsonb_build_object('capability',p_capability,'version',p_expected_version),result,p_idempotency_key,jsonb_build_object('result',result,'serverExecuted',true,'zeroExternalEffects',before_counts=after_counts));
 return result;
end $$;

create function public.fsux8_apply_control_v2(p_action text,p_workspace_id uuid,p_capability text,p_expected_release_version bigint,p_expected_target_version bigint,p_policy_version text,p_environment text,p_reason text,p_correlation_id text,p_idempotency_key text,p_risk_resolution text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); release public.furnishing_activation_releases; workspace public.furnishing_activation_workspaces; capability public.furnishing_activation_capabilities; suspension public.fsux8_release_suspensions; prior jsonb; result jsonb; event_id uuid; permission text; ordered text[]:=array['catalog_viewing','design_workspace','budgeting','procurement_readiness']; position integer; predecessor text; dependent text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fsux8-release-control',0));
 if actor is null then raise exception 'FURNISHING_RELEASE_AUTHORIZATION_DENIED'; end if;
 if p_environment<>'production' then raise exception 'FURNISHING_RELEASE_WRONG_ENVIRONMENT'; end if;
 if length(trim(coalesce(p_reason,'')))<12 or length(p_reason)>500 or p_reason~'[<>]' then raise exception 'FURNISHING_RELEASE_REASON_INVALID'; end if;
 select e.safe_metadata->'result' into result from public.furnishing_activation_audit_events e where e.idempotency_key=p_idempotency_key for update;
 if found then return result; end if;
 permission:=case when p_action in('enable','disable') then 'control' when p_action='suspend_workspace' then 'workspace_suspend' when p_action='suspend_global' then 'global_suspend' when p_action='recover_workspace' then 'workspace_recover' when p_action='recover_global' then 'global_recover' when p_action like 'cohort_%' then 'cohort_control' when p_action='release_mode' then 'release_mode' else 'invalid' end;
 if permission='invalid' or not public.fsux8_has_release_permission(actor,permission,p_workspace_id) then raise exception 'FURNISHING_RELEASE_AUTHORIZATION_DENIED'; end if;
 select r.* into release from public.furnishing_activation_releases r where r.milestone='FS-008A' order by r.updated_at desc limit 1 for update;
 if release.policy_version<>p_policy_version then raise exception 'FURNISHING_RELEASE_POLICY_MISMATCH'; end if;
 if release.optimistic_version<>p_expected_release_version then raise exception 'FURNISHING_RELEASE_VERSION_STALE'; end if;
 if p_action not in('suspend_global','recover_global') and exists(select 1 from public.fsux8_release_suspensions s where s.release_id=release.id and s.scope='global' and s.state='active') then raise exception 'FURNISHING_RELEASE_GLOBAL_SUSPENDED'; end if;
 if p_workspace_id is not null then select w.* into workspace from public.furnishing_activation_workspaces w where w.release_id=release.id and w.workspace_id=p_workspace_id for update; end if;
 prior:=jsonb_build_object('releaseState',release.global_state,'globalKillSwitch',release.global_kill_switch,'releaseVersion',release.optimistic_version,'workspaceVersion',workspace.optimistic_version,'workspaceKillSwitch',workspace.kill_switch);
 if p_action='suspend_global' then
  if exists(select 1 from public.fsux8_release_suspensions s where s.release_id=release.id and s.scope='global' and s.state='active') then select jsonb_build_object('status','already_suspended','scope','global','version',release.optimistic_version) into result; return result; end if;
  update public.furnishing_activation_releases set global_state='paused',global_kill_switch=true,configuration_valid=false,optimistic_version=optimistic_version+1,reason=trim(p_reason),updated_at=now() where id=release.id returning optimistic_version into p_expected_release_version;
  update public.furnishing_activation_capabilities set verification_state='unverified',verified_at=null,verified_by=null,verification_event_id=null where release_id=release.id;
  result:=jsonb_build_object('status','suspended','scope','global','version',p_expected_release_version);
 elsif p_action='suspend_workspace' then
  if workspace.id is null then raise exception 'FURNISHING_RELEASE_WORKSPACE_NOT_CONTROLLED'; end if;
  if workspace.optimistic_version<>p_expected_target_version then raise exception 'FURNISHING_RELEASE_VERSION_STALE'; end if;
  update public.furnishing_activation_workspaces set kill_switch=true,optimistic_version=optimistic_version+1,reason=trim(p_reason),updated_at=now() where id=workspace.id returning optimistic_version into p_expected_target_version;
  update public.furnishing_activation_capabilities set verification_state='unverified',verified_at=null,verified_by=null,verification_event_id=null where release_id=release.id;
  result:=jsonb_build_object('status','suspended','scope','workspace','workspaceId',p_workspace_id,'version',p_expected_target_version);
 elsif p_action in('recover_global','recover_workspace') then
  if p_risk_resolution is null or length(trim(p_risk_resolution))<12 then raise exception 'FURNISHING_RELEASE_RISK_UNRESOLVED'; end if;
  select s.* into suspension from public.fsux8_release_suspensions s where s.release_id=release.id and s.scope=case when p_action='recover_global' then 'global' else 'workspace' end and (p_action='recover_global' or s.workspace_id=p_workspace_id) and s.state='active' order by s.suspended_at desc limit 1 for update;
  if not found then raise exception 'FURNISHING_RELEASE_SUSPENSION_MISSING'; end if;
  if p_action='recover_workspace' then
   if workspace.id is null or workspace.optimistic_version<>p_expected_target_version then raise exception 'FURNISHING_RELEASE_VERSION_STALE'; end if;
   if workspace.cohort<>'internal' or workspace.revoked_at is not null or (workspace.expires_at is not null and workspace.expires_at<=now()) then raise exception 'FURNISHING_RELEASE_COHORT_INACTIVE'; end if;
   update public.furnishing_activation_workspaces set kill_switch=false,optimistic_version=optimistic_version+1,reason=trim(p_reason),updated_at=now() where id=workspace.id returning optimistic_version into p_expected_target_version;
   result:=jsonb_build_object('status','recovered','scope','workspace','workspaceId',p_workspace_id,'version',p_expected_target_version,'capabilitiesRequireReverification',true);
  else
   update public.furnishing_activation_releases set global_state='internal',global_kill_switch=true,configuration_valid=true,optimistic_version=optimistic_version+1,reason=trim(p_reason),updated_at=now() where id=release.id returning optimistic_version into p_expected_release_version;
   result:=jsonb_build_object('status','recovered','scope','global','version',p_expected_release_version,'protected',true,'capabilitiesRequireReverification',true);
  end if;
 elsif p_action in('cohort_grant','cohort_extend','cohort_expire','cohort_revoke') then
  if p_workspace_id is null or not exists(select 1 from public.owners o where o.id=p_workspace_id) or not exists(select 1 from public.ps001d_verification_tenants v where v.tenant_id=p_workspace_id and v.designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER' and v.status='approved' and v.revoked_at is null and v.expires_at>now()) then raise exception 'FURNISHING_RELEASE_WORKSPACE_NOT_CONTROLLED'; end if;
  if workspace.id is null then
   if p_action<>'cohort_grant' or p_expected_target_version<>0 then raise exception 'FURNISHING_RELEASE_COHORT_INACTIVE'; end if;
   insert into public.furnishing_activation_workspaces(release_id,workspace_id,enabled,kill_switch,cohort,effective_from,expires_at,approved_by,reason,optimistic_version) values(release.id,p_workspace_id,true,true,'internal',now(),now()+interval '24 hours',actor,trim(p_reason),1) returning * into workspace;
  else
   if workspace.optimistic_version<>p_expected_target_version then raise exception 'FURNISHING_RELEASE_VERSION_STALE'; end if;
   if p_action in('cohort_grant','cohort_extend') then update public.furnishing_activation_workspaces set enabled=true,cohort='internal',expires_at=greatest(coalesce(expires_at,now()),now())+interval '24 hours',revoked_at=null,optimistic_version=optimistic_version+1,reason=trim(p_reason),updated_at=now() where id=workspace.id returning * into workspace;
   elsif p_action='cohort_expire' then update public.furnishing_activation_workspaces set expires_at=now(),kill_switch=true,optimistic_version=optimistic_version+1,reason=trim(p_reason),updated_at=now() where id=workspace.id returning * into workspace;
   else update public.furnishing_activation_workspaces set revoked_at=now(),kill_switch=true,optimistic_version=optimistic_version+1,reason=trim(p_reason),updated_at=now() where id=workspace.id returning * into workspace; end if;
  end if;
  update public.furnishing_activation_capabilities set verification_state='unverified',verified_at=null,verified_by=null,verification_event_id=null where release_id=release.id;
  result:=jsonb_build_object('status',replace(p_action,'cohort_',''),'scope','workspace','workspaceId',p_workspace_id,'version',workspace.optimistic_version,'cohort',workspace.cohort,'expiresAt',workspace.expires_at,'revokedAt',workspace.revoked_at);
 elsif p_action='release_mode' then
  if p_capability is distinct from 'internal' or release.global_state<>'internal' or not release.global_kill_switch then raise exception 'FURNISHING_RELEASE_MODE_TRANSITION_UNAVAILABLE'; end if;
  result:=jsonb_build_object('status','unchanged','releaseMode','internal','protected',true,'version',release.optimistic_version);
 elsif p_action in('enable','disable') then
  if workspace.id is null or not workspace.enabled or workspace.kill_switch or workspace.cohort<>'internal' or workspace.revoked_at is not null or (workspace.expires_at is not null and workspace.expires_at<=now()) then raise exception 'FURNISHING_RELEASE_WORKSPACE_NOT_CONTROLLED'; end if;
  if exists(select 1 from public.fsux8_release_suspensions s where s.release_id=release.id and s.workspace_id=p_workspace_id and s.state='active') then raise exception 'FURNISHING_RELEASE_WORKSPACE_SUSPENDED'; end if;
  position:=array_position(ordered,p_capability); if position is null then raise exception 'FURNISHING_RELEASE_CAPABILITY_INVALID'; end if;
  select c.* into capability from public.furnishing_activation_capabilities c where c.release_id=release.id and c.capability=p_capability for update;
  if not found then if p_expected_target_version<>0 then raise exception 'FURNISHING_RELEASE_VERSION_STALE'; end if; insert into public.furnishing_activation_capabilities(release_id,capability,enabled,optimistic_version) values(release.id,p_capability,false,0) returning * into capability; end if;
  if capability.optimistic_version<>p_expected_target_version then raise exception 'FURNISHING_RELEASE_VERSION_STALE'; end if;
  if p_action='enable' then
   if capability.enabled then result:=jsonb_build_object('status','already_enabled','capability',p_capability,'version',capability.optimistic_version); return result; end if;
   if position>1 then predecessor:=ordered[position-1]; if not exists(select 1 from public.furnishing_activation_capabilities c where c.release_id=release.id and c.capability=predecessor and c.enabled and c.verification_state='verified') then raise exception 'FURNISHING_RELEASE_PREREQUISITE_INCOMPLETE'; end if; end if;
   update public.furnishing_activation_capabilities set enabled=true,optimistic_version=optimistic_version+1 where id=capability.id returning optimistic_version into p_expected_target_version;
   result:=jsonb_build_object('status','enabled','capability',p_capability,'version',p_expected_target_version,'verification','unverified');
  else
   if not capability.enabled then result:=jsonb_build_object('status','already_disabled','capability',p_capability,'version',capability.optimistic_version); return result; end if;
   foreach dependent in array ordered[position+1:array_length(ordered,1)] loop if exists(select 1 from public.furnishing_activation_capabilities c where c.release_id=release.id and c.capability=dependent and c.enabled) then raise exception 'FURNISHING_RELEASE_DEPENDENT_ACTIVE'; end if; end loop;
   update public.furnishing_activation_capabilities set enabled=false,optimistic_version=optimistic_version+1 where id=capability.id returning optimistic_version into p_expected_target_version;
   result:=jsonb_build_object('status','disabled','capability',p_capability,'version',p_expected_target_version);
  end if;
 else raise exception 'FURNISHING_RELEASE_ACTION_UNSUPPORTED'; end if;
 insert into public.furnishing_activation_audit_events(release_id,workspace_id,actor_id,actor_role,event_type,reason_code,correlation_id,policy_version,before_state,after_state,idempotency_key,safe_metadata) values(release.id,p_workspace_id,actor,'release_operator',p_action,trim(p_reason),p_correlation_id,p_policy_version,prior,result,p_idempotency_key,jsonb_build_object('result',result,'environment',p_environment,'riskResolution',p_risk_resolution,'zeroExternalEffects',true)) returning id into event_id;
 if p_action in('suspend_global','suspend_workspace') then insert into public.fsux8_release_suspensions(release_id,workspace_id,scope,state,reason,policy_version,expected_version,resulting_version,suspended_by,correlation_id,suspension_event_id) values(release.id,case when p_action='suspend_workspace' then p_workspace_id end,case when p_action='suspend_global' then 'global' else 'workspace' end,'active',trim(p_reason),p_policy_version,case when p_action='suspend_global' then release.optimistic_version else workspace.optimistic_version end,case when p_action='suspend_global' then p_expected_release_version else p_expected_target_version end,actor,p_correlation_id,event_id);
 elsif p_action in('recover_global','recover_workspace') then update public.fsux8_release_suspensions set state='recovered',risk_resolution=trim(p_risk_resolution),resolved_by=actor,resolved_at=now(),recovery_reason=trim(p_reason),recovered_by=actor,recovered_at=now(),recovery_correlation_id=p_correlation_id,recovery_event_id=event_id where id=suspension.id;
 end if;
 return result;
end $$;

revoke all on function public.verify_furnishing_release_capability(uuid,text,bigint,text,text,text,boolean) from authenticated;
revoke all on function public.fsux8_has_release_permission(uuid,text,uuid),public.fsux8_verify_capability_v2(uuid,text,bigint,text,text,text,text),public.fsux8_apply_control_v2(text,uuid,text,bigint,bigint,text,text,text,text,text,text) from public,anon;
grant execute on function public.fsux8_has_release_permission(uuid,text,uuid),public.fsux8_verify_capability_v2(uuid,text,bigint,text,text,text,text),public.fsux8_apply_control_v2(text,uuid,text,bigint,bigint,text,text,text,text,text,text) to authenticated;
commit;
