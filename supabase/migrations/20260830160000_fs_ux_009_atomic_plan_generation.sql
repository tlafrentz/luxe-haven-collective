-- FS-UX-009: authenticated, atomic Design Workspace plan generation.
begin;

create table public.furnishing_plan_generation_audit_events (
  id uuid primary key default gen_random_uuid(),
  command_context_id uuid unique references public.furnishing_command_contexts(id) on delete set null,
  workspace_id uuid not null references public.owners(id),
  project_id uuid not null references public.furnishing_projects(id) on delete restrict,
  plan_id uuid not null unique references public.furnishing_plans(id) on delete restrict,
  actor_id uuid not null references public.profiles(id),
  actor_role text not null,
  correlation_id uuid not null,
  candidate_commit text not null,
  workflow text not null,
  idempotency_key text not null unique,
  event_type text not null check(event_type='design-workspace-plan-generated'),
  request_fingerprint text not null,
  before_state jsonb not null,
  after_state jsonb not null,
  occurred_at timestamptz not null default now()
);

create table public.furnishing_plan_generation_commands (
  id uuid primary key default gen_random_uuid(),
  command_context_id uuid unique references public.furnishing_command_contexts(id) on delete set null,
  audit_event_id uuid not null unique references public.furnishing_plan_generation_audit_events(id) on delete restrict,
  workspace_id uuid not null references public.owners(id),
  project_id uuid not null references public.furnishing_projects(id) on delete restrict,
  plan_id uuid not null unique references public.furnishing_plans(id) on delete restrict,
  actor_id uuid not null references public.profiles(id),
  idempotency_key text not null unique,
  correlation_id uuid not null,
  request_fingerprint text not null,
  project_version_before bigint not null,
  project_version_after bigint not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index furnishing_plan_generation_commands_scope_idx
  on public.furnishing_plan_generation_commands(workspace_id,project_id,created_at desc);
create index furnishing_plan_generation_audit_scope_idx
  on public.furnishing_plan_generation_audit_events(workspace_id,project_id,occurred_at,id);

alter table public.furnishing_plan_generation_audit_events enable row level security;
alter table public.furnishing_plan_generation_commands enable row level security;
revoke all on public.furnishing_plan_generation_audit_events,
  public.furnishing_plan_generation_commands from public,anon,authenticated;

create function public.fsux9_reject_plan_generation_evidence_mutation()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  raise exception 'FURNISHING_PLAN_GENERATION_EVIDENCE_IMMUTABLE';
end $$;

create trigger furnishing_plan_generation_audit_immutable
before update or delete on public.furnishing_plan_generation_audit_events
for each row execute function public.fsux9_reject_plan_generation_evidence_mutation();
create trigger furnishing_plan_generation_command_immutable
before update or delete on public.furnishing_plan_generation_commands
for each row execute function public.fsux9_reject_plan_generation_evidence_mutation();

create function public.generate_authorized_furnishing_plan(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  actor uuid:=auth.uid();
  context_id uuid;
  expected_project_version bigint;
  context_row public.furnishing_command_contexts%rowtype;
  project_row public.furnishing_projects%rowtype;
  package_version public.furnishing_package_versions%rowtype;
  package_row public.furnishing_packages%rowtype;
  release_row public.furnishing_activation_releases%rowtype;
  workspace_release public.furnishing_activation_workspaces%rowtype;
  capability_row public.furnishing_activation_capabilities%rowtype;
  prior public.furnishing_plan_generation_commands%rowtype;
  plan_id uuid;
  audit_id uuid;
  membership_role text;
  fingerprint text;
  result jsonb;
  facts_bedrooms numeric;
  facts_bathrooms numeric;
  facts_guests numeric;
  facts_rooms numeric;
  selection_count integer:=0;
  selection_order integer:=0;
  total bigint:=0;
  room_row record;
  item_row record;
  rule_basis numeric;
  quantity numeric;
  selected_offer uuid;
  unit_price bigint;
  compatibility text;
  room_package_version uuid;
begin
  if actor is null then
    raise exception 'FURNISHING_PLAN_UNAUTHENTICATED' using errcode='42501';
  end if;
  begin
    context_id:=(p_input->>'command_context_id')::uuid;
    expected_project_version:=(p_input->>'expected_project_version')::bigint;
  exception when others then
    raise exception 'FURNISHING_PLAN_COMMAND_INVALID';
  end;
  if expected_project_version is null or expected_project_version<1 then
    raise exception 'FURNISHING_PLAN_COMMAND_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('furnishing-plan-generate:'||context_id::text,0));
  select c.* into context_row from public.furnishing_command_contexts c
  where c.id=context_id for update;
  if not found then raise exception 'FURNISHING_PLAN_CONTEXT_MISSING'; end if;
  if context_row.actor_id<>actor then
    raise exception 'FURNISHING_PLAN_CONTEXT_ACTOR_MISMATCH' using errcode='42501';
  end if;
  if context_row.command_type<>'project.plan.generate' or context_row.target_type<>'project' then
    raise exception 'FURNISHING_PLAN_CONTEXT_MISMATCH';
  end if;

  fingerprint:=encode(digest(jsonb_build_object(
    'operation','design_workspace.plan.generate',
    'workspaceId',context_row.workspace_id,
    'projectId',context_row.target_id,
    'expectedProjectVersion',expected_project_version
  )::text,'sha256'),'hex');

  select c.* into prior from public.furnishing_plan_generation_commands c
  where c.idempotency_key=context_row.idempotency_key for update;
  if found then
    if prior.command_context_id is distinct from context_id or prior.actor_id<>actor
      or prior.workspace_id<>context_row.workspace_id
      or prior.project_id::text<>context_row.target_id
      or prior.request_fingerprint<>fingerprint
    then raise exception 'FURNISHING_PLAN_IDEMPOTENCY_CONFLICT'; end if;
    return prior.result||jsonb_build_object('status','replayed');
  end if;
  if context_row.retired_at is not null then raise exception 'FURNISHING_PLAN_CONTEXT_RETIRED'; end if;
  if context_row.expires_at<=now() then raise exception 'FURNISHING_PLAN_CONTEXT_EXPIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended('furnishing-plan-project:'||context_row.target_id,0));
  select p.* into project_row from public.furnishing_projects p
  where p.id::text=context_row.target_id for update;
  if not found then raise exception 'FURNISHING_PLAN_PROJECT_NOT_FOUND'; end if;
  if project_row.workspace_id<>context_row.workspace_id then
    raise exception 'FURNISHING_PLAN_WORKSPACE_MISMATCH' using errcode='42501';
  end if;
  if project_row.optimistic_version<>expected_project_version then
    raise exception 'FURNISHING_PLAN_STALE_PROJECT';
  end if;
  if project_row.lifecycle_status not in('planning','designing')
    or project_row.plan_status<>'not_generated' or project_row.current_plan_version_id is not null
  then raise exception 'FURNISHING_PLAN_STATE_CONFLICT'; end if;

  select r.* into release_row from public.furnishing_activation_releases r
  where r.milestone='FS-008A' for share;
  if not found or release_row.global_kill_switch or release_row.global_state='paused'
    or exists(select 1 from public.fsux8_release_suspensions s
      where s.release_id=release_row.id and s.scope='global' and s.state='active')
  then raise exception 'FURNISHING_PLAN_GLOBAL_SUSPENDED' using errcode='42501'; end if;
  if release_row.global_state<>'internal' or not release_row.configuration_valid then
    raise exception 'FURNISHING_PLAN_RELEASE_UNAVAILABLE' using errcode='42501';
  end if;
  select w.* into workspace_release from public.furnishing_activation_workspaces w
  where w.release_id=release_row.id and w.workspace_id=project_row.workspace_id for share;
  if not found or not workspace_release.enabled or workspace_release.kill_switch
    or workspace_release.cohort<>'internal' or workspace_release.revoked_at is not null
    or workspace_release.effective_from is null or workspace_release.effective_from>now()
    or workspace_release.expires_at is not null and workspace_release.expires_at<=now()
    or exists(select 1 from public.fsux8_release_suspensions s
      where s.release_id=release_row.id and s.workspace_id=project_row.workspace_id
        and s.scope='workspace' and s.state='active')
  then raise exception 'FURNISHING_PLAN_WORKSPACE_SUSPENDED' using errcode='42501'; end if;
  select c.* into capability_row from public.furnishing_activation_capabilities c
  where c.release_id=release_row.id and c.capability='design_workspace' for share;
  if not found or not capability_row.enabled or capability_row.verification_state<>'verified'
    or capability_row.verified_at is null or capability_row.verification_event_id is null
  then raise exception 'FURNISHING_PLAN_CAPABILITY_UNVERIFIED' using errcode='42501'; end if;

  membership_role:=public.active_workspace_role(project_row.workspace_id);
  if membership_role is null then
    raise exception 'FURNISHING_PLAN_MEMBERSHIP_REQUIRED' using errcode='42501';
  end if;
  if membership_role not in('owner','administrator','operator','contributor') then
    raise exception 'FURNISHING_PLAN_PERMISSION_DENIED' using errcode='42501';
  end if;
  if not exists(select 1 from public.furnishing_controlled_fixture_designations d
    where d.project_id=project_row.id and d.workspace_id=project_row.workspace_id
      and d.candidate_commit=context_row.candidate_commit
      and d.revoked_at is null and d.cleaned_at is null and d.expires_at>now())
  then raise exception 'FURNISHING_PLAN_DESIGNATION_REQUIRED' using errcode='42501'; end if;

  select v.* into package_version from public.furnishing_package_versions v
  where v.id=project_row.furnishing_package_version_id for share;
  if not found then raise exception 'FURNISHING_PLAN_PACKAGE_NOT_FOUND'; end if;
  select p.* into package_row from public.furnishing_packages p
  where p.id=package_version.furnishing_package_id for share;
  if not found or package_row.workspace_id<>project_row.workspace_id
    or package_row.lifecycle_status<>'approved'
    or package_row.current_version_id is distinct from package_version.id
    or package_version.lifecycle_status<>'approved'
  then raise exception 'FURNISHING_PLAN_PACKAGE_STALE'; end if;

  if current_setting('fsux9.force_plan_insert_failure',true)='on' then
    raise exception 'FURNISHING_PLAN_INSERT_PERSISTENCE_FAILED';
  end if;
  insert into public.furnishing_plans(
    project_id,version_number,furnishing_package_version_id,status,
    package_snapshot,design_snapshot,created_by
  ) values (
    project_row.id,1,package_version.id,'draft',
    jsonb_build_object('packageVersionId',package_version.id,'versionNumber',package_version.version_number),
    jsonb_build_object('designProfileVersionId',project_row.design_profile_version_id),actor
  ) returning id into plan_id;

  select coalesce(profile.bedroom_count,1),coalesce(profile.bathroom_count,1),
    coalesce(profile.guest_capacity,2),count(room.id)
  into facts_bedrooms,facts_bathrooms,facts_guests,facts_rooms
  from public.furnishing_projects project
  left join public.property_furnishing_profiles profile on profile.property_id=project.property_id
  left join public.furnishing_rooms room on room.project_id=project.id
  where project.id=project_row.id
  group by profile.bedroom_count,profile.bathroom_count,profile.guest_capacity;

  for room_row in select r.* from public.furnishing_rooms r
    where r.project_id=project_row.id order by r.sort_order,r.id for update
  loop
    select composition.room_package_version_id into room_package_version
    from public.furnishing_package_room_composition composition
    where composition.furnishing_package_version_id=package_version.id
      and composition.room_type=case when room_row.room_type='primary_bedroom'
        and not exists(select 1 from public.furnishing_package_room_composition exact
          where exact.furnishing_package_version_id=package_version.id and exact.room_type='primary_bedroom')
        then 'bedroom' else room_row.room_type end
    order by composition.sort_order,composition.id limit 1;
    if room_package_version is null then continue; end if;
    update public.furnishing_rooms set room_package_version_id=room_package_version,
      status='planning',updated_at=now() where id=room_row.id;

    for item_row in
      select item.*,requirement.name as authoritative_requirement_name,
        rule.rule_type,rule.multiplier,rule.minimum,rule.maximum,rule.rounding,
        rule.custom_expression,product.preferred_offer_id
      from public.furnishing_room_package_items item
      join public.furnishing_quantity_rules rule on rule.id=item.quantity_rule_id
      left join public.furnishing_room_requirements requirement on requirement.id=item.room_requirement_id
      left join public.furnishing_products product on product.id=item.recommended_product_id
      where item.room_package_version_id=room_package_version
      order by item.sort_order,item.id
    loop
      if item_row.rule_type='custom' then raise exception 'FURNISHING_PLAN_CUSTOM_RULE_UNAVAILABLE'; end if;
      rule_basis:=case item_row.rule_type when 'fixed' then 1
        when 'per_bedroom' then facts_bedrooms when 'per_bathroom' then facts_bathrooms
        when 'per_guest' then facts_guests when 'per_room' then facts_rooms
        when 'per_bed' then facts_bedrooms else null end;
      if rule_basis is null then raise exception 'FURNISHING_PLAN_QUANTITY_INVALID'; end if;
      quantity:=rule_basis*item_row.multiplier;
      if item_row.minimum is not null then quantity:=greatest(quantity,item_row.minimum); end if;
      if item_row.maximum is not null then quantity:=least(quantity,item_row.maximum); end if;
      quantity:=case item_row.rounding when 'up' then ceil(quantity)
        when 'down' then floor(quantity) when 'nearest' then round(quantity) else quantity end;
      if quantity<0 then raise exception 'FURNISHING_PLAN_QUANTITY_INVALID'; end if;

      selected_offer:=null;unit_price:=null;compatibility:=null;
      if item_row.recommended_product_id is not null then
        select offer.id,offer.listed_price_minor into selected_offer,unit_price
        from public.furnishing_product_offers offer
        where offer.product_id=item_row.recommended_product_id and offer.status='active'
          and offer.availability='in_stock' and offer.listed_price_minor is not null
        order by (offer.id=item_row.preferred_offer_id) desc,offer.listed_price_minor,offer.id limit 1;
        if project_row.design_profile_version_id is not null then
          select assignment.compatibility into compatibility
          from public.furnishing_product_style_assignments assignment
          join public.furnishing_design_profile_versions design on design.id=project_row.design_profile_version_id
          where assignment.product_id=item_row.recommended_product_id
            and assignment.style_system_version_id=design.style_system_version_id limit 1;
        end if;
      end if;
      insert into public.furnishing_product_selections(
        furnishing_plan_id,room_id,package_item_id,requirement_id,requirement_name,
        product_id,selected_offer_id,quantity_rule_id,resolved_quantity,purchase_quantity,
        estimated_unit_price_minor,estimated_total_minor,price_observed_at,selection_source,
        selection_status,required,priority,style_compatibility,sort_order
      ) values (
        plan_id,room_row.id,item_row.id,item_row.room_requirement_id,
        coalesce(item_row.authoritative_requirement_name,item_row.requirement_key),
        item_row.recommended_product_id,selected_offer,item_row.quantity_rule_id,quantity,quantity,
        unit_price,case when unit_price is null then null else round(unit_price*quantity) end,
        case when unit_price is null then null else now() end,'package',
        case when item_row.recommended_product_id is null then 'missing' else 'recommended' end,
        item_row.required,item_row.priority,compatibility,selection_order
      );
      selection_order:=selection_order+1;selection_count:=selection_count+1;
      total:=total+coalesce(round(unit_price*quantity),0);
    end loop;
  end loop;

  update public.furnishing_plans set estimated_subtotal_minor=total,
    estimated_total_minor=total,updated_at=now() where id=plan_id;
  if current_setting('fsux9.force_project_update_failure',true)='on' then
    raise exception 'FURNISHING_PLAN_PROJECT_PERSISTENCE_FAILED';
  end if;
  update public.furnishing_projects set current_plan_version_id=plan_id,
    plan_status='draft',lifecycle_status='designing',optimistic_version=optimistic_version+1,
    updated_at=now()
  where id=project_row.id and optimistic_version=expected_project_version;
  if not found then raise exception 'FURNISHING_PLAN_STALE_PROJECT'; end if;

  result:=jsonb_build_object('status','created','workspaceId',project_row.workspace_id,
    'projectId',project_row.id,'planId',plan_id,'planStatus','draft',
    'lifecycleStatus','designing','projectVersion',expected_project_version+1,
    'selectionCount',selection_count,'estimatedTotalMinor',total,
    'requestFingerprint',fingerprint);
  if current_setting('fsux9.force_plan_audit_failure',true)='on' then
    raise exception 'FURNISHING_PLAN_AUDIT_PERSISTENCE_FAILED';
  end if;
  insert into public.furnishing_plan_generation_audit_events(
    command_context_id,workspace_id,project_id,plan_id,actor_id,actor_role,correlation_id,
    candidate_commit,workflow,idempotency_key,event_type,request_fingerprint,before_state,after_state
  ) values (
    context_id,project_row.workspace_id,project_row.id,plan_id,actor,context_row.actor_role,
    context_row.correlation_id,context_row.candidate_commit,context_row.workflow,
    context_row.idempotency_key,'design-workspace-plan-generated',fingerprint,
    jsonb_build_object('projectVersion',expected_project_version,'currentPlanId',null,
      'planStatus',project_row.plan_status,'lifecycleStatus',project_row.lifecycle_status),result
  ) returning id into audit_id;
  insert into public.furnishing_plan_generation_commands(
    command_context_id,audit_event_id,workspace_id,project_id,plan_id,actor_id,
    idempotency_key,correlation_id,request_fingerprint,project_version_before,
    project_version_after,result
  ) values (
    context_id,audit_id,project_row.workspace_id,project_row.id,plan_id,actor,
    context_row.idempotency_key,context_row.correlation_id,fingerprint,
    expected_project_version,expected_project_version+1,result
  );
  return result;
exception
  when unique_violation then
    raise exception 'FURNISHING_PLAN_PERSISTENCE_CONFLICT';
end $$;

revoke all on function public.fsux9_reject_plan_generation_evidence_mutation(),
  public.generate_authorized_furnishing_plan(jsonb) from public,anon;
grant execute on function public.generate_authorized_furnishing_plan(jsonb) to authenticated;

commit;
