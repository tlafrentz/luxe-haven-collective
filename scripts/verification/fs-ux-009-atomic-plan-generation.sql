\set ON_ERROR_STOP on
begin;

-- Controlled fixture setup only; the capability behavior itself was certified earlier.
alter table public.furnishing_activation_capabilities disable trigger fsux8_capability_sequence_guard;

do $$
declare target_release uuid; verification_event uuid:=md5('fsux9-plan-verification')::uuid;
begin
  select id into target_release from public.furnishing_activation_releases where milestone='FS-008A' for update;
  update public.furnishing_activation_releases set global_state='internal',global_kill_switch=false,
    configuration_valid=true where id=target_release;
  insert into public.furnishing_activation_audit_events(
    id,release_id,workspace_id,actor_id,actor_role,event_type,reason_code,correlation_id,
    policy_version,before_state,after_state,safe_metadata,idempotency_key
  ) values (
    verification_event,target_release,'ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
    'b1b72f07-fe0b-4e37-9ff3-08d570a0ee49','owner','fsux9-plan-verification',
    'Focused atomic plan fixture','fsux9-plan-verification','fs008a-v1','{}','{}','{}',
    'fsux9-plan-verification'
  ) on conflict(id) do nothing;
  insert into public.furnishing_activation_workspaces(
    release_id,workspace_id,enabled,kill_switch,cohort,effective_from,expires_at,
    approved_by,reason,optimistic_version
  ) values (target_release,'ffc03a5f-6578-49e5-8751-3bc3c36fce9e',true,false,'internal',now(),
    now()+interval '1 day','b1b72f07-fe0b-4e37-9ff3-08d570a0ee49','Atomic plan fixture',1)
  on conflict(release_id,workspace_id) do update set enabled=true,kill_switch=false,cohort='internal',
    effective_from=now(),expires_at=now()+interval '1 day',revoked_at=null;
  insert into public.furnishing_activation_capabilities(
    release_id,capability,enabled,optimistic_version,verification_state,verified_at,verified_by,verification_event_id
  ) values (target_release,'catalog_viewing',true,1,'verified',now(),
    'b1b72f07-fe0b-4e37-9ff3-08d570a0ee49',verification_event)
  on conflict(release_id,capability) do update set enabled=true,verification_state='verified',
    verified_at=now(),verified_by=excluded.verified_by,verification_event_id=excluded.verification_event_id;
  insert into public.furnishing_activation_capabilities(
    release_id,capability,enabled,optimistic_version,verification_state,verified_at,verified_by,verification_event_id
  ) values (target_release,'design_workspace',true,1,'verified',now(),
    'b1b72f07-fe0b-4e37-9ff3-08d570a0ee49',verification_event)
  on conflict(release_id,capability) do update set enabled=true,verification_state='verified',
    verified_at=now(),verified_by=excluded.verified_by,verification_event_id=excluded.verification_event_id;
end $$;
alter table public.furnishing_activation_capabilities enable trigger fsux8_capability_sequence_guard;

update public.workspace_memberships set status='active',role='owner'
where workspace_id='ffc03a5f-6578-49e5-8751-3bc3c36fce9e'
  and profile_id='b1b72f07-fe0b-4e37-9ff3-08d570a0ee49';
update public.furnishing_packages set lifecycle_status='approved',
  current_version_id='99200000-0000-4000-8000-000000000011'
where id='99200000-0000-4000-8000-000000000010';
update public.furnishing_package_versions set lifecycle_status='approved'
where id='99200000-0000-4000-8000-000000000011';

insert into public.furnishing_projects(
  id,workspace_id,property_id,name,lifecycle_status,project_type,furnishing_package_version_id,
  plan_status,design_workspace_status,optimistic_version,created_by
)
select md5('fsux9-plan-project-'||n)::uuid,'ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  '5493cd81-d120-4930-bf52-5ac24b3cd308','C8-D Isolated Furnishing Lifecycle atomic plan '||n,'planning','full_property',
  '99200000-0000-4000-8000-000000000011','not_generated','draft',1,
  'b1b72f07-fe0b-4e37-9ff3-08d570a0ee49'
from generate_series(1,14) n;

insert into public.furnishing_command_contexts(
  id,candidate_commit,workflow,workspace_id,actor_id,actor_role,command_type,target_type,
  target_id,correlation_id,idempotency_key,binding_hash,expires_at
)
select md5('fsux9-plan-context-'||n)::uuid,'629db160a067ff35e3e4023ba9cf8da416f509ba',
  'fs008g-finalization:plan-generation','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  'b1b72f07-fe0b-4e37-9ff3-08d570a0ee49','owner','project.plan.generate','project',
  md5('fsux9-plan-project-'||n)::uuid::text,md5('fsux9-plan-correlation-'||n)::uuid,
  'fsux9-plan-key-'||n,md5('fsux9-plan-binding-'||n),now()+interval '1 day'
