-- FS-UX-009: authenticated, tenant-bound Design Workspace creation.
begin;

create table public.furnishing_project_creation_commands (
  id uuid primary key default gen_random_uuid(),
  command_context_id uuid not null unique references public.furnishing_command_contexts(id) on delete cascade,
  project_id uuid not null unique references public.furnishing_projects(id) on delete cascade,
  workspace_id uuid not null references public.owners(id),
  property_id uuid not null references public.properties(id),
  package_version_id uuid not null references public.furnishing_package_versions(id),
  actor_id uuid not null references public.profiles(id),
  request_fingerprint text not null,
  idempotency_key text not null unique,
  correlation_id uuid not null,
  created_at timestamptz not null default now()
);

create index furnishing_project_creation_commands_scope_idx
  on public.furnishing_project_creation_commands(workspace_id,actor_id,created_at desc);

alter table public.furnishing_project_creation_commands enable row level security;
revoke all on public.furnishing_project_creation_commands from public,anon,authenticated;

create function public.create_authorized_furnishing_project_workspace(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  actor uuid:=auth.uid();
  context_id uuid;
  property_id uuid;
  package_version_id uuid;
  destination_workspace uuid;
  context_row public.furnishing_command_contexts%rowtype;
  property_row public.properties%rowtype;
  package_version public.furnishing_package_versions%rowtype;
  package_row public.furnishing_packages%rowtype;
  release_row public.furnishing_activation_releases%rowtype;
  workspace_release public.furnishing_activation_workspaces%rowtype;
  capability_row public.furnishing_activation_capabilities%rowtype;
  prior public.furnishing_project_creation_commands%rowtype;
  project_id uuid;
  membership_role text;
  name_value text;
  description_value text;
  project_type_value text;
  budget_priority_value text;
  launch_date_value date;
  target_budget_value bigint;
  fingerprint text;
begin
  if actor is null then
    raise exception 'FURNISHING_PROJECT_UNAUTHENTICATED' using errcode='42501';
  end if;
  begin
    context_id:=(p_input->>'command_context_id')::uuid;
    property_id:=(p_input->>'property_id')::uuid;
    package_version_id:=(p_input->>'package_version_id')::uuid;
    launch_date_value:=nullif(p_input->>'target_launch_date','')::date;
    target_budget_value:=nullif(p_input->>'target_budget_minor','')::bigint;
  exception when others then
    raise exception 'FURNISHING_PROJECT_COMMAND_INVALID';
  end;
  name_value:=trim(p_input->>'name');
  description_value:=nullif(trim(p_input->>'description'),'');
  project_type_value:=p_input->>'project_type';
  budget_priority_value:=p_input->>'budget_priority';
  if length(name_value)<1 or length(name_value)>200
    or project_type_value not in('full_property','partial_property','refresh','replacement')
    or budget_priority_value not in('stay_under_budget','balanced','prioritize_design')
    or target_budget_value is not null and target_budget_value<0
  then
    raise exception 'FURNISHING_PROJECT_COMMAND_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('furnishing-project-create:'||context_id::text,0));
  select c.* into context_row from public.furnishing_command_contexts c
  where c.id=context_id for update;
  if not found then raise exception 'FURNISHING_PROJECT_CONTEXT_MISSING'; end if;
  if context_row.actor_id<>actor then raise exception 'FURNISHING_PROJECT_CONTEXT_ACTOR_MISMATCH' using errcode='42501'; end if;
  if context_row.retired_at is not null then raise exception 'FURNISHING_PROJECT_CONTEXT_RETIRED'; end if;
  if context_row.expires_at<=now() then raise exception 'FURNISHING_PROJECT_CONTEXT_EXPIRED'; end if;
  if context_row.command_type<>'project.create' or context_row.target_type<>'workspace'
    or context_row.target_id<>context_row.workspace_id::text then
    raise exception 'FURNISHING_PROJECT_CONTEXT_MISMATCH';
  end if;
  destination_workspace:=context_row.workspace_id;

  fingerprint:=encode(digest(jsonb_build_object(
    'operation','design_workspace.create','workspaceId',destination_workspace,
    'propertyId',property_id,'packageVersionId',package_version_id,
    'name',name_value,'description',description_value,
    'projectType',project_type_value,'targetBudgetMinor',target_budget_value,
    'targetLaunchDate',launch_date_value,'budgetPriority',budget_priority_value,
    'styleVersionId',nullif(p_input->>'style_version_id',''),
    'bedrooms',p_input->>'bedrooms','bathrooms',p_input->>'bathrooms',
    'guests',p_input->>'guests','includeOutdoor',coalesce((p_input->>'include_outdoor')::boolean,false),
    'furnishingState',nullif(p_input->>'furnishing_state','')
  )::text,'sha256'),'hex');
  select c.* into prior from public.furnishing_project_creation_commands c
  where c.command_context_id=context_id for update;
  if found then
    if prior.actor_id<>actor or prior.workspace_id<>destination_workspace
      or prior.property_id<>property_id or prior.package_version_id<>package_version_id
      or prior.request_fingerprint<>fingerprint
    then raise exception 'FURNISHING_PROJECT_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('status','replayed','projectId',prior.project_id,
      'workspaceId',prior.workspace_id,'requestFingerprint',prior.request_fingerprint);
  end if;

  select r.* into release_row from public.furnishing_activation_releases r
  where r.milestone='FS-008A' for share;
  if not found or release_row.global_kill_switch
    or release_row.global_state='paused'
    or exists(select 1 from public.fsux8_release_suspensions s
      where s.release_id=release_row.id and s.scope='global' and s.state='active')
  then raise exception 'FURNISHING_PROJECT_GLOBAL_SUSPENDED' using errcode='42501'; end if;
  if release_row.global_state<>'internal' or not release_row.configuration_valid then
    raise exception 'FURNISHING_PROJECT_RELEASE_UNAVAILABLE' using errcode='42501';
  end if;
  select w.* into workspace_release from public.furnishing_activation_workspaces w
  where w.release_id=release_row.id and w.workspace_id=destination_workspace for share;
  if not found or not workspace_release.enabled or workspace_release.kill_switch
    or workspace_release.cohort<>'internal' or workspace_release.revoked_at is not null
    or workspace_release.effective_from is null or workspace_release.effective_from>now()
    or workspace_release.expires_at is not null and workspace_release.expires_at<=now()
    or exists(select 1 from public.fsux8_release_suspensions s
      where s.release_id=release_row.id and s.workspace_id=destination_workspace and s.scope='workspace' and s.state='active')
  then raise exception 'FURNISHING_PROJECT_WORKSPACE_SUSPENDED' using errcode='42501'; end if;
  select c.* into capability_row from public.furnishing_activation_capabilities c
  where c.release_id=release_row.id and c.capability='design_workspace' for share;
  if not found or not capability_row.enabled or capability_row.verification_state<>'verified'
    or capability_row.verified_at is null or capability_row.verification_event_id is null
  then raise exception 'FURNISHING_PROJECT_CAPABILITY_UNVERIFIED' using errcode='42501'; end if;

  membership_role:=public.active_workspace_role(destination_workspace);
  if membership_role is null then raise exception 'FURNISHING_PROJECT_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  if membership_role not in('owner','administrator','operator','contributor') then
    raise exception 'FURNISHING_PROJECT_PERMISSION_DENIED' using errcode='42501';
  end if;
  if not exists(select 1 from public.furnishing_controlled_fixture_designations d
    where d.workspace_id=destination_workspace and d.tenant_id=destination_workspace
      and d.candidate_commit=context_row.candidate_commit
      and d.revoked_at is null and d.cleaned_at is null and d.expires_at>now())
  then raise exception 'FURNISHING_PROJECT_DESIGNATION_REQUIRED' using errcode='42501'; end if;

  select p.* into property_row from public.properties p
  where p.id=property_id and p.owner_id=destination_workspace for share;
  if not found or not public.can_access_workspace_property(property_id) then
    raise exception 'FURNISHING_PROJECT_PROPERTY_DENIED' using errcode='42501';
  end if;
  select v.* into package_version from public.furnishing_package_versions v
  where v.id=package_version_id for share;
  if not found then raise exception 'FURNISHING_PROJECT_PACKAGE_NOT_FOUND'; end if;
  select p.* into package_row from public.furnishing_packages p
  where p.id=package_version.furnishing_package_id for share;
  if not found or package_row.workspace_id<>destination_workspace
    or package_row.governance_scope<>'workspace'
    or package_row.lifecycle_status<>'approved'
    or package_row.current_version_id is distinct from package_version.id
    or package_version.lifecycle_status<>'approved'
    or not exists(select 1 from public.furnishing_package_governance_approvals a
      where a.workspace_id=destination_workspace and a.package_kind='property'
        and a.package_version_id=package_version.id)
  then raise exception 'FURNISHING_PROJECT_PACKAGE_NOT_ELIGIBLE' using errcode='42501'; end if;

  insert into public.furnishing_projects(
    workspace_id,property_id,name,description,lifecycle_status,project_type,
    target_budget_minor,target_launch_date,furnishing_package_version_id,
    budget_priority,plan_status,design_workspace_status,budget,created_by
  ) values (
    destination_workspace,property_id,name_value,description_value,'planning',project_type_value,
    target_budget_value,launch_date_value,package_version.id,budget_priority_value,
    'not_generated','draft',jsonb_build_object('target',coalesce(target_budget_value,0)),actor
  ) returning id into project_id;
  insert into public.furnishing_project_creation_commands(
    command_context_id,project_id,workspace_id,property_id,package_version_id,
    actor_id,request_fingerprint,idempotency_key,correlation_id
  ) values (
    context_id,project_id,destination_workspace,property_id,package_version.id,
    actor,fingerprint,context_row.idempotency_key,context_row.correlation_id
  );
  return jsonb_build_object('status','created','projectId',project_id,
    'workspaceId',destination_workspace,'requestFingerprint',fingerprint);
end $$;

revoke all on function public.create_authorized_furnishing_project_workspace(jsonb)
  from public,anon;
grant execute on function public.create_authorized_furnishing_project_workspace(jsonb)
  to authenticated;

commit;
