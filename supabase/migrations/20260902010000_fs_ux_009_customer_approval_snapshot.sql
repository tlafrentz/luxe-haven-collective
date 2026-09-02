-- FS-UX-009 Production correction: make customer plan approval and the
-- immutable design/budget snapshot one authoritative transaction.
begin;

create or replace function public.transition_furnishing_owner_plan(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  actor uuid:=auth.uid();
  plan_id uuid;
  expected bigint;
  transition text;
  correlation uuid;
  command_key text;
  plan public.furnishing_plans%rowtype;
  project public.furnishing_projects%rowtype;
  prior public.furnishing_owner_plan_commands%rowtype;
  design_version public.fsux5_design_versions%rowtype;
  budget public.furnishing_budgets%rowtype;
  snapshot_id uuid;
  snapshot_value jsonb;
  approved_digest text;
  fingerprint text;
  next_status text;
  membership_role text;
begin
  if actor is null then
    raise exception 'OWNER_PLAN_UNAUTHORIZED' using errcode='42501';
  end if;
  begin
    plan_id:=(p_input->>'plan_id')::uuid;
    expected:=(p_input->>'expected_revision')::bigint;
    correlation:=(p_input->>'correlation_id')::uuid;
  exception when others then
    raise exception 'OWNER_PLAN_COMMAND_INVALID';
  end;
  transition:=p_input->>'transition';
  command_key:=left(trim(p_input->>'idempotency_key'),200);
  if transition not in('submit','approve') or length(command_key)<8 then
    raise exception 'OWNER_PLAN_COMMAND_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('owner-plan-transition:'||plan_id::text,0));
  select value.* into plan from public.furnishing_plans value where value.id=plan_id for update;
  if not found then raise exception 'OWNER_PLAN_NOT_FOUND'; end if;
  select value.* into project from public.furnishing_projects value where value.id=plan.project_id for update;
  if not found then raise exception 'OWNER_PLAN_NOT_FOUND'; end if;

  membership_role:=public.active_workspace_role(project.workspace_id);
  if not public.is_admin() and membership_role not in('owner','administrator','operator') then
    raise exception 'OWNER_PLAN_UNAUTHORIZED' using errcode='42501';
  end if;
  if project.current_plan_version_id is distinct from plan.id then
    raise exception 'OWNER_PLAN_STALE';
  end if;

  fingerprint:=encode(digest(jsonb_build_object(
    'operation','furnishing.plan.'||transition,
    'workspaceId',project.workspace_id,
    'projectId',project.id,
    'planId',plan.id,
    'expectedRevision',expected,
    'correlationId',correlation
  )::text,'sha256'),'hex');
  select command.* into prior from public.furnishing_owner_plan_commands command
  where command.idempotency_key=command_key for update;
  if found then
    if prior.payload_hash<>fingerprint or prior.workspace_id<>project.workspace_id
      or prior.project_id<>project.id or prior.plan_id<>plan.id
    then raise exception 'OWNER_PLAN_REPLAY_CONFLICT'; end if;
    return prior.after_state||jsonb_build_object('status','replayed');
  end if;

  if transition='approve' and plan.status='approved' then
    select value.id into snapshot_id from public.fsux5_approval_snapshots value
    where value.project_id=project.id order by value.created_at desc limit 1;
    if snapshot_id is null then raise exception 'OWNER_PLAN_APPROVED_WITHOUT_SNAPSHOT'; end if;
    return jsonb_build_object('status','replayed','revision',plan.revision,
      'planId',plan.id,'projectId',project.id,'snapshotId',snapshot_id);
  end if;
  if plan.revision<>expected then raise exception 'OWNER_PLAN_STALE'; end if;

  if transition='submit' then
    if plan.status<>'draft' or not public.fs008g_owner_selection_eligible(project.workspace_id) then
      raise exception 'OWNER_PLAN_NOT_SUBMITTABLE';
    end if;
    if exists(
      select 1 from public.furnishing_product_selections selection
      left join public.furnishing_selection_delivery_allocations delivery
        on delivery.selection_id=selection.id and delivery.project_id=project.id
      where selection.furnishing_plan_id=plan.id and
        ((selection.required and selection.product_id is null)
          or (selection.purchase_quantity>0 and delivery.id is null))
    ) then raise exception 'OWNER_PLAN_VALIDATION_FAILED'; end if;
    next_status:='awaiting_approval';
    update public.furnishing_plans set status=next_status,revision=revision+1,updated_at=now()
    where id=plan.id;
    update public.furnishing_projects set plan_status=next_status,
      lifecycle_status='awaiting_approval',updated_at=now() where id=project.id;
  else
    if plan.status<>'awaiting_approval' then raise exception 'OWNER_PLAN_NOT_REVIEWABLE'; end if;
    if exists(
      select 1
      from public.furnishing_product_selections selection
      left join public.furnishing_product_versions product_version
        on product_version.id=selection.product_version_id
       and product_version.product_id=selection.product_id
       and product_version.workspace_id=project.workspace_id
       and product_version.lifecycle_status='approved'
      left join public.furnishing_product_offers offer
        on offer.id=selection.selected_offer_id
       and offer.product_id=selection.product_id
       and offer.status='active'
      where selection.furnishing_plan_id=plan.id and selection.required
        and (selection.product_id is null or product_version.id is null
          or (selection.purchase_quantity>0 and offer.id is null))
    ) then raise exception 'OWNER_PLAN_APPROVAL_INELIGIBLE'; end if;

    select version.* into design_version from public.fsux5_design_versions version
    where version.project_id=project.id order by version.version_number desc limit 1 for update;
    if not found then
      insert into public.fsux5_design_versions(project_id,version_number,state,created_by)
      values(project.id,1,'customer_review',actor) returning * into design_version;
      update public.furnishing_projects set current_design_version_id=design_version.id
      where id=project.id;
      update public.furnishing_rooms set design_version_id=design_version.id
      where project_id=project.id and design_version_id is null;
    elsif project.current_design_version_id is distinct from design_version.id then
      update public.furnishing_projects set current_design_version_id=design_version.id
      where id=project.id;
    end if;

    select value.* into budget from public.furnishing_budgets value
    where value.project_id=project.id order by value.version_number desc limit 1 for update;
    if not found then
      insert into public.furnishing_budgets(
        project_id,design_version_id,target_amount_minor,currency,status,version_number,
        lifecycle_status,inclusion_basis,target_maximum_minor,product_subtotal_minor,
        delivery_minor,estimated_total_minor,calculation
      ) values (
        project.id,design_version.id,coalesce(project.target_budget_minor,plan.estimated_total_minor,0),
        plan.currency,'draft',1,'customer_review','products_delivery',project.target_budget_minor,
        plan.estimated_subtotal_minor,plan.estimated_shipping_minor,plan.estimated_total_minor,
        jsonb_build_object('source','approved_furnishing_plan','planId',plan.id,'planRevision',plan.revision)
      ) returning * into budget;
    elsif budget.design_version_id is distinct from design_version.id then
      raise exception 'OWNER_PLAN_BUDGET_VERSION_CONFLICT';
    end if;

    snapshot_value:=jsonb_build_object(
      'schemaVersion','fs-ux-009-customer-approval-v1',
      'property_id',project.property_id,
      'project',to_jsonb(project),
      'plan',to_jsonb(plan),
      'design_version',to_jsonb(design_version),
      'budget',to_jsonb(budget),
      'rooms',coalesce((select jsonb_agg(to_jsonb(room) order by room.sort_order,room.id)
        from public.furnishing_rooms room where room.project_id=project.id),'[]'::jsonb),
      'selections',coalesce((select jsonb_agg(
        to_jsonb(selection)||jsonb_build_object(
          'product_version',to_jsonb(product_version),
          'offer',to_jsonb(offer),
          'retailer',to_jsonb(retailer)
        ) order by selection.sort_order,selection.id)
        from public.furnishing_product_selections selection
        left join public.furnishing_product_versions product_version on product_version.id=selection.product_version_id
        left join public.furnishing_product_offers offer on offer.id=selection.selected_offer_id
        left join public.furnishing_retailers retailer on retailer.id=offer.retailer_id
        where selection.furnishing_plan_id=plan.id),'[]'::jsonb),
      'externalEffects',false
    );
    approved_digest:=encode(digest(snapshot_value::text,'sha256'),'hex');
    if current_setting('fsux9.force_approval_snapshot_failure',true)='on' then
      raise exception 'OWNER_PLAN_SNAPSHOT_PERSISTENCE_FAILED';
    end if;
    insert into public.fsux5_approval_snapshots(
      project_id,design_version_id,budget_id,property_id,snapshot,snapshot_digest,
      approved_by,correlation_id
    ) values (
      project.id,design_version.id,budget.id,project.property_id,snapshot_value,approved_digest,
      actor,correlation::text
    ) returning id into snapshot_id;

    update public.fsux5_design_versions set state='approved',approved_at=now(),
      snapshot_digest=approved_digest where id=design_version.id;
    update public.furnishing_budgets set lifecycle_status='approved',status='approved',
      approved_at=now(),updated_at=now() where id=budget.id;
    update public.furnishing_plans set status='approved',revision=revision+1,
      approved_by=actor,approved_at=now(),updated_at=now() where id=plan.id;
    update public.furnishing_projects set plan_status='approved',lifecycle_status='approved',
      design_workspace_status='approved',current_design_version_id=design_version.id,
      optimistic_version=optimistic_version+1,updated_at=now() where id=project.id;
    next_status:='approved';
  end if;

  if current_setting('fsux9.force_approval_audit_failure',true)='on' then
    raise exception 'OWNER_PLAN_AUDIT_PERSISTENCE_FAILED';
  end if;
  insert into public.furnishing_owner_plan_commands(
    workspace_id,project_id,plan_id,actor_id,command_type,expected_revision,
    resulting_revision,payload_hash,before_state,after_state,correlation_id,idempotency_key
  ) values (
    project.workspace_id,project.id,plan.id,actor,transition,expected,expected+1,fingerprint,
    jsonb_build_object('status',plan.status,'revision',expected),
    jsonb_build_object('status',next_status,'revision',expected+1,'planId',plan.id,
      'projectId',project.id,'snapshotId',snapshot_id),correlation,command_key
  ) returning * into prior;
  insert into public.fsux5_activity(project_id,design_version_id,event_type,evidence,actor_id,correlation_id)
  values(project.id,case when transition='approve' then design_version.id end,
    case when transition='approve' then 'customer_plan_approved' else 'customer_plan_submitted' end,
    jsonb_build_object('planId',plan.id,'planRevision',expected+1,'snapshotId',snapshot_id,
      'externalEffects',false),actor,correlation::text);
  return prior.after_state;
end
$$;

revoke all on function public.transition_furnishing_owner_plan(jsonb) from public,anon;
grant execute on function public.transition_furnishing_owner_plan(jsonb) to authenticated;

commit;