from generate_series(1,14) n;
update public.furnishing_command_contexts
set workspace_id='fec193f8-c180-47c0-bcb5-71fb2a910f15'
where id=md5('fsux9-plan-context-11')::uuid;

insert into public.furnishing_controlled_fixture_designations(
  id,project_id,workspace_id,controlled_customer_account_id,controlled_property_id,tenant_id,
  controlled_run_id,candidate_commit,correlation_id,purpose,created_by,created_at,expires_at
)
select md5('fsux9-plan-designation-'||n)::uuid,md5('fsux9-plan-project-'||n)::uuid,
  'ffc03a5f-6578-49e5-8751-3bc3c36fce9e','38ed6a6f-e3e1-48da-ae95-d82031954564',
  '5493cd81-d120-4930-bf52-5ac24b3cd308','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  md5('fsux9-plan-run-'||n)::uuid,'629db160a067ff35e3e4023ba9cf8da416f509ba',
  md5('fsux9-plan-correlation-'||n)::uuid,'Atomic plan generation proof',
  'b1b72f07-fe0b-4e37-9ff3-08d570a0ee49',now()-interval '1 minute',now()+interval '1 day'
from generate_series(1,14) n;

set local role authenticated;
select set_config('request.jwt.claim.sub','b1b72f07-fe0b-4e37-9ff3-08d570a0ee49',true);
select set_config('request.jwt.claim.role','authenticated',true);

do $$
declare result jsonb; target_project uuid:=md5('fsux9-plan-project-1')::uuid;
begin
  result:=public.generate_authorized_furnishing_plan(jsonb_build_object(
    'command_context_id',md5('fsux9-plan-context-1')::uuid,'expected_project_version',1));
  if result->>'status'<>'created' or result->>'planStatus'<>'draft'
    or result->>'lifecycleStatus'<>'designing' or (result->>'projectVersion')::bigint<>2
  then raise exception 'FSUX9_PLAN_SUCCESS_MISMATCH'; end if;
  result:=public.generate_authorized_furnishing_plan(jsonb_build_object(
    'command_context_id',md5('fsux9-plan-context-1')::uuid,'expected_project_version',1));
  if result->>'status'<>'replayed'
  then raise exception 'FSUX9_PLAN_REPLAY_MISMATCH'; end if;
  begin
    perform public.generate_authorized_furnishing_plan(jsonb_build_object(
      'command_context_id',md5('fsux9-plan-context-1')::uuid,'expected_project_version',2));
    raise exception 'EXPECTED_IDEMPOTENCY_CONFLICT';
  exception when others then
    if sqlerrm not like '%FURNISHING_PLAN_IDEMPOTENCY_CONFLICT%' then raise; end if;
  end;
end $$;

reset role;
do $$declare target_project uuid:=md5('fsux9-plan-project-1')::uuid;begin
  if not exists(select 1 from public.furnishing_projects p join public.furnishing_plans plan
      on plan.id=p.current_plan_version_id and plan.project_id=p.id
      where p.id=target_project and p.plan_status='draft' and p.lifecycle_status='designing'
        and p.optimistic_version=2)
    or (select count(*) from public.furnishing_plans where project_id=target_project)<>1
    or (select count(*) from public.furnishing_plan_generation_commands where project_id=target_project)<>1
    or (select count(*) from public.furnishing_plan_generation_audit_events where project_id=target_project)<>1
  then raise exception 'FSUX9_PLAN_SUCCESS_PERSISTENCE_MISMATCH'; end if;
end $$;
set local role authenticated;

do $$
declare scenario text; project_number integer; setting_name text; expected_error text; project_id uuid;
begin
  for scenario,project_number,setting_name,expected_error in values
    ('insert',2,'fsux9.force_plan_insert_failure','FURNISHING_PLAN_INSERT_PERSISTENCE_FAILED'),
    ('project',3,'fsux9.force_project_update_failure','FURNISHING_PLAN_PROJECT_PERSISTENCE_FAILED'),
    ('audit',4,'fsux9.force_plan_audit_failure','FURNISHING_PLAN_AUDIT_PERSISTENCE_FAILED')
  loop
    project_id:=md5('fsux9-plan-project-'||project_number)::uuid;
    perform set_config(setting_name,'on',true);
    begin
      perform public.generate_authorized_furnishing_plan(jsonb_build_object(
        'command_context_id',md5('fsux9-plan-context-'||project_number)::uuid,
        'expected_project_version',1));
      raise exception 'EXPECTED_FORCED_FAILURE';
    exception when others then
      if sqlerrm not like '%'||expected_error||'%' then raise; end if;
    end;
    perform set_config(setting_name,'off',true);
  end loop;
end $$;

do $$begin
  begin
    perform public.generate_authorized_furnishing_plan(jsonb_build_object(
      'command_context_id',md5('fsux9-plan-context-5')::uuid,'expected_project_version',2));
    raise exception 'EXPECTED_STALE_FAILURE';
  exception when others then if sqlerrm not like '%FURNISHING_PLAN_STALE_PROJECT%' then raise; end if; end;
end $$;

reset role;
do $$begin
  if exists(select 1 from public.furnishing_plans where project_id in(
      md5('fsux9-plan-project-2')::uuid,md5('fsux9-plan-project-3')::uuid,
      md5('fsux9-plan-project-4')::uuid,md5('fsux9-plan-project-5')::uuid))
    or exists(select 1 from public.furnishing_plan_generation_commands where project_id in(
      md5('fsux9-plan-project-2')::uuid,md5('fsux9-plan-project-3')::uuid,
      md5('fsux9-plan-project-4')::uuid,md5('fsux9-plan-project-5')::uuid))
    or exists(select 1 from public.furnishing_plan_generation_audit_events where project_id in(
      md5('fsux9-plan-project-2')::uuid,md5('fsux9-plan-project-3')::uuid,
      md5('fsux9-plan-project-4')::uuid,md5('fsux9-plan-project-5')::uuid))
    or exists(select 1 from public.furnishing_projects where id in(
      md5('fsux9-plan-project-2')::uuid,md5('fsux9-plan-project-3')::uuid,
      md5('fsux9-plan-project-4')::uuid,md5('fsux9-plan-project-5')::uuid)
      and(current_plan_version_id is not null or plan_status<>'not_generated'
        or lifecycle_status<>'planning' or optimistic_version<>1))
  then raise exception 'FSUX9_PLAN_FAILURE_NOT_ATOMIC'; end if;
end $$;
update public.workspace_memberships set status='removed'
where workspace_id='ffc03a5f-6578-49e5-8751-3bc3c36fce9e'
  and profile_id='b1b72f07-fe0b-4e37-9ff3-08d570a0ee49';
set local role authenticated;
do $$begin
  begin perform public.generate_authorized_furnishing_plan(jsonb_build_object(
    'command_context_id',md5('fsux9-plan-context-6')::uuid,'expected_project_version',1));
    raise exception 'EXPECTED_REVOKED_FAILURE';
  exception when others then if sqlerrm not like '%FURNISHING_PLAN_MEMBERSHIP_REQUIRED%' then raise; end if; end;
end $$;
reset role;
update public.workspace_memberships set status='active'
where workspace_id='ffc03a5f-6578-49e5-8751-3bc3c36fce9e'
  and profile_id='b1b72f07-fe0b-4e37-9ff3-08d570a0ee49';

set local role authenticated;
do $$begin
  begin perform public.generate_authorized_furnishing_plan(jsonb_build_object(
    'command_context_id',md5('fsux9-plan-context-11')::uuid,'expected_project_version',1));
    raise exception 'EXPECTED_WRONG_WORKSPACE_FAILURE';
  exception when others then if sqlerrm not like '%FURNISHING_PLAN_WORKSPACE_MISMATCH%' then raise; end if; end;
end $$;
reset role;

update public.workspace_memberships set status='suspended'
where workspace_id='ffc03a5f-6578-49e5-8751-3bc3c36fce9e'
  and profile_id='b1b72f07-fe0b-4e37-9ff3-08d570a0ee49';
set local role authenticated;
do $$begin
  begin perform public.generate_authorized_furnishing_plan(jsonb_build_object(
    'command_context_id',md5('fsux9-plan-context-12')::uuid,'expected_project_version',1));
    raise exception 'EXPECTED_SUSPENDED_USER_FAILURE';
  exception when others then if sqlerrm not like '%FURNISHING_PLAN_MEMBERSHIP_REQUIRED%' then raise; end if; end;
end $$;
reset role;
update public.workspace_memberships set status='active'
where workspace_id='ffc03a5f-6578-49e5-8751-3bc3c36fce9e'
  and profile_id='b1b72f07-fe0b-4e37-9ff3-08d570a0ee49';

update public.furnishing_activation_workspaces set kill_switch=true
where workspace_id='ffc03a5f-6578-49e5-8751-3bc3c36fce9e';
set local role authenticated;
do $$begin
  begin perform public.generate_authorized_furnishing_plan(jsonb_build_object(
    'command_context_id',md5('fsux9-plan-context-7')::uuid,'expected_project_version',1));
    raise exception 'EXPECTED_SUSPENSION_FAILURE';
  exception when others then if sqlerrm not like '%FURNISHING_PLAN_WORKSPACE_SUSPENDED%' then raise; end if; end;
end $$;
reset role;
update public.furnishing_activation_workspaces set kill_switch=false
where workspace_id='ffc03a5f-6578-49e5-8751-3bc3c36fce9e';

update public.furnishing_activation_releases set global_kill_switch=true where milestone='FS-008A';
set local role authenticated;
do $$begin
  begin perform public.generate_authorized_furnishing_plan(jsonb_build_object(
    'command_context_id',md5('fsux9-plan-context-8')::uuid,'expected_project_version',1));
    raise exception 'EXPECTED_GLOBAL_FAILURE';
  exception when others then if sqlerrm not like '%FURNISHING_PLAN_GLOBAL_SUSPENDED%' then raise; end if; end;
end $$;
reset role;
update public.furnishing_activation_releases set global_kill_switch=false where milestone='FS-008A';

update public.furnishing_activation_capabilities set verification_state='failed'
where capability='design_workspace' and release_id=(select id from public.furnishing_activation_releases where milestone='FS-008A');
set local role authenticated;
do $$begin
  begin perform public.generate_authorized_furnishing_plan(jsonb_build_object(
    'command_context_id',md5('fsux9-plan-context-9')::uuid,'expected_project_version',1));
    raise exception 'EXPECTED_CAPABILITY_FAILURE';
  exception when others then if sqlerrm not like '%FURNISHING_PLAN_CAPABILITY_UNVERIFIED%' then raise; end if; end;
end $$;
reset role;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
do $$begin
  begin perform public.generate_authorized_furnishing_plan(jsonb_build_object(
    'command_context_id',md5('fsux9-plan-context-10')::uuid,'expected_project_version',1));
    raise exception 'EXPECTED_ANON_FAILURE';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$
begin
  if exists(select 1 from public.furnishing_plans where project_id in(
    md5('fsux9-plan-project-2')::uuid,md5('fsux9-plan-project-3')::uuid,
    md5('fsux9-plan-project-4')::uuid,md5('fsux9-plan-project-5')::uuid,
    md5('fsux9-plan-project-6')::uuid,md5('fsux9-plan-project-7')::uuid,
    md5('fsux9-plan-project-8')::uuid,md5('fsux9-plan-project-9')::uuid,
    md5('fsux9-plan-project-10')::uuid))
  then raise exception 'FSUX9_PLAN_DENIAL_CREATED_PLAN'; end if;
end $$;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $$declare cleaned jsonb;begin
  cleaned:=public.cleanup_fs008g_synthetic_project(jsonb_build_object(
    'designation_id',md5('fsux9-plan-designation-1')::uuid,
    'project_id',md5('fsux9-plan-project-1')::uuid,
    'workspace_id','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
    'controlled_run_id',md5('fsux9-plan-run-1')::uuid,
    'correlation_id',md5('fsux9-plan-correlation-1')::uuid,
    'actor_id','b1b72f07-fe0b-4e37-9ff3-08d570a0ee49',
    'candidate_commit','629db160a067ff35e3e4023ba9cf8da416f509ba',
    'reason','Atomic plan generation cleanup proof',
    'idempotency_key','fsux9-plan-cleanup-1'));
  if cleaned->>'status' not in('clean','cleaned') then
    raise exception 'FSUX9_PLAN_CLEANUP_RESULT_INVALID';
  end if;
end $$;
reset role;
do $$begin
  if (select lifecycle_status from public.furnishing_projects where id=md5('fsux9-plan-project-1')::uuid)<>'archived'
    or (select status from public.furnishing_plans where project_id=md5('fsux9-plan-project-1')::uuid)<>'superseded'
    or (select count(*) from public.furnishing_plan_generation_commands where project_id=md5('fsux9-plan-project-1')::uuid)<>1
    or (select count(*) from public.furnishing_plan_generation_audit_events where project_id=md5('fsux9-plan-project-1')::uuid)<>1
  then raise exception 'FSUX9_PLAN_CLEANUP_RECONCILIATION_FAILED'; end if;
end $$;

rollback;
\echo FS_UX_009_ATOMIC_PLAN_GENERATION_OK
